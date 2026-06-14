import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { extname, join } from "node:path";

import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";

import { DEMO_CODE, STAGES, type NotificationType, type Stage, type User } from "@wakeel/shared";
import { readBearerToken, signDemoToken, verifyDemoToken } from "./lib/auth.js";
import { envFlag, getJwtSecret, isProduction, validateProductionEnvironment } from "./lib/config.js";
import { fetchIhcCauseListHtml, normalizeIhcCaseNumber, parseIhcCauseList } from "./lib/ihc.js";
import { renderNotificationPreview } from "./lib/notifications.js";
import { runOcr } from "./lib/ocr.js";
import { registerProductRoutes } from "./lib/product-api.js";
import { SlidingWindowRateLimiter } from "./lib/rate-limit.js";
import { createRuntimeProductStore } from "./lib/runtime-product-store.js";
import { createStore, type DemoStore, todayInPakistan } from "./lib/store.js";
import { captureError } from "./lib/telemetry.js";

const DEFAULT_DEV_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEMO_ROUTE_PREFIXES = ["/auth/demo", "/me", "/dashboard", "/cases", "/calendar/today", "/hearings", "/notifications", "/share", "/admin", "/sync", "/uploads"];
const DEFERRED_PRODUCT_ROUTE_PREFIXES = [
  "/auth/staff/magic-link",
  "/v1/time-entries",
  "/v1/invoices",
  "/v1/firms",
  "/v1/memberships",
  "/v1/reports",
  "/roles",
  "/v1/roles",
];

function isStage(value: string): value is Stage {
  return STAGES.includes(value as Stage);
}

function isDemoModeEnabled(): boolean {
  return envFlag("ENABLE_DEMO_SURFACES");
}

function getUploadsDirectory(): string {
  return join(process.cwd(), "data", "uploads");
}

export function publicErrorDetails(error: unknown, replyStatusCode: number): { statusCode: number; message: string } {
  const errorStatusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  const statusCode = replyStatusCode >= 400
    ? replyStatusCode
    : typeof errorStatusCode === "number" && Number.isInteger(errorStatusCode) && errorStatusCode >= 400 && errorStatusCode <= 599
      ? errorStatusCode
      : 500;
  const internalMessage = error instanceof Error ? error.message : "Unexpected server error";
  return {
    statusCode,
    message: isProduction() && statusCode >= 500 ? "Unexpected server error" : internalMessage,
  };
}

function resetUploadsDirectory(): void {
  rmSync(getUploadsDirectory(), { recursive: true, force: true });
  mkdirSync(getUploadsDirectory(), { recursive: true });
}

function resolveCorsOrigins(): string[] {
  const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error("CORS_ORIGINS must be set in production");
  }

  return DEFAULT_DEV_CORS_ORIGINS;
}

async function requireUser(request: FastifyRequest, reply: FastifyReply, store: DemoStore): Promise<User | null> {
  const token = readBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401);
    return null;
  }

  const verified = verifyDemoToken(token, getJwtSecret());
  if (!verified) {
    reply.code(401);
    return null;
  }

  const user = store!.getUserById(verified.userId);
  if (!user) {
    reply.code(401);
    return null;
  }

  return user;
}

function requireDemoMode(reply: FastifyReply): boolean {
  if (isDemoModeEnabled()) {
    return true;
  }

  reply.code(404);
  return false;
}

function requireAdmin(user: User, reply: FastifyReply): boolean {
  if (user.role === "admin") {
    return true;
  }

  reply.code(403);
  return false;
}

function requireCaseOwnership(
  caseId: string,
  user: User,
  reply: FastifyReply,
  store: DemoStore,
  options: { hideUnauthorized?: boolean } = {},
) {
  const caseRecord = store!.getCaseRecord(caseId);
  if (!caseRecord) {
    reply.code(404);
    return null;
  }

  if (user.role !== "admin" && caseRecord.assignedToUserId !== user.id) {
    reply.code(options.hideUnauthorized ? 404 : 403);
    return null;
  }

  return caseRecord;
}

interface UploadFilePart {
  filename?: string;
  mimetype?: string;
  buffer: Buffer | null;
}

async function saveUpload(part: UploadFilePart | null): Promise<{ imageUrl: string | null; buffer: Buffer | null; mimeType: string | null }> {
  if (!part || !part.buffer) {
    return { imageUrl: null, buffer: null, mimeType: null };
  }

  const uploadsDir = getUploadsDirectory();
  mkdirSync(uploadsDir, { recursive: true });
  const extension = extname(part.filename || "") || ".jpg";
  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}${extension}`;
  const outputPath = join(uploadsDir, fileName);

  writeFileSync(outputPath, part.buffer);

  return {
    imageUrl: `/uploads/${fileName}`,
    buffer: part.buffer,
    mimeType: part.mimetype ?? null,
  };
}

export function buildServer(providedDemoStore?: DemoStore) {
  validateProductionEnvironment();
  const trustLoopbackProxy = envFlag("TRUST_PROXY_LOOPBACK", isProduction());
  const app = Fastify({
    logger: false,
    trustProxy: trustLoopbackProxy ? ["127.0.0.1", "::1"] : false,
  });
  const store = providedDemoStore ?? (isDemoModeEnabled() ? createStore() : null);
  const productStore = createRuntimeProductStore();
  const publicApiUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? "3001"}`;
  const publicWebUrl = process.env.PUBLIC_WEB_URL ?? publicApiUrl;
  const corsOrigins = resolveCorsOrigins();
  const rateLimiter = new SlidingWindowRateLimiter();

  app.addHook("onRequest", async (request, reply) => {
    if (!isDemoModeEnabled() && DEMO_ROUTE_PREFIXES.some((prefix) => request.url === prefix || request.url.startsWith(`${prefix}/`) || request.url.startsWith(`${prefix}?`))) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    if (isProduction() && DEFERRED_PRODUCT_ROUTE_PREFIXES.some((prefix) => request.url === prefix || request.url.startsWith(`${prefix}/`) || request.url.startsWith(`${prefix}?`))) {
      reply.code(404).send({ error: "Not found" });
      return;
    }
    const sensitive = request.url.startsWith("/v1/auth") || request.url.startsWith("/v1/pilot/") || request.url.startsWith("/auth/") || request.url.startsWith("/portal/") || request.url.startsWith("/v1/portal/");
    const allowed = rateLimiter.allow(`${request.ip}:${sensitive ? "sensitive" : "general"}`, sensitive ? 30 : 300, 60_000);
    if (!allowed) {
      reply.code(429).send({ error: "Too many requests" });
      return;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      reply.code(413).send({ error: "Upload exceeds the 10 MB limit" });
      return;
    }

    const { statusCode, message } = publicErrorDetails(error, reply.statusCode);
    if (statusCode >= 500) {
      captureError(error);
    }
    reply.code(statusCode).send({ error: message });
  });

  app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, corsOrigins.includes(origin));
    },
  });
  app.register(multipart, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
    },
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/health/ready", async (_request, reply) => {
    const ready = await productStore.healthCheck();
    reply.code(ready ? 200 : 503);
    return { ok: ready };
  });

  registerProductRoutes(app, productStore);
  app.addHook("onClose", async () => {
    await productStore.close();
  });

  app.post("/auth/demo/request-code", async (request, reply) => {
    if (!requireDemoMode(reply)) {
      return { error: "Not found" };
    }

    const body = request.body as { phone?: string };
    if (!body.phone) {
      reply.code(400);
      return { error: "Phone is required" };
    }

    const user = store!.findUserByPhone(body.phone);
    if (!user) {
      reply.code(404);
      return { error: "Demo phone not seeded" };
    }

    return {
      ok: true,
      message: `Use fixed demo code ${DEMO_CODE}`,
    };
  });

  app.post("/auth/demo/verify", async (request, reply) => {
    if (!requireDemoMode(reply)) {
      return { error: "Not found" };
    }

    const body = request.body as { phone?: string; code?: string };
    if (!body.phone || !body.code) {
      reply.code(400);
      return { error: "Phone and code are required" };
    }

    const user = store!.findUserByPhone(body.phone);
    if (!user || body.code !== DEMO_CODE) {
      reply.code(401);
      return { error: "Invalid demo credentials" };
    }

    const token = signDemoToken(user.id, getJwtSecret());
    return { token, user };
  });

  app.get("/me", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    return { user };
  });

  app.get("/dashboard/summary", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    return {
      summary: store!.getDashboardSummary(),
      users: store!.listUsers(),
      palette: {
        primary: "#0F6E56",
        surface: "#FFFFFF",
      },
    };
  });

  app.get("/cases", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    return {
      cases: store!.listCases(),
      users: store!.listUsers(),
    };
  });

  app.post("/cases", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const body = request.body as Record<string, string | null>;
    const stage = (body.stage as string | undefined) ?? "filing";
    if (!isStage(stage)) {
      reply.code(400);
      return { error: "Invalid stage" };
    }

    const id = store!.createCase({
      rawCaseNumber: String(body.rawCaseNumber ?? ""),
      normalizedCaseNumber: String(body.normalizedCaseNumber ?? body.rawCaseNumber ?? "").toUpperCase(),
      court: String(body.court ?? ""),
      title: String(body.title ?? ""),
      stage,
      nextDate: (body.nextDate as string | null) || null,
      assignedToUserId: (body.assignedToUserId as string | null) || null,
      clientName: String(body.clientName ?? ""),
      clientPhone: String(body.clientPhone ?? ""),
      sourceType: (body.sourceType as "live_ihc" | "demo_district") ?? "demo_district",
      judgeName: (body.judgeName as string | null) || null,
      benchName: (body.benchName as string | null) || null,
    });

    reply.code(201);
    return { case: store!.getCase(id) };
  });

  app.get("/cases/:id", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const caseId = (request.params as { id: string }).id;
    const ownedCase = requireCaseOwnership(caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    return {
      case: store!.getCase(ownedCase.id),
      users: store!.listUsers(),
    };
  });

  app.patch("/cases/:id", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const caseId = (request.params as { id: string }).id;
    const ownedCase = requireCaseOwnership(caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    const body = request.body as Record<string, string | null>;
    const stage = body.stage ? String(body.stage) : undefined;
    if (stage && !isStage(stage)) {
      reply.code(400);
      return { error: "Invalid stage" };
    }

    return {
      case: store!.updateCase(ownedCase.id, {
        rawCaseNumber: body.rawCaseNumber ? String(body.rawCaseNumber) : undefined,
        normalizedCaseNumber: body.normalizedCaseNumber ? String(body.normalizedCaseNumber).toUpperCase() : undefined,
        court: body.court ? String(body.court) : undefined,
        title: body.title ? String(body.title) : undefined,
        stage: stage as Stage | undefined,
        nextDate: body.nextDate === undefined ? undefined : (body.nextDate as string | null),
        clientName: body.clientName ? String(body.clientName) : undefined,
        clientPhone: body.clientPhone ? String(body.clientPhone) : undefined,
        judgeName: body.judgeName === undefined ? undefined : (body.judgeName as string | null),
        benchName: body.benchName === undefined ? undefined : (body.benchName as string | null),
      }),
    };
  });

  app.post("/cases/:id/assign", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const caseId = (request.params as { id: string }).id;
    const ownedCase = requireCaseOwnership(caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    const body = request.body as { userId?: string };
    if (!body.userId) {
      reply.code(400);
      return { error: "userId is required" };
    }

    return { case: store!.assignCase(ownedCase.id, body.userId) };
  });

  app.post("/cases/:id/hearings", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const caseId = (request.params as { id: string }).id;
    const ownedCase = requireCaseOwnership(caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    let hearingDate = todayInPakistan();
    let outcome = "order_passed";
    let notes = "";
    let nextDateGiven: string | null = null;
    let stageAfter: Stage | null = null;
    let upload: UploadFilePart | null = null;

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          const chunks: Buffer[] = [];
          let totalBytes = 0;

          for await (const chunk of part.file) {
            const bufferChunk = Buffer.from(chunk);
            totalBytes += bufferChunk.length;
            if (totalBytes > MAX_UPLOAD_BYTES) {
              reply.code(413);
              return { error: "Upload exceeds the 10 MB limit" };
            }
            chunks.push(bufferChunk);
          }

          upload = {
            filename: part.filename,
            mimetype: part.mimetype,
            buffer: Buffer.concat(chunks),
          };
          continue;
        }

        if (part.fieldname === "hearingDate") hearingDate = String(part.value);
        if (part.fieldname === "outcome") outcome = String(part.value);
        if (part.fieldname === "notes") notes = String(part.value);
        if (part.fieldname === "nextDateGiven") nextDateGiven = String(part.value || "") || null;
        if (part.fieldname === "stageAfter" && isStage(String(part.value))) stageAfter = String(part.value) as Stage;
      }
    } catch (error) {
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
        reply.code(413);
        return { error: "Upload exceeds the 10 MB limit" };
      }

      throw error;
    }

    const storedUpload = await saveUpload(upload);
    const ocr = await runOcr(storedUpload.buffer, storedUpload.mimeType);
    const saved = store!.addHearing(ownedCase.id, {
      hearingDate,
      outcome,
      notes,
      nextDateGiven,
      stageAfter,
      imageUrl: storedUpload.imageUrl ? `${publicApiUrl}${storedUpload.imageUrl}` : null,
      mimeType: storedUpload.mimeType,
      ocrText: ocr.text,
      ocrStatus: ocr.status,
    });

    return {
      hearing: saved,
      case: store!.getCase(ownedCase.id),
    };
  });

  app.get("/calendar/today", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    return store!.getCalendarTodayPayload();
  });

  app.post("/sync/ihc", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }
    if (!requireAdmin(user, reply)) {
      return { error: "Admin only" };
    }

    const html = await fetchIhcCauseListHtml();
    const parsedRows = parseIhcCauseList(html);
    const liveCases = store!.listIhcCases();
    const today = todayInPakistan();

    const matchedEntries = parsedRows
      .map((row) => {
        const matched = liveCases.find(
          (caseRecord) => normalizeIhcCaseNumber(caseRecord.normalizedCaseNumber) === row.caseNumber,
        );
        if (!matched) {
          return null;
        }

        return {
          caseId: matched.id,
          court: row.court || matched.court,
          bench: matched.benchName ?? row.court ?? "IHC Bench",
          date: today,
          timeSlot: "09:30 AM",
          source: "live_ihc" as const,
          sourceConfidence: 0.9,
          judgeNames: row.judgeNames || matched.judgeName,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    store!.addCalendarEntries(matchedEntries, true);

    return {
      fetched: parsedRows.length,
      matched: matchedEntries.length,
      date: today,
    };
  });

  app.post("/cases/:id/share-link", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const caseId = (request.params as { id: string }).id;
    const ownedCase = requireCaseOwnership(caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    const token = randomBytes(18).toString("base64url");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const created = store!.createShareLink(ownedCase.id, token, expiresAt);

    return {
      shareUrl: `${publicWebUrl}/share/${created.rawToken}`,
      expiresAt: created.link.expiresAt,
    };
  });

  app.get("/share/:token", async (request, reply) => {
    const payload = store!.getSharedCaseByToken((request.params as { token: string }).token);
    if (!payload) {
      reply.code(404);
      return { error: "Share link not found or expired" };
    }

    return payload;
  });

  app.post("/notifications/preview", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }

    const body = request.body as { caseId?: string; type?: NotificationType };
    if (!body.caseId || !body.type) {
      reply.code(400);
      return { error: "caseId and type are required" };
    }

    const ownedCase = requireCaseOwnership(body.caseId, user, reply, store!);
    if (!ownedCase) {
      return { error: "Case not found" };
    }

    const caseRecord = store!.getCase(ownedCase.id);
    if (!caseRecord) {
      reply.code(404);
      return { error: "Case not found" };
    }

    const renderedText = renderNotificationPreview(body.type, {
      caseRecord,
      hearing: caseRecord.hearings[0] ?? null,
    });
    const preview = store!.saveNotificationPreview(caseRecord.id, body.type, renderedText, caseRecord.clientPhone);

    return { preview };
  });

  app.get("/uploads/:filename", async (request, reply) => {
    const user = await requireUser(request, reply, store!);
    if (!user) {
      reply.code(404);
      return { error: "Upload not found" };
    }

    const filename = (request.params as { filename: string }).filename;
    const owner = store!.getUploadOwner(filename);
    if (!owner) {
      reply.code(404);
      return { error: "Upload not found" };
    }

    if (!requireCaseOwnership(owner.caseId, user, reply, store!, { hideUnauthorized: true })) {
      return { error: "Upload not found" };
    }

    const filePath = join(getUploadsDirectory(), filename);
    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: "Upload not found" };
    }

    const extension = extname(filename).toLowerCase();
    const contentType =
      extension === ".png"
        ? "image/png"
        : extension === ".pdf"
          ? "application/pdf"
          : "image/jpeg";
    reply.header("content-type", contentType);
    return reply.send(readFileSync(filePath));
  });

  app.post("/admin/reset-demo", async (request, reply) => {
    if (!requireDemoMode(reply)) {
      return { error: "Not found" };
    }

    const user = await requireUser(request, reply, store!);
    if (!user) {
      return { error: "Unauthorized" };
    }
    if (!requireAdmin(user, reply)) {
      return { error: "Admin only" };
    }

    resetUploadsDirectory();
    const resetAt = store!.resetDemoData();
    return { ok: true, resetAt };
  });

  return app;
}
