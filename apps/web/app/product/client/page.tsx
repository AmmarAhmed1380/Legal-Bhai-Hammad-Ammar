"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import {
  type ProductAuthState,
  ProductRequestError,
  productDocumentDownloadUrl,
  productJsonRequest,
  readStoredProductAuth,
  refreshProductAuth,
  writeStoredProductAuth,
} from "../../../lib/product-api";

interface ClientProfile {
  actorType: "client";
  clientAccount: {
    id: string;
    phone: string;
    displayName: string;
    language: string;
  };
  firm: {
    id: string;
    name: string;
    primaryCity: string;
  } | null;
}

interface ClientMatter {
  id: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  nextHearingAt: string | null;
  courtId: string;
}

interface ClientMatterDetail extends ClientMatter {
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
    mimeType: string;
    ocrStatus: string;
  }>;
  thread: { id: string } | null;
}

interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  language: string;
  createdAt: string;
}

const CLIENT_PHONES = [
  { label: "Ahmed Zubair", phone: "03005550001" },
  { label: "Farooq Traders", phone: "03005550002" },
] as const;

const STORAGE_KEY = "legalbahi-client-auth";


function formatDateTime(value: string | null): string {
  if (!value) {
    return "To Be Confirmed";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  
  if (value.length <= 10) return dateStr;
  return `${dateStr} • ${timeStr}`;
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

export default function ProductClientPage() {
  return (
    <Suspense fallback={<main className="page-shell"><section className="auth-card"><p className="muted">Loading client workspace…</p></section></main>}>
      <ProductClientWorkspace />
    </Suspense>
  );
}

function ProductClientWorkspace() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const portalTokenFromPath = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "c" && segments[1]) {
      return segments[1];
    }
    return null;
  }, [pathname]);
  const incomingPortalToken = portalTokenFromPath ?? searchParams.get("token");

  const [phone, setPhone] = useState<string>(CLIENT_PHONES[0].phone);
  const [auth, setAuth] = useState<ProductAuthState | null>(null);
  const [portalAuth, setPortalAuth] = useState<ProductAuthState | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [matters, setMatters] = useState<ClientMatter[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<ClientMatterDetail | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("Please confirm whether any further documents are needed from my side.");
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [portalMaskedPhone, setPortalMaskedPhone] = useState<string | null>(null);
  const [portalOtpCode, setPortalOtpCode] = useState<string>("");
  const [portalOtpDigits, setPortalOtpDigits] = useState<string[]>(Array(6).fill(""));
  const [portalDevCode, setPortalDevCode] = useState<string | null>(null);

  useEffect(() => {
    const code = portalOtpDigits.join("");
    setPortalOtpCode(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      void verifyPortalReplyAccess(code);
    }
  }, [portalOtpDigits]);

  const handlePortalOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, "").slice(-1);
    const nextDigits = [...portalOtpDigits];
    nextDigits[index] = cleanValue;
    setPortalOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      const nextInput = document.getElementById(`portal-otp-input-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }
  };

  const handlePortalOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!portalOtpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`portal-otp-input-${index - 1}`);
        if (prevInput) {
          const nextDigits = [...portalOtpDigits];
          nextDigits[index - 1] = "";
          setPortalOtpDigits(nextDigits);
          (prevInput as HTMLInputElement).focus();
        }
      } else {
        const nextDigits = [...portalOtpDigits];
        nextDigits[index] = "";
        setPortalOtpDigits(nextDigits);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const code = portalOtpDigits.join("");
      void verifyPortalReplyAccess(code);
    }
  };

  const handlePortalOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      setPortalOtpDigits(pasteData.split(""));
      const lastInput = document.getElementById("portal-otp-input-5");
      if (lastInput) {
        (lastInput as HTMLInputElement).focus();
      }
    }
  };

  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"hearings" | "documents" | "chat">("hearings");
  const [viewingDocument, setViewingDocument] = useState<{ id: string; title: string; mimeType?: string } | null>(null);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  useEffect(() => {
    setAuth(readStoredProductAuth(STORAGE_KEY));
    setAuthHydrated(true);
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    writeStoredProductAuth(STORAGE_KEY, auth);
    if (auth && !incomingPortalToken) {
      void loadWorkspace(auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, authHydrated, incomingPortalToken]);

  useEffect(() => {
    if (authHydrated && !incomingPortalToken && !auth) {
      router.replace("/");
    }
  }, [authHydrated, incomingPortalToken, auth, router]);

  useEffect(() => {
    if (!portalAuth || !incomingPortalToken) {
      return;
    }
    void loadPortal(incomingPortalToken, portalAuth).catch(handleWorkspaceLoadError);
  }, [incomingPortalToken, portalAuth]);

  function handleWorkspaceLoadError(error: unknown) {
    if (error instanceof ProductRequestError && (error.status === 401 || error.status === 403)) {
      signOut();
      setWorkspaceError("Your session expired or access was denied. Please sign in again.");
      return;
    }
    setWorkspaceError(error instanceof Error ? error.message : "Could not load the workspace.");
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
    const meResponse = await authedRequest<{ profile: ClientProfile }>("/v1/me", {}, activeAuth);
    const matterResponse = await authedRequest<{ matters: ClientMatter[] }>("/v1/clients/me/matters", {}, meResponse.auth);
    const me = meResponse.data;
    const matterPayload = matterResponse.data;
    const resolvedAuth = matterResponse.auth;

    setProfile(me.profile);
    setMatters(matterPayload.matters);

    const firstMatterId = selectedMatter?.id ?? matterPayload.matters[0]?.id;
    if (firstMatterId) {
      await openMatter(firstMatterId, resolvedAuth);
    }
  }

  async function loadPortal(portalToken: string, activePortalAuth: ProductAuthState) {
    const matterPayload = await productJsonRequest<{ cases: ClientMatter[] }>(
      `/v1/portal/cases?token=${encodeURIComponent(portalToken)}`,
      {},
      activePortalAuth.token,
    );
    setMatters(matterPayload.cases);
    const firstMatterId = selectedMatter?.id ?? matterPayload.cases[0]?.id;
    if (firstMatterId) {
      await openPortalMatter(firstMatterId, portalToken, activePortalAuth);
    }
  }

  async function startLogin() {
    const requestPayload = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone, actorType: "client" }),
    });
    setLoginCode(requestPayload.devCode ?? "");
    setOtpRequested(true);
  }

  async function verifyLogin() {
    const verifyPayload = await productJsonRequest<{ token: string; refreshToken: string | null }>("/v1/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, actorType: "client", code: loginCode }),
    });
    const nextAuth = {
      token: verifyPayload.token,
      refreshToken: verifyPayload.refreshToken,
    };
    writeStoredProductAuth(STORAGE_KEY, nextAuth);
    setAuth(nextAuth);
  }

  async function openMatter(matterId: string, activeAuth = auth) {
    if (!activeAuth) {
      return;
    }
    if (selectedMatter?.id !== matterId) {
      setActiveSubTab("hearings");
    }
    const { data: payload, auth: resolvedAuth } = await authedRequest<{ matter: ClientMatterDetail }>(
      `/v1/clients/me/matters/${matterId}`,
      {},
      activeAuth,
    );
    setSelectedMatter(payload.matter);
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

  async function openPortalMatter(matterId: string, portalToken: string, activePortalAuth = portalAuth) {
    if (!activePortalAuth) {
      return;
    }
    if (selectedMatter?.id !== matterId) {
      setActiveSubTab("hearings");
    }
    const payload = await productJsonRequest<{ case: ClientMatterDetail }>(
      `/v1/portal/cases/${matterId}?token=${encodeURIComponent(portalToken)}`,
      {},
      activePortalAuth.token,
    );
    setSelectedMatter(payload.case);
    setMessages([]);
  }

  async function sendMessage() {
    if (!auth || !selectedMatter?.thread?.id) {
      return;
    }
    const payload = await authedRequest(`/v1/threads/${selectedMatter.thread.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: draft,
        language: profile?.clientAccount.language === "ur" ? "ur" : "en",
        deliveryChannel: "in_app",
      }),
    }, auth);
    setDraft("Please confirm whether any further documents are needed from my side.");
    await openMatter(selectedMatter.id, payload.auth);
  }

  async function requestPortalReplyAccess() {
    if (!incomingPortalToken) {
      return;
    }
    const payload = await productJsonRequest<{ devCode: string | null; maskedPhone: string }>("/v1/portal/otp", {
      method: "POST",
      body: JSON.stringify({ token: incomingPortalToken }),
    });
    setPortalMaskedPhone(payload.maskedPhone);
    setPortalDevCode(payload.devCode);
    if (payload.devCode) {
      setPortalOtpCode(payload.devCode);
      setPortalOtpDigits(payload.devCode.split("").slice(0, 6));
    } else {
      setPortalOtpDigits(Array(6).fill(""));
    }
  }

  async function verifyPortalReplyAccess(codeOverride?: string) {
    const codeToUse = codeOverride || portalOtpCode;
    if (!incomingPortalToken || !codeToUse) {
      return;
    }
    const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>("/v1/portal/otp/verify", {
      method: "POST",
      body: JSON.stringify({ token: incomingPortalToken, code: codeToUse }),
    });
    const nextAuth = {
      token: payload.token,
      refreshToken: payload.refreshToken,
    };
    setPortalAuth(nextAuth);
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

  async function openDocument(documentId: string, portalToken?: string | null, activeAuth = auth) {
    let response = await fetch(productDocumentDownloadUrl(documentId, portalToken ?? undefined), {
      headers: activeAuth ? { authorization: `Bearer ${activeAuth.token}` } : undefined,
    });

    if (response.status === 401 && activeAuth?.refreshToken) {
      const refreshed = await refreshProductAuth(activeAuth.refreshToken);
      setAuth(refreshed);
      response = await fetch(productDocumentDownloadUrl(documentId, portalToken ?? undefined), {
        headers: { authorization: `Bearer ${refreshed.token}` },
      });
    }

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Find document title and mimeType
    const doc = selectedMatter?.documents.find((d) => d.id === documentId);
    const docTitle = doc?.title || "Document Viewer";
    const docMime = doc?.mimeType || "";
    setViewingDocument({ id: documentId, title: docTitle, mimeType: docMime });
    setViewingDocumentUrl(url);
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
    setPortalAuth(null);
    setProfile(null);
    setSelectedMatter(null);
    setMessages([]);
  }

  if (incomingPortalToken) {
    return (
      <main className="page-shell">
        <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
          <aside className="grid">
            <div className="panel">
              <div className="eyebrow">Portal access</div>
              <h1 className="title">Client portal</h1>
              <p className="muted">Enter the client OTP before Legal Bhai shows the one matter protected by this link.</p>
              {workspaceError ? <p className="muted">{workspaceError}</p> : null}
              {!portalAuth && !portalMaskedPhone ? (
                <button className="button-secondary" type="button" onClick={() => void requestPortalReplyAccess()}>
                  Request portal OTP
                </button>
              ) : null}
              {!portalAuth && portalMaskedPhone ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPortalMaskedPhone(null);
                        setPortalDevCode(null);
                        setPortalOtpCode("");
                        setPortalOtpDigits(Array(6).fill(""));
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                        padding: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      title="Go back"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <label style={{ margin: 0, fontWeight: 600 }}>OTP for {portalMaskedPhone}</label>
                  </div>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
                    {portalOtpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`portal-otp-input-${idx}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePortalOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handlePortalOtpKeyDown(idx, e)}
                        onPaste={handlePortalOtpPaste}
                        style={{
                          width: "48px",
                          height: "48px",
                          fontSize: "20px",
                          fontWeight: "700",
                          textAlign: "center",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "rgba(255, 255, 255, 0.8)"
                        }}
                      />
                    ))}
                  </div>
                  {portalDevCode ? <p className="muted" style={{ textAlign: "center" }}>Development OTP: <strong>{portalDevCode}</strong></p> : null}
                  
                  {/* Resend OTP should be on top of verify & sign in */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <button
                      type="button"
                      onClick={() => void requestPortalReplyAccess()}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                        fontSize: "13px"
                      }}
                    >
                      Resend OTP
                    </button>
                  </div>

                  <button className="button" style={{ width: "100%", marginTop: 0 }} type="button" onClick={() => void verifyPortalReplyAccess()}>
                    Verify and open shared matter
                  </button>
                </div>
              ) : null}
            </div>

            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
              <div className="case-list">
                {matters.map((matter) => (
                  <button
                    key={matter.id}
                    className="case-card"
                    type="button"
                    onClick={() => void openPortalMatter(matter.id, incomingPortalToken, portalAuth)}
                    style={{ textAlign: "left", cursor: "pointer" }}
                  >
                    <div className="top-bar" style={{ marginBottom: 10 }}>
                      <strong>{matter.rawCaseNumber}</strong>
                      <span className="badge live">{toTitleCase(matter.stage)}</span>
                    </div>
                    <div>{matter.title}</div>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {formatCourtId(matter.courtId)} · Next {formatDateTime(matter.nextHearingAt)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {selectedMatter ? (
            <section className="grid">
              <div className="panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="eyebrow" style={{ margin: 0 }}>Matter timeline</div>
                <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{selectedMatter.rawCaseNumber}</h2>
                <div style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--text-secondary)" }}>{selectedMatter.title}</div>
                <div className="info-list" style={{ gap: "8px", marginTop: "4px" }}>
                  <div><strong>Stage:</strong> {toTitleCase(selectedMatter.stage)}</div>
                  <div><strong>Next Hearing:</strong> {formatDateTime(selectedMatter.nextHearingAt)}</div>
                  <div><strong>Court:</strong> {formatCourtId(selectedMatter.courtId)}</div>
                </div>
              </div>

              {/* Matter Sub-Navigation */}
              <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                <button
                  type="button"
                  className={activeSubTab === "hearings" ? "button" : "button-secondary"}
                  onClick={() => setActiveSubTab("hearings")}
                  style={{ flex: 1 }}
                >
                  Hearings
                </button>
                <button
                  type="button"
                  className={activeSubTab === "documents" ? "button" : "button-secondary"}
                  onClick={() => setActiveSubTab("documents")}
                  style={{ flex: 1 }}
                >
                  Shared Documents
                </button>
              </div>

              {activeSubTab === "hearings" && (
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Hearings</h2>
                  <div className="grid">
                    {selectedMatter.hearings.map((hearing) => (
                      <article key={hearing.id} className="hearing">
                        <strong>{formatDateTime(hearing.listedAt)}</strong>
                        <div>{hearing.outcome}</div>
                        <p className="muted">{hearing.notes}</p>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {activeSubTab === "documents" && (
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
                        onClick={() => void openDocument(document.id, incomingPortalToken, portalAuth)}
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
                </div>
              )}
            </section>
          ) : null}
        </section>
      </main>
    );
  }

  if (!authHydrated) {
    return (
      <main className="page-shell">
        <section className="auth-card" style={{ textAlign: "center" }}>
          <p className="muted">Loading client workspace…</p>
        </section>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="page-shell">
        <section className="auth-card" style={{ textAlign: "center" }}>
          <p className="muted">Redirecting to login…</p>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page-shell">
        <section className="auth-card" style={{ textAlign: "center" }}>
          <p className="muted">Loading client profile…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <div className="eyebrow">Client Workspace</div>
          <h1 className="title" style={{ marginBottom: 4 }}>
            {profile.clientAccount.displayName}
          </h1>
          <p className="muted">{profile.firm?.name ?? "Legal Bhai"}</p>
        </div>
        <div className="actions">
          <button className="button" type="button" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </div>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
        <aside className="grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
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
                    <span className="badge live">{toTitleCase(matter.stage)}</span>
                  </div>
                  <div>{matter.title}</div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {formatCourtId(matter.courtId)} · Next {formatDateTime(matter.nextHearingAt)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {selectedMatter ? (
          <section className="grid">
            <div className="panel" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="eyebrow" style={{ margin: 0 }}>Matter timeline</div>
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{selectedMatter.rawCaseNumber}</h2>
              <div style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--text-secondary)" }}>{selectedMatter.title}</div>
              <div className="info-list" style={{ gap: "8px", marginTop: "4px" }}>
                <div><strong>Stage:</strong> {toTitleCase(selectedMatter.stage)}</div>
                <div><strong>Next Hearing:</strong> {formatDateTime(selectedMatter.nextHearingAt)}</div>
                <div><strong>Court:</strong> {formatCourtId(selectedMatter.courtId)}</div>
              </div>
            </div>

            {/* Matter Sub-Navigation */}
            <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
              <button
                type="button"
                className={activeSubTab === "hearings" ? "button" : "button-secondary"}
                onClick={() => setActiveSubTab("hearings")}
                style={{ flex: 1 }}
              >
                Hearings
              </button>
              <button
                type="button"
                className={activeSubTab === "documents" ? "button" : "button-secondary"}
                onClick={() => setActiveSubTab("documents")}
                style={{ flex: 1 }}
              >
                Shared Documents
              </button>
              <button
                type="button"
                className={activeSubTab === "chat" ? "button" : "button-secondary"}
                onClick={() => setActiveSubTab("chat")}
                style={{ flex: 1 }}
              >
                Chat with Counsel
              </button>
            </div>

            {activeSubTab === "hearings" && (
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Hearings</h2>
                <div className="grid">
                  {selectedMatter.hearings.map((hearing) => (
                    <article key={hearing.id} className="hearing">
                      <strong>{formatDateTime(hearing.listedAt)}</strong>
                      <div>{hearing.outcome}</div>
                      <p className="muted">{hearing.notes}</p>
                      {hearing.nextDate ? <div className="muted">Next Date: {formatDateTime(hearing.nextDate)}</div> : null}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === "documents" && (
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
              </div>
            )}

            {activeSubTab === "chat" && (
              <div className="panel">
                 <h2 style={{ marginTop: 0 }}>Chat</h2>
                 <div style={{
                   maxHeight: 380,
                   overflowY: "auto",
                   overflowX: "hidden",
                   paddingRight: "12px",
                   marginBottom: 20,
                   display: "flex",
                   flexDirection: "column",
                   gap: "12px"
                 }}>
                   {messages.map((message) => {
                     const isMe = message.senderType === "client";
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
                           {isMe ? "You" : "Counsel"}
                         </strong>
                         <p style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", wordBreak: "break-word", lineHeight: "1.4" }}>
                           {message.body}
                         </p>
                         <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px", textAlign: isMe ? "right" : "left" }}>
                           {formatDateTime(message.createdAt)}
                         </div>
                       </div>
                     );
                   })}
                 </div>
                
                {/* Instagram style message box */}
                <div style={{ display: "flex", alignItems: "center", position: "relative", marginTop: 12 }}>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={profile.clientAccount.language === "ur" ? "پیغام لکھیں..." : "Write a message..."}
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
                    disabled={!draft.trim()}
                    style={{
                      position: "absolute",
                      right: "6px",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "none",
                      background: draft.trim() ? "var(--primary)" : "var(--text-tertiary)",
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
            )}
          </section>
        ) : null}
      </section>

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
                    fontSize: "20px",
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
