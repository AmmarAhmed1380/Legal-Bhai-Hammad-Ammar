import assert from "node:assert/strict";
import test from "node:test";

import { fetchIhcCauseList } from "../src/lib/ihc.js";

test("production IHC fetch fails closed instead of ingesting fixture data", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "production";
  globalThis.fetch = async () => {
    throw new Error("provider unavailable");
  };

  try {
    await assert.rejects(() => fetchIhcCauseList("regular", "2026-06-15"), /provider unavailable/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    globalThis.fetch = previousFetch;
  }
});
