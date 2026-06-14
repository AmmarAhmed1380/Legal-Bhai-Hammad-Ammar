/* global React */
const { useState } = React;

function ShareModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(44,44,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#fff", borderRadius: 18, padding: 28, width: 520, boxShadow: "var(--shadow-modal)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)" }}>CLIENT SHARE</div>
          <i data-lucide="x" style={{ width: 18, height: 18, cursor: "pointer", color: "var(--fg3)" }} onClick={onClose}></i>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "var(--fg1)", marginTop: 8, letterSpacing: "-0.01em" }}>Share W.P. 2076/2019 with Ahmed Zubair</div>
        <div style={{ fontSize: 13, color: "var(--fg2)", marginTop: 6, lineHeight: "19px" }}>
          A read-only tokenized link. Shows next date, recent hearing note, and the uploaded order image. Client does not need an account.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <div style={{ flex: 1, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            https://wakeel.demo/c/tk_9a2c-4f18-b7e0-5d11
          </div>
          <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: "var(--primary)", color: "#fff", border: 0, borderRadius: 10, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>Expires</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)", marginTop: 2 }}>21 days · 12 May 2026</div>
          </div>
          <div style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>Access</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)", marginTop: 2 }}>Read-only</div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ShareModal = ShareModal;
