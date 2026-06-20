import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomInt, randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  PRODUCT_DELIVERY_CHANNELS,
  PRODUCT_DOCUMENT_TYPES,
  PRODUCT_LANGUAGES,
  PRODUCT_MATTER_STATUSES,
  PRODUCT_MATTER_TYPES,
  type ClientAccount,
  type Invoice,
  type Matter,
  type ProductAuthMethod,
  type ProductDocument,
  type ProductLanguage,
  type ProductSession,
  type TimeEntry,
} from "@wakeel/shared";
import { readBearerToken, signAppToken, verifyAppToken } from "./auth.js";
import { getJwtSecret, isProduction } from "./config.js";
import { fetchCourtCauseList, isSupportedCourtSource, normalizeCourtCaseNumber, type CourtListType } from "./court-sources.js";
import { MATTER_CSV_TEMPLATE, validateMatterCsv } from "./csv-import.js";
import { isIsoDateOnly, isIsoDateOrDateTime } from "./date-validation.js";
import { normalizePakistanPhone } from "./validation.js";
import { runOcr } from "./ocr.js";
import { createSmsProvider } from "./providers.js";
import { createPrivateObjectStorage } from "./storage.js";
import { type ProductStore } from "./product-store.js";
import { type PostgresProductStore } from "./postgres-product-store.js";

const DEV_OTP_CODE = process.env.WAKEEL_DEV_OTP_CODE ?? "246810";
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
const REFRESH_TOKEN_TTL_DAYS = 30;
type ProductStoreContract = ProductStore | PostgresProductStore;
const PARTY_TYPES = ["petitioner", "respondent", "applicant", "other"] as const;

function getProductUploadsDirectory(): string {
  return process.env.PRODUCT_UPLOADS_DIRECTORY ?? join(process.cwd(), "data", "product-uploads");
}

function maskPhone(phone: string): string {
  if (phone.length < 6) {
    return phone;
  }
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(phone.length - 6, 0))}${phone.slice(-2)}`;
}

function readPortalToken(request: FastifyRequest): string | null {
  const headerToken = request.headers["x-portal-token"];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }
  const query = request.query as { token?: string; portalToken?: string } | undefined;
  return query?.token ?? query?.portalToken ?? null;
}

function readRefreshToken(request: FastifyRequest): string | null {
  const headerToken = request.headers["x-refresh-token"];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }

  const body = request.body as { refreshToken?: string } | undefined;
  return body?.refreshToken ?? null;
}

async function requireProductSession(
  request: FastifyRequest,
  reply: FastifyReply,
  store: ProductStoreContract,
): Promise<(ProductSession & { profile: NonNullable<Awaited<ReturnType<ProductStoreContract["getProfile"]>>> }) | null> {
  const token = readBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401);
    return null;
  }

  const verified = verifyAppToken(token, getJwtSecret());
  if (!verified) {
    reply.code(401);
    return null;
  }
  if (verified.portalLinkId) {
    reply.code(403);
    return null;
  }

  const profile = await store.getProfile(verified);
  if (!profile) {
    reply.code(401);
    return null;
  }

  if (verified.sessionId && !await store.getActiveSession(verified.sessionId)) {
    reply.code(401);
    return null;
  }

  return { ...verified, profile };
}

async function requirePortalScopedAccess(
  request: FastifyRequest,
  reply: FastifyReply,
  store: ProductStoreContract,
  rawPortalToken: string,
) {
  const bearerToken = readBearerToken(request.headers.authorization);
  const verified = bearerToken ? verifyAppToken(bearerToken, getJwtSecret()) : null;
  if (!verified?.portalLinkId || verified.actorType !== "client") {
    reply.code(401);
    return null;
  }
  const access = await store.getPortalAccess(rawPortalToken);
  if (
    !access ||
    access.link.id !== verified.portalLinkId ||
    access.clientAccount.id !== verified.actorId ||
    access.session.firmId !== verified.firmId
  ) {
    reply.code(404);
    return null;
  }
  return access;
}

function requireStaffSession(
  session: Awaited<ReturnType<typeof requireProductSession>>,
  reply: FastifyReply,
): session is NonNullable<Awaited<ReturnType<typeof requireProductSession>>> & { actorType: "staff" } {
  if (!session || session.actorType !== "staff") {
    reply.code(403);
    return false;
  }
  return true;
}

function requireClientSession(
  session: Awaited<ReturnType<typeof requireProductSession>>,
  reply: FastifyReply,
): session is NonNullable<Awaited<ReturnType<typeof requireProductSession>>> & { actorType: "client" } {
  if (!session || session.actorType !== "client") {
    reply.code(403);
    return false;
  }
  return true;
}

function requirePermission(
  session: Awaited<ReturnType<typeof requireProductSession>>,
  reply: FastifyReply,
  permission: string,
): session is NonNullable<Awaited<ReturnType<typeof requireProductSession>>> & { actorType: "staff" } {
  if (!requireStaffSession(session, reply)) {
    return false;
  }
  const permissions = session.profile.staffMembership?.permissions ?? [];
  if (!permissions.includes("*") && !permissions.includes(permission)) {
    reply.code(403);
    return false;
  }
  return true;
}

function publicDevelopmentFields(fields: Record<string, unknown>): Record<string, unknown> {
  return isProduction() ? {} : fields;
}

function isProductActorType(value: unknown): value is "staff" | "client" {
  return value === "staff" || value === "client";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyText(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isNullableText(value: unknown, maxLength = 500): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isNullableEmail(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDateOrDateTime(value);
}

function parseMatterPatch(value: unknown): Partial<Omit<Matter, "id" | "firmId">> | null {
  if (!isRecord(value)) {
    return null;
  }
  const patch: Partial<Omit<Matter, "id" | "firmId">> = {};
  for (const field of ["courtId", "rawCaseNumber", "normalizedCaseNumber", "title", "stage"] as const) {
    if (field in value) {
      if (!isNonEmptyText(value[field])) {
        return null;
      }
      patch[field] = value[field];
    }
  }
  if ("matterType" in value) {
    if (!PRODUCT_MATTER_TYPES.includes(value.matterType as Matter["matterType"])) {
      return null;
    }
    patch.matterType = value.matterType as Matter["matterType"];
  }
  if ("status" in value) {
    if (!PRODUCT_MATTER_STATUSES.includes(value.status as Matter["status"])) {
      return null;
    }
    patch.status = value.status as Matter["status"];
  }
  if ("nextHearingAt" in value) {
    const nextHearingAt = value.nextHearingAt === "" ? null : value.nextHearingAt;
    if (!isNullableIsoDate(nextHearingAt)) {
      return null;
    }
    patch.nextHearingAt = nextHearingAt;
  }
  if ("leadLawyerId" in value) {
    if (value.leadLawyerId !== null && !isNonEmptyText(value.leadLawyerId, 100)) {
      return null;
    }
    patch.leadLawyerId = value.leadLawyerId as string | null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

async function parseMultipartFields(request: FastifyRequest): Promise<{
  fields: Record<string, string>;
  fileName: string | null;
  bytes: Buffer | null;
  mimeType: string | null;
}> {
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.includes("multipart/form-data")) {
    return { fields: {}, fileName: null, bytes: null, mimeType: null };
  }

  const parts = request.parts();
  const fields: Record<string, string> = {};
  let fileName: string | null = null;
  let bytes: Buffer | null = null;
  let mimeType: string | null = null;

  for await (const part of parts) {
    if (part.type === "file") {
      if (bytes) {
        continue;
      }
      bytes = await part.toBuffer();
      fileName = part.filename ?? null;
      mimeType = part.mimetype ?? "application/octet-stream";
      continue;
    }

    fields[part.fieldname] = String(part.value ?? "");
  }

  return { fields, fileName, bytes, mimeType };
}

export function registerProductRoutes(app: FastifyInstance, store: ProductStoreContract): void {
  const publicWebUrl = process.env.PUBLIC_WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const smsProvider = createSmsProvider();
  const objectStorage = createPrivateObjectStorage();
  const roleDefinitions = [
    { id: "owner", permissions: ["*"] },
    { id: "lawyer", permissions: ["matters.read", "matters.write", "clients.write", "hearings.write", "documents.read", "documents.write", "messages.write", "time.write", "court.sync", "portal.write"] },
    { id: "assistant", permissions: ["matters.read", "documents.read", "calendar.read"] },
    { id: "billing", permissions: ["invoices.read", "invoices.write", "time.read"] },
  ] as const;

  app.addHook("onResponse", async (request, reply) => {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(request.method) || reply.statusCode >= 400) {
      return;
    }
    const token = readBearerToken(request.headers.authorization);
    const session = token ? verifyAppToken(token, getJwtSecret()) : null;
    if (session) {
      await store.recordApiMutation(session, request.method, request.routeOptions.url ?? request.url, reply.statusCode);
    }
  });

  async function issueTokenBundleForSessionRecord(
    appSession: { id: string; actorType: "staff" | "client"; actorId: string; firmId: string | null; authMethod: ProductAuthMethod },
    refreshOverride?: { refreshToken: string; expiresAt: string },
  ) {
    const profile = await store.getProfile({
      actorType: appSession.actorType,
      actorId: appSession.actorId,
      firmId: appSession.firmId,
      sessionId: appSession.id,
    });
    if (!profile) {
      return null;
    }

    const refresh = refreshOverride ?? await store.createRefreshToken(appSession.id, REFRESH_TOKEN_TTL_DAYS);
    if (!refresh) {
      return null;
    }

    const token = signAppToken(
      { actorType: appSession.actorType, actorId: appSession.actorId, firmId: appSession.firmId, sessionId: appSession.id },
      getJwtSecret(),
      ACCESS_TOKEN_TTL_SECONDS,
    );

    return {
      token,
      refreshToken: refresh.refreshToken,
      refreshExpiresAt: refresh.expiresAt,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      profile,
      session: appSession,
    };
  }

  async function issueSessionToken(session: ProductSession, authMethod: ProductAuthMethod) {
    const appSession = await store.createSession({
      actorType: session.actorType,
      actorId: session.actorId,
      firmId: session.firmId,
      authMethod,
    });
    const issued = await issueTokenBundleForSessionRecord(appSession);
    if (issued) {
      await store.recordSecurityEvent(
        session,
        "auth.session.created",
        "app_session",
        appSession.id,
        { authMethod },
      );
    }
    return issued;
  }

  async function issueOtp(actorType: "staff" | "client", phone: string, clientAccountId?: string, purpose?: string) {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return { error: "Invalid phone number format. Please check the format and try again." };
    }

    // Portal distinction checks
    if (actorType === "staff") {
      const isClient = await store.canRequestClientOtp(normalizedPhone);
      if (isClient) {
        return { error: "This phone number is registered as a client. Please sign in through the Client Portal." };
      }
      
      const isStaff = await store.canRequestStaffOtp(normalizedPhone);
      const existing = await store.findStaffByPhone(normalizedPhone);
      
      if (purpose === "register") {
        if (existing) {
          return { error: "An account already exists for this phone number. Please sign in instead." };
        }
        if (!isStaff) {
          return { error: "This phone number is not invited to the pilot program yet. Please contact support." };
        }
      } else if (purpose === "login") {
        if (!existing) {
          return { error: "Lawyer account not found. Please create a workspace first." };
        }
      } else {
        if (!existing && !isStaff) {
          return { error: "Lawyer account not found. Please create a workspace first." };
        }
      }
    } else {
      const isClient = clientAccountId
        ? await store.canRequestClientOtpForAccount(clientAccountId, normalizedPhone)
        : await store.canRequestClientOtp(normalizedPhone);
      if (!isClient) {
        return { ok: true, expiresAt: null };
      }
    }

    const isTesting =
      process.env.NODE_ENV === "test" ||
      process.env.WAKEEL_TESTING === "true" ||
      (process.env.DEMO_DB_PATH ? process.env.DEMO_DB_PATH.includes("wakeel-product-api-") : false) ||
      (process.env.WAKEEL_PRODUCT_DB_PATH ? process.env.WAKEEL_PRODUCT_DB_PATH.includes("wakeel-product-api-") : false);

    const code = isTesting
      ? DEV_OTP_CODE
      : String(randomInt(100000, 1000000));

    const requestRecord = await store.createOtpRequest({ actorType, phone: normalizedPhone, code });
    if (!requestRecord) {
      return { error: "Too many OTP requests. Please wait a few minutes before trying again." };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV OTP] Generated verification code for ${normalizedPhone}: ${code}`);
    }

    try {
      await smsProvider.send(normalizedPhone, `Your Legal Bhai verification code is ${code}. It expires in 10 minutes.`);
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV OTP FALLBACK] Twilio error: ${err.message}. Autofilled code: ${code}`);
        return {
          ok: true,
          expiresAt: requestRecord.expiresAt,
          devCode: code,
        };
      }
      return { error: `SMS failed to send: ${err.message}` };
    }
    return {
      ok: true,
      expiresAt: requestRecord.expiresAt,
      ...(isTesting ? { devCode: requestRecord.devCode } : {}),
    };
  }

  function registerOtpRequestRoute(path: string, actorType: "staff" | "client"): void {
    app.post(path, async (request, reply) => {
      const body = (request.body ?? {}) as { phone?: string; purpose?: string };
      if (!body.phone) {
        reply.code(400);
        return { error: "Phone is required" };
      }
      const response = await issueOtp(actorType, body.phone, undefined, body.purpose);
      if (!response) {
        reply.code(400);
        return { error: "Failed to request OTP" };
      }
      if ("error" in response && typeof response.error === "string") {
        const statusCode = response.error.includes("Too many") ? 429 : 400;
        reply.code(statusCode);
        return { error: response.error };
      }
      return response;
    });
  }

  function registerOtpVerifyRoute(path: string, actorType: "staff" | "client", authMethod: ProductAuthMethod): void {
    app.post(path, async (request, reply) => {
      const body = (request.body ?? {}) as { phone?: string; code?: string };
      if (!body.phone || !body.code) {
        reply.code(400);
        return { error: "Phone and code are required" };
      }

      const session = await store.verifyOtp(actorType, body.phone, body.code);
      if (!session) {
        reply.code(401);
        return { error: "Invalid OTP" };
      }

      const issued = await issueSessionToken(session, authMethod);
      if (!issued) {
        reply.code(401);
        return { error: "Profile not found" };
      }

      return issued;
    });
  }

  async function sendDocumentResponse(
    document: ProductDocument,
    reply: FastifyReply,
  ) {
    if (document.storageKey.startsWith("seed:")) {
      const seeded = await store.readSeedAsset(document.storageKey);
      if (!seeded) {
        reply.code(404);
        return { error: "Not found" };
      }
      reply.header("content-type", seeded.contentType);
      return reply.send(seeded.bytes);
    }

    if (document.storageKey.startsWith("upload:")) {
      const storedName = document.storageKey.slice("upload:".length);
      const filePath = join(getProductUploadsDirectory(), storedName);
      reply.header("content-type", document.mimeType);
      return reply.send(readFileSync(filePath));
    }

    const localObject = objectStorage.read(document.storageKey);
    if (localObject) {
      reply.header("content-type", localObject.contentType ?? document.mimeType);
      return reply.send(localObject.bytes);
    }

    const signedDownloadUrl = await objectStorage.signedDownloadUrl(document.storageKey);
    if (signedDownloadUrl) {
      return reply.redirect(signedDownloadUrl);
    }

    reply.code(404);
    return { error: "Not found" };
  }

  app.post("/auth/staff/magic-link/request", async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string };
    if (!body.email) {
      reply.code(400);
      return { error: "Email is required" };
    }
    const requestRecord = await store.createMagicLinkRequest(body.email);
    if (!requestRecord) {
      reply.code(404);
      return { error: "Staff user not found" };
    }
    return {
      ok: true,
      expiresAt: requestRecord.expiresAt,
      ...publicDevelopmentFields({
        devMagicLink: requestRecord.devToken
          ? `${publicWebUrl}/auth/staff/magic-link/verify?token=${requestRecord.devToken}`
          : null,
      }),
    };
  });

  app.get("/auth/staff/magic-link/verify", async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      reply.code(400);
      return { error: "Token is required" };
    }
    const session = await store.verifyMagicLink(token);
    if (!session) {
      reply.code(401);
      return { error: "Invalid magic link" };
    }
    const issued = await issueSessionToken(session, "staff_magic_link");
    if (!issued) {
      reply.code(401);
      return { error: "Profile not found" };
    }
    return issued;
  });

  registerOtpRequestRoute("/auth/staff/otp/request", "staff");
  registerOtpVerifyRoute("/auth/staff/otp/verify", "staff", "staff_otp");
  registerOtpRequestRoute("/auth/client/otp/request", "client");
  registerOtpVerifyRoute("/auth/client/otp/verify", "client", "client_otp");

  app.post("/v1/auth/otp/request", async (request, reply) => {
    const body = (request.body ?? {}) as { phone?: string; actorType?: unknown; purpose?: string };
    if (!body.phone || !isProductActorType(body.actorType)) {
      reply.code(400);
      return { error: "A valid phone and actorType are required" };
    }
    const response = await issueOtp(body.actorType, body.phone, undefined, body.purpose);
    if (!response) {
      reply.code(400);
      return { error: "Failed to request OTP" };
    }
    if ("error" in response && typeof response.error === "string") {
      const statusCode = response.error.includes("Too many") ? 429 : 400;
      reply.code(statusCode);
      return { error: response.error };
    }
    return response;
  });

  app.post("/v1/auth/otp/verify", async (request, reply) => {
    const body = (request.body ?? {}) as { phone?: string; code?: string; actorType?: unknown };
    if (!body.phone || !body.code || !isProductActorType(body.actorType)) {
      reply.code(400);
      return { error: "A valid phone, code, and actorType are required" };
    }

    const session = await store.verifyOtp(body.actorType, body.phone, body.code);
    if (!session) {
      reply.code(401);
      return { error: "Invalid OTP" };
    }

    const issued = await issueSessionToken(session, body.actorType === "staff" ? "staff_otp" : "client_otp");
    if (!issued) {
      reply.code(401);
      return { error: "Profile not found" };
    }
    return issued;
  });

  app.post("/v1/pilot/invites", async (request, reply) => {
    const suppliedSecret = request.headers["x-pilot-admin-secret"];
    if (!process.env.PILOT_ADMIN_SECRET || suppliedSecret !== process.env.PILOT_ADMIN_SECRET) {
      reply.code(403);
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { phone?: string; email?: string | null };
    if (!body.phone || (body.email !== undefined && !isNullableEmail(body.email))) {
      reply.code(400);
      return { error: "A valid phone and email are required" };
    }
    const invite = await store.createPilotInvite({ phone: body.phone, email: body.email });
    if (!invite) {
      reply.code(400);
      return { error: "Invalid Pakistani mobile number" };
    }
    return { invite };
  });

  app.post("/v1/auth/staff/register", async (request, reply) => {
    const body = (request.body ?? {}) as {
      phone?: string;
      code?: string;
      displayName?: string;
      email?: string | null;
      firmName?: string;
      primaryCity?: string;
    };
    if (
      !isNonEmptyText(body.phone, 30) ||
      !/^\d{6}$/.test(body.code ?? "") ||
      !isNonEmptyText(body.displayName, 120) ||
      !isNonEmptyText(body.firmName, 160) ||
      !isNonEmptyText(body.primaryCity, 100) ||
      (body.email !== undefined && !isNullableEmail(body.email))
    ) {
      reply.code(400);
      return { error: "Invalid registration fields" };
    }
    const session = await store.registerInvitedSoloLawyer({
      phone: body.phone,
      code: body.code!,
      displayName: body.displayName,
      email: body.email ?? null,
      firmName: body.firmName,
      primaryCity: body.primaryCity,
    });
    if (!session) {
      reply.code(401);
      return { error: "Invalid or uninvited registration" };
    }
    const issued = await issueSessionToken(session, "staff_otp");
    if (!issued) {
      reply.code(500);
      return { error: "Could not create workspace session" };
    }
    await store.recordSecurityEvent(
      session,
      "workspace.registered",
      "firm",
      session.firmId!,
      { primaryCity: body.primaryCity },
    );
    return issued;
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    const verified = token ? verifyAppToken(token, getJwtSecret()) : null;
    if (verified?.sessionId) {
      await store.revokeSession(verified.sessionId);
    }
    reply.code(200);
    return { ok: true };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const refreshToken = readRefreshToken(request);
    if (!refreshToken) {
      reply.code(401);
      return { error: "Refresh token is required" };
    }

    const rotated = await store.rotateRefreshToken(refreshToken);
    if (!rotated) {
      reply.code(401);
      return { error: "Invalid refresh token" };
    }

    const issued = await issueTokenBundleForSessionRecord(rotated.session, {
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
    });
    if (!issued) {
      reply.code(401);
      return { error: "Profile not found" };
    }

    return issued;
  });

  app.post("/v1/auth/logout", async (request, reply) => app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: request.headers as Record<string, string>,
  }).then((response) => reply.code(response.statusCode).send(response.json())));

  app.post("/v1/auth/refresh", async (request, reply) => app.inject({
    method: "POST",
    url: "/auth/refresh",
    headers: request.headers as Record<string, string>,
    payload: request.body as Record<string, unknown>,
  }).then((response) => reply.code(response.statusCode).send(response.json())));

  app.get("/v1/me", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { profile: session.profile };
  });

  app.get("/sessions", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { sessions: await store.listSessions(session) };
  });

  app.get("/v1/sessions", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { sessions: await store.listSessions(session) };
  });

  app.post("/v1/firms", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { name?: string; primaryCity?: string };
    if (!body.name || !body.primaryCity) {
      reply.code(400);
      return { error: "name and primaryCity are required" };
    }
    const firm = await store.createFirm({ name: body.name, primaryCity: body.primaryCity, ownerUserId: session.actorId });
    return { firm };
  });

  app.get("/v1/firms/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const firmId = (request.params as { id: string }).id;
    if (session.firmId !== firmId) {
      reply.code(403);
      return { error: "Forbidden" };
    }
    const firm = await store.getFirm(firmId);
    if (!firm) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { firm, members: await store.listFirmMembers(firmId) };
  });

  app.get("/v1/firms/:id/memberships", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const firmId = (request.params as { id: string }).id;
    if (session.firmId !== firmId) {
      reply.code(403);
      return { error: "Forbidden" };
    }
    return { memberships: await store.listFirmMembers(firmId) };
  });

  app.get("/roles", async () => ({ roles: roleDefinitions }));
  app.get("/v1/roles", async () => ({ roles: roleDefinitions }));

  app.post("/v1/firms/:id/invitations", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "members.write")) {
      return { error: "Forbidden" };
    }
    const firmId = (request.params as { id: string }).id;
    if (session.firmId !== firmId) {
      reply.code(403);
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { phone?: string; email?: string | null; role?: "owner" | "lawyer" | "assistant" | "billing"; officeLabel?: string | null };
    if (!body.phone || !body.role) {
      reply.code(400);
      return { error: "phone and role are required" };
    }
    return await store.createInvitation(firmId, {
      phone: body.phone,
      email: body.email ?? null,
      role: body.role,
      officeLabel: body.officeLabel ?? null,
    });
  });

  app.patch("/v1/memberships/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "members.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { role?: "owner" | "lawyer" | "assistant" | "billing"; permissions?: string[]; officeLabel?: string | null };
    const membership = await store.updateMembership(session, (request.params as { id: string }).id, body);
    if (!membership) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { membership };
  });

  app.patch("/v1/memberships/:id/permissions", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "members.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { permissions?: string[] };
    if (!body.permissions) {
      reply.code(400);
      return { error: "permissions are required" };
    }
    const membership = await store.updateMembership(session, (request.params as { id: string }).id, { permissions: body.permissions });
    if (!membership) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { membership };
  });

  app.get("/v1/matters", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { matters: await store.listMatters(session) };
  });

  app.post("/v1/matters", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as {
      courtId?: string;
      rawCaseNumber?: string;
      normalizedCaseNumber?: string;
      title?: string;
      matterType?: Matter["matterType"];
      stage?: string;
      status?: Matter["status"];
      nextHearingAt?: string | null;
      leadLawyerId?: string | null;
    };
    const nextHearingAtNormalized = body.nextHearingAt === "" ? null : (body.nextHearingAt ?? null);
    if (
      !isNonEmptyText(body.courtId, 100) ||
      !isNonEmptyText(body.rawCaseNumber, 200) ||
      (body.normalizedCaseNumber !== undefined && !isNonEmptyText(body.normalizedCaseNumber, 200)) ||
      !isNonEmptyText(body.title, 500) ||
      !PRODUCT_MATTER_TYPES.includes(body.matterType as Matter["matterType"]) ||
      !isNonEmptyText(body.stage, 100) ||
      !PRODUCT_MATTER_STATUSES.includes(body.status as Matter["status"]) ||
      !isNullableIsoDate(nextHearingAtNormalized) ||
      (body.leadLawyerId !== undefined && body.leadLawyerId !== null && !isNonEmptyText(body.leadLawyerId, 100))
    ) {
      reply.code(400);
      return { error: "Invalid matter fields" };
    }
    const matter = await store.createMatter(session, {
      firmId: session.firmId,
      courtId: body.courtId,
      rawCaseNumber: body.rawCaseNumber,
      normalizedCaseNumber: body.normalizedCaseNumber ?? normalizeCourtCaseNumber(body.courtId, body.rawCaseNumber),
      title: body.title,
      matterType: body.matterType as Matter["matterType"],
      stage: body.stage,
      status: body.status as Matter["status"],
      nextHearingAt: nextHearingAtNormalized,
      leadLawyerId: body.leadLawyerId === undefined ? session.actorId : body.leadLawyerId,
    });
    if (!matter) {
      reply.code(400);
      return { error: "Matter fields reference records outside the workspace" };
    }
    return { matter };
  });

  app.get("/v1/matters/import-template.csv", async (_request, reply) => {
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", 'attachment; filename="legalbahi-matters-template.csv"');
    return reply.send(MATTER_CSV_TEMPLATE);
  });

  app.post("/v1/matters/imports/preview", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const csv = (request.body as { csv?: string } | undefined)?.csv;
    if (!csv) {
      reply.code(400);
      return { error: "csv is required" };
    }
    const importJob = await store.createCsvImportPreview(session, validateMatterCsv(csv));
    if (!importJob) {
      reply.code(400);
      return { error: "Could not create import preview" };
    }
    return { importJob };
  });

  app.get("/v1/matters/imports/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const importJob = await store.getCsvImportPreview(session, (request.params as { id: string }).id);
    if (!importJob) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { importJob };
  });

  app.get("/v1/matters/imports/:id/rejected", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const importJob = await store.getCsvImportPreview(session, (request.params as { id: string }).id, true);
    if (!importJob) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { importJob };
  });

  app.post("/v1/matters/imports/:id/confirm", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const importJob = await store.confirmCsvImport(session, (request.params as { id: string }).id);
    if (!importJob) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { importJob };
  });

  app.get("/v1/matters/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const matter = await store.getMatter(session, (request.params as { id: string }).id);
    if (!matter) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { matter };
  });

  app.patch("/v1/matters/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const patch = parseMatterPatch(request.body);
    if (!patch) {
      reply.code(400);
      return { error: "Invalid matter patch" };
    }
    const matter = await store.updateMatter(session, (request.params as { id: string }).id, patch);
    if (!matter) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { matter };
  });

  app.post("/v1/matters/:id/parties", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { partyType?: "petitioner" | "respondent" | "applicant" | "other"; displayName?: string; contactRef?: string | null };
    if (
      !PARTY_TYPES.includes(body.partyType as typeof PARTY_TYPES[number]) ||
      !isNonEmptyText(body.displayName, 200) ||
      (body.contactRef !== undefined && !isNullableText(body.contactRef, 100))
    ) {
      reply.code(400);
      return { error: "Invalid party fields" };
    }
    const party = await store.createMatterParty(session, (request.params as { id: string }).id, {
      partyType: body.partyType as typeof PARTY_TYPES[number],
      displayName: body.displayName,
      contactRef: body.contactRef ?? null,
    });
    if (!party) {
      reply.code(404);
      return { error: "Matter not found" };
    }
    return { party };
  });

  app.patch("/v1/matters/:matterId/parties/:partyId", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const params = request.params as { matterId: string; partyId: string };
    const body = request.body;
    if (!isRecord(body)) {
      reply.code(400);
      return { error: "Invalid party patch" };
    }
    const patch: { partyType?: typeof PARTY_TYPES[number]; displayName?: string; contactRef?: string | null } = {};
    if ("partyType" in body) {
      if (!PARTY_TYPES.includes(body.partyType as typeof PARTY_TYPES[number])) {
        reply.code(400);
        return { error: "Invalid party patch" };
      }
      patch.partyType = body.partyType as typeof PARTY_TYPES[number];
    }
    if ("displayName" in body) {
      if (!isNonEmptyText(body.displayName, 200)) {
        reply.code(400);
        return { error: "Invalid party patch" };
      }
      patch.displayName = body.displayName;
    }
    if ("contactRef" in body) {
      if (!isNullableText(body.contactRef, 100)) {
        reply.code(400);
        return { error: "Invalid party patch" };
      }
      patch.contactRef = body.contactRef;
    }
    if (Object.keys(patch).length === 0) {
      reply.code(400);
      return { error: "Invalid party patch" };
    }
    const party = await store.updateMatterParty(session, params.matterId, params.partyId, patch);
    if (!party) {
      reply.code(404);
      return { error: "Party not found" };
    }
    return { party };
  });

  app.delete("/v1/matters/:matterId/parties/:partyId", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "matters.write")) {
      return { error: "Forbidden" };
    }
    const params = request.params as { matterId: string; partyId: string };
    if (!await store.deleteMatterParty(session, params.matterId, params.partyId)) {
      reply.code(404);
      return { error: "Party not found" };
    }
    return { ok: true };
  });

  app.get("/v1/matters/:id/hearings", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { hearings: await store.listHearings(session, (request.params as { id: string }).id) };
  });

  app.post("/v1/matters/:id/hearings", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "hearings.write")) {
      return { error: "Forbidden" };
    }

    const matterId = (request.params as { id: string }).id;
    const multipartPayload = await parseMultipartFields(request);
    let documentId: string | null = null;

    if (multipartPayload.bytes && multipartPayload.fileName) {
      const storageKey = await objectStorage.put({
        fileName: multipartPayload.fileName,
        bytes: multipartPayload.bytes,
        contentType: multipartPayload.mimeType ?? "application/octet-stream",
      });
      const ocr = await runOcr(multipartPayload.bytes, multipartPayload.mimeType ?? "application/octet-stream");
      const document = await store.createDocument(session, {
        firmId: session.firmId!,
        matterId,
        type: "hearing_order",
        title: multipartPayload.fileName,
        storageKey,
        mimeType: multipartPayload.mimeType ?? "application/octet-stream",
        uploadedBy: session.actorId,
        ocrStatus: ocr.status === "completed" ? "completed" : ocr.status === "pending_config" ? "pending" : "failed",
        ocrText: ocr.text ?? null,
        searchText: ocr.text ?? null,
        portalVisible: true,
      });
      if (!document) {
        reply.code(404);
        return { error: "Matter not found" };
      }
      documentId = document.id;
    }

    const requestBody = (request.body ?? {}) as {
      listedAt?: string;
      outcome?: string;
      notes?: string;
      nextDate?: string | null;
      courtroom?: string | null;
      bench?: string | null;
      sourceType?: string;
    };
    const body = {
      ...requestBody,
      ...multipartPayload.fields,
    };
    const listedAt = body.listedAt ?? new Date().toISOString();
    const nextDate = body.nextDate || null;
    if (
      !isNullableIsoDate(listedAt) ||
      !isNullableIsoDate(nextDate) ||
      (body.outcome !== undefined && !isNonEmptyText(body.outcome, 500)) ||
      (body.notes !== undefined && !isNonEmptyText(body.notes, 5_000)) ||
      (body.sourceType !== undefined && !isNonEmptyText(body.sourceType, 100))
    ) {
      reply.code(400);
      return { error: "Invalid hearing fields" };
    }

    const hearing = await store.addHearing(session, {
      matterId,
      listedAt,
      outcome: body.outcome ?? "Hearing updated",
      notes: body.notes ?? "Hearing note captured from mobile.",
      nextDate,
      courtroom: body.courtroom ?? null,
      bench: body.bench ?? null,
      sourceType: body.sourceType ?? "manual_staff",
      documentId,
    });

    if (!hearing) {
      reply.code(404);
      return { error: "Matter not found" };
    }

    return { hearing };
  });

  app.get("/v1/calendar", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { items: await store.listCalendar(session) };
  });

  app.get("/v1/calendar/conflicts", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { items: await store.listCalendarConflicts(session) };
  });

  app.get("/v1/documents", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const matterId = (request.query as { matterId?: string }).matterId;
    return { documents: await store.listDocuments(session, { matterId }) };
  });

  app.post("/v1/documents", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "documents.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const multipartPayload = await parseMultipartFields(request);
    const requestBody = (request.body ?? {}) as {
      matterId?: string | null;
      folderId?: string | null;
      type?: ProductDocument["type"];
      title?: string;
      mimeType?: string;
      searchText?: string | null;
      portalVisible?: boolean;
    };
    const body = { ...requestBody, ...multipartPayload.fields };
    if (!body.type || !body.title || !body.mimeType) {
      if (!multipartPayload.fileName || !multipartPayload.mimeType || !body.type) {
        reply.code(400);
        return { error: "Missing document fields" };
      }
    }
    if (
      !PRODUCT_DOCUMENT_TYPES.includes(body.type as ProductDocument["type"]) ||
      (body.title !== undefined && !isNonEmptyText(body.title, 500)) ||
      (body.matterId !== undefined && body.matterId !== null && !isNonEmptyText(body.matterId, 100))
    ) {
      reply.code(400);
      return { error: "Invalid document fields" };
    }
    const storageKey =
      multipartPayload.fileName && multipartPayload.bytes
        ? await objectStorage.put({
            fileName: multipartPayload.fileName,
            bytes: multipartPayload.bytes,
            contentType: multipartPayload.mimeType ?? "application/octet-stream",
          })
        : `virtual:${randomUUID()}`;
    const ocr =
      multipartPayload.bytes && multipartPayload.mimeType
        ? await runOcr(multipartPayload.bytes, multipartPayload.mimeType)
        : { status: "pending_config" as const, text: null };
    const document = await store.createDocument(session, {
      firmId: session.firmId,
      matterId: body.matterId ?? null,
      folderId: body.folderId ?? null,
      type: body.type,
      title: body.title ?? multipartPayload.fileName!,
      storageKey,
      mimeType: body.mimeType ?? multipartPayload.mimeType!,
      uploadedBy: session.actorId,
      ocrStatus: ocr.status === "completed" ? "completed" : ocr.status === "failed" ? "failed" : "pending",
      ocrText: ocr.text ?? null,
      searchText: body.searchText ?? ocr.text ?? null,
      portalVisible: body.portalVisible === true || String(body.portalVisible) === "true",
    });
    if (!document) {
      reply.code(404);
      return { error: "Matter not found" };
    }
    return { document };
  });

  app.get("/v1/documents/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const document = await store.getDocument(session, (request.params as { id: string }).id);
    if (!document) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { document, contentUrl: `/v1/documents/${document.id}/content` };
  });

  app.patch("/v1/documents/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "documents.write")) {
      return { error: "Forbidden" };
    }
    const current = await store.getDocument(session, (request.params as { id: string }).id);
    if (!current) {
      reply.code(404);
      return { error: "Not found" };
    }
    const body = request.body;
    if (!isRecord(body)) {
      reply.code(400);
      return { error: "Invalid document patch" };
    }
    const patch: Partial<Pick<ProductDocument, "title" | "matterId" | "folderId" | "searchText" | "portalVisible">> = {};
    for (const field of ["matterId", "folderId", "searchText"] as const) {
      if (field in body) {
        if (!isNullableText(body[field], field === "searchText" ? 20_000 : 100)) {
          reply.code(400);
          return { error: "Invalid document patch" };
        }
        patch[field] = body[field];
      }
    }
    if ("title" in body) {
      if (!isNonEmptyText(body.title, 500)) {
        reply.code(400);
        return { error: "Invalid document patch" };
      }
      patch.title = body.title;
    }
    if ("portalVisible" in body) {
      if (typeof body.portalVisible !== "boolean") {
        reply.code(400);
        return { error: "Invalid document patch" };
      }
      patch.portalVisible = body.portalVisible;
    }
    if (Object.keys(patch).length === 0) {
      reply.code(400);
      return { error: "Invalid document patch" };
    }
    const document = await store.updateDocument(session, current.id, patch);
    if (!document) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { document };
  });

  app.get("/v1/documents/:id/content", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const document = await store.getDocument(session, (request.params as { id: string }).id);
    if (!document) {
      reply.code(404);
      return { error: "Not found" };
    }
    return sendDocumentResponse(document, reply);
  });

  app.get("/v1/documents/:id/download", async (request, reply) => {
    const portalToken = readPortalToken(request);
    if (portalToken) {
      const access = await requirePortalScopedAccess(request, reply, store, portalToken);
      if (!access) {
        return { error: "Portal OTP verification is required" };
      }
      const requestedDocumentId = (request.params as { id: string }).id;
      const portalMatter = await store.getPortalMatterForAccess(portalToken, access.link.id, access.link.matterId);
      const document = portalMatter?.documents.find((entry) => entry.id === requestedDocumentId) ?? null;
      if (!document) {
        reply.code(404);
        return { error: "Not found" };
      }
      return sendDocumentResponse(document, reply);
    }

    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const document = await store.getDocument(session, (request.params as { id: string }).id);
    if (!document) {
      reply.code(404);
      return { error: "Not found" };
    }
    return sendDocumentResponse(document, reply);
  });

  app.post("/v1/documents/:id/link", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "documents.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { matterId?: string };
    if (!body.matterId) {
      reply.code(400);
      return { error: "matterId is required" };
    }
    const link = await store.linkDocument(session, (request.params as { id: string }).id, body.matterId);
    if (!link) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { link };
  });

  app.get("/v1/threads", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { threads: await store.listThreads(session) };
  });

  app.get("/v1/threads/:id/messages", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { messages: await store.listMessages(session, (request.params as { id: string }).id) };
  });

  app.post("/v1/threads/:id/messages", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    if (session.actorType === "staff" && !requirePermission(session, reply, "messages.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { body?: string; language?: ProductLanguage; deliveryChannel?: "in_app" | "sms" };
    if (
      !isNonEmptyText(body.body, 5_000) ||
      !PRODUCT_LANGUAGES.includes(body.language as ProductLanguage) ||
      !PRODUCT_DELIVERY_CHANNELS.includes(body.deliveryChannel as typeof PRODUCT_DELIVERY_CHANNELS[number])
    ) {
      reply.code(400);
      return { error: "Invalid message fields" };
    }
    const message = await store.createMessage(session, (request.params as { id: string }).id, {
      body: body.body,
      language: body.language as ProductLanguage,
      deliveryChannel: body.deliveryChannel as typeof PRODUCT_DELIVERY_CHANNELS[number],
    });
    if (!message) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { message };
  });

  app.get("/v1/clients/me/matters", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireClientSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { matters: await store.listMatters(session) };
  });

  app.get("/v1/clients/me/matters/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireClientSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const matter = await store.getMatter(session, (request.params as { id: string }).id);
    if (!matter) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { matter };
  });

  app.get("/v1/clients", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { clients: await store.listClients(session) };
  });

  app.post("/v1/clients", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { phone?: string; displayName?: string; language?: ProductLanguage };
    if (!isNonEmptyText(body.phone, 30) || !isNonEmptyText(body.displayName, 200) || (body.language !== undefined && !PRODUCT_LANGUAGES.includes(body.language))) {
      reply.code(400);
      return { error: "Invalid client fields" };
    }
    const client = await store.createClient(session, {
      phone: body.phone,
      displayName: body.displayName,
      language: body.language ?? "en",
    });
    if (!client) {
      reply.code(400);
      return { error: "Invalid phone or client already belongs to another workspace" };
    }
    return { client };
  });

  app.get("/v1/clients/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const client = await store.getClientDetail(session, (request.params as { id: string }).id);
    if (!client) {
      reply.code(404);
      return { error: "Not found" };
    }
    return client;
  });

  app.get("/v1/clients/:id/notifications/preferences", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply) || !session.firmId) {
      return { error: "Forbidden" };
    }
    const clientId = (request.params as { id: string }).id;
    if (!await store.getClientDetail(session, clientId)) {
      reply.code(404);
      return { error: "Not found" };
    }
    return {
      preference: await store.getNotificationPreference({
        actorType: "client",
        actorId: clientId,
        firmId: session.firmId,
      }),
    };
  });

  app.patch("/v1/clients/:id/notifications/preferences", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const clientId = (request.params as { id: string }).id;
    if (!await store.getClientDetail(session, clientId)) {
      reply.code(404);
      return { error: "Not found" };
    }
    const body = (request.body ?? {}) as { emailEnabled?: boolean; smsEnabled?: boolean; optedOut?: boolean };
    if (
      typeof body.emailEnabled !== "boolean" ||
      typeof body.smsEnabled !== "boolean" ||
      (body.optedOut !== undefined && typeof body.optedOut !== "boolean")
    ) {
      reply.code(400);
      return { error: "Notification preference values must be booleans" };
    }
    return {
      preference: await store.updateNotificationPreference({
        actorType: "client",
        actorId: clientId,
        firmId: session.firmId,
      }, {
        emailEnabled: body.emailEnabled,
        smsEnabled: body.smsEnabled,
        optedOut: body.optedOut ?? false,
      }, "staff_recorded_client_consent"),
    };
  });

  app.patch("/v1/clients/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write")) {
      return { error: "Forbidden" };
    }
    const body = request.body;
    if (!isRecord(body)) {
      reply.code(400);
      return { error: "Invalid client patch" };
    }
    const patch: { displayName?: string; language?: ProductLanguage; status?: ClientAccount["status"] } = {};
    if ("displayName" in body) {
      if (!isNonEmptyText(body.displayName, 200)) {
        reply.code(400);
        return { error: "Invalid client patch" };
      }
      patch.displayName = body.displayName;
    }
    if ("language" in body) {
      if (!PRODUCT_LANGUAGES.includes(body.language as ProductLanguage)) {
        reply.code(400);
        return { error: "Invalid client patch" };
      }
      patch.language = body.language as ProductLanguage;
    }
    if ("status" in body) {
      if (body.status !== "active" && body.status !== "invited" && body.status !== "archived") {
        reply.code(400);
        return { error: "Invalid client patch" };
      }
      patch.status = body.status;
    }
    if (Object.keys(patch).length === 0) {
      reply.code(400);
      return { error: "Invalid client patch" };
    }
    const client = await store.updateClient(session, (request.params as { id: string }).id, patch);
    if (!client) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { client };
  });

  app.delete("/v1/clients/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write")) {
      return { error: "Forbidden" };
    }
    const client = await store.updateClient(session, (request.params as { id: string }).id, { status: "archived" });
    if (!client) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { client };
  });

  app.post("/v1/matters/:id/clients", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write")) {
      return { error: "Forbidden" };
    }
    const clientId = (request.body as { clientId?: string } | undefined)?.clientId;
    if (!clientId) {
      reply.code(400);
      return { error: "clientId is required" };
    }
    const membership = await store.shareMatterWithClient(session, (request.params as { id: string }).id, clientId);
    if (!membership) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { membership };
  });

  app.delete("/v1/matters/:matterId/clients/:clientId", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "clients.write")) {
      return { error: "Forbidden" };
    }
    const params = request.params as { matterId: string; clientId: string };
    if (!await store.unlinkMatterFromClient(session, params.matterId, params.clientId)) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { ok: true };
  });

  app.get("/v1/time-entries", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { timeEntries: await store.listTimeEntries(session) };
  });

  app.post("/v1/time-entries", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "time.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as Omit<TimeEntry, "id" | "firmId" | "userId">;
    if (!body.matterId || !body.startedAt || !body.minutes || !body.narrative) {
      reply.code(400);
      return { error: "Missing time entry fields" };
    }
    const timeEntry = await store.createTimeEntry(session, {
      id: randomUUID(),
      firmId: session.firmId,
      matterId: body.matterId,
      userId: session.actorId,
      startedAt: body.startedAt,
      minutes: body.minutes,
      narrative: body.narrative,
      billable: body.billable ?? true,
    });
    if (!timeEntry) {
      reply.code(404);
      return { error: "Matter not found" };
    }
    return { timeEntry };
  });

  app.get("/v1/invoices", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { invoices: await store.listInvoices(session) };
  });

  app.post("/v1/invoices", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "invoices.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as {
      clientAccountId?: string;
      matterId?: string | null;
      status?: Invoice["status"];
      issuedAt?: string | null;
      dueAt?: string | null;
      total?: number;
    };
    if (!body.clientAccountId || !body.status || body.total == null) {
      reply.code(400);
      return { error: "Missing invoice fields" };
    }
    const invoice = await store.createInvoice(session, {
      firmId: session.firmId,
      clientAccountId: body.clientAccountId,
      matterId: body.matterId ?? null,
      status: body.status,
      issuedAt: body.issuedAt ?? null,
      dueAt: body.dueAt ?? null,
      total: body.total,
    });
    if (!invoice) {
      reply.code(404);
      return { error: "Client or matter not found" };
    }
    return { invoice };
  });

  app.patch("/v1/invoices/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "invoices.write")) {
      return { error: "Forbidden" };
    }
    if (!isRecord(request.body)) {
      reply.code(400);
      return { error: "Invalid invoice patch" };
    }
    const invoice = await store.updateInvoice(session, (request.params as { id: string }).id, request.body);
    if (!invoice) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { invoice };
  });

  app.get("/v1/court-sources", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { courtSources: await store.listCourtSources() };
  });

  app.post("/v1/court-sources/:id/sync", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "court.sync")) {
      return { error: "Forbidden" };
    }
    const sourceId = (request.params as { id: string }).id;
    if (!isSupportedCourtSource(sourceId)) {
      reply.code(404);
      return { error: "Not found" };
    }
    const body = isRecord(request.body) ? request.body : {};
    const listType = body.listType ?? "regular";
    if (
      !["regular", "supplementary", "urgent"].includes(String(listType)) ||
      (body.listDate !== undefined && !isIsoDateOnly(body.listDate))
    ) {
      reply.code(400);
      return { error: "Invalid court source sync fields" };
    }
    const typedListType = listType as CourtListType;
    try {
      const causeList = await fetchCourtCauseList(sourceId, typedListType, body.listDate as string | undefined);
      await store.ingestCourtCauseList(sourceId, causeList.rows, causeList.listDate, typedListType);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown court source provider failure";
      await store.recordCourtIngestionFailure(sourceId, typedListType, message);
      const degradedSource = (await store.listCourtSources()).find((entry) => entry.id === sourceId);
      return { courtSource: degradedSource, warning: message };
    }
    const source = (await store.listCourtSources()).find((entry) => entry.id === sourceId);
    if (!source) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { courtSource: source };
  });

  app.get("/v1/court-matches/review", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { matches: await store.listCourtMatchReview(session) };
  });

  app.get("/v1/court-matches/unmatched", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const requestedLimit = Number((request.query as { limit?: string }).limit ?? 100);
    return { entries: await store.listUnmatchedCauseEntries(session, Math.min(Math.max(requestedLimit, 1), 250)) };
  });

  app.post("/v1/court-matches/unmatched/:id/link", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "court.sync")) {
      return { error: "Forbidden" };
    }
    const matterId = (request.body as { matterId?: string } | undefined)?.matterId;
    if (!matterId) {
      reply.code(400);
      return { error: "matterId is required" };
    }
    const match = await store.linkUnmatchedCauseEntry(session, (request.params as { id: string }).id, matterId);
    if (!match) {
      reply.code(404);
      return { error: "Entry or workspace matter not found" };
    }
    return { match };
  });

  app.patch("/v1/court-matches/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "court.sync")) {
      return { error: "Forbidden" };
    }
    const state = (request.body as { state?: "approved" | "rejected" } | undefined)?.state;
    if (!state || !["approved", "rejected"].includes(state)) {
      reply.code(400);
      return { error: "state must be approved or rejected" };
    }
    const match = await store.reviewCourtMatch(session, (request.params as { id: string }).id, state);
    if (!match) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { match };
  });

  app.get("/v1/search", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const q = (request.query as { q?: string }).q ?? "";
    return { hits: await store.search(session, q) };
  });

  app.get("/v1/reports/overview", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const report = await store.getOverviewReport(session);
    if (!report) {
      reply.code(404);
      return { error: "Not found" };
    }
    return report;
  });

  app.get("/v1/alerts", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return {
      alerts: await store.listAlerts(session),
      auditEvents: session.actorType === "staff" ? await store.listAuditEvents(session) : [],
    };
  });

  app.patch("/v1/alerts/:id", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    const alert = await store.markAlertRead(session, (request.params as { id: string }).id);
    if (!alert) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { alert };
  });

  app.get("/v1/notifications/preferences", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { preference: await store.getNotificationPreference(session) };
  });

  app.patch("/v1/notifications/preferences", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    const body = (request.body ?? {}) as { emailEnabled?: boolean; smsEnabled?: boolean; optedOut?: boolean };
    if (
      typeof body.emailEnabled !== "boolean" ||
      typeof body.smsEnabled !== "boolean" ||
      (body.optedOut !== undefined && typeof body.optedOut !== "boolean")
    ) {
      reply.code(400);
      return { error: "Notification preference values must be booleans" };
    }
    return {
      preference: await store.updateNotificationPreference(session, {
        emailEnabled: body.emailEnabled,
        smsEnabled: body.smsEnabled,
        optedOut: body.optedOut ?? false,
      }),
    };
  });

  app.get("/v1/notifications/history", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { notifications: await store.listNotificationJobs(session) };
  });

  const registerPortalReadRoute = (path: string, detail = false) => {
    app.get(path, async (request, reply) => {
      const portalToken = readPortalToken(request);
      if (!portalToken) {
        reply.code(401);
        return { error: "Portal token is required" };
      }
      const access = await requirePortalScopedAccess(request, reply, store, portalToken);
      if (!access) {
        return { error: "Portal OTP verification is required" };
      }
      if (!detail) {
        return { cases: await store.listPortalMattersForAccess(portalToken, access.link.id) };
      }
      const matter = await store.getPortalMatterForAccess(portalToken, access.link.id, (request.params as { id: string }).id);
      if (!matter) {
        reply.code(404);
        return { error: "Not found" };
      }
      return { case: matter };
    });
  };

  app.post("/portal/links", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "portal.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { matterId?: string; clientId?: string; expiresHours?: number };
    if (
      !isNonEmptyText(body.matterId, 100) ||
      (body.clientId !== undefined && !isNonEmptyText(body.clientId, 100)) ||
      (body.expiresHours !== undefined && (!Number.isInteger(body.expiresHours) || body.expiresHours < 1 || body.expiresHours > 24 * 30))
    ) {
      reply.code(400);
      return { error: "Invalid portal link fields" };
    }
    const portalLink = await store.createPortalLink(session, body.matterId, body.expiresHours ?? 24 * 14, body.clientId);
    if (!portalLink) {
      reply.code(404);
      return { error: "Client membership not found for matter" };
    }
    return {
      portalLink: portalLink.portalLink,
      portalUrl: `${publicWebUrl}/c/${portalLink.rawToken}`,
      token: portalLink.rawToken,
    };
  });

  app.post("/v1/portal/links", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/links",
      headers: request.headers as Record<string, string>,
      payload: request.body as Record<string, unknown> | undefined,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );

  registerPortalReadRoute("/portal/cases");
  registerPortalReadRoute("/v1/portal/cases");
  registerPortalReadRoute("/portal/cases/:id", true);
  registerPortalReadRoute("/v1/portal/cases/:id", true);

  app.post("/portal/otp", async (request, reply) => {
    const portalToken = (request.body as { token?: string } | undefined)?.token ?? readPortalToken(request);
    if (!portalToken) {
      reply.code(400);
      return { error: "Portal token is required" };
    }
    const access = await store.getPortalAccess(portalToken);
    if (!access) {
      reply.code(404);
      return { error: "Portal link not found" };
    }
    const response = await issueOtp("client", access.clientAccount.phone, access.clientAccount.id);
    if (!response) {
      reply.code(429);
      return { error: "Too many OTP requests" };
    }
    return {
      maskedPhone: maskPhone(access.clientAccount.phone),
      ...response,
    };
  });

  app.post("/v1/portal/otp", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/otp",
      payload: request.body as Record<string, unknown> | undefined,
      headers: request.headers as Record<string, string>,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );

  app.post("/portal/otp/verify", async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string; code?: string };
    if (!body.token || !body.code) {
      reply.code(400);
      return { error: "token and code are required" };
    }
    const access = await store.getPortalAccess(body.token);
    if (!access) {
      reply.code(404);
      return { error: "Portal link not found" };
    }
    const session = await store.verifyClientOtpForAccount(access.clientAccount.id, access.clientAccount.phone, body.code);
    if (!session) {
      reply.code(401);
      return { error: "Invalid OTP" };
    }
    await store.recordSecurityEvent(
      session,
      "portal.otp.verified",
      "portal_link",
      access.link.id,
      { matterId: access.link.matterId },
    );
    return {
      token: signAppToken({
        actorType: session.actorType,
        actorId: session.actorId,
        firmId: session.firmId,
        portalLinkId: access.link.id,
      }, getJwtSecret(), ACCESS_TOKEN_TTL_SECONDS),
      refreshToken: null,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    };
  });

  app.post("/v1/portal/otp/verify", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/otp/verify",
      payload: request.body as Record<string, unknown> | undefined,
      headers: request.headers as Record<string, string>,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );

  app.get("/v1/ingestion-runs", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { ingestionRuns: await store.listIngestionRuns() };
  });
}
