"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import {
  type ProductAuthState,
  ProductRequestError,
  productDocumentDownloadUrl,
  productJsonRequest,
  readStoredProductAuth,
  refreshProductAuth,
  writeStoredProductAuth,
} from "../../../lib/product-api";

export interface ClientProfile {
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

export interface ClientMatter {
  id: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  nextHearingAt: string | null;
  courtId: string;
}

export interface ClientMatterDetail extends ClientMatter {
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
    uploaderType?: string;
  }>;
  thread: { id: string } | null;
}

export interface MessageRecord {
  id: string;
  senderType: "staff" | "client";
  body: string;
  language: string;
  createdAt: string;
}

const CLIENT_PHONES = [
  { label: "Ahmed Zubair", phone: "03005550001" },
] as const;

const STORAGE_KEY = "legalbahi-client-auth";


import { formatCourtId, formatDateTime, toTitleCase } from "./components/helpers";
import PortalOtpPrompt from "./components/PortalOtpPrompt";
import ClientSidebar from "./components/ClientSidebar";
import HearingsTab from "./components/HearingsTab";
import DocumentsTab from "./components/DocumentsTab";
import ChatTab from "./components/ChatTab";
import DocumentViewerModal from "./components/DocumentViewerModal";

const UPLOAD_CATEGORIES = [
  { value: "Identity Document", label: "Identity Document (CNIC, Passport)" },
  { value: "Evidence", label: "Evidence / Proof (Receipts, Photos)" },
  { value: "Affidavit", label: "Affidavit (Bayan-e-Halfi)" },
  { value: "Agreement / Contract", label: "Agreement / Contract (Deeds, Iqrar)" },
  { value: "Court Notice", label: "Court Notice / Summons" },
  { value: "General", label: "General / Other" }
];

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
  const [portalLoaded, setPortalLoaded] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [matters, setMatters] = useState<ClientMatter[]>([]);
  const [selectedMatter, setSelectedMatter] = useState<ClientMatterDetail | null>(null);

  const authRef = useRef<ProductAuthState | null>(null);
  const portalAuthRef = useRef<ProductAuthState | null>(null);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  useEffect(() => {
    portalAuthRef.current = portalAuth;
  }, [portalAuth]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [portalMaskedPhone, setPortalMaskedPhone] = useState<string | null>(null);
  const [portalOtpCode, setPortalOtpCode] = useState<string>("");
  const [portalOtpDigits, setPortalOtpDigits] = useState<string[]>(Array(6).fill(""));

  useEffect(() => {
    const code = portalOtpDigits.join("");
    setPortalOtpCode(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      void verifyPortalReplyAccess(code);
    }
  }, [portalOtpDigits]);

  useEffect(() => {
    if (portalMaskedPhone) {
      const timer = setTimeout(() => {
        focusPortalOtpInput(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [portalMaskedPhone]);

  const focusPortalOtpInput = (index: number) => {
    const input = document.getElementById(`portal-otp-input-${index}`);
    if (input) {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }
  };

  const handlePortalOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, "").slice(-1);
    const nextDigits = [...portalOtpDigits];
    nextDigits[index] = cleanValue;
    setPortalOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      focusPortalOtpInput(index + 1);
    }
  };

  const handlePortalOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!portalOtpDigits[index] && index > 0) {
        const nextDigits = [...portalOtpDigits];
        nextDigits[index - 1] = "";
        setPortalOtpDigits(nextDigits);
        focusPortalOtpInput(index - 1);
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
      focusPortalOtpInput(5);
    }
  };

  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceSuccess, setWorkspaceSuccess] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"hearings" | "documents" | "chat">("hearings");
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<{ id: string; title: string; mimeType?: string } | null>(null);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState<string>("General");

  useEffect(() => {
    setAuth(readStoredProductAuth(STORAGE_KEY));
    setAuthHydrated(true);
  }, []);

  useEffect(() => {
    if (!authHydrated) {
      return;
    }
    writeStoredProductAuth(STORAGE_KEY, auth);
    if (auth && !incomingPortalToken && !profile) {
      void loadWorkspace(auth).catch(handleWorkspaceLoadError);
    }
  }, [auth, authHydrated, incomingPortalToken, profile]);

  useEffect(() => {
    if (authHydrated && !incomingPortalToken && !auth) {
      router.replace("/");
    }
  }, [authHydrated, incomingPortalToken, auth, router]);

  useEffect(() => {
    if (!portalAuth || !incomingPortalToken || portalLoaded) {
      return;
    }
    void loadPortal(incomingPortalToken, portalAuth).catch(handleWorkspaceLoadError);
  }, [incomingPortalToken, portalAuth, portalLoaded]);

  function handleWorkspaceLoadError(error: unknown) {
    if (error instanceof ProductRequestError && (error.status === 401 || error.status === 403)) {
      void signOut();
      setWorkspaceError("Your session expired or access was denied. Please sign in again.");
      return;
    }
    setWorkspaceError(error instanceof Error ? error.message : "Could not load the workspace.");
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
    setPortalLoaded(true);
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
    setLoginCode("");
    setOtpRequested(true);
    setTimeout(() => focusPortalOtpInput(0), 0);
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
    try {
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
      setWorkspaceError(null);
    } catch (error) {
      handleWorkspaceLoadError(error);
    }
  }

  async function openPortalMatter(matterId: string, portalToken: string, activePortalAuth = portalAuth) {
    if (!activePortalAuth) {
      return;
    }
    try {
      if (selectedMatter?.id !== matterId) {
        setActiveSubTab("hearings");
      }
      const payload = await productJsonRequest<{ case: ClientMatterDetail; messages: MessageRecord[] }>(
        `/v1/portal/cases/${matterId}?token=${encodeURIComponent(portalToken)}`,
        {},
        activePortalAuth.token,
      );
      setSelectedMatter(payload.case);
      setMessages(payload.messages ?? []);
      setWorkspaceError(null);
    } catch (error) {
      if (error instanceof ProductRequestError && (error.status === 401 || error.status === 403 || error.status === 404)) {
        setPortalAuth(null);
        setPortalMaskedPhone(null);
        setPortalOtpDigits(Array(6).fill(""));
        setWorkspaceError("Your portal access expired. Please verify OTP again.");
        return;
      }
      setWorkspaceError(error instanceof Error ? error.message : "Could not open this matter.");
    }
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
    setDraft("");
    await openMatter(selectedMatter.id, payload.auth);
  }

  const handleUploadSuccess = (newDoc: any) => {
    setSelectedMatter((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        documents: [newDoc, ...prev.documents],
      };
    });
  };

  async function uploadDocument(file: File, documentType: string = "General") {
    if (!selectedMatter) return;
    let activeAuth = authRef.current ?? portalAuthRef.current;
    if (!activeAuth) return;

    setIsUploading(true);
    setWorkspaceError(null);
    setWorkspaceSuccess(null);

    const formData = new FormData();
    formData.append("matterId", selectedMatter.id);
    formData.append("type", documentType);
    formData.append("documentType", documentType);
    formData.append("file", file);

    try {
      let token = activeAuth.token;
      let response;
      try {
        response = await productJsonRequest<{ document: any }>("/v1/documents", {
          method: "POST",
          body: formData,
        }, token);
      } catch (error) {
        if (error instanceof ProductRequestError && error.status === 401 && activeAuth.refreshToken) {
          const refreshed = await refreshProductAuth(activeAuth.refreshToken);
          if (incomingPortalToken) {
            portalAuthRef.current = refreshed;
            setPortalAuth(refreshed);
          } else {
            authRef.current = refreshed;
            writeStoredProductAuth(STORAGE_KEY, refreshed);
            setAuth(refreshed);
          }
          activeAuth = refreshed;
          token = refreshed.token;
          response = await productJsonRequest<{ document: any }>("/v1/documents", {
            method: "POST",
            body: formData,
          }, token);
        } else {
          throw error;
        }
      }

      if (response && response.document) {
        handleUploadSuccess(response.document);
        setWorkspaceSuccess("Document uploaded successfully.");
        setTimeout(() => setWorkspaceSuccess(null), 5000);
      }
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
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
    setPortalOtpCode("");
    setPortalOtpDigits(Array(6).fill(""));
    setTimeout(() => focusPortalOtpInput(0), 0);
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
    portalAuthRef.current = nextAuth;
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

  async function openDocument(documentId: string, portalToken?: string | null, activeAuthOverride?: ProductAuthState | null) {
    let activeAuth = activeAuthOverride !== undefined ? activeAuthOverride : (portalToken ? portalAuthRef.current : authRef.current);
    try {
      let response = await fetch(productDocumentDownloadUrl(documentId, portalToken ?? undefined), {
        headers: activeAuth ? { authorization: `Bearer ${activeAuth.token}` } : undefined,
      });

      if (response.status === 401 && activeAuth?.refreshToken) {
        const refreshed = await refreshProductAuth(activeAuth.refreshToken);
        if (portalToken) {
          portalAuthRef.current = refreshed;
          setPortalAuth(refreshed);
        } else {
          authRef.current = refreshed;
          writeStoredProductAuth(STORAGE_KEY, refreshed);
          setAuth(refreshed);
        }
        response = await fetch(productDocumentDownloadUrl(documentId, portalToken ?? undefined), {
          headers: { authorization: `Bearer ${refreshed.token}` },
        });
      }

      if (response.status === 401 || response.status === 403) {
        if (portalToken) {
          portalAuthRef.current = null;
          setPortalAuth(null);
          setPortalLoaded(false);
          setWorkspaceError("Your portal access expired. Please verify OTP again.");
        } else {
          void signOut();
          setWorkspaceError("Your session expired or access was denied. Please sign in again.");
        }
        return;
      }

      if (!response.ok) {
        let errorMessage = "Could not download this document.";
        try {
          const body = await response.text();
          const parsed = JSON.parse(body);
          if (parsed.error) errorMessage = parsed.error;
          else errorMessage = body;
        } catch {}
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Find document title and mimeType
      const doc = selectedMatter?.documents.find((d) => d.id === documentId);
      const docTitle = doc?.title || "Document Viewer";
      const docMime = doc?.mimeType || "";
      setViewingDocument({ id: documentId, title: docTitle, mimeType: docMime });
      setViewingDocumentUrl(url);
      setWorkspaceError(null);
    } catch (error) {
      setWorkspaceError(error instanceof TypeError
        ? "Could not reach API."
        : error instanceof Error
          ? error.message
          : "Could not download this document.");
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
    portalAuthRef.current = null;
    setAuth(null);
    setPortalAuth(null);
    setPortalLoaded(false);
    setProfile(null);
    setSelectedMatter(null);
    setMatters([]);
    setMessages([]);
  }

  const subTabStyle = (isActive: boolean): CSSProperties => ({
    flex: 1,
    border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
    background: isActive ? "var(--primary)" : "var(--surface)",
    color: isActive ? "#ffffff" : "var(--text-secondary)",
    boxShadow: isActive ? "0 10px 22px rgba(15, 110, 86, 0.18)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
  });

  if (incomingPortalToken) {
    return (
      <main className="page-shell">
        <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
          <ClientSidebar
            profile={null}
            matters={matters}
            selectedMatter={selectedMatter}
            openMatter={openMatter}
            openPortalMatter={openPortalMatter}
            incomingPortalToken={incomingPortalToken}
            portalAuth={portalAuth}
            signOut={signOut}
            otpPromptNode={
              <PortalOtpPrompt
                portalMaskedPhone={portalMaskedPhone}
                portalOtpDigits={portalOtpDigits}
                requestPortalReplyAccess={requestPortalReplyAccess}
                verifyPortalReplyAccess={verifyPortalReplyAccess}
                handlePortalOtpChange={handlePortalOtpChange}
                handlePortalOtpKeyDown={handlePortalOtpKeyDown}
                handlePortalOtpPaste={handlePortalOtpPaste}
                setPortalMaskedPhone={setPortalMaskedPhone}
                setPortalOtpCode={setPortalOtpCode}
                setPortalOtpDigits={setPortalOtpDigits}
                workspaceError={workspaceError}
              />
            }
          />

          {selectedMatter && portalAuth ? (
            <section className="grid">
              {workspaceError ? (
                <div className="panel" style={{ borderColor: "rgba(185, 28, 28, 0.25)", color: "#991b1b" }}>
                  {workspaceError}
                </div>
              ) : null}
              {workspaceSuccess ? (
                <div className="panel" style={{ borderColor: "rgba(16, 185, 129, 0.25)", color: "#065f46", backgroundColor: "#ecfdf5" }}>
                  {workspaceSuccess}
                </div>
              ) : null}
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
                  style={subTabStyle(activeSubTab === "hearings")}
                >
                  Hearings
                </button>
                <button
                  type="button"
                  className={activeSubTab === "documents" ? "button" : "button-secondary"}
                  onClick={() => setActiveSubTab("documents")}
                  style={subTabStyle(activeSubTab === "documents")}
                >
                  Shared Documents
                </button>
                <button
                  type="button"
                  className={activeSubTab === "chat" ? "button" : "button-secondary"}
                  onClick={() => setActiveSubTab("chat")}
                  style={subTabStyle(activeSubTab === "chat")}
                >
                  Chat with Counsel
                </button>
              </div>

              {activeSubTab === "hearings" && (
                <HearingsTab selectedMatter={selectedMatter} />
              )}

              {activeSubTab === "documents" && (
                <DocumentsTab
                  selectedMatter={selectedMatter}
                  openDocument={(docId) => void openDocument(docId, incomingPortalToken, portalAuth)}
                  onInitiateUpload={() => setIsUploadModalOpen(true)}
                  isUploading={isUploading}
                />
              )}

              {activeSubTab === "chat" && (
                <ChatTab
                  messages={messages}
                  draft={draft}
                  setDraft={setDraft}
                  sendMessage={sendMessage}
                />
              )}
            </section>
          ) : null}
        </section>

        {viewingDocumentUrl && viewingDocument && (
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

        {/* Upload Category Selection Modal */}
        {isUploadModalOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "20px"
          }} onClick={() => setIsUploadModalOpen(false)}>
            <div style={{
              backgroundColor: "var(--surface)",
              borderRadius: "18px",
              border: "1px solid var(--border)",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>Select Document Type</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                  Categorize this upload so counsel can identify it instantly
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {UPLOAD_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setSelectedUploadType(cat.value);
                      setIsUploadModalOpen(false);
                      setTimeout(() => {
                        document.getElementById("client-file-upload")?.click();
                      }, 80);
                    }}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      background: "var(--background)",
                      color: "var(--text-primary)",
                      fontSize: "13.5px",
                      fontWeight: 600,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      lineHeight: "1.3"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.background = "rgba(15, 110, 86, 0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--background)";
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{
                  background: "none",
                  border: 0,
                  color: "#ef4444",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "8px",
                  marginTop: "4px"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          id="client-file-upload"
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void uploadDocument(file, selectedUploadType);
            }
          }}
          disabled={isUploading}
          style={{ display: "none" }}
        />
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
        <ClientSidebar
          profile={profile}
          matters={matters}
          selectedMatter={selectedMatter}
          openMatter={openMatter}
          openPortalMatter={openPortalMatter}
          incomingPortalToken={null}
          portalAuth={null}
          signOut={signOut}
        />

        {selectedMatter ? (
          <section className="grid">
            {workspaceError ? (
              <div className="panel" style={{ borderColor: "rgba(185, 28, 28, 0.25)", color: "#991b1b" }}>
                {workspaceError}
              </div>
            ) : null}
            {workspaceSuccess ? (
              <div className="panel" style={{ borderColor: "rgba(16, 185, 129, 0.25)", color: "#065f46", backgroundColor: "#ecfdf5" }}>
                {workspaceSuccess}
              </div>
            ) : null}
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
                style={subTabStyle(activeSubTab === "hearings")}
              >
                Hearings
              </button>
              <button
                type="button"
                className={activeSubTab === "documents" ? "button" : "button-secondary"}
                onClick={() => setActiveSubTab("documents")}
                style={subTabStyle(activeSubTab === "documents")}
              >
                Shared Documents
              </button>
              <button
                type="button"
                className={activeSubTab === "chat" ? "button" : "button-secondary"}
                onClick={() => setActiveSubTab("chat")}
                style={subTabStyle(activeSubTab === "chat")}
              >
                Chat with Counsel
              </button>
            </div>

            {activeSubTab === "hearings" && (
              <HearingsTab selectedMatter={selectedMatter} />
            )}

            {activeSubTab === "documents" && (
              <DocumentsTab
                selectedMatter={selectedMatter}
                openDocument={(docId) => void openDocument(docId)}
                onInitiateUpload={() => setIsUploadModalOpen(true)}
                isUploading={isUploading}
              />
            )}

            {activeSubTab === "chat" && (
              <ChatTab
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                sendMessage={sendMessage}
              />
            )}
          </section>
        ) : null}
      </section>

      {/* Lightbox Document Viewer */}
      {viewingDocumentUrl && viewingDocument && (
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

      {/* Upload Category Selection Modal */}
      {isUploadModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "20px"
        }} onClick={() => setIsUploadModalOpen(false)}>
          <div style={{
            backgroundColor: "var(--surface)",
            borderRadius: "18px",
            border: "1px solid var(--border)",
            padding: "24px",
            maxWidth: "480px",
            width: "100%",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>Select Document Type</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                Categorize this upload so counsel can identify it instantly
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {UPLOAD_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setSelectedUploadType(cat.value);
                    setIsUploadModalOpen(false);
                    setTimeout(() => {
                      document.getElementById("client-file-upload")?.click();
                    }, 80);
                  }}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    color: "var(--text-primary)",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    lineHeight: "1.3"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "rgba(15, 110, 86, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--background)";
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(false)}
              style={{
                background: "none",
                border: 0,
                color: "#ef4444",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                padding: "8px",
                marginTop: "4px"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        id="client-file-upload"
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void uploadDocument(file, selectedUploadType);
          }
        }}
        disabled={isUploading}
        style={{ display: "none" }}
      />
    </main>
  );
}
