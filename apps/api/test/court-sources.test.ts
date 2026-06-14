import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  fetchCourtCauseList,
  normalizeCourtCaseNumber,
  parseLhcRawalpindiCauseList,
  parseRawalpindiDistrictCauseList,
} from "../src/lib/court-sources.js";

const fixtureDir = join(process.cwd(), "test", "fixtures");

test("LHC Rawalpindi parser keeps only Rawalpindi Bench cause-list rows", () => {
  const html = readFileSync(join(fixtureDir, "source-lhc-rwp-2026-07-15-regular.html"), "utf8");
  const rows = parseLhcRawalpindiCauseList(html, { listDate: "2026-07-15", listType: "regular" });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].courtId, "lhc-rawalpindi-bench");
  assert.equal(rows[0].normalizedCaseNumber, "WRIT PETITION 501/2026");
  assert.match(rows[0].bench ?? "", /Justice/i);
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

test("court-specific normalization handles IHC and Rawalpindi aliases", () => {
  assert.equal(normalizeCourtCaseNumber("ihc", "W.P. 901/2026"), "WRIT PETITION 901/2026");
  assert.equal(normalizeCourtCaseNumber("rwp-civil-courts", "Civil Suit No. 112 of 2026"), "CIVIL SUIT 112/2026");
  assert.equal(normalizeCourtCaseNumber("rwp-criminal-magisterial", "Crl. Rev. 77/2026"), "CRIMINAL REVISION 77/2026");
});

test("fixture-backed court source fetch works offline for Rawalpindi District", async () => {
  const causeList = await fetchCourtCauseList("source-rwp-district", "regular", "2026-07-15");

  assert.equal(causeList.source.id, "source-rwp-district");
  assert.equal(causeList.listDate, "2026-07-15");
  assert.equal(causeList.rows.length, 3);
});
