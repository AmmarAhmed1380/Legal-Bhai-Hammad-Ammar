export type CourtListType = "regular" | "supplementary" | "urgent";

export interface CourtCauseListEntry {
  courtId: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  courtroom: string | null;
  bench: string | null;
  parties: string | null;
  advocates: string | null;
  sourceUrl: string;
  confidence: number;
}

export interface CourtSourceDefinition {
  id: string;
  courtId: string;
  displayName: string;
  sourceType: string;
  calendarSourceType: string;
  manualReviewSourceType: string;
  officialUrl: string;
  supportedListTypes: CourtListType[];
}
