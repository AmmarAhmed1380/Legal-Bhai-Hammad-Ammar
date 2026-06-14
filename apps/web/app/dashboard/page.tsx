"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { jsonRequest } from "../../lib/api";

interface DashboardPayload {
  summary: {
    totalCases: number;
    todayHearings: number;
    conflicts: number;
    assignedLawyers: number;
  };
  users: Array<{ id: string; name: string; role: string }>;
}

interface CasesPayload {
  cases: Array<{
    id: string;
    rawCaseNumber: string;
    court: string;
    title: string;
    stage: string;
    nextDate: string | null;
    sourceType: "live_ihc" | "demo_district";
  }>;
}

const INITIAL_FORM = {
  rawCaseNumber: "",
  title: "",
  court: "Islamabad District Court East",
  clientName: "",
  clientPhone: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [cases, setCases] = useState<CasesPayload["cases"]>([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isAdmin = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const user = window.localStorage.getItem("wakeel-user");
    return user ? JSON.parse(user).role === "admin" : false;
  }, []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("wakeel-token");
    if (!storedToken) {
      router.replace("/");
      return;
    }

    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void loadDashboardData(token);
  }, [token]);

  async function loadDashboardData(activeToken: string) {
    const [dashboardPayload, casesPayload] = await Promise.all([
      jsonRequest<DashboardPayload>("/dashboard/summary", {}, activeToken),
      jsonRequest<CasesPayload>("/cases", {}, activeToken),
    ]);
    setDashboard(dashboardPayload);
    setCases(casesPayload.cases);
  }

  async function handleCreateCase(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    await jsonRequest("/cases", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        normalizedCaseNumber: form.rawCaseNumber.toUpperCase(),
        stage: "filing",
        sourceType: "demo_district",
      }),
    }, token);

    setForm(INITIAL_FORM);
    await loadDashboardData(token);
  }

  async function handleSync() {
    if (!token) return;
    const payload = await jsonRequest<{ fetched: number; matched: number }>("/sync/ihc", {
      method: "POST",
    }, token);
    setSyncMessage(`IHC sync checked ${payload.fetched} rows and matched ${payload.matched} seeded cases.`);
    await loadDashboardData(token);
  }

  async function handleResetDemo() {
    if (!token) return;

    const payload = await jsonRequest<{ resetAt: string }>("/admin/reset-demo", {
      method: "POST",
    }, token);
    setResetMessage(`Demo reset completed at ${new Date(payload.resetAt).toLocaleTimeString()}.`);
    setSyncMessage(null);
    setShowResetConfirm(false);
    await loadDashboardData(token);
  }

  function signOut() {
    window.localStorage.removeItem("wakeel-token");
    window.localStorage.removeItem("wakeel-user");
    router.replace("/");
  }

  return (
    <main className="page-shell">
      <div className="top-bar">
        <div>
          <div className="eyebrow">Firm Dashboard</div>
          <h1 className="title" style={{ marginBottom: 4 }}>
            Wakeel chambers overview
          </h1>
          <p className="muted">Admin sync, case assignment, and live/district source labeling.</p>
        </div>
        <div className="actions">
          {isAdmin ? (
            <button className="button-secondary" type="button" onClick={handleSync}>
              Sync IHC
            </button>
          ) : null}
          {isAdmin ? (
            <button className="button-danger" type="button" onClick={() => setShowResetConfirm(true)}>
              Reset demo
            </button>
          ) : null}
          <button className="button" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <section className="dashboard-grid">
        <aside className="grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Today at a glance</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">{dashboard?.summary.totalCases ?? 0}</div>
                <div>Total cases</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{dashboard?.summary.todayHearings ?? 0}</div>
                <div>Hearings today</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{dashboard?.summary.conflicts ?? 0}</div>
                <div>Conflicts</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{dashboard?.summary.assignedLawyers ?? 0}</div>
                <div>Assigned lawyers</div>
              </div>
            </div>
            {syncMessage ? (
              <p className="muted" style={{ marginTop: 14 }}>
                {syncMessage}
              </p>
            ) : null}
            {resetMessage ? (
              <p className="muted" style={{ marginTop: 14 }}>
                {resetMessage}
              </p>
            ) : null}
          </div>

          <form className="panel" onSubmit={handleCreateCase}>
            <h2 style={{ marginTop: 0 }}>Quick add district case</h2>
            <div className="field">
              <label>Case number</label>
              <input
                value={form.rawCaseNumber}
                onChange={(event) => setForm((current) => ({ ...current, rawCaseNumber: event.target.value }))}
                placeholder="Civil Suit 201/2026"
              />
            </div>
            <div className="field">
              <label>Case title</label>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Client v Respondent"
              />
            </div>
            <div className="field">
              <label>Court</label>
              <select
                value={form.court}
                onChange={(event) => setForm((current) => ({ ...current, court: event.target.value }))}
              >
                <option>Islamabad District Court East</option>
                <option>Islamabad District Court West</option>
                <option>Rawalpindi District & Sessions</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field" style={{ flex: 1 }}>
                <label>Client name</label>
                <input
                  value={form.clientName}
                  onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))}
                  placeholder="Client name"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Client phone</label>
                <input
                  value={form.clientPhone}
                  onChange={(event) => setForm((current) => ({ ...current, clientPhone: event.target.value }))}
                  placeholder="0300..."
                />
              </div>
            </div>
            <button className="button" type="submit">
              Create demo case
            </button>
          </form>
        </aside>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Case roster</h2>
          <div className="case-list">
            {cases.map((caseRecord) => (
              <Link key={caseRecord.id} href={`/cases/${caseRecord.id}`} className="case-card">
                <div className="top-bar" style={{ marginBottom: 10 }}>
                  <strong>{caseRecord.rawCaseNumber}</strong>
                  <span className={`badge ${caseRecord.sourceType === "live_ihc" ? "live" : "demo"}`}>
                    {caseRecord.sourceType === "live_ihc" ? "IHC Live" : "District Demo"}
                  </span>
                </div>
                <div>{caseRecord.title}</div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {caseRecord.court} · {caseRecord.stage} · Next date {caseRecord.nextDate ?? "TBC"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </section>

      {showResetConfirm ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="reset-demo-title">
            <h2 id="reset-demo-title" style={{ marginTop: 0 }}>
              Reset demo state?
            </h2>
            <p className="muted">
              This will reseed the demo database and remove uploaded hearing files so the walkthrough starts clean.
            </p>
            <div className="actions">
              <button className="button-secondary" type="button" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
              <button className="button-danger" type="button" onClick={() => void handleResetDemo()}>
                Confirm reset
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
