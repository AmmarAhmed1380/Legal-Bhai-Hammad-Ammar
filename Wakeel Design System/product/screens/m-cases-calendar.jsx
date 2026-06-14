/* global React */
// Mobile: Cases list (filter chips + list) and Calendar (month + day).

function MCasesList({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const cases = [
    { num: "W.P. 2076/2019", title: "Redtone Telecom v CIR", court: "IHC", live: true, stage: "arguments", next: "14 May" },
    { num: "W.P. 481/2024", title: "Hafeez Centre Traders v LDA", court: "IHC", live: true, stage: "issues", next: "22 Apr" },
    { num: "FIR 442/2024", title: "State v Ali Raza", court: "ISB-DC", live: false, stage: "evidence", next: "29 Apr" },
    { num: "Suit 1108/2023", title: "Zubair v Faisal Textiles", court: "RWP-DC", live: false, stage: "written_statement", next: "6 May" },
    { num: "CMA 220/2025", title: "Ahmed v Excise Dept.", court: "LHC", live: true, stage: "notice", next: "12 May" },
    { num: "Crl.App. 55/2024", title: "Noor v State", court: "IHC", live: true, stage: "filing", next: "—" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)", letterSpacing: "-0.01em" }}>Cases</div>
          <div style={{ display: "flex", gap: 10 }}>
            <i data-lucide="search" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
            <i data-lucide="sliders-horizontal" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 22px 10px", display: "flex", gap: 6, overflowX: "auto" }}>
        <PChip active size="sm">All · 54</PChip>
        <PChip size="sm">Mine · 18</PChip>
        <PChip size="sm">IHC</PChip>
        <PChip size="sm">LHC</PChip>
        <PChip size="sm">District</PChip>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 22px 90px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {cases.map((c, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PCaseNum size={13}>{c.num}</PCaseNum>
                <div style={{ flex: 1 }}></div>
                <PPill tone={c.stage} size="sm">{c.stage.replace("_", " ")}</PPill>
              </div>
              <div style={{ fontSize: 13, color: "var(--fg1)", marginTop: 5, lineHeight: "18px" }}>{c.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 11, color: "var(--fg3)" }}>
                <PCourtBadge court={c.court} live={c.live}/>
                <span style={{ marginLeft: "auto" }}>Next <strong style={{ color: "var(--fg1)" }}>{c.next}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PMTabBar active="cases" platform={platform}/>
      <div style={{ position: "absolute", bottom: platform === "android" ? 78 : 92, right: 18, width: 50, height: 50, borderRadius: 9999, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(15,110,86,0.35)" }}>
        <i data-lucide="plus" style={{ width: 22, height: 22, color: "#fff" }}></i>
      </div>
    </div>
  );
}

function MCalendar({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const hearingDays = { 7: 1, 14: 2, 18: 1, 21: 3, 22: 2, 28: 1 };
  const today = 21;
  const todayList = [
    { time: "09:30", num: "W.P. 2076/2019", title: "Redtone v CIR", room: "CR 4" },
    { time: "11:15", num: "W.P. 481/2024", title: "Hafeez Centre", room: "CR 2", conflict: true },
    { time: "14:00", num: "FIR 442/2024", title: "State v Ali Raza", room: "ADJ-3" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11.5, color: "var(--fg3)", fontWeight: 600 }}>APRIL 2026</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--fg1)" }}>Calendar</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <i data-lucide="chevron-left" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
          <i data-lucide="chevron-right" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
          <i data-lucide="refresh-cw" style={{ width: 18, height: 18, color: "var(--fg2)" }}></i>
        </div>
      </div>
      <div style={{ padding: "0 18px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: 10, fontWeight: 700, color: "var(--fg3)", textAlign: "center", padding: "6px 0" }}>
          {["M","T","W","T","F","S","S"].map((d,i) => <div key={i}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {days.map(d => {
            const isToday = d === today;
            const ct = hearingDays[d];
            return (
              <div key={d} style={{ aspectRatio: "1/1", borderRadius: 8, background: isToday ? "var(--primary)" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isToday ? "#fff" : "var(--fg1)" }}>{d}</div>
                {ct && <div style={{ marginTop: 2, display: "flex", gap: 2 }}>
                  {Array.from({ length: Math.min(ct,3) }).map((_,i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 9999, background: isToday ? "#fff" : "var(--primary)" }}></span>)}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "8px 22px 90px" }}>
        <div style={{ padding: "10px 0 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)" }}>Tuesday 21 April</div>
          <PPill tone="live" size="sm">3 hearings</PPill>
        </div>
        <div style={{ position: "relative", paddingLeft: 54 }}>
          <div style={{ position: "absolute", left: 40, top: 0, bottom: 0, width: 1, background: "var(--border)" }}></div>
          {todayList.map((h,i) => (
            <div key={i} style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ position: "absolute", left: -54, top: 4, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--fg2)", width: 40, textAlign: "right" }}>{h.time}</div>
              <div style={{ position: "absolute", left: -16, top: 6, width: 10, height: 10, borderRadius: 9999, background: h.conflict ? "var(--accent)" : "var(--primary)", boxShadow: "0 0 0 3px var(--background)" }}></div>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "var(--fg1)", whiteSpace: "nowrap" }}>{h.num}</span>
                  {h.conflict && <PPill tone="conflict" size="sm">conflict</PPill>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg1)", marginTop: 5 }}>{h.title}</div>
                <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 3 }}>{h.room}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PMTabBar active="calendar" platform={platform}/>
    </div>
  );
}

Object.assign(window, { MCasesList, MCalendar });
