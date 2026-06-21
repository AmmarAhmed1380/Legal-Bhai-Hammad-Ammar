import { runOcr } from "../lib/ocr.js";
import { transcribeCourtroomAudio } from "../lib/transcription.js";
import { UploadValidationError, validateAndScanDocumentUpload, validateAudioUpload } from "../lib/file-validation.js";
import { MalwareScanError } from "../lib/malware-scan.js";
import { isProduction } from "../lib/config.js";
import { bodyHearingJson, paramId } from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isNonEmptyText,
  isNullableIsoDate,
  parseMultipartFields,
  requirePermission,
  requireProductSession,
} from "./context.js";

export function registerHearingRoutes(ctx: ProductRouteContext): void {
  const { app, store, objectStorage } = ctx;

  app.get("/v1/matters/:id/hearings", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { hearings: await store.listHearings(session, (request.params as { id: string }).id) };
  });

  app.post("/v1/matters/:id/hearings", { schema: { params: paramId, body: bodyHearingJson } }, async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "hearings.write")) {
      return { error: "Forbidden" };
    }

    const matterId = (request.params as { id: string }).id;
    const multipartPayload = await parseMultipartFields(request);
    let documentId: string | null = null;

    if (multipartPayload.bytes && multipartPayload.fileName) {
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

  app.post("/v1/upload/audio", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "hearings.write")) {
      return { error: "Forbidden" };
    }

    const multipartPayload = await parseMultipartFields(request);
    const body = {
      ...((request.body ?? {}) as { matterId?: string; listedAt?: string; outcome?: string }),
      ...multipartPayload.fields,
    };
    if (!body.matterId || !multipartPayload.fileName || !multipartPayload.bytes) {
      reply.code(400);
      return { error: "matterId and audio file are required" };
    }

    try {
      const validated = validateAudioUpload({
        fileName: multipartPayload.fileName,
        bytes: multipartPayload.bytes,
        mimeType: multipartPayload.mimeType ?? "application/octet-stream",
      });
      const transcript = await transcribeCourtroomAudio({
        bytes: multipartPayload.bytes,
        fileName: multipartPayload.fileName,
        mimeType: validated.contentType,
      });
      const hearing = await store.addHearing(session, {
        matterId: body.matterId,
        listedAt: body.listedAt ?? new Date().toISOString(),
        outcome: body.outcome ?? "Voice note captured",
        notes: transcript.text,
        nextDate: null,
        courtroom: null,
        bench: null,
        sourceType: "voice_transcription",
        documentId: null,
      });
      if (!hearing) {
        reply.code(404);
        return { error: "Matter not found" };
      }
      return { hearing, transcription: transcript };
    } catch (error) {
      if (error instanceof UploadValidationError) {
        reply.code(400);
        return { error: error.message };
      }
      throw error;
    }
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
}
