import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  type CalendarItem,
  type AlertRecord,
  type ThreadSummary,
  type OverviewReport,
  type MatterListItem,
  type StaffProfile,
} from "../page";
import { formatDateTime, formatRole, courtLabel } from "./helpers";

interface OverviewSectionProps {
  stats: { matters: number; hearingsThisWeek: number; unreadAlerts: number };
  report: OverviewReport | null;
  calendar: CalendarItem[];
  alerts: AlertRecord[];
  threads: ThreadSummary[];
  matters: MatterListItem[];
  markAlertRead: (alertId: string) => void;
  openMatter: (matterId: string) => void;
  router: AppRouterInstance;
  profile: StaffProfile | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function titleCase(str: string) {
  return str.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function relativeDays(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0) return `${Math.abs(diffDays)} Days ago`;
  return `In ${diffDays} Days`;
}

/** Derives importance from the alert type — no API/DB change needed. */
function alertImportance(type: string): "critical" | "high" | "normal" {
  if (type === "sync_issue") return "critical";
  if (type === "invoice_due") return "high";
  return "normal";
}

function ImportanceBadge({ type }: { type: string }) {
  const level = alertImportance(type);
  if (level === "critical") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#c0392b",
          background: "rgba(192,57,43,0.1)",
          border: "1px solid rgba(192,57,43,0.28)",
          borderRadius: 5,
          padding: "2px 7px",
          flexShrink: 0,
        }}
      >
        Critical
      </span>
    );
  }
  if (level === "high") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent)",
          background: "rgba(216,90,48,0.1)",
          border: "1px solid rgba(216,90,48,0.25)",
          borderRadius: 5,
          padding: "2px 7px",
          flexShrink: 0,
        }}
      >
        High
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        background: "rgba(0,0,0,0.04)",
        border: "1px solid var(--border)",
        borderRadius: 5,
        padding: "2px 7px",
        flexShrink: 0,
      }}
    >
      Normal
    </span>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: accent ? "rgba(15,110,86,0.08)" : "var(--surface)",
        border: accent ? "1px solid rgba(15,110,86,0.25)" : "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 8,
        minWidth: 0,
        minHeight: 76,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2 }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: accent ? "var(--primary-dark)" : "var(--text-primary)", lineHeight: 1, alignSelf: "flex-end", textAlign: "right" }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500 }}>{sub}</span>
      )}
    </div>
  );
}

function SectionHeader({ title, action, onAction }: { title: React.ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="overview-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            padding: "2px 0",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {action}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500 }}>
      {text}
    </div>
  );
}

function MatterLink({
  matter,
  openMatter,
  router,
}: {
  matter: MatterListItem;
  openMatter: (id: string) => void;
  router: AppRouterInstance;
}) {
  return (
    <button
      type="button"
      onClick={() => { router.push("/matters"); openMatter(matter.id); }}
      className="overview-matter-link"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        padding: "5px 6px",
        borderRadius: 6,
        color: "var(--primary)",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        textDecoration: "underline",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(15,110,86,0.06)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "none")}
    >
      {matter.rawCaseNumber} — {matter.title}
    </button>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function OverviewSection({
  report,
  calendar,
  alerts,
  threads,
  matters,
  markAlertRead,
  openMatter,
  router,
  profile,
}: OverviewSectionProps) {
  const openMatters = matters.filter((m) => m.status === "open");
  const unreadAlerts = alerts.filter((a) => !a.readAt);

  // Next 5 upcoming hearings sorted chronologically
  const upcomingHearings = [...calendar]
    .filter((c) => new Date(c.listedAt) >= new Date(Date.now() - 1000 * 60 * 60 * 24))
    .sort((a, b) => new Date(a.listedAt).getTime() - new Date(b.listedAt).getTime())
    .slice(0, 5);

  // Sort: unread critical first, then unread high, then unread normal, then read — cap at 8
  const sortedAlerts = [
    ...alerts.filter((a) => !a.readAt && alertImportance(a.type) === "critical"),
    ...alerts.filter((a) => !a.readAt && alertImportance(a.type) === "high"),
    ...alerts.filter((a) => !a.readAt && alertImportance(a.type) === "normal"),
    ...alerts.filter((a) => !!a.readAt),
  ].slice(0, 8);

  // Threads with a last message, most recent first
  const recentThreads = [...threads]
    .filter((t) => t.lastMessage)
    .sort((a, b) =>
      new Date(b.lastMessage!.createdAt).getTime() - new Date(a.lastMessage!.createdAt).getTime()
    )
    .slice(0, 5);

  const metrics = report?.metrics;

  return (
    <div className="overview-layout" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>

      {/* ── Top Metric Bar ── */}
      <div
        className="overview-metrics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <MetricCard label="Open Matters" value={metrics?.openMatters ?? openMatters.length} />
        <MetricCard label="Upcoming Hearings" value={metrics?.upcomingHearings ?? calendar.length} />
        <MetricCard label="Unread Alerts" value={metrics?.unreadAlerts ?? unreadAlerts.length} />
      </div>

      {/* ── Two-Column Body ── */}
      <div className="overview-body-grid" style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: 16, alignItems: "stretch", minWidth: 0 }}>

        {/* ── Left Column ── */}
        <div className="overview-side-column" style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%", minWidth: 0 }}>

          {/* Profile Card */}
          {profile && (
            <div className="panel overview-profile-panel" style={{ padding: 18, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(15,110,86,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "var(--primary-dark)",
                    flexShrink: 0,
                  }}
                >
                  {profile.staffUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {profile.staffUser.displayName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                    {formatRole(profile.staffMembership.role)}
                    {profile.staffMembership.officeLabel ? ` · ${profile.staffMembership.officeLabel}` : ""}
                  </div>
                </div>
              </div>

              {profile.firm && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Firm</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{profile.firm.name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>City</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{profile.firm.primaryCity}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upcoming Hearings */}
          <div className="overview-mobile-metrics-grid" style={{ display: "none" }}>
            <MetricCard label="Open Matters" value={metrics?.openMatters ?? openMatters.length} />
            <MetricCard label="Upcoming Hearings" value={metrics?.upcomingHearings ?? calendar.length} />
            <MetricCard label="Unread Alerts" value={metrics?.unreadAlerts ?? unreadAlerts.length} />
          </div>

          <div className="panel overview-upcoming-panel" style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
            <SectionHeader
              title="Upcoming Hearings"
              action="Calendar"
              onAction={() => router.push("/calendar")}
            />
            {upcomingHearings.length === 0 ? (
              <EmptyState text="No upcoming hearings" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {upcomingHearings.map((item) => {
                  const daysLabel = relativeDays(item.listedAt);
                  const isToday = daysLabel === "Today";
                  const isTomorrow = daysLabel === "Tomorrow";
                  const isUrgent = isToday || isTomorrow;
                  return (
                    <div
                      key={item.id}
                      className="case-card"
                      style={{
                        padding: "10px 12px",
                        borderLeftColor: isUrgent ? "var(--accent)" : "var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: isUrgent ? "var(--accent)" : "var(--text-tertiary)",
                          }}
                        >
                          {daysLabel}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, flexShrink: 0 }}>
                          {new Date(item.listedAt).toLocaleTimeString("en-US", {
                            timeZone: "Asia/Karachi",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      </div>
                      <MatterLink matter={item.matter} openMatter={openMatter} router={router} />
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {courtLabel(item.matter.courtId)}
                        {item.courtroom ? ` · Room ${item.courtroom}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Right Column ── */}
        <div className="overview-main-column" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

          {/* Priority Alerts */}
          <div className="panel overview-alerts-panel" style={{ padding: 18 }}>
            <SectionHeader
              title={
                unreadAlerts.length > 0 ? (
                  <>
                    Alerts{" "}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        marginLeft: 8,
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#b42318",
                        background: "#fef3f2",
                        border: "1px solid #fecdca",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {unreadAlerts.length} Unread
                    </span>
                  </>
                ) : (
                  "Alerts"
                )
              }
              action="All Alerts"
              onAction={() => router.push("/alerts")}
            />
            {sortedAlerts.length === 0 ? (
              <EmptyState text="No alerts" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedAlerts.map((alert) => {
                  const isUnread = !alert.readAt;
                  // Try to find matching matter
                  const body = alert.body.toLowerCase();
                  const title = alert.title.toLowerCase();
                  const linked = matters.find((m) => {
                    const cn = m.rawCaseNumber.toLowerCase().trim();
                    if (cn && (body.includes(cn) || title.includes(cn))) return true;
                    const parties = m.title.split(/\s+v\.?\s+/i);
                    for (const p of parties) {
                      const cp = p.trim().toLowerCase();
                      if (cp.length > 3 && (body.includes(cp) || title.includes(cp))) return true;
                    }
                    return false;
                  });

                  return (
                    <div
                      key={alert.id}
                      className="case-card"
                      style={{
                        padding: "12px 14px",
                        borderLeftColor: isUnread ? "var(--accent)" : "var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                        opacity: isUnread ? 1 : 0.72,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <ImportanceBadge type={alert.type} />
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>
                              {formatDateTime(alert.createdAt)}
                            </span>
                          </div>
                          <strong style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                            {titleCase(alert.title)}
                          </strong>
                        </div>
                        {isUnread && (
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => markAlertRead(alert.id)}
                            style={{ padding: "4px 10px", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                        {alert.body}
                      </p>
                      {linked && (
                        <MatterLink matter={linked} openMatter={openMatter} router={router} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Client Messages */}
          <div className="panel overview-recent-panel" style={{ padding: 18 }}>
            <SectionHeader title="Recent Client Messages" action="Matters" onAction={() => router.push("/matters")} />
            {recentThreads.length === 0 ? (
              <EmptyState text="No recent messages" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className="case-card"
                    style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <MatterLink matter={thread.matter} openMatter={openMatter} router={router} />
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, flexShrink: 0, whiteSpace: "nowrap" }}>
                        {formatDateTime(thread.lastMessage!.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      } as React.CSSProperties}
                    >
                      {thread.lastMessage!.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
