/* global React */
const { useState } = React;

function DashStat({ label, value, sub, tone = "primary" }) {
  const isConflict = tone === "conflict";
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 18, boxShadow: "var(--shadow-card)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: isConflict ? "var(--accent)" : "var(--fg1)", marginTop: 8, lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function Sidebar({ active, onChange }) {
  const items = [
    { k: "overview", icon: "layout-dashboard", label: "Overview" },
    { k: "cases",    icon: "folder",           label: "Cases" },
    { k: "hearings", icon: "gavel",            label: "Hearings" },
    { k: "sync",     icon: "refresh-cw",       label: "IHC Sync" },
    { k: "clients",  icon: "users",            label: "Clients" },
    { k: "share",    icon: "share-2",          label: "Share links" },
  ];
  return (
    <div style={{ width: 220, background: "#fff", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "18px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 10px", marginBottom: 22 }}>
        <img src="../../assets/wakeel-mark.svg" style={{ width: 30, height: 30 }}/>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--primary-dark)", letterSpacing: "-0.01em" }}>Wakeel</div>
          <div style={{ fontSize: 9.5, color: "var(--fg3)", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>Firm · Demo</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(it => (
          <div key={it.k} onClick={() => onChange(it.k)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, cursor: "pointer",
            background: active === it.k ? "var(--primary-light)" : "transparent",
            color: active === it.k ? "var(--primary-dark)" : "var(--fg2)",
            fontSize: 13, fontWeight: active === it.k ? 700 : 600,
          }}>
            <i data-lucide={it.icon} style={{ width: 16, height: 16 }}></i>
            {it.label}
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 12, padding: 12, fontSize: 11, color: "var(--fg2)" }}>
        <div style={{ fontWeight: 700, color: "var(--fg1)", marginBottom: 4 }}>Demo mode</div>
        Seeded users · IHC live sync · reset available to admins only.
      </div>
    </div>
  );
}

function Topbar({ onReset, onSync, syncing }) {
  return (
    <div style={{ height: 60, borderBottom: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", padding: "0 24px", gap: 14 }}>
      <div style={{ fontSize: 14, color: "var(--fg2)" }}>
        IHC last synced <strong style={{ color: "var(--fg1)", fontFamily: "var(--font-mono)" }}>9:12 AM · 21 Apr</strong>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={onSync} style={{
          background: "#fff", color: "var(--primary)", border: "1px solid rgba(15,110,86,0.25)",
          borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6
        }}>
          <i data-lucide="refresh-cw" style={{ width: 14, height: 14, animation: syncing ? "spin 1s linear infinite" : "none" }}></i>
          {syncing ? "Syncing IHC…" : "Sync IHC now"}
        </button>
        <button onClick={onReset} style={{
          background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(216,90,48,0.25)",
          borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer"
        }}>Reset demo</button>
        <div style={{ width: 1, height: 24, background: "var(--border)" }}></div>
        <div style={{ width: 32, height: 32, borderRadius: 9999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>AH</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DashPill({ tone, children }) {
  const tones = {
    live:    { bg: "#E1F5EE", fg: "#08503F" },
    demo:    { bg: "#F4EEE0", fg: "#7A5B18" },
    conflict:{ bg: "#FAECE7", fg: "#D85A30" },
    arguments:{bg: "#E6F1FB", fg: "#185FA5" },
    evidence:{ bg: "#FAEEDA", fg: "#854F0B" },
    filing:  { bg: "#ECECEC", fg: "#525252" },
    reserved:{ bg: "#ECECEC", fg: "#525252" },
  };
  const t = tones[tone] || tones.live;
  return <span style={{ background: t.bg, color: t.fg, padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "inline-flex" }}>{children}</span>;
}

Object.assign(window, { DashStat, Sidebar, Topbar, DashPill });
