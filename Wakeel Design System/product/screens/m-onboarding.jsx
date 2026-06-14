/* global React */
// Mobile: Firm signup / onboarding wizard. iOS + Android parity.
// 4 steps: language → firm info → verify phone → invite team.

function MFirmSignup({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "8px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <PEyebrow>STEP 1 · 4</PEyebrow>
        <PLangToggle lang="en" compact/>
      </div>
      <div style={{ padding: "12px 22px 0", display: "flex", gap: 4 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === 1 ? "var(--primary)" : "var(--border)" }}/>)}
      </div>
      <div style={{ padding: "24px 22px", flex: 1, overflow: "auto" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--fg1)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>Start your firm</div>
        <div style={{ fontSize: 14, color: "var(--fg2)", marginTop: 8, lineHeight: "20px" }}>
          Set up your daftar in 4 quick steps. You can invite your team once this is done.
        </div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <PField label="Firm name"><PInput defaultValue="Hassan &amp; Co. Law Associates"/></PField>
          <PField label="Primary office">
            <select style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13.5, background: "#fff" }}>
              <option>Islamabad</option><option>Rawalpindi</option><option>Lahore</option><option>Karachi</option><option>Peshawar</option><option>Quetta</option>
            </select>
          </PField>
          <PField label="Your role">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <PChip active size="sm">Senior partner</PChip>
              <PChip size="sm">Advocate</PChip>
              <PChip size="sm">Associate</PChip>
              <PChip size="sm">Junior</PChip>
              <PChip size="sm">Office admin</PChip>
            </div>
          </PField>
          <PField label="Bar enrollment #"><PInput placeholder="BAR-2014-12345" style={{ fontFamily: "var(--font-mono)" }}/></PField>
        </div>
      </div>
      <div style={{ padding: "16px 22px 26px", background: "#fff", borderTop: "1px solid var(--border)" }}>
        <PBtn full size="lg">Continue</PBtn>
      </div>
    </div>
  );
}

function MInviteTeam({ platform = "ios" }) {
  const StatusBar = platform === "android" ? PAndroidStatusBar : PStatusBar;
  const invites = [
    { name: "Ayesha Khan", phone: "03007654321", role: "Advocate", status: "sent" },
    { name: "Hamza Sheikh", phone: "03001112222", role: "Junior", status: "sent" },
    { name: "Sadia Malik", phone: "03339876543", role: "Office admin", status: "draft" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}>
      <StatusBar/>
      <div style={{ padding: "8px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <PEyebrow>STEP 4 · 4</PEyebrow>
        <PLangToggle lang="en" compact/>
      </div>
      <div style={{ padding: "12px 22px 0", display: "flex", gap: 4 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--primary)" }}/>)}
      </div>
      <div style={{ padding: "22px 22px 0" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg1)", letterSpacing: "-0.01em" }}>Invite your team</div>
        <div style={{ fontSize: 13.5, color: "var(--fg2)", marginTop: 6, lineHeight: "20px" }}>They'll get an SMS with a one-time link.</div>
      </div>
      <div style={{ padding: "18px 22px 14px", flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {invites.map((inv, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", gap: 12 }}>
            <PAvatar initials={inv.name.split(" ").map(x => x[0]).join("")} size={38}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg1)" }}>{inv.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>{inv.phone} · {inv.role}</div>
            </div>
            <PPill tone={inv.status === "sent" ? "live" : "mute"}>{inv.status}</PPill>
          </div>
        ))}
        <div style={{ border: "1.5px dashed var(--border)", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--primary)", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
          <i data-lucide="plus" style={{ width: 16, height: 16 }}></i> Add another
        </div>
      </div>
      <div style={{ padding: "14px 22px 26px", background: "#fff", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <PGhost>Skip for now</PGhost>
        <div style={{ flex: 1 }}><PBtn full>Send invites &amp; continue</PBtn></div>
      </div>
    </div>
  );
}

Object.assign(window, { MFirmSignup, MInviteTeam });
