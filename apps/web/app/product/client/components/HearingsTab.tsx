import { type ClientMatterDetail } from "../page";
import { formatDateTime } from "./helpers";

interface HearingsTabProps {
  selectedMatter: ClientMatterDetail;
}

export default function HearingsTab({ selectedMatter }: HearingsTabProps) {
  return (
    <div className="panel" style={{ padding: "24px" }}>
      <h3 style={{ fontSize: "18px", fontWeight: 700, marginTop: 0, marginBottom: "20px", color: "var(--text-primary)" }}>Hearing Timeline</h3>
      {selectedMatter.hearings.length === 0 ? (
        <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: 12 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div>No hearings recorded yet.</div>
        </div>
      ) : (
        <div style={{ position: "relative", paddingLeft: "24px" }}>
          {/* Timeline vertical bar */}
          <div style={{
            position: "absolute",
            left: "8px",
            top: "10px",
            bottom: "10px",
            width: "2px",
            backgroundColor: "rgba(15, 110, 86, 0.15)",
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {selectedMatter.hearings.map((hearing) => (
              <div key={hearing.id} style={{ position: "relative" }}>
                {/* Timeline Bullet node */}
                <div style={{
                  position: "absolute",
                  left: "-21px",
                  top: "4px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary)",
                  border: "3px solid #ffffff",
                  boxShadow: "0 0 0 2px rgba(15, 110, 86, 0.2)",
                  zIndex: 2,
                }} />

                {/* Hearing Card Content */}
                <div className="hearing-card-content" style={{
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                  transition: "all 0.2s ease"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--primary)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDateTime(hearing.listedAt)}
                    </div>
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                    {hearing.outcome}
                  </div>
                  {hearing.notes && (
                    <p className="muted" style={{ fontSize: "13px", margin: "0 0 10px 0", lineHeight: "1.4" }}>
                      {hearing.notes}
                    </p>
                  )}
                  {hearing.nextDate && (
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--accent)",
                      background: "var(--accent-light)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      border: "1px solid rgba(216, 90, 48, 0.1)"
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Next Date: {formatDateTime(hearing.nextDate)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
