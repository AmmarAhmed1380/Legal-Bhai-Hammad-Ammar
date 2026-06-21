import { signAppToken } from "../lib/auth.js";
import { getJwtSecret } from "../lib/config.js";
import {
  bodyPortalLink,
  bodyPortalOtp,
  bodyPortalOtpVerify,
} from "../lib/route-schemas.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type ProductRouteContext,
  isNonEmptyText,
  maskPhone,
  readPortalToken,
  requirePermission,
  requirePortalScopedAccess,
  requireProductSession,
} from "./context.js";

export function registerPortalRoutes(ctx: ProductRouteContext): void {
  const { app, store, publicWebUrl, issueOtp, resolveOtpSession } = ctx;

  const registerPortalReadRoute = (path: string, detail = false) => {
    app.get(path, async (request, reply) => {
      const portalToken = readPortalToken(request);
      if (!portalToken) {
        reply.code(401);
        return { error: "Portal token is required" };
      }
      const access = await requirePortalScopedAccess(request, reply, store, portalToken);
      if (!access) {
        return { error: "Portal OTP verification is required" };
      }
      if (!detail) {
        return { cases: await store.listPortalMattersForAccess(portalToken, access.link.id) };
      }
      const matter = await store.getPortalMatterForAccess(portalToken, access.link.id, (request.params as { id: string }).id);
      if (!matter) {
        reply.code(404);
        return { error: "Not found" };
      }
      return { case: matter };
    });
  };

  app.post("/portal/links", { schema: { body: bodyPortalLink } }, async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!requirePermission(session, reply, "portal.write")) {
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { matterId?: string; clientId?: string; expiresHours?: number };
    if (
      !isNonEmptyText(body.matterId, 100) ||
      (body.clientId !== undefined && !isNonEmptyText(body.clientId, 100)) ||
      (body.expiresHours !== undefined && (!Number.isInteger(body.expiresHours) || body.expiresHours < 1 || body.expiresHours > 24 * 30))
    ) {
      reply.code(400);
      return { error: "Invalid portal link fields" };
    }
    const portalLink = await store.createPortalLink(session, body.matterId, body.expiresHours ?? 24 * 14, body.clientId);
    if (!portalLink) {
      reply.code(404);
      return { error: "Client membership not found for matter" };
    }
    return {
      portalLink: portalLink.portalLink,
      portalUrl: `${publicWebUrl}/c/${portalLink.rawToken}`,
      token: portalLink.rawToken,
    };
  });

  app.post("/v1/portal/links", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/links",
      headers: request.headers as Record<string, string>,
      payload: request.body as Record<string, unknown> | undefined,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );

  registerPortalReadRoute("/portal/cases");
  registerPortalReadRoute("/v1/portal/cases");
  registerPortalReadRoute("/portal/cases/:id", true);
  registerPortalReadRoute("/v1/portal/cases/:id", true);

  app.post("/portal/otp", { schema: { body: bodyPortalOtp } }, async (request, reply) => {
    const portalToken = (request.body as { token?: string } | undefined)?.token ?? readPortalToken(request);
    if (!portalToken) {
      reply.code(400);
      return { error: "Portal token is required" };
    }
    const access = await store.getPortalAccess(portalToken);
    if (!access) {
      reply.code(404);
      return { error: "Portal link not found" };
    }
    const response = await issueOtp("client", access.clientAccount.phone, access.clientAccount.id);
    if (!response) {
      reply.code(429);
      return { error: "Too many OTP requests" };
    }
    return {
      maskedPhone: maskPhone(access.clientAccount.phone),
      ...response,
    };
  });

  app.post("/v1/portal/otp", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/otp",
      payload: request.body as Record<string, unknown> | undefined,
      headers: request.headers as Record<string, string>,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );

  app.post("/portal/otp/verify", { schema: { body: bodyPortalOtpVerify } }, async (request, reply) => {
    const body = (request.body ?? {}) as { token?: string; code?: string };
    if (!body.token || !body.code) {
      reply.code(400);
      return { error: "token and code are required" };
    }
    const access = await store.getPortalAccess(body.token);
    if (!access) {
      reply.code(404);
      return { error: "Portal link not found" };
    }
    const session = await resolveOtpSession(
      "client",
      access.clientAccount.phone,
      body.code,
      access.clientAccount.id,
    );
    if (!session) {
      reply.code(401);
      return { error: "Invalid OTP" };
    }
    await store.recordSecurityEvent(
      session,
      "portal.otp.verified",
      "portal_link",
      access.link.id,
      { matterId: access.link.matterId },
    );
    return {
      token: signAppToken({
        actorType: session.actorType,
        actorId: session.actorId,
        firmId: session.firmId,
        portalLinkId: access.link.id,
      }, getJwtSecret(), ACCESS_TOKEN_TTL_SECONDS),
      refreshToken: null,
      expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    };
  });

  app.post("/v1/portal/otp/verify", async (request, reply) =>
    app.inject({
      method: "POST",
      url: "/portal/otp/verify",
      payload: request.body as Record<string, unknown> | undefined,
      headers: request.headers as Record<string, string>,
    }).then((response) => reply.code(response.statusCode).send(response.json())),
  );
}
