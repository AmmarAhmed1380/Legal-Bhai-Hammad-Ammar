"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  return PILOT_COURTS.find((court) => court.id === courtId)?.label ?? courtId;
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "TBC";
  }

  return new Date(value).toLocaleString();
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
    if (error instanceof ProductRequestError && error.status === 401) {
      signOut();
      setOperationStatus("Your session expired. Sign in again.");
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

    const nextMatterId = routedMatterId ?? selectedMatter?.id ?? matterResponse.data.matters[0]?.id ?? null;
    if (nextMatterId) {
      await openMatter(nextMatterId, resolvedAuth);
    }
  }

  async function startLogin() {
    const response = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone, actorType: "staff" }),
    });
    setLoginCode(response.devCode ?? "");
    setOtpRequested(true);
  }

  async function verifyLogin() {
    const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>(
      registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify",
      {
      method: "POST",
      body: JSON.stringify(registrationMode ? { phone, code: loginCode, ...registration } : { phone, actorType: "staff", code: loginCode }),
    });
    const nextAuth = {
      token: payload.token,
      refreshToken: payload.refreshToken,
    };
    writeStoredProductAuth(STORAGE_KEY, nextAuth);
    setAuth(nextAuth);
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
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
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
    const response = await authedRequest<{ matter: MatterListItem }>("/v1/matters", {
      method: "POST",
      body: JSON.stringify({
        ...newMatter,
        nextHearingAt: newMatter.nextHearingAt || null,
        matterType: "litigation",
        stage: "new",
        status: "open",
      }),
    }, auth);
    setNewMatter({ courtId: "ihc", rawCaseNumber: "", title: "", nextHearingAt: "" });
    setOperationStatus(`Created ${response.data.matter.rawCaseNumber}.`);
    await loadWorkspace(response.auth);
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
    const response = await authedRequest("/v1/clients", {
      method: "POST",
      body: JSON.stringify(newClient),
    }, auth);
    setNewClient({ displayName: "", phone: "", language: "en" });
    setOperationStatus("Client created.");
    await loadWorkspace(response.auth);
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

  if (!auth || !profile) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <div className="eyebrow">Legal Bhai</div>
          <h1 className="title">Lawyer workspace</h1>
          <p className="muted">
            Secure matters, hearing dates, court-list matches, documents, and client updates.
          </p>
          {operationStatus ? <p className="muted">{operationStatus}</p> : null}

          <div className="field">
            <label>Phone</label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          {registrationMode ? <>
            <div className="field"><label>Your name</label><input value={registration.displayName} onChange={(event) => setRegistration({ ...registration, displayName: event.target.value })} /></div>
            <div className="field"><label>Email</label><input type="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} /></div>
            <div className="field"><label>Practice name</label><input value={registration.firmName} onChange={(event) => setRegistration({ ...registration, firmName: event.target.value })} /></div>
            <div className="field"><label>City</label><input value={registration.primaryCity} onChange={(event) => setRegistration({ ...registration, primaryCity: event.target.value })} /></div>
          </> : null}
          {otpRequested ? <div className="field">
            <label>OTP code</label>
            <input inputMode="numeric" value={loginCode ?? ""} onChange={(event) => setLoginCode(event.target.value)} />
          </div> : null}
          <button className="button" type="button" onClick={() => void (otpRequested ? verifyLogin() : startLogin())}>
            {otpRequested ? "Verify OTP and sign in" : "Request OTP"}
          </button>

          <button className="button-secondary" type="button" onClick={() => { setRegistrationMode(!registrationMode); setOtpRequested(false); }}>
            {registrationMode ? "Use existing lawyer login" : "Invited lawyer? Create workspace"}
          </button>
        </section>
      </main>
    );
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
            {profile.staffUser.displayName} · {profile.staffMembership.role} · {profile.staffMembership.officeLabel ?? "Main office"}
          </p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/client">
            Client workspace
          </Link>
          <button className="button" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>

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
          <Link
            className={activeSection === "onboarding" ? "button" : "button-secondary"}
            href="/onboarding/firm-profile"
          >
            Onboarding
          </Link>
        </div>
      </section>
      {operationStatus ? (
        <section className="panel" style={{ marginBottom: 20, borderLeft: "4px solid var(--primary)" }}>
          <div className="top-bar" style={{ marginBottom: 0 }}>
            <strong>{operationStatus}</strong>
            <button className="button-secondary" type="button" onClick={() => setOperationStatus(null)}>Dismiss</button>
          </div>
        </section>
      ) : null}

      {activeSection === "overview" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Workspace Health</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{stats.matters}</div>
                  <div>Matters</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{report?.metrics.upcomingHearings ?? calendar.length}</div>
                  <div>Upcoming hearings</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.unreadAlerts}</div>
                  <div>Unread alerts</div>
                </div>
              </div>
              {syncMessage ? <p className="muted" style={{ marginTop: 12 }}>{syncMessage}</p> : null}
            </div>

            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Court health</h2>
              <div className="grid">
                {courtSources.map((source) => (
                  <div key={source.id} className="case-card" style={{ padding: 14 }}>
                    <div className="top-bar" style={{ marginBottom: 8 }}>
                      <strong>{courtLabel(source.courtId)}</strong>
                      <span className={`badge ${source.status === "live" ? "live" : "conflict"}`}>{source.status}</span>
                    </div>
                    <p className="muted" style={{ marginTop: 0 }}>
                      {source.ingestionMode} · fetched {source.metrics.fetched ?? 0} · matched {source.metrics.matched ?? 0}
                    </p>
                    <p className="muted">Last sync {formatDateTime(source.lastSuccessfulSyncAt)}</p>
                    {source.officialUrl ? (
                      <a className="muted" href={source.officialUrl} target="_blank" rel="noreferrer">Official source</a>
                    ) : null}
                    <button className="button-secondary" type="button" onClick={() => void syncCourtSource(source.id)}>
                      Sync now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Priority alerts</h2>
              <div className="grid">
                {alerts.map((alert) => (
                  <div key={alert.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
                    <div className="top-bar" style={{ marginBottom: 8 }}>
                      <strong>{alert.title}</strong>
                      {!alert.readAt ? <button className="button-secondary" type="button" onClick={() => void markAlertRead(alert.id)}>Mark read</button> : null}
                    </div>
                    <p className="muted">{alert.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-grid">
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Matter Pipeline</h2>
                <div className="grid">
                  {report?.mattersByStage.map((entry) => (
                    <div key={entry.stage} className="case-card" style={{ padding: 14 }}>
                      <strong>{entry.stage}</strong>
                      <div className="muted">{entry.count} active matters</div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Recent activity</h2>
                  <div className="grid">
                    {auditEvents.slice(0, 6).map((event) => (
                      <div key={event.id}>
                        <strong>{event.eventType}</strong>
                        <div className="muted">{event.objectType} · {formatDateTime(event.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Unread Client Threads</h2>
                  <div className="grid">
                    {threads.map((thread) => (
                      <Link key={thread.id} className="case-card" href={`/matters/${thread.matter.id}`} style={{ padding: 14 }}>
                        <strong>{thread.matter.rawCaseNumber}</strong>
                        <p className="muted">{thread.lastMessage?.body ?? "No messages yet"}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>
      ) : null}

      {activeSection === "matters" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Add matter</h2>
            <div className="field">
              <label>Court</label>
              <select value={newMatter.courtId} onChange={(event) => setNewMatter({ ...newMatter, courtId: event.target.value })}>
                {PILOT_COURTS.map((court) => <option key={court.id} value={court.id}>{court.label}</option>)}
              </select>
            </div>
            <div className="field"><label>Case number</label><input value={newMatter.rawCaseNumber} onChange={(event) => setNewMatter({ ...newMatter, rawCaseNumber: event.target.value })} /></div>
            <div className="field"><label>Title</label><input value={newMatter.title} onChange={(event) => setNewMatter({ ...newMatter, title: event.target.value })} /></div>
            <div className="field"><label>Next date</label><input type="date" value={newMatter.nextHearingAt} onChange={(event) => setNewMatter({ ...newMatter, nextHearingAt: event.target.value })} /></div>
            <button className="button" type="button" onClick={() => void createMatter()}>Create matter</button>
            <hr style={{ margin: "24px 0" }} />
            <h2>CSV import</h2>
            <p className="muted">
              Validate duplicate and malformed rows before importing.
            </p>
            <a className="button-secondary" href={`${PRODUCT_API_BASE_URL}/v1/matters/import-template.csv`}>
              Download template
            </a>
            <textarea value={csvImport} onChange={(event) => setCsvImport(event.target.value)} placeholder="Paste the Legal Bhai CSV template here" />
            <button className="button-secondary" type="button" onClick={() => void previewCsvImport()}>Validate import</button>
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
                    <button className="button" type="button" onClick={() => void confirmCsvImport()}>Confirm import</button>
                  ) : null}
                  {csvPreview.rejectedRows > 0 ? (
                    <button className="button-secondary" type="button" onClick={downloadRejectedRows}>Download rejected rows</button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <hr style={{ margin: "24px 0" }} />
            <h2 style={{ marginTop: 0 }}>Matter roster</h2>
            <div className="case-list">
              {matters.map((matter) => (
                <button
                  key={matter.id}
                  className="case-card"
                  type="button"
                  onClick={() => void openMatter(matter.id)}
                  style={{ textAlign: "left", cursor: "pointer" }}
                >
                  <div className="top-bar" style={{ marginBottom: 10 }}>
                    <strong>{matter.rawCaseNumber}</strong>
                    <span className="badge live">{matter.stage}</span>
                  </div>
                  <div>{matter.title}</div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {courtLabel(matter.courtId)} · {matter.status} · Next {matter.nextHearingAt ?? "TBC"}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          {selectedMatter ? (
            <section className="grid">
              <div className="detail-grid">
                <div className="grid">
                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>{selectedMatter.rawCaseNumber}</h2>
                    <p className="muted">{selectedMatter.title}</p>
                    <div className="info-list">
                      <div><strong>Court:</strong> {courtLabel(selectedMatter.courtId)}</div>
                      <div><strong>Stage:</strong> {selectedMatter.stage}</div>
                      <div><strong>Type:</strong> {selectedMatter.matterType}</div>
                      <div><strong>Next hearing:</strong> {selectedMatter.nextHearingAt ?? "TBC"}</div>
                    </div>
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Edit matter</h2>
                    <div className="field">
                      <label>Court</label>
                      <select value={matterDraft.courtId} onChange={(event) => setMatterDraft({ ...matterDraft, courtId: event.target.value })}>
                        {PILOT_COURTS.map((court) => <option key={court.id} value={court.id}>{court.label}</option>)}
                      </select>
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
                    <div className="field"><label>Next date</label><input type="date" value={matterDraft.nextHearingAt} onChange={(event) => setMatterDraft({ ...matterDraft, nextHearingAt: event.target.value })} /></div>
                    <div className="actions">
                      <button className="button" type="button" onClick={() => void saveMatter()}>Save matter</button>
                      {matterDraft.status !== "closed" ? <button className="button-danger" type="button" onClick={() => void archiveMatter()}>Archive matter</button> : null}
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
                            <label>{party.partyType}</label>
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
                    <div className="grid">
                      {selectedMatter.documents.map((document) => (
                        <div key={document.id} className="case-card" style={{ padding: 14 }}>
                          <strong>{document.title}</strong>
                          <p className="muted">{document.type} · {document.mimeType} · OCR {document.ocrStatus}</p>
                          <button className="button-secondary" type="button" onClick={() => void openDocument(document.id)}>
                            Open content
                          </button>
                        </div>
                      ))}
                    </div>
                    <hr style={{ margin: "24px 0" }} />
                    <h3>Upload private document</h3>
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
                      Share with linked client
                    </label>
                    <button className="button-secondary" type="button" disabled={!documentFile} onClick={() => void uploadDocument()}>Upload document</button>
                  </div>
                </div>

                <aside className="grid">
                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Capture hearing</h2>
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
                      <label>Hearing notes</label>
                      <textarea value={hearingNotes} onChange={(event) => setHearingNotes(event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Next date</label>
                      <input type="date" value={hearingNextDate} onChange={(event) => setHearingNextDate(event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Order image or PDF</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(event) => setHearingFile(event.target.files?.[0] ?? null)}
                      />
                    </div>
                    <button className="button" type="button" onClick={() => void captureHearing()}>
                      Save hearing update
                    </button>
                    {hearingStatus ? <p className="muted" style={{ marginTop: 12 }}>{hearingStatus}</p> : null}
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Client access</h2>
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
                    <button className="button-secondary" type="button" disabled={!matterClientId} onClick={() => void linkClientToMatter()}>
                      Link client to matter
                    </button>
                    <button className="button-danger" type="button" disabled={!matterClientId} onClick={() => void unlinkClientFromMatter()}>
                      Unlink selected client
                    </button>
                    <button className="button-secondary" type="button" disabled={!matterClientId} onClick={() => void createPortalLink()}>
                      Create portal link
                    </button>
                    {portalUrl ? (
                      <p className="muted" style={{ marginTop: 12, wordBreak: "break-all" }}>
                        <a href={portalUrl} target="_blank" rel="noreferrer">{portalUrl}</a>
                      </p>
                    ) : null}
                  </div>

                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Client thread</h2>
                    <div className="grid" style={{ maxHeight: 280, overflow: "auto" }}>
                      {messages.map((message) => (
                        <div key={message.id} className="case-card" style={{ padding: 14, borderLeftColor: message.senderType === "client" ? "var(--accent)" : "var(--primary)" }}>
                          <strong>{message.senderType}</strong>
                          <p className="muted">{message.body}</p>
                          <div className="muted">{message.deliveryChannel} · {formatDateTime(message.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="field" style={{ marginTop: 12 }}>
                      <label>Reply</label>
                      <textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} />
                    </div>
                    <button className="button-secondary" type="button" onClick={() => void sendMessage()}>
                      Send update
                    </button>
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
            <h2 style={{ marginTop: 0 }}>Calendar and conflicts</h2>
            <div className="grid">
              {calendar.map((item) => (
                <div key={item.id} className="case-card" style={{ padding: 14, borderLeftColor: item.conflictState === "possible" ? "var(--accent)" : "var(--primary)" }}>
                  <strong>{item.matter.rawCaseNumber}</strong>
                  <p className="muted">{item.matter.title}</p>
                  <div className="muted">{formatDateTime(item.listedAt)} · {item.sourceType}</div>
                </div>
              ))}
            </div>
            <hr style={{ margin: "24px 0" }} />
            <h2>Court Entries Needing Review</h2>
            <p className="muted">Link only after confirming the cause-list entry belongs to one of your matters.</p>
            <div className="grid">
              {unmatchedCauseEntries.length === 0 ? <div className="muted">No unmatched court entries.</div> : null}
              {unmatchedCauseEntries.map((entry) => (
                <div key={entry.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
                  <strong>{entry.rawCaseNumber}</strong>
                  <div className="muted">{courtLabel(entry.courtId ?? "")} · {entry.listType} · {entry.listDate} · {entry.courtroom ?? "courtroom TBC"}</div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>Confirmed workspace matter</label>
                    <select
                      value={courtReviewMatterIds[entry.id] ?? ""}
                      onChange={(event) => setCourtReviewMatterIds({ ...courtReviewMatterIds, [entry.id]: event.target.value })}
                    >
                      <option value="">Select a matter</option>
                      {matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.rawCaseNumber} · {matter.title}</option>)}
                    </select>
                  </div>
                  <button className="button-secondary" type="button" disabled={!courtReviewMatterIds[entry.id]} onClick={() => void linkUnmatchedCauseEntry(entry.id)}>
                    Confirm and link
                  </button>
                </div>
              ))}
            </div>
          </div>

          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Possible conflicts</h2>
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
              <h2 style={{ marginTop: 0 }}>Court freshness</h2>
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
        <section className="detail-grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Alerts inbox</h2>
            <div className="grid">
              {alerts.map((alert) => (
                <div key={alert.id} className="case-card" style={{ padding: 14 }}>
                  <div className="top-bar" style={{ marginBottom: 8 }}>
                    <strong>{alert.title}</strong>
                    {!alert.readAt ? <button className="button-secondary" type="button" onClick={() => void markAlertRead(alert.id)}>Mark read</button> : <span className="badge live">read</span>}
                  </div>
                  <p className="muted">{alert.body}</p>
                  <div className="muted">{formatDateTime(alert.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>

          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Audit stream</h2>
            <div className="grid">
              {auditEvents.map((event) => (
                <div key={event.id}>
                  <strong>{event.eventType}</strong>
                  <div className="muted">{event.objectType} · {formatDateTime(event.createdAt)}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      ) : null}

      {activeSection === "clients" ? (
        <section className="dashboard-grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Add client</h2>
            <div className="field"><label>Name</label><input value={newClient.displayName} onChange={(event) => setNewClient({ ...newClient, displayName: event.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={newClient.phone} onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })} /></div>
            <button className="button" type="button" onClick={() => void createClient()}>Create client</button>
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
                  <p className="muted">{client.phone} · {client.matterCount} matters</p>
                </button>
              ))}
            </div>
          </aside>

          {clientDetail ? (
            <section className="grid">
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>{clientDetail.client.displayName}</h2>
                <div className="info-list">
                  <div><strong>Phone:</strong> {clientDetail.client.phone}</div>
                  <div><strong>Language:</strong> {clientDetail.client.language}</div>
                  <div><strong>Next hearing:</strong> {clientDetail.client.nextHearingAt ?? "TBC"}</div>
                </div>
                <hr style={{ margin: "24px 0" }} />
                <h3>Edit client</h3>
                <div className="field"><label>Name</label><input value={clientDraft.displayName} onChange={(event) => setClientDraft({ ...clientDraft, displayName: event.target.value })} /></div>
                <div className="field">
                  <label>Language</label>
                  <select value={clientDraft.language} onChange={(event) => setClientDraft({ ...clientDraft, language: event.target.value })}>
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                  </select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={clientDraft.status} onChange={(event) => setClientDraft({ ...clientDraft, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <button className="button" type="button" onClick={() => void updateClient()}>Save client</button>
                {clientDetail.client.status !== "archived" ? (
                  <button className="button-danger" type="button" onClick={() => void archiveClient()}>Archive client</button>
                ) : null}
                <hr style={{ margin: "24px 0" }} />
                <h3>Client reminder consent</h3>
                <p className="muted">Enable SMS only after the client has agreed to hearing reminders.</p>
                {clientNotificationPreference ? (
                  <>
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
                      Client consented to SMS reminders
                    </label>
                    <button className="button-secondary" type="button" onClick={() => void saveClientNotificationPreference()}>
                      Save reminder consent
                    </button>
                  </>
                ) : null}
              </div>

              <div className="detail-grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
                  <div className="grid">
                    {clientDetail.matters.map((matter) => (
                      <Link key={matter.id} className="case-card" href={`/matters/${matter.id}`} style={{ padding: 14 }}>
                        <strong>{matter.rawCaseNumber}</strong>
                        <p className="muted">{matter.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                <aside className="grid">
                  <div className="panel">
                    <h2 style={{ marginTop: 0 }}>Threads</h2>
                    <div className="grid">
                      {clientDetail.threadSummaries.map((thread) => (
                        <Link key={thread.id} className="case-card" href={`/matters/${thread.matter.id}`} style={{ padding: 14 }}>
                          <strong>{thread.matter.rawCaseNumber}</strong>
                          <p className="muted">{thread.lastMessage?.body ?? "No client message yet"}</p>
                        </Link>
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
        <section className="detail-grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Document vault</h2>
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
                <strong>Search results</strong>
                <div className="grid" style={{ marginTop: 10 }}>
                  {vaultSearchHits.map((hit) => (
                    <button key={hit.id} className="button-secondary" type="button" onClick={() => void openDocument(hit.id)}>
                      {hit.title} · {hit.subtitle}
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
                      {document.portalVisible ? "portal shared" : "internal"}
                    </span>
                  </div>
                  <p className="muted">{document.type} · {document.mimeType} · OCR {document.ocrStatus}</p>
                  <div className="actions">
                    <button className="button-secondary" type="button" onClick={() => void openDocument(document.id)}>Download</button>
                    <button className="button-secondary" type="button" onClick={() => void updateDocumentVisibility(document)}>
                      {document.portalVisible ? "Make internal" : "Share with client"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Vault policy</h2>
            <div className="grid">
              <div><strong>Storage:</strong> quarantine then review</div>
              <div><strong>Portal visibility:</strong> off by default</div>
              <div><strong>OCR:</strong> searchable if completed</div>
              <div><strong>Signed access:</strong> served through `/v1/documents/:id/download`</div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeSection === "settings" ? (
        <section className="detail-grid">
          <div className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Profile and session settings</h2>
              <div className="info-list">
                <div><strong>Name:</strong> {profile.staffUser.displayName}</div>
                <div><strong>Phone:</strong> {profile.staffUser.phone}</div>
                <div><strong>Role:</strong> {profile.staffMembership.role}</div>
                <div><strong>Language:</strong> {profile.staffUser.language}</div>
              </div>
            </div>
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Notification preferences</h2>
              {notificationPreference ? (
                <div className="grid">
                  <label className="checkbox-field">
                    <input type="checkbox" checked={notificationPreference.emailEnabled} onChange={(event) => setNotificationPreference({ ...notificationPreference, emailEnabled: event.target.checked })} />
                    Receive lawyer agenda emails
                  </label>
                  <label className="checkbox-field">
                    <input type="checkbox" checked={notificationPreference.smsEnabled} onChange={(event) => setNotificationPreference({ ...notificationPreference, smsEnabled: event.target.checked })} />
                    Receive lawyer agenda SMS
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(notificationPreference.optedOutAt)}
                      onChange={(event) => setNotificationPreference({ ...notificationPreference, optedOutAt: event.target.checked ? new Date().toISOString() : null })}
                    />
                    Pause all notifications
                  </label>
                  <button className="button" type="button" onClick={() => void saveNotificationPreference()}>Save preferences</button>
                </div>
              ) : <div className="muted">Notification preferences are unavailable.</div>}
            </div>
          </div>

          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Delivery history</h2>
              <div className="grid">
                {notificationHistory.length === 0 ? <div className="muted">No reminders have been scheduled yet.</div> : null}
                {notificationHistory.slice(0, 20).map((notification) => (
                  <div key={notification.id} className="case-card" style={{ padding: 14 }}>
                    <div className="top-bar" style={{ marginBottom: 6 }}>
                      <strong>{notification.templateKey.replaceAll("_", " ")}</strong>
                      <span className={`badge ${notification.status === "sent" ? "live" : notification.status === "failed" ? "conflict" : "secondary"}`}>{notification.status}</span>
                    </div>
                    <div className="muted">{notification.actorType} · {notification.channel} · {formatDateTime(notification.scheduledAt)}</div>
                    <div className="muted">Attempts: {notification.attemptCount}{notification.lastError ? ` · ${notification.lastError}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Active sessions</h2>
              <div className="grid">
                {sessions.map((session) => (
                  <div key={session.id}>
                    <strong>{session.authMethod}</strong>
                    <div className="muted">{formatDateTime(session.createdAt)}</div>
                    <div className="muted">{session.revokedAt ? `Revoked ${formatDateTime(session.revokedAt)}` : "Active"}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeSection === "onboarding" ? (
        <section className="detail-grid">
          <div className="panel">
            <div className="eyebrow">Onboarding step</div>
            <h2 style={{ marginTop: 6 }}>Your Legal Bhai workspace is ready</h2>
            <p className="muted">
              Your invited signup created a private solo-lawyer workspace. Finish these steps before
              relying on reminders for a real hearing.
            </p>
            <div className="actions">
              <Link className="button" href="/matters">Add or import first matter</Link>
              <Link className="button-secondary" href="/settings">Review reminder settings</Link>
              <Link className="button-secondary" href="/clients">Add a client</Link>
            </div>
          </div>

          <aside className="panel">
            <h2 style={{ marginTop: 0 }}>Workspace checklist</h2>
            <div className="grid">
              <div><span className="badge live">Ready</span> Private workspace: {profile.firm?.name}</div>
              <div><span className="badge live">Ready</span> Owner: {profile.staffUser.displayName}</div>
              <div><span className={`badge ${matters.length > 0 ? "live" : "secondary"}`}>{matters.length > 0 ? "Ready" : "To do"}</span> First matter</div>
              <div><span className={`badge ${clients.length > 0 ? "live" : "secondary"}`}>{clients.length > 0 ? "Ready" : "To do"}</span> First client</div>
              <div><span className={`badge ${notificationPreference ? "live" : "secondary"}`}>{notificationPreference ? "Ready" : "To do"}</span> Reminder preferences</div>
            </div>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
