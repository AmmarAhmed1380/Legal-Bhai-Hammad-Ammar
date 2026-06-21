import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFastifyServer, registerValidationErrorHandler } from "../src/lib/fastify-server.js";
import { registerProductRoutes } from "../src/lib/product-api.js";
import { createProductStore } from "../src/lib/product-store.js";

test("Fastify schemas reject unknown body fields with 400", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-route-validation-"));
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-validation-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  registerProductRoutes(app, store);

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/request",
      payload: {
        phone: "03001234567",
        actorType: "staff",
        injectedField: "malicious",
      },
    });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.parse(response.body).error, /Invalid request payload/i);
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

test("Fastify schemas reject script tags in text fields", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-route-script-validation-"));
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-validation-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  registerProductRoutes(app, store);

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/staff/register",
      payload: {
        phone: "03001234567",
        code: "246810",
        displayName: '<script>alert("x")</script>',
        firmName: "Hassan & Co",
        primaryCity: "Islamabad",
      },
    });
    assert.equal(response.statusCode, 400);
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

test("Fastify schemas reject invalid OTP code shape", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-route-otp-validation-"));
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "route-validation-test-secret";
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "twilio-test-token";
  process.env.TWILIO_SMS_FROM = "+15555550100";

  const store = createProductStore(join(tempDir, "product.sqlite"));
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  registerProductRoutes(app, store);

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/otp/verify",
      payload: {
        phone: "03001234567",
        code: "not-a-code",
        actorType: "staff",
      },
    });
    assert.equal(response.statusCode, 400);
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
