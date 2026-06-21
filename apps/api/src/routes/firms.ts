import {
  bodyCreateFirm,
  bodyFirmInvitation,
  bodyMembershipPatch,
  bodyMembershipPermissions,
  paramId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  requirePermission,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerFirmRoutes(ctx: ProductRouteContext): void {
  const { app, store, roleDefinitions } = ctx;

  app.post("/v1/firms", { schema: { body: bodyCreateFirm } }, async (request, reply) => {
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

  app.post("/v1/firms/:id/invitations", { schema: { params: paramId, body: bodyFirmInvitation } }, async (request, reply) => {
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

  app.patch("/v1/memberships/:id", { schema: { params: paramId, body: bodyMembershipPatch } }, async (request, reply) => {
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

  app.patch("/v1/memberships/:id/permissions", { schema: { params: paramId, body: bodyMembershipPermissions } }, async (request, reply) => {
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
}
