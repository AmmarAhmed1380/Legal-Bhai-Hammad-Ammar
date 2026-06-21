import {
  extractHiddenFormFields,
  findCaseCell,
  findInputNameMatching,
  findSubmitControlName,
  isHeaderRow,
  isoDateToDisplayDate,
  normalizeGenericCourtCaseNumber,
  stripHtml,
  tableRows,
  todayInPakistanIso,
} from "./court-html.js";
import {
  fetchCourtHtml,
  isCourtLiveFetchEnabled,
  logCourtSourceWarning,
  readCourtFixture,
  withCourtFixtureFallback,
} from "./court-fetch.js";
import type { CourtCauseListEntry, CourtListType } from "./court-types.js";

const RWP_DISTRICT_CAUSE_LIST_URL = "https://rawalpindi.dc.lhc.gov.pk/PublicPages/CauseList.aspx";
const RWP_DISTRICT_RESULT_URL = "https://rawalpindi.dc.lhc.gov.pk/PublicPages/CauseListResult.aspx";

function classifyRawalpindiDistrictCourtId(normalized: string): string {
  if (/family/i.test(normalized)) {
    return "rwp-family-courts";
  }
  if (/criminal|magisterial|fir/i.test(normalized)) {
    return "rwp-criminal-magisterial";
  }
  if (/civil/i.test(normalized)) {
    return "rwp-civil-courts";
  }
  return "rwp-district-sessions";
}

export function looksLikeRawalpindiDistrictCauseListPage(html: string): boolean {
  if (!/<table/i.test(html)) {
    return false;
  }
  const text = stripHtml(html);
  return /(cause\s*list|case\s*no|judge|courtroom|rawalpindi|sessions)/i.test(text);
}

export function parseRawalpindiDistrictCauseList(
  html: string,
  options: { listDate: string; listType: CourtListType; sourceUrl?: string },
): CourtCauseListEntry[] {
  if (!looksLikeRawalpindiDistrictCauseListPage(html)) {
    throw new Error("Rawalpindi District parser received HTML that does not resemble a cause list page");
  }

  return tableRows(html).flatMap((cells) => {
    if (isHeaderRow(cells)) {
      return [];
    }
    const caseCell = findCaseCell(cells);
    if (!caseCell) {
      return [];
    }
    const normalized = normalizeGenericCourtCaseNumber(caseCell);
    const courtId = classifyRawalpindiDistrictCourtId(normalized);
    return [{
      courtId,
      rawCaseNumber: caseCell,
      normalizedCaseNumber: normalized,
      courtroom: cells.find((cell) => /court|room/i.test(cell)) ?? null,
      bench: cells.find((cell) => /judge|sessions|civil|family|magistrate/i.test(cell)) ?? null,
      parties: cells.find((cell) => /\b(vs|versus| v )\b/i.test(cell)) ?? null,
      advocates: cells.find((cell) => /advocate|counsel|lawyer/i.test(cell)) ?? null,
      sourceUrl: options.sourceUrl ?? RWP_DISTRICT_CAUSE_LIST_URL,
      confidence: 1,
    }];
  });
}

async function postAspNetCauseListForm(listDate: string): Promise<{ html: string; sourceUrl: string }> {
  const landingHtml = await fetchCourtHtml(RWP_DISTRICT_CAUSE_LIST_URL);
  const formFields = extractHiddenFormFields(landingHtml);
  const dateField =
    findInputNameMatching(landingHtml, /txtdate|date/i) ??
    findInputNameMatching(landingHtml, /ctl00.*date/i);
  if (dateField) {
    formFields[dateField] = isoDateToDisplayDate(listDate);
  }

  const submitField = findSubmitControlName(landingHtml);
  if (submitField) {
    formFields[submitField] = formFields[submitField] || "View";
  }

  formFields.__EVENTTARGET ??= "";
  formFields.__EVENTARGUMENT ??= "";

  let html = await fetchCourtHtml(RWP_DISTRICT_CAUSE_LIST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://rawalpindi.dc.lhc.gov.pk",
      referer: RWP_DISTRICT_CAUSE_LIST_URL,
    },
    body: new URLSearchParams(formFields).toString(),
  });

  if (!looksLikeRawalpindiDistrictCauseListPage(html)) {
    const directUrls = [
      `${RWP_DISTRICT_RESULT_URL}?date=${encodeURIComponent(isoDateToDisplayDate(listDate))}`,
      `${RWP_DISTRICT_CAUSE_LIST_URL}?date=${encodeURIComponent(isoDateToDisplayDate(listDate))}`,
      `${RWP_DISTRICT_CAUSE_LIST_URL}?CauseListDate=${encodeURIComponent(isoDateToDisplayDate(listDate))}`,
    ];
    for (const url of directUrls) {
      try {
        const candidate = await fetchCourtHtml(url);
        if (looksLikeRawalpindiDistrictCauseListPage(candidate)) {
          html = candidate;
          return { html, sourceUrl: url };
        }
      } catch {
        continue;
      }
    }
    throw new Error("Rawalpindi District live response did not contain a recognizable cause list layout");
  }

  return { html, sourceUrl: RWP_DISTRICT_CAUSE_LIST_URL };
}

export async function fetchRawalpindiDistrictCauseList(
  listType: CourtListType = "regular",
  requestedIsoDate?: string,
): Promise<{ listDate: string; rows: CourtCauseListEntry[]; sourceUrl: string }> {
  if (listType !== "regular") {
    throw new Error("Rawalpindi District & Sessions Courts only publish regular cause lists");
  }

  const fallbackListDate = requestedIsoDate ?? todayInPakistanIso();

  return withCourtFixtureFallback(
    "Rawalpindi District",
    "source-rwp-district",
    fallbackListDate,
    listType,
    async () => {
      const live = await postAspNetCauseListForm(fallbackListDate);
      const rows = parseRawalpindiDistrictCauseList(live.html, {
        listDate: fallbackListDate,
        listType,
        sourceUrl: live.sourceUrl,
      });
      if (rows.length === 0 && isCourtLiveFetchEnabled()) {
        logCourtSourceWarning(
          "Rawalpindi District",
          `Live cause list parsed successfully but returned zero rows for ${fallbackListDate}.`,
        );
      }
      return { listDate: fallbackListDate, rows, sourceUrl: live.sourceUrl };
    },
    (html) => ({
      listDate: requestedIsoDate ?? "2026-07-15",
      rows: parseRawalpindiDistrictCauseList(html, {
        listDate: requestedIsoDate ?? "2026-07-15",
        listType,
        sourceUrl: RWP_DISTRICT_CAUSE_LIST_URL,
      }),
      sourceUrl: RWP_DISTRICT_CAUSE_LIST_URL,
    }),
  );
}

export function readRawalpindiDistrictFixture(listDate: string, listType: CourtListType): string {
  return readCourtFixture("source-rwp-district", listDate, listType);
}
