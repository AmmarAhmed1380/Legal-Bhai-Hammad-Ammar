/* global React */
const { useState } = React;

const CASES = [
  { num: "W.P. 2076/2019", title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc", court: "Islamabad High Court", stage: "arguments", next: "2026-05-14", source: "live", owner: "Ahmed H." },
  { num: "Civil Suit 201/2026", title: "Noor Enterprises v Al-Hamd Traders", court: "Islamabad District East", stage: "filing", next: "2026-05-02", source: "demo", owner: "Ayesha K." },
  { num: "Writ 884/2024", title: "Begum Tahira v Federation of Pakistan", court: "Rawalpindi Sessions", stage: "evidence", next: "2026-05-02", source: "demo", owner: "Ahmed H." },
  { num: "F.A.O. 55/2023", title: "Malik Agro Farms v Bank Alfalah Ltd", court: "Islamabad High Court", stage: "reserved", next: "2026-04-28", source: "live", owner: "Hamza S." },
  { num: "C.P. 1412/2025", title: "Sarim Textiles v Punjab Revenue Authority", court: "IHC", stage: "arguments", next: "2026-05-06", source: "live", owner: "Ayesha K." },
  { num: "Crim. Misc 77/2026", title: "State v Adil Raza", court: "Rawalpindi Sessions", stage: "evidence", next: "2026-05-11", source: "demo", owner: "Hamza S." },
];

function Overview({ onShare, onOpenCase }) {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, overflow: "auto" }}>
      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <DashStat label="Total cases" value="42" sub="+4 since last sync"/>
        <DashStat label="Hearings this week" value="18" sub="IHC 9 · District 9"/>
        <DashStat label="Conflicts" value="2" sub="Unresolved in calendar" tone="conflict"/>
        <DashStat label="Lawyers assigned" value="6" sub="Across 3 offices"/>
      </div>

      {/* Two column */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}>
        {/* Case roster */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-card)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg1)" }}>Case roster</div>
            <div style={{ display: "flex", gap: 6 }}>
              <DashPill tone="live">Live</DashPill>
              <DashPill tone="demo">Demo</DashPill>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FBFAF7" }}>
                {["Case #", "Title", "Court", "Stage", "Next", "Source", "Owner"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CASES.map((c, i) => (
                <tr key={c.num} onClick={() => onOpenCase(c)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}>
                  <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--fg1)" }}>{c.num}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--fg2)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--fg2)" }}>{c.court}</td>
                  <td style={{ padding: "11px 14px" }}><DashPill tone={c.stage}>{c.stage}</DashPill></td>
                  <td style={{ padding: "11px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg2)" }}>{c.next}</td>
                  <td style={{ padding: "11px 14px" }}><DashPill tone={c.source}>{c.source === "live" ? "IHC Live" : "Demo"}</DashPill></td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--fg2)" }}>{c.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Conflict */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderLeft: "4px solid var(--accent)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-card)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>Conflict detected</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg1)", marginTop: 6 }}>Ayesha K. double-booked</div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)", marginTop: 4, lineHeight: "18px" }}>
              C.P. 1412/2025 (IHC, 11:00) overlaps with Civil Suit 201/2026 (Islamabad East, 11:15) on 02 May.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={{ background: "var(--primary)", color: "#fff", border: 0, borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 700 }}>Reassign</button>
              <button style={{ background: "#fff", color: "var(--fg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 11px", fontSize: 12, fontWeight: 600 }}>Dismiss</button>
            </div>
          </div>

          {/* Share link */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-card)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)" }}>Share with client</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg1)", marginTop: 6 }}>W.P. 2076/2019</div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)", marginTop: 4 }}>Ahmed Zubair · +92 300 1234567</div>
            <div style={{ marginTop: 10, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              wakeel.demo/c/tk_9a2c-4f18-b7e0
            </div>
            <button onClick={onShare} style={{ marginTop: 10, background: "var(--primary)", color: "#fff", border: 0, borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i data-lucide="share-2" style={{ width: 14, height: 14 }}></i> Copy &amp; open
            </button>
          </div>

          {/* IHC sync status */}
          <div style={{ background: "var(--primary-light)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary-dark)" }}>IHC Cause-list sync</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg2)", marginTop: 6, lineHeight: "18px" }}>
              9:12 AM · 118 rows parsed<br/>
              4 new matched to roster<br/>
              0 parser errors
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Overview = Overview;
