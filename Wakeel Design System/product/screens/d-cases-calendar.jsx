/* global React */
// Dashboard: Cases roster + Calendar views.

function DCasesRoster() {
  const cases = [
    { num: "W.P. 2076/2019", title: "Redtone Telecom v CIR", court: "IHC", live: true, stage: "arguments", next: "Thu 14 May", owner: "AH", client: "Redtone Pak" },
    { num: "W.P. 481/2024", title: "Hafeez Centre Traders Assoc. v LDA", court: "IHC", live: true, stage: "issues", next: "Tue 22 Apr", owner: "AK", client: "Hafeez Traders", conflict: true },
    { num: "FIR 442/2024", title: "State v Ali Raza", court: "ISB-DC", live: false, stage: "evidence", next: "Mon 29 Apr", owner: "AH", client: "Ali Raza" },
    { num: "Suit 1108/2023", title: "Zubair v Faisal Textiles", court: "RWP-DC", live: false, stage: "written_statement", next: "Mon 6 May", owner: "HS", client: "Zubair Enterprises" },
    { num: "CMA 220/2025", title: "Ahmed v Excise Dept.", court: "LHC", live: true, stage: "notice", next: "Mon 12 May", owner: "AK", client: "Ahmed Trading" },
    { num: "Crl.App. 55/2024", title: "Noor v State", court: "IHC", live: true, stage: "filing", next: "—", owner: "AH", client: "Noor Muhammad" },
    { num: "W.P. 932/2022", title: "Karim & Sons v FBR", court: "LHC", live: true, stage: "reserved", next: "Fri 25 Apr", owner: "AH", client: "Karim & Sons" },
    { num: "Suit 88/2024", title: "Shaheen Co-op v Cap. Dev. Auth.", court: "ISB-DC", live: false, stage: "evidence", next: "Wed 30 Apr", owner: "HS", client: "Shaheen Co-op" },
  ];
  return (
    <DShell active="cases">
      <DSectionHead eyebrow="CASES · 54 TOTAL" title="Case roster" subtitle="All matters across IHC, LHC, SC, and seeded district courts."
        actions={<>
          <PGhost>Import CSV</PGhost>
          <PBtn>+ New case</PBtn>
        </>}/>
      <div style={{ padding: "0 28px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <PChip active size="sm">All · 54</PChip>
        <PChip size="sm">Mine · 18</PChip>
        <PChip size="sm">IHC · 22</PChip>
        <PChip size="sm">LHC · 14</PChip>
        <PChip size="sm">District · 13</PChip>
        <PChip size="sm">Conflicts · 1</PChip>
        <div style={{ flex: 1 }}></div>
        <PChip size="sm"><i data-lucide="sliders-horizontal" style={{ width: 12, height: 12, marginRight: 4 }}></i> Filters</PChip>
        <PChip size="sm"><i data-lucide="arrow-up-down" style={{ width: 12, height: 12, marginRight: 4 }}></i> Sort: Next hearing</PChip>
      </div>
      <div style={{ padding: "0 28px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 3fr 1fr 1fr 1.1fr 0.8fr 0.7fr", gap: 14, padding: "12px 18px", background: "#FBFAF7", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <div>Case #</div><div>Title</div><div>Court</div><div>Stage</div><div>Next hearing</div><div>Client</div><div>Owner</div>
          </div>
          {cases.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 3fr 1fr 1fr 1.1fr 0.8fr 0.7fr", gap: 14, padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12.5, color: "var(--fg1)" }}>{c.num}</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--fg1)", fontWeight: 600 }}>{c.title}</div>
                {c.conflict && <div style={{ marginTop: 4 }}><PPill tone="conflict" size="sm">conflict 22 Apr</PPill></div>}
              </div>
              <div><PCourtBadge court={c.court} live={c.live}/></div>
              <div><PPill tone={c.stage} size="sm">{c.stage.replace("_", " ")}</PPill></div>
              <div style={{ fontSize: 12.5, color: "var(--fg2)", fontFamily: "var(--font-mono)" }}>{c.next}</div>
              <div style={{ fontSize: 12, color: "var(--fg2)" }}>{c.client}</div>
              <div><PAvatar initials={c.owner} size={26}/></div>
            </div>
          ))}
        </div>
      </div>
    </DShell>
  );
}

function DCalendar() {
  const days = ["Mon 21", "Tue 22", "Wed 23", "Thu 24", "Fri 25"];
  const hours = [9, 10, 11, 12, 13, 14, 15, 16];
  const events = [
    { day: 0, start: 9.5, end: 11, num: "W.P. 2076/2019", title: "Redtone v CIR", room: "CR 4", court: "IHC", tone: "primary" },
    { day: 0, start: 11.25, end: 12.5, num: "W.P. 481/2024", title: "Hafeez Centre", room: "CR 2", court: "IHC", tone: "conflict" },
    { day: 0, start: 14, end: 15.5, num: "FIR 442/2024", title: "State v Ali Raza", room: "ADJ-3", court: "ISB-DC", tone: "warn" },
    { day: 1, start: 10, end: 11, num: "W.P. 481/2024", title: "Hafeez · issues", room: "CR 2", court: "IHC", tone: "primary" },
    { day: 2, start: 11, end: 12, num: "Suit 88/2024", title: "Shaheen Co-op", room: "ADJ-7", court: "ISB-DC", tone: "warn" },
    { day: 3, start: 9, end: 10.5, num: "W.P. 932/2022", title: "Karim v FBR · reserved", room: "CR 3", court: "LHC", tone: "primary" },
    { day: 4, start: 10, end: 11.5, num: "CMA 220/2025", title: "Ahmed v Excise", room: "CR 1", court: "LHC", tone: "primary" },
    { day: 4, start: 13.5, end: 14.5, num: "Crl.App. 55/2024", title: "Noor v State", room: "CR 6", court: "IHC", tone: "primary" },
  ];
  const rowH = 56;
  const startH = 9;
  return (
    <DShell active="calendar">
      <DSectionHead eyebrow="CALENDAR · WEEK OF 21 APRIL" title="Hearings schedule" subtitle="Firm-wide. Red bars indicate conflicts across courts."
        actions={<>
          <PGhost>Today</PGhost>
          <PChip size="sm">Week</PChip>
          <PChip size="sm">Month</PChip>
          <PBtn><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i data-lucide="link" style={{ width: 13, height: 13 }}></i> Google Cal</span></PBtn>
        </>}/>
      <div style={{ padding: "0 28px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", borderBottom: "1px solid var(--border)", background: "#FBFAF7" }}>
            <div></div>
            {days.map((d, i) => (
              <div key={i} style={{ padding: "12px 14px", fontSize: 11.5, fontWeight: 700, color: i === 0 ? "var(--primary-dark)" : "var(--fg2)", borderLeft: "1px solid var(--border)" }}>
                {d} {i === 0 && <span style={{ fontSize: 9.5, color: "var(--primary)", letterSpacing: "0.1em", marginLeft: 6 }}>TODAY</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", position: "relative" }}>
            <div>
              {hours.map(h => (
                <div key={h} style={{ height: rowH, padding: "4px 10px", fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)", fontWeight: 600, textAlign: "right", borderTop: "1px solid var(--border)" }}>{h}:00</div>
              ))}
            </div>
            {days.map((_, di) => (
              <div key={di} style={{ position: "relative", borderLeft: "1px solid var(--border)" }}>
                {hours.map(h => (
                  <div key={h} style={{ height: rowH, borderTop: "1px solid var(--border)" }}></div>
                ))}
                {events.filter(e => e.day === di).map((e, ei) => {
                  const top = (e.start - startH) * rowH;
                  const height = (e.end - e.start) * rowH;
                  const bg = e.tone === "conflict" ? "#FAECE7" : e.tone === "warn" ? "#FAEEDA" : "var(--primary-light)";
                  const fg = e.tone === "conflict" ? "var(--accent)" : e.tone === "warn" ? "#854F0B" : "var(--primary-dark)";
                  const border = e.tone === "conflict" ? "var(--accent)" : e.tone === "warn" ? "#C97C0A" : "var(--primary)";
                  return (
                    <div key={ei} style={{ position: "absolute", top: top + 2, left: 4, right: 4, height: height - 4, background: bg, borderLeft: `3px solid ${border}`, borderRadius: 6, padding: "5px 8px", overflow: "hidden" }}>
                      <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", fontWeight: 700, color: fg }}>{e.num}</div>
                      <div style={{ fontSize: 11.5, color: "var(--fg1)", fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                      <div style={{ fontSize: 10, color: "var(--fg3)", marginTop: 1 }}>{e.room} · {e.court}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DShell>
  );
}

Object.assign(window, { DCasesRoster, DCalendar });
