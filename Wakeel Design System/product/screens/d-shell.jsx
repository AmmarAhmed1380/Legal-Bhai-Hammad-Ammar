/* global React */
// Dashboard shell (desktop-only, 1440 wide).
// Exposes DShell, DSidebar, DTopbar, DEyebrow, DSectionHead.

function DShell({ active = "overview", children }) {
  return (
    <div style={{ display: "flex", height: "100%", background: "var(--background)", fontFamily: "var(--font-sans)" }}>
      <DSidebar active={active}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DTopbar/>
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function DSidebar({ active }) {
  const sections = [
    { label: "WORK", items: [
      { k: "overview", icon: "layout-dashboard", label: "Overview" },
      { k: "cases", icon: "folder", label: "Cases", count: 54 },
      { k: "calendar", icon: "calendar", label: "Calendar" },
      { k: "search", icon: "search", label: "Search" },
      { k: "alerts", icon: "bell", label: "Alerts", count: 3 },
    ]},
    { label: "OPERATIONS", items: [
      { k: "time", icon: "clock", label: "Time & invoicing" },
      { k: "clients", icon: "users", label: "Clients", count: 36 },
      { k: "vault", icon: "archive", label: "Document vault" },
      { k: "reports", icon: "bar-chart-3", label: "Reports" },
    ]},
    { label: "ADMIN", items: [
      { k: "courts", icon: "landmark", label: "Court sync" },
      { k: "team", icon: "user-cog", label: "Team & roles" },
      { k: "settings", icon: "settings", label: "Settings" },
    ]},
  ];
  return (
    <div style={{ width: 240, background: "#fff", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "18px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 10px", marginBottom: 24 }}>
        <img src="../assets/wakeel-mark.svg" style={{ width: 30, height: 30 }}/>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--primary-dark)", letterSpacing: "-0.01em" }}>Wakeel</div>
          <div style={{ fontSize: 9.5, color: "var(--fg3)", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Hassan &amp; Co.</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        {sections.map((sec, si) => (
          <div key={si}>
            <div style={{ padding: "0 10px 6px", fontSize: 9.5, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.12em" }}>{sec.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {sec.items.map(it => (
                <div key={it.k} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  background: active === it.k ? "var(--primary-light)" : "transparent",
                  color: active === it.k ? "var(--primary-dark)" : "var(--fg2)",
                  fontSize: 13, fontWeight: active === it.k ? 700 : 600,
                }}>
                  <i data-lucide={it.icon} style={{ width: 15, height: 15 }}></i>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.count !== undefined && <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: active === it.k ? "var(--primary)" : "var(--fg3)", fontWeight: 700 }}>{it.count}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: 11, fontSize: 11, color: "var(--fg2)", lineHeight: "15px" }}>
        <div style={{ fontWeight: 700, color: "var(--fg1)", marginBottom: 3, fontSize: 11.5 }}>3 live benches</div>
        IHC · LHC · SC cause-lists. SHC, PHC, BHC on roadmap.
      </div>
    </div>
  );
}

function DTopbar({ title, crumbs }) {
  return (
    <div style={{ height: 56, borderBottom: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flex: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg2)", whiteSpace: "nowrap", minWidth: 0 }}>
        <i data-lucide="landmark" style={{ width: 14, height: 14, flex: "none" }}></i>
        <span>IHC last synced</span>
        <strong style={{ color: "var(--fg1)", fontFamily: "var(--font-mono)" }}>9:12 AM · 21 Apr</strong>
        <span style={{ color: "var(--fg3)" }}>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#10B981", flex: "none" }}></span>
          <span>3 benches live</span>
        </span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
        <div style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "var(--fg3)", display: "flex", alignItems: "center", gap: 8, width: 240, whiteSpace: "nowrap" }}>
          <i data-lucide="search" style={{ width: 13, height: 13, flex: "none" }}></i>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Search cases, clients, hearings…</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10 }}>⌘K</span>
        </div>
        <PLangToggle lang="en" compact/>
        <i data-lucide="bell" style={{ width: 17, height: 17, color: "var(--fg2)" }}></i>
        <div style={{ width: 1, height: 22, background: "var(--border)" }}></div>
        <PAvatar initials="AH" size={30}/>
      </div>
    </div>
  );
}

function DSectionHead({ eyebrow, title, subtitle, actions }) {
  return (
    <div style={{ padding: "24px 28px 20px", display: "flex", alignItems: "flex-end", gap: 18 }}>
      <div style={{ flex: 1 }}>
        {eyebrow && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{eyebrow}</div>}
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg1)", letterSpacing: "-0.01em", marginTop: 4 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--fg2)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

Object.assign(window, { DShell, DSidebar, DTopbar, DSectionHead });
