/* global React */
// Full case detail (mobile) — replaces the thinner ui_kits/mobile version.
// Tabs: Overview · Hearings · Documents · Time · Chat. Bilingual-aware.

function MCaseDetail({ platform = "ios", tab = "overview" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const record = { num: "W.P. 2076/2019", title: "Redtone Telecommunications Pak Pvt Ltd v CIR etc", court: "Islamabad High Court", stage: "arguments", next: "2026-05-14", client: "Ahmed Zubair", counsel: "Ahmed Hassan" };
  const tabs = ["overview", "hearings", "docs", "time", "chat"];
  const labels = { overview: "Overview", hearings: "Hearings", docs: "Docs", time: "Time", chat: "Chat" };
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 20px 8px", display: "flex", alignItems: "center", gap: 10 }}>
        <i data-lucide="arrow-left" style={{ width: 18, height: 18, color: "var(--fg2)" }}></i>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>Case</div>
        <i data-lucide="share-2" style={{ width: 18, height: 18, color: "var(--fg2)" }}></i>
      </div>
      <div style={{ padding: "6px 20px 14px", borderBottom: "1px solid var(--border)", background: "#fff" }}>
        <PCaseNum size={19}>{record.num}</PCaseNum>
        <div style={{ fontSize: 13, color: "var(--fg2)", marginTop: 4, lineHeight: "19px" }}>{record.title}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <PPill tone="arguments">arguments</PPill>
          <PPill tone="live">IHC Live</PPill>
          <span style={{ fontSize: 11.5, color: "var(--fg3)", alignSelf: "center" }}>Next <strong style={{ color: "var(--accent)" }}>14 May</strong></span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", background: "#fff", overflowX: "auto" }}>
        {tabs.map(t => (
          <div key={t} style={{ padding: "11px 14px", fontSize: 12.5, fontWeight: 700, color: t === tab ? "var(--primary)" : "var(--fg3)", borderBottom: `2px solid ${t === tab ? "var(--primary)" : "transparent"}`, whiteSpace: "nowrap" }}>{labels[t]}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {tab === "overview" && <MCaseOverview record={record}/>}
        {tab === "hearings" && <MCaseHearings/>}
        {tab === "docs" && <MCaseDocs/>}
        {tab === "time" && <MCaseTime/>}
        {tab === "chat" && <MCaseChat/>}
      </div>
    </div>
  );
}

function MCaseOverview({ record }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 12, columnGap: 12 }}>
        {[["COURT", record.court], ["JUDGE", "Hon. Justice Farooq"], ["CLIENT", record.client], ["COUNSEL", record.counsel], ["STAGE", "arguments"], ["FILED", "12 Jun 2019"]].map(([k,v]) => (
          <div key={k}><div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--fg3)" }}>{k}</div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)", marginTop: 2 }}>{v}</div></div>
        ))}
      </div>
      <div style={{ background: "var(--primary-light)", borderRadius: 14, padding: 14 }}>
        <PEyebrow>NEXT HEARING</PEyebrow>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--primary-dark)", marginTop: 4 }}>Thu 14 May · 09:30</div>
        <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 4 }}>Courtroom 4 · arguments</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <PBtn size="sm">+ Log hearing</PBtn>
        <PGhost size="sm">Add document</PGhost>
        <PGhost size="sm">Start timer</PGhost>
      </div>
    </div>
  );
}

function MCaseHearings() {
  const hearings = [
    { date: "2026-04-18", outcome: "Order passed", notes: "Arguments concluded. Reserved for order.", ocr: "completed", next: "2026-05-14" },
    { date: "2026-03-04", outcome: "Adjourned", notes: "Counsel for respondent sought time.", ocr: "pending_config", next: "2026-04-18" },
    { date: "2026-01-22", outcome: "Arguments heard", notes: "Petitioner's counsel argued main writ petition.", ocr: "completed", next: "2026-03-04" },
  ];
  return (
    <div style={{ position: "relative", paddingLeft: 22 }}>
      <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: "var(--border)" }}></div>
      {hearings.map((h,i) => (
        <div key={i} style={{ position: "relative", marginBottom: 18 }}>
          <div style={{ position: "absolute", left: -22, top: 4, width: 10, height: 10, borderRadius: 9999, background: i === 0 ? "var(--primary)" : "var(--fg3)", boxShadow: "0 0 0 3px var(--background)" }}></div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg2)", fontWeight: 600 }}>{h.date}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)", marginTop: 2 }}>{h.outcome}</div>
          <div style={{ fontSize: 12.5, color: "var(--fg2)", lineHeight: "17px", marginTop: 2 }}>{h.notes}</div>
          <div style={{ fontSize: 10.5, color: "var(--fg3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>OCR: {h.ocr} · Next {h.next}</div>
        </div>
      ))}
    </div>
  );
}

function MCaseDocs() {
  const docs = [
    { name: "order-18-apr-2026.jpg", meta: "2.1 MB · OCR done", tag: "order" },
    { name: "petition-final.pdf", meta: "1.4 MB · Filed", tag: "petition" },
    { name: "annex-a-contract.pdf", meta: "840 KB", tag: "annexure" },
    { name: "vakalatnama.pdf", meta: "220 KB", tag: "vakalat" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {docs.map((d,i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 44, borderRadius: 6, background: "#FBFAF7", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i data-lucide="file-text" style={{ width: 16, height: 16, color: "var(--fg3)" }}></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{d.meta}</div>
          </div>
          <PPill tone="mute" size="sm">{d.tag}</PPill>
        </div>
      ))}
      <div style={{ border: "1.5px dashed var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--primary)", fontWeight: 700, fontSize: 12 }}>
        <i data-lucide="upload" style={{ width: 14, height: 14 }}></i> Upload document
      </div>
    </div>
  );
}

function MCaseTime() {
  const entries = [
    { date: "18 Apr", desc: "Hearing attendance + post-hearing note", h: "2.5h", billable: true },
    { date: "17 Apr", desc: "Reviewed respondent's reply", h: "1.25h", billable: true },
    { date: "12 Apr", desc: "Client call — strategy", h: "0.5h", billable: false },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "var(--primary-light)", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <PEyebrow>WEEK</PEyebrow>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--primary-dark)", marginTop: 2 }}>4.25h billable</div>
        </div>
        <PBtn size="sm">▶ Start timer</PBtn>
      </div>
      {entries.map((e,i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 11, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg3)", width: 44, fontWeight: 600 }}>{e.date}</div>
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--fg1)" }}>{e.desc}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: "var(--fg1)" }}>{e.h}</div>
          {e.billable && <PPill tone="live" size="sm">bill</PPill>}
        </div>
      ))}
    </div>
  );
}

function MCaseChat() {
  const msgs = [
    { who: "client", text: "Sir, any update on today's hearing?", time: "10:18" },
    { who: "me", text: "Arguments concluded. Order reserved. Next date 14 May.", time: "10:32" },
    { who: "client", text: "Thank you. Do I need to attend?", time: "10:40" },
    { who: "me", text: "Not required for the 14 May date. I'll share the order once pronounced.", time: "10:45" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {msgs.map((m,i) => (
        <div key={i} style={{ display: "flex", justifyContent: m.who === "me" ? "flex-end" : "flex-start" }}>
          <div style={{ maxWidth: "78%", background: m.who === "me" ? "var(--primary)" : "#fff", color: m.who === "me" ? "#fff" : "var(--fg1)", border: m.who === "me" ? "none" : "1px solid var(--border)", borderRadius: 14, padding: "9px 12px", fontSize: 13, lineHeight: "18px" }}>
            {m.text}
            <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7 }}>{m.time}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 22, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <i data-lucide="paperclip" style={{ width: 16, height: 16, color: "var(--fg3)" }}></i>
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--fg3)" }}>Message Ahmed Zubair…</div>
        <div style={{ width: 28, height: 28, borderRadius: 9999, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i data-lucide="send" style={{ width: 13, height: 13, color: "#fff" }}></i>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MCaseDetail });
