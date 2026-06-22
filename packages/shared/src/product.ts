export const PRODUCT_LANGUAGES = ["en", "ur"] as const;
export const PRODUCT_ACTOR_TYPES = ["staff", "client"] as const;
export const PRODUCT_MEMBERSHIP_ROLES = ["owner", "lawyer", "assistant", "billing"] as const;
export const PRODUCT_MATTER_TYPES = ["litigation", "advisory", "arbitration"] as const;
export const PRODUCT_MATTER_STATUSES = ["open", "on_hold", "closed"] as const;
export const PRODUCT_ACCESS_LEVELS = ["read", "message"] as const;
export const PRODUCT_DOCUMENT_TYPES = [
  "hearing_order",
  "pleading",
  "invoice",
  "evidence",
  "notice",
  "cnic",
  "receipt",
  "cause_list",
  "note",
  "general",
  "Identity Document",
  "Evidence",
  "Affidavit",
  "Agreement / Contract",
  "Court Notice",
  "General",
] as const;
export const PRODUCT_OCR_STATUSES = ["completed", "pending", "failed", "missing_file"] as const;
export const PRODUCT_THREAD_STATUSES = ["open", "archived"] as const;
export const PRODUCT_DELIVERY_CHANNELS = ["in_app", "sms"] as const;
export const PRODUCT_DELIVERY_STATES = ["pending", "delivered", "failed"] as const;
export const PRODUCT_INVOICE_STATUSES = ["draft", "issued", "paid", "void"] as const;
export const PRODUCT_COURT_SOURCE_STATUSES = ["pending", "live", "degraded", "manual_review"] as const;
export const PRODUCT_INGESTION_MODES = ["automation", "ops_assisted"] as const;
export const PRODUCT_ALERT_TYPES = ["sync_issue", "matter_update", "invoice_due", "client_message"] as const;
export const PRODUCT_AUTH_METHODS = ["staff_otp", "staff_magic_link", "client_otp"] as const;
export const PRODUCT_INGESTION_RUN_STATUSES = ["completed", "needs_review"] as const;

export type ProductLanguage = (typeof PRODUCT_LANGUAGES)[number];
export type ProductActorType = (typeof PRODUCT_ACTOR_TYPES)[number];
export type ProductMembershipRole = (typeof PRODUCT_MEMBERSHIP_ROLES)[number];
export type ProductMatterType = (typeof PRODUCT_MATTER_TYPES)[number];
export type ProductMatterStatus = (typeof PRODUCT_MATTER_STATUSES)[number];
export type ProductAccessLevel = (typeof PRODUCT_ACCESS_LEVELS)[number];
export type ProductDocumentType = (typeof PRODUCT_DOCUMENT_TYPES)[number];
export type ProductOcrStatus = (typeof PRODUCT_OCR_STATUSES)[number];
export type ProductThreadStatus = (typeof PRODUCT_THREAD_STATUSES)[number];
export type ProductDeliveryChannel = (typeof PRODUCT_DELIVERY_CHANNELS)[number];
export type ProductDeliveryState = (typeof PRODUCT_DELIVERY_STATES)[number];
export type ProductInvoiceStatus = (typeof PRODUCT_INVOICE_STATUSES)[number];
export type ProductCourtSourceStatus = (typeof PRODUCT_COURT_SOURCE_STATUSES)[number];
export type ProductIngestionMode = (typeof PRODUCT_INGESTION_MODES)[number];
export type ProductAlertType = (typeof PRODUCT_ALERT_TYPES)[number];
export type ProductAuthMethod = (typeof PRODUCT_AUTH_METHODS)[number];
export type ProductIngestionRunStatus = (typeof PRODUCT_INGESTION_RUN_STATUSES)[number];

export interface Firm {
  id: string;
  name: string;
  primaryCity: string;
  billingPlan: string;
  timezone: string;
  status: "active" | "trial";
}

export interface ProductUser {
  id: string;
  phone: string;
  email: string | null;
  displayName: string;
  language: ProductLanguage;
  status: "active" | "invited";
}

export interface FirmMembership {
  id: string;
  firmId: string;
  userId: string;
  role: ProductMembershipRole;
  permissions: string[];
  officeLabel: string | null;
}

export interface ClientAccount {
  id: string;
  phone: string;
  displayName: string;
  language: ProductLanguage;
  status: "active" | "invited" | "archived";
}

export interface ClientMembership {
  id: string;
  clientAccountId: string;
  matterId: string;
  accessLevel: ProductAccessLevel;
}

export interface Matter {
  id: string;
  firmId: string;
  courtId: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  title: string;
  matterType: ProductMatterType;
  stage: string;
  status: ProductMatterStatus;
  nextHearingAt: string | null;
  leadLawyerId: string | null;
}

/** Lean projection for matter list / sidebar roster views. */
export interface MatterRosterSummary {
  id: string;
  courtId: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  status: ProductMatterStatus;
  nextHearingAt: string | null;
}

export interface MatterParty {
  id: string;
  matterId: string;
  partyType: "petitioner" | "respondent" | "applicant" | "other";
  displayName: string;
  contactRef: string | null;
}

export interface Hearing {
  id: string;
  matterId: string;
  listedAt: string;
  outcome: string;
  notes: string;
  nextDate: string | null;
  courtroom: string | null;
  bench: string | null;
  sourceType: string;
  documentId: string | null;
}

export interface CalendarItem {
  id: string;
  matterId: string;
  listedAt: string;
  courtroom: string | null;
  bench: string | null;
  sourceType: string;
  sourceConfidence: number;
  conflictState: "none" | "possible";
}

export interface ProductDocument {
  id: string;
  firmId: string;
  matterId: string | null;
  folderId: string | null;
  type: ProductDocumentType;
  title: string;
  storageKey: string;
  mimeType: string;
  fileSize?: number | null;
  sha256?: string | null;
  originalFileName?: string | null;
  uploadedBy: string;
  uploadedAt?: string | null;
  ocrStatus: ProductOcrStatus;
  ocrText: string | null;
  searchText: string | null;
  portalVisible: boolean;
  uploaderType?: "client" | "lawyer";
}

export interface DocumentLink {
  id: string;
  documentId: string;
  matterId: string;
}

export interface MessageThread {
  id: string;
  matterId: string;
  participantType: "firm_client";
  status: ProductThreadStatus;
}

export interface Message {
  id: string;
  threadId: string;
  senderType: ProductActorType;
  senderId: string;
  body: string;
  language: ProductLanguage;
  deliveryChannel: ProductDeliveryChannel;
  deliveryState: ProductDeliveryState;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  firmId: string;
  matterId: string;
  userId: string;
  startedAt: string;
  minutes: number;
  narrative: string;
  billable: boolean;
}

export interface Invoice {
  id: string;
  firmId: string;
  clientAccountId: string;
  matterId: string | null;
  status: ProductInvoiceStatus;
  issuedAt: string | null;
  dueAt: string | null;
  total: number;
}

export interface CourtSource {
  id: string;
  courtId: string;
  sourceType: string;
  ingestionMode: ProductIngestionMode;
  status: ProductCourtSourceStatus;
  lastSuccessfulSyncAt: string | null;
  officialUrl?: string | null;
}

export interface CourtRegistryEntry {
  id: string;
  displayName: string;
  jurisdiction: string;
  automationProvider: string | null;
  status: "active" | "inactive";
}

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

export interface AuditEvent {
  id: string;
  firmId: string;
  actorType: ProductActorType | "system";
  actorId: string | null;
  objectType: string;
  objectId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Alert {
  id: string;
  firmId: string;
  type: ProductAlertType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export type ProductAlert = Alert;

export interface Session {
  id: string;
  actorType: ProductActorType;
  actorId: string;
  firmId: string | null;
  authMethod: ProductAuthMethod;
  createdAt: string;
  revokedAt: string | null;
}

export interface PortalLink {
  id: string;
  matterId: string;
  clientAccountId: string;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface IngestionRun {
  id: string;
  courtSourceId: string;
  courtId: string;
  status: ProductIngestionRunStatus;
  rowsFetched: number;
  rowsParsed: number;
  rowsMatched: number;
  parserFailures: number;
  unmatchedCount: number;
  note: string | null;
  startedAt: string;
  finishedAt: string;
}

export interface ProductSession {
  actorType: ProductActorType;
  actorId: string;
  firmId: string | null;
  sessionId?: string | null;
}
