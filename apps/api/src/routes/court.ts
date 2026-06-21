import { fetchCourtCauseList, isSupportedCourtSource, type CourtListType } from "../lib/court-sources.js";
import { isIsoDateOnly } from "../lib/date-validation.js";
import {
  bodyCourtMatchLink,
  bodyCourtMatchReview,
  paramId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isRecord,
  requirePermission,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerCourtRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

  app.get("/v1/court-sources", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { courtSources: await store.listCourtSources() };
  });

  app.post("/v1/court-sources/:id/sync", { schema: { params: paramId } }, async (request, reply) => {
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

  app.post("/v1/court-matches/unmatched/:id/link", { schema: { params: paramId, body: bodyCourtMatchLink } }, async (request, reply) => {
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

  app.patch("/v1/court-matches/:id", { schema: { params: paramId, body: bodyCourtMatchReview } }, async (request, reply) => {
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
}
