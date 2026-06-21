import { randomUUID } from "node:crypto";

import {
  PRODUCT_DELIVERY_CHANNELS,
  PRODUCT_DOCUMENT_TYPES,
  PRODUCT_LANGUAGES,
  type ProductDocument,
  type ProductLanguage,
} from "@wakeel/shared";
import { runOcr } from "../lib/ocr.js";
import { UploadValidationError, validateAndScanDocumentUpload } from "../lib/file-validation.js";
import { MalwareScanError } from "../lib/malware-scan.js";
import { isProduction } from "../lib/config.js";
import {
  bodyDocumentLink,
  bodyDocumentPatch,
  bodyThreadMessage,
  paramId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isNonEmptyText,
  isNullableText,
  isRecord,
  parseMultipartFields,
  readPortalToken,
  requirePermission,
  requirePortalScopedAccess,
  requireProductSession,
} from "./context.js";

export function registerDocumentRoutes(ctx: ProductRouteContext): void {
  const { app, store, objectStorage, sendDocumentResponse } = ctx;

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
    if (!session) {
      reply.code(401);
      return { error: "Unauthorized" };
    }
    const isStaff = session.actorType === "staff";
    const isClient = session.actorType === "client";

    if (!isStaff && !isClient) {
      reply.code(403);
      return { error: "Forbidden" };
    }

    if (isStaff && (!requirePermission(session, reply, "documents.write") || !session.firmId)) {
      return { error: "Forbidden" };
    }
    const multipartPayload = await parseMultipartFields(request);
    const requestBody = (request.body ?? {}) as {
      matterId?: string | null;
      folderId?: string | null;
      type?: ProductDocument["type"];
      documentType?: string;
      title?: string;
      mimeType?: string;
      searchText?: string | null;
      portalVisible?: boolean;
    };
    const body = { ...requestBody, ...multipartPayload.fields };

    body.type = (body.documentType ?? body.type) as ProductDocument["type"];
    if (isClient) {
      if (!body.matterId) {
        reply.code(400);
        return { error: "matterId is required for client uploads" };
      }
      const matter = await store.getMatter(session, body.matterId);
      if (!matter) {
        reply.code(403);
        return { error: "Access denied to target matter" };
      }
      body.portalVisible = true;
      if (!body.type) {
        body.type = "General";
      }
      if (body.type.toLowerCase() === "vakalatnama") {
        reply.code(400);
        return { error: "Vakalatnama is a lawyer-managed document and cannot be uploaded by clients" };
      }
    }
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
    let storageKey = `virtual:${randomUUID()}`;
    if (multipartPayload.fileName && multipartPayload.bytes) {
      try {
        await validateAndScanDocumentUpload({
          fileName: multipartPayload.fileName,
          bytes: multipartPayload.bytes,
          mimeType: multipartPayload.mimeType ?? "application/octet-stream",
        });
      } catch (error) {
        if (error instanceof UploadValidationError) {
          reply.code(400);
          return { error: error.message };
        }
        if (error instanceof MalwareScanError) {
          reply.code(503);
          return { error: isProduction() ? "Document scanning is temporarily unavailable" : error.message };
        }
        throw error;
      }
      storageKey = await objectStorage.put({
        fileName: multipartPayload.fileName,
        bytes: multipartPayload.bytes,
        contentType: multipartPayload.mimeType ?? "application/octet-stream",
      });
    }
    const ocr =
      multipartPayload.bytes && multipartPayload.mimeType
        ? await runOcr(multipartPayload.bytes, multipartPayload.mimeType)
        : { status: "pending_config" as const, text: null };
    const document = await store.createDocument(session, {
      firmId: session.firmId ?? "",
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

  app.patch("/v1/documents/:id", { schema: { params: paramId, body: bodyDocumentPatch } }, async (request, reply) => {
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
      const document = await store.getDocument(access.session, requestedDocumentId);
      if (!document) {
        reply.code(404);
        return { error: "Not found" };
      }
      if (!document.portalVisible) {
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

  app.post("/v1/documents/:id/link", { schema: { params: paramId, body: bodyDocumentLink } }, async (request, reply) => {
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

  app.post("/v1/threads/:id/messages", { schema: { params: paramId, body: bodyThreadMessage } }, async (request, reply) => {
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
}
