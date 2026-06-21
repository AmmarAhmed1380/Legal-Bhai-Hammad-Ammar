import assert from "node:assert/strict";
import test from "node:test";

import {
  checkTwilioVerification,
  isTwilioVerifyConfigured,
  sendTwilioVerification,
} from "../src/lib/twilio-verify.js";

test("Twilio Verify sends and checks OTP with predefined templates", async () => {
  const previous = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  try {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VAtest";

    assert.equal(isTwilioVerifyConfigured(), true);

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/Verifications")) {
        return new Response(JSON.stringify({ sid: "VEtest" }), { status: 201 });
      }
      if (url.includes("/VerificationCheck")) {
        return new Response(JSON.stringify({ status: "approved" }), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    };

    assert.deepEqual(await sendTwilioVerification("03001234567"), { providerId: "VEtest" });
    assert.equal(await checkTwilioVerification("03001234567", "123456"), true);
    assert.ok(calls.some((url) => url.includes("/Services/VAtest/Verifications")));
    assert.ok(calls.some((url) => url.includes("/Services/VAtest/VerificationCheck")));
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

test("Twilio Verify auto-discovers an existing service when SID is not configured", async () => {
  const previous = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
  const originalFetch = globalThis.fetch;

  try {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    delete process.env.TWILIO_VERIFY_SERVICE_SID;

    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/Services?PageSize=20")) {
        return new Response(JSON.stringify({ services: [{ sid: "VAdiscovered" }] }), { status: 200 });
      }
      if (url.includes("/Verifications")) {
        return new Response(JSON.stringify({ sid: "VEtest" }), { status: 201 });
      }
      return new Response("unexpected", { status: 500 });
    };

    assert.deepEqual(await sendTwilioVerification("03001234567"), { providerId: "VEtest" });
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
