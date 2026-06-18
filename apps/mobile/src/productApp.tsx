import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import { ApiRequestError, apiRequest } from "./api";
import { theme } from "./theme";

type ProductTab = "home" | "matters" | "alerts" | "more";

interface StaffProfile {
  actorType: "staff";
  firm: { id: string; name: string } | null;
  staffUser: { id: string; displayName: string; phone: string };
  staffMembership: { role: string; officeLabel: string | null };
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
}

interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  createdAt: string;
}

const STAFF_PHONES = [
  { label: "Owner", phone: "03001234567" },
  { label: "Lawyer", phone: "03007654321" },
  { label: "Assistant", phone: "03001112222" },
] as const;

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

const spacing = {
  lg: 20,
};

const AUTH_STORAGE_KEY = "legalbahi-mobile-auth";
const DEMO_SURFACES = process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true";

export function ProductApp({ onBack }: { onBack?: () => void }) {
  const [phone, setPhone] = useState<string>(STAFF_PHONES[0].phone);
  const [auth, setAuth] = useState<{ token: string; refreshToken: string | null } | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [tab, setTab] = useState<ProductTab>("home");
  const [matters, setMatters] = useState<MatterListItem[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<MatterDetail | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [messageDraft, setMessageDraft] = useState("Please review the latest update and let me know if you need anything else.");
  const [hearingOutcome, setHearingOutcome] = useState("Order reserved");
  const [hearingNotes, setHearingNotes] = useState("Counsel appeared. Short written note to be filed before the next listing.");
  const [hearingNextDate, setHearingNextDate] = useState("");
  const [hearingImageUri, setHearingImageUri] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentImageUri, setDocumentImageUri] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [registration, setRegistration] = useState({
    displayName: "",
    email: "",
    firmName: "",
    primaryCity: "Islamabad",
  });

  useEffect(() => {
    void SecureStore.getItemAsync(AUTH_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setAuth(JSON.parse(value) as { token: string; refreshToken: string | null });
        }
      })
      .finally(() => setAuthHydrated(true));
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    if (!auth) {
      void SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      return;
    }
    void SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(auth));
    void loadWorkspace(auth).catch((error) => {
      if (error instanceof ApiRequestError && error.status === 401) {
        setAuth(null);
        setProfile(null);
        Alert.alert("Session expired", "Sign in again to continue.");
        return;
      }
      Alert.alert("Workspace load failed", error instanceof Error ? error.message : "Unknown error");
    });
  }, [auth, authHydrated]);

  async function authedRequest<T>(
    path: string,
    options: RequestInit = {},
    activeAuth = auth,
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
      setAuth(nextAuth);

      return {
        data: await apiRequest<T>(path, options, nextAuth.token),
        auth: nextAuth,
      };
    }
  }

  async function loadWorkspace(activeAuth: { token: string; refreshToken: string | null }) {
    const meResponse = await authedRequest<{ profile: StaffProfile }>("/v1/me", {}, activeAuth);
    const matterResponse = await authedRequest<{ matters: MatterListItem[] }>("/v1/matters", {}, meResponse.auth);
    const calendarResponse = await authedRequest<{ items: CalendarItem[] }>("/v1/calendar", {}, matterResponse.auth);
    const alertResponse = await authedRequest<{ alerts: AlertRecord[] }>("/v1/alerts", {}, calendarResponse.auth);
    const me = meResponse.data;
    const matterPayload = matterResponse.data;
    const calendarPayload = calendarResponse.data;
    const alertPayload = alertResponse.data;
    setProfile(me.profile);
    setMatters(matterPayload.matters);
    setCalendar(calendarPayload.items);
    setAlerts(alertPayload.alerts);
    if (!selectedMatter && matterPayload.matters[0]) {
      await openMatter(matterPayload.matters[0].id, alertResponse.auth);
    }
  }

  async function requestOtp() {
    try {
      const otp = await apiRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone, actorType: "staff" }),
      });
      setOtpCode(otp.devCode ?? "");
      setOtpRequested(true);
    } catch (error) {
      Alert.alert("OTP request failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function login() {
    try {
      const payload = await apiRequest<{ token: string; refreshToken: string | null }>(
        registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify",
        {
        method: "POST",
        body: JSON.stringify(registrationMode
          ? { phone, code: otpCode, ...registration }
          : { phone, actorType: "staff", code: otpCode }),
      });
      setAuth({ token: payload.token, refreshToken: payload.refreshToken });
    } catch (error) {
      Alert.alert(registrationMode ? "Registration failed" : "Login failed", error instanceof Error ? error.message : "Unknown error");
    }
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
    setMessageDraft("Please review the latest update and let me know if you need anything else.");
    await openMatter(selectedMatter.id, payload.auth);
  }

  async function saveHearingUpdate() {
    if (!auth || !selectedMatter) {
      return;
    }

    try {
      const form = new FormData();
      form.append("listedAt", new Date().toISOString());
      form.append("outcome", hearingOutcome);
      form.append("notes", hearingNotes);
      form.append("nextDate", hearingNextDate || "");
      form.append("sourceType", "manual_staff_mobile");
      if (hearingImageUri) {
        form.append("file", { uri: hearingImageUri, name: "hearing-order.jpg", type: "image/jpeg" } as unknown as Blob);
      }
      const payload = await authedRequest(`/v1/matters/${selectedMatter.id}/hearings`, { method: "POST", body: form }, auth);
      setHearingOutcome("Order reserved");
      setHearingNotes("Counsel appeared. Short written note to be filed before the next listing.");
      setHearingNextDate("");
      setHearingImageUri(null);
      await loadWorkspace(payload.auth);
      await openMatter(selectedMatter.id, payload.auth);
      Alert.alert("Hearing saved", "The matter timeline has been updated.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Unknown error");
    }
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
      Alert.alert("Document uploaded", "The photo is stored privately on this matter.");
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

  if (!auth || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loginCard}>
          {onBack ? <Pressable onPress={onBack}>
            <Text style={styles.eyebrow}>Back to mode select</Text>
          </Pressable> : null}
          <Text style={styles.title}>Legal Bhai</Text>
          <Text style={styles.copy}>
            Production-line staff workspace with OTP auth, matters, hearing timeline, client thread,
            alerts, and client updates.
          </Text>
          {DEMO_SURFACES ? <View style={styles.tabRow}>
            {STAFF_PHONES.map((user) => (
              <Pressable
                key={user.phone}
                style={[styles.pill, phone === user.phone ? styles.pillActive : null]}
                onPress={() => setPhone(user.phone)}
              >
              <Text style={phone === user.phone ? styles.pillActiveText : styles.pillText}>
                  {user.label}
                </Text>
              </Pressable>
            ))}
          </View> : null}
          <TextInput accessibilityLabel="Phone" value={phone} onChangeText={setPhone} style={styles.input} />
          {registrationMode ? <>
            <TextInput accessibilityLabel="Your name" value={registration.displayName} onChangeText={(displayName) => setRegistration({ ...registration, displayName })} placeholder="Your name" style={styles.input} />
            <TextInput accessibilityLabel="Email" value={registration.email} onChangeText={(email) => setRegistration({ ...registration, email })} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
            <TextInput accessibilityLabel="Practice name" value={registration.firmName} onChangeText={(firmName) => setRegistration({ ...registration, firmName })} placeholder="Practice name" style={styles.input} />
            <TextInput accessibilityLabel="City" value={registration.primaryCity} onChangeText={(primaryCity) => setRegistration({ ...registration, primaryCity })} placeholder="City" style={styles.input} />
          </> : null}
          {otpRequested ? <TextInput accessibilityLabel="OTP code" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" placeholder="OTP code" style={styles.input} /> : null}
          <Pressable accessibilityLabel={otpRequested ? "Verify OTP and sign in" : "Request OTP"} style={styles.primaryButton} onPress={() => void (otpRequested ? login() : requestOtp())}>
            <Text style={styles.primaryButtonText}>{otpRequested ? "Verify OTP and sign in" : "Request OTP"}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={registrationMode ? "Use existing lawyer login" : "Invited lawyer? Create workspace"}
            style={styles.secondaryButton}
            onPress={() => {
              setRegistrationMode(!registrationMode);
              setOtpRequested(false);
              setOtpCode("");
            }}
          >
            <Text style={styles.secondaryButtonText}>{registrationMode ? "Use existing lawyer login" : "Invited lawyer? Create workspace"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedMatter) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => setSelectedMatter(null)}>
            <Text style={styles.eyebrow}>Back to workspace</Text>
          </Pressable>
          <Text style={styles.title}>{selectedMatter.rawCaseNumber}</Text>
          <Text style={styles.copy}>{selectedMatter.title}</Text>
          <View style={styles.card}>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Court:</Text> {courtLabel(selectedMatter.courtId)}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Stage:</Text> {selectedMatter.stage}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Next hearing:</Text> {selectedMatter.nextHearingAt ?? "TBC"}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hearings</Text>
            {(selectedMatter.hearings ?? []).map((hearing) => (
              <View key={hearing.id} style={styles.timelineItem}>
                <Text style={styles.metaLabel}>{new Date(hearing.listedAt).toLocaleString()}</Text>
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
                <Text style={styles.smallText}>{document.type} · OCR {document.ocrStatus}</Text>
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
              placeholder="Reply to client"
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

  const homeCards = [
    { label: "Matters", value: matters.length },
    { label: "Calendar", value: calendar.length },
    { label: "Alerts", value: alerts.length },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>Legal Bhai</Text>
        <Text style={styles.title}>{profile.firm?.name ?? "Workspace"}</Text>
        <Text style={styles.copy}>{profile.staffUser.displayName} · {profile.staffMembership.role}</Text>
        <View style={styles.tabRow}>
          {(["home", "matters", "alerts", "more"] as const).map((tabKey) => (
            <Pressable
              key={tabKey}
              style={[styles.pill, tab === tabKey ? styles.pillActive : null]}
              accessibilityLabel={tabKey[0].toUpperCase() + tabKey.slice(1)}
              onPress={() => setTab(tabKey)}
            >
              <Text style={tab === tabKey ? styles.pillActiveText : styles.pillText}>{tabKey}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "home" ? (
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 140 }}>
            <View style={styles.cardRow}>
              {homeCards.map((card) => (
                <View key={card.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.smallText}>{card.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Today&apos;s calendar</Text>
              {calendar.map((entry) => (
                <Pressable key={entry.id} style={styles.caseCard} onPress={() => void openMatter(entry.matter.id)}>
                  <Text style={styles.metaLabel}>{entry.matter.rawCaseNumber}</Text>
                  <Text style={styles.copy}>{entry.matter.title}</Text>
                  <Text style={styles.smallText}>
                    {new Date(entry.listedAt).toLocaleString()} · {entry.sourceType} · {entry.conflictState}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {tab === "matters" ? (
          <FlatList
            data={matters}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 140 }}
            renderItem={({ item }) => (
              <Pressable style={styles.caseCard} onPress={() => void openMatter(item.id)}>
                <Text style={styles.metaLabel}>{item.rawCaseNumber}</Text>
                <Text style={styles.copy}>{item.title}</Text>
                <Text style={styles.smallText}>{courtLabel(item.courtId)} · {item.stage}</Text>
              </Pressable>
            )}
          />
        ) : null}

        {tab === "alerts" ? (
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 140 }}>
            {alerts.map((alert) => (
              <View key={alert.id} style={styles.caseCard}>
                <Text style={styles.metaLabel}>{alert.title}</Text>
                <Text style={styles.copy}>{alert.body}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {tab === "more" ? (
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 140 }}>
            {onBack ? <Pressable style={styles.secondaryButton} onPress={onBack}>
              <Text style={styles.secondaryButtonText}>Back to mode select</Text>
            </Pressable> : null}
            <Pressable style={styles.secondaryButton} onPress={() => void signOut()}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  screen: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
    gap: 12,
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
});
