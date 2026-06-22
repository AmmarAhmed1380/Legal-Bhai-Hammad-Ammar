import { type ClientMatterDetail } from "../page";
import { formatCourtId, formatDateTime, toTitleCase } from "./helpers";

export default function MatterTimelineHeader({ matter }: { matter: ClientMatterDetail }) {
  return (
    <div
      className="panel"
      style={{
        padding: "24px",
        borderLeft: "6px solid var(--primary)",
        background: "linear-gradient(135deg, #ffffff 0%, #fafaf9 100%)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "10px" }}>
              {matter.rawCaseNumber}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 500, lineHeight: "1.5", color: "var(--text-secondary)" }}>
              {matter.title}
            </span>
          </div>
        </div>
        {matter.nextHearingAt && (
          <div style={{
            backgroundColor: "var(--accent-light)",
            color: "var(--accent)",
            border: "1px solid rgba(216, 90, 48, 0.15)",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Next Hearing: {formatDateTime(matter.nextHearingAt)}
          </div>
        )}
      </div>

      <div style={{
        height: "1px",
        backgroundColor: "var(--border)",
        margin: "4px 0"
      }} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", fontSize: "13px", color: "var(--text-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span><strong>Court:</strong> {formatCourtId(matter.courtId)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span><strong>Stage:</strong> {toTitleCase(matter.stage)}</span>
        </div>
      </div>
    </div>
  );
}
