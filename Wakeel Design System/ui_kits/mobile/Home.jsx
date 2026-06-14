/* global React */
const { useState } = React;

function Home({ onOpenCase }) {
  const [tab, setTab] = useState("home");

  const hearings = [
    { id: "h1", num: "W.P. 2076/2019", title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc", meta: "09:30 · Islamabad High Court · IHC Live", tone: "live" },
    { id: "h2", num: "Civil Suit 201/2026", title: "Noor Enterprises v Al-Hamd Traders", meta: "11:15 · Islamabad Dist. East · District Demo", tone: "demo", conflict: true },
    { id: "h3", num: "Writ 884/2024", title: "Begum Tahira v Federation of Pakistan", meta: "02:00 · Rawalpindi Sessions · District Demo", tone: "demo" },
  ];

  const cases = [
    { id: "c1", num: "W.P. 2076/2019", title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc", meta: "Islamabad High Court · arguments · Next 14 May", tone: "live" },
    { id: "c2", num: "Civil Suit 201/2026", title: "Noor Enterprises v Al-Hamd Traders", meta: "Islamabad Dist. East · filing · Next TBC", tone: "demo" },
    { id: "c3", num: "Writ 884/2024", title: "Begum Tahira v Federation of Pakistan", meta: "Rawalpindi Sessions · evidence · Next 02 May", tone: "demo" },
    { id: "c4", num: "F.A.O. 55/2023", title: "Malik Agro Farms v Bank Alfalah Ltd", meta: "IHC · reserved · Next 28 Apr", tone: "live" },
  ];

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "4px 20px 16px", flex: 1, overflow: "hidden" }}>
        <Eyebrow>WAKEEL MOBILE</Eyebrow>
        <div style={{ fontSize: 26, fontWeight: 600, color: "var(--fg1)", marginTop: 6, marginBottom: 14, letterSpacing: "-0.01em" }}>Today's focus</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["home", "cases", "calendar"].map(k => (
            <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{k}</Chip>
          ))}
        </div>

        {tab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <StatCard n="12" label="Cases"/>
              <StatCard n="3" label="Hearings today"/>
              <StatCard n="1" label="Conflicts" tone="conflict"/>
            </div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: 16, boxShadow: "var(--shadow-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg1)" }}>Upcoming hearings</div>
                <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>IHC synced 9:12 AM</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hearings.map(h => (
                  <CaseCard key={h.id} caseNum={h.num} title={h.title} meta={h.meta} tone={h.tone} conflict={h.conflict} onClick={() => onOpenCase(h)}/>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "cases" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "auto", maxHeight: 520 }}>
            {cases.map(c => (
              <CaseCard key={c.id} caseNum={c.num} title={c.title} meta={c.meta} tone={c.tone} onClick={() => onOpenCase(c)}/>
            ))}
          </div>
        )}

        {tab === "calendar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "var(--fg2)" }}>Today · 21 April 2026</div>
            {hearings.map(h => (
              <CaseCard key={h.id} caseNum={h.num} title={h.title} meta={h.meta} tone={h.tone} conflict={h.conflict}/>
            ))}
          </div>
        )}
      </div>
      <TabBar active={tab === "calendar" ? "calendar" : tab === "cases" ? "cases" : "home"} onChange={k => setTab(k === "alerts" ? "home" : k)}/>
    </div>
  );
}

window.Home = Home;
