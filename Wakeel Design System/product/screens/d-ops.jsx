/* global React */
// Dashboard: Time & Invoicing, Clients, Search, Admin (team + settings), Reports.

function DTimeInvoicing() {
  const invoices = [
    { num: "INV-2026-014", client: "Redtone Telecom Pak", matter: "W.P. 2076/2019", amount: "Rs 187,500", issued: "15 Apr", due: "15 May", status: "sent" },
    { num: "INV-2026-013", client: "Hafeez Centre Traders", matter: "W.P. 481/2024", amount: "Rs 92,000", issued: "8 Apr", due: "8 May", status: "partial" },
    { num: "INV-2026-012", client: "Ali Raza", matter: "FIR 442/2024", amount: "Rs 45,000", issued: "2 Apr", due: "2 May", status: "paid" },
    { num: "INV-2026-011", client: "Zubair Enterprises", matter: "Suit 1108/2023", amount: "Rs 120,000", issued: "28 Mar", due: "28 Apr", status: "overdue" },
  ];
  const statusTone = { sent: "info", partial: "warn", paid: "live", overdue: "conflict" };
  return (
    <DShell active="time">
      <DSectionHead eyebrow="FINANCE" title="Time &amp; invoicing" subtitle="Logged hours across the firm, invoices, and collections."
        actions={<>
          <PGhost>Export</PGhost>
          <PBtn>+ New invoice</PBtn>
        </>}/>
      <div style={{ padding: "0 28px 16px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { l: "HOURS · WEEK", v: "168.5h", s: "124.25h billable" },
          { l: "OUTSTANDING", v: "Rs 2.8L", s: "8 invoices open" },
          { l: "COLLECTED · APR", v: "Rs 4.6L", s: "17 invoices paid" },
          { l: "OVERDUE", v: "Rs 1.2L", s: "3 invoices", tone: "accent" },
        ].map((s,i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.1em" }}>{s.l}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.tone === "accent" ? "var(--accent)" : "var(--fg1)", marginTop: 6, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: "var(--fg2)", marginTop: 4 }}>{s.s}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 28px 16px", display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Invoices</div>
            <div style={{ display: "flex", gap: 6 }}>
              <PChip active size="sm">All</PChip><PChip size="sm">Open</PChip><PChip size="sm">Overdue</PChip>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr 1.2fr 1fr 0.9fr 0.9fr", gap: 10, padding: "10px 16px", background: "#FBFAF7", fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.08em" }}>
            <span>INVOICE</span><span>CLIENT</span><span>MATTER</span><span>AMOUNT</span><span>DUE</span><span>STATUS</span>
          </div>
          {invoices.map((inv, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.6fr 1.2fr 1fr 0.9fr 0.9fr", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--fg1)" }}>{inv.num}</span>
              <span style={{ fontSize: 12.5, color: "var(--fg1)" }}>{inv.client}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg2)", fontFamily: "var(--font-mono)" }}>{inv.matter}</span>
              <span style={{ fontSize: 12.5, color: "var(--fg1)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{inv.amount}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg2)" }}>{inv.due}</span>
              <span><PPill tone={statusTone[inv.status]} size="sm">{inv.status}</PPill></span>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Hours by lawyer · this week</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[["Ahmed Hassan", 42, 36], ["Ayesha Khan", 38, 34], ["Hamza Sheikh", 31, 24], ["Sadia Malik", 18, 12]].map(([name, total, bill], i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4, gap: 8 }}>
                  <span style={{ color: "var(--fg1)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg2)", whiteSpace: "nowrap", flex: "none" }}>{bill}/{total}h</span>
                </div>
                <div style={{ height: 7, background: "var(--border)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (total/45*100) + "%", background: "rgba(15,110,86,0.25)" }}></div>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (bill/45*100) + "%", background: "var(--primary)" }}></div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--fg3)", marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--primary)" }}></span> billable</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(15,110,86,0.25)" }}></span> total</span>
          </div>
        </div>
      </div>
    </DShell>
  );
}

function DClients() {
  const clients = [
    { name: "Redtone Telecom Pak Pvt Ltd", type: "Company", matters: 3, contact: "Mr Asif Mahmood · CFO", phone: "03001112233", since: "Jun 2019", status: "active" },
    { name: "Hafeez Centre Traders Assoc.", type: "Association", matters: 2, contact: "Mr Javed Iqbal", phone: "03227654321", since: "Mar 2024", status: "active" },
    { name: "Ahmed Zubair", type: "Individual", matters: 1, contact: "Ahmed Zubair", phone: "03009876543", since: "Jul 2023", status: "active" },
    { name: "Ali Raza", type: "Individual", matters: 1, contact: "Brother — Faisal", phone: "03335544332", since: "Feb 2024", status: "active" },
    { name: "Karim & Sons", type: "Partnership", matters: 2, contact: "Mr Karim Sr.", phone: "03111223344", since: "Aug 2022", status: "active" },
    { name: "Shaheen Co-operative", type: "Society", matters: 1, contact: "Mr Tahir — Secretary", phone: "03028765432", since: "Jan 2024", status: "active" },
  ];
  return (
    <DShell active="clients">
      <DSectionHead eyebrow="CLIENTS · 36 TOTAL" title="Clients" subtitle="Companies, associations, and individuals represented by Hassan &amp; Co."
        actions={<><PGhost>Import contacts</PGhost><PBtn>+ Add client</PBtn></>}/>
      <div style={{ padding: "0 28px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.9fr 0.6fr 1.5fr 1fr 0.9fr", gap: 14, padding: "12px 18px", background: "#FBFAF7", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.08em" }}>
            <span>CLIENT</span><span>TYPE</span><span>MATTERS</span><span>CONTACT</span><span>PHONE</span><span>SINCE</span>
          </div>
          {clients.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2.4fr 0.9fr 0.6fr 1.5fr 1fr 0.9fr", gap: 14, padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
                <PAvatar initials={c.name.split(" ").slice(0,2).map(x => x[0]).join("")} size={32} tone={c.type === "Company" ? "var(--primary)" : c.type === "Individual" ? "var(--accent)" : "#6B5CB8"}/>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ fontSize: 10.5, color: "#10B981", fontWeight: 600, marginTop: 2 }}>● active</div>
                </div>
              </div>
              <PPill tone="mute" size="sm">{c.type}</PPill>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)", fontVariantNumeric: "tabular-nums" }}>{c.matters}</span>
              <span style={{ fontSize: 12, color: "var(--fg2)" }}>{c.contact}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg2)", fontFamily: "var(--font-mono)" }}>{c.phone}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg3)" }}>{c.since}</span>
            </div>
          ))}
        </div>
      </div>
    </DShell>
  );
}

function DSearch() {
  const groups = [
    { label: "CASES · 4", items: [
      { pri: "W.P. 2076/2019", sec: "Redtone Telecom v CIR", meta: "IHC · arguments" },
      { pri: "W.P. 481/2024", sec: "Hafeez Centre Traders v LDA", meta: "IHC · issues" },
      { pri: "Suit 1108/2023", sec: "Zubair v Faisal Textiles", meta: "RWP-DC · written statement" },
      { pri: "Crl.App. 55/2024", sec: "Noor v State", meta: "IHC · filing" },
    ]},
    { label: "HEARINGS · 2", items: [
      { pri: "18 Apr 2026", sec: "W.P. 2076/2019 · Arguments concluded, reserved for order", meta: "OCR extract" },
      { pri: "4 Mar 2026", sec: "W.P. 2076/2019 · Adjourned — counsel sought time", meta: "hearing log" },
    ]},
    { label: "CLIENTS · 1", items: [
      { pri: "Redtone Telecom Pak", sec: "3 active matters · since Jun 2019", meta: "Asif Mahmood" },
    ]},
    { label: "DOCUMENTS · 6", items: [
      { pri: "order-18-apr-2026.jpg", sec: "W.P. 2076/2019 · OCR completed", meta: "2.1 MB" },
      { pri: "petition-final.pdf", sec: "W.P. 2076/2019", meta: "1.4 MB" },
    ]},
  ];
  return (
    <DShell active="search">
      <div style={{ padding: "28px 28px 16px" }}>
        <div style={{ background: "#fff", border: "2px solid var(--primary)", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <i data-lucide="search" style={{ width: 18, height: 18, color: "var(--primary)" }}></i>
          <div style={{ flex: 1, fontSize: 16, color: "var(--fg1)", fontWeight: 500 }}>redtone</div>
          <span style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>13 results in 24ms</span>
          <span style={{ background: "var(--background)", padding: "3px 8px", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--fg2)" }}>ESC</span>
        </div>
      </div>
      <div style={{ padding: "0 28px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <PChip active size="sm">All · 13</PChip>
        <PChip size="sm">Cases · 4</PChip>
        <PChip size="sm">Hearings · 2</PChip>
        <PChip size="sm">Clients · 1</PChip>
        <PChip size="sm">Documents · 6</PChip>
      </div>
      <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div style={{ padding: "4px 2px 8px", fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.12em" }}>{g.label}</div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {g.items.map((it, i) => (
                <div key={i} style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--border)", display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)", fontFamily: g.label.startsWith("CASES") || g.label.startsWith("HEARINGS") ? "var(--font-mono)" : "var(--font-sans)" }}>{it.pri}</div>
                    <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 3 }}>
                      <span dangerouslySetInnerHTML={{ __html: it.sec.replace(/redtone/gi, "<mark style='background:#FAEEDA;color:#854F0B;padding:0 2px;border-radius:3px'>$&</mark>") }}></span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{it.meta}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DShell>
  );
}

function DTeamRoles() {
  const team = [
    { name: "Ahmed Hassan", role: "Managing partner", email: "ahmed@hassanco.pk", cases: 18, status: "active", perms: "Full admin" },
    { name: "Ayesha Khan", role: "Senior advocate", email: "ayesha@hassanco.pk", cases: 14, status: "active", perms: "Cases + clients" },
    { name: "Hamza Sheikh", role: "Junior advocate", email: "hamza@hassanco.pk", cases: 9, status: "active", perms: "Assigned cases only" },
    { name: "Sadia Malik", role: "Office admin", email: "sadia@hassanco.pk", cases: 0, status: "active", perms: "Calendar + invoices" },
    { name: "Omar Qureshi", role: "Intern", email: "omar@hassanco.pk", cases: 2, status: "pending", perms: "Read-only" },
  ];
  return (
    <DShell active="team">
      <DSectionHead eyebrow="ADMIN · HASSAN & CO." title="Team &amp; roles" subtitle="Who works here, what they can see, and what they own."
        actions={<><PGhost>Roles &amp; permissions</PGhost><PBtn>+ Invite lawyer</PBtn></>}/>
      <div style={{ padding: "0 28px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.5fr 0.6fr 1.3fr 0.7fr", gap: 14, padding: "12px 18px", background: "#FBFAF7", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.08em" }}>
            <span>NAME</span><span>ROLE</span><span>EMAIL</span><span>CASES</span><span>PERMISSIONS</span><span>STATUS</span>
          </div>
          {team.map((m, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.5fr 0.6fr 1.3fr 0.7fr", gap: 14, padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}>
                <PAvatar initials={m.name.split(" ").map(x => x[0]).join("")} size={32}/>
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg1)", whiteSpace: "nowrap" }}>{m.name}</span>
                  {i === 0 && <span style={{ fontSize: 9, color: "var(--primary)", fontWeight: 700, letterSpacing: "0.08em", background: "var(--primary-light)", padding: "2px 6px", borderRadius: 4 }}>YOU</span>}
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--fg1)" }}>{m.role}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg2)", fontFamily: "var(--font-mono)" }}>{m.email}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg1)", fontVariantNumeric: "tabular-nums" }}>{m.cases}</span>
              <span style={{ fontSize: 11.5, color: "var(--fg2)" }}>{m.perms}</span>
              <PPill tone={m.status === "active" ? "live" : "warn"} size="sm">{m.status}</PPill>
            </div>
          ))}
        </div>
      </div>
    </DShell>
  );
}

function DReports() {
  return (
    <DShell active="reports">
      <DSectionHead eyebrow="REPORTS" title="Firm analytics" subtitle="Caseload, revenue, and court activity across this quarter."
        actions={<><PChip size="sm">Last 90 days</PChip><PGhost>Export PDF</PGhost></>}/>
      <div style={{ padding: "0 28px 28px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Hearings by court · last 90 days</div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", gap: 14, height: 200 }}>
            {[["IHC", 48, 0.95], ["LHC", 32, 0.64], ["SC", 11, 0.22], ["ISB-DC", 21, 0.42], ["RWP-DC", 15, 0.30], ["SHC", 6, 0.12], ["PHC", 2, 0.04]].map(([label, val, pct], i) => (
              <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg2)", fontWeight: 700 }}>{val}</div>
                <div style={{ width: "100%", height: pct * 180, background: i === 0 ? "var(--primary)" : "var(--primary-light)", borderRadius: "6px 6px 0 0", border: i === 0 ? "none" : "1px solid rgba(15,110,86,0.2)" }}></div>
                <div style={{ fontSize: 10.5, color: "var(--fg3)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Stage distribution</div>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {[["filing", 6], ["notice", 8], ["written_statement", 11], ["issues", 9], ["evidence", 14], ["arguments", 4], ["reserved", 2]].map(([s, n]) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 110, fontSize: 11.5, color: "var(--fg2)" }}>{s.replace("_", " ")}</div>
                <div style={{ flex: 1, height: 14, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: (n / 14 * 100) + "%", height: "100%", background: pTones[s]?.fg || "var(--primary)" }}></div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--fg1)", width: 22, textAlign: "right" }}>{n}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Revenue · last 6 months</div>
          <div style={{ marginTop: 16, position: "relative", height: 150 }}>
            <svg viewBox="0 0 400 150" style={{ width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d="M 0 120 L 67 95 L 133 105 L 200 70 L 267 82 L 333 50 L 400 35 L 400 150 L 0 150 Z" fill="url(#rev)"/>
              <path d="M 0 120 L 67 95 L 133 105 L 200 70 L 267 82 L 333 50 L 400 35" stroke="var(--primary)" strokeWidth="2" fill="none"/>
              {[[0,120],[67,95],[133,105],[200,70],[267,82],[333,50],[400,35]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke="var(--primary)" strokeWidth="2"/>
              ))}
            </svg>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
            {["Nov","Dec","Jan","Feb","Mar","Apr"].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>Outcomes · this year</div>
          <div style={{ marginTop: 18, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["Decided · favourable", 9, "var(--primary)"], ["Decided · partial", 3, "#D97757"], ["Withdrawn", 2, "var(--fg3)"], ["Pending", 40, "var(--border)"]].map(([l, n, c], i) => (
              <div key={i} style={{ flex: 1, minWidth: 120 }}>
                <div style={{ height: 6, background: c, borderRadius: 3 }}></div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg1)", marginTop: 8 }}>{n}</div>
                <div style={{ fontSize: 10.5, color: "var(--fg3)", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DShell>
  );
}

Object.assign(window, { DTimeInvoicing, DClients, DSearch, DTeamRoles, DReports });
