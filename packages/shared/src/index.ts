export const STAGES = [
  "filing",
  "notice",
  "written_statement",
  "issues",
  "evidence",
  "arguments",
  "reserved",
  "decided",
] as const;

export const USER_ROLES = ["admin", "associate", "junior"] as const;
export const SOURCE_TYPES = ["live_ihc", "demo_district"] as const;
export const NOTIFICATION_TYPES = ["reminder", "post_hearing"] as const;

export type Stage = (typeof STAGES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  firmId: string | null;
}

export interface CaseRecord {
  id: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  court: string;
  title: string;
  stage: Stage;
  nextDate: string | null;
  assignedToUserId: string | null;
  clientName: string;
  clientPhone: string;
  sourceType: SourceType;
  judgeName: string | null;
  benchName: string | null;
}

export interface HearingLog {
  id: string;
  caseId: string;
  hearingDate: string;
  outcome: string;
  notes: string;
  nextDateGiven: string | null;
  imageUrl: string | null;
  ocrText: string | null;
  ocrStatus: "completed" | "pending_config" | "failed" | "missing_file";
  stageAfter: Stage | null;
}

export interface CalendarEntry {
  id: string;
  caseId: string;
  court: string;
  bench: string;
  date: string;
  timeSlot: string;
  source: SourceType;
  sourceConfidence: number;
  judgeNames: string | null;
  isConflict?: boolean;
}

export interface ShareLink {
  id: string;
  caseId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface NotificationPreview {
  id: string;
  caseId: string;
  type: NotificationType;
  channel: "sms_preview";
  renderedText: string;
  recipient: string;
}

export const PALETTE = {
  primary: "#0F6E56",
  primaryDark: "#08503F",
  primaryLight: "#E1F5EE",
  background: "#F8F7F3",
  surface: "#FFFFFF",
  accent: "#D85A30",
  accentLight: "#FAECE7",
  textPrimary: "#2C2C2A",
  textSecondary: "#5F5E5A",
  textTertiary: "#B4B2A9",
  border: "#E8E6E1",
  danger: "#D85A30",
} as const;

export const SOURCE_LABELS: Record<SourceType, string> = {
  live_ihc: "IHC Live",
  demo_district: "District Demo",
};

export const DEMO_CODE = "111111";

export const DEMO_PHONES = [
  "03001234567",
  "03007654321",
  "03001112222",
] as const;

export function formatSourceLabel(source: SourceType): string {
  return SOURCE_LABELS[source];
}

export * from "./product.js";
