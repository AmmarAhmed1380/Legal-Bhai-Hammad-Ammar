/* global React */
// Mobile: Alerts, Document vault, Time tracking, Chat list, Settings.

function MAlerts({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const groups = [
    { day: "Today", items: [
      { icon: "alert-triangle", tone: "conflict", title: "Scheduling conflict", body: "You have 2 hearings at 11:00 on Tuesday — W.P. 481/2024 (IHC) and FIR 298/2024 (ISB-DC).", time: "9:12 AM" },
      { icon: "refresh-cw", tone: "live", title: "IHC cause-list updated", body: "3 new rows matched to your cases. Tap to review.", time: "9:12 AM" },
      { icon: "message-square", tone: "info", title: "Ahmed Zubair replied", body: "\"Thank you. Do I need to attend?\"", time: "10:40 AM" },
    ] },
    { day: "Yesterday", items: [
      { icon: "file-text", tone: "live", title: "Order uploaded", body: "W.P. 2076/2019 · OCR extracted reserved-for-order + next date 14 May.", time: "5:04 PM" },
      { icon: "user-plus", tone: "info", title: "Ayesha accepted invite", body: "Your junior is now part of the firm.", time: "2:22 PM" },
    ] },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)" }}>Alerts</div>
        <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>Mark all read</div>
      </div>
      <div style={{ padding: "0 22px 10px", display: "flex", gap: 6 }}>
        <PChip active size="sm">All · 8</PChip>
        <PChip size="sm">Conflicts · 1</PChip>
        <PChip size="sm">Court · 3</PChip>
        <PChip size="sm">Clients · 2</PChip>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 22px 90px" }}>
        {groups.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.12em", padding: "8px 2px 8px" }}>{g.day}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.items.map((a, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", gap: 11 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9999, background: pTones[a.tone].bg, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <i data-lucide={a.icon} style={{ width: 15, height: 15, color: pTones[a.tone].fg }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)" }}>{a.title}</div>
                      <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{a.time}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 3, lineHeight: "17px" }}>{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PMTabBar active="more" platform={platform}/>
    </div>
  );
}

function MVault({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const docs = [
    { name: "order-18-apr-2026.jpg", case: "W.P. 2076/2019", tag: "order", date: "18 Apr", size: "2.1 MB", icon: "image" },
    { name: "petition-final.pdf", case: "W.P. 2076/2019", tag: "petition", date: "12 Jun 2019", size: "1.4 MB", icon: "file-text" },
    { name: "rejoinder-hafeez.pdf", case: "W.P. 481/2024", tag: "rejoinder", date: "14 Apr", size: "680 KB", icon: "file-text" },
    { name: "vakalat-redtone.pdf", case: "W.P. 2076/2019", tag: "vakalat", date: "Sep 2019", size: "220 KB", icon: "file-text" },
    { name: "evidence-photos.zip", case: "FIR 442/2024", tag: "evidence", date: "2 Apr", size: "12 MB", icon: "image" },
    { name: "hearing-notes.pdf", case: "W.P. 481/2024", tag: "notes", date: "7 Apr", size: "140 KB", icon: "file-text" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)" }}>Vault</div>
        <div style={{ display: "flex", gap: 10 }}>
          <i data-lucide="search" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
          <i data-lucide="upload" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
        </div>
      </div>
      <div style={{ padding: "0 22px 8px", display: "flex", gap: 6, overflowX: "auto" }}>
        <PChip active size="sm">All · 84</PChip>
        <PChip size="sm">Orders</PChip>
        <PChip size="sm">Petitions</PChip>
        <PChip size="sm">Evidence</PChip>
        <PChip size="sm">Vakalat</PChip>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 22px 90px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {docs.map((d, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 11, display: "flex", gap: 11, alignItems: "center" }}>
              <div style={{ width: 40, height: 48, borderRadius: 7, background: "#FBFAF7", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <i data-lucide={d.icon} style={{ width: 17, height: 17, color: "var(--fg3)" }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--fg2)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{d.case} · {d.size} · {d.date}</div>
              </div>
              <PPill tone="mute" size="sm">{d.tag}</PPill>
            </div>
          ))}
        </div>
      </div>
      <PMTabBar active="more" platform={platform}/>
    </div>
  );
}

function MTime({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const days = [
    { d: "Mon 20 Apr", items: [
      { case: "W.P. 481/2024", desc: "Reviewed respondent's reply", h: "1.25", b: true },
      { case: "Admin", desc: "Team standup", h: "0.5", b: false },
    ] },
    { d: "Sun 19 Apr", items: [
      { case: "W.P. 2076/2019", desc: "Drafting written arguments", h: "3.0", b: true },
    ] },
    { d: "Sat 18 Apr", items: [
      { case: "W.P. 2076/2019", desc: "Hearing attendance + post-hearing note", h: "2.5", b: true },
      { case: "FIR 442/2024", desc: "Witness prep call", h: "0.75", b: true },
    ] },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)" }}>Time</div>
        <i data-lucide="calendar" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
      </div>
      <div style={{ padding: "0 22px 10px" }}>
        <div style={{ background: "var(--primary-light)", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 9999, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <i data-lucide="play" style={{ width: 19, height: 19, color: "#fff" }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: "0.08em" }}>START TIMER</div>
            <div style={{ fontSize: 13, color: "var(--fg2)", marginTop: 2 }}>Pick a case to track billable time.</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 22px 10px", display: "flex", gap: 8 }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>THIS WEEK</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg1)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>12.5h</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>BILLABLE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--primary-dark)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>10.75h</div>
        </div>
        <div style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>RATE</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg1)", marginTop: 2, fontFamily: "var(--font-mono)" }}>Rs 15k/h</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "4px 22px 90px" }}>
        {days.map((day, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ padding: "6px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{day.d}</div>
              <div style={{ fontSize: 11, color: "var(--fg2)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{day.items.reduce((a, b) => a + parseFloat(b.h), 0)}h</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {day.items.map((e, j) => (
                <div key={j} style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", borderTop: j === 0 ? "none" : "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg1)" }}>{e.case}</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 2 }}>{e.desc}</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--fg1)" }}>{e.h}h</div>
                  {e.b && <PPill tone="live" size="sm">bill</PPill>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PMTabBar active="more" platform={platform}/>
    </div>
  );
}

function MChatList({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const convos = [
    { name: "Ahmed Zubair", case: "W.P. 2076/2019", last: "Thank you. Do I need to attend?", time: "10:40", unread: 0, initials: "AZ" },
    { name: "Hafeez Centre Traders", case: "W.P. 481/2024", last: "We'll send the affidavit by Friday.", time: "Yesterday", unread: 2, initials: "HC" },
    { name: "Ali Raza (brother)", case: "FIR 442/2024", last: "Salam, when is the next date?", time: "Yesterday", unread: 1, initials: "AR" },
    { name: "Faisal Textiles", case: "Suit 1108/2023", last: "Order sahib, agreed terms attached.", time: "Sun", unread: 0, initials: "FT" },
    { name: "Team · Hassan & Co.", case: "Firm", last: "Ayesha: I can cover the 11:15.", time: "Sun", unread: 0, initials: "H&", group: true },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)" }}>Chat</div>
        <i data-lucide="edit" style={{ width: 19, height: 19, color: "var(--fg2)" }}></i>
      </div>
      <div style={{ padding: "0 22px 10px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", display: "flex", gap: 8, alignItems: "center" }}>
          <i data-lucide="search" style={{ width: 14, height: 14, color: "var(--fg3)" }}></i>
          <div style={{ fontSize: 12.5, color: "var(--fg3)" }}>Search people, cases…</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 0 90px" }}>
        {convos.map((c, i) => (
          <div key={i} style={{ padding: "12px 22px", display: "flex", gap: 12, alignItems: "center", borderBottom: "1px solid var(--border)", background: "#fff" }}>
            <PAvatar initials={c.initials} size={42} tone={c.group ? "var(--accent)" : undefined}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>{c.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{c.time}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{c.case}</div>
              <div style={{ fontSize: 12.5, color: c.unread > 0 ? "var(--fg1)" : "var(--fg2)", fontWeight: c.unread > 0 ? 600 : 400, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</div>
            </div>
            {c.unread > 0 && <div style={{ width: 20, height: 20, borderRadius: 9999, background: "var(--primary)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.unread}</div>}
          </div>
        ))}
      </div>
      <PMTabBar active="chat" platform={platform}/>
    </div>
  );
}

function MSettings({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const sections = [
    { title: "ACCOUNT", items: [
      ["user", "Profile", "Ahmed Hassan · 03001234567"],
      ["briefcase", "Firm", "Hassan & Co. · Senior partner"],
      ["languages", "Language", "English · اردو toggle"],
    ]},
    { title: "PRACTICE", items: [
      ["landmark", "Courts synced", "IHC · LHC · SC"],
      ["bell", "Alerts & notifications", "Push + SMS"],
      ["calendar", "Calendar sync", "Google Calendar connected"],
      ["coins", "Billing rate", "Rs 15,000/hour"],
    ]},
    { title: "DEVICE", items: [
      ["shield", "Privacy & security", "Face ID, auto-lock 5m"],
      ["download", "Offline cases", "Pinned 6 of 54"],
      ["moon", "Appearance", "System"],
    ]},
    { title: "ABOUT", items: [
      ["help-circle", "Help & support", ""],
      ["file-text", "Terms & privacy", ""],
      ["log-out", "Sign out", ""],
    ]},
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "6px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--fg1)" }}>Settings</div>
      </div>
      <div style={{ padding: "0 22px 14px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <PAvatar initials="AH" size={48}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--fg1)" }}>Ahmed Hassan</div>
            <div style={{ fontSize: 11.5, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 3 }}>Hassan & Co. · BAR-2014-12345</div>
          </div>
          <i data-lucide="chevron-right" style={{ width: 18, height: 18, color: "var(--fg3)" }}></i>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 22px 90px" }}>
        {sections.map((sec, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            <div style={{ padding: "6px 4px", fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.12em" }}>{sec.title}</div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {sec.items.map(([icon, title, sub], i) => (
                <div key={i} style={{ padding: "12px 12px", display: "flex", gap: 11, alignItems: "center", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <i data-lucide={icon} style={{ width: 17, height: 17, color: "var(--fg2)" }}></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)" }}>{title}</div>
                    {sub && <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 2 }}>{sub}</div>}
                  </div>
                  <i data-lucide="chevron-right" style={{ width: 15, height: 15, color: "var(--fg3)" }}></i>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PMTabBar active="more" platform={platform}/>
    </div>
  );
}

Object.assign(window, { MAlerts, MVault, MTime, MChatList, MSettings });
