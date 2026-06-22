import { type ReactNode } from "react";
import { type ClientProfile, type ClientMatter, type ClientMatterDetail } from "../page";
import { formatCourtId, formatDateTime, toTitleCase } from "./helpers";

interface ClientSidebarProps {
  profile: ClientProfile | null;
  matters: ClientMatter[];
  selectedMatter: ClientMatterDetail | null;
  openMatter: (matterId: string) => void;
  openPortalMatter: (matterId: string, portalToken: string, activePortalAuth: any) => void;
  incomingPortalToken: string | null;
  portalAuth: any;
  signOut: () => void;
  otpPromptNode?: ReactNode; // Pass OTP prompt as optional child node to keep responsibilities separate
}

export default function ClientSidebar({
  profile,
  matters,
  selectedMatter,
  openMatter,
  openPortalMatter,
  incomingPortalToken,
  portalAuth,
  signOut,
  otpPromptNode,
}: ClientSidebarProps) {
  return (
    <aside className="grid">
      {/* 1. Portal OTP Mode or Client Profile Mode Panel */}
      {incomingPortalToken ? (
        !portalAuth && otpPromptNode ? (
          otpPromptNode
        ) : (
          <div className="panel">
            <div className="eyebrow">Portal access</div>
            <h1 className="title" style={{ marginBottom: 4 }}>Client portal</h1>
            <p className="muted" style={{ marginBottom: 12 }}>
              Secure viewing access via shared link.
            </p>
            <button className="button-secondary" type="button" onClick={signOut}>
              Exit Portal
            </button>
          </div>
        )
      ) : null}

      {/* Shared Matters Listing Panel */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
        <div className="case-list">
          {matters.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>No matters are currently shared with you.</p>
          ) : (
            matters.map((matter) => {
              const isActive = selectedMatter?.id === matter.id;
              return (
                <button
                  key={matter.id}
                  type="button"
                  onClick={() => {
                    if (incomingPortalToken) {
                      openPortalMatter(matter.id, incomingPortalToken, portalAuth);
                    } else {
                      openMatter(matter.id);
                    }
                  }}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderLeft: isActive ? "4px solid var(--primary)" : "4px solid rgba(0, 0, 0, 0.08)",
                    backgroundColor: isActive ? "rgba(15, 110, 86, 0.04)" : "var(--surface)",
                    width: "100%",
                    padding: "16px",
                    borderRadius: "14px",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isActive ? "translateX(2px)" : "none",
                    boxShadow: isActive ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = isActive ? "translateX(4px)" : "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = isActive ? "translateX(2px)" : "none";
                    e.currentTarget.style.boxShadow = isActive ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{matter.rawCaseNumber}</strong>
                    <span className="badge live" style={{ fontSize: "9px", padding: "2px 6px" }}>
                      {matter.stage.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: isActive ? 700 : 600, color: isActive ? "var(--primary-dark)" : "var(--text-secondary)", marginBottom: 8, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {matter.title}
                  </div>
                  <div className="muted" style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {formatCourtId(matter.courtId)}
                      </span>
                    </div>
                    {matter.nextHearingAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Next: {formatDateTime(matter.nextHearingAt)}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
