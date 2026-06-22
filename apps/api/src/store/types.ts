import type {
  AuditEvent,
  ClientAccount,
  ClientMembership,
  CourtSource,
  Firm,
  FirmMembership,
  Hearing,
  Invoice,
  Matter,
  MatterParty,
  Message,
  MessageThread,
  PortalLink,
  ProductAlert,
  ProductAuthMethod,
  ProductDocument,
  ProductLanguage,
  ProductSession,
  ProductUser,
} from "@wakeel/shared";

export interface ProductProfile {
  actorType: "staff" | "client";
  firm: Firm | null;
  staffUser?: ProductUser;
  staffMembership?: FirmMembership;
  clientAccount?: ClientAccount;
}

export interface MatterDetail extends Matter {
  leadLawyer: ProductUser | null;
  parties: MatterParty[];
  hearings: Hearing[];
  documents: ProductDocument[];
  thread: MessageThread | null;
  clients?: ClientAccount[];
}

export interface SearchHit {
  id: string;
  kind: "matter" | "document" | "client";
  title: string;
  subtitle: string;
}

export interface OtpRequestRecord {
  actorType: "staff" | "client";
  phone: string;
  code: string;
}

export interface CreateMatterInput {
  firmId: string;
  courtId: string;
  rawCaseNumber: string;
  normalizedCaseNumber: string;
  title: string;
  matterType: Matter["matterType"];
  stage: string;
  status: Matter["status"];
  nextHearingAt: string | null;
  leadLawyerId: string | null;
}

export interface CreateDocumentInput {
  firmId: string;
  matterId: string | null;
  folderId?: string | null;
  type: ProductDocument["type"];
  title: string;
  storageKey: string;
  mimeType: string;
  uploadedBy: string;
  ocrStatus: ProductDocument["ocrStatus"];
  ocrText: string | null;
  searchText: string | null;
  portalVisible?: boolean;
}

export interface PortalAccess {
  link: PortalLink;
  clientAccount: ClientAccount;
  session: ProductSession;
}

export interface ActiveRefreshToken {
  id: string;
  sessionId: string;
  actorType: "staff" | "client";
  actorId: string;
  firmId: string | null;
  authMethod: ProductAuthMethod;
  expiresAt: string;
}

export type StoredDocumentRow = Omit<ProductDocument, "portalVisible"> & { portalVisible: number };

export interface ProductClientSummary {
  id: string;
  phone: string;
  displayName: string;
  language: ProductLanguage;
  status: ClientAccount["status"];
  matterCount: number;
  outstandingTotal: number;
  lastMessageAt: string | null;
  nextHearingAt: string | null;
}

export interface ProductClientDetail {
  client: ProductClientSummary;
  matters: Matter[];
  invoices: Invoice[];
  threadSummaries: Array<MessageThread & { matter: Matter; lastMessage: Message | null }>;
}

export interface OverviewReport {
  metrics: {
    openMatters: number;
    upcomingHearings: number;
    unreadAlerts: number;
    outstandingInvoiceTotal: number;
    overdueInvoiceTotal: number;
    billableMinutes: number;
  };
  mattersByStage: Array<{ stage: string; count: number }>;
  syncHealth: Array<CourtSource & { metrics: Record<string, number> }>;
}

export interface CsvImportPreview {
  id: string;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  rows: Array<{
    rowNumber: number;
    state: string;
    normalizedCaseNumber: string | null;
    error: string | null;
    payload: Record<string, unknown>;
  }>;
}

export interface NotificationPreference {
  firmId: string;
  actorType: "staff" | "client";
  actorId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  optedOutAt: string | null;
}

export interface NotificationJobRecord {
  id: string;
  firmId: string;
  actorType: "staff" | "client";
  actorId: string;
  channel: "email" | "sms";
  templateKey: string;
  templateVersion: number;
  payload: Record<string, unknown>;
  scheduledAt: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
}
