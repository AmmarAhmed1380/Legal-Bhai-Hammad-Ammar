import type { ProductAuthMethod } from "@wakeel/shared";
import { readBearerToken, verifyAppToken } from "../lib/auth.js";
import { getJwtSecret, isProduction } from "../lib/config.js";
import {
  bodyMagicLinkRequest,
  bodyPhoneOtpRequest,
  bodyPhoneOtpVerify,
  bodyPilotInvite,
  bodyRefreshToken,
  bodyStaffRegister,
  bodyV1OtpRequest,
  bodyV1OtpVerify,
} from "../lib/route-schemas.js";
import {
  type ProductRouteContext,
  isNullableEmail,
  isNonEmptyText,
  isProductActorType,
  logOtpFailure,
  publicDevelopmentFields,
  readRefreshToken,
  requireProductSession,
} from "./context.js";

export function registerAuthRoutes(ctx: ProductRouteContext): void {
  const { app, store, publicWebUrl, issueOtp, resolveOtpSession, issueSessionToken, issueTokenBundleForSessionRecord } = ctx;

  function registerOtpRequestRoute(path: string, actorType: "staff" | "client"): void {
    app.post(path, { schema: { body: bodyPhoneOtpRequest } }, async (request, reply) => {
      const body = (request.body ?? {}) as { phone?: string; purpose?: string };
      if (!body.phone) {
        reply.code(400);
        return { error: "Phone is required" };
      }
      try {
        const response = await issueOtp(actorType, body.phone, undefined, body.purpose);
        if (!response) {
          reply.code(400);
          return { error: "Failed to request OTP" };
        }
        if ("error" in response && typeof response.error === "string") {
          const statusCode = response.error.includes("Too many") ? 429 : 400;
          reply.code(statusCode);
          return { error: response.error };
        }
        return response;
      } catch (error) {
        logOtpFailure("route", error, { path, actorType, phone: body.phone, purpose: body.purpose ?? null });
        reply.code(500);
        return {
          error: isProduction()
            ? "Unexpected server error"
            : error instanceof Error
              ? error.message
              : "Unexpected server error",
        };
      }
    });
  }

  function registerOtpVerifyRoute(path: string, actorType: "staff" | "client", authMethod: ProductAuthMethod): void {
    app.post(path, { schema: { body: bodyPhoneOtpVerify } }, async (request, reply) => {
      const body = (request.body ?? {}) as { phone?: string; code?: string };
      if (!body.phone || !body.code) {
        reply.code(400);
        return { error: "Phone and code are required" };
      }

      try {
        const session = await resolveOtpSession(actorType, body.phone, body.code);
        if (!session) {
          reply.code(401);
          return { error: "Invalid OTP. Please try again." };
        }

        const issued = await issueSessionToken(session, authMethod);
        if (!issued) {
          reply.code(401);
          return { error: "Profile not found" };
        }

        return issued;
      } catch (error) {
        reply.code(400);
        return { error: "Invalid OTP. Please try again." };
      }
    });
  }

  app.post("/auth/staff/magic-link/request", { schema: { body: bodyMagicLinkRequest } }, async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string };
    if (!body.email) {
      reply.code(400);
      return { error: "Email is required" };
    }
    const requestRecord = await store.createMagicLinkRequest(body.email);
    if (!requestRecord) {
      reply.code(404);
      return { error: "Staff user not found" };
    }
    return {
      ok: true,
      expiresAt: requestRecord.expiresAt,
      ...publicDevelopmentFields({
        devMagicLink: requestRecord.devToken
          ? `${publicWebUrl}/auth/staff/magic-link/verify?token=${requestRecord.devToken}`
          : null,
      }),
    };
  });

  app.get("/auth/staff/magic-link/verify", async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (!token) {
      reply.code(400);
      return { error: "Token is required" };
    }
    const session = await store.verifyMagicLink(token);
    if (!session) {
      reply.code(401);
      return { error: "Invalid magic link" };
    }
    const issued = await issueSessionToken(session, "staff_magic_link");
    if (!issued) {
      reply.code(401);
      return { error: "Profile not found" };
    }
    return issued;
  });

  registerOtpRequestRoute("/auth/staff/otp/request", "staff");
  registerOtpVerifyRoute("/auth/staff/otp/verify", "staff", "staff_otp");
  registerOtpRequestRoute("/auth/client/otp/request", "client");
  registerOtpVerifyRoute("/auth/client/otp/verify", "client", "client_otp");

  app.post("/v1/auth/otp/request", { schema: { body: bodyV1OtpRequest } }, async (request, reply) => {
    const body = (request.body ?? {}) as { phone?: string; actorType?: unknown; purpose?: string };
    if (!body.phone || !isProductActorType(body.actorType)) {
      reply.code(400);
      return { error: "A valid phone and actorType are required" };
    }
    try {
      const response = await issueOtp(body.actorType, body.phone, undefined, body.purpose);
      if (!response) {
        reply.code(400);
        return { error: "Failed to request OTP" };
      }
      if ("error" in response && typeof response.error === "string") {
        const statusCode = response.error.includes("Too many") ? 429 : 400;
        reply.code(statusCode);
        return { error: response.error };
      }
      return response;
    } catch (error) {
      logOtpFailure("route", error, {
        path: "/v1/auth/otp/request",
        actorType: body.actorType,
        phone: body.phone,
        purpose: body.purpose ?? null,
      });
      reply.code(500);
      return {
        error: isProduction()
          ? "Unexpected server error"
          : error instanceof Error
            ? error.message
            : "Unexpected server error",
      };
    }
  });

  app.post("/v1/auth/otp/verify", { schema: { body: bodyV1OtpVerify } }, async (request, reply) => {
    const body = (request.body ?? {}) as { phone?: string; code?: string; actorType?: unknown };
    if (!body.phone || !body.code || !isProductActorType(body.actorType)) {
      reply.code(400);
      return { error: "A valid phone, code, and actorType are required" };
    }

    try {
      const session = await resolveOtpSession(body.actorType, body.phone, body.code);
      if (!session) {
        reply.code(401);
        return { error: "Invalid OTP. Please try again." };
      }

      const issued = await issueSessionToken(session, body.actorType === "staff" ? "staff_otp" : "client_otp");
      if (!issued) {
        reply.code(401);
        return { error: "Profile not found" };
      }
      return issued;
    } catch (error) {
      reply.code(400);
      return { error: "Invalid OTP. Please try again." };
    }
  });

  app.post("/v1/pilot/invites", { schema: { body: bodyPilotInvite } }, async (request, reply) => {
    const suppliedSecret = request.headers["x-pilot-admin-secret"];
    if (!process.env.PILOT_ADMIN_SECRET || suppliedSecret !== process.env.PILOT_ADMIN_SECRET) {
      reply.code(403);
      return { error: "Forbidden" };
    }
    const body = (request.body ?? {}) as { phone?: string; email?: string | null };
    if (!body.phone || (body.email !== undefined && !isNullableEmail(body.email))) {
      reply.code(400);
      return { error: "A valid phone and email are required" };
    }
    const invite = await store.createPilotInvite({ phone: body.phone, email: body.email });
    if (!invite) {
      reply.code(400);
      return { error: "Invalid Pakistani mobile number" };
    }
    return { invite };
  });

  app.post("/v1/auth/staff/register", { schema: { body: bodyStaffRegister } }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      phone?: string;
      code?: string;
      displayName?: string;
      email?: string | null;
      firmName?: string;
      primaryCity?: string;
    };
    if (
      !isNonEmptyText(body.phone, 30) ||
      !/^\d{6}$/.test(body.code ?? "") ||
      !isNonEmptyText(body.displayName, 120) ||
      !isNonEmptyText(body.firmName, 160) ||
      !isNonEmptyText(body.primaryCity, 100) ||
      (body.email !== undefined && !isNullableEmail(body.email))
    ) {
      reply.code(400);
      return { error: "Invalid registration fields" };
    }
    try {
      const session = await store.registerInvitedSoloLawyer({
        phone: body.phone,
        code: body.code!,
        displayName: body.displayName,
        email: body.email ?? null,
        firmName: body.firmName,
        primaryCity: body.primaryCity,
      });
      if (!session) {
        reply.code(401);
        return { error: "Invalid OTP. Please try again." };
      }
      const issued = await issueSessionToken(session, "staff_otp");
      if (!issued) {
        reply.code(500);
        return { error: "Could not create workspace session" };
      }
      await store.recordSecurityEvent(
        session,
        "workspace.registered",
        "firm",
        session.firmId!,
        { primaryCity: body.primaryCity },
      );
      return issued;
    } catch (error) {
      reply.code(400);
      return { error: "Invalid OTP. Please try again." };
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    const verified = token ? verifyAppToken(token, getJwtSecret()) : null;
    if (verified?.sessionId) {
      await store.revokeSession(verified.sessionId);
    }
    reply.code(200);
    return { ok: true };
  });

  app.post("/auth/refresh", { schema: { body: bodyRefreshToken } }, async (request, reply) => {
    const refreshToken = readRefreshToken(request);
    if (!refreshToken) {
      reply.code(401);
      return { error: "Refresh token is required" };
    }

    const rotated = await store.rotateRefreshToken(refreshToken);
    if (!rotated) {
      reply.code(401);
      return { error: "Invalid refresh token" };
    }

    const issued = await issueTokenBundleForSessionRecord(rotated.session, {
      refreshToken: rotated.refreshToken,
      expiresAt: rotated.expiresAt,
    });
    if (!issued) {
      reply.code(401);
      return { error: "Profile not found" };
    }

    return issued;
  });

  app.post("/v1/auth/logout", async (request, reply) => app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: request.headers as Record<string, string>,
  }).then((response) => reply.code(response.statusCode).send(response.json())));

  app.post("/v1/auth/refresh", async (request, reply) => app.inject({
    method: "POST",
    url: "/auth/refresh",
    headers: request.headers as Record<string, string>,
    payload: request.body as Record<string, unknown>,
  }).then((response) => reply.code(response.statusCode).send(response.json())));

  app.get("/v1/me", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { profile: session.profile };
  });

  app.get("/sessions", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { sessions: await store.listSessions(session) };
  });

  app.get("/v1/sessions", async (request, reply) => {
    const session = await requireProductSession(request, reply, store);
    if (!session) {
      return { error: "Unauthorized" };
    }
    return { sessions: await store.listSessions(session) };
  });
}
