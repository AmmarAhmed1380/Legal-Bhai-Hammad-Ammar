import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFastifyServer, registerValidationErrorHandler } from "../src/lib/fastify-server.js";
import { registerProductRoutes } from "../src/lib/product-api.js";
import { createProductStore } from "../src/lib/product-store.js";

const UPTIME_SECRET = "n7U8pQ5rT2vW9xY4zA6bC1dE3fG8hJ0kL";

test("uptime health probe requires bearer token and reports database readiness", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-uptime-health-"));
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
    UPTIME_SECRET: process.env.UPTIME_SECRET,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-security-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";
  process.env.UPTIME_SECRET = UPTIME_SECRET;

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  registerProductRoutes(app, store);

  try {
    await app.ready();

    const missingToken = await app.inject({ method: "GET", url: "/v1/health/uptime" });
    assert.equal(missingToken.statusCode, 401);

    const invalidToken = await app.inject({
      method: "GET",
      url: "/v1/health/uptime",
      headers: { authorization: "Bearer wrong-secret" },
    });
    assert.equal(invalidToken.statusCode, 401);

    const healthy = await app.inject({
      method: "GET",
      url: "/v1/health/uptime",
      headers: { authorization: `Bearer ${UPTIME_SECRET}` },
    });
    assert.equal(healthy.statusCode, 200);
    assert.deepEqual(JSON.parse(healthy.body), {
      ok: true,
      database: true,
      checkedAt: JSON.parse(healthy.body).checkedAt,
    });
    assert.match(JSON.parse(healthy.body).checkedAt, /^\d{4}-\d{2}-\d{2}T/);
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

test("uptime health probe returns 503 when secret is not configured", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-uptime-unconfigured-"));
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
    UPTIME_SECRET: process.env.UPTIME_SECRET,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-security-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";
  delete process.env.UPTIME_SECRET;

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  registerProductRoutes(app, store);

  try {
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/health/uptime",
      headers: { authorization: "Bearer anything" },
    });
    assert.equal(response.statusCode, 503);
    assert.match(JSON.parse(response.body).error, /not configured/i);
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
