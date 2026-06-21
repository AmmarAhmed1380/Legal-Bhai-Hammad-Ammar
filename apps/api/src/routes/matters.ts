import {
  PRODUCT_MATTER_STATUSES,
  PRODUCT_MATTER_TYPES,
  type Matter,
} from "@wakeel/shared";
import { normalizeCourtCaseNumber } from "../lib/court-sources.js";
import { MATTER_CSV_TEMPLATE, validateMatterCsv } from "../lib/csv-import.js";
import {
  bodyCreateMatter,
  bodyCreateParty,
  bodyMatterCsvPreview,
  bodyMatterPatch,
  bodyPartyPatch,
  paramId,
  paramMatterAndPartyId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  PARTY_TYPES,
  isNonEmptyText,
  isNullableIsoDate,
  isNullableText,
  isRecord,
  parseMatterPatch,
  requirePermission,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerMatterRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

  app.get("/v1/matters", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { matters: await store.listMatters(session) };
  });

  app.post("/v1/matters", { schema: { body: bodyCreateMatter } }, async (request, reply) => {
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

  app.post("/v1/matters/imports/preview", { schema: { body: bodyMatterCsvPreview } }, async (request, reply) => {
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

  app.post("/v1/matters/imports/:id/confirm", { schema: { params: paramId } }, async (request, reply) => {
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

  app.patch("/v1/matters/:id", { schema: { params: paramId, body: bodyMatterPatch } }, async (request, reply) => {
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

  app.post("/v1/matters/:id/parties", { schema: { params: paramId, body: bodyCreateParty } }, async (request, reply) => {
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

  app.patch("/v1/matters/:matterId/parties/:partyId", { schema: { params: paramMatterAndPartyId, body: bodyPartyPatch } }, async (request, reply) => {
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
}
