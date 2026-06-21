import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  PRODUCT_MATTER_STATUSES,
  PRODUCT_MATTER_TYPES,
  type Matter,
  type ProductAuthMethod,
  type ProductDocument,
  type ProductSession,
} from "@wakeel/shared";
import { readBearerToken, signAppToken, verifyAppToken } from "../lib/auth.js";
import { getJwtSecret, isProduction } from "../lib/config.js";
import { isIsoDateOrDateTime } from "../lib/date-validation.js";
import { sanitizePlainText } from "../lib/input-sanitizer.js";
import { normalizePakistanPhone } from "../lib/validation.js";
import { createSmsProvider } from "../lib/providers.js";
import { createPrivateObjectStorage } from "../lib/storage.js";
import { captureError } from "../lib/telemetry.js";
import { type ProductStore } from "../lib/product-store.js";
import { type PostgresProductStore } from "../lib/postgres-product-store.js";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 15;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export type ProductStoreContract = ProductStore | PostgresProductStore;
export const PARTY_TYPES = ["petitioner", "respondent", "applicant", "other"] as const;

export type ProductRouteContext = {
  app: FastifyInstance;
  store: ProductStoreContract;
  publicWebUrl: string;
  smsProvider: ReturnType<typeof createSmsProvider>;
  objectStorage: ReturnType<typeof createPrivateObjectStorage>;
  roleDefinitions: readonly { id: string; permissions: readonly string[] }[];
  issueTokenBundleForSessionRecord: (
    appSession: { id: string; actorType: "staff" | "client"; actorId: string; firmId: string | null; authMethod: ProductAuthMethod },
    refreshOverride?: { refreshToken: string; expiresAt: string },
  ) => Promise<{
    token: string;
    refreshToken: string;
    refreshExpiresAt: string;
    expiresInSeconds: number;
    profile: NonNullable<Awaited<ReturnType<ProductStoreContract["getProfile"]>>>;
    session: { id: string; actorType: "staff" | "client"; actorId: string; firmId: string | null; authMethod: ProductAuthMethod };
  } | null>;
  issueSessionToken: (session: ProductSession, authMethod: ProductAuthMethod) => ReturnType<ProductRouteContext["issueTokenBundleForSessionRecord"]>;
  issueOtp: (actorType: "staff" | "client", phone: string, clientAccountId?: string, purpose?: string) => Promise<
    | { error: string }
    | { ok: true; expiresAt: string | null; devCode?: string }
  >;
  resolveOtpSession: (actorType: "staff" | "client", phone: string, code: string, clientAccountId?: string) => Promise<ProductSession | null>;
  sendDocumentResponse: (document: ProductDocument, reply: FastifyReply) => Promise<unknown>;
  registerAuditHook: () => void;
};

function getProductUploadsDirectory(): string {
  return process.env.PRODUCT_UPLOADS_DIRECTORY ?? join(process.cwd(), "data", "product-uploads");
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) {
    return phone;
  }
  return `${phone.slice(0, 4)}${"*".repeat(Math.max(phone.length - 6, 0))}${phone.slice(-2)}`;
}

export function readPortalToken(request: FastifyRequest): string | null {
  const headerToken = request.headers["x-portal-token"];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }
  const query = request.query as { token?: string; portalToken?: string } | undefined;
  return query?.token ?? query?.portalToken ?? null;
}

export function readRefreshToken(request: FastifyRequest): string | null {
  const headerToken = request.headers["x-refresh-token"];
  if (typeof headerToken === "string" && headerToken.length > 0) {
    return headerToken;
  }

  const body = request.body as { refreshToken?: string } | undefined;
  return body?.refreshToken ?? null;
}

export async function requireProductSession(
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

export async function requirePortalScopedAccess(
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

export function requireStaffSession(
  session: Awaited<ReturnType<typeof requireProductSession>>,
  reply: FastifyReply,
): session is NonNullable<Awaited<ReturnType<typeof requireProductSession>>> & { actorType: "staff" } {
  if (!session || session.actorType !== "staff") {
    reply.code(403);
    return false;
  }
  return true;
}

export function requireClientSession(
  session: Awaited<ReturnType<typeof requireProductSession>>,
  reply: FastifyReply,
): session is NonNullable<Awaited<ReturnType<typeof requireProductSession>>> & { actorType: "client" } {
  if (!session || session.actorType !== "client") {
    reply.code(403);
    return false;
  }
  return true;
}

export function requirePermission(
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

export function publicDevelopmentFields(fields: Record<string, unknown>): Record<string, unknown> {
  return isProduction() ? {} : fields;
}

export function isProductActorType(value: unknown): value is "staff" | "client" {
  return value === "staff" || value === "client";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isNonEmptyText(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

export function isNullableText(value: unknown, maxLength = 500): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

export function isNullableEmail(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDateOrDateTime(value);
}

export function parseMatterPatch(value: unknown): Partial<Omit<Matter, "id" | "firmId">> | null {
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

export async function parseMultipartFields(request: FastifyRequest): Promise<{
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
      fileName = part.filename ? sanitizePlainText(part.filename) : null;
      mimeType = part.mimetype ?? "application/octet-stream";
      continue;
    }

    fields[part.fieldname] = sanitizePlainText(String(part.value ?? ""));
  }

  return { fields, fileName, bytes, mimeType };
}

export function logOtpFailure(stage: string, error: unknown, context: Record<string, unknown>): void {
  console.error("[otp] failure", {
    stage,
    ...context,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
  });
  captureError(error, { domain: "otp", stage, ...context });
}

export function createProductRouteContext(app: FastifyInstance, store: ProductStoreContract): ProductRouteContext {
  const publicWebUrl = process.env.PUBLIC_WEB_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const smsProvider = createSmsProvider();
  const objectStorage = createPrivateObjectStorage();
  const roleDefinitions = [
    { id: "owner", permissions: ["*"] },
    { id: "lawyer", permissions: ["matters.read", "matters.write", "clients.write", "hearings.write", "documents.read", "documents.write", "messages.write", "time.write", "court.sync", "portal.write"] },
    { id: "assistant", permissions: ["matters.read", "documents.read", "calendar.read"] },
    { id: "billing", permissions: ["invoices.read", "invoices.write", "time.read"] },
  ] as const;

  function registerAuditHook(): void {
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
  }

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

  function isOtpMockMode(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  async function resolveOtpSession(
    actorType: "staff" | "client",
    phone: string,
    code: string,
    clientAccountId?: string,
  ): Promise<ProductSession | null> {
    if (clientAccountId) {
      return store.verifyClientOtpForAccount(clientAccountId, phone, code);
    }
    return store.verifyOtp(actorType, phone, code);
  }

  async function issueOtp(
    actorType: "staff" | "client",
    phone: string,
    clientAccountId?: string,
    purpose?: string,
  ): Promise<{ error: string } | { ok: true; expiresAt: string | null; devCode?: string }> {
    try {
    const normalizedPhone = normalizePakistanPhone(phone);
    if (!normalizedPhone) {
      return { error: "Invalid phone number format. Please check the format and try again." };
    }

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

    const isMockOtp = isOtpMockMode();

    const code = isMockOtp
      ? (process.env.WAKEEL_DEV_OTP_CODE ?? "246810")
      : String(randomInt(100000, 1000000));

    const requestRecord = await store.createOtpRequest({ actorType, phone: normalizedPhone, code });
    if (!requestRecord) {
      return { error: "Too many OTP requests. Please wait a few minutes before trying again." };
    }

    if (isMockOtp) {
      console.error("[otp] mock bypass", { actorType, phone: normalizedPhone, purpose: purpose ?? null });
      return {
        ok: true,
        expiresAt: requestRecord.expiresAt,
        devCode: requestRecord.devCode ?? undefined,
      };
    }

    try {
      await smsProvider.send(normalizedPhone, `Your Legal Bhai verification code is ${code}. It expires in 10 minutes.`);
    } catch (err: unknown) {
      logOtpFailure("sms_send", err, { actorType, phone: normalizedPhone, purpose: purpose ?? null });
      const message = err instanceof Error ? err.message : "Unknown SMS error";
      return { error: `SMS failed to send: ${message}` };
    }
    return {
      ok: true,
      expiresAt: requestRecord.expiresAt,
    };
    } catch (error) {
      logOtpFailure("issue_otp", error, { actorType, phone, purpose: purpose ?? null });
      throw error;
    }
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

    const localObject = await objectStorage.read(document.storageKey);
    if (localObject) {
      reply.header("content-type", localObject.contentType ?? document.mimeType);
      return reply.send(localObject.bytes);
    }

    reply.code(404);
    return { error: "Not found" };
  }

  return {
    app,
    store,
    publicWebUrl,
    smsProvider,
    objectStorage,
    roleDefinitions,
    issueTokenBundleForSessionRecord,
    issueSessionToken,
    issueOtp,
    resolveOtpSession,
    sendDocumentResponse,
    registerAuditHook,
  };
}
