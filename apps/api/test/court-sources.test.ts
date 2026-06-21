import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  fetchCourtCauseList,
  normalizeCourtCaseNumber,
} from "../src/lib/court-sources.js";
import { fetchLhcRawalpindiCauseList, parseLhcRawalpindiCauseList } from "../src/lib/lhc-rawalpindi.js";
import { fetchRawalpindiDistrictCauseList, parseRawalpindiDistrictCauseList } from "../src/lib/rwp-district.js";

const fixtureDir = join(process.cwd(), "test", "fixtures");
const previousLiveFlag = process.env.COURT_LIVE_FETCH_ENABLED;
const previousNodeEnv = process.env.NODE_ENV;

test.before(() => {
  process.env.COURT_LIVE_FETCH_ENABLED = "false";
  process.env.NODE_ENV = "test";
});

test.after(() => {
  if (previousLiveFlag === undefined) {
    delete process.env.COURT_LIVE_FETCH_ENABLED;
  } else {
    process.env.COURT_LIVE_FETCH_ENABLED = previousLiveFlag;
  }
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("court-specific normalization handles IHC and Rawalpindi aliases", () => {
  assert.equal(normalizeCourtCaseNumber("ihc", "W.P. 901/2026"), "WRIT PETITION 901/2026");
  assert.equal(normalizeCourtCaseNumber("rwp-civil-courts", "Civil Suit No. 112 of 2026"), "CIVIL SUIT 112/2026");
  assert.equal(normalizeCourtCaseNumber("rwp-criminal-magisterial", "Crl. Rev. 77/2026"), "CRIMINAL REVISION 77/2026");
});

test("fixture-backed court source fetch works offline for Rawalpindi District via registry", async () => {
  const causeList = await fetchCourtCauseList("source-rwp-district", "regular", "2026-07-15");

  assert.equal(causeList.source.id, "source-rwp-district");
  assert.equal(causeList.listDate, "2026-07-15");
  assert.equal(causeList.rows.length, 3);
});

test("LHC Rawalpindi parser keeps only Rawalpindi Bench cause-list rows", () => {
  const html = readFileSync(join(fixtureDir, "source-lhc-rwp-2026-07-15-regular.html"), "utf8");
  const rows = parseLhcRawalpindiCauseList(html, { listDate: "2026-07-15", listType: "regular" });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].courtId, "lhc-rawalpindi-bench");
  assert.equal(rows[0].normalizedCaseNumber, "WRIT PETITION 501/2026");
  assert.match(rows[0].bench ?? "", /Justice/i);
});

test("LHC Rawalpindi parser follows bench header rows on live-style HTML", () => {
  const html = readFileSync(join(fixtureDir, "source-lhc-rwp-live-format-regular.html"), "utf8");
  const rows = parseLhcRawalpindiCauseList(html, { listDate: "2026-07-15", listType: "regular" });

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.courtId === "lhc-rawalpindi-bench"));
  assert.ok(rows.some((row) => row.normalizedCaseNumber === "WRIT PETITION 501/2026"));
  assert.ok(rows.some((row) => row.normalizedCaseNumber === "CIVIL REVISION 88/2026"));
});

test("Rawalpindi District parser classifies civil, family, and criminal rows", () => {
  const html = readFileSync(join(fixtureDir, "source-rwp-district-2026-07-15-regular.html"), "utf8");
  const rows = parseRawalpindiDistrictCauseList(html, { listDate: "2026-07-15", listType: "regular" });

  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.courtId).sort(), [
    "rwp-civil-courts",
    "rwp-criminal-magisterial",
    "rwp-family-courts",
  ]);
  assert.ok(rows.some((row) => row.normalizedCaseNumber === "CRIMINAL REVISION 77/2026"));
  assert.ok(rows.every((row) => row.confidence === 1));
});

test("Rawalpindi District parser rejects unusable HTML instead of returning silent empty data", () => {
  assert.throws(
    () => parseRawalpindiDistrictCauseList("<html><body><p>Maintenance</p></body></html>", {
      listDate: "2026-07-15",
      listType: "regular",
    }),
    /does not resemble a cause list page/,
  );
});

test("fixture-backed court source fetch works offline for Rawalpindi District", async () => {
  const causeList = await fetchRawalpindiDistrictCauseList("regular", "2026-07-15");

  assert.equal(causeList.listDate, "2026-07-15");
  assert.equal(causeList.rows.length, 3);
  assert.match(causeList.sourceUrl, /rawalpindi\.dc\.lhc\.gov\.pk/);
});

test("fixture-backed court source fetch works offline for LHC Rawalpindi", async () => {
  const causeList = await fetchLhcRawalpindiCauseList("regular", "2026-07-15");

  assert.equal(causeList.listDate, "2026-07-15");
  assert.equal(causeList.rows.length, 1);
  assert.match(causeList.sourceUrl, /data\.lhc\.gov\.pk/);
});

test("LHC Rawalpindi live fetch uses mocked HTML in development when enabled", async () => {
  const previousFlag = process.env.COURT_LIVE_FETCH_ENABLED;
  const previousFetch = globalThis.fetch;
  process.env.COURT_LIVE_FETCH_ENABLED = "true";
  globalThis.fetch = async () =>
    new Response(readFileSync(join(fixtureDir, "source-lhc-rwp-live-format-regular.html"), "utf8"), {
      status: 200,
      headers: { "content-type": "text/html" },
    });

  try {
    const causeList = await fetchLhcRawalpindiCauseList("regular", "2026-07-15");
    assert.equal(causeList.rows.length, 2);
  } finally {
    process.env.COURT_LIVE_FETCH_ENABLED = previousFlag;
    globalThis.fetch = previousFetch;
  }
});

test("Rawalpindi District live fetch uses mocked ASP.NET POST flow when enabled", async () => {
  const previousFlag = process.env.COURT_LIVE_FETCH_ENABLED;
  const previousFetch = globalThis.fetch;
  process.env.COURT_LIVE_FETCH_ENABLED = "true";
  const landingHtml = `
    <html><body><form>
      <input type="hidden" name="__VIEWSTATE" value="abc" />
      <input type="hidden" name="__EVENTVALIDATION" value="def" />
      <input type="text" name="ctl00$ContentPlaceHolder1$txtDate" value="" />
      <input type="submit" name="ctl00$ContentPlaceHolder1$btnView" value="View" />
    </form></body></html>`;
  const resultHtml = readFileSync(join(fixtureDir, "source-rwp-district-2026-07-15-regular.html"), "utf8");
  let callCount = 0;
  globalThis.fetch = async (_input, init) => {
    callCount += 1;
    if (init?.method === "POST") {
      return new Response(resultHtml, { status: 200, headers: { "content-type": "text/html" } });
    }
    return new Response(landingHtml, { status: 200, headers: { "content-type": "text/html" } });
  };

  try {
    const causeList = await fetchRawalpindiDistrictCauseList("regular", "2026-07-15");
    assert.equal(causeList.rows.length, 3);
    assert.ok(callCount >= 2);
  } finally {
    process.env.COURT_LIVE_FETCH_ENABLED = previousFlag;
    globalThis.fetch = previousFetch;
  }
});
