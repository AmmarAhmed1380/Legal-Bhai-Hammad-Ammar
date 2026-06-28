import { useState } from "react";
import { type AlertRecord, type MatterListItem } from "../page";
import { formatDateTime } from "./helpers";

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

interface AlertsSectionProps {
  alerts: AlertRecord[];
  markAlertRead: (alertId: string) => void;
  matters: MatterListItem[];
  openMatter: (matterId: string) => void;
  router: any;
}

export default function AlertsSection({ alerts, markAlertRead, matters, openMatter, router }: AlertsSectionProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "critical" | "high">("all");

  const unreadCount = alerts.filter((a) => !a.readAt).length;
  const criticalCount = alerts.filter((a) => alertImportance(a.type) === "critical").length;
  const highCount = alerts.filter((a) => alertImportance(a.type) === "high").length;

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "unread") return !alert.readAt;
    if (filter === "critical") return alertImportance(alert.type) === "critical";
    if (filter === "high") return alertImportance(alert.type) === "high";
    return true;
  });

  // Within each view, sort: unread critical → unread high → unread normal → read
  const sortedAlerts = [
    ...filteredAlerts.filter((a) => !a.readAt && alertImportance(a.type) === "critical"),
    ...filteredAlerts.filter((a) => !a.readAt && alertImportance(a.type) === "high"),
    ...filteredAlerts.filter((a) => !a.readAt && alertImportance(a.type) === "normal"),
    ...filteredAlerts.filter((a) => !!a.readAt),
  ];

  return (
    <section className="grid alerts-layout" style={{ gridTemplateColumns: "1fr" }}>
      <div className="panel alerts-panel" style={{ width: "100%" }}>
        <div className="alerts-header" style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          <div className="alerts-title-row" style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, whiteSpace: "nowrap" }}>Alerts Inbox</h2>
            {unreadCount > 0 && (
              <button
                className="button-secondary alerts-mark-read"
                type="button"
                onClick={() => alerts.filter((a) => !a.readAt).forEach((a) => markAlertRead(a.id))}
                style={{ padding: "8px 16px", fontSize: "13px", borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto" }}
              >
                Mark All as Read
              </button>
            )}
          </div>

          <div className="alerts-actions-row" style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", width: "100%" }}>
            {/* Filters */}
            <div className="alerts-filter-group" style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.03)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)", flexWrap: "nowrap", overflowX: "auto", width: "100%" }}>
              {([
                { id: "all" as const, label: "All", count: null, color: null },
                { id: "unread" as const, label: "Unread", count: unreadCount, color: null },
                { id: "critical" as const, label: "Critical", count: criticalCount },
                { id: "high" as const, label: "High", count: highCount },
              ]).map(({ id, label, count, color }) => {
                const isActive = filter === id;
                const activeColor = color ?? "var(--primary-dark)";
                return (
                  <button
                    key={id}
                    type="button"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      borderRadius: "7px",
                      cursor: "pointer",
                      backgroundColor: isActive
                        ? color ? `${color}18` : "var(--background)"
                        : "transparent",
                      color: isActive ? activeColor : "var(--text-secondary)",
                      border: isActive && color ? `1px solid ${color}44` : "none",
                      boxShadow: isActive && !color ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                    {count !== null && count > 0 && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        background: isActive ? (color ? `${color}22` : "rgba(0,0,0,0.07)") : "rgba(0,0,0,0.07)",
                        color: isActive ? activeColor : "var(--text-tertiary)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        lineHeight: 1.6,
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {sortedAlerts.length === 0 ? (
            <div className="muted" style={{ padding: "40px 0", textAlign: "center", fontSize: "14px", fontWeight: 500 }}>
              {filter === "unread" ? "No unread alerts." : filter === "critical" ? "No critical alerts." : filter === "high" ? "No high alerts." : "No alerts found."}
            </div>
          ) : (
            sortedAlerts.map((alert) => {
              const bodyText = alert.body.toLowerCase();
              const titleText = alert.title.toLowerCase();
              const matchingMatter = matters.find((matter) => {
                const caseNum = matter.rawCaseNumber.toLowerCase().trim();
                if (caseNum && (bodyText.includes(caseNum) || titleText.includes(caseNum))) {
                  return true;
                }
                const parties = matter.title.split(/\s+v\.?\s+/i);
                for (const party of parties) {
                  const cleanParty = party.trim().toLowerCase();
                  if (cleanParty.length > 3 && (bodyText.includes(cleanParty) || titleText.includes(cleanParty))) {
                    return true;
                  }
                }
                return false;
              });

              return (
                <div
                  key={alert.id}
                  className="case-card"
                  style={{
                    padding: 14,
                    borderLeftColor: !alert.readAt ? "var(--accent)" : "var(--border)",
                    transition: "all 0.2s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div className="alerts-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", width: "100%" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <ImportanceBadge type={alert.type} />
                        <span className="muted" style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                          {formatDateTime(alert.createdAt)}
                        </span>
                      </div>
                      <strong style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", lineHeight: "1.3" }}>
                        {alert.title.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </strong>
                    </div>
                    {!alert.readAt && (
                      <button
                        className="button-secondary alerts-card-mark-read"
                        type="button"
                        onClick={() => markAlertRead(alert.id)}
                        style={{ padding: "6px 12px", fontSize: "12px", flexShrink: 0, whiteSpace: "nowrap" }}
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.5", color: "var(--text-secondary)" }}>
                    {alert.body}
                  </p>
                  {matchingMatter && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push("/matters");
                        openMatter(matchingMatter.id);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: "6px 8px",
                        borderRadius: "6px",
                        color: "var(--primary)",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        textDecoration: "underline",
                        transition: "background-color 0.2s",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(15, 110, 86, 0.05)")}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {matchingMatter.rawCaseNumber} - {matchingMatter.title}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
