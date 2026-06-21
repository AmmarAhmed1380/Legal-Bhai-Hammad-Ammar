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
  { label: "Farooq Traders", phone: "03005550002" },
] as const;

const STORAGE_KEY = "legalbahi-client-auth";


import { formatCourtId, formatDateTime, toTitleCase } from "./components/helpers";
import PortalOtpPrompt from "./components/PortalOtpPrompt";
import ClientSidebar from "./components/ClientSidebar";
import HearingsTab from "./components/HearingsTab";
import DocumentsTab from "./components/DocumentsTab";
import ChatTab from "./components/ChatTab";
import DocumentViewerModal from "./components/DocumentViewerModal";

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

  useEffect(() => {
    const code = portalOtpDigits.join("");
    setPortalOtpCode(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      void verifyPortalReplyAccess(code);
    }
  }, [portalOtpDigits]);

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
    setLoginCode("");
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
    setPortalOtpCode("");
    setPortalOtpDigits(Array(6).fill(""));
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
                <HearingsTab selectedMatter={selectedMatter} />
              )}

              {activeSubTab === "documents" && (
                <DocumentsTab
                  selectedMatter={selectedMatter}
                  openDocument={(docId) => void openDocument(docId, incomingPortalToken, portalAuth)}
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
              <HearingsTab selectedMatter={selectedMatter} />
            )}

            {activeSubTab === "documents" && (
              <DocumentsTab
                selectedMatter={selectedMatter}
                openDocument={(docId) => void openDocument(docId)}
              />
            )}

            {activeSubTab === "chat" && (
              <ChatTab
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                sendMessage={sendMessage}
                profile={profile}
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
    </main>
  );
}
