import { timingSafeEqual } from "node:crypto";

import type { FastifyRequest } from "fastify";

import { readBearerToken } from "../lib/auth.js";
import type { ProductRouteContext } from "./context.js";

function uptimeSecretMatches(request: FastifyRequest, configuredSecret: string): boolean {
  const token = readBearerToken(request.headers.authorization);
  if (!token) {
    return false;
  }
  const expected = Buffer.from(configuredSecret, "utf8");
  const received = Buffer.from(token, "utf8");
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

export function registerHealthRoutes(ctx: ProductRouteContext): void {
  ctx.app.get("/v1/health/uptime", async (request, reply) => {
    const configuredSecret = process.env.UPTIME_SECRET?.trim();
    if (!configuredSecret) {
      reply.code(503);
      return { error: "Uptime monitoring is not configured" };
    }
    if (!uptimeSecretMatches(request, configuredSecret)) {
      reply.code(401);
      return { error: "Unauthorized" };
    }

    const databaseReady = await ctx.store.healthCheck();
    reply.code(databaseReady ? 200 : 503);
    return {
      ok: databaseReady,
      database: databaseReady,
      checkedAt: new Date().toISOString(),
    };
  });
}
