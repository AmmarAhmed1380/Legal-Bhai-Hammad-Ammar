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
      ) : profile ? (
        <div className="panel">
          <div className="eyebrow">Client Profile</div>
          <p className="muted" style={{ margin: "6px 0 4px" }}>{profile.firm?.name ?? "Legal Bhai"}</p>
          <p style={{ margin: 0, fontWeight: 700 }}>{profile.clientAccount.phone}</p>
        </div>
      ) : null}

      {/* 2. Shared Matters Listing Panel */}
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
                  className="case-card"
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
                    border: isActive ? "1px solid var(--primary)" : undefined,
                    background: isActive ? "rgba(15, 110, 86, 0.04)" : undefined,
                    boxShadow: isActive ? "0 10px 24px rgba(15, 110, 86, 0.10)" : undefined,
                  }}
                >
                  <div className="top-bar" style={{ marginBottom: 10 }}>
                    <strong>{matter.rawCaseNumber}</strong>
                    <span className="badge live">{toTitleCase(matter.stage)}</span>
                  </div>
                  <div>{matter.title}</div>
                  <p className="muted" style={{ marginBottom: 0, marginTop: 6 }}>
                    {formatCourtId(matter.courtId)} · Next {formatDateTime(matter.nextHearingAt)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
