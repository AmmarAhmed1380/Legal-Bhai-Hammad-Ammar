import {
  type ProductRouteContext,
  requireProductSession,
  requireStaffSession,
} from "./context.js";

export function registerWebhookRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

  // Placeholder for future external provider webhooks (SMS delivery receipts, payment gateways, etc.)

  app.get("/v1/ingestion-runs", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requireStaffSession(session, reply)) {
      return { error: "Forbidden" };
    }
    return { ingestionRuns: await store.listIngestionRuns() };
  });
}
