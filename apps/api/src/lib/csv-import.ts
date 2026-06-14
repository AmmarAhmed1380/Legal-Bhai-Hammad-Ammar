import { isIsoDateOrDateTime } from "./date-validation.js";

export interface MatterCsvRow {
  courtId: string;
  rawCaseNumber: string;
  title: string;
  matterType: "litigation" | "advisory" | "arbitration";
  stage: string;
  nextHearingAt: string | null;
}

export interface ValidatedMatterCsvRow {
  rowNumber: number;
  input: MatterCsvRow | null;
  error: string | null;
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field.trim());
      field = "";
    } else if (character === "\n") {
      record.push(field.trim());
      records.push(record);
      record = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field.trim());
    records.push(record);
  }
  return records.filter((row) => row.some(Boolean));
}

export function validateMatterCsv(csv: string): ValidatedMatterCsvRow[] {
  const [headerRow, ...rows] = parseCsvRecords(csv);
  if (!headerRow) {
    return [{ rowNumber: 1, input: null, error: "CSV is empty" }];
  }
  const headers = headerRow.map((header) => header.trim());
  const required = ["courtId", "rawCaseNumber", "title"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    return [{ rowNumber: 1, input: null, error: `Missing columns: ${missing.join(", ")}` }];
  }

  return rows.map((values, index) => {
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const errors: string[] = [];
    for (const field of required) {
      if (!row[field]?.trim()) {
        errors.push(`${field} is required`);
      }
    }
    const matterType = row.matterType || "litigation";
    if (!["litigation", "advisory", "arbitration"].includes(matterType)) {
      errors.push("matterType must be litigation, advisory, or arbitration");
    }
    if (row.nextHearingAt && !isIsoDateOrDateTime(row.nextHearingAt)) {
      errors.push("nextHearingAt must be a valid date");
    }
    return {
      rowNumber: index + 2,
      input:
        errors.length === 0
          ? {
              courtId: row.courtId,
              rawCaseNumber: row.rawCaseNumber,
              title: row.title,
              matterType: matterType as MatterCsvRow["matterType"],
              stage: row.stage || "new",
              nextHearingAt: row.nextHearingAt || null,
            }
          : null,
      error: errors.length > 0 ? errors.join("; ") : null,
    };
  });
}

export const MATTER_CSV_TEMPLATE =
  "courtId,rawCaseNumber,title,matterType,stage,nextHearingAt\n" +
  'ihc,W.P. 2076/2019,"Client v Federation",litigation,notice,2026-06-20\n';
