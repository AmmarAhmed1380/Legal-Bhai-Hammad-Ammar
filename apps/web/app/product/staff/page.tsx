"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  PRODUCT_API_BASE_URL,
  type ProductAuthState,
  ProductRequestError,
  productDocumentDownloadUrl,
  productJsonRequest,
  readStoredProductAuth,
  refreshProductAuth,
  writeStoredProductAuth,
} from "../../../lib/product-api";

type StaffSection =
  | "overview"
  | "matters"
  | "calendar"
  | "alerts"
  | "clients"
  | "vault"
  | "billing"
  | "team"
  | "settings"
  | "reports"
  | "onboarding";

const PILOT_COURTS = [
  { id: "ihc", label: "Islamabad High Court" },
  { id: "lhc-rawalpindi-bench", label: "Lahore High Court Rawalpindi Bench" },
  { id: "rwp-district-sessions", label: "Rawalpindi District & Sessions Courts" },
  { id: "rwp-civil-courts", label: "Rawalpindi Civil Courts" },
  { id: "rwp-family-courts", label: "Rawalpindi Family Courts" },
  { id: "rwp-criminal-magisterial", label: "Rawalpindi Criminal & Magisterial Courts" },
] as const;

function courtLabel(courtId: string): string {
  const found = PILOT_COURTS.find((court) => court.id === courtId);
  if (found) return found.label;
  return formatCourtId(courtId);
}

type StaffProfile = {
  actorType: "staff";
  firm: {
    id: string;
    name: string;
    primaryCity: string;
    billingPlan: string;
    timezone: string;
    status: string;
  } | null;
  staffUser: {
    id: string;
    phone: string;
    displayName: string;
    language: string;
    status: string;
  };
  staffMembership: {
    id: string;
    role: string;
    officeLabel: string | null;
    permissions: string[];
  };
};

interface MatterListItem {
  id: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  status: string;
  nextHearingAt: string | null;
  courtId: string;
}

interface MatterDetail extends MatterListItem {
  normalizedCaseNumber: string;
  matterType: string;
  leadLawyerId: string | null;
  parties: Array<{
    id: string;
    partyType: "petitioner" | "respondent" | "applicant" | "other";
    displayName: string;
    contactRef: string | null;
  }>;
  hearings: Array<{
    id: string;
    listedAt: string;
    outcome: string;
    notes: string;
    nextDate: string | null;
    courtroom: string | null;
    sourceType: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    mimeType: string;
    ocrStatus: string;
    portalVisible?: boolean;
    matterId?: string | null;
  }>;
  thread: { id: string } | null;
}

interface ThreadSummary {
  id: string;
  matter: MatterListItem;
  lastMessage: { body: string; createdAt: string } | null;
}

interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  language: string;
  deliveryChannel: string;
  createdAt: string;
}

interface CalendarItem {
  id: string;
  listedAt: string;
  conflictState: string;
  sourceType: string;
  matter: MatterListItem;
}

interface CourtSource {
  id: string;
  courtId: string;
  status: string;
  ingestionMode: string;
  lastSuccessfulSyncAt: string | null;
  officialUrl?: string;
  metrics: { fetched?: number; matched?: number; parserErrors?: number };
}

interface AlertRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface TimeEntry {
  id: string;
  matterId: string;
  minutes: number;
  narrative: string;
  startedAt: string;
  billable?: boolean;
}

interface Invoice {
  id: string;
  status: string;
  total: number;
  dueAt: string | null;
  matterId?: string | null;
}

interface ClientSummary {
  id: string;
  phone: string;
  displayName: string;
  language: string;
  status: string;
  matterCount: number;
  outstandingTotal: number;
  lastMessageAt: string | null;
  nextHearingAt: string | null;
}

interface ClientDetailPayload {
  client: ClientSummary;
  matters: MatterListItem[];
  invoices: Invoice[];
  threadSummaries: ThreadSummary[];
}

interface AuditEvent {
  id: string;
  eventType: string;
  objectType: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

interface SessionRecord {
  id: string;
  authMethod: string;
  createdAt: string;
  revokedAt: string | null;
}

interface TeamMember {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  status: string;
  membership: {
    id: string;
    role: string;
    permissions: string[];
    officeLabel: string | null;
  };
}

interface OverviewReport {
  metrics: {
    openMatters: number;
    upcomingHearings: number;
    unreadAlerts: number;
    outstandingInvoiceTotal: number;
    overdueInvoiceTotal: number;
    billableMinutes: number;
  };
  mattersByStage: Array<{ stage: string; count: number }>;
  syncHealth: CourtSource[];
}

interface DocumentRecord {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  ocrStatus: string;
  portalVisible: boolean;
  matterId: string | null;
}

interface CsvImportPreview {
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

interface UnmatchedCauseEntry {
  id: string;
  listDate: string;
  listType: string;
  courtId: string | null;
  normalizedCaseNumber: string;
  rawCaseNumber: string;
  courtroom: string | null;
  bench: string | null;
}

interface NotificationPreference {
  emailEnabled: boolean;
  smsEnabled: boolean;
  optedOutAt: string | null;
}

interface NotificationJob {
  id: string;
  actorType: "staff" | "client";
  channel: "email" | "sms";
  templateKey: string;
  scheduledAt: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
}

interface SearchHit {
  id: string;
  kind: "matter" | "document" | "client";
  title: string;
  subtitle: string;
}

const STAFF_PHONES = [
  { label: "Owner", phone: "03001234567" },
  { label: "Lawyer", phone: "03007654321" },
  { label: "Assistant", phone: "03001112222" },
] as const;

const STAFF_NAV: Array<{ id: StaffSection; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "/overview" },
  { id: "matters", label: "Matters", href: "/matters" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "alerts", label: "Alerts", href: "/alerts" },
  { id: "clients", label: "Clients", href: "/clients" },
  { id: "vault", label: "Vault", href: "/vault" },
  { id: "settings", label: "Settings", href: "/settings" },
];

const STORAGE_KEY = "legalbahi-staff-auth";


function defaultDateTimeValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toTitleCase(str: string): string {
  if (!str) return str;
  return str.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function formatMimeType(mime: string): string {
  if (!mime) return "";
  if (mime.toLowerCase().startsWith("image/")) return "Image";
  if (mime.toLowerCase() === "application/pdf") return "PDF";
  return mime.split("/")[1]?.toUpperCase() || mime;
}

function formatCourtId(courtId: string): string {
  if (!courtId) return "";
  if (courtId.toLowerCase() === "ihc") return "IHC";
  return courtId.toUpperCase();
}

function getDownloadFilename(title: string, mimeType?: string): string {
  if (!title) title = "document";
  
  // Check if title already ends with a common file extension (case-insensitive)
  const hasExt = /\.[a-zA-Z0-9]{2,4}$/.test(title);
  if (hasExt) {
    return title;
  }
  
  if (!mimeType) {
    return title;
  }
  
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf") return `${title}.pdf`;
  if (mime === "image/png") return `${title}.png`;
  if (mime === "image/jpeg" || mime === "image/jpg") return `${title}.jpg`;
  if (mime === "image/gif") return `${title}.gif`;
  
  // fallback for other/unknown mime types
  const parts = mime.split("/");
  if (parts.length === 2 && parts[1]) {
    return `${title}.${parts[1]}`;
  }
  
  return title;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "TBC";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  
  const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  
  if (value.length <= 10) return dateStr; // If it's just YYYY-MM-DD
  return `${dateStr} • ${timeStr}`;
}

function formatRole(role: string): string {
  if (!role) return "";
  const r = role.toLowerCase();
  if (r === "co_owner" || r === "co-owner") return "Co-Owner";
  if (r === "owner") return "Owner";
  if (r === "lawyer") return "Lawyer";
  if (r === "assistant") return "Assistant";
  if (r === "billing") return "Billing Officer";
  return r.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatPhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  
  if (phone.startsWith("+1") || (digits.length === 11 && digits.startsWith("1"))) {
    const local = digits.startsWith("1") ? digits.slice(1) : digits;
    if (local.length === 10) {
      return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    }
  }
  
  let local = digits;
  if (digits.startsWith("92")) {
    local = digits.slice(2);
  } else if (digits.startsWith("0")) {
    local = digits.slice(1);
  }
  
  if (local.length === 10) {
    return `+92 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `+92 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  
  if (local.length >= 3) {
    return `(+92) ${local.slice(0, 3)}-${local.slice(3)}`;
  }
  return phone;
}

function formatCurrency(value: number): string {
  return `PKR ${value.toLocaleString()}`;
}

function resolveSection(pathname: string): StaffSection {
  if (pathname.startsWith("/matters")) return "matters";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/alerts")) return "alerts";
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname.startsWith("/billing")) return "billing";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  return "overview";
}

function resolveMatterId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "matters" && segments[1]) {
    return segments[1];
  }
  return null;
}

export default function ProductStaffPage() {
  const pathname = usePathname();
  const router = useRouter();
  const activeSection = useMemo(() => resolveSection(pathname), [pathname]);
  const routedMatterId = useMemo(() => resolveMatterId(pathname), [pathname]);

  const [phone, setPhone] = useState<string>(STAFF_PHONES[0].phone);
  const [auth, setAuth] = useState<ProductAuthState | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [matters, setMatters] = useState<MatterListItem[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<MatterDetail | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [courtSources, setCourtSources] = useState<CourtSource[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetailPayload | null>(null);
  const [clientDraft, setClientDraft] = useState({ displayName: "", language: "en", status: "active" });
  const [clientNotificationPreference, setClientNotificationPreference] = useState<NotificationPreference | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [unmatchedCauseEntries, setUnmatchedCauseEntries] = useState<UnmatchedCauseEntry[]>([]);
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference | null>(null);
  const [notificationHistory, setNotificationHistory] = useState<NotificationJob[]>([]);
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [registration, setRegistration] = useState({ displayName: "", email: "", firmName: "", primaryCity: "Islamabad" });
  const [messageDraft, setMessageDraft] = useState("Sharing the latest hearing update and next steps.");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [hearingOutcome, setHearingOutcome] = useState("Order reserved");
  const [hearingNotes, setHearingNotes] = useState("Counsel appeared. The court reserved the order and directed filing of any short note within three days.");
  const [hearingNextDate, setHearingNextDate] = useState("");
  const [hearingListedAt, setHearingListedAt] = useState(defaultDateTimeValue);
  const [hearingFile, setHearingFile] = useState<File | null>(null);
  const [hearingStatus, setHearingStatus] = useState<string | null>(null);
  const [newMatter, setNewMatter] = useState({ courtId: "ihc", rawCaseNumber: "", title: "", nextHearingAt: "" });
  const [matterDraft, setMatterDraft] = useState({ courtId: "", rawCaseNumber: "", title: "", stage: "", status: "open", nextHearingAt: "" });
  const [csvImport, setCsvImport] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [newClient, setNewClient] = useState({ displayName: "", phone: "", language: "en" });
  const [matterClientId, setMatterClientId] = useState("");
  const [newParty, setNewParty] = useState<{ displayName: string; partyType: "petitioner" | "respondent" | "applicant" | "other" }>({
    displayName: "",
    partyType: "petitioner",
  });
  const [partyNameDrafts, setPartyNameDrafts] = useState<Record<string, string>>({});
  const [documentUpload, setDocumentUpload] = useState({ title: "", type: "hearing_order", portalVisible: false });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultSearchHits, setVaultSearchHits] = useState<SearchHit[]>([]);
  const [courtReviewMatterIds, setCourtReviewMatterIds] = useState<Record<string, string>>({});
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [matterSearch, setMatterSearch] = useState("");
  const [matterStatusFilter, setMatterStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [viewingDocument, setViewingDocument] = useState<{ id: string; title: string; mimeType?: string } | null>(null);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  // Workspace Settings / Team Management states
  const [settingsTab, setSettingsTab] = useState<"profile" | "workspace">("profile");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "lawyer" | "assistant" | "billing">("lawyer");
  const [inviteOfficeLabel, setInviteOfficeLabel] = useState("");

  useEffect(() => {
    setAuth(readStoredProductAuth(STORAGE_KEY));
    setAuthHydrated(true);
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    writeStoredProductAuth(STORAGE_KEY, auth);
    if (auth) {
      void loadWorkspace(auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, authHydrated]);

  useEffect(() => {
    if (authHydrated && !auth) {
      router.replace("/");
    }
  }, [authHydrated, auth, router]);

  useEffect(() => {
    if (auth && routedMatterId && routedMatterId !== selectedMatter?.id) {
      void openMatter(routedMatterId, auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, routedMatterId, selectedMatter?.id]);

  useEffect(() => {
    if (!auth || activeSection !== "clients") {
      return;
    }

    const targetClientId = selectedClientId ?? clients[0]?.id ?? null;
    if (targetClientId) {
      void openClient(targetClientId, auth).catch(handleWorkspaceLoadError);
    }
  }, [activeSection, auth, clients, selectedClientId]);

  function handleWorkspaceLoadError(error: unknown) {
    if (error instanceof ProductRequestError && (error.status === 401 || error.status === 403)) {
      signOut();
      setOperationStatus("Your session expired or access was denied. Please sign in again.");
      return;
    }
    setOperationStatus(error instanceof Error ? error.message : "Could not load the workspace.");
  }

  async function authedRequest<T>(
    path: string,
    options: RequestInit = {},
    activeAuth = auth,
  ): Promise<{ data: T; auth: ProductAuthState }> {
    if (!activeAuth) {
      throw new Error("Authentication required");
    }

    try {
      return {
        data: await productJsonRequest<T>(path, options, activeAuth.token),
        auth: activeAuth,
      };
    } catch (error) {
      if (!(error instanceof ProductRequestError) || error.status !== 401 || !activeAuth.refreshToken) {
        throw error;
      }

      const refreshed = await refreshProductAuth(activeAuth.refreshToken);
      setAuth(refreshed);

      return {
        data: await productJsonRequest<T>(path, options, refreshed.token),
        auth: refreshed,
      };
    }
  }

  async function loadWorkspace(activeAuth: ProductAuthState) {
    let resolvedAuth = activeAuth;

    const meResponse = await authedRequest<{ profile: StaffProfile }>("/v1/me", {}, resolvedAuth);
    const me = meResponse.data;
    resolvedAuth = meResponse.auth;
    setProfile(me.profile);

    const matterResponse = await authedRequest<{ matters: MatterListItem[] }>("/v1/matters", {}, resolvedAuth);
    resolvedAuth = matterResponse.auth;
    const calendarResponse = await authedRequest<{ items: CalendarItem[] }>("/v1/calendar", {}, resolvedAuth);
    resolvedAuth = calendarResponse.auth;
    const alertResponse = await authedRequest<{ alerts: AlertRecord[]; auditEvents: AuditEvent[] }>("/v1/alerts", {}, resolvedAuth);
    resolvedAuth = alertResponse.auth;
    const sourceResponse = await authedRequest<{ courtSources: CourtSource[] }>("/v1/court-sources", {}, resolvedAuth);
    resolvedAuth = sourceResponse.auth;
    const threadResponse = await authedRequest<{ threads: ThreadSummary[] }>("/v1/threads", {}, resolvedAuth);
    resolvedAuth = threadResponse.auth;
    const clientResponse = await authedRequest<{ clients: ClientSummary[] }>("/v1/clients", {}, resolvedAuth);
    resolvedAuth = clientResponse.auth;
    const documentResponse = await authedRequest<{ documents: DocumentRecord[] }>("/v1/documents", {}, resolvedAuth);
    resolvedAuth = documentResponse.auth;
    const sessionResponse = await authedRequest<{ sessions: SessionRecord[] }>("/v1/sessions", {}, resolvedAuth);
    resolvedAuth = sessionResponse.auth;
    const reportResponse = await authedRequest<OverviewReport>("/v1/reports/overview", {}, resolvedAuth);
    resolvedAuth = reportResponse.auth;
    const unmatchedResponse = await authedRequest<{ entries: UnmatchedCauseEntry[] }>("/v1/court-matches/unmatched?limit=50", {}, resolvedAuth);
    resolvedAuth = unmatchedResponse.auth;
    const preferenceResponse = await authedRequest<{ preference: NotificationPreference | null }>("/v1/notifications/preferences", {}, resolvedAuth);
    resolvedAuth = preferenceResponse.auth;
    const notificationResponse = await authedRequest<{ notifications: NotificationJob[] }>("/v1/notifications/history", {}, resolvedAuth);
    resolvedAuth = notificationResponse.auth;

    setMatters(matterResponse.data.matters);
    setCalendar(calendarResponse.data.items);
    setAlerts(alertResponse.data.alerts);
    setAuditEvents(alertResponse.data.auditEvents);
    setCourtSources(sourceResponse.data.courtSources);
    setThreads(threadResponse.data.threads);
    setClients(clientResponse.data.clients);
    setDocuments(documentResponse.data.documents);
    setSessions(sessionResponse.data.sessions);
    setReport(reportResponse.data);
    setUnmatchedCauseEntries(unmatchedResponse.data.entries);
    setNotificationPreference(preferenceResponse.data.preference);
    setNotificationHistory(notificationResponse.data.notifications);

    if (me.profile.firm && (me.profile.staffMembership.role === "owner" || me.profile.staffMembership.role === "co_owner")) {
      try {
        const teamResponse = await authedRequest<{ memberships: TeamMember[] }>(
          `/v1/firms/${me.profile.firm.id}/memberships`,
          {},
          resolvedAuth
        );
        resolvedAuth = teamResponse.auth;
        setTeamMembers(teamResponse.data.memberships || []);
      } catch (err: any) {
        console.error("Failed to load team memberships:", err.message);
      }
    }

    const nextMatterId = routedMatterId ?? selectedMatter?.id ?? matterResponse.data.matters[0]?.id ?? null;
    if (nextMatterId) {
      await openMatter(nextMatterId, resolvedAuth);
    }
  }

  async function loadTeamMembers(firmId: string, token: string) {
    try {
      const response = await productJsonRequest<{ memberships: TeamMember[] }>(
        `/v1/firms/${firmId}/memberships`,
        {},
        token
      );
      setTeamMembers(response.memberships || []);
    } catch (err: any) {
      console.error("Failed to load team members:", err.message);
    }
  }

  async function handleSendInvite() {
    if (!profile?.firm || !auth) return;
    setOperationStatus("Sending invitation...");
    try {
      const cleanPhone = invitePhone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      
      await productJsonRequest(`/v1/firms/${profile.firm.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          role: inviteRole,
          officeLabel: inviteOfficeLabel || null,
          email: inviteEmail || null
        })
      }, auth.token);

      setInvitePhone("");
      setInviteOfficeLabel("");
      setInviteEmail("");
      setOperationStatus("Invitation sent successfully!");
      
      await loadTeamMembers(profile.firm.id, auth.token);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to send invitation.");
    }
  }

  async function handleUpdateMembership(membershipId: string, role: string, officeLabel: string | null) {
    if (!auth || !profile?.firm) return;
    setOperationStatus("Updating member...");
    try {
      await productJsonRequest(`/v1/memberships/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          officeLabel
        })
      }, auth.token);
      setOperationStatus("Member updated successfully!");
      await loadTeamMembers(profile.firm.id, auth.token);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to update member.");
    }
  }

  async function startLogin() {
    setOperationStatus("Requesting OTP...");
    try {
      const response = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone, actorType: "staff" }),
      });
      setLoginCode(response.devCode ?? "");
      setOtpRequested(true);
      setOperationStatus("");
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  }

  async function verifyLogin() {
    setOperationStatus("Verifying OTP...");
    try {
      const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>(
        registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify",
        {
          method: "POST",
          body: JSON.stringify(registrationMode ? { phone, code: loginCode, ...registration } : { phone, actorType: "staff", code: loginCode }),
        }
      );
      const nextAuth = { token: payload.token, refreshToken: payload.refreshToken };
      writeStoredProductAuth(STORAGE_KEY, nextAuth);
      setAuth(nextAuth);
      setOperationStatus("");
    } catch (err: any) {
      setOperationStatus(err.message || "Invalid OTP or registration failed.");
    }
  }

  async function openMatter(matterId: string, activeAuth = auth) {
    if (!activeAuth) {
      return;
    }

    const { data: payload, auth: resolvedAuth } = await authedRequest<{ matter: MatterDetail }>(`/v1/matters/${matterId}`, {}, activeAuth);
    setSelectedMatter(payload.matter);
    setMatterDraft({
      courtId: payload.matter.courtId,
      rawCaseNumber: payload.matter.rawCaseNumber,
      title: payload.matter.title,
      stage: payload.matter.stage,
      status: payload.matter.status,
      nextHearingAt: payload.matter.nextHearingAt?.slice(0, 10) ?? "",
    });
    setPartyNameDrafts(Object.fromEntries(payload.matter.parties.map((party) => [party.id, party.displayName])));
    if (payload.matter.thread?.id) {
      const threadPayload = await authedRequest<{ messages: MessageRecord[] }>(
        `/v1/threads/${payload.matter.thread.id}/messages`,
        {},
        resolvedAuth,
      );
      setMessages(threadPayload.data.messages);
      return;
    }
    setMessages([]);
  }

  async function openClient(clientId: string, activeAuth = auth) {
    if (!activeAuth) {
      return;
    }

    const detailResponse = await authedRequest<ClientDetailPayload>(`/v1/clients/${clientId}`, {}, activeAuth);
    const preferenceResponse = await authedRequest<{ preference: NotificationPreference }>(
      `/v1/clients/${clientId}/notifications/preferences`,
      {},
      detailResponse.auth,
    );
    const data = detailResponse.data;
    setSelectedClientId(clientId);
    setClientDetail(data);
    setClientNotificationPreference(preferenceResponse.data.preference);
    setClientDraft({
      displayName: data.client.displayName,
      language: data.client.language,
      status: data.client.status,
    });
  }

  const closeDocumentViewer = () => {
    if (viewingDocumentUrl) {
      window.URL.revokeObjectURL(viewingDocumentUrl);
    }
    setViewingDocument(null);
    setViewingDocumentUrl(null);
    setZoomScale(1);
    setIsCloseHovered(false);
  };

  async function openDocument(documentId: string, activeAuth = auth) {
    if (!activeAuth) {
      return;
    }

    let resolvedAuth = activeAuth;
    let response = await fetch(productDocumentDownloadUrl(documentId), {
      headers: { authorization: `Bearer ${resolvedAuth.token}` },
    });

    if (response.status === 401 && resolvedAuth.refreshToken) {
      resolvedAuth = await refreshProductAuth(resolvedAuth.refreshToken);
      setAuth(resolvedAuth);
      response = await fetch(productDocumentDownloadUrl(documentId), {
        headers: { authorization: `Bearer ${resolvedAuth.token}` },
      });
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Find document title and mimeType
    const doc = selectedMatter?.documents.find((d) => d.id === documentId) || documents.find((d) => d.id === documentId);
    const docTitle = doc?.title || "Document Viewer";
    const docMime = doc?.mimeType || "";
    setViewingDocument({ id: documentId, title: docTitle, mimeType: docMime });
    setViewingDocumentUrl(url);
  }

  async function syncCourtSource(sourceId: string) {
    if (!auth) {
      return;
    }
    const payload = await authedRequest<{ courtSource?: CourtSource; warning?: string }>(
      `/v1/court-sources/${sourceId}/sync`,
      { method: "POST" },
      auth,
    );
    const source = payload.data.courtSource;
    setSyncMessage(
      payload.data.warning
        ? `${courtLabel(source?.courtId ?? sourceId)} degraded: ${payload.data.warning}`
        : `Synced ${courtLabel(source?.courtId ?? sourceId)} at ${formatDateTime(source?.lastSuccessfulSyncAt ?? null)}.`,
    );
    await loadWorkspace(payload.auth);
  }

  async function sendMessage() {
    if (!auth || !selectedMatter?.thread?.id) {
      return;
    }
    const payload = await authedRequest(`/v1/threads/${selectedMatter.thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: messageDraft,
        language: "en",
        deliveryChannel: "in_app",
      }),
    }, auth);
    setMessageDraft("Sharing the latest hearing update and next steps.");
    await openMatter(selectedMatter.id, payload.auth);
  }

  async function createPortalLink() {
    if (!auth || !selectedMatter || !matterClientId) {
      return;
    }
    const payload = await authedRequest<{ portalUrl: string }>("/v1/portal/links", {
      method: "POST",
      body: JSON.stringify({ matterId: selectedMatter.id, clientId: matterClientId }),
    }, auth);
    setPortalUrl(payload.data.portalUrl);
  }

  async function linkClientToMatter() {
    if (!auth || !selectedMatter || !matterClientId) {
      return;
    }
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/clients`, {
      method: "POST",
      body: JSON.stringify({ clientId: matterClientId }),
    }, auth);
    setOperationStatus("Client linked to matter.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function unlinkClientFromMatter() {
    if (!auth || !selectedMatter || !matterClientId) {
      return;
    }
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/clients/${matterClientId}`, {
      method: "DELETE",
    }, auth);
    setPortalUrl(null);
    setOperationStatus("Client unlinked from matter and its portal access revoked.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function captureHearing() {
    if (!auth || !selectedMatter) {
      return;
    }

    const form = new FormData();
    form.set("listedAt", hearingListedAt ? new Date(hearingListedAt).toISOString() : new Date().toISOString());
    form.set("outcome", hearingOutcome);
    form.set("notes", hearingNotes);
    form.set("sourceType", "manual_staff");
    if (hearingNextDate) {
      form.set("nextDate", hearingNextDate);
    }
    if (hearingFile) {
      form.set("file", hearingFile);
    }

    const payload = await authedRequest(`/v1/matters/${selectedMatter.id}/hearings`, {
      method: "POST",
      body: form,
    }, auth);

    setHearingStatus(`Saved hearing update for ${selectedMatter.rawCaseNumber}.`);
    setHearingOutcome("Order reserved");
    setHearingNotes("Counsel appeared. The court reserved the order and directed filing of any short note within three days.");
    setHearingNextDate("");
    setHearingListedAt(defaultDateTimeValue());
    setHearingFile(null);
    await loadWorkspace(payload.auth);
  }

  async function createMatter() {
    if (!auth) return;
    const courtId = newMatter.courtId;
    const rawCaseNumber = newMatter.rawCaseNumber.trim();
    const title = newMatter.title.trim();
    const nextHearingAt = newMatter.nextHearingAt;

    if (!courtId || !rawCaseNumber || !title || !nextHearingAt) {
      setOperationStatus("All fields (Court, Case number, Title, and Next Date) are required.");
      return;
    }

    const caseNumberRegex = /^[A-Za-z .&()'-]+\s*\d+\s*\/\s*\d{4}$/;
    if (!caseNumberRegex.test(rawCaseNumber)) {
      setOperationStatus("Case number must be in format: Type Number/Year (e.g., WP 123/2026 or C.R. 45/2025).");
      return;
    }

    try {
      const response = await authedRequest<{ matter: MatterListItem }>("/v1/matters", {
        method: "POST",
        body: JSON.stringify({
          ...newMatter,
          rawCaseNumber,
          title,
          nextHearingAt: nextHearingAt || null,
          matterType: "litigation",
          stage: "new",
          status: "open",
        }),
      }, auth);
      setNewMatter({ courtId: "ihc", rawCaseNumber: "", title: "", nextHearingAt: "" });
      setOperationStatus(`Created ${response.data.matter.rawCaseNumber}.`);
      await loadWorkspace(response.auth);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to create matter. Please check inputs.");
    }
  }

  async function previewCsvImport() {
    if (!auth || !csvImport.trim()) return;
    const preview = await authedRequest<{ importJob: CsvImportPreview }>(
      "/v1/matters/imports/preview",
      { method: "POST", body: JSON.stringify({ csv: csvImport }) },
      auth,
    );
    setCsvPreview(preview.data.importJob);
    setOperationStatus(`Preview ready: ${preview.data.importJob.acceptedRows} accepted; ${preview.data.importJob.rejectedRows} rejected.`);
  }

  async function confirmCsvImport() {
    if (!auth || !csvPreview || csvPreview.status !== "preview") return;
    const response = await authedRequest<{ importJob: CsvImportPreview }>(
      `/v1/matters/imports/${csvPreview.id}/confirm`,
      { method: "POST" },
      auth,
    );
    setCsvPreview(response.data.importJob);
    setOperationStatus(`Imported ${response.data.importJob.acceptedRows}; rejected ${response.data.importJob.rejectedRows}.`);
    setCsvImport("");
    await loadWorkspace(response.auth);
  }

  function downloadRejectedRows() {
    if (!csvPreview) return;
    const rejectedRows = csvPreview.rows.filter((row) => row.state === "rejected");
    const csv = [
      "rowNumber,caseNumber,error",
      ...rejectedRows.map((row) => [
        row.rowNumber,
        JSON.stringify(String(row.payload.rawCaseNumber ?? row.normalizedCaseNumber ?? "")),
        JSON.stringify(row.error ?? ""),
      ].join(",")),
    ].join("\n");
    const url = window.URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "legalbahi-rejected-matter-rows.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  }

  async function saveMatter(patch = matterDraft) {
    if (!auth || !selectedMatter) return;
    const response = await authedRequest<{ matter: MatterListItem }>(`/v1/matters/${selectedMatter.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        nextHearingAt: patch.nextHearingAt || null,
      }),
    }, auth);
    setOperationStatus(`Updated ${response.data.matter.rawCaseNumber}.`);
    await loadWorkspace(response.auth);
  }

  async function archiveMatter() {
    await saveMatter({ ...matterDraft, status: "closed" });
  }

  async function uploadDocument() {
    if (!auth || !selectedMatter || !documentFile) return;
    const form = new FormData();
    form.set("matterId", selectedMatter.id);
    form.set("type", documentUpload.type);
    form.set("title", documentUpload.title.trim() || documentFile.name);
    form.set("portalVisible", String(documentUpload.portalVisible));
    form.set("file", documentFile);
    const response = await authedRequest("/v1/documents", { method: "POST", body: form }, auth);
    setDocumentUpload({ title: "", type: "hearing_order", portalVisible: false });
    setDocumentFile(null);
    setOperationStatus("Private document uploaded.");
    await loadWorkspace(response.auth);
  }

  async function linkUnmatchedCauseEntry(entryId: string) {
    const matterId = courtReviewMatterIds[entryId];
    if (!auth || !matterId) return;
    const response = await authedRequest(`/v1/court-matches/unmatched/${entryId}/link`, {
      method: "POST",
      body: JSON.stringify({ matterId }),
    }, auth);
    setOperationStatus("Court entry linked and calendar updated.");
    await loadWorkspace(response.auth);
  }

  async function saveNotificationPreference() {
    if (!auth || !notificationPreference) return;
    const response = await authedRequest<{ preference: NotificationPreference }>("/v1/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        emailEnabled: notificationPreference.emailEnabled,
        smsEnabled: notificationPreference.smsEnabled,
        optedOut: Boolean(notificationPreference.optedOutAt),
      }),
    }, auth);
    setNotificationPreference(response.data.preference);
    setOperationStatus("Notification preferences saved.");
  }

  async function createClient() {
    if (!auth) return;
    try {
      const response = await authedRequest("/v1/clients", {
        method: "POST",
        body: JSON.stringify(newClient),
      }, auth);
      setNewClient({ displayName: "", phone: "", language: "en" });
      setOperationStatus("Client created.");
      await loadWorkspace(response.auth);
    } catch (e: any) {
      if (e instanceof Error) {
        setOperationStatus(e.message);
      } else {
        setOperationStatus("Failed to create client.");
      }
    }
  }

  async function addParty() {
    if (!auth || !selectedMatter || !newParty.displayName.trim()) return;
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/parties`, {
      method: "POST",
      body: JSON.stringify(newParty),
    }, auth);
    setNewParty({ displayName: "", partyType: "petitioner" });
    await openMatter(selectedMatter.id, response.auth);
  }

  async function updateParty(partyId: string) {
    if (!auth || !selectedMatter || !partyNameDrafts[partyId]?.trim()) return;
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/parties/${partyId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName: partyNameDrafts[partyId] }),
    }, auth);
    setOperationStatus("Party updated.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function deleteParty(partyId: string) {
    if (!auth || !selectedMatter || !window.confirm("Remove this party from the matter?")) return;
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/parties/${partyId}`, { method: "DELETE" }, auth);
    setOperationStatus("Party removed.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function updateClient() {
    if (!auth || !clientDetail) return;
    const response = await authedRequest(`/v1/clients/${clientDetail.client.id}`, {
      method: "PATCH",
      body: JSON.stringify(clientDraft),
    }, auth);
    setOperationStatus("Client updated.");
    await loadWorkspace(response.auth);
    await openClient(clientDetail.client.id, response.auth);
  }

  async function archiveClient() {
    if (!auth || !clientDetail || !window.confirm("Archive this client and revoke their portal access?")) return;
    const response = await authedRequest(`/v1/clients/${clientDetail.client.id}`, { method: "DELETE" }, auth);
    setOperationStatus("Client archived and portal access revoked.");
    await loadWorkspace(response.auth);
    await openClient(clientDetail.client.id, response.auth);
  }

  async function saveClientNotificationPreference() {
    if (!auth || !clientDetail || !clientNotificationPreference) return;
    const response = await authedRequest<{ preference: NotificationPreference }>(
      `/v1/clients/${clientDetail.client.id}/notifications/preferences`,
      {
        method: "PATCH",
        body: JSON.stringify({
          emailEnabled: false,
          smsEnabled: clientNotificationPreference.smsEnabled,
          optedOut: Boolean(clientNotificationPreference.optedOutAt),
        }),
      },
      auth,
    );
    setClientNotificationPreference(response.data.preference);
    setOperationStatus("Client reminder consent saved.");
  }

  async function updateDocumentVisibility(document: DocumentRecord) {
    if (!auth) return;
    const response = await authedRequest(`/v1/documents/${document.id}`, {
      method: "PATCH",
      body: JSON.stringify({ portalVisible: !document.portalVisible }),
    }, auth);
    setOperationStatus(document.portalVisible ? "Document removed from client portal." : "Document shared with linked client.");
    await loadWorkspace(response.auth);
  }

  async function searchVault() {
    if (!auth || !vaultSearch.trim()) {
      setVaultSearchHits([]);
      return;
    }
    const response = await authedRequest<{ hits: SearchHit[] }>(`/v1/search?q=${encodeURIComponent(vaultSearch)}`, {}, auth);
    setVaultSearchHits(response.data.hits.filter((hit) => hit.kind === "document"));
  }

  async function markAlertRead(alertId: string) {
    if (!auth) {
      return;
    }
    const payload = await authedRequest(`/v1/alerts/${alertId}`, { method: "PATCH" }, auth);
    await loadWorkspace(payload.auth);
  }

  async function signOut() {
    try {
      if (auth) {
        await productJsonRequest("/v1/auth/logout", { method: "POST" }, auth.token);
      }
    } catch {
      // Clear the local session even when the API is unavailable.
    }
    writeStoredProductAuth(STORAGE_KEY, null);
    setAuth(null);
    setProfile(null);
    setSelectedMatter(null);
    setSelectedClientId(null);
    setClientDetail(null);
    setMessages([]);
  }

  const stats = useMemo(() => ({
    matters: matters.length,
    hearingsThisWeek: calendar.length,
    unreadAlerts: alerts.filter((alert) => !alert.readAt).length,
  }), [alerts, calendar.length, matters.length]);

  const calendarConflicts = useMemo(
    () => calendar.filter((item) => item.conflictState === "possible"),
    [calendar],
  );

  if (!authHydrated) {
    return <main className="page-shell">
      <section className="auth-card" style={{ textAlign: "center" }}>
        <p className="muted">Loading workspace…</p>
      </section>
    </main>;
  }

  if (!auth) {
    return <main className="page-shell">
      <section className="auth-card" style={{ textAlign: "center" }}>
        <p className="muted">Redirecting to login…</p>
      </section>
    </main>;
  }

  if (!profile) {
    return <main className="page-shell">
      <section className="auth-card" style={{ textAlign: "center" }}>
        <p className="muted">Loading profile data…</p>
      </section>
    </main>;
  }

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <div className="eyebrow">Legal Bhai Lawyer Workspace</div>
          <h1 className="title" style={{ marginBottom: 4 }}>
            {profile.firm?.name}
          </h1>
          <p className="muted">
            {profile.staffUser.displayName} · {profile.staffMembership.role.charAt(0).toUpperCase() + profile.staffMembership.role.slice(1)} · {profile.staffMembership.officeLabel ?? "Main Office"}
          </p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/client">
            Client Workspace
          </Link>
          <button className="button" type="button" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </div>

      {activeSection !== "onboarding" ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            {STAFF_NAV.map((item) => (
              <Link
                key={item.id}
                className={activeSection === item.id ? "button" : "button-secondary"}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {operationStatus ? (
        <section className="panel" style={{ marginBottom: 20, borderLeft: "4px solid var(--primary)" }}>
          <div className="top-bar" style={{ marginBottom: 0 }}>
            <strong>{operationStatus}</strong>
            <button className="button-secondary" type="button" onClick={() => setOperationStatus(null)}>Dismiss</button>
          </div>
        </section>
      ) : null}

      {activeSection === "overview" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Workspace</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{stats.matters}</div>
                  <div>Matters</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{report?.metrics.upcomingHearings ?? calendar.length}</div>
                  <div>Upcoming Hearings</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.unreadAlerts}</div>
                  <div>Unread Alerts</div>
                </div>
              </div>
              {syncMessage ? <p className="muted" style={{ marginTop: 12 }}>{syncMessage}</p> : null}
            </div>

            <aside className="panel" style={{ width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h2 style={{ marginTop: 0 }}>Court Health</h2>
              <div className="grid">
                {courtSources.map((source) => {
                  const isLive = source.status === "live";
                  const isFailed = source.status === "failed";
                  const bg = isLive 
                    ? "rgba(15, 110, 86, 0.05)" 
                    : isFailed 
                      ? "rgba(216, 90, 48, 0.05)" 
                      : "rgba(235, 160, 40, 0.05)";
                  const border = isLive 
                    ? "1px solid rgba(15, 110, 86, 0.15)" 
                    : isFailed 
                      ? "1px solid rgba(216, 90, 48, 0.15)" 
                      : "1px solid rgba(235, 160, 40, 0.15)";
                  
                  return (
                    <div key={source.id} className="case-card" style={{ padding: "12px", border, borderRadius: "8px", backgroundColor: bg }}>
                      <strong>{courtLabel(source.courtId)}</strong>
                      <p className="muted" style={{ marginBottom: 6 }}>
                        {source.ingestionMode === "automation" ? "Automation" : source.ingestionMode} • Fetched {source.metrics.fetched ?? 0} • Matched {source.metrics.matched ?? 0}
                      </p>
                      <p className="muted" style={{ width: '100%', marginBottom: 0 }}>Last sync {formatDateTime(source.lastSuccessfulSyncAt)}</p>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        {source.officialUrl ? (
                          <a className="muted" href={source.officialUrl} target="_blank" rel="noreferrer">Official Source</a>
                        ) : <span />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </aside>

          <section className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Priority Alerts</h2>
              <div className="grid">
                {alerts.length === 0 ? (
                  <p className="muted" style={{ margin: 0, padding: "12px 0", fontSize: "14px", fontStyle: "italic", textAlign: "center" }}>No priority alerts.</p>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
                      <div className="top-bar" style={{ marginBottom: 8 }}>
                        <strong>{alert.title.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</strong>
                        {!alert.readAt ? <button className="button-secondary" type="button" onClick={() => void markAlertRead(alert.id)}>Mark Read</button> : null}
                      </div>
                      <p className="muted">{alert.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="detail-grid">
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Matter Stages</h2>
                <div className="grid">
                  {!report?.mattersByStage || report.mattersByStage.length === 0 ? (
                    <p className="muted" style={{ margin: 0, padding: "12px 0", fontSize: "14px", fontStyle: "italic", textAlign: "center" }}>No matters in pipeline.</p>
                  ) : (
                    report.mattersByStage.map((entry) => (
                      <div key={entry.stage} className="case-card" style={{ padding: 14 }}>
                        <strong>{entry.stage.charAt(0).toUpperCase() + entry.stage.slice(1)}</strong>
                        <div className="muted">{entry.count} {entry.count === 1 ? "Active Matter" : "Active Matters"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <aside className="grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Client Threads</h2>
                  <div className="grid">
                    {threads.length === 0 ? (
                      <p className="muted" style={{ margin: 0, padding: "12px 0", fontSize: "14px", fontStyle: "italic", textAlign: "center" }}>No active client threads.</p>
                    ) : (
                      threads.map((thread) => (
                        <button key={thread.id} className="case-card" onClick={() => { router.push("/matters"); openMatter(thread.matter.id); }} style={{ padding: 14, textAlign: "left", cursor: "pointer" }}>
                          <strong>{thread.matter.rawCaseNumber}</strong>
                          <p className="muted">{thread.lastMessage?.body ?? "No messages yet"}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "matters" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Add Matter</h2>
            <div className="field">
              <label>Court</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={newMatter.courtId}
                  onChange={(event) => {
                    setNewMatter({ ...newMatter, courtId: event.target.value });
                    event.target.blur();
                  }}
                  style={{
                    width: "100%",
                    appearance: "none",
                    backgroundImage: "none",
                    paddingRight: "40px"
                  }}
                >
                  {PILOT_COURTS.map((court) => <option key={court.id} value={court.id}>{court.label}</option>)}
                </select>
                <div style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  color: "var(--text-secondary)"
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="field"><label>Case number</label><input value={newMatter.rawCaseNumber} onChange={(event) => setNewMatter({ ...newMatter, rawCaseNumber: event.target.value })} /></div>
            <div className="field"><label>Title</label><input value={newMatter.title} onChange={(event) => setNewMatter({ ...newMatter, title: event.target.value })} /></div>
            <div className="field"><label>Next Date</label><input type="date" value={newMatter.nextHearingAt} onChange={(event) => setNewMatter({ ...newMatter, nextHearingAt: event.target.value })} /></div>
            <button className="button" type="button" onClick={() => void createMatter()}>Create Matter</button>
            <hr style={{ margin: "24px 0" }} />
            <h2>CSV Import</h2>
            <div className="case-card" style={{ padding: "14px", marginBottom: "14px", backgroundColor: "rgba(0,0,0,0.02)" }}>
              <strong style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>How does CSV Import work?</strong>
              <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", lineHeight: "1.5", color: "var(--text-secondary)" }}>
                <li>Download the case import spreadsheet template.</li>
                <li>Add your cases inside Excel or Google Sheets.</li>
                <li>Copy the CSV data and paste it into the textbox below.</li>
                <li>Click <strong>Validate Import</strong> to preview duplicates or formatting issues, then confirm.</li>
              </ol>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a className="button-secondary" href={`${PRODUCT_API_BASE_URL}/v1/matters/import-template.csv`} style={{ textAlign: "center" }}>
                Download CSV Template
              </a>
              <textarea value={csvImport} onChange={(event) => setCsvImport(event.target.value)} placeholder="Paste your CSV data rows here" style={{ minHeight: 120 }} />
              <button className="button-secondary" type="button" onClick={() => void previewCsvImport()}>Validate Import</button>
            </div>
            {csvPreview ? (
              <div className="case-card" style={{ marginTop: 12, padding: 14 }}>
                <strong>{csvPreview.acceptedRows} accepted · {csvPreview.rejectedRows} rejected</strong>
                <div className="grid" style={{ marginTop: 10 }}>
                  {csvPreview.rows.slice(0, 8).map((row) => (
                    <div key={row.rowNumber}>
                      Row {row.rowNumber}: <span className={`badge ${row.state === "rejected" ? "conflict" : "live"}`}>{row.state}</span>
                      {row.error ? <div className="muted">{row.error}</div> : null}
                    </div>
                  ))}
                </div>
                <div className="actions" style={{ marginTop: 12 }}>
                  {csvPreview.status === "preview" && csvPreview.acceptedRows > 0 ? (
                    <button className="button" type="button" onClick={() => void confirmCsvImport()}>Confirm Import</button>
                  ) : null}
                  {csvPreview.rejectedRows > 0 ? (
                    <button className="button-secondary" type="button" onClick={downloadRejectedRows}>Download Rejected Rows</button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <hr style={{ margin: "24px 0" }} />
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>Matter Roster</h2>
            
            <div className="field" style={{ marginBottom: 10 }}>
              <input
                type="text"
                placeholder="🔍 Search case number or title..."
                value={matterSearch}
                onChange={(e) => setMatterSearch(e.target.value)}
                style={{ padding: "8px 12px", fontSize: "14px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px", marginBottom: 16 }}>
              <button
                className="button-secondary"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: matterStatusFilter === "all" ? "var(--primary-light)" : "transparent",
                  color: matterStatusFilter === "all" ? "var(--primary-dark)" : "var(--text-secondary)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
                onClick={() => setMatterStatusFilter("all")}
              >
                All
              </button>
              <button
                className="button-secondary"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: matterStatusFilter === "open" ? "var(--primary-light)" : "transparent",
                  color: matterStatusFilter === "open" ? "var(--primary-dark)" : "var(--text-secondary)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
                onClick={() => setMatterStatusFilter("open")}
              >
                Open
              </button>
              <button
                className="button-secondary"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "12px",
                  fontWeight: 600,
                  backgroundColor: matterStatusFilter === "closed" ? "var(--primary-light)" : "transparent",
                  color: matterStatusFilter === "closed" ? "var(--primary-dark)" : "var(--text-secondary)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
                onClick={() => setMatterStatusFilter("closed")}
              >
                Closed
              </button>
            </div>

            <div className="case-list">
              {matters
                .filter((matter) => {
                  const matchesSearch =
                    matter.rawCaseNumber.toLowerCase().includes(matterSearch.toLowerCase()) ||
                    matter.title.toLowerCase().includes(matterSearch.toLowerCase());
                  const matchesStatus =
                    matterStatusFilter === "all" ||
                    (matterStatusFilter === "open" && matter.status === "open") ||
                    (matterStatusFilter === "closed" && (matter.status === "closed" || matter.status === "on_hold"));
                  return matchesSearch && matchesStatus;
                })
                .map((matter) => (
                  <button
                    key={matter.id}
                    className="case-card"
                    type="button"
                    onClick={() => void openMatter(matter.id)}
                    style={{ textAlign: "left", cursor: "pointer" }}
                  >
                    <div className="top-bar" style={{ marginBottom: 10 }}>
                      <strong>{matter.rawCaseNumber}</strong>
                      <span className="badge live">{matter.stage.charAt(0).toUpperCase() + matter.stage.slice(1)}</span>
                    </div>
                    <div>{matter.title}</div>
                    <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                      {courtLabel(matter.courtId)} · {matter.status.charAt(0).toUpperCase() + matter.status.slice(1)} · Next {matter.nextHearingAt ?? "TBC"}
                    </p>
                  </button>
                ))}
            </div>
          </aside>

          {selectedMatter ? (
            <section className="grid">
              <div className="detail-grid">
                <div className="grid">
                  <div className="panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{selectedMatter.rawCaseNumber}</h2>
                    <div style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--text-secondary)" }}>{selectedMatter.title}</div>
                    <div className="info-list" style={{ gap: "8px", marginTop: "4px" }}>
                      <div><strong>Court:</strong> {courtLabel(selectedMatter.courtId)}</div>
                      <div><strong>Stage:</strong> {toTitleCase(selectedMatter.stage)}</div>
                      <div><strong>Type:</strong> {toTitleCase(selectedMatter.matterType)}</div>
                      <div><strong>Next Hearing:</strong> {selectedMatter.nextHearingAt ? formatDateTime(selectedMatter.nextHearingAt) : "TBC"}</div>
                    </div>
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Edit Matter</h2>
                    <div className="field">
                      <label>Court</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <select
                          value={matterDraft.courtId}
                          onChange={(event) => {
                            setMatterDraft({ ...matterDraft, courtId: event.target.value });
                            event.target.blur();
                          }}
                          style={{
                            width: "100%",
                            appearance: "none",
                            backgroundImage: "none",
                            paddingRight: "40px"
                          }}
                        >
                          {PILOT_COURTS.map((court) => <option key={court.id} value={court.id}>{court.label}</option>)}
                        </select>
                        <div style={{
                          position: "absolute",
                          right: "16px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          display: "flex",
                          alignItems: "center",
                          color: "var(--text-secondary)"
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="field"><label>Case number</label><input value={matterDraft.rawCaseNumber} onChange={(event) => setMatterDraft({ ...matterDraft, rawCaseNumber: event.target.value })} /></div>
                    <div className="field"><label>Title</label><input value={matterDraft.title} onChange={(event) => setMatterDraft({ ...matterDraft, title: event.target.value })} /></div>
                    <div className="field"><label>Stage</label><input value={matterDraft.stage} onChange={(event) => setMatterDraft({ ...matterDraft, stage: event.target.value })} /></div>
                    <div className="field">
                      <label>Status</label>
                      <select value={matterDraft.status} onChange={(event) => setMatterDraft({ ...matterDraft, status: event.target.value })}>
                        <option value="open">Open</option>
                        <option value="on_hold">On hold</option>
                        <option value="closed">Closed / archived</option>
                      </select>
                    </div>
                    <div className="field"><label>Next Date</label><input type="date" value={matterDraft.nextHearingAt} onChange={(event) => setMatterDraft({ ...matterDraft, nextHearingAt: event.target.value })} /></div>
                    <div className="actions">
                      <button className="button" type="button" onClick={() => void saveMatter()}>Save Matter</button>
                      {matterDraft.status !== "closed" ? <button className="button-danger" type="button" onClick={() => void archiveMatter()}>Archive Matter</button> : null}
                    </div>
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Hearings</h2>
                    <div className="grid">
                      {selectedMatter.hearings.map((hearing) => (
                        <article key={hearing.id} className="hearing">
                          <strong>{formatDateTime(hearing.listedAt)}</strong>
                          <div>{hearing.outcome}</div>
                          <p className="muted">{hearing.notes}</p>
                          <div className="muted">
                            {hearing.sourceType}
                            {hearing.nextDate ? ` · Next ${hearing.nextDate}` : ""}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Parties</h2>
                    <div className="grid">
                      {selectedMatter.parties.map((party) => (
                        <div key={party.id} className="case-card" style={{ padding: 14 }}>
                          <div className="field">
                            <label>{party.partyType.charAt(0).toUpperCase() + party.partyType.slice(1)}</label>
                            <input
                              value={partyNameDrafts[party.id] ?? party.displayName}
                              onChange={(event) => setPartyNameDrafts({ ...partyNameDrafts, [party.id]: event.target.value })}
                            />
                          </div>
                          <div className="actions" style={{ marginTop: 10 }}>
                            <button className="button-secondary" type="button" onClick={() => void updateParty(party.id)}>Save</button>
                            <button className="button-danger" type="button" onClick={() => void deleteParty(party.id)}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="field" style={{ marginTop: 12 }}>
                      <label>Party name</label>
                      <input value={newParty.displayName} onChange={(event) => setNewParty({ ...newParty, displayName: event.target.value })} />
                    </div>
                    <div className="field">
                      <label>Party type</label>
                      <select value={newParty.partyType} onChange={(event) => setNewParty({ ...newParty, partyType: event.target.value as typeof newParty.partyType })}>
                        <option value="petitioner">Petitioner</option>
                        <option value="respondent">Respondent</option>
                        <option value="applicant">Applicant</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <button className="button-secondary" type="button" onClick={() => void addParty()}>Add party</button>
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Documents</h2>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: "16px",
                      marginTop: "16px"
                    }}>
                      {selectedMatter.documents.map((document) => (
                        <div
                          key={document.id}
                          onClick={() => void openDocument(document.id)}
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            background: "var(--surface)",
                            backdropFilter: "blur(12px)",
                            border: "1px solid var(--border)",
                            borderRadius: "14px",
                            transition: "all 0.2s ease",
                            overflow: "hidden",
                            minHeight: "160px",
                            boxShadow: "0 4px 12px rgba(15, 110, 86, 0.02)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 12px 24px rgba(15, 110, 86, 0.08)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "none";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 110, 86, 0.02)";
                          }}
                        >
                          {/* Top Section: Large File Type Thumbnail */}
                          <div style={{
                            height: "90px",
                            background: "rgba(15, 110, 86, 0.04)",
                            borderBottom: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            color: "var(--primary)"
                          }}>
                            {document.mimeType.toLowerCase() === "application/pdf" ? (
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            ) : (
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            )}
                          </div>

                          {/* Bottom Section: Title Info */}
                          <div style={{
                            padding: "12px 14px 13px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            flex: 1
                          }}>
                            <div style={{
                              fontWeight: 700,
                              color: "var(--text-primary)",
                              fontSize: "13px",
                              textAlign: "center",
                              wordBreak: "break-all",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: "1.4"
                            }} title={document.title}>
                              {document.title}
                            </div>

                            <span style={{
                              fontSize: document.type === "hearing_order" ? "10px" : "8.5px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: document.type === "hearing_order" ? "4px 8px" : "3px 6px",
                              borderRadius: "6px",
                              background: "rgba(255, 255, 255, 0.95)",
                              backdropFilter: "blur(4px)",
                              border: "1px solid rgba(15, 110, 86, 0.15)",
                              color: "var(--primary-dark)",
                              display: "inline-flex",
                              alignItems: "center",
                              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)"
                            }}>
                              {toTitleCase(document.type)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <hr style={{ margin: "24px 0" }} />
                    <h3>Upload Private Document</h3>
                    <div className="field"><label>Title</label><input value={documentUpload.title} onChange={(event) => setDocumentUpload({ ...documentUpload, title: event.target.value })} placeholder="Uses file name when blank" /></div>
                    <div className="field">
                      <label>Type</label>
                      <select value={documentUpload.type} onChange={(event) => setDocumentUpload({ ...documentUpload, type: event.target.value })}>
                        <option value="hearing_order">Hearing order</option>
                        <option value="pleading">Pleading</option>
                        <option value="evidence">Evidence</option>
                        <option value="note">Note</option>
                        <option value="general">General</option>
                      </select>
                    </div>
                    <div className="field"><label>File</label><input type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /></div>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={documentUpload.portalVisible} onChange={(event) => setDocumentUpload({ ...documentUpload, portalVisible: event.target.checked })} />
                      Share With Linked Client
                    </label>
                    <button className="button-secondary" type="button" disabled={!documentFile} onClick={() => void uploadDocument()}>Upload Document</button>
                  </div>
                </div>

                <aside className="grid">
                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Capture Hearing</h2>
                    <div className="field">
                      <label>Listed at</label>
                      <input
                        type="datetime-local"
                        value={hearingListedAt}
                        onChange={(event) => setHearingListedAt(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Outcome</label>
                      <input value={hearingOutcome} onChange={(event) => setHearingOutcome(event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Hearing Notes</label>
                      <textarea value={hearingNotes} onChange={(event) => setHearingNotes(event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Next Date</label>
                      <input type="date" value={hearingNextDate} onChange={(event) => setHearingNextDate(event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Order Image Or PDF</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => setHearingFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <button className="button" type="button" onClick={() => void captureHearing()}>
                      Save Hearing Update
                    </button>
                    {hearingStatus ? <p className="muted" style={{ marginTop: 12 }}>{hearingStatus}</p> : null}
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Client Access</h2>
                    <p className="muted">Link a client account before generating its protected one-matter portal.</p>
                    <div className="field">
                      <label>Client</label>
                      <select value={matterClientId} onChange={(event) => setMatterClientId(event.target.value)}>
                        <option value="">Select client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>{client.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <button className="button-secondary" type="button" disabled={!matterClientId} onClick={() => void linkClientToMatter()}>
                        Link Client To Matter
                      </button>
                      <button className="button-danger" type="button" disabled={!matterClientId} onClick={() => void unlinkClientFromMatter()}>
                        Unlink Selected Client
                      </button>
                      <button className="button-secondary" type="button" disabled={!matterClientId} onClick={() => void createPortalLink()}>
                        Create Portal Link
                      </button>
                    </div>
                    {portalUrl ? (
                      <p className="muted" style={{ marginTop: 12, wordBreak: "break-all" }}>
                        <a href={portalUrl} target="_blank" rel="noreferrer">{portalUrl}</a>
                      </p>
                    ) : null}
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Chat</h2>
                    <div style={{
                      maxHeight: 280,
                      overflowY: "auto",
                      overflowX: "hidden",
                      paddingRight: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}>
                      {messages.map((message) => {
                        const isMe = message.senderType === "staff";
                        return (
                          <div
                            key={message.id}
                            style={{
                              alignSelf: isMe ? "flex-end" : "flex-start",
                              maxWidth: "75%",
                              backgroundColor: isMe ? "var(--primary-light)" : "#ffffff",
                              border: isMe ? "none" : "1px solid var(--border)",
                              borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                              padding: "12px 16px",
                              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                              position: "relative"
                            }}
                          >
                            <strong style={{ fontSize: "12px", color: isMe ? "var(--primary-dark)" : "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                              {isMe ? "Counsel" : "Client"}
                            </strong>
                            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", wordBreak: "break-word", lineHeight: "1.4" }}>
                              {message.body}
                            </p>
                            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px", textAlign: isMe ? "right" : "left" }}>
                              {message.deliveryChannel} · {formatDateTime(message.createdAt)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Instagram style message box */}
                    <div style={{ display: "flex", alignItems: "center", position: "relative", marginTop: 12 }}>
                      <input
                        type="text"
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        placeholder="Write a reply..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void sendMessage();
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "14px 50px 14px 20px",
                          borderRadius: "24px",
                          border: "1px solid var(--border)",
                          background: "rgba(255, 255, 255, 0.9)",
                          fontSize: "14px",
                          outline: "none",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={!messageDraft.trim()}
                        style={{
                          position: "absolute",
                          right: "6px",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          border: "none",
                          background: messageDraft.trim() ? "var(--primary)" : "var(--text-tertiary)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "background-color 0.2s ease, transform 0.1s ease",
                          padding: 0
                        }}
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {activeSection === "calendar" ? (
        <section className="detail-grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Calendar And Conflicts</h2>
            <div className="grid">
              {calendar.map((item) => (
                <div key={item.id} className="case-card" style={{ padding: 14, borderLeftColor: item.conflictState === "possible" ? "var(--accent)" : "var(--primary)" }}>
                  <strong>{item.matter.rawCaseNumber}</strong>
                  <p className="muted">{item.matter.title}</p>
                  <div className="muted">{formatDateTime(item.listedAt)} • {item.sourceType}</div>
                </div>
              ))}
            </div>
            <hr style={{ margin: "24px 0" }} />
            <h2>Court Entries Needing Review</h2>
            <div className="grid">
              {unmatchedCauseEntries.length === 0 ? <div className="muted">No unmatched court entries.</div> : <p className="muted" style={{ marginBottom: 8 }}>Link only after confirming the cause-list entry belongs to one of your matters.</p>}
              {unmatchedCauseEntries.map((entry) => (
                <div key={entry.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
                  <strong>{entry.rawCaseNumber}</strong>
                  <div className="muted">{courtLabel(entry.courtId ?? "")} • {toTitleCase(entry.listType)} • {entry.listDate} • {entry.courtroom ?? "Courtroom TBC"}</div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Confirmed workspace matter</label>
                    <select
                      value={courtReviewMatterIds[entry.id] ?? ""}
                      onChange={(event) => setCourtReviewMatterIds({ ...courtReviewMatterIds, [entry.id]: event.target.value })}
                    >
                      <option value="">Select a matter</option>
                      {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.rawCaseNumber} • {matter.title}</option>)}
                    </select>
                  </div>
                  <button className="button-secondary" type="button" disabled={!courtReviewMatterIds[entry.id]} onClick={() => void linkUnmatchedCauseEntry(entry.id)}>
                    Confirm And Link
                  </button>
                </div>
              ))}
            </div>
          </div>

          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Possible Conflicts</h2>
              <div className="grid">
                {calendarConflicts.map((item) => (
                  <div key={item.id}>
                    <strong>{item.matter.rawCaseNumber}</strong>
                    <div className="muted">{formatDateTime(item.listedAt)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Court Freshness</h2>
              <div className="grid">
                {courtSources.map((source) => (
                  <div key={source.id}>
                    <strong>{courtLabel(source.courtId)}</strong>
                    <div className="muted">{formatDateTime(source.lastSuccessfulSyncAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeSection === "alerts" ? (
        <section>
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Alerts Inbox</h2>
            <div className="grid">
              {alerts.map((alert) => (
                <div key={alert.id} className="case-card" style={{ padding: 14 }}>
                  <div className="top-bar" style={{ marginBottom: 8 }}>
                    <strong>{toTitleCase(alert.title)}</strong>
                    {!alert.readAt ? <button className="button-secondary" type="button" onClick={() => void markAlertRead(alert.id)}>Mark Read</button> : <span className="badge live">Read</span>}
                  </div>
                  <p className="muted">{toTitleCase(alert.body)}</p>
                  <div className="muted">{formatDateTime(alert.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "clients" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Add Client</h2>
            <div className="grid">
              <div className="field">
                <label>Name:</label>
                <input value={newClient.displayName} onChange={(event) => setNewClient({ ...newClient, displayName: event.target.value })} />
              </div>
              <div className="field">
                <label>Phone Number:</label>
                <input value={newClient.phone} onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })} placeholder="" />
              </div>
              <div className="field">
                <label>Language:</label>
                <select className="input" value={newClient.language} onChange={(event) => setNewClient({ ...newClient, language: event.target.value })}>
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                </select>
              </div>
            </div>
            <button className="button" type="button" onClick={() => void createClient()}>Create Client</button>
            <hr style={{ margin: "24px 0" }} />
            <h2 style={{ marginTop: 0 }}>Client CRM</h2>
            <div className="case-list">
              {clients.map((client) => (
                <button
                  key={client.id}
                  className="case-card"
                  type="button"
                  onClick={() => void openClient(client.id)}
                  style={{ textAlign: "left", cursor: "pointer" }}
                >
                  <strong>{client.displayName}</strong>
                  <p className="muted">{formatPhone(client.phone)} · {client.matterCount} {client.matterCount === 1 ? "matter" : "matters"}</p>
                </button>
              ))}
            </div>
          </div>

          {clientDetail ? (
            <section>
              <div className="panel" style={{ width: "100%" }}>
                <h2 style={{ marginTop: 0 }}>{clientDetail.client.displayName}</h2>
                <div className="info-list">
                  <div><strong>Phone:</strong> {formatPhone(clientDetail.client.phone)}</div>
                  <div><strong>Language:</strong> {clientDetail.client.language === "en" ? "English" : clientDetail.client.language === "ur" ? "Urdu" : clientDetail.client.language}</div>
                  <div><strong>Next Hearing:</strong> {clientDetail.client.nextHearingAt ? formatDateTime(clientDetail.client.nextHearingAt) : "TBC"}</div>
                </div>
                <hr style={{ margin: "24px 0" }} />
                <h3>Edit Client</h3>
                <div className="field">
                  <label>Status</label>
                  <select value={clientDraft.status} onChange={(event) => setClientDraft({ ...clientDraft, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button className="button" type="button" onClick={() => void updateClient()}>Save Client</button>
                  {clientDetail.client.status !== "archived" ? (
                    <button className="button-danger" type="button" onClick={() => void archiveClient()}>Archive Client</button>
                  ) : null}
                </div>
                <hr style={{ margin: "24px 0" }} />
                <h3>Client Reminder Consent</h3>
                <p className="muted">Enable SMS only after the client has agreed to hearing reminders.</p>
                {clientNotificationPreference ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={clientNotificationPreference.smsEnabled}
                        disabled={clientDetail.client.status === "archived"}
                        onChange={(event) => setClientNotificationPreference({
                          ...clientNotificationPreference,
                          smsEnabled: event.target.checked,
                          optedOutAt: null,
                        })}
                      />
                      Client Consented To SMS Reminders
                    </label>
                    <button className="button-secondary" type="button" onClick={() => void saveClientNotificationPreference()}>
                      Save Reminder Consent
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="detail-grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
                  <div className="grid">
                    {clientDetail.matters.map((matter) => (
                      <button key={matter.id} className="case-card" onClick={() => { router.push("/matters"); openMatter(matter.id); }} style={{ padding: 14, textAlign: "left", cursor: "pointer" }}>
                        <strong>{matter.rawCaseNumber}</strong>
                        <p className="muted">{matter.title}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <aside className="grid">
                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Threads</h2>
                    <div className="grid">
                      {clientDetail.threadSummaries.map((thread) => (
                        <button key={thread.id} className="case-card" onClick={() => { router.push("/matters"); openMatter(thread.matter.id); }} style={{ padding: 14, textAlign: "left", cursor: "pointer" }}>
                          <strong>{thread.matter.rawCaseNumber}</strong>
                          <p className="muted">{thread.lastMessage?.body ?? "No client message yet"}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {activeSection === "vault" ? (
        <section>
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Document Vault</h2>
            <div className="field-row" style={{ marginBottom: 16 }}>
              <input
                value={vaultSearch}
                onChange={(event) => setVaultSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void searchVault(); }}
                placeholder="Search document title or OCR text"
                style={{ flex: 1, minWidth: 220, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)" }}
              />
              <button className="button-secondary" type="button" onClick={() => void searchVault()}>Search</button>
            </div>
            {vaultSearchHits.length > 0 ? (
              <div className="panel" style={{ marginBottom: 18, background: "var(--primary-light)" }}>
                <strong>Search Results</strong>
                <div className="grid" style={{ marginTop: 10 }}>
                  {vaultSearchHits.map((hit) => (
                    <button key={hit.id} className="button-secondary" type="button" onClick={() => void openDocument(hit.id)}>
                      {hit.title} • {hit.subtitle}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid">
              {documents.map((document) => (
                <div key={document.id} className="case-card" style={{ padding: 14 }}>
                  <div className="top-bar" style={{ marginBottom: 8 }}>
                    <strong>{document.title}</strong>
                    <span className={`badge ${document.portalVisible ? "live" : "conflict"}`}>
                      {document.portalVisible ? "Portal Shared" : "Internal"}
                    </span>
                  </div>
                  <p className="muted">
                    {toTitleCase(document.type)} · {formatMimeType(document.mimeType)}
                  </p>
                  <div className="actions">
                    <button className="button-secondary" type="button" onClick={() => void openDocument(document.id)}>Open</button>
                    <button className="button-secondary" type="button" onClick={() => void updateDocumentVisibility(document)}>
                      {document.portalVisible ? "Make Internal" : "Share With Client"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeSection === "settings" ? (
        <section>
          {profile && (profile.staffMembership.role === "owner" || profile.staffMembership.role === "co_owner") && (
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <button
                type="button"
                className={settingsTab === "profile" ? "button" : "button-secondary"}
                onClick={() => setSettingsTab("profile")}
                style={{ flex: 1 }}
              >
                My Profile & Preferences
              </button>
              <button
                type="button"
                className={settingsTab === "workspace" ? "button" : "button-secondary"}
                onClick={() => setSettingsTab("workspace")}
                style={{ flex: 1 }}
              >
                Workspace Settings & Members
              </button>
            </div>
          )}

          {settingsTab === "profile" || (profile?.staffMembership.role !== "owner" && profile?.staffMembership.role !== "co_owner") ? (
            <div className="grid">
              <div className="panel" style={{ width: "100%" }}>
                <h2 style={{ marginTop: 0 }}>Profile And Session Settings</h2>
                <div className="info-list">
                  <div><strong>Name:</strong> {profile.staffUser.displayName}</div>
                  <div><strong>Phone:</strong> {formatPhone(profile.staffUser.phone)}</div>
                  <div><strong>Role:</strong> {formatRole(profile.staffMembership.role)}</div>
                  <div><strong>Language:</strong> {profile.staffUser.language === "en" ? "English" : profile.staffUser.language === "ur" ? "Urdu" : profile.staffUser.language}</div>
                </div>
              </div>
              <div className="panel" style={{ width: "100%" }}>
                <h2 style={{ marginTop: 0 }}>Notification Preferences</h2>
                {notificationPreference ? (
                  <div className="grid">
                    <label className="checkbox-field">
                      <input type="checkbox" checked={notificationPreference.emailEnabled} onChange={(event) => setNotificationPreference({ ...notificationPreference, emailEnabled: event.target.checked })} />
                      Receive Lawyer Agenda Emails
                    </label>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={notificationPreference.smsEnabled} onChange={(event) => setNotificationPreference({ ...notificationPreference, smsEnabled: event.target.checked })} />
                      Receive Lawyer Agenda SMS
                    </label>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={Boolean(notificationPreference.optedOutAt)}
                        onChange={(event) => setNotificationPreference({ ...notificationPreference, optedOutAt: event.target.checked ? new Date().toISOString() : null })}
                      />
                      Pause All Notifications
                    </label>
                    <button className="button" type="button" onClick={() => void saveNotificationPreference()}>Save Preferences</button>
                  </div>
                ) : <div className="muted">Notification preferences are unavailable.</div>}
              </div>
            </div>
          ) : (
            <div className="grid">
              <div className="panel" style={{ width: "100%" }}>
                <h2 style={{ marginTop: 0 }}>Workspace / Firm Details</h2>
                {profile?.firm ? (
                  <div className="info-list" style={{ marginBottom: 20 }}>
                    <div><strong>Firm Name:</strong> {profile.firm.name}</div>
                    <div><strong>City:</strong> {profile.firm.primaryCity}</div>
                    <div><strong>Timezone:</strong> {profile.firm.timezone}</div>
                    <div><strong>Billing Plan:</strong> {profile.firm.billingPlan}</div>
                    <div><strong>Status:</strong> <span className="badge live">{profile.firm.status}</span></div>
                  </div>
                ) : (
                  <div className="muted">No workspace details found.</div>
                )}
                
                <h3 style={{ marginTop: 24, marginBottom: 12 }}>Invite New Member</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Phone Number (e.g. 03001234567)</label>
                    <input
                      type="tel"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Email Address (Optional)</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      style={{ width: "100%" }}
                    >
                      <option value="lawyer">Lawyer</option>
                      <option value="assistant">Assistant</option>
                      <option value="billing">Billing Officer</option>
                      <option value="co_owner">Co-Owner</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Office Label (e.g. Islamabad HQ)</label>
                    <input
                      type="text"
                      value={inviteOfficeLabel}
                      onChange={(e) => setInviteOfficeLabel(e.target.value)}
                      placeholder=""
                    />
                  </div>
                  <button className="button" type="button" onClick={() => void handleSendInvite()} style={{ marginTop: 8 }}>
                    Send Invitation
                  </button>
                </div>
              </div>

              <div className="panel" style={{ width: "100%" }}>
                <h2 style={{ marginTop: 0 }}>Manage Employees / Staff</h2>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  Total Members: {teamMembers.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "rgba(255, 255, 255, 0.4)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "14px" }}>
                            {member.displayName === member.phone ? formatPhone(member.phone) : member.displayName}
                          </strong>
                          {member.email && (
                            <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                              {member.email}
                            </div>
                          )}
                          <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                            Phone: {formatPhone(member.phone)}
                          </div>
                          <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                            Role: {formatRole(member.membership.role)}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <span className={`badge ${member.status === "active" ? "live" : "secondary"}`}>
                            {toTitleCase(member.status)}
                          </span>
                          {member.membership.officeLabel && (
                            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                              {member.membership.officeLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Modify role / actions if not current user */}
                      {member.id !== profile.staffUser.id && (
                        <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600 }}>Role:</span>
                          <select
                            value={member.membership.role}
                            onChange={(e) => void handleUpdateMembership(member.membership.id, e.target.value, member.membership.officeLabel)}
                            style={{ padding: "4px 8px", fontSize: "12px", height: "auto", width: "auto" }}
                          >
                            <option value="owner">Owner</option>
                            <option value="co_owner">Co-Owner</option>
                            <option value="lawyer">Lawyer</option>
                            <option value="assistant">Assistant</option>
                            <option value="billing">Billing Officer</option>
                          </select>
                          
                          <input
                            type="text"
                            value={member.membership.officeLabel || ""}
                            placeholder="Office Label"
                            onChange={(e) => {
                              const newLabel = e.target.value;
                              setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, membership: { ...m.membership, officeLabel: newLabel } } : m));
                            }}
                            onBlur={(e) => {
                              void handleUpdateMembership(member.membership.id, member.membership.role, e.target.value || null);
                            }}
                            style={{
                              padding: "4px 8px",
                              fontSize: "12px",
                              height: "auto",
                              flex: 1,
                              minWidth: 80
                            }}
                          />
                        </div>
                      )}
                      
                      {member.id === profile.staffUser.id && (
                        <div className="muted" style={{ fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>
                          You (Current User) — Role cannot be modified here.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {activeSection === "onboarding" ? (
        <section className="detail-grid">
          <div className="panel" style={{ margin: "0 auto", maxWidth: 600, width: "100%", textAlign: "center" }}>
            <div className="eyebrow">Onboarding Step</div>
            <h2 style={{ marginTop: 6 }}>Your Legal Bhai Workspace Is Ready</h2>
            <p className="muted">
              Your invited signup created a private solo-lawyer workspace. Finish these steps before
              relying on reminders for a real hearing.
            </p>
            <div className="actions" style={{ justifyContent: "center", marginTop: 24 }}>
              <button className="button" type="button" onClick={() => router.push("/matters")}>Add or Import First Matter</button>
              <button className="button-secondary" type="button" onClick={() => router.push("/settings")}>Review Reminder Settings</button>
              <button className="button-secondary" type="button" onClick={() => router.push("/clients")}>Add a Client</button>
            </div>
          </div>

          <div className="panel" style={{ margin: "24px auto 0", maxWidth: 600, width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Workspace Checklist</h2>
            <div className="grid">
              <div><span className="badge live">Ready</span> Private Workspace: {profile.firm?.name}</div>
              <div><span className="badge live">Ready</span> Owner: {profile.staffUser.displayName}</div>
              <div><span className={`badge ${matters.length > 0 ? "live" : "secondary"}`}>{matters.length > 0 ? "Ready" : "To do"}</span> First Matter</div>
              <div><span className={`badge ${clients.length > 0 ? "live" : "secondary"}`}>{clients.length > 0 ? "Ready" : "To do"}</span> First Client</div>
              <div><span className={`badge ${notificationPreference ? "live" : "secondary"}`}>{notificationPreference ? "Ready" : "To do"}</span> Reminder Preferences</div>
            </div>
          </div>
        </section>
      ) : null}
      
      {/* Lightbox Document Viewer */}
      {viewingDocumentUrl && viewingDocument && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }} onClick={closeDocumentViewer}>
          <div style={{
            backgroundColor: "white",
            width: "95%",
            maxWidth: "1400px",
            height: "95%",
            maxHeight: "920px",
            borderRadius: "18px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "#fcfbfa"
            }}>
              <h3 style={{ margin: 0, color: "var(--primary-dark)", fontSize: "18px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "16px" }}>
                {viewingDocument.title}
              </h3>
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {/* Magnification Controls */}
                {viewingDocument.mimeType?.startsWith("image/") && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    background: "rgba(0, 0, 0, 0.05)",
                    borderRadius: "20px",
                    padding: "2px 8px",
                    marginRight: "16px"
                  }}>
                    <button
                      type="button"
                      onClick={() => setZoomScale(prev => Math.max(0.25, prev - 0.25))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      title="Zoom Out"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
                    </button>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      minWidth: "42px",
                      textAlign: "center"
                    }}>
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomScale(prev => Math.min(3, prev + 0.25))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      title="Zoom In"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                      title="Reset Zoom"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Download Button */}
                <a
                  href={viewingDocumentUrl}
                  download={getDownloadFilename(viewingDocument.title, viewingDocument.mimeType)}
                  style={{
                    background: "none",
                    border: "none",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                    outline: "none",
                    marginRight: "8px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                  title="Download File"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                </a>
                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeDocumentViewer}
                  onMouseEnter={() => setIsCloseHovered(true)}
                  onMouseLeave={() => setIsCloseHovered(false)}
                  style={{
                    background: isCloseHovered ? "rgba(0, 0, 0, 0.08)" : "none",
                    border: "none",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                    outline: "none",
                    padding: 0
                  }}
                  title="Close"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: "#eae7dc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "auto",
              padding: "10px"
            }}>
              {viewingDocument.mimeType?.startsWith("image/") ? (
                <img
                  src={viewingDocumentUrl}
                  alt={viewingDocument.title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease-out"
                  }}
                />
              ) : (
                <iframe
                  src={viewingDocumentUrl}
                  width="100%"
                  height="100%"
                  style={{ border: "none" }}
                  title={viewingDocument.title}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
