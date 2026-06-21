import {
  PRODUCT_LANGUAGES,
  type ClientAccount,
  type ProductLanguage,
} from "@wakeel/shared";
import {
  bodyClientPatch,
  bodyCreateClient,
  bodyNotificationPreferences,
  bodyShareMatterClient,
  paramId,
  paramMatterAndClientId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isNonEmptyText,
  isRecord,
  requireClientSession,
  requirePermission,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerClientRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

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

  app.post("/v1/clients", { schema: { body: bodyCreateClient } }, async (request, reply) => {
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

  app.patch("/v1/clients/:id/notifications/preferences", { schema: { params: paramId, body: bodyNotificationPreferences } }, async (request, reply) => {
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

  app.patch("/v1/clients/:id", { schema: { params: paramId, body: bodyClientPatch } }, async (request, reply) => {
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

  app.post("/v1/matters/:id/clients", { schema: { params: paramId, body: bodyShareMatterClient } }, async (request, reply) => {
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

  app.delete("/v1/matters/:matterId/clients/:clientId", { schema: { params: paramMatterAndClientId } }, async (request, reply) => {
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
}
