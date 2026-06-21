import assert from "node:assert/strict";
import test from "node:test";

import { fetchCourtCauseList } from "../src/lib/court-sources.js";
import { fetchLhcRawalpindiCauseList } from "../src/lib/lhc-rawalpindi.js";
import { fetchRawalpindiDistrictCauseList } from "../src/lib/rwp-district.js";

test("production LHC Rawalpindi fetch fails closed instead of ingesting fixture data", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "production";
  globalThis.fetch = async () => {
    throw new Error("provider unavailable");
  };

  try {
    await assert.rejects(() => fetchLhcRawalpindiCauseList("regular", "2026-07-15"), /provider unavailable/);
    await assert.rejects(() => fetchCourtCauseList("source-lhc-rwp", "regular", "2026-07-15"), /provider unavailable/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    globalThis.fetch = previousFetch;
  }
});

test("production Rawalpindi District fetch fails closed instead of ingesting fixture data", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFetch = globalThis.fetch;
  process.env.NODE_ENV = "production";
  globalThis.fetch = async () => {
    throw new Error("provider unavailable");
  };

  try {
    await assert.rejects(() => fetchRawalpindiDistrictCauseList("regular", "2026-07-15"), /provider unavailable/);
    await assert.rejects(() => fetchCourtCauseList("source-rwp-district", "regular", "2026-07-15"), /provider unavailable/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    globalThis.fetch = previousFetch;
  }
});
