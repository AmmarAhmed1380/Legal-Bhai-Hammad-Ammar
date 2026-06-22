"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  PRODUCT_API_BASE_URL,
  type ProductAuthState,
  ProductRequestError,
  productDocumentDownloadUrl,
  productJsonRequest,
  readStoredProductAuth,
  refreshProductAuth,
  writeStoredProductAuth,
} from "@/lib/product-api";

import { courtLabel, formatDateTime } from "./components/helpers";

// Import modular presentational components
import Sidebar from "./components/Sidebar";
import OverviewSection from "./components/OverviewSection";
import MattersSection from "./components/MattersSection";
import CalendarSection from "./components/CalendarSection";
import AlertsSection from "./components/AlertsSection";
import ClientsSection from "./components/ClientsSection";
import VaultSection from "./components/VaultSection";
import SettingsSection from "./components/SettingsSection";
import DocumentViewerModal from "../client/components/DocumentViewerModal";

export type StaffSection =
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

export type StaffProfile = {
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

export interface MatterListItem {
  id: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  status: string;
  nextHearingAt: string | null;
  courtId: string;
}

export interface MatterDetail extends MatterListItem {
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
    uploaderType?: string;
  }>;
  thread: { id: string } | null;
  clients?: Array<{
    id: string;
    phone: string;
    displayName: string;
    language: string;
    status: string;
  }>;
}

export interface ThreadSummary {
  id: string;
  matter: MatterListItem;
  lastMessage: { body: string; createdAt: string } | null;
}

export interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  language: string;
  deliveryChannel: string;
  createdAt: string;
}

export interface CalendarItem {
  id: string;
  listedAt: string;
  conflictState: string;
  sourceType: string;
  matter: MatterListItem;
  courtroom?: string | null;
  bench?: string | null;
}

export interface CourtSource {
  id: string;
  courtId: string;
  status: string;
  ingestionMode: string;
  lastSuccessfulSyncAt: string | null;
  officialUrl?: string;
  metrics: { fetched?: number; matched?: number; parserErrors?: number };
}

export interface AlertRecord {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface TimeEntry {
  id: string;
  matterId: string;
  minutes: number;
  narrative: string;
  startedAt: string;
  billable?: boolean;
}

export interface Invoice {
  id: string;
  status: string;
  total: number;
  dueAt: string | null;
  matterId?: string | null;
}

export interface ClientSummary {
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

export interface ClientDetailPayload {
  client: ClientSummary;
  matters: MatterListItem[];
  invoices: Invoice[];
  threadSummaries: ThreadSummary[];
}

export interface AuditEvent {
  id: string;
  eventType: string;
  objectType: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  authMethod: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface TeamMember {
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
  syncHealth: CourtSource[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  ocrStatus: string;
  portalVisible: boolean;
  matterId: string | null;
  uploaderType?: string;
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

export interface UnmatchedCauseEntry {
  id: string;
  listDate: string;
  listType: string;
  courtId: string | null;
  normalizedCaseNumber: string;
  rawCaseNumber: string;
  courtroom: string | null;
  bench: string | null;
}

export interface NotificationPreference {
  emailEnabled: boolean;
  smsEnabled: boolean;
  optedOutAt: string | null;
}

export interface NotificationJob {
  id: string;
  actorType: "staff" | "client";
  channel: "email" | "sms";
  templateKey: string;
  scheduledAt: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
}

export interface SearchHit {
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
  const [messageDraft, setMessageDraft] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [hearingOutcome, setHearingOutcome] = useState("");
  const [hearingNotes, setHearingNotes] = useState("");
  const [hearingNextDate, setHearingNextDate] = useState("");
  const [hearingListedAt, setHearingListedAt] = useState(defaultDateTimeValue);
  const [hearingFile, setHearingFile] = useState<File | null>(null);
  const [hearingStatus, setHearingStatus] = useState<string | null>(null);
  const [newMatter, setNewMatter] = useState({ courtId: "ihc", rawCaseNumber: "", title: "", nextHearingAt: "" });
  const [matterDraft, setMatterDraft] = useState({ courtId: "", rawCaseNumber: "", title: "", stage: "", status: "open", nextHearingAt: "" });
  const [csvImport, setCsvImport] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
  const [newClient, setNewClient] = useState({ displayName: "", phone: "", language: "en" });
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState<"all" | "active" | "invited" | "archived">("all");
  const [matterClientId, setMatterClientId] = useState("");
  const [newParty, setNewParty] = useState<{ displayName: string; partyType: "petitioner" | "respondent" | "applicant" | "other" }>({
    displayName: "",
    partyType: "petitioner",
  });
  const [partyNameDrafts, setPartyNameDrafts] = useState<Record<string, string>>({});
  const [documentUpload, setDocumentUpload] = useState({ title: "", type: "hearing_order", portalVisible: false });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
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
  const [inviteRole, setInviteRole] = useState<"owner" | "lawyer" | "assistant" | "billing" | "co_owner">("lawyer");
  const [inviteOfficeLabel, setInviteOfficeLabel] = useState("");

  const authRef = useRef<ProductAuthState | null>(null);
  const activeMatterIdRef = useRef<string | null>(null);
  const firstMatterId = matters[0]?.id ?? null;
  const selectedMatterId = selectedMatter?.id ?? null;

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    setAuth(readStoredProductAuth(STORAGE_KEY));
    setAuthHydrated(true);
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    writeStoredProductAuth(STORAGE_KEY, auth);
    if (auth && !profile) {
      void loadWorkspace(auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, authHydrated, profile]);

  useEffect(() => {
    if (authHydrated && !auth) {
      router.replace("/");
    }
  }, [authHydrated, auth, router]);

  useEffect(() => {
    if (auth && routedMatterId && routedMatterId !== activeMatterIdRef.current) {
      void openMatter(routedMatterId, auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, routedMatterId]);

  useEffect(() => {
    if (!auth || activeSection !== "matters" || routedMatterId || !firstMatterId) {
      return;
    }

    if (selectedMatterId === firstMatterId) {
      if (pathname !== `/matters/${firstMatterId}`) {
        router.replace(`/matters/${firstMatterId}`);
      }
      return;
    }

    void openMatter(firstMatterId, auth).catch(handleWorkspaceLoadError);
  }, [activeSection, auth, routedMatterId, firstMatterId, selectedMatterId, pathname]);

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
    activeAuth = authRef.current,
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
      authRef.current = refreshed;
      writeStoredProductAuth(STORAGE_KEY, refreshed);
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

    if (routedMatterId) {
      await openMatter(routedMatterId, resolvedAuth);
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

  async function handleSendInvite(): Promise<boolean> {
    if (!profile?.firm || !auth) return false;
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
      return true;
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to send invitation.");
      return false;
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
      setLoginCode("");
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

    activeMatterIdRef.current = matterId;
    router.replace(`/matters/${matterId}`);

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

  async function openDocument(documentId: string, activeAuthOverride?: ProductAuthState | null) {
    let resolvedAuth = activeAuthOverride !== undefined ? activeAuthOverride : authRef.current;
    if (!resolvedAuth) {
      return;
    }

    try {
      let response = await fetch(productDocumentDownloadUrl(documentId), {
        headers: { authorization: `Bearer ${resolvedAuth.token}` },
      });

      if (response.status === 401 && resolvedAuth.refreshToken) {
        resolvedAuth = await refreshProductAuth(resolvedAuth.refreshToken);
        authRef.current = resolvedAuth;
        writeStoredProductAuth(STORAGE_KEY, resolvedAuth);
        setAuth(resolvedAuth);
        response = await fetch(productDocumentDownloadUrl(documentId), {
          headers: { authorization: `Bearer ${resolvedAuth.token}` },
        });
      }

      if (!response.ok) {
        let errorMessage = "Could not download this document.";
        try {
          const body = await response.text();
          const parsed = JSON.parse(body);
          if (parsed.error) errorMessage = parsed.error;
          else errorMessage = body;
        } catch { }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Find document title and mimeType
      const doc = selectedMatter?.documents.find((d) => d.id === documentId) || documents.find((d) => d.id === documentId);
      const docTitle = doc?.title || "Document Viewer";
      const docMime = doc?.mimeType || "";
      setViewingDocument({ id: documentId, title: docTitle, mimeType: docMime });
      setViewingDocumentUrl(url);
    } catch (error) {
      setOperationStatus(error instanceof TypeError
        ? "Could not reach API."
        : error instanceof Error
          ? error.message
          : "Could not download this document.");
    }
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
    setMessageDraft("");
    await openMatter(selectedMatter.id, payload.auth);
  }

  async function createPortalLink(clientIdOverride?: string) {
    const clientId = clientIdOverride || matterClientId;
    if (!auth || !selectedMatter || !clientId) {
      return;
    }
    const payload = await authedRequest<{ portalUrl: string }>("/v1/portal/links", {
      method: "POST",
      body: JSON.stringify({ matterId: selectedMatter.id, clientId }),
    }, auth);
    setPortalUrl(payload.data.portalUrl);
  }

  async function linkClientToMatter(clientIdOverride?: string) {
    const clientId = clientIdOverride || matterClientId;
    if (!auth || !selectedMatter || !clientId) {
      return;
    }
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/clients`, {
      method: "POST",
      body: JSON.stringify({ clientId }),
    }, auth);
    setOperationStatus("Client linked to matter.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function unlinkClientFromMatter(clientIdOverride?: string) {
    const clientId = clientIdOverride || matterClientId;
    if (!auth || !selectedMatter || !clientId) {
      return;
    }
    const response = await authedRequest(`/v1/matters/${selectedMatter.id}/clients/${clientId}`, {
      method: "DELETE",
    }, auth);
    setPortalUrl(null);
    setOperationStatus("Client unlinked from matter and its portal access revoked.");
    await openMatter(selectedMatter.id, response.auth);
  }

  async function captureHearing(signal?: AbortSignal) {
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
      signal,
    }, auth);

    setHearingStatus(`Saved hearing update for ${selectedMatter.rawCaseNumber}.`);
    setHearingOutcome("");
    setHearingNotes("");
    setHearingNextDate("");
    setHearingListedAt(defaultDateTimeValue());
    setHearingFile(null);
    await loadWorkspace(payload.auth);
  }

  async function createMatter(signal?: AbortSignal) {
    if (!auth) return;
    const courtId = newMatter.courtId;
    const rawCaseNumber = newMatter.rawCaseNumber.trim();
    const title = newMatter.title.trim();
    const nextHearingAt = newMatter.nextHearingAt;

    if (!courtId || !rawCaseNumber || !title || !nextHearingAt) {
      throw new Error("All fields (Court, Case number, Title, and Next Date) are required.");
    }

    const caseNumberRegex = /^[A-Za-z .&()'-]+\s*\d+\s*\/\s*\d{4}$/;
    if (!caseNumberRegex.test(rawCaseNumber)) {
      throw new Error("Case number must be in format: Type Number/Year (e.g., WP 123/2026 or C.R. 45/2025).");
    }

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
      signal,
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

  async function saveMatter(patch = matterDraft, signal?: AbortSignal) {
    if (!auth || !selectedMatter) return;

    const courtId = patch.courtId;
    const rawCaseNumber = patch.rawCaseNumber ? patch.rawCaseNumber.trim() : "";
    const title = patch.title ? patch.title.trim() : "";

    if (!courtId || !rawCaseNumber || !title) {
      throw new Error("Court, Case number, and Title are required.");
    }

    const caseNumberRegex = /^[A-Za-z .&()'-]+\s*\d+\s*\/\s*\d{4}$/;
    if (!caseNumberRegex.test(rawCaseNumber)) {
      throw new Error("Case number must be in format: Type Number/Year (e.g., WP 123/2026 or C.R. 45/2025).");
    }

    const response = await authedRequest<{ matter: MatterListItem }>(`/v1/matters/${selectedMatter.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        rawCaseNumber,
        title,
        nextHearingAt: patch.nextHearingAt || null,
      }),
      signal,
    }, auth);
    setOperationStatus(`Updated ${response.data.matter.rawCaseNumber}.`);
    await loadWorkspace(response.auth);
  }

  async function archiveMatter() {
    await saveMatter({ ...matterDraft, status: "closed" });
  }

  async function uploadDocument(signal?: AbortSignal) {
    if (!auth || !selectedMatter || !documentFile) return;
    const form = new FormData();
    form.set("matterId", selectedMatter.id);
    form.set("type", documentUpload.type);
    form.set("title", documentUpload.title.trim() || documentFile.name);
    form.set("portalVisible", String(documentUpload.portalVisible));
    form.set("file", documentFile);
    const response = await authedRequest("/v1/documents", { method: "POST", body: form, signal }, auth);
    setDocumentUpload({ title: "", type: "hearing_order", portalVisible: false });
    setDocumentFile(null);
    setOperationStatus("Document uploaded successfully.");
    await loadWorkspace(response.auth);
  }

  async function uploadVaultDocument(file: File, title: string, type: string, portalVisible: boolean, matterId: string | null) {
    if (!auth || !file) return;
    const form = new FormData();
    if (matterId) {
      form.set("matterId", matterId);
    }
    form.set("type", type);
    form.set("title", title.trim() || file.name);
    form.set("portalVisible", String(portalVisible));
    form.set("file", file);
    const response = await authedRequest("/v1/documents", { method: "POST", body: form }, auth);
    setOperationStatus("Document uploaded to vault successfully.");
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

  async function searchVault(query: string): Promise<SearchHit[]> {
    if (!auth || !query.trim()) {
      return [];
    }
    const response = await authedRequest<{ hits: SearchHit[] }>(
      `/v1/search?q=${encodeURIComponent(query.trim())}`,
      {},
      auth,
    );
    return response.data.hits.filter((hit) => hit.kind === "document");
  }

  async function markAlertRead(alertId: string) {
    if (!auth) {
      return;
    }
    // Optimistic update — flip readAt locally so the button vanishes immediately
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a))
    );
    try {
      const payload = await authedRequest(`/v1/alerts/${alertId}`, { method: "PATCH", body: JSON.stringify({}) }, auth);
      // Sync just the alerts list from the server (lightweight, no full reload)
      const alertResponse = await authedRequest<{ alerts: AlertRecord[]; auditEvents: AuditEvent[] }>(
        "/v1/alerts",
        {},
        payload.auth,
      );
      setAlerts(alertResponse.data.alerts);
    } catch (err: any) {
      // Revert optimistic update on failure
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, readAt: null } : a))
      );
      setOperationStatus(err.message || "Failed to mark alert as read.");
    }
  }

  async function signOut() {
    try {
      if (authRef.current) {
        await productJsonRequest("/v1/auth/logout", { method: "POST" }, authRef.current.token);
      }
    } catch {
      // Clear the local session even when the API is unavailable.
    }
    writeStoredProductAuth(STORAGE_KEY, null);
    authRef.current = null;
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
      <Sidebar
        profile={profile}
        activeSection={activeSection}
        signOut={signOut}
        unreadAlertsCount={stats.unreadAlerts}
      />

      {operationStatus ? (
        <section className="panel" style={{ marginBottom: 20, borderLeft: "4px solid var(--primary)" }}>
          <div className="top-bar" style={{ marginBottom: 0 }}>
            <strong>{operationStatus}</strong>
            <button className="button-secondary" type="button" onClick={() => setOperationStatus(null)}>
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {activeSection === "overview" && (
        <OverviewSection
          stats={stats}
          report={report}
          calendar={calendar}
          alerts={alerts}
          threads={threads}
          matters={matters}
          markAlertRead={markAlertRead}
          openMatter={openMatter}
          router={router}
          profile={profile}
        />
      )}

      {activeSection === "matters" && (
        <MattersSection
          newMatter={newMatter}
          setNewMatter={setNewMatter}
          createMatter={createMatter}
          csvImport={csvImport}
          setCsvImport={setCsvImport}
          previewCsvImport={previewCsvImport}
          csvPreview={csvPreview}
          confirmCsvImport={confirmCsvImport}
          downloadRejectedRows={downloadRejectedRows}
          matterSearch={matterSearch}
          setMatterSearch={setMatterSearch}
          matterStatusFilter={matterStatusFilter}
          setMatterStatusFilter={setMatterStatusFilter}
          matters={matters}
          openMatter={openMatter}
          selectedMatter={selectedMatter}
          matterDraft={matterDraft}
          setMatterDraft={setMatterDraft}
          saveMatter={saveMatter}
          archiveMatter={archiveMatter}
          hearingListedAt={hearingListedAt}
          setHearingListedAt={setHearingListedAt}
          hearingOutcome={hearingOutcome}
          setHearingOutcome={setHearingOutcome}
          hearingNotes={hearingNotes}
          setHearingNotes={setHearingNotes}
          hearingNextDate={hearingNextDate}
          setHearingNextDate={setHearingNextDate}
          setHearingFile={setHearingFile}
          hearingFile={hearingFile}
          captureHearing={captureHearing}
          hearingStatus={hearingStatus}
          matterClientId={matterClientId}
          setMatterClientId={setMatterClientId}
          clients={clients}
          linkClientToMatter={linkClientToMatter}
          unlinkClientFromMatter={unlinkClientFromMatter}
          createPortalLink={createPortalLink}
          portalUrl={portalUrl}
          messages={messages}
          messageDraft={messageDraft}
          setMessageDraft={setMessageDraft}
          sendMessage={sendMessage}
          partyNameDrafts={partyNameDrafts}
          setPartyNameDrafts={setPartyNameDrafts}
          updateParty={updateParty}
          deleteParty={deleteParty}
          newParty={newParty}
          setNewParty={setNewParty}
          addParty={addParty}
          documentUpload={documentUpload}
          setDocumentUpload={setDocumentUpload}
          setDocumentFile={setDocumentFile}
          documentFile={documentFile}
          uploadDocument={uploadDocument}
          openDocument={openDocument}
        />
      )}

      {activeSection === "calendar" && (
        <CalendarSection
          calendar={calendar}
          unmatchedCauseEntries={unmatchedCauseEntries}
          courtReviewMatterIds={courtReviewMatterIds}
          setCourtReviewMatterIds={setCourtReviewMatterIds}
          matters={matters}
          linkUnmatchedCauseEntry={linkUnmatchedCauseEntry}
          calendarConflicts={calendarConflicts}
          courtSources={courtSources}
          openMatter={openMatter}
          router={router}
        />
      )}

      {activeSection === "alerts" && (
        <AlertsSection
          alerts={alerts}
          markAlertRead={markAlertRead}
          matters={matters}
          openMatter={openMatter}
          router={router}
        />
      )}

      {activeSection === "clients" && (
        <ClientsSection
          newClient={newClient}
          setNewClient={setNewClient}
          createClient={createClient}
          clients={clients}
          openClient={openClient}
          clientDetail={clientDetail}
          clientDraft={clientDraft}
          setClientDraft={setClientDraft}
          updateClient={updateClient}
          archiveClient={archiveClient}
          clientNotificationPreference={clientNotificationPreference}
          setClientNotificationPreference={setClientNotificationPreference}
          saveClientNotificationPreference={saveClientNotificationPreference}
          openMatter={openMatter}
          router={router}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          clientStatusFilter={clientStatusFilter}
          setClientStatusFilter={setClientStatusFilter}
        />
      )}

      {activeSection === "vault" && (
        <VaultSection
          searchVault={searchVault}
          documents={documents}
          openDocument={openDocument}
          updateDocumentVisibility={updateDocumentVisibility}
          viewingDocumentUrl={viewingDocumentUrl}
          viewingDocument={viewingDocument}
          closeDocumentViewer={closeDocumentViewer}
          zoomScale={zoomScale}
          setZoomScale={setZoomScale}
          isCloseHovered={isCloseHovered}
          setIsCloseHovered={setIsCloseHovered}
          matters={matters}
          uploadVaultDocument={uploadVaultDocument}
        />
      )}

      {activeSection === "settings" && (
        <SettingsSection
          profile={profile}
          settingsTab={settingsTab}
          setSettingsTab={setSettingsTab}
          notificationPreference={notificationPreference}
          setNotificationPreference={setNotificationPreference}
          saveNotificationPreference={saveNotificationPreference}
          teamMembers={teamMembers}
          setTeamMembers={setTeamMembers}
          invitePhone={invitePhone}
          setInvitePhone={setInvitePhone}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviteOfficeLabel={inviteOfficeLabel}
          setInviteOfficeLabel={setInviteOfficeLabel}
          handleSendInvite={handleSendInvite}
          handleUpdateMembership={handleUpdateMembership}
        />
      )}

      {activeSection === "onboarding" && (
        <section className="detail-grid">
          <div className="panel" style={{ margin: "0 auto", maxWidth: 600, width: "100%", textAlign: "center" }}>
            <div className="eyebrow">Onboarding Step</div>
            <h2 style={{ marginTop: 6 }}>Your Legal Bhai Workspace Is Ready</h2>
            <p className="muted">
              Your invited signup created a private solo-lawyer workspace. Finish these steps before relying on
              reminders for a real hearing.
            </p>
            <div className="actions" style={{ justifyContent: "center", marginTop: 24 }}>
              <button className="button" type="button" onClick={() => router.push("/matters")}>
                Add or Import First Matter
              </button>
              <button className="button-secondary" type="button" onClick={() => router.push("/settings")}>
                Review Reminder Settings
              </button>
              <button className="button-secondary" type="button" onClick={() => router.push("/clients")}>
                Add a Client
              </button>
            </div>
          </div>

          <div className="panel" style={{ margin: "24px auto 0", maxWidth: 600, width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Workspace Checklist</h2>
            <div className="grid">
              <div>
                <span className="badge live">Ready</span> Private Workspace: {profile.firm?.name}
              </div>
              <div>
                <span className="badge live">Ready</span> Owner: {profile.staffUser.displayName}
              </div>
              <div>
                <span className={`badge ${matters.length > 0 ? "live" : "secondary"}`}>
                  {matters.length > 0 ? "Ready" : "To do"}
                </span>{" "}
                First Matter
              </div>
              <div>
                <span className={`badge ${clients.length > 0 ? "live" : "secondary"}`}>
                  {clients.length > 0 ? "Ready" : "To do"}
                </span>{" "}
                First Client
              </div>
              <div>
                <span className={`badge ${notificationPreference ? "live" : "secondary"}`}>
                  {notificationPreference ? "Ready" : "To do"}
                </span>{" "}
                Reminder Preferences
              </div>
            </div>
          </div>
        </section>
      )}

      {viewingDocumentUrl && viewingDocument && activeSection !== "vault" && (
        <DocumentViewerModal
          viewingDocument={viewingDocument}
          viewingDocumentUrl={viewingDocumentUrl}
          closeDocumentViewer={closeDocumentViewer}
          zoomScale={zoomScale}
          setZoomScale={setZoomScale}
          isCloseHovered={isCloseHovered}
          setIsCloseHovered={setIsCloseHovered}
        />
      )}
    </main>
  );
}
