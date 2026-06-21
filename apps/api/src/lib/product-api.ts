import type { FastifyInstance } from "fastify";

import { createProductRouteContext, type ProductStoreContract } from "../routes/context.js";
import { registerAuthRoutes } from "../routes/auth.js";
import { registerFirmRoutes } from "../routes/firms.js";
import { registerMatterRoutes } from "../routes/matters.js";
import { registerHearingRoutes } from "../routes/hearings.js";
import { registerDocumentRoutes } from "../routes/documents.js";
import { registerClientRoutes } from "../routes/clients.js";
import { registerBillingRoutes } from "../routes/billing.js";
import { registerCourtRoutes } from "../routes/court.js";
import { registerReportRoutes } from "../routes/reports.js";
import { registerPortalRoutes } from "../routes/portal.js";
import { registerWebhookRoutes } from "../routes/webhooks.js";
import { registerHealthRoutes } from "../routes/health.js";

export type { ProductStoreContract } from "../routes/context.js";

export function registerProductRoutes(app: FastifyInstance, store: ProductStoreContract): void {
  const ctx = createProductRouteContext(app, store);
  ctx.registerAuditHook();

  registerAuthRoutes(ctx);
  registerFirmRoutes(ctx);
  registerMatterRoutes(ctx);
  registerHearingRoutes(ctx);
  registerDocumentRoutes(ctx);
  registerClientRoutes(ctx);
  registerBillingRoutes(ctx);
  registerCourtRoutes(ctx);
  registerReportRoutes(ctx);
  registerPortalRoutes(ctx);
  registerWebhookRoutes(ctx);
  registerHealthRoutes(ctx);
}
