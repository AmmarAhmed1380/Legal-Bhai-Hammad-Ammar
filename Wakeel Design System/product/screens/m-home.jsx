/* global React */
// Mobile: Home — today's hearings, quick stats, recent activity.

function MHome({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const today = [
    { num: "W.P. 2076/2019", title: "Redtone Telecom v CIR", time: "09:30", room: "CR 4", court: "IHC", live: true, stage: "arguments" },
    { num: "W.P. 481/2024", title: "Hafeez Centre Traders Assoc.", time: "11:15", room: "CR 2", court: "IHC", live: true, stage: "issues", conflict: true },
    { num: "FIR 442/2024", title: "State v Ali Raza", time: "14:00", room: "ADJ-3", court: "ISB-DC", live: false, stage: "evidence" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 12px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--fg3)", fontWeight: 600 }}>Tuesday 21 April</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--fg1)", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Assalam-o-Alaikum</div>
        </div>
        <PLangToggle lang="en" compact/>
        <div style={{ position: "relative" }}>
          <i data-lucide="bell" style={{ width: 20, height: 20, color: "var(--fg2)" }}></i>
          <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 9999, background: "var(--accent)" }}></span>
        </div>
      </div>
      <div style={{ padding: "0 22px 10px", display: "flex", gap: 8 }}>
        {[{ v: "3", l: "Today" }, { v: "12", l: "This week" }, { v: "1", l: "Conflicts", tone: "accent" }].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.tone === "accent" ? "var(--accent)" : "var(--fg1)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 10.5, color: "var(--fg3)", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 22px 90px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 6px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)" }}>Today's hearings</div>
          <span style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>synced 9:12</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {today.map((h, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 13, borderLeft: `3px solid ${h.conflict ? "var(--accent)" : "var(--primary)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--primary-dark)", background: "var(--primary-light)", padding: "3px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>{h.time}</div>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11.5, color: "var(--fg1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{h.num}</span>
                <div style={{ flex: 1 }}></div>
                {h.conflict && <PPill tone="conflict" size="sm">conflict</PPill>}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg1)", marginTop: 6, lineHeight: "18px" }}>{h.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11.5, color: "var(--fg3)" }}>
                <PCourtBadge court={h.court} live={h.live}/>
                <span>·</span>
                <span>{h.room}</span>
                <span>·</span>
                <PPill tone={h.stage} size="sm">{h.stage}</PPill>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "20px 0 6px", fontSize: 13, fontWeight: 700, color: "var(--fg1)" }}>Recent activity</div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {[
            ["clock", "Ayesha logged 1.5h on W.P. 481/2024", "2h ago"],
            ["message-square", "Ahmed Zubair replied — 'Thank you'", "4h ago"],
            ["file-text", "Order uploaded · W.P. 2076/2019", "yesterday"],
          ].map(([icon, text, time], i, a) => (
            <div key={i} style={{ padding: "11px 12px", display: "flex", alignItems: "center", gap: 10, borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ width: 26, height: 26, borderRadius: 9999, background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i data-lucide={icon} style={{ width: 13, height: 13, color: "var(--primary)" }}></i>
              </div>
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--fg1)" }}>{text}</div>
              <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{time}</div>
            </div>
          ))}
        </div>
      </div>
      <PMTabBar active="home" platform={platform}/>
    </div>
  );
}

Object.assign(window, { MHome });
