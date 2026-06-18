"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
    return "To be confirmed";
  }
  return new Date(value).toLocaleString();
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
  const [portalDevCode, setPortalDevCode] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

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
    setPortalOtpCode(payload.devCode ?? "");
  }

  async function verifyPortalReplyAccess() {
    if (!incomingPortalToken || !portalOtpCode) {
      return;
    }
    const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>("/v1/portal/otp/verify", {
      method: "POST",
      body: JSON.stringify({ token: incomingPortalToken, code: portalOtpCode }),
    });
    const nextAuth = {
      token: payload.token,
      refreshToken: payload.refreshToken,
    };
    setPortalAuth(nextAuth);
  }

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
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
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
        <section className="dashboard-grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
          <aside className="grid">
            <div className="panel">
              <div className="eyebrow">Portal access</div>
              <h1 className="title">Client portal</h1>
              <p className="muted">Enter the client OTP before Legal Bhai shows the one matter protected by this link.</p>
              {workspaceError ? <p className="muted">{workspaceError}</p> : null}
              {!portalAuth ? <button className="button-secondary" type="button" onClick={() => void requestPortalReplyAccess()}>
                Request portal OTP
              </button> : null}
              {!portalAuth && portalMaskedPhone ? (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>OTP for {portalMaskedPhone}</label>
                  <input value={portalOtpCode} onChange={(event) => setPortalOtpCode(event.target.value)} />
                  {portalDevCode ? <p className="muted">Development OTP: <strong>{portalDevCode}</strong></p> : null}
                  <button className="button" type="button" onClick={() => void verifyPortalReplyAccess()}>
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
                      <span className="badge live">{matter.stage}</span>
                    </div>
                    <div>{matter.title}</div>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {matter.courtId} · Next {matter.nextHearingAt ?? "TBC"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {selectedMatter ? (
            <section className="grid">
              <div className="panel">
                <div className="eyebrow">Matter timeline</div>
                <h2 style={{ marginTop: 6 }}>{selectedMatter.rawCaseNumber}</h2>
                <p className="muted">{selectedMatter.title}</p>
                <div className="info-list">
                  <div><strong>Stage:</strong> {selectedMatter.stage}</div>
                  <div><strong>Next hearing:</strong> {selectedMatter.nextHearingAt ?? "To be confirmed"}</div>
                  <div><strong>Court:</strong> {selectedMatter.courtId}</div>
                </div>
              </div>

              <div className="detail-grid">
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

                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Documents</h2>
                  <div className="grid">
                    {selectedMatter.documents.map((document) => (
                      <div key={document.id} className="case-card" style={{ padding: 14 }}>
                        <strong>{document.title}</strong>
                        <p className="muted">{document.type} · {document.mimeType} · OCR {document.ocrStatus}</p>
                        <button className="button-secondary" type="button" onClick={() => void openDocument(document.id, incomingPortalToken, portalAuth)}>
                          Open document
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </section>
      </main>
    );
  }

  if (!auth || !profile) {
    return (
      <main className="page-shell">
        <section className="auth-card">
          <div className="eyebrow">Legal Bhai</div>
          <h1 className="title">Client workspace</h1>
          <p className="muted">
            Invite-only client login for the production line. Clients get a persistent workspace
            with matter timelines, documents, and in-app threads.
          </p>
          {workspaceError ? <p className="muted">{workspaceError}</p> : null}

          <div className="field">
            <label>Phone</label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          {otpRequested ? <div className="field">
            <label>OTP code</label>
            <input inputMode="numeric" value={loginCode ?? ""} onChange={(event) => setLoginCode(event.target.value)} />
          </div> : null}
          <button className="button" type="button" onClick={() => void (otpRequested ? verifyLogin() : startLogin())}>
            {otpRequested ? "Verify OTP and sign in" : "Request OTP"}
          </button>

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
          <p className="muted">{profile.firm?.name ?? "Legal Bhai"} · invite-only account</p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/overview">
            Staff workspace
          </Link>
          <button className="button" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>

      <section className="dashboard-grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)" }}>
        <aside className="grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Shared matters</h2>
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
                    {matter.courtId} · Next {matter.nextHearingAt ?? "TBC"}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {selectedMatter ? (
          <section className="grid">
            <div className="panel">
              <div className="eyebrow">Matter timeline</div>
              <h2 style={{ marginTop: 6 }}>{selectedMatter.rawCaseNumber}</h2>
              <p className="muted">{selectedMatter.title}</p>
              <div className="info-list">
                <div><strong>Stage:</strong> {selectedMatter.stage}</div>
                <div><strong>Next hearing:</strong> {selectedMatter.nextHearingAt ?? "To be confirmed"}</div>
                <div><strong>Court:</strong> {selectedMatter.courtId}</div>
              </div>
            </div>

            <div className="detail-grid">
              <div className="grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Hearings</h2>
                  <div className="grid">
                    {selectedMatter.hearings.map((hearing) => (
                      <article key={hearing.id} className="hearing">
                        <strong>{formatDateTime(hearing.listedAt)}</strong>
                        <div>{hearing.outcome}</div>
                        <p className="muted">{hearing.notes}</p>
                        {hearing.nextDate ? <div className="muted">Next date: {hearing.nextDate}</div> : null}
                      </article>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Documents</h2>
                  <div className="grid">
                    {selectedMatter.documents.map((document) => (
                      <div key={document.id} className="case-card" style={{ padding: 14 }}>
                        <strong>{document.title}</strong>
                        <p className="muted">{document.type} · {document.mimeType} · OCR {document.ocrStatus}</p>
                        <button className="button-secondary" type="button" onClick={() => void openDocument(document.id)}>
                          Open document
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="grid">
                <div className="panel">
                  <h2 style={{ marginTop: 0 }}>Thread with counsel</h2>
                  <div className="grid" style={{ maxHeight: 320, overflow: "auto" }}>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="case-card"
                        style={{
                          padding: 14,
                          borderLeftColor: message.senderType === "client" ? "var(--accent)" : "var(--primary)",
                        }}
                      >
                        <strong>{message.senderType === "client" ? "You" : "Counsel"}</strong>
                        <p className="muted">{message.body}</p>
                        <div className="muted">{formatDateTime(message.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>{profile.clientAccount.language === "ur" ? "پیغام" : "Message"}</label>
                    <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
                  </div>
                  <button className="button" type="button" onClick={() => void sendMessage()}>
                    {profile.clientAccount.language === "ur" ? "پیغام بھیجیں" : "Send message"}
                  </button>
                </div>
              </aside>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
