import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Modal,
  LayoutAnimation,
  UIManager,
  Animated,
} from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { API_BASE_URL, ApiRequestError, apiRequest } from "./api";
import { theme } from "./theme";
import { enqueueMutation, pendingMutationCount } from "./offline/queue";
import { flushOfflineQueue, startOfflineSyncAgent } from "./offline/sync-agent";

type ProductTab = "overview" | "matters" | "calendar" | "alerts";
type ClientWorkspaceTab = "hearings" | "documents" | "chat";

interface StaffProfile {
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
}

interface MatterListItem {
  id: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  nextHearingAt: string | null;
  courtId: string;
}

interface MatterDetail extends MatterListItem {
  normalizedCaseNumber?: string;
  matterType?: string;
  leadLawyerId?: string | null;
  hearings: Array<{
    id: string;
    listedAt: string;
    outcome: string;
    notes: string;
    nextDate: string | null;
  }>;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    ocrStatus: string;
    mimeType?: string;
    uploaderType?: string;
  }>;
  thread: { id: string } | null;
}

interface CalendarItem {
  id: string;
  listedAt: string;
  conflictState: string;
  sourceType: string;
  matter: MatterListItem;
}

interface AlertRecord {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt?: string;
}

interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  createdAt: string;
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

interface ThreadSummary {
  id: string;
  matter: MatterListItem;
  lastMessage: { body: string; createdAt: string } | null;
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

interface Invoice {
  id: string;
  status: string;
  total: number;
  dueAt: string | null;
  matterId?: string | null;
}

interface ClientDetailPayload {
  client: ClientSummary;
  matters: MatterListItem[];
  invoices: Invoice[];
  threadSummaries: ThreadSummary[];
}

interface DocumentRecord {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  ocrStatus: string;
  portalVisible: boolean;
  matterId: string | null;
  uploaderType?: string;
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

interface NotificationPreference {
  emailEnabled: boolean;
  smsEnabled: boolean;
  optedOutAt: string | null;
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

const spacing = {
  lg: 20,
};

const AUTH_STORAGE_KEY = "legalbahi-mobile-auth";
const CLIENT_STORAGE_KEY = "legalbahi-mobile-client-auth";
const OTP_ERROR_MESSAGE = "Invalid OTP. Please try again.";

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function formatPakistanDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("92")
    ? `0${digits.slice(2)}`
    : digits.length === 10
      ? `0${digits}`
      : digits;

  if (local.length === 11 && local.startsWith("0")) {
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }

  return phone;
}

function toPakistanPhoneSubmit(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  return cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
}

function userFacingOtpError(error: unknown): string {
  if (error instanceof ApiRequestError && (error.status === 400 || error.status === 401)) {
    return OTP_ERROR_MESSAGE;
  }
  if (error instanceof Error && /invalid\s+otp|verification code|code/i.test(error.message)) {
    return OTP_ERROR_MESSAGE;
  }
  return "Authentication failed. Please try again.";
}

interface ClientProfile {
  actorType: "client";
  clientAccount: { id: string; displayName: string; phone: string };
  firm: { id: string; name: string } | null;
}

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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "TBC";
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;

  const dateStr = d.toLocaleDateString("en-US", {
    timeZone: "Asia/Karachi",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const timeStr = d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  });

  if (value.length <= 10) return dateStr;
  return `${dateStr} • ${timeStr} PKT`;
}

function documentExtension(document: { title: string; mimeType?: string; type?: string }): string {
  const fromTitle = document.title.split(".").pop()?.toLowerCase();
  if (fromTitle && fromTitle.length <= 5 && fromTitle !== document.title.toLowerCase()) {
    return fromTitle;
  }
  if (document.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "docx";
  }
  if (document.mimeType === "application/pdf") {
    return "pdf";
  }
  if (document.mimeType?.startsWith("image/")) {
    return "png";
  }
  return document.type?.toLowerCase() || "file";
}

function toTitleCase(str: string): string {
  if (!str) return str;
  return str.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function formatTwoLineLabel(value: string, limit = 32): string {
  if (value.length <= limit || value.includes("\n")) {
    return value;
  }
  const words = value.split(/\s+/);
  const midpoint = value.length / 2;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let cursor = 0;

  for (let index = 0; index < words.length - 1; index += 1) {
    cursor += words[index].length;
    const distance = Math.abs(cursor - midpoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
    cursor += 1;
  }

  if (bestIndex < 0) {
    return value;
  }
  return `${words.slice(0, bestIndex + 1).join(" ")}\n${words.slice(bestIndex + 1).join(" ")}`;
}

function documentIcon(document: { title: string; mimeType?: string; type?: string }): string {
  const extension = documentExtension(document);
  if (extension === "pdf") return "PDF";
  if (extension === "docx" || extension === "doc") return "DOCX";
  if (["jpg", "jpeg", "png"].includes(extension)) return "IMG";
  return "FILE";
}

function animateTransition() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export function ProductApp({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<"lawyer" | "client">("lawyer");
  const [phone, setPhone] = useState("");
  const [auth, setAuth] = useState<{ token: string; refreshToken: string | null } | null>(null);
  const [clientAuth, setClientAuth] = useState<{ token: string; refreshToken: string | null } | null>(null);

  const authRef = useRef<{ token: string; refreshToken: string | null } | null>(null);
  const clientAuthRef = useRef<{ token: string; refreshToken: string | null } | null>(null);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    clientAuthRef.current = clientAuth;
  }, [clientAuth]);

  const phoneInputRef = useRef<TextInput | null>(null);
  const loginScrollRef = useRef<ScrollView | null>(null);
  const clientFlatListRef = useRef<FlatList | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [clientMatters, setClientMatters] = useState<MatterListItem[]>([]);
  const [clientSelectedMatter, setClientSelectedMatter] = useState<MatterDetail | null>(null);
  const [clientMessages, setClientMessages] = useState<MessageRecord[]>([]);
  const [clientWorkspaceTab, setClientWorkspaceTab] = useState<ClientWorkspaceTab>("hearings");
  const [clientDocumentFilter, setClientDocumentFilter] = useState<string>("All");

  const tabOpacity = useRef(new Animated.Value(1)).current;

  const changeClientTab = (newTab: ClientWorkspaceTab) => {
    if (newTab === clientWorkspaceTab) return;
    Animated.timing(tabOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setClientWorkspaceTab(newTab);
      if (newTab === "documents") {
        setClientDocumentFilter("All");
      }
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };
  const [clientMessageDraft, setClientMessageDraft] = useState("");
  const [clientUploading, setClientUploading] = useState(false);
  const [isTypeModalVisible, setIsTypeModalVisible] = useState(false);
  const [selectedTypeForPicker, setSelectedTypeForPicker] = useState<string | null>(null);
  const [isUploadOptionsModalVisible, setIsUploadOptionsModalVisible] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [tab, setTab] = useState<ProductTab>("overview");
  const [matters, setMatters] = useState<MatterListItem[]>([]);
  const [report, setReport] = useState<OverviewReport | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [courtSources, setCourtSources] = useState<CourtSource[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [activeMenuModal, setActiveMenuModal] = useState<"clients" | "vault" | "settings" | null>(null);

  // Clients modal states
  const [newClient, setNewClient] = useState({ displayName: "", phone: "", language: "en" });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetailPayload | null>(null);
  const [clientDraft, setClientDraft] = useState({ displayName: "", language: "en", status: "active" });
  const [clientNotificationPreference, setClientNotificationPreference] = useState<NotificationPreference | null>(null);
  const [clientsSearchQuery, setClientsSearchQuery] = useState("");

  // Vault modal states
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [isVaultTypeModalVisible, setIsVaultTypeModalVisible] = useState(false);
  const [selectedVaultType, setSelectedVaultType] = useState<string | null>(null);
  const [isVaultUploadOptionsVisible, setIsVaultUploadOptionsVisible] = useState(false);
  const [vaultUploading, setVaultUploading] = useState(false);

  // Settings modal states
  const [settingsTab, setSettingsTab] = useState<"profile" | "workspace">("profile");
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference | null>(null);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "lawyer" | "assistant" | "billing" | "co_owner">("lawyer");
  const [inviteOfficeLabel, setInviteOfficeLabel] = useState("");
  const [selectedMatter, setSelectedMatter] = useState<MatterDetail | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [hearingOutcome, setHearingOutcome] = useState("Order reserved");
  const [hearingNotes, setHearingNotes] = useState("Counsel appeared. Short written note to be filed before the next listing.");
  const [hearingNextDate, setHearingNextDate] = useState("");
  const [hearingImageUri, setHearingImageUri] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentImageUri, setDocumentImageUri] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [otpRequested, setOtpRequested] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [authErrorText, setAuthErrorText] = useState<string | null>(null);
  const [clientWorkspaceLoading, setClientWorkspaceLoading] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [registration, setRegistration] = useState({
    displayName: "",
    email: "",
    firmName: "",
    primaryCity: "",
  });
  const otpInputRefs = useRef<Array<TextInput | null>>(Array(6).fill(null));
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);

  const renderClientHeader = () => {
    if (!clientProfile) return null;
    return (
      <View style={styles.clientHeader}>
        <View style={styles.flexShrink}>
          <Text style={styles.eyebrow}>Client Portal</Text>
          <Text style={styles.clientTitleName}>{clientProfile.clientAccount.displayName}</Text>
          <Text style={styles.clientProfileFirm}>{clientProfile.firm?.name ?? "Your lawyer workspace"}</Text>
          <Text style={styles.clientProfilePhone}>{formatPakistanDisplayPhone(clientProfile.clientAccount.phone)}</Text>
        </View>
        <Pressable style={styles.headerSignOutButton} onPress={() => void signOutClient()}>
          <Text style={styles.headerSignOutText}>Sign out</Text>
        </Pressable>
      </View>
    );
  };

  const renderMatterSwitcher = () => {
    return (
      <View>
        <Text style={styles.fieldLabel}>Shared Matters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.matterSwitcher}
          keyboardShouldPersistTaps="handled"
        >
          {clientMatters.map((matter) => {
            const active = clientSelectedMatter?.id === matter.id;
            return (
              <Pressable
                key={matter.id}
                style={[styles.matterPill, active ? styles.matterPillActive : null]}
                onPress={() => void openClientMatter(matter.id)}
              >
                <Text style={active ? styles.matterPillActiveText : styles.matterPillText}>
                  {matter.rawCaseNumber}
                </Text>
                <Text style={active ? styles.matterPillActiveSubText : styles.matterPillSubText}>
                  {toTitleCase(matter.stage)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderClientTabBar = () => {
    return (
      <View style={[styles.tabRow, { marginVertical: 0 }]}>
        {(["hearings", "documents", "chat"] as const).map((tabKey) => (
          <Pressable
            key={tabKey}
            style={[styles.pill, clientWorkspaceTab === tabKey ? styles.pillActive : null]}
            onPress={() => changeClientTab(tabKey)}
          >
            <Text style={clientWorkspaceTab === tabKey ? styles.pillActiveText : styles.pillText}>{tabKey}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  useEffect(() => {
    if (!auth?.token) {
      return;
    }
    setOfflineQueueSize(pendingMutationCount());
    return startOfflineSyncAgent(() => auth.token);
  }, [auth?.token]);

  useEffect(() => {
    void Promise.all([
      SecureStore.getItemAsync(AUTH_STORAGE_KEY),
      SecureStore.getItemAsync(CLIENT_STORAGE_KEY),
    ])
      .then(([staffValue, clientValue]) => {
        if (staffValue) {
          setAuth(JSON.parse(staffValue) as { token: string; refreshToken: string | null });
        }
        if (clientValue) {
          setClientAuth(JSON.parse(clientValue) as { token: string; refreshToken: string | null });
        }
      })
      .finally(() => setAuthHydrated(true));
  }, []);

  useEffect(() => {
    const code = otpDigits.join("");
    if (code.length === 6 && /^\d{6}$/.test(code) && otpRequested) {
      if (activeTab === "lawyer") {
        void verifyLawyerLogin(code);
      } else {
        void verifyClientLogin(code);
      }
    }
  }, [otpDigits, activeTab, otpRequested]);

  useEffect(() => {
    if (otpRequested) {
      const timer = setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [otpRequested]);

  useEffect(() => {
    if (!otpRequested) {
      const timer = setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [otpRequested, activeTab, registrationMode]);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!clientAuth) {
      void SecureStore.deleteItemAsync(CLIENT_STORAGE_KEY);
      setClientProfile(null);
      setClientMatters([]);
      setClientSelectedMatter(null);
      setClientMessages([]);
      setClientWorkspaceLoading(false);
      return;
    }
    void SecureStore.setItemAsync(CLIENT_STORAGE_KEY, JSON.stringify(clientAuth));
    if (!clientProfile) {
      setClientWorkspaceLoading(true);
      void apiRequest<{ profile: ClientProfile }>("/v1/me", {}, clientAuth.token)
        .then(async (payload) => {
          await loadClientWorkspace(clientAuth);
          setClientProfile(payload.profile);
        })
        .catch((error) => {
          setClientAuth(null);
          setClientProfile(null);
          setClientMatters([]);
          setClientSelectedMatter(null);
          setClientMessages([]);
          Alert.alert("Client workspace unavailable", error instanceof Error ? error.message : "Sign in again to continue.");
        })
        .finally(() => {
          setClientWorkspaceLoading(false);
        });
    }
  }, [clientAuth, authHydrated, clientProfile]);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!auth) {
      void SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      return;
    }
    void SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(auth));
    if (!profile) {
      void loadWorkspace(auth).catch((error) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          setAuth(null);
          setProfile(null);
          Alert.alert("Session expired", "Sign in again to continue.");
          return;
        }
        Alert.alert("Workspace load failed", error instanceof Error ? error.message : "Unknown error");
      });
    }
  }, [auth, authHydrated, profile]);

  async function authedRequest<T>(
    path: string,
    options: RequestInit = {},
    activeAuth = authRef.current,
  ): Promise<{ data: T; auth: { token: string; refreshToken: string | null } }> {
    if (!activeAuth) {
      throw new Error("Authentication required");
    }

    try {
      return {
        data: await apiRequest<T>(path, options, activeAuth.token),
        auth: activeAuth,
      };
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401 || !activeAuth.refreshToken) {
        throw error;
      }

      const refreshed = await apiRequest<{ token: string; refreshToken: string | null }>("/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: activeAuth.refreshToken }),
      });
      const nextAuth = { token: refreshed.token, refreshToken: refreshed.refreshToken };
      authRef.current = nextAuth;
      void SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      setAuth(nextAuth);

      return {
        data: await apiRequest<T>(path, options, nextAuth.token),
        auth: nextAuth,
      };
    }
  }

  async function clientAuthedRequest<T>(
    path: string,
    options: RequestInit = {},
    activeClientAuth = clientAuthRef.current,
  ): Promise<{ data: T; auth: { token: string; refreshToken: string | null } }> {
    if (!activeClientAuth) {
      throw new Error("Client authentication required");
    }

    try {
      return {
        data: await apiRequest<T>(path, options, activeClientAuth.token),
        auth: activeClientAuth,
      };
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401 || !activeClientAuth.refreshToken) {
        throw error;
      }

      const refreshed = await apiRequest<{ token: string; refreshToken: string | null }>("/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: activeClientAuth.refreshToken }),
      });
      const nextAuth = { token: refreshed.token, refreshToken: refreshed.refreshToken };
      clientAuthRef.current = nextAuth;
      void SecureStore.setItemAsync(CLIENT_STORAGE_KEY, JSON.stringify(nextAuth));
      setClientAuth(nextAuth);

      return {
        data: await apiRequest<T>(path, options, nextAuth.token),
        auth: nextAuth,
      };
    }
  }

  function focusFirstOtpInput() {
    setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
  }

  function transitionOtpRequested(nextValue: boolean) {
    animateTransition();
    setOtpRequested(nextValue);
  }

  async function loadWorkspace(activeAuth: { token: string; refreshToken: string | null }) {
    let resolvedAuth = activeAuth;

    const meResponse = await authedRequest<{ profile: StaffProfile }>("/v1/me", {}, resolvedAuth);
    const me = meResponse.data;
    resolvedAuth = meResponse.auth;
    setProfile(me.profile);

    const matterResponse = await authedRequest<{ matters: MatterListItem[] }>("/v1/matters", {}, resolvedAuth);
    resolvedAuth = matterResponse.auth;
    const calendarResponse = await authedRequest<{ items: CalendarItem[] }>("/v1/calendar", {}, resolvedAuth);
    resolvedAuth = calendarResponse.auth;
    const alertResponse = await authedRequest<{ alerts: AlertRecord[] }>("/v1/alerts", {}, resolvedAuth);
    resolvedAuth = alertResponse.auth;
    const sourceResponse = await authedRequest<{ courtSources: CourtSource[] }>("/v1/court-sources", {}, resolvedAuth);
    resolvedAuth = sourceResponse.auth;
    const threadResponse = await authedRequest<{ threads: ThreadSummary[] }>("/v1/threads", {}, resolvedAuth);
    resolvedAuth = threadResponse.auth;
    const clientResponse = await authedRequest<{ clients: ClientSummary[] }>("/v1/clients", {}, resolvedAuth);
    resolvedAuth = clientResponse.auth;
    const documentResponse = await authedRequest<{ documents: DocumentRecord[] }>("/v1/documents", {}, resolvedAuth);
    resolvedAuth = documentResponse.auth;
    const reportResponse = await authedRequest<OverviewReport>("/v1/reports/overview", {}, resolvedAuth);
    resolvedAuth = reportResponse.auth;
    const preferenceResponse = await authedRequest<{ preference: NotificationPreference | null }>("/v1/notifications/preferences", {}, resolvedAuth);
    resolvedAuth = preferenceResponse.auth;

    setMatters(matterResponse.data.matters);
    setCalendar(calendarResponse.data.items);
    setAlerts(alertResponse.data.alerts);
    setCourtSources(sourceResponse.data.courtSources);
    setThreads(threadResponse.data.threads);
    setClients(clientResponse.data.clients);
    setDocuments(documentResponse.data.documents);
    setReport(reportResponse.data);
    setNotificationPreference(preferenceResponse.data.preference);

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

    if (!selectedMatter && matterResponse.data.matters[0]) {
      await openMatter(matterResponse.data.matters[0].id, resolvedAuth);
    }
  }

  async function markAlertRead(alertId: string) {
    if (!auth) return;
    try {
      const payload = await authedRequest(`/v1/alerts/${alertId}`, { method: "PATCH" }, auth);
      await loadWorkspace(payload.auth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to mark alert as read.");
    }
  }

  async function syncCourtSource(sourceId: string) {
    if (!auth) return;
    try {
      const payload = await authedRequest<{ courtSource?: CourtSource; warning?: string }>(
        `/v1/court-sources/${sourceId}/sync`,
        { method: "POST" },
        auth,
      );
      const source = payload.data.courtSource;
      setSyncMessage(
        payload.data.warning
          ? `${courtLabel(source?.courtId ?? sourceId)} degraded: ${payload.data.warning}`
          : `Synced ${courtLabel(source?.courtId ?? sourceId)} successfully.`
      );
      await loadWorkspace(payload.auth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Sync request failed.");
    }
  }

  async function createClient() {
    if (!auth) return;
    try {
      const response = await authedRequest("/v1/clients", {
        method: "POST",
        body: JSON.stringify(newClient),
      }, auth);
      setNewClient({ displayName: "", phone: "", language: "en" });
      setOperationStatus("Client created successfully.");
      await loadWorkspace(response.auth);
    } catch (e: any) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create client.");
    }
  }

  async function openClient(clientId: string, activeAuth = auth) {
    if (!activeAuth) return;
    try {
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
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not open client details.");
    }
  }

  async function updateClient() {
    if (!auth || !clientDetail) return;
    try {
      const response = await authedRequest(`/v1/clients/${clientDetail.client.id}`, {
        method: "PATCH",
        body: JSON.stringify(clientDraft),
      }, auth);
      setOperationStatus("Client updated.");
      await loadWorkspace(response.auth);
      await openClient(clientDetail.client.id, response.auth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update client.");
    }
  }

  async function archiveClient() {
    if (!auth || !clientDetail) return;
    Alert.alert(
      "Archive Client",
      "Are you sure you want to archive this client and revoke their portal access?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await authedRequest(`/v1/clients/${clientDetail.client.id}`, { method: "DELETE" }, auth);
              setOperationStatus("Client archived and portal access revoked.");
              setSelectedClientId(null);
              setClientDetail(null);
              await loadWorkspace(response.auth);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to archive client.");
            }
          }
        }
      ]
    );
  }

  async function saveClientNotificationPreference() {
    if (!auth || !clientDetail || !clientNotificationPreference) return;
    try {
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
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save reminders consent.");
    }
  }

  async function updateDocumentVisibility(document: DocumentRecord | any) {
    if (!auth) return;
    try {
      const response = await authedRequest(`/v1/documents/${document.id}`, {
        method: "PATCH",
        body: JSON.stringify({ portalVisible: !document.portalVisible }),
      }, auth);
      setOperationStatus(document.portalVisible ? "Document removed from client portal." : "Document shared with linked client.");
      await loadWorkspace(response.auth);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update visibility.");
    }
  }

  async function saveNotificationPreference() {
    if (!auth || !notificationPreference) return;
    try {
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
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save preferences.");
    }
  }

  async function handleSendInvite() {
    if (!profile?.firm || !auth) return;
    setOperationStatus("Sending invitation...");
    try {
      const cleanPhone = invitePhone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      const response = await authedRequest(`/v1/firms/${profile.firm.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          role: inviteRole,
          officeLabel: inviteOfficeLabel || null,
          email: inviteEmail || null
        })
      }, auth);
      setInvitePhone("");
      setInviteOfficeLabel("");
      setInviteEmail("");
      setOperationStatus("Invitation sent successfully!");
      await loadWorkspace(response.auth);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send invitation.");
    }
  }

  async function handleUpdateMembership(membershipId: string, role: string, officeLabel: string | null) {
    if (!auth || !profile?.firm) return;
    setOperationStatus("Updating member...");
    try {
      const response = await authedRequest(`/v1/memberships/${membershipId}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          officeLabel
        })
      }, auth);
      setOperationStatus("Member updated successfully!");
      await loadWorkspace(response.auth);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update member.");
    }
  }

  async function loadClientWorkspace(activeClientAuth: { token: string; refreshToken: string | null }) {
    const matterResponse = await clientAuthedRequest<{ matters: MatterListItem[] }>("/v1/clients/me/matters", {}, activeClientAuth);
    const matterPayload = matterResponse.data;
    setClientMatters(matterPayload.matters);

    const firstMatterId = clientSelectedMatter?.id ?? matterPayload.matters[0]?.id;
    if (firstMatterId) {
      await openClientMatter(firstMatterId, matterResponse.auth, { animate: false });
      return;
    }
    setClientSelectedMatter(null);
    setClientMessages([]);
  }

  function resetAuthFlow() {
    transitionOtpRequested(false);
    setOtpDigits(Array(6).fill(""));
    setOperationStatus(null);
    setAuthErrorText(null);
  }

  function handleTabChange(tab: "lawyer" | "client") {
    animateTransition();
    setActiveTab(tab);
    setPhone("");
    resetAuthFlow();
    setRegistrationMode(false);
    setRegistration({
      displayName: "",
      email: "",
      firmName: "",
      primaryCity: "",
    });
  }

  async function startLawyerLogin(options?: { resend?: boolean }) {
    setOperationStatus(null);
    setAuthErrorText(null);
    if (registrationMode) {
      if (!registration.displayName.trim() || !registration.firmName.trim() || !registration.primaryCity.trim()) {
        setOperationStatus("Please fill in all required fields to create a workspace.");
        return;
      }
    }
    setOperationStatus(options?.resend ? "Sending a new verification code..." : "Requesting OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      await apiRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          actorType: "staff",
          purpose: registrationMode ? "register" : "login",
        }),
      });
      setOtpDigits(Array(6).fill(""));
      setOperationStatus(
        options?.resend
          ? "A new verification code has been sent to your phone number."
          : "A verification code has been sent to your phone number.",
      );
      transitionOtpRequested(true);
      focusFirstOtpInput();
    } catch (error) {
      setOperationStatus(error instanceof Error ? error.message : "Failed to request OTP.");
    }
  }

  async function verifyLawyerLogin(codeOverride?: string) {
    const codeToUse = codeOverride ?? otpDigits.join("");
    setAuthErrorText(null);
    setOperationStatus(registrationMode ? "Creating workspace..." : "Verifying OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      const path = registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify";
      const bodyPayload = registrationMode
        ? {
            phone: formattedPhone,
            code: codeToUse,
            displayName: registration.displayName.trim(),
            firmName: registration.firmName,
            email: registration.email.trim() ? registration.email.trim() : null,
            primaryCity: registration.primaryCity,
          }
        : { phone: formattedPhone, actorType: "staff", code: codeToUse };

      const payload = await apiRequest<{ token: string; refreshToken: string | null }>(path, {
        method: "POST",
        body: JSON.stringify(bodyPayload),
      });
      setClientAuth(null);
      setClientProfile(null);
      setClientWorkspaceLoading(false);
      setAuth({ token: payload.token, refreshToken: payload.refreshToken });
      setOperationStatus("Authentication successful.");
    } catch (error) {
      setOperationStatus(null);
      setAuthErrorText(userFacingOtpError(error));
    }
  }

  async function startClientLogin(options?: { resend?: boolean }) {
    setOperationStatus(null);
    setAuthErrorText(null);
    setOperationStatus(options?.resend ? "Sending a new verification code..." : "Requesting client OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      const response = await apiRequest<{ devCode: string | null; expiresAt: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          actorType: "client",
          purpose: "login",
        }),
      });
      if (response.expiresAt === null) {
        setOperationStatus("Client account not found. Please contact your lawyer.");
        return;
      }
      setOtpDigits(Array(6).fill(""));
      setOperationStatus(
        options?.resend
          ? "A new verification code has been sent to your phone number."
          : "A verification code has been sent to your phone number.",
      );
      transitionOtpRequested(true);
      focusFirstOtpInput();
    } catch (error) {
      setOperationStatus(error instanceof Error ? error.message : "Failed to request OTP.");
    }
  }

  async function verifyClientLogin(codeOverride?: string) {
    const codeToUse = codeOverride ?? otpDigits.join("");
    setAuthErrorText(null);
    setOperationStatus("Verifying client OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      const payload = await apiRequest<{ token: string; refreshToken: string | null }>("/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: formattedPhone, actorType: "client", code: codeToUse }),
      });
      setAuth(null);
      setProfile(null);
      setClientWorkspaceLoading(true);
      setClientAuth({ token: payload.token, refreshToken: payload.refreshToken });
      setOperationStatus("Authentication successful.");
    } catch (error) {
      setOperationStatus(null);
      setAuthErrorText(userFacingOtpError(error));
    }
  }

  function handleOtpChange(index: number, value: string) {
    const cleanValue = value.replace(/[^0-9]/g, "");
    if (cleanValue.length > 1) {
      const nextDigits = [...otpDigits];
      cleanValue.slice(0, 6 - index).split("").forEach((digit, offset) => {
        nextDigits[index + offset] = digit;
      });
      setOtpDigits(nextDigits);
      const nextIndex = Math.min(index + cleanValue.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanValue;
    setOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(index: number, key: string) {
    if (key !== "Backspace" || otpDigits[index] || index === 0) {
      return;
    }
    const nextDigits = [...otpDigits];
    nextDigits[index - 1] = "";
    setOtpDigits(nextDigits);
    otpInputRefs.current[index - 1]?.focus();
  }

  async function openMatter(matterId: string, activeAuth = auth) {
    if (!activeAuth) {
      return;
    }
    const { data: payload, auth: resolvedAuth } = await authedRequest<{ matter: MatterDetail }>(`/v1/matters/${matterId}`, {}, activeAuth);
    setSelectedMatter(payload.matter);
    if (payload.matter.thread?.id) {
      const threadPayload = await authedRequest<{ messages: MessageRecord[] }>(
        `/v1/threads/${payload.matter.thread.id}/messages`,
        {},
        resolvedAuth,
      );
      setMessages(threadPayload.data.messages);
    } else {
      setMessages([]);
    }
  }

  async function openClientMatter(
    matterId: string,
    activeClientAuth = clientAuth,
    options: { animate?: boolean } = {},
  ) {
    if (!activeClientAuth) {
      return;
    }
    const shouldAnimate = options.animate ?? true;
    try {
      if (clientSelectedMatter?.id !== matterId) {
        if (shouldAnimate) {
          animateTransition();
        }
        setClientWorkspaceTab("hearings");
        setClientDocumentFilter("All");
      }
      const { data: payload, auth: resolvedAuth } = await clientAuthedRequest<{ matter: MatterDetail }>(
        `/v1/clients/me/matters/${matterId}`,
        {},
        activeClientAuth,
      );
      if (shouldAnimate) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setClientSelectedMatter(payload.matter);
      if (payload.matter.thread?.id) {
        const threadPayload = await clientAuthedRequest<{ messages: MessageRecord[] }>(
          `/v1/threads/${payload.matter.thread.id}/messages`,
          {},
          resolvedAuth,
        );
        setClientMessages(threadPayload.data.messages);
        return;
      }
      setClientMessages([]);
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setClientAuth(null);
        setClientProfile(null);
        Alert.alert("Session expired", "Please request OTP again to continue.");
        return;
      }
      Alert.alert("Matter unavailable", error instanceof Error ? error.message : "Could not open this matter.");
    }
  }

  async function sendClientMessage() {
    if (!clientAuth || !clientSelectedMatter?.thread?.id || !clientMessageDraft.trim()) {
      return;
    }
    try {
      const payload = await clientAuthedRequest(`/v1/threads/${clientSelectedMatter.thread.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: clientMessageDraft.trim(),
          language: "en",
          deliveryChannel: "in_app",
        }),
      }, clientAuth);
      setClientMessageDraft("");
      await openClientMatter(clientSelectedMatter.id, payload.auth);
    } catch (error) {
      Alert.alert("Message failed", error instanceof Error ? error.message : "Could not send this message.");
    }
  }

  async function openClientDocument(document: MatterDetail["documents"][number]) {
    if (!clientAuthRef.current) {
      return;
    }
    try {
      const extension = documentExtension(document);
      const safeTitle = document.title.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const filename = safeTitle.includes(".") ? safeTitle : `${safeTitle}.${extension}`;
      const destination = new FileSystem.File(FileSystem.Paths.cache, filename);
      
      let token = clientAuthRef.current.token;
      let result;
      try {
        result = await FileSystem.File.downloadFileAsync(
          `${API_BASE_URL}/v1/documents/${document.id}/download`,
          destination,
          { headers: { authorization: `Bearer ${token}` }, idempotent: true },
        );
      } catch (error) {
        const is401 = error instanceof Error && (
          error.message.includes("401") ||
          error.message.includes("status 401") ||
          error.message.includes("status: 401")
        );
        if (is401 && clientAuthRef.current.refreshToken) {
          const refreshed = await apiRequest<{ token: string; refreshToken: string | null }>("/v1/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken: clientAuthRef.current.refreshToken }),
          });
          const nextAuth = { token: refreshed.token, refreshToken: refreshed.refreshToken };
          clientAuthRef.current = nextAuth;
          void SecureStore.setItemAsync(CLIENT_STORAGE_KEY, JSON.stringify(nextAuth));
          setClientAuth(nextAuth);
          
          result = await FileSystem.File.downloadFileAsync(
            `${API_BASE_URL}/v1/documents/${document.id}/download`,
            destination,
            { headers: { authorization: `Bearer ${refreshed.token}` }, idempotent: true },
          );
        } else {
          if (error instanceof Error && (
            error.message.includes("404") ||
            error.message.includes("status: 404") ||
            error.message.includes("status 404")
          )) {
            throw new Error("Document not found");
          }
          throw error;
        }
      }

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        Alert.alert("Document saved", `Downloaded to ${result.uri}`);
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: document.mimeType,
        dialogTitle: document.title,
      });
    } catch (error) {
      Alert.alert("Document unavailable", error instanceof Error ? error.message : "Could not open this document.");
    }
  }

  function uploadClientDocument() {
    setIsTypeModalVisible(true);
  }

  async function executeClientUpload(fileObj: { uri: string; name: string; type: string }, docType: string) {
    if (!clientAuth || !clientSelectedMatter) {
      return;
    }
    try {
      setClientUploading(true);

      const form = new FormData();
      form.append("matterId", clientSelectedMatter.id);
      form.append("type", docType);
      form.append("documentType", docType);
      form.append("title", fileObj.name);
      form.append("portalVisible", "true");
      form.append("file", {
        uri: fileObj.uri,
        name: fileObj.name,
        type: fileObj.type,
      } as unknown as Blob);

      const response = await clientAuthedRequest<{ document: any }>("/v1/documents", {
        method: "POST",
        body: form,
      }, clientAuth);

      await openClientMatter(clientSelectedMatter.id, response.auth);
      Alert.alert("Success", "Document uploaded successfully.");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setClientUploading(false);
      setSelectedTypeForPicker(null);
    }
  }

  async function clientPickCameraPhoto() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsUploadOptionsModalVisible(false);
    if (!selectedTypeForPicker) {
      Alert.alert("Error", "No document category selected.");
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera permission required", "Legal Bhai needs camera access to take document photos.");
        return;
      }
      const image = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (image.canceled) {
        setSelectedTypeForPicker(null);
        return;
      }
      const asset = image.assets[0];
      const fileObj = {
        uri: asset.uri,
        name: asset.fileName || `camera_photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
      void executeClientUpload(fileObj, selectedTypeForPicker);
    } catch (error) {
      Alert.alert("Camera error", error instanceof Error ? error.message : "Could not open camera.");
      setSelectedTypeForPicker(null);
    }
  }

  async function clientPickLibraryPhoto() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsUploadOptionsModalVisible(false);
    if (!selectedTypeForPicker) {
      Alert.alert("Error", "No document category selected.");
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo permission required", "Legal Bhai needs photos access to select document images.");
        return;
      }
      const image = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, selectionLimit: 1 });
      if (image.canceled) {
        setSelectedTypeForPicker(null);
        return;
      }
      const asset = image.assets[0];
      const fileObj = {
        uri: asset.uri,
        name: asset.fileName || `library_photo_${Date.now()}.jpg`,
        type: "image/jpeg",
      };
      void executeClientUpload(fileObj, selectedTypeForPicker);
    } catch (error) {
      Alert.alert("Library error", error instanceof Error ? error.message : "Could not open library.");
      setSelectedTypeForPicker(null);
    }
  }

  async function clientPickDocumentFile() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsUploadOptionsModalVisible(false);
    if (!selectedTypeForPicker) {
      Alert.alert("Error", "No document category selected.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "image/*"
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setSelectedTypeForPicker(null);
        return;
      }

      const asset = result.assets[0];
      const fileObj = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      };
      void executeClientUpload(fileObj, selectedTypeForPicker);
    } catch (error) {
      Alert.alert("File picker error", error instanceof Error ? error.message : "Could not pick file.");
      setSelectedTypeForPicker(null);
    }
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

  async function saveHearingUpdate() {
    if (!auth || !selectedMatter) {
      return;
    }

    const hearingPayload = {
      listedAt: new Date().toISOString(),
      outcome: hearingOutcome,
      notes: hearingNotes,
      nextDate: hearingNextDate || "",
      sourceType: "manual_staff_mobile",
    };

    try {
      if (hearingImageUri) {
        const form = new FormData();
        form.append("listedAt", hearingPayload.listedAt);
        form.append("outcome", hearingPayload.outcome);
        form.append("notes", hearingPayload.notes);
        form.append("nextDate", hearingPayload.nextDate);
        form.append("sourceType", hearingPayload.sourceType);
        form.append("file", { uri: hearingImageUri, name: "hearing-order.jpg", type: "image/jpeg" } as unknown as Blob);
        const payload = await authedRequest(`/v1/matters/${selectedMatter.id}/hearings`, { method: "POST", body: form }, auth);
        await completeHearingSave(payload.auth);
        return;
      }

      const payload = await authedRequest(`/v1/matters/${selectedMatter.id}/hearings`, {
        method: "POST",
        body: JSON.stringify(hearingPayload),
      }, auth);
      await completeHearingSave(payload.auth);
    } catch (error) {
      const shouldQueue =
        error instanceof ApiRequestError &&
        (error.status === 0 || error.status >= 500 || /network|timeout|fetch/i.test(error.message));
      if (shouldQueue && !hearingImageUri) {
        enqueueMutation({
          path: `/v1/matters/${selectedMatter.id}/hearings`,
          method: "POST",
          body: hearingPayload,
        });
        setOfflineQueueSize(pendingMutationCount());
        Alert.alert("Saved offline", "The hearing update will sync automatically when connectivity returns.");
        return;
      }
      Alert.alert("Save failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function completeHearingSave(activeAuth: { token: string; refreshToken: string | null }) {
    setHearingOutcome("Order reserved");
    setHearingNotes("Counsel appeared. Short written note to be filed before the next listing.");
    setHearingNextDate("");
    setHearingImageUri(null);
    await loadWorkspace(activeAuth);
    if (selectedMatter) {
      await openMatter(selectedMatter.id, activeAuth);
    }
    const flushed = await flushOfflineQueue(activeAuth.token);
    if (flushed > 0) {
      setOfflineQueueSize(pendingMutationCount());
    }
    Alert.alert("Hearing saved", "The matter timeline has been updated.");
  }

  async function pickHearingImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission required", "Legal Bhai needs camera access to upload hearing orders.");
      return;
    }
    const image = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!image.canceled) {
      setHearingImageUri(image.assets[0].uri);
    }
  }

  async function pickDocumentImage() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission required", "Legal Bhai needs camera access to upload matter documents.");
      return;
    }
    const image = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!image.canceled) {
      setDocumentImageUri(image.assets[0].uri);
    }
  }

  async function uploadMatterDocument() {
    if (!auth || !selectedMatter || !documentImageUri || !documentTitle.trim()) {
      Alert.alert("Document details required", "Add a title and take a document photo before uploading.");
      return;
    }

    try {
      const form = new FormData();
      form.append("matterId", selectedMatter.id);
      form.append("type", "general");
      form.append("title", documentTitle.trim());
      form.append("portalVisible", "false");
      form.append("file", {
        uri: documentImageUri,
        name: `matter-document-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
      const payload = await authedRequest("/v1/documents", { method: "POST", body: form }, auth);
      setDocumentTitle("");
      setDocumentImageUri(null);
      await openMatter(selectedMatter.id, payload.auth);
      Alert.alert("Success", "Document uploaded successfully.");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function signOut() {
    if (auth) {
      try {
        await apiRequest("/v1/auth/logout", { method: "POST" }, auth.token);
      } catch {
        // Clear the secure local session even if the network is unavailable.
      }
    }
    setAuth(null);
    setProfile(null);
    setSelectedMatter(null);
    setMessages([]);
  }

  async function signOutClient() {
    if (clientAuth) {
      try {
        await apiRequest("/v1/auth/logout", { method: "POST" }, clientAuth.token);
      } catch {
        // Clear local session even if network is unavailable.
      }
    }
    setClientAuth(null);
    setClientProfile(null);
    setClientMatters([]);
    setClientSelectedMatter(null);
    setClientMessages([]);
    setClientMessageDraft("");
    setClientWorkspaceLoading(false);
    resetAuthFlow();
  }

  if (clientAuth && (clientWorkspaceLoading || !clientProfile)) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.sectionTitle}>Loading client workspace</Text>
          <Text style={[styles.copy, styles.centerText]}>Checking your shared matters and preparing the latest workspace.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (clientAuth && clientProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={16}
        >
          {renderClientHeader()}

          {clientWorkspaceLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.sectionTitle}>Loading client workspace</Text>
              <Text style={[styles.copy, styles.centerText]}>Checking your shared matters and preparing the latest workspace.</Text>
            </View>
          ) : clientMatters.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>LB</Text>
              <Text style={styles.sectionTitle}>No shared matters yet</Text>
              <Text style={[styles.copy, styles.centerText]}>
                Your lawyer has not shared a matter with this client account. Once a matter is linked, it will appear here automatically.
              </Text>
            </View>
          ) : clientWorkspaceTab === "chat" && clientSelectedMatter ? (
            // Chat Tab Layout: Fixed header/switcher/tabs + Auto-scrolling FlatList + bottom input row
            <>
              <View style={{ paddingHorizontal: spacing.lg, marginBottom: 14 }}>
                {renderMatterSwitcher()}
              </View>

              <View style={[styles.stickyTabWrapper, { paddingHorizontal: spacing.lg }]}>
                {renderClientTabBar()}
              </View>

              <Animated.View style={{ opacity: tabOpacity, flex: 1 }}>
                <FlatList
                  ref={clientFlatListRef}
                  data={[...clientMessages].reverse()}
                  keyExtractor={(item) => item.id}
                  inverted={true}
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "flex-end",
                    paddingHorizontal: spacing.lg,
                    paddingBottom: 24,
                    paddingTop: 12,
                  }}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<Text style={[styles.copy, { textAlign: "center", marginVertical: 20 }]}>No messages yet.</Text>}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.messageBubble,
                        item.senderType === "client" ? styles.clientBubble : styles.counselBubble,
                      ]}
                    >
                      <Text style={styles.messageSender}>{item.senderType === "client" ? "You" : "Counsel"}</Text>
                      <Text style={styles.messageText}>{item.body}</Text>
                      <Text style={styles.messageTime}>{formatDateTime(item.createdAt)}</Text>
                    </View>
                  )}
                />

                <View style={{ paddingHorizontal: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 10 : 16, backgroundColor: theme.background }}>
                  <TextInput
                    style={[styles.input, { minHeight: 48, maxHeight: 100, marginBottom: 10 }]}
                    multiline
                    placeholder="Type your message here..."
                    value={clientMessageDraft}
                    onChangeText={setClientMessageDraft}
                  />
                  <Pressable style={styles.primaryButton} onPress={() => void sendClientMessage()}>
                    <Text style={styles.primaryButtonText}>Send message</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </>
          ) : (
            // Non-Chat Layout: ScrollView with sticky Tab Bar
            <ScrollView
              contentContainerStyle={styles.clientScreen}
              keyboardShouldPersistTaps="handled"
              stickyHeaderIndices={clientSelectedMatter ? [1] : undefined}
            >
              {/* Child 0 */}
              <View style={{ marginBottom: 14 }}>
                {renderMatterSwitcher()}

                {clientSelectedMatter ? (
                  <View style={[styles.overviewCard, { marginTop: 14 }]}>
                    <Text style={styles.eyebrow}>{clientSelectedMatter.rawCaseNumber}</Text>
                    <Text style={[styles.clientMatterTitle, styles.prewrappedText]}>
                      {formatTwoLineLabel(clientSelectedMatter.title, 34)}
                    </Text>
                    <View style={styles.overviewStack}>
                      <View style={styles.overviewRow}>
                        <Text style={styles.overviewLabel}>Court:</Text>
                        <View style={{ minHeight: 40, justifyContent: "center" }}>
                          <Text style={styles.overviewValueText}>
                            {formatTwoLineLabel(courtLabel(clientSelectedMatter.courtId), 26)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.overviewRow}>
                        <Text style={styles.overviewLabel}>Stage:</Text>
                        <Text style={styles.overviewValueText}>{toTitleCase(clientSelectedMatter.stage)}</Text>
                      </View>
                      <View style={styles.overviewRow}>
                        <Text style={styles.overviewLabel}>Next Hearing:</Text>
                        <Text style={styles.overviewValueText}>{formatDateTime(clientSelectedMatter.nextHearingAt)}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Child 1 */}
              {clientSelectedMatter ? (
                <View style={styles.stickyTabWrapper}>
                  {renderClientTabBar()}
                </View>
              ) : null}

              {/* Child 2 */}
              {clientSelectedMatter ? (
                <Animated.View style={{ opacity: tabOpacity, marginTop: 14 }}>
                  {clientWorkspaceTab === "hearings" ? (
                    <View style={styles.cardWithShadow}>
                      <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Court Calendar</Text>
                      {(clientSelectedMatter.hearings ?? []).length > 0 ? (
                        clientSelectedMatter.hearings.map((hearing, idx) => (
                          <View key={hearing.id} style={[styles.hearingItem, idx < clientSelectedMatter.hearings.length - 1 ? { marginBottom: 16 } : null]}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#047857", marginRight: 8 }} />
                              <Text style={styles.hearingHeader}>{formatDateTime(hearing.listedAt)}</Text>
                            </View>
                            <View style={{ marginLeft: 16, marginTop: 4, gap: 2 }}>
                              <Text style={styles.hearingStage}>{hearing.outcome}</Text>
                              {hearing.notes ? <Text style={styles.hearingNotes}>{hearing.notes}</Text> : null}
                              {hearing.nextDate ? (
                                <Text style={styles.hearingNextDate}>
                                  Next Date: {formatDateTime(hearing.nextDate)}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.copy}>No hearing activity has been posted yet.</Text>
                      )}
                    </View>
                  ) : null}

                  {clientWorkspaceTab === "documents" ? (
                    <View style={styles.cardWithShadow}>
                      <Text style={styles.sectionTitle}>Document Vault</Text>
                      {clientUploading ? (
                        <View style={{ paddingVertical: 14, alignItems: "center" }}>
                          <ActivityIndicator size="small" color={theme.primary} />
                          <Text style={[styles.smallText, { marginTop: 6, color: theme.primary, fontWeight: "600" }]}>Uploading document...</Text>
                        </View>
                      ) : (
                        <Pressable style={[styles.primaryButton, { marginBottom: 12 }]} onPress={() => void uploadClientDocument()}>
                          <Text style={styles.primaryButtonText}>Upload File</Text>
                        </Pressable>
                      )}

                      {/* Filter Row */}
                      {(clientSelectedMatter.documents ?? []).length > 0 && (
                        <View style={styles.filterContainer}>
                          {["All", ...Array.from(new Set((clientSelectedMatter.documents ?? []).map(d => toTitleCase(d.type))))].map((cat) => {
                            const active = clientDocumentFilter === cat;
                            return (
                              <Pressable
                                key={cat}
                                style={[styles.filterPill, active ? styles.filterPillActive : null]}
                                onPress={() => {
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                  setClientDocumentFilter(cat);
                                }}
                              >
                                <Text style={active ? styles.filterPillActiveText : styles.filterPillText}>{cat}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}

                      {(() => {
                        const filteredDocs = (clientSelectedMatter.documents ?? []).filter(doc => {
                          if (clientDocumentFilter === "All") return true;
                          return toTitleCase(doc.type) === clientDocumentFilter;
                        });

                        if (filteredDocs.length === 0) {
                          return (
                            <Text style={styles.copy}>
                              {clientSelectedMatter.documents.length === 0
                                ? "No shared documents for this matter yet."
                                : `No documents matching "${clientDocumentFilter}".`}
                            </Text>
                          );
                        }

                        return filteredDocs.map((document) => (
                          <Pressable
                            key={document.id}
                            style={styles.documentCard}
                            onPress={() => void openClientDocument(document)}
                          >
                            <View style={styles.documentIcon}>
                              <Text style={styles.documentIconText}>{documentIcon(document)}</Text>
                            </View>
                            <View style={styles.flexShrink}>
                              <Text style={styles.metaLabel}>{document.title}</Text>
                              <Text style={[styles.smallText, { marginTop: 2 }]}>
                                Uploaded by: {document.uploaderType === "client" ? "Client" : "Lawyer"}
                              </Text>
                              <View style={styles.documentSubRow}>
                                <Text style={styles.smallText}>
                                  {documentExtension(document).toUpperCase()}
                                </Text>
                                <View style={styles.documentBadgeContainer}>
                                  <Text style={styles.documentBadgeText}>{toTitleCase(document.type)}</Text>
                                </View>
                              </View>
                            </View>
                          </Pressable>
                        ));
                      })()}
                    </View>
                  ) : null}
                </Animated.View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.sectionTitle}>Loading matter details...</Text>
                  <Text style={[styles.copy, styles.centerText]}>Preparing your shared workspace.</Text>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
        {isTypeModalVisible && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 23, 42, 0.4)" }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsTypeModalVisible(false);
                setSelectedTypeForPicker(null);
              }}
            />
            <View style={[styles.modalContent, { position: "absolute", bottom: 0, left: 0, right: 0 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Document Type</Text>
                <Text style={styles.modalSubtitle}>Categorize this upload so counsel can identify it instantly</Text>
              </View>
              {[
                { value: "Identity Document", label: "Identity Document (CNIC, Passport)" },
                { value: "Evidence", label: "Evidence / Proof (Receipts, Photos)" },
                { value: "Affidavit", label: "Affidavit (Bayan-e-Halfi)" },
                { value: "Agreement / Contract", label: "Agreement / Contract (Deeds, Iqrar)" },
                { value: "Court Notice", label: "Court Notice / Summons" },
                { value: "General", label: "General / Other" }
              ].map((cat) => (
                <Pressable
                  key={cat.value}
                  style={[styles.modalOption, { alignItems: "flex-start", paddingVertical: 12 }]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsTypeModalVisible(false);
                    setSelectedTypeForPicker(cat.value);
                    setIsUploadOptionsModalVisible(true);
                  }}
                >
                  <Text style={styles.modalOptionText}>{cat.label}</Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsTypeModalVisible(false);
                  setSelectedTypeForPicker(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isUploadOptionsModalVisible && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 23, 42, 0.4)" }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsUploadOptionsModalVisible(false);
                setSelectedTypeForPicker(null);
              }}
            />
            <View style={[styles.modalContent, { position: "absolute", bottom: 0, left: 0, right: 0 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <Text style={styles.modalSubtitle}>Select how you want to get the document file</Text>
              </View>
              <Pressable
                style={styles.modalOption}
                onPress={() => void clientPickCameraPhoto()}
              >
                <Text style={styles.modalOptionText}>📷 Take a Photo</Text>
              </Pressable>
              <Pressable
                style={styles.modalOption}
                onPress={() => void clientPickLibraryPhoto()}
              >
                <Text style={styles.modalOptionText}>🖼️ Choose a Photo</Text>
              </Pressable>
              <Pressable
                style={styles.modalOption}
                onPress={() => void clientPickDocumentFile()}
              >
                <Text style={styles.modalOptionText}>📄 Choose a File</Text>
              </Pressable>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsUploadOptionsModalVisible(false);
                  setSelectedTypeForPicker(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (!auth || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={loginScrollRef}
            contentContainerStyle={styles.loginScroll}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.headerBlock}>
            <Text style={styles.heroTitle}>Legal Bhai</Text>
            <Text style={styles.copy}>
              Secure matter hearing dates, client updates, cause-list matching, and private document management.
            </Text>
          </View>
          <View style={styles.loginCard}>
            {!otpRequested ? (
              <View style={styles.tabRow}>
                <Pressable
                  style={[styles.portalTab, activeTab === "lawyer" ? styles.portalTabActive : null]}
                  onPress={() => handleTabChange("lawyer")}
                >
                  <Text style={activeTab === "lawyer" ? styles.portalTabActiveText : styles.portalTabText}>Lawyer Portal</Text>
                </Pressable>
                <Pressable
                  style={[styles.portalTab, activeTab === "client" ? styles.portalTabActive : null]}
                  onPress={() => handleTabChange("client")}
                >
                  <Text style={activeTab === "client" ? styles.portalTabActiveText : styles.portalTabText}>Client Portal</Text>
                </Pressable>
              </View>
            ) : null}

            {operationStatus ? <Text style={styles.statusBanner}>{operationStatus}</Text> : null}

            {!otpRequested ? (
              <>
                <Text style={styles.fieldLabel}>Phone Number</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryPrefix}>
                    <Text style={styles.countryPrefixText}>PK +92</Text>
                  </View>
                  <TextInput
                    ref={phoneInputRef}
                    accessibilityLabel="Phone"
                    value={phone}
                    onChangeText={(value) => setPhone(formatPhoneNumber(value))}
                    keyboardType="phone-pad"
                    style={[styles.input, styles.phoneInput]}
                  />
                </View>
              </>
            ) : null}

            {activeTab === "lawyer" && registrationMode && !otpRequested ? (
              <>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  value={registration.displayName}
                  onChangeText={(displayName) => setRegistration({ ...registration, displayName })}
                  onFocus={() => {
                    setTimeout(() => {
                      loginScrollRef.current?.scrollTo({ y: 120, animated: true });
                    }, 100);
                  }}
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Firm / Chamber Name</Text>
                <TextInput
                  accessibilityLabel="Practice name"
                  value={registration.firmName}
                  onChangeText={(firmName) => setRegistration({ ...registration, firmName })}
                  onFocus={() => {
                    setTimeout(() => {
                      loginScrollRef.current?.scrollTo({ y: 180, animated: true });
                    }, 100);
                  }}
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  accessibilityLabel="Email"
                  value={registration.email}
                  onChangeText={(email) => setRegistration({ ...registration, email })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => {
                    setTimeout(() => {
                      loginScrollRef.current?.scrollTo({ y: 240, animated: true });
                    }, 100);
                  }}
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Primary City</Text>
                <TextInput
                  accessibilityLabel="City"
                  value={registration.primaryCity}
                  onChangeText={(primaryCity) => setRegistration({ ...registration, primaryCity })}
                  onFocus={() => {
                    setTimeout(() => {
                      loginScrollRef.current?.scrollTo({ y: 300, animated: true });
                    }, 100);
                  }}
                  style={styles.input}
                />
              </>
            ) : null}

            {otpRequested ? (
              <>
                <Text style={styles.fieldLabel}>OTP Verification Code</Text>
                <View style={styles.otpRow}>
                  {otpDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(input) => {
                        otpInputRefs.current[index] = input;
                      }}
                      accessibilityLabel={`OTP digit ${index + 1}`}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(index, value)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      selectTextOnFocus
                      maxLength={1}
                      style={styles.otpInput}
                    />
                  ))}
                </View>
                {authErrorText ? <Text style={styles.errorBanner}>{authErrorText}</Text> : null}
                <View style={styles.otpActions}>
                  <Pressable onPress={() => void (activeTab === "lawyer" ? startLawyerLogin({ resend: true }) : startClientLogin({ resend: true }))}>
                    <Text style={styles.linkText}>Resend OTP</Text>
                  </Pressable>
                  <Pressable onPress={resetAuthFlow}>
                    <Text style={styles.linkTextAccent}>Change Number</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Pressable
              accessibilityLabel={otpRequested ? "Verify OTP" : "Request OTP"}
              style={styles.primaryButton}
              onPress={() => void (otpRequested
                ? (activeTab === "lawyer" ? verifyLawyerLogin() : verifyClientLogin())
                : (activeTab === "lawyer" ? startLawyerLogin() : startClientLogin()))}
            >
              <Text style={styles.primaryButtonText}>
                {otpRequested
                  ? (activeTab === "lawyer"
                    ? (registrationMode ? "Verify & Create Workspace" : "Verify & Sign In")
                    : "Verify & Sign In")
                  : "Request OTP"}
              </Text>
            </Pressable>

            {activeTab === "lawyer" && !otpRequested ? (
              <Pressable
                accessibilityLabel={registrationMode ? "Use existing lawyer login" : "Create workspace"}
                style={styles.secondaryButton}
                onPress={() => {
                  animateTransition();
                  const nextMode = !registrationMode;
                  setRegistrationMode(nextMode);
                  resetAuthFlow();
                  if (nextMode) {
                    setTimeout(() => {
                      loginScrollRef.current?.scrollTo({ y: 120, animated: true });
                    }, 120);
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  {registrationMode ? "Already have a workspace? Sign in" : "Invited lawyer? Create workspace"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (selectedMatter) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => setSelectedMatter(null)}>
            <Text style={styles.eyebrow}>Back to workspace</Text>
          </Pressable>
          <Text style={styles.title}>{selectedMatter.rawCaseNumber}</Text>
          <Text style={styles.copy}>{selectedMatter.title}</Text>
          <View style={styles.card}>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Court:</Text> {courtLabel(selectedMatter.courtId)}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Stage:</Text> {toTitleCase(selectedMatter.stage)}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Next Hearing:</Text> {formatDateTime(selectedMatter.nextHearingAt)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hearings</Text>
            {(selectedMatter.hearings ?? []).map((hearing) => (
              <View key={hearing.id} style={styles.timelineItem}>
                <Text style={styles.metaLabel}>{formatDateTime(hearing.listedAt)}</Text>
                <Text style={styles.meta}>{hearing.outcome}</Text>
                <Text style={styles.copy}>{hearing.notes}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Matter documents</Text>
            {(selectedMatter.documents ?? []).map((document) => (
              <View key={document.id} style={styles.timelineItem}>
                <Text style={styles.metaLabel}>{document.title}</Text>
                <Text style={[styles.smallText, { marginVertical: 2 }]}>
                  Uploaded by: {document.uploaderType === "client" ? "Client" : "Lawyer"}
                </Text>
                <View style={styles.documentSubRow}>
                  <View style={styles.documentBadgeContainer}>
                    <Text style={styles.documentBadgeText}>{toTitleCase(document.type)}</Text>
                  </View>
                  <Text style={styles.smallText}>OCR {document.ocrStatus}</Text>
                </View>
              </View>
            ))}
            <TextInput
              style={styles.input}
              value={documentTitle}
              onChangeText={setDocumentTitle}
              placeholder="Document title"
            />
            <Pressable style={styles.secondaryButton} onPress={() => void pickDocumentImage()}>
              <Text style={styles.secondaryButtonText}>{documentImageUri ? "Document photo selected" : "Take document photo"}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void uploadMatterDocument()}>
              <Text style={styles.primaryButtonText}>Upload private document</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client thread</Text>
            {(messages ?? []).map((message) => (
              <View key={message.id} style={styles.timelineItem}>
                <Text style={styles.metaLabel}>{message.senderType}</Text>
                <Text style={styles.copy}>{message.body}</Text>
                <Text style={styles.smallText}>{new Date(message.createdAt).toLocaleString()}</Text>
              </View>
            ))}
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              placeholder="Type your message here..."
              value={messageDraft}
              onChangeText={setMessageDraft}
            />
            <Pressable style={styles.secondaryButton} onPress={() => void sendMessage()}>
              <Text style={styles.secondaryButtonText}>Send update</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Capture hearing</Text>
            <TextInput
              style={styles.input}
              value={hearingOutcome}
              onChangeText={setHearingOutcome}
              placeholder="Outcome"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={hearingNotes}
              onChangeText={setHearingNotes}
              placeholder="Hearing notes"
            />
            <TextInput
              style={styles.input}
              value={hearingNextDate}
              onChangeText={setHearingNextDate}
              placeholder="Next date (YYYY-MM-DD)"
            />
            <Pressable style={styles.secondaryButton} onPress={() => void pickHearingImage()}>
              <Text style={styles.secondaryButtonText}>{hearingImageUri ? "Order image selected" : "Take order photo"}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void saveHearingUpdate()}>
              <Text style={styles.primaryButtonText}>Save hearing update</Text>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Modals Render Sections ---

  // 1. Profile options modal
  const renderProfileMenuModal = () => {
    return (
      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.flex} onPress={() => setProfileMenuVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Workspace Options</Text>
              <Text style={styles.modalSubtitle}>Manage your staff settings, document vault, and clients portal</Text>
            </View>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setProfileMenuVisible(false);
                setActiveMenuModal("clients");
              }}
            >
              <Text style={styles.modalOptionText}>👥 Clients Portal Management</Text>
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setProfileMenuVisible(false);
                setActiveMenuModal("vault");
              }}
            >
              <Text style={styles.modalOptionText}>📁 Vault & Document Sharing</Text>
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => {
                setProfileMenuVisible(false);
                setActiveMenuModal("settings");
              }}
            >
              <Text style={styles.modalOptionText}>⚙️ Workspace Settings & Staff</Text>
            </Pressable>

            <Pressable
              style={[styles.modalOption, { borderColor: "#fee2e2", backgroundColor: "#fef2f2" }]}
              onPress={() => {
                setProfileMenuVisible(false);
                void signOut();
              }}
            >
              <Text style={[styles.modalOptionText, { color: "#ef4444" }]}>🚪 Sign Out</Text>
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setProfileMenuVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  // 2. Clients management modal
  const renderClientsModal = () => {
    const isVisible = activeMenuModal === "clients";

    // Filter clients based on query
    const filteredClients = clients.filter(c =>
      c.displayName.toLowerCase().includes(clientsSearchQuery.toLowerCase()) ||
      c.phone.includes(clientsSearchQuery)
    );

    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        onRequestClose={() => {
          setActiveMenuModal(null);
          setProfileMenuVisible(true);
        }}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalCustomHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                if (selectedClientId) {
                  setSelectedClientId(null);
                  setClientDetail(null);
                } else {
                  setActiveMenuModal(null);
                  setProfileMenuVisible(true);
                }
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.modalHeaderTitle}>
              {selectedClientId ? "Client Details" : "Manage Clients"}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {selectedClientId && clientDetail ? (
            <ScrollView contentContainerStyle={styles.modalScrollViewContent} keyboardShouldPersistTaps="handled">
              <View style={styles.cardWithShadow}>
                <Text style={styles.sectionTitle}>Profile Details</Text>

                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={clientDraft.displayName}
                  onChangeText={(val) => setClientDraft({ ...clientDraft, displayName: val })}
                />

                <Text style={styles.fieldLabel}>Language</Text>
                <View style={styles.tabRow}>
                  {["en", "ur"].map((lang) => (
                    <Pressable
                      key={lang}
                      style={[styles.pill, clientDraft.language === lang ? styles.pillActive : null]}
                      onPress={() => setClientDraft({ ...clientDraft, language: lang })}
                    >
                      <Text style={clientDraft.language === lang ? styles.pillActiveText : styles.pillText}>
                        {lang === "en" ? "English" : "Urdu"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.tabRow}>
                  {["active", "archived"].map((st) => (
                    <Pressable
                      key={st}
                      style={[styles.pill, clientDraft.status === st ? styles.pillActive : null]}
                      onPress={() => setClientDraft({ ...clientDraft, status: st })}
                    >
                      <Text style={clientDraft.status === st ? styles.pillActiveText : styles.pillText}>
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => void updateClient()}>
                  <Text style={styles.primaryButtonText}>Save Details</Text>
                </Pressable>

                <Pressable style={[styles.secondaryButton, { borderColor: "#ef4444", marginTop: 8 }]} onPress={() => void archiveClient()}>
                  <Text style={[styles.secondaryButtonText, { color: "#ef4444" }]}>Archive Client Portal</Text>
                </Pressable>
              </View>

              <View style={styles.cardWithShadow}>
                <Text style={styles.sectionTitle}>Reminder & Consent</Text>
                {clientNotificationPreference ? (
                  <View style={{ gap: 12, marginTop: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pressable
                        style={[
                          styles.checkbox,
                          clientNotificationPreference.smsEnabled ? styles.checkboxChecked : null
                        ]}
                        onPress={() =>
                          setClientNotificationPreference({
                            ...clientNotificationPreference,
                            smsEnabled: !clientNotificationPreference.smsEnabled,
                          })
                        }
                      >
                        {clientNotificationPreference.smsEnabled && <Text style={styles.checkboxCheck}>✓</Text>}
                      </Pressable>
                      <Text style={styles.copy}>Receive SMS Reminders for Hearings</Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Pressable
                        style={[
                          styles.checkbox,
                          clientNotificationPreference.optedOutAt ? styles.checkboxChecked : null
                        ]}
                        onPress={() =>
                          setClientNotificationPreference({
                            ...clientNotificationPreference,
                            optedOutAt: clientNotificationPreference.optedOutAt ? null : new Date().toISOString(),
                          })
                        }
                      >
                        {clientNotificationPreference.optedOutAt && <Text style={styles.checkboxCheck}>✓</Text>}
                      </Pressable>
                      <Text style={styles.copy}>Pause reminders / Opt out</Text>
                    </View>

                    <Pressable style={[styles.primaryButton, { marginTop: 8 }]} onPress={() => void saveClientNotificationPreference()}>
                      <Text style={styles.primaryButtonText}>Save Consent Preferences</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.smallText}>Consent preferences unavailable</Text>
                )}
              </View>

              <View style={styles.cardWithShadow}>
                <Text style={styles.sectionTitle}>Linked Matters</Text>
                {clientDetail.matters.length === 0 ? (
                  <Text style={styles.copy}>No matters shared with this client account yet.</Text>
                ) : (
                  clientDetail.matters.map((matter) => (
                    <Pressable
                      key={matter.id}
                      style={styles.caseCard}
                      onPress={() => {
                        setActiveMenuModal(null);
                        void openMatter(matter.id);
                      }}
                    >
                      <Text style={styles.metaLabel}>{matter.rawCaseNumber}</Text>
                      <Text style={styles.copy}>{matter.title}</Text>
                      <Text style={styles.smallText}>{toTitleCase(matter.stage)}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.flex}>
              {/* Add Client Form */}
              <View style={{ paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Create Client Account</Text>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="Full Name"
                  value={newClient.displayName}
                  onChangeText={(displayName) => setNewClient({ ...newClient, displayName })}
                />
                <TextInput
                  style={[styles.input, { marginBottom: 8 }]}
                  placeholder="Phone Number (e.g. 03001234567)"
                  value={newClient.phone}
                  onChangeText={(phone) => setNewClient({ ...newClient, phone: formatPhoneNumber(phone) })}
                  keyboardType="phone-pad"
                />
                <Pressable style={styles.primaryButton} onPress={() => void createClient()}>
                  <Text style={styles.primaryButtonText}>Invite Client</Text>
                </Pressable>
              </View>

              {/* Search Client Bar */}
              <View style={{ paddingHorizontal: spacing.lg, marginVertical: 10 }}>
                <TextInput
                  style={styles.input}
                  placeholder="🔍 Search clients..."
                  value={clientsSearchQuery}
                  onChangeText={setClientsSearchQuery}
                />
              </View>

              {/* Client List */}
              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 10, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.documentCard} onPress={() => void openClient(item.id)}>
                    <View style={styles.flexShrink}>
                      <Text style={styles.metaLabel}>{item.displayName}</Text>
                      <Text style={styles.smallText}>{formatPakistanDisplayPhone(item.phone)}</Text>
                      <Text style={[styles.smallText, { marginTop: 2 }]}>
                        {item.matterCount} Matter(s) • Out: PKR {item.outstandingTotal}
                      </Text>
                    </View>
                    <Text style={styles.linkText}>View</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    );
  };

  // 3. Document Vault modal
  const renderVaultModal = () => {
    const isVisible = activeMenuModal === "vault";

    const filteredDocs = documents.filter(doc =>
      doc.title.toLowerCase().includes(vaultSearchQuery.toLowerCase())
    );

    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        onRequestClose={() => {
          setActiveMenuModal(null);
          setProfileMenuVisible(true);
        }}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalCustomHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                setActiveMenuModal(null);
                setProfileMenuVisible(true);
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Document Vault</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.flex}>
            {/* Search Bar */}
            <View style={{ paddingHorizontal: spacing.lg, marginVertical: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="🔍 Search documents..."
                value={vaultSearchQuery}
                onChangeText={setVaultSearchQuery}
              />
            </View>

            {/* List Documents */}
            <FlatList
              data={filteredDocs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 10, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.documentCard}>
                  <View style={styles.documentIcon}>
                    <Text style={styles.documentIconText}>{documentIcon(item)}</Text>
                  </View>
                  <View style={styles.flexShrink}>
                    <Text style={styles.metaLabel} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.smallText}>{toTitleCase(item.type)} • OCR {item.ocrStatus}</Text>
                    {item.uploaderType && (
                      <Text style={[styles.smallText, { color: theme.textTertiary }]}>
                        Uploader: {item.uploaderType}
                      </Text>
                    )}
                  </View>

                  {/* Share Toggle */}
                  <Pressable
                    style={[
                      styles.pill,
                      item.portalVisible ? styles.pillActive : null,
                      { paddingHorizontal: 8, paddingVertical: 4 }
                    ]}
                    onPress={() => void updateDocumentVisibility(item)}
                  >
                    <Text style={[
                      item.portalVisible ? styles.pillActiveText : styles.pillText,
                      { fontSize: 11 }
                    ]}>
                      {item.portalVisible ? "Shared" : "Private"}
                    </Text>
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.copy, { textAlign: "center", marginTop: 20 }]}>
                  No documents found in vault.
                </Text>
              }
            />
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // 4. Settings modal
  const renderSettingsModal = () => {
    const isVisible = activeMenuModal === "settings";
    const isOwnerOrCoOwner =
      profile?.staffMembership?.role === "owner" || profile?.staffMembership?.role === "co_owner";

    return (
      <Modal
        visible={isVisible}
        animationType="slide"
        onRequestClose={() => {
          setActiveMenuModal(null);
          setProfileMenuVisible(true);
        }}
      >
        <SafeAreaView style={styles.safe}>
          <View style={styles.modalCustomHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                setActiveMenuModal(null);
                setProfileMenuVisible(true);
              }}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.modalHeaderTitle}>System Settings</Text>
            <View style={{ width: 60 }} />
          </View>

          {isOwnerOrCoOwner && (
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: spacing.lg, marginVertical: 10 }}>
              <Pressable
                style={[styles.secondaryButton, settingsTab === "profile" ? { backgroundColor: theme.primaryLight, borderColor: theme.primary } : null, { flex: 1, paddingVertical: 8 }]}
                onPress={() => setSettingsTab("profile")}
              >
                <Text style={[styles.secondaryButtonText, settingsTab === "profile" ? { color: theme.primaryDark } : null]}>My Preferences</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, settingsTab === "workspace" ? { backgroundColor: theme.primaryLight, borderColor: theme.primary } : null, { flex: 1, paddingVertical: 8 }]}
                onPress={() => setSettingsTab("workspace")}
              >
                <Text style={[styles.secondaryButtonText, settingsTab === "workspace" ? { color: theme.primaryDark } : null]}>Workspace & Staff</Text>
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.modalScrollViewContent} keyboardShouldPersistTaps="handled">
            {settingsTab === "profile" || !isOwnerOrCoOwner ? (
              <>
                <View style={styles.cardWithShadow}>
                  <Text style={styles.sectionTitle}>Profile Information</Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={styles.copy}><Text style={styles.metaLabel}>Name:</Text> {profile.staffUser.displayName}</Text>
                    <Text style={styles.copy}><Text style={styles.metaLabel}>Phone:</Text> {formatPakistanDisplayPhone(profile.staffUser.phone)}</Text>
                    <Text style={styles.copy}><Text style={styles.metaLabel}>Role:</Text> {toTitleCase(profile.staffMembership.role)}</Text>
                    {profile.staffMembership.officeLabel && (
                      <Text style={styles.copy}><Text style={styles.metaLabel}>Office Label:</Text> {profile.staffMembership.officeLabel}</Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardWithShadow}>
                  <Text style={styles.sectionTitle}>Agenda Notification Preferences</Text>
                  {notificationPreference ? (
                    <View style={{ gap: 12, marginTop: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Pressable
                          style={[
                            styles.checkbox,
                            notificationPreference.emailEnabled ? styles.checkboxChecked : null
                          ]}
                          onPress={() =>
                            setNotificationPreference({
                              ...notificationPreference,
                              emailEnabled: !notificationPreference.emailEnabled,
                            })
                          }
                        >
                          {notificationPreference.emailEnabled && <Text style={styles.checkboxCheck}>✓</Text>}
                        </Pressable>
                        <Text style={styles.copy}>Receive Lawyer Agenda Emails</Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Pressable
                          style={[
                            styles.checkbox,
                            notificationPreference.smsEnabled ? styles.checkboxChecked : null
                          ]}
                          onPress={() =>
                            setNotificationPreference({
                              ...notificationPreference,
                              smsEnabled: !notificationPreference.smsEnabled,
                            })
                          }
                        >
                          {notificationPreference.smsEnabled && <Text style={styles.checkboxCheck}>✓</Text>}
                        </Pressable>
                        <Text style={styles.copy}>Receive Lawyer Agenda SMS Alerts</Text>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Pressable
                          style={[
                            styles.checkbox,
                            notificationPreference.optedOutAt ? styles.checkboxChecked : null
                          ]}
                          onPress={() =>
                            setNotificationPreference({
                              ...notificationPreference,
                              optedOutAt: notificationPreference.optedOutAt ? null : new Date().toISOString(),
                            })
                          }
                        >
                          {notificationPreference.optedOutAt && <Text style={styles.checkboxCheck}>✓</Text>}
                        </Pressable>
                        <Text style={styles.copy}>Pause All Alerts / Opt Out</Text>
                      </View>

                      <Pressable style={[styles.primaryButton, { marginTop: 8 }]} onPress={() => void saveNotificationPreference()}>
                        <Text style={styles.primaryButtonText}>Save Preferences</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.smallText}>Preferences unavailable</Text>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.cardWithShadow}>
                  <Text style={styles.sectionTitle}>Workspace Details</Text>
                  {profile.firm ? (
                    <View style={{ gap: 8, marginTop: 8 }}>
                      <Text style={styles.copy}><Text style={styles.metaLabel}>Firm:</Text> {profile.firm.name}</Text>
                      <Text style={styles.copy}><Text style={styles.metaLabel}>HQ City:</Text> {profile.firm.primaryCity}</Text>
                      <Text style={styles.copy}><Text style={styles.metaLabel}>Timezone:</Text> {profile.firm.timezone}</Text>
                      <Text style={styles.copy}><Text style={styles.metaLabel}>Billing Plan:</Text> {profile.firm.billingPlan}</Text>
                      <Text style={styles.copy}><Text style={styles.metaLabel}>Status:</Text> {profile.firm.status}</Text>
                    </View>
                  ) : (
                    <Text style={styles.smallText}>Firm details unavailable</Text>
                  )}
                </View>

                {/* Invite Member Form */}
                <View style={styles.cardWithShadow}>
                  <Text style={styles.sectionTitle}>Invite Staff / Member</Text>

                  <Text style={styles.fieldLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 03001234567"
                    value={invitePhone}
                    onChangeText={(val) => setInvitePhone(formatPhoneNumber(val))}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.fieldLabel}>Email Address (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. counsel@firm.com"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={styles.fieldLabel}>Role Type</Text>
                  <View style={styles.tabRow}>
                    {(["lawyer", "assistant", "billing", "co_owner"] as const).map((r) => (
                      <Pressable
                        key={r}
                        style={[styles.pill, inviteRole === r ? styles.pillActive : null]}
                        onPress={() => setInviteRole(r)}
                      >
                        <Text style={inviteRole === r ? styles.pillActiveText : styles.pillText}>
                          {toTitleCase(r)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Office Location Label</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Islamabad HQ / Rawalpindi Bench"
                    value={inviteOfficeLabel}
                    onChangeText={setInviteOfficeLabel}
                  />

                  <Pressable style={[styles.primaryButton, { marginTop: 12 }]} onPress={() => void handleSendInvite()}>
                    <Text style={styles.primaryButtonText}>Send Invitation</Text>
                  </Pressable>
                </View>

                {/* Staff list */}
                <View style={styles.cardWithShadow}>
                  <Text style={styles.sectionTitle}>Firm Members ({teamMembers.length})</Text>
                  <View style={{ gap: 12, marginTop: 8 }}>
                    {teamMembers.map((member) => (
                      <View key={member.id} style={styles.timelineItem}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.metaLabel}>
                            {member.displayName === member.phone ? formatPakistanDisplayPhone(member.phone) : member.displayName}
                          </Text>
                          <View style={[styles.badge, { backgroundColor: member.status === "active" ? "#d1fae5" : "#e5e7eb" }]}>
                            <Text style={[styles.badgeText, { color: member.status === "active" ? "#065f46" : "#374151" }]}>
                              {toTitleCase(member.status)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.smallText}>{formatPakistanDisplayPhone(member.phone)} • {toTitleCase(member.membership.role)}</Text>
                        {member.membership.officeLabel && (
                          <Text style={styles.smallText}>Location: {member.membership.officeLabel}</Text>
                        )}

                        {/* Inline editor for others */}
                        {member.id !== profile.staffUser.id && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                            <Text style={styles.smallText}>Role:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                              <View style={{ flexDirection: "row", gap: 6 }}>
                                {["owner", "co_owner", "lawyer", "assistant", "billing"].map((rl) => (
                                  <Pressable
                                    key={rl}
                                    style={[
                                      styles.pill,
                                      member.membership.role === rl ? styles.pillActive : null,
                                      { paddingHorizontal: 8, paddingVertical: 4 }
                                    ]}
                                    onPress={() =>
                                      void handleUpdateMembership(
                                        member.membership.id,
                                        rl,
                                        member.membership.officeLabel
                                      )
                                    }
                                  >
                                    <Text style={[
                                      member.membership.role === rl ? styles.pillActiveText : styles.pillText,
                                      { fontSize: 11 }
                                    ]}>
                                      {rl}
                                    </Text>
                                  </Pressable>
                                ))}
                              </View>
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.flex}>
        {/* Render child content area depending on tab */}
        <View style={styles.tabContent}>
          {tab === "overview" && (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 60, gap: 14 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header profile details */}
              <View style={styles.dashboardHeader}>
                <View style={styles.flexShrink}>
                  <Text style={styles.heroName} numberOfLines={1}>{profile.staffUser.displayName}</Text>
                  <Text style={styles.heroSubtext} numberOfLines={1}>
                    {profile.staffMembership.officeLabel || toTitleCase(profile.staffMembership.role)} • {profile.firm?.primaryCity || profile.firm?.name || "HQ"}
                  </Text>
                </View>
                <Pressable style={styles.menuIconButton} onPress={() => setProfileMenuVisible(true)}>
                  <Text style={styles.menuIconText}>⚙️ Options</Text>
                </Pressable>
              </View>

              {offlineQueueSize > 0 && (
                <Text style={styles.statusBanner}>{offlineQueueSize} hearing update(s) waiting to sync</Text>
              )}

              {syncMessage && (
                <Text style={styles.statusBanner}>{syncMessage}</Text>
              )}

              {/* Workspace Stats Row */}
              <View style={styles.cardRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{report?.metrics.openMatters ?? matters.length}</Text>
                  <Text style={styles.smallText}>Matters</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{report?.metrics.upcomingHearings ?? calendar.length}</Text>
                  <Text style={styles.smallText}>Hearings</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{report?.metrics.unreadAlerts ?? alerts.filter(a => !a.readAt).length}</Text>
                  <Text style={styles.smallText}>Unread Alerts</Text>
                </View>
              </View>

              {/* Priority Alerts Widget */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Priority Alerts</Text>
                {alerts.length === 0 ? (
                  <Text style={styles.copy}>Nothing present</Text>
                ) : (
                  alerts.map((alert) => {
                    const isUrgent = alert.title.toLowerCase().includes("approaching") ||
                      alert.title.toLowerCase().includes("pronouncement") ||
                      alert.body.toLowerCase().includes("urgent");
                    return (
                      <View
                        key={alert.id}
                        style={[
                          styles.caseCard,
                          {
                            borderLeftWidth: 4,
                            borderLeftColor: isUrgent ? "#ef4444" : "#e2e8f0"
                          }
                        ]}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <Text style={[styles.metaLabel, { flex: 1 }]}>
                            {alert.title.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </Text>
                          {!alert.readAt && (
                            <Pressable
                              style={[styles.pill, { paddingHorizontal: 8, paddingVertical: 4, borderColor: theme.primary }]}
                              onPress={() => void markAlertRead(alert.id)}
                            >
                              <Text style={[styles.pillText, { fontSize: 11, color: theme.primary }]}>Mark Read</Text>
                            </Pressable>
                          )}
                        </View>
                        <Text style={styles.copy}>{alert.body}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Court Health Widget */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Court Health</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                  {courtSources.map((source) => {
                    const isLive = source.status === "live";
                    const isFailed = source.status === "failed";
                    const badgeText = isLive ? "Connected" : isFailed ? "Sync failed" : "Needs Attention";
                    const badgeColor = isLive ? "#d1fae5" : isFailed ? "#fee2e2" : "#fef3c7";
                    const textColor = isLive ? "#065f46" : isFailed ? "#991b1b" : "#92400e";
                    return (
                      <View key={source.id} style={styles.courtHealthPill}>
                        <Text style={styles.courtHealthLabel} numberOfLines={2}>{courtLabel(source.courtId)}</Text>
                        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                          <Text style={[styles.badgeText, { color: textColor }]}>{badgeText}</Text>
                        </View>
                        <Text style={[styles.smallText, { fontSize: 10 }]}>
                          Sync: {source.lastSuccessfulSyncAt ? formatDateTime(source.lastSuccessfulSyncAt) : "Never"}
                        </Text>
                        <Pressable style={styles.syncButtonSmall} onPress={() => void syncCourtSource(source.id)}>
                          <Text style={styles.syncButtonTextSmall}>🔄 Sync</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Recent Client Threads widget */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Client Threads</Text>
                {threads.length === 0 ? (
                  <Text style={styles.copy}>Nothing present</Text>
                ) : (
                  threads.map((thread) => (
                    <Pressable key={thread.id} style={styles.threadCard} onPress={() => void openMatter(thread.matter.id)}>
                      <Text style={styles.threadMatterCase}>{thread.matter.rawCaseNumber}</Text>
                      <Text style={styles.threadMatterTitle}>{thread.matter.title}</Text>
                      <Text style={styles.threadSnippet} numberOfLines={2}>
                        {thread.lastMessage?.body ?? "No messages yet"}
                      </Text>
                      {thread.lastMessage?.createdAt && (
                        <Text style={styles.threadTime}>{formatDateTime(thread.lastMessage.createdAt)}</Text>
                      )}
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
          )}

          {tab === "matters" && (
            <View style={[styles.flex, { paddingTop: 16 }]}>
              <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.lg, marginBottom: 12 }]}>Litigation Matters</Text>
              <FlatList
                data={matters}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 60 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable style={styles.caseCard} onPress={() => void openMatter(item.id)}>
                    <Text style={styles.metaLabel}>{item.rawCaseNumber}</Text>
                    <Text style={styles.copy}>{item.title}</Text>
                    <Text style={styles.smallText}>{courtLabel(item.courtId)} · {toTitleCase(item.stage)}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          {tab === "calendar" && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>Court Hearings Calendar</Text>
              {calendar.length === 0 ? (
                <Text style={styles.copy}>No upcoming listings on the calendar.</Text>
              ) : (
                calendar.map((entry) => (
                  <Pressable key={entry.id} style={styles.caseCard} onPress={() => void openMatter(entry.matter.id)}>
                    <Text style={styles.metaLabel}>{entry.matter.rawCaseNumber}</Text>
                    <Text style={styles.copy}>{entry.matter.title}</Text>
                    <Text style={styles.smallText}>
                      Listed: {formatDateTime(entry.listedAt)} • {toTitleCase(entry.conflictState)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}

          {tab === "alerts" && (
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.sectionTitle}>Alert History</Text>
              {alerts.length === 0 ? (
                <Text style={styles.copy}>No notifications received.</Text>
              ) : (
                alerts.map((alert) => (
                  <View key={alert.id} style={styles.caseCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <Text style={[styles.metaLabel, { flex: 1 }]}>{alert.title}</Text>
                      {!alert.readAt && (
                        <Pressable style={[styles.pill, { borderColor: theme.primary }]} onPress={() => void markAlertRead(alert.id)}>
                          <Text style={[styles.pillText, { fontSize: 11, color: theme.primary }]}>Mark Read</Text>
                        </Pressable>
                      )}
                    </View>
                    <Text style={styles.copy}>{alert.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>

        {/* Core Fixed Bottom Tab Bar */}
        <View style={styles.bottomTabBar}>
          {(["overview", "matters", "calendar", "alerts"] as const).map((tabKey) => {
            let label = toTitleCase(tabKey);
            let iconText = "📊";
            if (tabKey === "matters") iconText = "💼";
            if (tabKey === "calendar") iconText = "📅";
            if (tabKey === "alerts") iconText = "🔔";

            const isActive = tab === tabKey;
            return (
              <Pressable
                key={tabKey}
                style={styles.bottomTabButton}
                accessibilityLabel={label}
                onPress={() => setTab(tabKey)}
              >
                <Text style={{ fontSize: 18 }}>{iconText}</Text>
                <Text style={isActive ? styles.bottomTabTextActive : styles.bottomTabText}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Action overlays / sheet modals */}
      {renderProfileMenuModal()}
      {renderClientsModal()}
      {renderVaultModal()}
      {renderSettingsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: Platform.OS === "ios" ? 8 : 0,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flex: 1,
    minWidth: 0,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    gap: 12,
  },
  clientScreen: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    flexGrow: 1,
  },
  stickyTabWrapper: {
    backgroundColor: theme.background,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  clientHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
    paddingBottom: 14,
    gap: 12,
  },
  clientTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  clientTitleIntro: {
    color: theme.textSecondary,
  },
  clientTitleName: {
    color: theme.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  clientProfileFirm: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  clientProfilePhone: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  headerSignOutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerSignOutText: {
    color: theme.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  loginScroll: {
    paddingBottom: 48,
  },
  headerBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: theme.primary,
    textAlign: "center",
    letterSpacing: -0.72,
  },
  loginCard: {
    backgroundColor: theme.surface,
    margin: 20,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  portalTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.background,
    alignItems: "center",
  },
  portalTabActive: {
    backgroundColor: theme.primary,
  },
  portalTabText: {
    color: theme.textSecondary,
    fontWeight: "600",
  },
  portalTabActiveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  fieldLabel: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  countryPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: theme.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  countryPrefixText: {
    color: theme.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  phoneInput: {
    marginTop: 0,
    flex: 1,
  },
  statusBanner: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(15, 110, 86, 0.1)",
    color: theme.primaryDark,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorBanner: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.accentLight,
    borderWidth: 1,
    borderColor: "rgba(216, 90, 48, 0.2)",
    color: theme.accent,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyState: {
    margin: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  emptyStateIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: theme.primaryLight,
    color: theme.primaryDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "800",
    fontSize: 18,
    overflow: "hidden",
  },
  centerText: {
    textAlign: "center",
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  otpInput: {
    width: 44,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  otpActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkText: {
    color: theme.primary,
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  linkTextAccent: {
    color: theme.accent,
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  eyebrow: {
    color: theme.primary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: theme.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  copy: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  matterSwitcher: {
    gap: 10,
    paddingVertical: 10,
    paddingRight: 20,
  },
  matterPill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 148,
    gap: 3,
  },
  matterPillActive: {
    backgroundColor: theme.primaryLight,
    borderWidth: 2,
    borderColor: theme.primary,
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  matterPillText: {
    color: theme.textSecondary,
    fontWeight: "500",
  },
  matterPillActiveText: {
    color: theme.primaryDark,
    fontWeight: "800",
  },
  matterPillSubText: {
    color: theme.textTertiary,
    fontSize: 12,
    fontWeight: "400",
  },
  matterPillActiveSubText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  pill: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.surface,
  },
  pillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  pillText: {
    color: theme.textSecondary,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  pillActiveText: {
    color: "#fff",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.primary,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 10,
  },
  cardWithShadow: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  overviewCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 12,
    width: "100%",
    alignSelf: "stretch",
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  clientMatterTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  prewrappedText: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  overviewStack: {
    gap: 14,
    marginTop: 4,
  },
  overviewRow: {
    gap: 4,
  },
  overviewLabel: {
    color: theme.textTertiary,
    fontSize: 12,
    fontWeight: "600",
  },
  overviewValueText: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  overviewCell: {
    width: "47%",
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: theme.background,
    padding: 12,
    gap: 3,
  },
  overviewCellFull: {
    width: "100%",
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: theme.primaryLight,
    padding: 12,
    gap: 3,
  },
  overviewValue: {
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "47%",
    backgroundColor: theme.primaryLight,
    borderRadius: 16,
    padding: 14,
  },
  statValue: {
    color: theme.primaryDark,
    fontSize: 22,
    fontWeight: "700",
  },
  sectionTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  caseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 4,
  },
  meta: {
    color: theme.textSecondary,
  },
  metaLabel: {
    color: theme.textPrimary,
    fontWeight: "700",
  },
  smallText: {
    color: theme.textTertiary,
    fontSize: 12,
  },
  timelineItem: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  hearingCard: {
    borderRadius: 16,
    backgroundColor: theme.background,
    padding: 14,
    gap: 6,
  },
  hearingStatus: {
    color: theme.primaryDark,
    fontWeight: "800",
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  documentIconText: {
    color: theme.primaryDark,
    fontWeight: "800",
    fontSize: 11,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: 12,
    marginVertical: 5,
    gap: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  clientBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#D8F5E8",
    borderTopRightRadius: 6,
    marginRight: 8,
    marginLeft: 16,
  },
  counselBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 6,
    marginLeft: 8,
    marginRight: 16,
  },
  hearingItem: {
    width: "100%",
  },
  hearingHeader: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  hearingStage: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  hearingNotes: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
  hearingNextDate: {
    color: theme.textTertiary,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 4,
  },
  messageSender: {
    color: theme.textPrimary,
    fontWeight: "800",
    fontSize: 12,
  },
  messageText: {
    color: theme.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    color: theme.textTertiary,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 10,
    gap: 4,
  },
  modalTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fcfbfa",
    alignItems: "center",
  },
  modalOptionText: {
    color: theme.textPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  modalCancelButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  modalCancelText: {
    color: theme.accent || "#ef4444",
    fontWeight: "700",
    fontSize: 15,
  },
  documentSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
    flexWrap: "wrap",
  },
  documentBadgeContainer: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  documentBadgeText: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "600",
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  filterPillText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  filterPillActiveText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  modalCustomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: "#ffffff",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.textPrimary,
  },
  backButton: {
    paddingVertical: 6,
  },
  backButtonText: {
    color: theme.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  modalScrollViewContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  checkboxCheck: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  syncButtonSmall: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  syncButtonTextSmall: {
    fontSize: 11,
    color: theme.primaryDark,
    fontWeight: "600",
  },
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    marginBottom: 14,
  },
  heroName: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.textPrimary,
  },
  heroSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  menuIconButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  menuIconText: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  courtHealthPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: "#ffffff",
    padding: 12,
    marginRight: 10,
    width: 180,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  courtHealthLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  threadCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 4,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  threadMatterCase: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.primary,
  },
  threadMatterTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  threadSnippet: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  threadTime: {
    fontSize: 11,
    color: theme.textTertiary,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  bottomTabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: "#ffffff",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    justifyContent: "space-around",
    alignItems: "center",
  },
  bottomTabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  bottomTabActive: {
    backgroundColor: "transparent",
  },
  bottomTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textSecondary,
    marginTop: 2,
  },
  bottomTabTextActive: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.primary,
    marginTop: 2,
  },
  tabContent: {
    flex: 1,
  },
});
