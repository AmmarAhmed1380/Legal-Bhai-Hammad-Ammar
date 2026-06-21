import { type KeyboardEvent, type ClipboardEvent } from "react";

interface PortalOtpPromptProps {
  portalMaskedPhone: string | null;
  portalOtpDigits: string[];
  requestPortalReplyAccess: () => void;
  verifyPortalReplyAccess: (codeOverride?: string) => void;
  handlePortalOtpChange: (index: number, value: string) => void;
  handlePortalOtpKeyDown: (index: number, e: KeyboardEvent<HTMLInputElement>) => void;
  handlePortalOtpPaste: (e: ClipboardEvent<HTMLInputElement>) => void;
  setPortalMaskedPhone: (val: string | null) => void;
  setPortalOtpCode: (val: string) => void;
  setPortalOtpDigits: (val: string[]) => void;
  workspaceError: string | null;
}

export default function PortalOtpPrompt({
  portalMaskedPhone,
  portalOtpDigits,
  requestPortalReplyAccess,
  verifyPortalReplyAccess,
  handlePortalOtpChange,
  handlePortalOtpKeyDown,
  handlePortalOtpPaste,
  setPortalMaskedPhone,
  setPortalOtpCode,
  setPortalOtpDigits,
  workspaceError,
}: PortalOtpPromptProps) {
  return (
    <div className="panel">
      <div className="eyebrow">Portal access</div>
      <h1 className="title">Client portal</h1>
      <p className="muted">
        Enter the client OTP before Legal Bhai shows the one matter protected by this link.
      </p>
      {workspaceError ? <p className="muted">{workspaceError}</p> : null}
      {!portalMaskedPhone ? (
        <button className="button-secondary" type="button" onClick={requestPortalReplyAccess}>
          Request portal OTP
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                setPortalMaskedPhone(null);
                setPortalOtpCode("");
                setPortalOtpDigits(Array(6).fill(""));
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                padding: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              title="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            <label style={{ margin: 0, fontWeight: 600 }}>OTP for {portalMaskedPhone}</label>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
            {portalOtpDigits.map((digit, idx) => (
              <input
                key={idx}
                id={`portal-otp-input-${idx}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePortalOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handlePortalOtpKeyDown(idx, e)}
                onPaste={handlePortalOtpPaste}
                style={{
                  width: "48px",
                  height: "48px",
                  fontSize: "20px",
                  fontWeight: "700",
                  textAlign: "center",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "rgba(255, 255, 255, 0.8)"
                }}
              />
            ))}
          </div>
          
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <button
              type="button"
              onClick={requestPortalReplyAccess}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                fontSize: "13px"
              }}
            >
              Resend OTP
            </button>
          </div>

          <button className="button" style={{ width: "100%", marginTop: 0 }} type="button" onClick={() => verifyPortalReplyAccess()}>
            Verify and open shared matter
          </button>
        </div>
      )}
    </div>
  );
}
