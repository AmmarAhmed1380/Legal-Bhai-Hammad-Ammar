import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  type CalendarItem,
  type CourtSource,
  type AlertRecord,
  type ThreadSummary,
  type OverviewReport,
} from "../page";
import { courtLabel, formatDateTime } from "./helpers";

interface OverviewSectionProps {
  stats: { matters: number; hearingsThisWeek: number; unreadAlerts: number };
  report: OverviewReport | null;
  calendar: CalendarItem[];
  syncMessage: string | null;
  courtSources: CourtSource[];
  alerts: AlertRecord[];
  threads: ThreadSummary[];
  markAlertRead: (alertId: string) => void;
  openMatter: (matterId: string) => void;
  router: AppRouterInstance;
}

export default function OverviewSection({
  stats,
  report,
  calendar,
  syncMessage,
  courtSources,
  alerts,
  threads,
  markAlertRead,
  openMatter,
  router,
}: OverviewSectionProps) {
  return (
    <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
      <aside className="grid">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Workspace</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.matters}</div>
              <div>Matters</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{report?.metrics.upcomingHearings ?? calendar.length}</div>
              <div>Upcoming Hearings</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.unreadAlerts}</div>
              <div>Unread Alerts</div>
            </div>
          </div>
          {syncMessage ? <p className="muted" style={{ marginTop: 12 }}>{syncMessage}</p> : null}
        </div>

        <aside className="panel" style={{ width: "100%", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h2 style={{ marginTop: 0 }}>Court Health</h2>
          <div className="grid">
            {courtSources.map((source) => {
              const isLive = source.status === "live";
              const isFailed = source.status === "failed";
              const bg = isLive 
                ? "rgba(15, 110, 86, 0.15)" 
                : isFailed 
                  ? "rgba(216, 90, 48, 0.15)" 
                  : "rgba(235, 160, 40, 0.15)";
              const border = isLive 
                ? "1px solid rgba(15, 110, 86, 0.4)" 
                : isFailed 
                  ? "1px solid rgba(216, 90, 48, 0.4)" 
                  : "1px solid rgba(235, 160, 40, 0.4)";
              
              return (
                <div key={source.id} className="case-card" style={{ padding: "12px", border, borderRadius: "8px", backgroundColor: bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{courtLabel(source.courtId)}</strong>
                    <span style={{ 
                      fontSize: "11px", 
                      fontWeight: 700, 
                      padding: "2px 8px", 
                      borderRadius: "4px", 
                      backgroundColor: isLive ? "rgba(15, 110, 86, 0.2)" : isFailed ? "rgba(216, 90, 48, 0.2)" : "rgba(235, 160, 40, 0.2)",
                      color: isLive ? "rgb(10, 80, 62)" : isFailed ? "rgb(160, 50, 20)" : "rgb(180, 110, 10)"
                    }}>
                      {isLive ? "Working well" : isFailed ? "Sync failed" : "Needs attention"}
                    </span>
                  </div>
                  <p className="muted" style={{ width: '100%', marginBottom: 0, fontSize: "12px" }}>
                    Sync time: {source.lastSuccessfulSyncAt ? formatDateTime(source.lastSuccessfulSyncAt) : "Never"}
                  </p>
                </div>
              );
            })}
          </div>
        </aside>
      </aside>

      <section className="grid">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Priority Alerts</h2>
          <div className="grid">
            {alerts.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>Nothing present</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
                  <div className="top-bar" style={{ marginBottom: 8 }}>
                    <strong>{alert.title.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</strong>
                    {!alert.readAt ? <button className="button-secondary" type="button" onClick={() => markAlertRead(alert.id)}>Mark Read</button> : null}
                  </div>
                  <p className="muted">{alert.body}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="detail-grid">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Matters</h2>
            <div className="grid">
              {!report?.mattersByStage || report.mattersByStage.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>Nothing present</div>
              ) : (
                report.mattersByStage.map((entry) => (
                  <div key={entry.stage} className="case-card" style={{ padding: 14 }}>
                    <strong>{entry.stage.charAt(0).toUpperCase() + entry.stage.slice(1)}</strong>
                    <div className="muted">{entry.count} {entry.count === 1 ? "Active Matter" : "Active Matters"}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <aside className="grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Client Threads</h2>
              <div className="grid">
                {threads.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "14px", fontWeight: 500 }}>Nothing present</div>
                ) : (
                  threads.map((thread) => (
                    <button
                      key={thread.id}
                      className="case-card"
                      onClick={() => {
                        router.push("/matters");
                        void openMatter(thread.matter.id);
                      }}
                      style={{ padding: 14, textAlign: "left", cursor: "pointer" }}
                    >
                      <strong>{thread.matter.rawCaseNumber}</strong>
                      <p className="muted">{thread.lastMessage?.body ?? "No messages yet"}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </section>
  );
}
