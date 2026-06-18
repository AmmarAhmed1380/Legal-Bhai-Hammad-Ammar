export interface IhcCauseListRow {
  court: string;
  judgeNames: string;
  caseNumber: string;
  caseStage: string;
  parties: string;
  advocates: string;
}

interface IhcCourtMetadata {
  TODAY: string;
  NEXTDATE: string;
  FRIDAY: string;
  SATURDAY: string;
  SUNDAY: string;
}

interface IhcServiceRow {
  CASESNO: number | string;
  COURTNAME: string;
  BENCHNAME: string;
  CASENAME: string;
  CASENO: number | string;
  CASEYEAR: number | string;
  CASESTAGENAME: string;
  PARTY: string;
  PARTY1: string;
  ADV1: string;
  ADV2: string;
  MDATE: string;
  MATTERNAME_ALIAS: string | null;
  CMS_IN_CASE: string | null;
  FLAG: string;
}

const IHC_BASE_URL = "https://mis.ihc.gov.pk";
export type IhcCauseListType = "regular" | "supplementary" | "urgent";
export const IHC_CAUSE_LIST_TYPE_CODES: Record<IhcCauseListType, number> = {
  regular: 4,
  supplementary: 2,
  urgent: 3,
};

const CASE_TYPE_ALIASES: Array<[RegExp, string]> = [
  [/\bW\.?\s*P\.?\b/g, "WRIT PETITION"],
  [/\bW\s+P\b/g, "WRIT PETITION"],
  [/\bI\.?\s*C\.?\s*A\.?\b/g, "INTRA COURT APPEAL"],
  [/\bC\.?\s*R\.?\s*P\.?\b/g, "CIVIL REVISION PETITION"],
  [/\bC\.?\s*P\.?\b/g, "CIVIL PETITION"],
  [/\bCRL\.?\s*APPEAL\b/g, "CRIMINAL APPEAL"],
  [/\bCRL\.?\s*REVISION\b/g, "CRIMINAL REVISION"],
  [/\bCRL\.?\s*MISC(?:ELLANEOUS)?\.?\b/g, "CRIMINAL MISCELLANEOUS"],
  [/\bCIVIL\s+MISC(?:ELLANEOUS)?\.?\b/g, "CIVIL MISCELLANEOUS"],
  [/\bS\.?\s*T\.?\s*R\.?\b/g, "SALES TAX REFERENCE"],
  [/\bCUSTOMS?\s+REF(?:ERENCE)?\.?\b/g, "CUSTOM REFERENCE"],
];

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(input: string): string {
  return decodeHtml(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function escapeHtml(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeLabel(label: string): string {
  let normalized = label
    .toUpperCase()
    .replace(/[,:]/g, " ")
    .replace(/\s+NO\.?\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of CASE_TYPE_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .replace(/\s+/g, " ")
    .replace(/\s+\.\s+/g, " ")
    .trim();
}

function extractCaseCandidate(input: string): string {
  const text = stripHtml(input);
  if (!text) {
    return "";
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const caseLinePattern = /[A-Z][A-Z .&()/'-]+?\s*\.?\s*\d+\s*(?:\/|\bOF\b)\s*\d{4}/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^IN$/i.test(lines[index])) {
      for (let candidateIndex = index + 1; candidateIndex < lines.length; candidateIndex += 1) {
        if (caseLinePattern.test(lines[candidateIndex])) {
          return lines[candidateIndex];
        }
      }
    }
  }

  for (const line of lines) {
    if (caseLinePattern.test(line)) {
      return line;
    }
  }

  return text;
}

export function normalizeIhcCaseNumber(input: string): string {
  const candidate = extractCaseCandidate(input)
    .replace(/\s+OF\s+/gi, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  const matches = [...candidate.matchAll(/([A-Z][A-Z .&()/'-]+?)\s*\.?\s*(\d+)\s*\/\s*(\d{4})/gi)];
  const match = matches.at(-1);

  if (!match) {
    return normalizeLabel(candidate);
  }

  const [, rawLabel, number, year] = match;
  return `${normalizeLabel(rawLabel)} ${number}/${year}`;
}

function renderCaseCell(row: IhcServiceRow): string {
  const caseLine = `${escapeHtml(row.CASENAME)}. ${escapeHtml(String(row.CASENO))}/${escapeHtml(String(row.CASEYEAR))}`;
  const matterLine = escapeHtml(row.MATTERNAME_ALIAS);
  const cmsLine = decodeHtml(row.CMS_IN_CASE ?? "");

  if (row.FLAG === "T" && cmsLine.trim()) {
    return `${cmsLine}<br />in<br />${caseLine}${matterLine ? `<br />${matterLine}` : ""}`;
  }

  return `${caseLine}${matterLine ? `<br />${matterLine}` : ""}${cmsLine.trim() ? `<br />${cmsLine}` : ""}`;
}

function renderPartiesCell(row: IhcServiceRow): string {
  return `${escapeHtml(row.PARTY)}<br /><b>Vs</b><br />${escapeHtml(row.PARTY1)}`;
}

function renderAdvocatesCell(row: IhcServiceRow): string {
  return `${escapeHtml(row.ADV1)}<br /><b>&amp;</b><br />${escapeHtml(row.ADV2)}`;
}

function parseServiceResponse<T>(payload: { d?: string }): T[] {
  if (!payload.d) {
    return [];
  }

  const parsed = JSON.parse(payload.d) as unknown;
  return Array.isArray(parsed) ? parsed as T[] : [];
}

async function postIhcJson<T>(path: string, body: Record<string, unknown> = {}): Promise<T[]> {
  const response = await fetch(`${IHC_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "Legal Bhai-Pilot/1.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`IHC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { d?: string };
  return parseServiceResponse<T>(payload);
}

async function resolveRegularCauseListDate(): Promise<string> {
  const metadata = await postIhcJson<IhcCourtMetadata>("/ihc.asmx/Crt_GA");
  const current = metadata[0];
  if (!current) {
    throw new Error("IHC court metadata response was empty");
  }

  if ([current.FRIDAY, current.SATURDAY, current.SUNDAY].includes(current.TODAY)) {
    return current.NEXTDATE;
  }

  return current.TODAY;
}

function toIhcDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    throw new Error("IHC list date must use YYYY-MM-DD");
  }
  return `${day}/${month}/${year}`;
}

function fromIhcDate(ihcDate: string): string {
  const [day, month, year] = ihcDate.split("/");
  if (!year || !month || !day) {
    throw new Error("IHC returned an invalid list date");
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function fetchIhcCauseListRows(date: string, listType: IhcCauseListType): Promise<IhcServiceRow[]> {
  return postIhcJson<IhcServiceRow>("/ihc.asmx/get_IHC_All_Causelist", {
    _params: {
      PSDATE: date,
      PEDATE: date,
      pCrt: "0",
      pBnch: 0,
      PBENCHNAMECODE: 0,
      pStg: 0,
      CaseNo: 0,
      PartyName: "",
      LawyerName: "",
      pType: IHC_CAUSE_LIST_TYPE_CODES[listType],
      PCASEGROUPID: 5,
      PISMYLST: 0,
      PUSERID: 0,
      PCIRCUITCODE: "1",
    },
  });
}

export function renderIhcCauseListHtml(rows: IhcServiceRow[]): string {
  const bodyRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(String(row.CASESNO ?? ""))}</td>
          <td>${escapeHtml(row.COURTNAME)}</td>
          <td>${escapeHtml(row.BENCHNAME)}</td>
          <td>${renderCaseCell(row)}</td>
          <td>${escapeHtml(row.CASENAME)}</td>
          <td>${escapeHtml(row.CASESTAGENAME)}</td>
          <td>${renderPartiesCell(row)}</td>
          <td>${renderAdvocatesCell(row)}</td>
          <td>${escapeHtml(row.MDATE)}</td>
        </tr>
      `,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>IHC Cause List Snapshot</title>
  </head>
  <body>
    <table id="tblCseHstry">
      <thead>
        <tr>
          <th>Sr #</th>
          <th>Court</th>
          <th>Respected Judge(s)</th>
          <th>Case No</th>
          <th>Code</th>
          <th>Case Stage</th>
          <th>Parties</th>
          <th>Advocates</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  </body>
</html>`;
}

export function parseIhcCauseList(html: string): IhcCauseListRow[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const parsed: IhcCauseListRow[] = [];

  for (const match of rows) {
    const cellMatches = [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    const cells = cellMatches.map((cellMatch) => stripHtml(cellMatch[1]));

    if (cells.length < 9) {
      continue;
    }

    if (cells.join(" ").toLowerCase().includes("respected judge")) {
      continue;
    }

    const rawCaseCellHtml = cellMatches[3]?.[1] ?? "";
    const caseNumber = normalizeIhcCaseNumber(rawCaseCellHtml);
    if (!caseNumber) {
      continue;
    }

    parsed.push({
      court: cells[1] ?? "",
      judgeNames: cells[2] ?? "",
      caseNumber,
      caseStage: cells[5] ?? "",
      parties: cells[6] ?? "",
      advocates: cells[7] ?? "",
    });
  }

  return parsed;
}

export async function fetchIhcCauseList(
  listType: IhcCauseListType = "regular",
  requestedIsoDate?: string,
): Promise<{ html: string; listDate: string }> {
  if (process.env.NODE_ENV !== "production" && process.env.IHC_LIVE_FETCH_ENABLED !== "true") {
    return {
      html: readFileSync(fileURLToPath(new URL("../../test/fixtures/ihc-2026-04-20-regular.html", import.meta.url)), "utf8"),
      listDate: requestedIsoDate ?? "2026-04-20",
    };
  }
  try {
    const ihcDate = requestedIsoDate ? toIhcDate(requestedIsoDate) : await resolveRegularCauseListDate();
    const rows = await fetchIhcCauseListRows(ihcDate, listType);
    return { html: renderIhcCauseListHtml(rows), listDate: requestedIsoDate ?? fromIhcDate(ihcDate) };
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    return {
      html: readFileSync(fileURLToPath(new URL("../../test/fixtures/ihc-2026-04-20-regular.html", import.meta.url)), "utf8"),
      listDate: requestedIsoDate ?? "2026-04-20",
    };
  }
}

export async function fetchIhcCauseListHtml(): Promise<string> {
  return (await fetchIhcCauseList()).html;
}
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
