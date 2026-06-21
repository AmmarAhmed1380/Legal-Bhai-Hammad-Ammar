import { bodyNotificationPreferences, paramId } from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerReportRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

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

  app.patch("/v1/alerts/:id", { schema: { params: paramId } }, async (request, reply) => {
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

  app.patch("/v1/notifications/preferences", { schema: { body: bodyNotificationPreferences } }, async (request, reply) => {
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
}
