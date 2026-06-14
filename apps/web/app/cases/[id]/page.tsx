"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_BASE_URL, jsonRequest } from "../../../lib/api";

interface CaseDetailPayload {
  case: {
    id: string;
    rawCaseNumber: string;
    court: string;
    title: string;
    stage: string;
    nextDate: string | null;
    assignedToUserId: string | null;
    clientName: string;
    clientPhone: string;
    sourceType: "live_ihc" | "demo_district";
    judgeName: string | null;
    benchName: string | null;
    hearings: Array<{
      id: string;
      hearingDate: string;
      outcome: string;
      notes: string;
      nextDateGiven: string | null;
      imageUrl: string | null;
      ocrText: string | null;
      ocrStatus: string;
    }>;
  };
  users: Array<{ id: string; name: string; role: string }>;
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [payload, setPayload] = useState<CaseDetailPayload | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [smsPreview, setSmsPreview] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("wakeel-token");
    if (!storedToken) {
      router.replace("/");
      return;
    }
    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!params?.id || !token) {
      return;
    }

    void jsonRequest<CaseDetailPayload>(`/cases/${params.id}`, {}, token).then(setPayload);
  }, [params?.id, token]);

  async function assignCase(userId: string) {
    if (!token || !params?.id) return;
    await jsonRequest(`/cases/${params.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }, token);
    const refreshed = await jsonRequest<CaseDetailPayload>(`/cases/${params.id}`, {}, token);
    setPayload(refreshed);
  }

  async function createShareLink() {
    if (!token || !params?.id) return;
    const response = await jsonRequest<{ shareUrl: string }>(`/cases/${params.id}/share-link`, {
      method: "POST",
    }, token);
    setShareUrl(response.shareUrl);
  }

  async function previewSms(type: "reminder" | "post_hearing") {
    if (!token || !params?.id) return;
    const response = await jsonRequest<{ preview: { renderedText: string } }>(`/notifications/preview`, {
      method: "POST",
      body: JSON.stringify({ caseId: params.id, type }),
    }, token);
    setSmsPreview(response.preview.renderedText);
  }

  if (!payload) {
    return (
      <main className="page-shell">
        <div className="panel">Loading case detail...</div>
      </main>
    );
  }

  const caseRecord = payload.case;

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <Link href="/dashboard" className="eyebrow">
            Back to dashboard
          </Link>
          <h1 className="title" style={{ marginBottom: 4 }}>
            {caseRecord.rawCaseNumber}
          </h1>
          <p className="muted">{caseRecord.title}</p>
        </div>
        <span className={`badge ${caseRecord.sourceType === "live_ihc" ? "live" : "demo"}`}>
          {caseRecord.sourceType === "live_ihc" ? "IHC Live" : "District Demo"}
        </span>
      </div>

      <section className="detail-grid">
        <div className="grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Case information</h2>
            <div className="info-list">
              <div><strong>Court:</strong> {caseRecord.court}</div>
              <div><strong>Stage:</strong> {caseRecord.stage}</div>
              <div><strong>Next date:</strong> {caseRecord.nextDate ?? "To be confirmed"}</div>
              <div><strong>Judge:</strong> {caseRecord.judgeName ?? "Not set"}</div>
              <div><strong>Bench:</strong> {caseRecord.benchName ?? "Not set"}</div>
              <div><strong>Client:</strong> {caseRecord.clientName} · {caseRecord.clientPhone}</div>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Hearing timeline</h2>
            {caseRecord.hearings.length === 0 ? (
              <p className="muted">No hearing logs yet. Add them from the mobile app to exercise upload and OCR.</p>
            ) : (
              <div className="grid">
                {caseRecord.hearings.map((hearing) => (
                  <article key={hearing.id} className="hearing">
                    <strong>{hearing.hearingDate}</strong>
                    <div>{hearing.outcome}</div>
                    <p className="muted">{hearing.notes}</p>
                    <div className="muted">
                      OCR status: {hearing.ocrStatus}
                      {hearing.nextDateGiven ? ` · Next date ${hearing.nextDateGiven}` : ""}
                    </div>
                    {hearing.ocrText ? <pre className="panel" style={{ whiteSpace: "pre-wrap" }}>{hearing.ocrText}</pre> : null}
                    {hearing.imageUrl ? (
                      <ProtectedImage
                        token={token}
                        src={hearing.imageUrl.startsWith("http") ? hearing.imageUrl : `${API_BASE_URL}${hearing.imageUrl}`}
                        alt="Uploaded order"
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Assign case</h2>
            <div className="field">
              <label>Assigned lawyer</label>
              <select
                value={caseRecord.assignedToUserId ?? ""}
                onChange={(event) => void assignCase(event.target.value)}
              >
                <option value="">Unassigned</option>
                {payload.users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Client share & SMS preview</h2>
            <div className="actions">
              <button className="button" type="button" onClick={createShareLink}>
                Create share link
              </button>
              <button className="button-secondary" type="button" onClick={() => void previewSms("reminder")}>
                Preview reminder
              </button>
              <button className="button-secondary" type="button" onClick={() => void previewSms("post_hearing")}>
                Preview post-hearing
              </button>
            </div>
            {shareUrl ? (
              <p style={{ marginTop: 12 }}>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  {shareUrl}
                </a>
              </p>
            ) : null}
            {smsPreview ? <pre className="panel" style={{ whiteSpace: "pre-wrap" }}>{smsPreview}</pre> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}

function ProtectedImage({
  src,
  alt,
  token,
}: {
  src: string;
  alt: string;
  token: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let currentUrl: string | null = null;
    void fetch(src, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load protected image");
        }

        const blob = await response.blob();
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch(() => {
        setObjectUrl(null);
      });

    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [src, token]);

  if (!objectUrl) {
    return <div className="muted">Protected upload available</div>;
  }

  return <img className="preview" src={objectUrl} alt={alt} />;
}
