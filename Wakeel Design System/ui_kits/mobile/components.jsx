/* global React */
const { useState } = React;

// ---------- Shared atoms ----------
function Eyebrow({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--primary)" }}>{children}</div>;
}

function Pill({ tone = "live", children }) {
  const tones = {
    live:    { bg: "#E1F5EE", fg: "#08503F" },
    demo:    { bg: "#F4EEE0", fg: "#7A5B18" },
    conflict:{ bg: "#FAECE7", fg: "#D85A30" },
    filing:  { bg: "#ECECEC", fg: "#525252" },
    notice:  { bg: "#E1F5EE", fg: "#085041" },
    written: { bg: "#E6F1FB", fg: "#185FA5" },
    issues:  { bg: "#EEEDFE", fg: "#3C3489" },
    evidence:{ bg: "#FAEEDA", fg: "#854F0B" },
    arguments: { bg: "#E6F1FB", fg: "#185FA5" },
    reserved:{ bg: "#ECECEC", fg: "#525252" },
    decided: { bg: "#E1F5EE", fg: "#085041" },
  };
  const t = tones[tone] || tones.live;
  return <span style={{ background: t.bg, color: t.fg, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>{children}</span>;
}

function StatCard({ n, label, tone = "primary" }) {
  const isConflict = tone === "conflict";
  return (
    <div style={{ flex: 1, background: isConflict ? "#FAECE7" : "var(--primary-light)", borderRadius: 16, padding: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: isConflict ? "#D85A30" : "var(--primary-dark)", lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function CaseCard({ caseNum, title, meta, tone = "live", conflict = false, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "#fff", border: "1px solid var(--border)", borderLeft: `4px solid ${conflict ? "var(--accent)" : "var(--primary)"}`,
      borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer",
      boxShadow: "var(--shadow-card)", transition: "opacity 200ms var(--ease-out)"
    }}
      onMouseDown={e => e.currentTarget.style.opacity = 0.7}
      onMouseUp={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = 1}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--fg1)" }}>{caseNum}</span>
        <Pill tone={conflict ? "conflict" : tone}>{conflict ? "Conflict" : tone === "live" ? "IHC Live" : "District Demo"}</Pill>
      </div>
      <div style={{ fontSize: 13, color: "var(--fg2)", lineHeight: "18px" }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--fg3)" }}>{meta}</div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, full = false }) {
  return (
    <button onClick={onClick} style={{
      border: 0, background: "var(--primary)", color: "#fff", borderRadius: 12,
      padding: "12px 18px", fontWeight: 700, fontFamily: "var(--font-sans)", fontSize: 14,
      cursor: "pointer", transition: "transform 200ms var(--ease-out), background 200ms var(--ease-out)",
      width: full ? "100%" : "auto"
    }}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >{children}</button>
  );
}

function SecondaryBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: "#fff", color: "var(--primary)", border: "1px solid rgba(15,110,86,0.25)",
      borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer",
      fontFamily: "var(--font-sans)"
    }}>{children}</button>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <span onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 9999,
      background: active ? "var(--primary)" : "#fff",
      color: active ? "#fff" : "var(--fg1)",
      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
      fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize"
    }}>{children}</span>
  );
}

function TabBar({ active, onChange }) {
  const tabs = [
    { k: "home", icon: "home", label: "Home" },
    { k: "cases", icon: "folder", label: "Cases" },
    { k: "calendar", icon: "calendar", label: "Calendar" },
    { k: "alerts", icon: "bell", label: "Alerts" },
  ];
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 76,
      background: "#fff", borderTop: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-around",
      paddingBottom: 18
    }}>
      {tabs.map(t => (
        <div key={t.k} onClick={() => onChange(t.k)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          color: active === t.k ? "var(--primary)" : "var(--fg3)",
          cursor: "pointer", minWidth: 44
        }}>
          <i data-lucide={t.icon} style={{ width: 22, height: 22 }}></i>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ height: 44, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 22px", fontSize: 14, fontWeight: 600, color: "var(--fg1)" }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <i data-lucide="signal" style={{ width: 16, height: 16 }}></i>
        <i data-lucide="wifi" style={{ width: 16, height: 16 }}></i>
        <i data-lucide="battery-full" style={{ width: 20, height: 16 }}></i>
      </span>
    </div>
  );
}

Object.assign(window, { Eyebrow, Pill, StatCard, CaseCard, PrimaryBtn, SecondaryBtn, Chip, TabBar, StatusBar });
