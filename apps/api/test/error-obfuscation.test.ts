import assert from "node:assert/strict";
import test from "node:test";

import { createFastifyServer, registerValidationErrorHandler } from "../src/lib/fastify-server.js";

test("production validation errors hide schema internals", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  app.post("/validated", {
    schema: {
      body: {
        type: "object",
        required: ["phone"],
        additionalProperties: false,
        properties: {
          phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" },
        },
      },
    },
  }, async () => ({ ok: true }));

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/validated",
      payload: { phone: "not-a-phone", unexpectedInternalField: "leak-me" },
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Invalid request payload" });
    assert.doesNotMatch(response.body, /unexpectedInternalField|additionalProperties|pattern|schema|stack/i);
  } finally {
    await app.close();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("production malformed JSON errors hide parser internals", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  app.post("/json", async () => ({ ok: true }));

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/json",
      headers: { "content-type": "application/json" },
      payload: "{\"broken\":",
    });
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "Bad request" });
    assert.doesNotMatch(response.body, /Unexpected|JSON|position|stack|FST_ERR/i);
  } finally {
    await app.close();
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
