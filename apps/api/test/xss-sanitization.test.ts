import assert from "node:assert/strict";
import test from "node:test";

import { createFastifyServer, registerValidationErrorHandler } from "../src/lib/fastify-server.js";
import { sanitizeInput, sanitizePlainText } from "../src/lib/input-sanitizer.js";

test("sanitizePlainText strips HTML tags, event handlers, and script bodies", () => {
  assert.equal(
    sanitizePlainText('Client <b>note</b><img src=x onerror="alert(1)"><script>alert("x")</script>'),
    "Client note",
  );
});

test("sanitizeInput recursively sanitizes JSON string fields", () => {
  assert.deepEqual(sanitizeInput({
    title: "<b>Redtone</b>",
    nested: { notes: '<a href="javascript:alert(1)">Open</a>' },
    tags: ["<i>urgent</i>"],
  }), {
    title: "Redtone",
    nested: { notes: "Open" },
    tags: ["urgent"],
  });
});

test("Fastify request sanitization stores clean string fields", async () => {
  const app = createFastifyServer();
  registerValidationErrorHandler(app);
  const persisted: Array<{ title: string; notes: string }> = [];

  app.addHook("preValidation", async (request) => {
    if (request.body !== undefined) {
      (request as typeof request & { body: unknown }).body = sanitizeInput(request.body);
    }
  });
  app.post("/test-notes", {
    schema: {
      body: {
        type: "object",
        required: ["title", "notes"],
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  }, async (request) => {
    persisted.push(request.body as { title: string; notes: string });
    return { stored: persisted.at(-1) };
  });

  try {
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/test-notes",
      payload: {
        title: "<b>Order passed</b>",
        notes: 'Client <strong>updated</strong><img src=x onerror="alert(1)"><script>alert("x")</script>',
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { stored: { title: "Order passed", notes: "Client updated" } });
    assert.deepEqual(persisted, [{ title: "Order passed", notes: "Client updated" }]);
  } finally {
    await app.close();
  }
});
