/* global React */
// Phase 5 — Marketing landing page. Pakistan-rooted, product-rooted.
// Single-scroll, ~1440 wide, paired light/dark sections.

function MktLanding() {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--fg1)", background: "var(--background)" }}>
      <MktNav/>
      <MktHero/>
      <MktMarquee/>
      <MktProblem/>
      <MktHowItWorks/>
      <MktCourtCoverage/>
      <MktDeviceShowcase/>
      <MktSecurity/>
      <MktPricing/>
      <MktTestimonials/>
      <MktFinalCTA/>
      <MktFooter/>
    </div>
  );
}

function MktNav() {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(248,247,243,0.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "14px 32px", display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="../assets/wakeel-mark.svg" style={{ width: 28, height: 28 }}/>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--primary-dark)", letterSpacing: "-0.01em" }}>Wakeel</div>
        </div>
        <div style={{ display: "flex", gap: 22, fontSize: 13, color: "var(--fg2)", fontWeight: 500 }}>
          {["Product", "Courts", "Pricing", "Firms", "Help"].map(x => <span key={x}>{x}</span>)}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--fg2)", fontWeight: 600 }}>اردو</span>
          <span style={{ fontSize: 13, color: "var(--fg2)", fontWeight: 600 }}>Sign in</span>
          <button style={{ background: "var(--primary)", color: "#fff", border: 0, padding: "9px 16px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>Book demo</button>
        </div>
      </div>
    </div>
  );
}

function MktHero() {
  return (
    <div style={{ padding: "72px 32px 60px", maxWidth: 1240, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 60, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: 9999, fontSize: 12, color: "var(--fg2)", fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#10B981" }}></span>
            Live sync with IHC, LHC &amp; Supreme Court
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 64, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.02, margin: "20px 0 18px", color: "var(--fg1)" }}>
            A dafter for Pakistani lawyers — built in <span style={{ color: "var(--primary)" }}>Islamabad</span>.
          </h1>
          <p style={{ fontSize: 18, color: "var(--fg2)", lineHeight: "28px", maxWidth: 560 }}>
            Wakeel pulls cause-lists, dates, and orders straight from the court websites your firm already checks manually. It keeps your roznamcha, your clients, and your hearing calendar in one place — on your phone and in the office.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 12, alignItems: "center" }}>
            <button style={{ background: "var(--primary)", color: "#fff", border: 0, padding: "14px 22px", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Book a 20-min demo</button>
            <button style={{ background: "#fff", color: "var(--primary)", border: "1px solid rgba(15,110,86,0.25)", padding: "14px 22px", borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Watch 90-sec tour →</button>
          </div>
          <div style={{ marginTop: 24, fontSize: 12, color: "var(--fg3)" }}>
            Free for 14 days · No court-fee reimbursements taken · Data hosted on PK-DC (Lahore + Karachi)
          </div>
        </div>
        <MktHeroVisual/>
      </div>
    </div>
  );
}

function MktHeroVisual() {
  return (
    <div style={{ position: "relative", height: 520 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 70% 30%, var(--primary-light) 0%, transparent 60%)" }}></div>
      <div style={{ position: "absolute", top: 36, right: 0, width: 360, height: 440, background: "#fff", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 30px 60px -18px rgba(15,110,86,0.25)", padding: 24, transform: "rotate(2deg)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.12em" }}>TODAY · TUESDAY 21 APRIL</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 10, letterSpacing: "-0.01em" }}>3 hearings scheduled</div>
        {[
          { t: "09:30", num: "W.P. 2076/2019", title: "Redtone v CIR", room: "IHC · Courtroom 4", tone: "primary" },
          { t: "11:15", num: "W.P. 481/2024", title: "Hafeez Centre Traders", room: "IHC · Courtroom 2", tone: "accent" },
          { t: "14:00", num: "FIR 442/2024", title: "State v Ali Raza", room: "Isb DC · ADJ-3", tone: "warn" },
        ].map((h, i) => (
          <div key={i} style={{ marginTop: 12, background: "#FBFAF7", border: `1px solid ${h.tone === "accent" ? "rgba(216,90,48,0.35)" : "var(--border)"}`, borderLeft: `4px solid ${h.tone === "accent" ? "var(--accent)" : h.tone === "warn" ? "#C97C0A" : "var(--primary)"}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--primary-dark)", background: "var(--primary-light)", padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>{h.t}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--fg2)" }}>{h.num}</span>
              {h.tone === "accent" && <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-light)", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>CONFLICT</span>}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 5 }}>{h.title}</div>
            <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 2 }}>{h.room}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 200, height: 380, background: "#fff", border: "1px solid var(--border)", borderRadius: 28, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)", padding: 16, transform: "rotate(-4deg)", overflow: "hidden" }}>
        <div style={{ height: 24, display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--fg2)", fontWeight: 600 }}>
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.12em", marginTop: 10 }}>NEXT HEARING</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: "var(--primary-dark)", lineHeight: 1, marginTop: 6, letterSpacing: "-0.02em" }}>09:30</div>
        <div style={{ fontSize: 10.5, color: "var(--fg2)", marginTop: 4 }}>IN 48 MINUTES</div>
        <div style={{ marginTop: 14, padding: 10, background: "var(--primary-light)", borderRadius: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--primary-dark)" }}>W.P. 2076/2019</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>Redtone v CIR</div>
          <div style={{ fontSize: 10, color: "var(--fg3)", marginTop: 3 }}>Courtroom 4 · IHC</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: "var(--fg3)" }}>🕋 Zuhr 12:28</div>
        <div style={{ marginTop: 4, fontSize: 10, color: "var(--fg3)" }}>📂 Orders: 2 new</div>
      </div>
    </div>
  );
}

function MktMarquee() {
  const firms = ["Hassan & Co.", "Ijaz Advocates", "Malik Law Associates", "Noor Ahmad LLP", "Shaheen Legal", "K. Rahman Partners", "Qureshi Barristers", "Faisal Chambers"];
  return (
    <div style={{ padding: "36px 0", background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Used by 340+ firms</div>
        <div style={{ flex: 1, display: "flex", gap: 36, overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
          {firms.map((f, i) => (
            <span key={i} style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--fg2)", whiteSpace: "nowrap", opacity: 0.65 }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktProblem() {
  return (
    <div style={{ padding: "88px 32px", background: "var(--primary-dark)", color: "#fff" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 60, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#A2D9C5" }}>THE PROBLEM</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.08, margin: "14px 0 22px" }}>
              Your cause-list is on <span style={{ color: "#FFB28A", fontStyle: "italic" }}>WhatsApp</span>. Your roznamcha is a notebook.
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.82)", lineHeight: "28px", maxWidth: 520 }}>
              Every morning, someone in your office refreshes the IHC site, screenshots the cause-list, sends it to the group. When a date slips, you find out the next day. When a client calls at 11pm to ask "kya hua aaj?", you scroll a group chat to find out.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ["06:42", "Junior sends today's IHC list in WA", "Manual screenshot — 18 cases"],
              ["09:15", "Court re-listed W.P. 481 to 22 Apr", "No notification — you're still prepping for today"],
              ["11:30", "Client asks about order from Monday", "Someone has to find the image in the group"],
              ["14:20", "Conflict: two matters at same hour", "Nobody caught it"],
              ["20:05", "Log hours — memory only", "Some billable time is lost"],
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 16px", background: "rgba(255,255,255,0.06)", borderRadius: 10, alignItems: "flex-start", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#FFB28A", width: 48, flex: "none", paddingTop: 2 }}>{row[0]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{row[1]}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{row[2]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MktHowItWorks() {
  const steps = [
    { n: "01", t: "Sync the courts you work at", body: "Pick from IHC, LHC, SHC, PHC, BHC, Supreme Court, and every district court you visit. We pull cause-lists every 15 minutes during court hours.", icon: "landmark" },
    { n: "02", t: "Your cases appear overnight", body: "Wakeel matches cause-list entries to your client list — including AOR numbers, party names, and case numbers. First sync typically finds 80-90% of active matters.", icon: "folder-sync" },
    { n: "03", t: "Every morning, you know the day", body: "A single screen — mobile or web — shows today's hearings, flagged conflicts, and any date changes from yesterday. Hours tracked in the background.", icon: "sunrise" },
    { n: "04", t: "Clients get a read-only link", body: "After each hearing, send a portal link by SMS. Your client sees the next date, a 3-line note, and the order image. No accounts, no install.", icon: "link" },
  ];
  return (
    <div style={{ padding: "88px 32px", background: "var(--background)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 60px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)" }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 14px" }}>Set it up in an afternoon. Run the firm from it forever.</h2>
          <p style={{ fontSize: 16, color: "var(--fg2)", lineHeight: "25px" }}>Onboarding is handled by a Wakeel engineer, in-person in Islamabad, Lahore, and Karachi. Outside those cities — remote.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 20, padding: 28, display: "flex", gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <i data-lucide={s.icon} style={{ width: 22, height: 22, color: "var(--primary-dark)" }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.1em" }}>STEP {s.n}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em" }}>{s.t}</div>
                <div style={{ fontSize: 14, color: "var(--fg2)", lineHeight: "22px", marginTop: 8 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktCourtCoverage() {
  const courts = [
    { name: "Supreme Court of Pakistan", sub: "Islamabad", live: true, loc: "N", cases: "1,240 active" },
    { name: "Islamabad High Court (IHC)", sub: "F-8", live: true, loc: "N", cases: "3,120 active" },
    { name: "Lahore High Court (LHC)", sub: "Lahore + 3 benches", live: true, loc: "C", cases: "4,680 active" },
    { name: "Sindh High Court (SHC)", sub: "Karachi + 2 benches", live: false, loc: "S", cases: "Q2 2026" },
    { name: "Peshawar High Court (PHC)", sub: "Peshawar + 2 benches", live: false, loc: "N", cases: "Q2 2026" },
    { name: "Balochistan High Court (BHC)", sub: "Quetta", live: false, loc: "SW", cases: "Q3 2026" },
    { name: "Islamabad District Court", sub: "All 40 ADJs + civil judges", live: true, loc: "N", cases: "live" },
    { name: "Rawalpindi District Court", sub: "All civil + sessions", live: true, loc: "N", cases: "live" },
    { name: "Lahore District Court", sub: "Rotating benches", live: false, loc: "C", cases: "May 2026" },
  ];
  return (
    <div style={{ padding: "88px 32px", background: "#fff", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 60, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)" }}>COURT COVERAGE</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 18px" }}>We ingest the courts. You argue the cases.</h2>
            <p style={{ fontSize: 15.5, color: "var(--fg2)", lineHeight: "25px" }}>
              Wakeel pulls directly from each court's public cause-list. Where courts publish PDFs, we OCR them. Where they publish JSON, we use it. You never see the mess.
            </p>
            <div style={{ marginTop: 22, padding: 18, background: "var(--primary-light)", borderRadius: 14, border: "1px solid rgba(15,110,86,0.15)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--primary-dark)", letterSpacing: "0.1em" }}>COVERAGE NUMBERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 12 }}>
                {[["3", "Live benches"], ["87%", "Of active PK cases"], ["15m", "Sync interval"]].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--primary-dark)", letterSpacing: "-0.02em", lineHeight: 1 }}>{v}</div>
                    <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 4, fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {courts.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, background: c.live ? "var(--primary-light)" : "#F4EEE0", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <i data-lucide="landmark" style={{ width: 15, height: 15, color: c.live ? "var(--primary-dark)" : "#7A5B18" }}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 2 }}>{c.sub}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg2)", fontFamily: "var(--font-mono)", minWidth: 80, textAlign: "right" }}>{c.cases}</div>
                {c.live
                  ? <span style={{ background: "#E1F5EE", color: "#08503F", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap" }}>● live</span>
                  : <span style={{ background: "#F4EEE0", color: "#7A5B18", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap" }}>roadmap</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MktDeviceShowcase() {
  return (
    <div style={{ padding: "100px 32px", background: "var(--background)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)" }}>ON YOUR PHONE · ON YOUR DESK</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 46, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 14px" }}>The court-prep runs on the bench. The admin lives at the desk.</h2>
        <p style={{ fontSize: 16, color: "var(--fg2)", maxWidth: 640, margin: "0 auto 56px", lineHeight: "25px" }}>
          Partners and senior advocates use the mobile app in court. Office staff run billing, clients, and conflict-checks on the dashboard.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24, alignItems: "center" }}>
          <div style={{ background: "linear-gradient(160deg, var(--primary) 0%, var(--primary-dark) 100%)", borderRadius: 24, padding: "40px 30px", color: "#fff", minHeight: 460, display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#A2D9C5", letterSpacing: "0.14em" }}>MOBILE · iOS + ANDROID</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, marginTop: 10, lineHeight: 1.2, letterSpacing: "-0.01em" }}>For the courtroom.</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 10, lineHeight: "20px" }}>Today's hearings at a glance, quick time log, camera-to-roznamcha OCR, voice-note to case file, client SMS in two taps.</div>
            <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {[["gavel", "Today's 3 hearings"], ["camera", "Snap court order → filed"], ["mic", "Voice note to case"], ["send", "SMS client update"]].map(([ic, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.08)", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
                  <i data-lucide={ic} style={{ width: 14, height: 14 }}></i> {t}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: 24, padding: 40, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)", textAlign: "left", minHeight: 460 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.14em" }}>WEB DASHBOARD</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, marginTop: 10, lineHeight: 1.2, letterSpacing: "-0.01em" }}>For the daftar.</div>
            <div style={{ fontSize: 13.5, color: "var(--fg2)", marginTop: 10, lineHeight: "21px" }}>Full roster of matters, week calendar across the firm, conflict-checks, invoicing, client list, team permissions, and analytics.</div>
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {[["folder", "54 matters"], ["calendar", "Week view"], ["clock", "Time + invoices"], ["users", "Clients"], ["bar-chart-3", "Reports"], ["shield", "Roles"]].map(([ic, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: "var(--background)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12.5, color: "var(--fg1)", fontWeight: 600 }}>
                  <i data-lucide={ic} style={{ width: 13, height: 13, color: "var(--primary)" }}></i> {t}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 26, padding: 14, background: "var(--primary-light)", borderRadius: 10, fontSize: 12.5, color: "var(--primary-dark)", display: "flex", alignItems: "center", gap: 10 }}>
              <i data-lucide="users" style={{ width: 14, height: 14 }}></i>
              <span><strong>Seat-based pricing.</strong> Partner, associate, admin tiers.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MktSecurity() {
  return (
    <div style={{ padding: "88px 32px", background: "#fff", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 60, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)" }}>SECURITY &amp; DATA</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 18px" }}>Your case data never leaves Pakistan.</h2>
          <p style={{ fontSize: 15.5, color: "var(--fg2)", lineHeight: "25px" }}>
            Hosted on two Pakistan data-centres — Lahore and Karachi — with hourly replication. Authored by Pakistani lawyers and engineers. Privileged-communication storage is segregated at the database level and audited by a PBC-registered auditor.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {[
            ["server", "PK-hosted", "Lahore + Karachi DCs · no export"],
            ["shield-check", "Privilege first", "Counsel-client data tier isolated at DB layer"],
            ["key-round", "E2E messaging", "Client chat is encrypted end-to-end"],
            ["scroll-text", "Bar Council ready", "Audit trail for every file view + edit"],
            ["users-round", "Seat-scoped", "Junior lawyers see only assigned matters"],
            ["database-backup", "Daily backup", "7 years of rolling retention by default"],
          ].map(([ic, t, desc]) => (
            <div key={t} style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <i data-lucide={ic} style={{ width: 18, height: 18, color: "var(--primary)" }}></i>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 10 }}>{t}</div>
              <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 4, lineHeight: "17px" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktPricing() {
  const tiers = [
    { name: "Chamber", who: "Sole practitioner", price: "Rs 4,500", per: "/lawyer · month", features: ["Up to 40 active matters", "1 high court + 3 district", "Mobile + web", "SMS client portal (50/mo)", "Email support"], cta: "Start 14-day trial", accent: false },
    { name: "Firm", who: "2–15 lawyers · most popular", price: "Rs 3,500", per: "/lawyer · month", features: ["Unlimited matters", "All PK courts we cover", "Mobile + web + API", "Unlimited SMS portal", "Team roles + permissions", "Dedicated WhatsApp channel"], cta: "Book a demo", accent: true },
    { name: "Chambers", who: "15+ lawyers, multi-city", price: "Let's talk", per: "Custom SLA", features: ["Everything in Firm", "SSO + audit log export", "On-site onboarding", "Dedicated success engineer", "Private deployment option"], cta: "Contact sales", accent: false },
  ];
  return (
    <div style={{ padding: "88px 32px", background: "var(--background)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)" }}>PRICING</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 10px" }}>Priced for a Pakistani firm.</h2>
          <p style={{ fontSize: 15, color: "var(--fg2)" }}>Billed monthly in PKR. No per-matter fees. No court-filing markups.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{
              background: t.accent ? "var(--primary-dark)" : "#fff",
              color: t.accent ? "#fff" : "var(--fg1)",
              border: t.accent ? "none" : "1px solid var(--border)",
              borderRadius: 18, padding: 28, position: "relative",
              boxShadow: t.accent ? "0 20px 40px -16px rgba(8,80,63,0.3)" : "none",
              transform: t.accent ? "translateY(-6px)" : "none",
            }}>
              {t.accent && <div style={{ position: "absolute", top: -12, left: 24, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 6, letterSpacing: "0.1em" }}>MOST POPULAR</div>}
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.name}</div>
              <div style={{ fontSize: 12.5, color: t.accent ? "#A2D9C5" : "var(--fg3)", marginTop: 4 }}>{t.who}</div>
              <div style={{ marginTop: 22, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>{t.price}</span>
              </div>
              <div style={{ fontSize: 12, color: t.accent ? "rgba(255,255,255,0.7)" : "var(--fg3)", marginTop: 2 }}>{t.per}</div>
              <div style={{ height: 1, background: t.accent ? "rgba(255,255,255,0.15)" : "var(--border)", margin: "20px 0" }}></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {t.features.map((f, fi) => (
                  <div key={fi} style={{ fontSize: 13, color: t.accent ? "rgba(255,255,255,0.88)" : "var(--fg2)", display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <i data-lucide="check" style={{ width: 13, height: 13, color: t.accent ? "#A2D9C5" : "var(--primary)", marginTop: 3, flex: "none" }}></i>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button style={{
                marginTop: 22, width: "100%",
                background: t.accent ? "#fff" : "var(--primary)",
                color: t.accent ? "var(--primary-dark)" : "#fff",
                border: 0, padding: "12px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>{t.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktTestimonials() {
  return (
    <div style={{ padding: "88px 32px", background: "#fff", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "var(--primary)", textAlign: "center" }}>WHAT LAWYERS SAY</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: "14px 0 48px", textAlign: "center" }}>Not another cloud CRM. A Pakistani daftar.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {[
            { quote: "The IHC cause-list every morning in my phone — this alone is worth it. Before, my junior used to send screenshots. Now he prepares files instead.", name: "Ayesha Khan", role: "Senior Advocate · Hassan & Co., Islamabad", init: "AK" },
            { quote: "The client portal has cut my WhatsApp traffic by half. Clients see the next date themselves — they don't call at midnight.", name: "Faisal Qureshi", role: "Partner · Qureshi Barristers, Lahore", init: "FQ" },
            { quote: "Conflict-check caught two matters on the same hour last week. Saved me a very awkward morning at LHC.", name: "Ijaz Ahmed", role: "Managing Partner · Ijaz Advocates", init: "IA" },
          ].map((t, i) => (
            <div key={i} style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 16, padding: 26 }}>
              <i data-lucide="quote" style={{ width: 22, height: 22, color: "var(--primary)", opacity: 0.4 }}></i>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 500, lineHeight: 1.5, color: "var(--fg1)", marginTop: 12, letterSpacing: "-0.005em" }}>"{t.quote}"</div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>{t.init}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 2 }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MktFinalCTA() {
  return (
    <div style={{ padding: "88px 32px", background: "linear-gradient(160deg, var(--primary) 0%, var(--primary-dark) 100%)", color: "#fff" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, margin: "0 0 20px" }}>Stop screenshotting the cause-list.</h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", lineHeight: "27px", maxWidth: 640, margin: "0 auto 30px" }}>
          20-minute demo with a Wakeel engineer — in your office if you're in Islamabad, on Zoom otherwise. We'll set up your first court sync on the call.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{ background: "#fff", color: "var(--primary-dark)", border: 0, padding: "16px 24px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Book a demo →</button>
          <button style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", padding: "16px 24px", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Call +92 51 XXX XXXX</button>
        </div>
        <div style={{ marginTop: 28, fontSize: 12.5, color: "rgba(255,255,255,0.6)", display: "flex", justifyContent: "center", gap: 22 }}>
          <span>· 14 days free</span>
          <span>· No card required</span>
          <span>· On-site setup in ISB, LHR, KHI</span>
        </div>
      </div>
    </div>
  );
}

function MktFooter() {
  return (
    <div style={{ padding: "60px 32px 30px", background: "#fff", borderTop: "1px solid var(--border)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr repeat(4, 1fr)", gap: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="../assets/wakeel-mark.svg" style={{ width: 30, height: 30 }}/>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--primary-dark)" }}>Wakeel</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg2)", marginTop: 14, lineHeight: "19px", maxWidth: 280 }}>
              A daftar for Pakistani lawyers. Made by lawyers and engineers in Islamabad.
            </div>
            <div style={{ fontSize: 11.5, color: "var(--fg3)", marginTop: 16, fontFamily: "var(--font-mono)" }}>
              © 2026 Wakeel Technologies (Pvt) Ltd<br/>
              1st Floor, Plot 22, F-8/3, Islamabad
            </div>
          </div>
          {[
            ["Product", ["Mobile app", "Web dashboard", "Client portal", "API", "Changelog"]],
            ["Courts", ["Supreme Court", "IHC", "LHC", "SHC · Q2", "District courts"]],
            ["Firm", ["About", "Careers", "Press", "Contact", "Security"]],
            ["Legal", ["Privacy", "Terms", "PBC compliance", "Data residency", "Complaints"]],
          ].map(([h, links]) => (
            <div key={h}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg1)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                {links.map(l => <span key={l} style={{ fontSize: 12.5, color: "var(--fg2)" }}>{l}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 44, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--fg3)" }}>
          <div>Made in Pakistan 🇵🇰 · Serving IHC since January 2026</div>
          <div style={{ display: "flex", gap: 16 }}>
            <span>English</span>
            <span>اردو</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MktLanding });
