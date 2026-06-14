/* global React */
// Shared product atoms — used across all product/ screens.
// Import after colors_and_type.css. Exposes to window:
//   PPill, PBtn, PGhost, PChip, PField, PAvatar, PSideItem, PEyebrow,
//   PCaseNum, PLangToggle, PCourtBadge, PStatusBar, PAndroidStatusBar,
//   PTabBar, PMTabBar, pTones

const pTones = {
  live:    { bg: "#E1F5EE", fg: "#08503F" },
  demo:    { bg: "#F4EEE0", fg: "#7A5B18" },
  conflict:{ bg: "#FAECE7", fg: "#D85A30" },
  info:    { bg: "#E6F1FB", fg: "#185FA5" },
  warn:    { bg: "#FAEEDA", fg: "#854F0B" },
  mute:    { bg: "#ECECEC", fg: "#525252" },
  filing:  { bg: "#ECECEC", fg: "#525252" },
  notice:  { bg: "#E1F5EE", fg: "#085041" },
  written_statement: { bg: "#E6F1FB", fg: "#185FA5" },
  issues:  { bg: "#EEEDFE", fg: "#3C3489" },
  evidence:{ bg: "#FAEEDA", fg: "#854F0B" },
  arguments:{ bg: "#E6F1FB", fg: "#185FA5" },
  reserved:{ bg: "#ECECEC", fg: "#525252" },
  decided: { bg: "#E1F5EE", fg: "#085041" },
};

function PPill({ tone = "live", children, size = "md" }) {
  const t = pTones[tone] || pTones.live;
  const pad = size === "sm" ? "2px 8px" : "4px 10px";
  const fs = size === "sm" ? 10.5 : 11;
  return <span style={{ background: t.bg, color: t.fg, padding: pad, borderRadius: 6, fontSize: fs, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>{children}</span>;
}

function PBtn({ children, onClick, full = false, size = "md", tone = "primary" }) {
  const bg = tone === "primary" ? "var(--primary)" : tone === "danger" ? "var(--accent)" : "var(--primary)";
  const pad = size === "sm" ? "8px 12px" : size === "lg" ? "14px 20px" : "11px 16px";
  const fs = size === "sm" ? 12 : size === "lg" ? 15 : 13;
  return (
    <button onClick={onClick} style={{
      border: 0, background: bg, color: "#fff", borderRadius: 10,
      padding: pad, fontWeight: 700, fontFamily: "var(--font-sans)", fontSize: fs,
      cursor: "pointer", width: full ? "100%" : "auto", whiteSpace: "nowrap",
      transition: "transform 200ms var(--ease-out), background 200ms var(--ease-out)"
    }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >{children}</button>
  );
}

function PGhost({ children, onClick, size = "md" }) {
  const pad = size === "sm" ? "7px 11px" : "10px 14px";
  const fs = size === "sm" ? 12 : 13;
  return <button onClick={onClick} style={{ background: "#fff", color: "var(--primary)", border: "1px solid rgba(15,110,86,0.25)", borderRadius: 10, padding: pad, fontWeight: 700, fontSize: fs, cursor: "pointer", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>{children}</button>;
}

function PChip({ active, children, onClick, size = "md" }) {
  const pad = size === "sm" ? "6px 10px" : "8px 12px";
  const fs = size === "sm" ? 11.5 : 13;
  return <span onClick={onClick} style={{
    padding: pad, borderRadius: 9999, background: active ? "var(--primary)" : "#fff",
    color: active ? "#fff" : "var(--fg1)", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
    fontSize: fs, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5
  }}>{children}</span>;
}

function PField({ label, children, hint, error }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg2)" }}>{label}</label>}
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: "var(--fg3)" }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: "var(--accent)" }}>{error}</div>}
    </div>
  );
}

function PInput(props) {
  return <input {...props} style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "#fff", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--fg1)", ...(props.style || {}) }}/>;
}

function PAvatar({ initials, size = 32, tone }) {
  const bg = tone || "var(--primary)";
  return <div style={{ width: size, height: size, borderRadius: 9999, background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.42 }}>{initials}</div>;
}

function PEyebrow({ children, tone = "primary" }) {
  const c = tone === "primary" ? "var(--primary)" : "var(--fg3)";
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: c }}>{children}</div>;
}

function PCaseNum({ children, size = 14 }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: size, color: "var(--fg1)" }}>{children}</span>;
}

function PLangToggle({ lang = "en", onChange, compact = false }) {
  const opts = [{ k: "en", l: "EN" }, { k: "ur", l: "اردو" }];
  return (
    <div style={{ display: "inline-flex", background: "#fff", border: "1px solid var(--border)", borderRadius: 9999, padding: 2 }}>
      {opts.map(o => (
        <button key={o.k} onClick={() => onChange && onChange(o.k)} style={{
          border: 0, background: lang === o.k ? "var(--primary)" : "transparent",
          color: lang === o.k ? "#fff" : "var(--fg2)",
          padding: compact ? "3px 10px" : "5px 12px", borderRadius: 9999,
          fontSize: 11.5, fontWeight: 700, cursor: "pointer",
          fontFamily: o.k === "ur" ? "var(--font-urdu)" : "var(--font-sans)"
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function PCourtBadge({ court, live }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg2)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: live ? "#10B981" : "var(--fg3)" }}></span>
      <span style={{ fontWeight: 600 }}>{court}</span>
      <span style={{ color: "var(--fg3)" }}>· {live ? "Live" : "Demo"}</span>
    </span>
  );
}

// ────── Device chrome ──────
function PStatusBar() {
  return (
    <div style={{ height: 44, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 22px", fontSize: 14, fontWeight: 600, color: "var(--fg1)", flex: "none" }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <i data-lucide="signal" style={{ width: 16, height: 16 }}></i>
        <i data-lucide="wifi" style={{ width: 16, height: 16 }}></i>
        <i data-lucide="battery-full" style={{ width: 20, height: 16 }}></i>
      </span>
    </div>
  );
}

function PAndroidStatusBar() {
  return (
    <div style={{ height: 28, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", fontSize: 12, fontWeight: 600, color: "var(--fg1)", flex: "none" }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <i data-lucide="signal" style={{ width: 13, height: 13 }}></i>
        <i data-lucide="wifi" style={{ width: 13, height: 13 }}></i>
        <i data-lucide="battery-full" style={{ width: 16, height: 13 }}></i>
      </span>
    </div>
  );
}

function PMTabBar({ active = "home", platform = "ios" }) {
  const tabs = [
    { k: "home", icon: "home", label: "Home" },
    { k: "cases", icon: "folder", label: "Cases" },
    { k: "calendar", icon: "calendar", label: "Calendar" },
    { k: "chat", icon: "message-square", label: "Chat" },
    { k: "more", icon: "menu", label: "More" },
  ];
  const h = platform === "android" ? 64 : 76;
  const pb = platform === "android" ? 8 : 18;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h, background: "#fff", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: pb }}>
      {tabs.map(t => (
        <div key={t.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active === t.k ? "var(--primary)" : "var(--fg3)", minWidth: 44 }}>
          <i data-lucide={t.icon} style={{ width: 21, height: 21 }}></i>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { PPill, PBtn, PGhost, PChip, PField, PInput, PAvatar, PEyebrow, PCaseNum, PLangToggle, PCourtBadge, PStatusBar, PAndroidStatusBar, PMTabBar, pTones });
