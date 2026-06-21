const CASE_TYPE_ALIASES: Array<[RegExp, string]> = [
  [/\bW\.?\s*P\.?\b/g, "WRIT PETITION"],
  [/\bC\.?\s*R\.?\b/g, "CIVIL REVISION"],
  [/\bC\.?\s*S\.?\b/g, "CIVIL SUIT"],
  [/\bF\.?\s*A\.?\b/g, "FAMILY APPEAL"],
  [/\bCrl\.?\s*Rev(?:ision)?\.?\b/gi, "CRIMINAL REVISION"],
  [/\bCrl\.?\s*Appeal\b/gi, "CRIMINAL APPEAL"],
  [/\bCriminal\s+Revision\b/gi, "CRIMINAL REVISION"],
  [/\bCivil\s+Suit\b/gi, "CIVIL SUIT"],
  [/\bFamily\s+Suit\b/gi, "FAMILY SUIT"],
];

export function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripHtml(input: string): string {
  return decodeHtml(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normalizeLabel(label: string): string {
  let normalized = label
    .toUpperCase()
    .replace(/[,:]/g, " ")
    .replace(/\bNO\.?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [pattern, replacement] of CASE_TYPE_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

export function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripHtml(cell[1])))
    .filter((cells) => cells.length > 0);
}

export function isHeaderRow(cells: string[]): boolean {
  const labels = new Set(cells.map((cell) => cell.toLowerCase().replace(/\s+/g, " ").trim()));
  return (
    (labels.has("case no") || labels.has("case number") || labels.has("case no.")) &&
    (labels.has("parties") || labels.has("party")) &&
    (labels.has("advocates") || labels.has("advocate"))
  );
}

const CASE_NUMBER_PATTERN = /[A-Z][A-Z .&()/'-]+?\s*\.?\s*(?:NO\.?\s*)?\d+\s*(?:\/|\bOF\b)\s*\d{4}/i;

export function normalizeCaseNumberCandidate(input: string): string {
  return stripHtml(input)
    .replace(/\.No\./gi, " ")
    .replace(/\bNo\./gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCaseCell(cells: string[]): string | null {
  return cells.find((cell) => CASE_NUMBER_PATTERN.test(normalizeCaseNumberCandidate(cell))) ?? null;
}

export function normalizeGenericCourtCaseNumber(input: string): string {
  const text = normalizeCaseNumberCandidate(input)
    .replace(/\s+OF\s+/gi, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  const matches = [...text.matchAll(/([A-Z][A-Z .&()/'-]+?)\s*\.?\s*(\d+)\s*\/\s*(\d{4})/gi)];
  const match = matches.at(-1);
  if (!match) {
    return normalizeLabel(text);
  }

  const [, rawLabel, number, year] = match;
  return `${normalizeLabel(rawLabel)} ${number}/${year}`;
}

export function isoDateToDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    throw new Error("List date must use YYYY-MM-DD");
  }
  return `${day}/${month}/${year}`;
}

export function todayInPakistanIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

export function extractHiddenFormFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input[^>]*>/gi)) {
    const tag = match[0];
    const type = tag.match(/type="([^"]+)"/i)?.[1]?.toLowerCase() ?? "text";
    if (type === "submit" || type === "button" || type === "image" || type === "file") {
      continue;
    }
    const name = tag.match(/name="([^"]+)"/i)?.[1];
    if (!name) {
      continue;
    }
    fields[name] = tag.match(/value="([^"]*)"/i)?.[1] ?? "";
  }
  return fields;
}

export function findInputNameMatching(html: string, pattern: RegExp): string | null {
  for (const match of html.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/gi)) {
    if (pattern.test(match[1])) {
      return match[1];
    }
  }
  return null;
}

export function findSubmitControlName(html: string): string | null {
  for (const match of html.matchAll(/<input[^>]*type="(?:submit|button)"[^>]*>/gi)) {
    const tag = match[0];
    const name = tag.match(/name="([^"]+)"/i)?.[1];
    const value = tag.match(/value="([^"]*)"/i)?.[1] ?? "";
    if (name && /view|search|submit|show|go/i.test(value)) {
      return name;
    }
  }
  return null;
}
