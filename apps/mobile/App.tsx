import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

import { API_BASE_URL, apiRequest } from "./src/api";
import { ProductApp } from "./src/productApp";
import { theme } from "./src/theme";

const DEMO_USERS = [
  { label: "Admin", phone: "03001234567" },
  { label: "Associate", phone: "03007654321" },
  { label: "Junior", phone: "03001112222" },
] as const;

type TabKey = "home" | "cases" | "calendar";

interface CaseRecord {
  id: string;
  rawCaseNumber: string;
  title: string;
  court: string;
  stage: string;
  nextDate: string | null;
  clientName: string;
  sourceType: "live_ihc" | "demo_district";
  hearings?: Array<{
    id: string;
    hearingDate: string;
    outcome: string;
    notes: string;
    nextDateGiven: string | null;
    imageUrl: string | null;
    ocrText: string | null;
    ocrStatus: string;
  }>;
}

interface CalendarEntry {
  id: string;
  caseId: string;
  rawCaseNumber: string;
  caseTitle: string;
  court: string;
  timeSlot: string;
  source: "live_ihc" | "demo_district";
  isConflict: boolean;
}

interface CalendarTodayPayload {
  entries: CalendarEntry[];
  lastSyncedAt: string | null;
}

function DemoSelectorApp() {
  const [line, setLine] = useState<"selector" | "demo" | "product">("selector");
  const [phone, setPhone] = useState<string>(DEMO_USERS[0].phone);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("home");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadData();
  }, [token]);

  async function loadData() {
    if (!token) {
      return;
    }

    const [casesPayload, calendarPayload] = await Promise.all([
      apiRequest<{ cases: CaseRecord[] }>("/cases", {}, token),
      apiRequest<CalendarTodayPayload>("/calendar/today", {}, token),
    ]);
    setCases(casesPayload.cases);
    setCalendar(calendarPayload.entries);
    setLastSyncedAt(calendarPayload.lastSyncedAt);
  }

  async function login() {
    try {
      await apiRequest("/auth/demo/request-code", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      const payload = await apiRequest<{ token: string }>("/auth/demo/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code: "111111" }),
      });
      setToken(payload.token);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function openCase(caseId: string) {
    if (!token) return;
    const payload = await apiRequest<{ case: CaseRecord }>(`/cases/${caseId}`, {}, token);
    setSelectedCase(payload.case);
    setNotes("");
    setNextDate(payload.case.nextDate ?? "");
    setImageUri(null);
    setSmsPreview(null);
  }

  async function chooseImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  }

  async function uploadHearing() {
    if (!token || !selectedCase) {
      return;
    }

    const form = new FormData();
    form.append("hearingDate", new Date().toISOString().slice(0, 10));
    form.append("outcome", "order_passed");
    form.append("notes", notes || "Order uploaded from mobile demo.");
    form.append("nextDateGiven", nextDate);
    form.append("stageAfter", selectedCase.stage);

    if (imageUri) {
      form.append("file", {
        uri: imageUri,
        name: "hearing-order.jpg",
        type: "image/jpeg",
      } as unknown as Blob);
    }

    await apiRequest(`/cases/${selectedCase.id}/hearings`, {
      method: "POST",
      body: form,
    }, token);

    Alert.alert("Saved", "Hearing log stored and OCR requested.");
    await openCase(selectedCase.id);
    await loadData();
  }

  async function generateSmsPreview(type: "reminder" | "post_hearing") {
    if (!token || !selectedCase) return;

    const payload = await apiRequest<{ preview: { renderedText: string } }>("/notifications/preview", {
      method: "POST",
      body: JSON.stringify({ caseId: selectedCase.id, type }),
    }, token);
    setSmsPreview(payload.preview.renderedText);
  }

  function sourceLabel(sourceType: "live_ihc" | "demo_district") {
    return sourceType === "live_ihc" ? "IHC Live" : "District Demo";
  }

  if (line === "product") {
    return <ProductApp onBack={() => setLine("selector")} />;
  }

  if (line === "selector") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loginCard}>
          <Text style={styles.eyebrow}>Wakeel</Text>
          <Text style={styles.title}>Choose workspace</Text>
          <Text style={styles.copy}>
            The original demo stays available, but the new production line now runs in parallel with
            OTP auth, matters, client threads, documents, billing, and court-source modules.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => setLine("product")}>
            <Text style={styles.primaryButtonText}>Open product workspace</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setLine("demo")}>
            <Text style={styles.secondaryButtonText}>Open original demo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loginCard}>
          <Pressable onPress={() => setLine("selector")}>
            <Text style={styles.eyebrow}>Back to mode select</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Wakeel Demo</Text>
          <Text style={styles.title}>Lawyer mobile workflow</Text>
          <Text style={styles.copy}>
            Use a seeded demo number and fixed code 111111. This app covers today’s hearings,
            case review, hearing upload, OCR hook, and SMS preview.
          </Text>
          <View style={styles.tabRow}>
            {DEMO_USERS.map((user) => (
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
          </View>
          <TextInput value={phone} onChangeText={setPhone} style={styles.input} />
          <Pressable style={styles.primaryButton} onPress={login}>
            <Text style={styles.primaryButtonText}>Enter mobile demo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedCase) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => setSelectedCase(null)}>
            <Text style={styles.eyebrow}>Back</Text>
          </Pressable>
          <Text style={styles.title}>{selectedCase.rawCaseNumber}</Text>
          <Text style={styles.copy}>{selectedCase.title}</Text>
          <View style={styles.card}>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Court:</Text> {selectedCase.court}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Stage:</Text> {selectedCase.stage}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Next date:</Text> {selectedCase.nextDate ?? "TBC"}</Text>
            <Text style={styles.meta}><Text style={styles.metaLabel}>Source:</Text> {sourceLabel(selectedCase.sourceType)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add hearing log</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              placeholder="What happened in court?"
              value={notes}
              onChangeText={setNotes}
            />
            <TextInput
              style={styles.input}
              placeholder="Next date (YYYY-MM-DD)"
              value={nextDate}
              onChangeText={setNextDate}
            />
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={chooseImage}>
                <Text style={styles.secondaryButtonText}>{imageUri ? "Change image" : "Pick order image"}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={uploadHearing}>
                <Text style={styles.primaryButtonText}>Save hearing</Text>
              </Pressable>
            </View>
            {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client SMS preview</Text>
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => void generateSmsPreview("reminder")}>
                <Text style={styles.secondaryButtonText}>Reminder</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void generateSmsPreview("post_hearing")}>
                <Text style={styles.secondaryButtonText}>Post-hearing</Text>
              </Pressable>
            </View>
            {smsPreview ? <Text style={styles.copy}>{smsPreview}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent hearings</Text>
            {(selectedCase.hearings ?? []).map((hearing) => (
              <View key={hearing.id} style={styles.timelineItem}>
                <Text style={styles.metaLabel}>{hearing.hearingDate}</Text>
                <Text style={styles.meta}>{hearing.outcome}</Text>
                <Text style={styles.copy}>{hearing.notes}</Text>
                <Text style={styles.smallText}>OCR: {hearing.ocrStatus}</Text>
                {hearing.imageUrl ? (
                  <Image
                    source={{
                      uri: hearing.imageUrl.startsWith("http") ? hearing.imageUrl : `${API_BASE_URL}${hearing.imageUrl}`,
                      headers: token ? { authorization: `Bearer ${token}` } : undefined,
                    }}
                    style={styles.preview}
                  />
                ) : null}
                {hearing.ocrText ? <Text style={styles.copy}>{hearing.ocrText}</Text> : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const homeCards = [
    { label: "Cases", value: String(cases.length) },
    { label: "Hearings today", value: String(calendar.length) },
    { label: "Conflicts", value: String(calendar.filter((entry) => entry.isConflict).length) },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>Wakeel Mobile</Text>
        <Text style={styles.title}>Today’s focus</Text>
        <View style={styles.tabRow}>
          {(["home", "cases", "calendar"] as const).map((tabKey) => (
            <Pressable
              key={tabKey}
              style={[styles.pill, tab === tabKey ? styles.pillActive : null]}
              onPress={() => setTab(tabKey)}
            >
              <Text style={tab === tabKey ? styles.pillActiveText : styles.pillText}>{tabKey}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "home" ? (
          <View style={{ gap: 14 }}>
            <View style={styles.cardRow}>
              {homeCards.map((card) => (
                <View key={card.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.smallText}>{card.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Upcoming hearings</Text>
              <Text style={styles.smallText}>{formatLastSyncedLabel(lastSyncedAt)}</Text>
              {calendar.map((entry) => (
                <Pressable key={entry.id} style={styles.caseCard} onPress={() => void openCase(entry.caseId)}>
                  <Text style={styles.metaLabel}>{entry.rawCaseNumber}</Text>
                  <Text style={styles.copy}>{entry.caseTitle}</Text>
                  <Text style={styles.smallText}>
                    {entry.timeSlot} · {entry.court} · {sourceLabel(entry.source)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {tab === "cases" ? (
          <FlatList
            data={cases}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 140 }}
            renderItem={({ item }) => (
              <Pressable style={styles.caseCard} onPress={() => void openCase(item.id)}>
                <View style={styles.caseTopRow}>
                  <Text style={styles.metaLabel}>{item.rawCaseNumber}</Text>
                  <View style={[styles.sourceBadge, item.sourceType === "live_ihc" ? styles.liveBadge : styles.demoBadge]}>
                    <Text style={styles.badgeText}>{sourceLabel(item.sourceType)}</Text>
                  </View>
                </View>
                <Text style={styles.copy}>{item.title}</Text>
                <Text style={styles.smallText}>{item.court} · Next {item.nextDate ?? "TBC"}</Text>
              </Pressable>
            )}
          />
        ) : null}

        {tab === "calendar" ? (
          <FlatList
            data={calendar}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 140 }}
            renderItem={({ item }) => (
              <View style={styles.caseCard}>
                <View style={styles.caseTopRow}>
                  <Text style={styles.metaLabel}>{item.rawCaseNumber}</Text>
                  {item.isConflict ? (
                    <View style={[styles.sourceBadge, styles.conflictBadge]}>
                      <Text style={styles.badgeText}>Conflict</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.copy}>{item.caseTitle}</Text>
                <Text style={styles.smallText}>
                  {item.timeSlot} · {item.court} · {sourceLabel(item.source)}
                </Text>
              </View>
            )}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  if (process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true") {
    return <DemoSelectorApp />;
  }
  return <ProductApp />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  screen: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 16,
  },
  loginCard: {
    margin: 20,
    marginTop: 72,
    padding: 24,
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 14,
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.textSecondary,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  pillText: {
    color: theme.textPrimary,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  pillActiveText: {
    color: theme.surface,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  primaryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.surface,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: theme.primary,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 12,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.primaryLight,
    borderRadius: 16,
    padding: 16,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.primaryDark,
  },
  smallText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  caseCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    padding: 16,
    gap: 8,
  },
  caseTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  meta: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  metaLabel: {
    color: theme.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.textPrimary,
  },
  preview: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 14,
    backgroundColor: "#ddd",
  },
  timelineItem: {
    gap: 6,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderLeftColor: theme.border,
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveBadge: {
    backgroundColor: theme.primaryLight,
  },
  demoBadge: {
    backgroundColor: "#f4eee0",
  },
  conflictBadge: {
    backgroundColor: theme.accentLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.textPrimary,
  },
});
  function formatLastSyncedLabel(value: string | null) {
    if (!value) {
      return "IHC not synced yet";
    }

    return `IHC last synced at ${new Date(value).toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    })}`;
  }
