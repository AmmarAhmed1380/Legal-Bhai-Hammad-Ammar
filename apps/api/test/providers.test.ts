import assert from "node:assert/strict";
import test from "node:test";

import { createEmailProvider, createSmsProvider } from "../src/lib/providers.js";

test("Twilio and Resend adapters return provider IDs and surface provider failures", async () => {
  const previous = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };
  const originalFetch = globalThis.fetch;

  try {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_SMS_FROM = "+15555550100";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "pilot@legalbahi.test";

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("api.twilio.com")) {
        return new Response(JSON.stringify({ sid: "SM-test" }), { status: 201 });
      }
      return new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
    };

    assert.deepEqual(await createSmsProvider().send("03001234567", "OTP"), { providerId: "SM-test" });
    assert.deepEqual(await createEmailProvider().send("pilot@example.test", "Subject", "<p>Body</p>"), { providerId: "email-test" });

    globalThis.fetch = async () => new Response("provider unavailable", { status: 503 });
    await assert.rejects(() => createSmsProvider().send("03001234567", "OTP"), /Twilio SMS failed with status 503/);
    await assert.rejects(() => createEmailProvider().send("pilot@example.test", "Subject", "<p>Body</p>"), /Resend email failed with status 503/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
