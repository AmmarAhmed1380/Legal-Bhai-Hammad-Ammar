import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFastifyServer, registerValidationErrorHandler } from "../src/lib/fastify-server.js";
import { registerProductRoutes } from "../src/lib/product-api.js";
import { createProductStore } from "../src/lib/product-store.js";

const PUBLIC_MUTABLE_ROUTES = new Set([
  "POST /auth/client/otp/request",
  "POST /auth/client/otp/verify",
  "POST /auth/logout",
  "POST /auth/staff/magic-link/request",
  "POST /auth/staff/otp/request",
  "POST /auth/staff/otp/verify",
  "POST /portal/otp",
  "POST /portal/otp/verify",
  "POST /v1/auth/logout",
  "POST /v1/auth/otp/request",
  "POST /v1/auth/otp/verify",
  "POST /v1/auth/staff/register",
  "POST /v1/portal/otp",
  "POST /v1/portal/otp/verify",
]);

function requestPath(routePath: string): string {
  return routePath.replaceAll(/:[^/]+/g, "missing-record");
}

test("every mutable product route is authentication-protected or explicitly public", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-route-security-"));
  const previousEnv = {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-security-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  const mutableRoutes = new Map<string, { method: string; path: string }>();
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        mutableRoutes.set(`${method} ${route.url}`, { method, path: route.url });
      }
    }
  });
  registerProductRoutes(app, store);

  try {
    await app.ready();
    for (const [key, route] of mutableRoutes) {
      if (PUBLIC_MUTABLE_ROUTES.has(key)) {
        continue;
      }
      const response = await app.inject({
        method: route.method as "POST" | "PUT" | "PATCH" | "DELETE",
        url: requestPath(route.path),
      });
      assert.ok(
        response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 403,
        `${key} returned ${response.statusCode} without authentication`,
      );
    }

    for (const publicRoute of PUBLIC_MUTABLE_ROUTES) {
      assert.ok(mutableRoutes.has(publicRoute), `Stale public-route classification: ${publicRoute}`);
    }
  } finally {
    await app.close();
    store.close();
    rmSync(tempDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
