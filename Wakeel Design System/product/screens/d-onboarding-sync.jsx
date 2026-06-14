/* global React */
// Dashboard: Firm onboarding & Court sync settings. Reuses atoms.
// Court sync shows Pakistan-wide coverage — live vs roadmap per bench.

function DFirmSignup() {
  return (
    <div style={{ display: "flex", height: "100%", background: "var(--background)" }}>
      {/* Left panel — brand */}
      <div style={{ width: "46%", background: "linear-gradient(180deg, #0F6E56 0%, #08503F 100%)", color: "#fff", padding: "60px 52px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="../assets/wakeel-mark.svg" style={{ width: 32, height: 32, filter: "brightness(5)" }}/>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Wakeel</span>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.75 }}>WELCOME, COUNSEL</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.015em", marginTop: 12 }}>Your daftar,<br/>organised at last.</div>
          <div style={{ fontSize: 14, lineHeight: "22px", opacity: 0.85, marginTop: 16, maxWidth: 380 }}>
            Sync your roster with court cause-lists, manage hearings and clients, and keep your team working off one source of truth.
          </div>
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.65, fontFamily: "var(--font-mono)" }}>
          Built in Islamabad · supports IHC, LHC, SHC, PHC, BHC &amp; district courts.
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, padding: "60px 52px", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <PEyebrow>STEP 1 · 3 · FIRM SETUP</PEyebrow>
          <PLangToggle lang="en"/>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Tell us about your firm</div>
        <div style={{ fontSize: 14, color: "var(--fg2)", marginTop: 8, lineHeight: "21px" }}>
          We'll use this to set up your firm profile, invite your team, and import cases from your cause-list.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 28, maxWidth: 520 }}>
          <PField label="Firm name"><PInput defaultValue="Hassan &amp; Co. Law Associates"/></PField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PField label="Primary city">
              <select style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, background: "#fff" }}>
                <option>Islamabad</option><option>Rawalpindi</option><option>Lahore</option><option>Karachi</option><option>Peshawar</option><option>Quetta</option>
              </select>
            </PField>
            <PField label="Firm size">
              <select style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, background: "#fff" }}>
                <option>Solo practice</option><option>2–5 lawyers</option><option>6–15 lawyers</option><option>16–50 lawyers</option><option>50+</option>
              </select>
            </PField>
          </div>
          <PField label="Active bars" hint="Select all that apply — affects which courts we can sync for you.">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Supreme Court", "Islamabad HC", "Lahore HC", "Sindh HC", "Peshawar HC", "Balochistan HC", "District courts"].map((b,i) => (
                <PChip key={b} active={i < 2} size="sm">{b}</PChip>
              ))}
            </div>
          </PField>
          <PField label="Your role"><PInput defaultValue="Managing partner"/></PField>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <PGhost>Back</PGhost>
            <div style={{ flex: 1 }}></div>
            <PBtn>Continue — invite team</PBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function DCourtSync() {
  const courts = [
    { name: "Islamabad High Court", abbr: "IHC", live: true, cases: 12, lastSync: "9:12 AM", notes: "Cause-list, orders, judges — full coverage." },
    { name: "Lahore High Court", abbr: "LHC", live: true, cases: 8, lastSync: "9:10 AM", notes: "Cause-list + principal bench + Rawalpindi bench." },
    { name: "Sindh High Court", abbr: "SHC", live: false, cases: 3, lastSync: "—", notes: "Cause-list parser in QA — expected Q3." },
    { name: "Peshawar High Court", abbr: "PHC", live: false, cases: 1, lastSync: "—", notes: "Roadmap." },
    { name: "Balochistan High Court", abbr: "BHC", live: false, cases: 0, lastSync: "—", notes: "Roadmap." },
    { name: "Supreme Court of Pakistan", abbr: "SC", live: true, cases: 2, lastSync: "9:11 AM", notes: "Daily cause-list." },
    { name: "Islamabad District Courts", abbr: "ISB-DC", live: false, cases: 5, lastSync: "—", notes: "Manual entry only. API integration on roadmap." },
    { name: "Rawalpindi Sessions", abbr: "RWP-DC", live: false, cases: 4, lastSync: "—", notes: "Manual entry only." },
  ];
  return (
    <div style={{ padding: 28, overflow: "auto", height: "100%" }}>
      <PEyebrow>SETTINGS · COURTS</PEyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Court sync</div>
        <div style={{ fontSize: 12.5, color: "var(--fg3)" }}>Which benches Wakeel pulls cause-lists from automatically.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        <div style={{ background: "var(--primary-light)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: "0.08em" }}>LIVE BENCHES</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--primary-dark)", marginTop: 6, lineHeight: 1 }}>3</div>
          <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 4 }}>IHC · LHC · SC</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>ON ROADMAP</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--fg1)", marginTop: 6, lineHeight: 1 }}>5</div>
          <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 4 }}>SHC · PHC · BHC · districts</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>LAST SYNC</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg1)", marginTop: 6, lineHeight: 1, fontFamily: "var(--font-mono)" }}>9:12 AM</div>
          <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 4 }}>21 April 2026</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PBtn><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i data-lucide="refresh-cw" style={{ width: 14, height: 14 }}></i> Sync all now</span></PBtn>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "#FBFAF7", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.7fr 0.9fr 2.3fr 0.7fr", gap: 12, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>
          <span>Court</span><span>Status</span><span>Cases</span><span>Last sync</span><span>Notes</span><span></span>
        </div>
        {courts.map((c, i) => (
          <div key={c.abbr} style={{ padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)", display: "grid", gridTemplateColumns: "1.8fr 0.9fr 0.7fr 0.9fr 2.3fr 0.7fr", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{c.abbr}</div>
            </div>
            <div><PPill tone={c.live ? "live" : "mute"} size="sm">{c.live ? "● Live" : "○ Roadmap"}</PPill></div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--fg1)", fontWeight: 600 }}>{c.cases}</div>
            <div style={{ fontSize: 12, color: "var(--fg2)", fontFamily: "var(--font-mono)" }}>{c.lastSync}</div>
            <div style={{ fontSize: 12, color: "var(--fg2)", lineHeight: "17px" }}>{c.notes}</div>
            <div>{c.live ? <PGhost size="sm">Sync</PGhost> : <span style={{ fontSize: 11, color: "var(--fg3)" }}>notify me</span>}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 14, fontFamily: "var(--font-mono)", maxWidth: 640, lineHeight: "17px" }}>
        ● = Live cause-list parser. Matches cases on case number + party names.  ○ = Manual entry only; cases can still be tracked, but no automatic hearing sync. Parser errors are reported to admins.
      </div>
    </div>
  );
}

Object.assign(window, { DFirmSignup, DCourtSync });
