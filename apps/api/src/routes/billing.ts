import { randomUUID } from "node:crypto";

import { type Invoice, type TimeEntry } from "@wakeel/shared";
import {
  bodyCreateInvoice,
  bodyCreateTimeEntry,
  bodyInvoicePatch,
  paramId,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isRecord,
  requirePermission,
  requireProductSession,
} from "./context.js";

export function registerBillingRoutes(ctx: ProductRouteContext): void {
  const { app, store } = ctx;

  app.get("/v1/time-entries", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { timeEntries: await store.listTimeEntries(session) };
  });

  app.post("/v1/time-entries", { schema: { body: bodyCreateTimeEntry } }, async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "time.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as Omit<TimeEntry, "id" | "firmId" | "userId">;
    if (!body.matterId || !body.startedAt || !body.minutes || !body.narrative) {
      reply.code(400);
      return { error: "Missing time entry fields" };
    }
    const timeEntry = await store.createTimeEntry(session, {
      id: randomUUID(),
      firmId: session.firmId,
      matterId: body.matterId,
      userId: session.actorId,
      startedAt: body.startedAt,
      minutes: body.minutes,
      narrative: body.narrative,
      billable: body.billable ?? true,
    });
    if (!timeEntry) {
      reply.code(404);
      return { error: "Matter not found" };
    }
    return { timeEntry };
  });

  app.get("/v1/invoices", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { invoices: await store.listInvoices(session) };
  });

  app.post("/v1/invoices", { schema: { body: bodyCreateInvoice } }, async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "invoices.write") || !session.firmId) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as {
      clientAccountId?: string;
      matterId?: string | null;
      status?: Invoice["status"];
      issuedAt?: string | null;
      dueAt?: string | null;
      total?: number;
    };
    if (!body.clientAccountId || !body.status || body.total == null) {
      reply.code(400);
      return { error: "Missing invoice fields" };
    }
    const invoice = await store.createInvoice(session, {
      firmId: session.firmId,
      clientAccountId: body.clientAccountId,
      matterId: body.matterId ?? null,
      status: body.status,
      issuedAt: body.issuedAt ?? null,
      dueAt: body.dueAt ?? null,
      total: body.total,
    });
    if (!invoice) {
      reply.code(404);
      return { error: "Client or matter not found" };
    }
    return { invoice };
  });

  app.patch("/v1/invoices/:id", { schema: { params: paramId, body: bodyInvoicePatch } }, async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "invoices.write")) {
      return { error: "Forbidden" };
    }
    if (!isRecord(request.body)) {
      reply.code(400);
      return { error: "Invalid invoice patch" };
    }
    const invoice = await store.updateInvoice(session, (request.params as { id: string }).id, request.body);
    if (!invoice) {
      reply.code(404);
      return { error: "Not found" };
    }
    return { invoice };
  });
}
