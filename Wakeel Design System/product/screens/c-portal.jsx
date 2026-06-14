/* global React */
// Client portal (Phase 4) — web-scale, ~820px content, white-on-cream.
// Three screens: CPortalHome (all my matters), CPortalChat (thread w/ counsel), CPortalDocViewer (single doc).

function CPortalShell({ children, label = "Ahmed Zubair", linkLabel = "Read-only link" }) {
  return (
    <div style={{ background: "var(--background)", minHeight: "100%", fontFamily: "var(--font-sans)", color: "var(--fg1)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 28px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, flexWrap: "nowrap" }}>
          <img src="../assets/wakeel-mark.svg" style={{ width: 34, height: 34, flex: "none" }}/>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--primary-dark)", letterSpacing: "-0.01em", flex: "none" }}>Wakeel</div>
          <div style={{ marginLeft: 16, fontSize: 12, color: "var(--fg3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1 }}>
            Shared by <strong style={{ color: "var(--fg2)" }}>Ahmed Hassan</strong> for <strong style={{ color: "var(--fg2)" }}>{label}</strong>
          </div>
          <span style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 9999, padding: "4px 11px", fontSize: 11, fontWeight: 600, color: "var(--fg2)", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flex: "none" }}>
            <i data-lucide="lock" style={{ width: 11, height: 11 }}></i> {linkLabel}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function CPortalHome() {
  const matters = [
    { num: "W.P. 2076/2019", title: "Redtone Telecom Pak v CIR", court: "Islamabad High Court", stage: "Arguments · reserved", next: { d: "14", m: "MAY", w: "Thu", desc: "Order pronouncement · 09:30 AM" }, status: "live", updates: 2 },
    { num: "Arb. 88/2024", title: "Redtone v Telenor Towers", court: "Islamabad Arbitration Centre", stage: "Preliminary", next: { d: "02", m: "MAY", w: "Fri", desc: "First meeting · 11:00 AM" }, status: "live", updates: 0 },
    { num: "Suit 312/2022", title: "Employment claim · R. Shah", court: "Islamabad District Court", stage: "Evidence", next: null, status: "mute", updates: 0 },
  ];
  return (
    <CPortalShell>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase" }}>YOUR MATTERS · HASSAN &amp; CO.</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, letterSpacing: "-0.015em", margin: "8px 0 14px", lineHeight: 1.25 }}>3 matters. 2 active. 1 upcoming date this month.</h1>
      <div style={{ fontSize: 14, color: "var(--fg2)", lineHeight: "21px", maxWidth: 620 }}>
        This portal shows everything your counsel has shared with you. You can view hearings, read notes, download orders, and send a message about any matter. It updates automatically when the court record changes.
      </div>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
        {matters.map((m, i) => (
          <div key={i} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 18, padding: 22, boxShadow: "var(--shadow-card)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--fg1)", background: "var(--background)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{m.num}</span>
                  {m.updates > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "var(--accent)", padding: "3px 8px", borderRadius: 6, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{m.updates} new</span>}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 8, color: "var(--fg1)" }}>{m.title}</div>
                <div style={{ fontSize: 13, color: "var(--fg2)", marginTop: 4 }}>{m.court} · {m.stage}</div>
              </div>
            </div>

            {m.next ? (
              <div style={{ marginTop: 16, background: "var(--primary-light)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ flex: "none", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: "var(--primary-dark)", lineHeight: 1, letterSpacing: "-0.02em" }}>{m.next.d}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary-dark)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3, whiteSpace: "nowrap" }}>{m.next.m} · {m.next.w}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary-dark)", letterSpacing: "0.1em" }}>NEXT DATE</div>
                  <div style={{ fontSize: 14, color: "var(--fg1)", fontWeight: 600, marginTop: 3 }}>{m.next.desc}</div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--fg3)", background: "#FBFAF7", border: "1px dashed var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <i data-lucide="clock" style={{ width: 12, height: 12, verticalAlign: "-1px", marginRight: 6 }}></i>
                No date scheduled yet. You'll be notified when one is listed.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14, fontSize: 12.5, fontWeight: 600, flexWrap: "wrap" }}>
              <span style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <i data-lucide="file-text" style={{ width: 13, height: 13 }}></i> View case record
              </span>
              <span style={{ color: "var(--fg3)" }}>·</span>
              <span style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <i data-lucide="message-circle" style={{ width: 13, height: 13 }}></i> Message counsel
              </span>
              <span style={{ color: "var(--fg3)" }}>·</span>
              <span style={{ color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <i data-lucide="download" style={{ width: 13, height: 13 }}></i> Download orders
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 20, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 9999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>AH</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Ahmed Hassan, Advocate</div>
          <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 2 }}>Managing partner · Hassan &amp; Co. · Islamabad</div>
          <div style={{ fontSize: 12, color: "var(--fg3)", marginTop: 8, fontFamily: "var(--font-mono)" }}>+92 300 111 2233 · ahmed@hassanco.pk</div>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 11.5, color: "var(--fg3)", lineHeight: "18px", textAlign: "center" }}>
        This portal is a read-only view shared by your counsel. Link expires <strong style={{ color: "var(--fg2)" }}>12 May 2026</strong>.
      </div>
    </CPortalShell>
  );
}

function CPortalChat() {
  const msgs = [
    { from: "lawyer", name: "Ahmed Hassan", time: "14 Apr · 10:12", body: "Assalam-o-Alaikum. We've been assigned a date — 18 April at IHC. I'll represent you; you don't need to attend unless the judge directs otherwise." },
    { from: "client", time: "14 Apr · 10:31", body: "Walaikum-assalam. Thank you. Should I send anything before then?" },
    { from: "lawyer", name: "Ahmed Hassan", time: "14 Apr · 10:40", body: "No, we've already filed the written submissions. I'll update you after the hearing." },
    { from: "system", time: "18 Apr · 11:18", body: "Hearing attended. Order reserved. Next date: 14 May 2026." },
    { from: "lawyer", name: "Ahmed Hassan", time: "18 Apr · 11:42", body: "Arguments concluded today. Bench has reserved the order; next date 14 May. I've uploaded the roznamcha image to your portal — take a look when you have a moment.", attach: { name: "order-18-apr-2026.jpg", meta: "2.1 MB · OCR ready", thumb: "../assets/hearing-order-sample.png" } },
    { from: "client", time: "18 Apr · 12:05", body: "Received. Does the reserved order mean the judgement is final?" },
    { from: "lawyer", name: "Ahmed Hassan", time: "18 Apr · 14:18", body: "Not yet — 'reserved' means the bench has heard us and will pronounce the decision later. 14 May is when the written order is announced. I'll attend and send you the result the same day." },
  ];
  return (
    <CPortalShell linkLabel="Message your counsel">
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.12em", textTransform: "uppercase" }}>CONVERSATION · W.P. 2076/2019</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.015em", margin: "8px 0 6px" }}>Redtone Telecom v CIR</h1>
      <div style={{ fontSize: 13, color: "var(--fg2)" }}>With Ahmed Hassan · replies usually within 4 hours on business days</div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        {msgs.map((m, i) => {
          if (m.from === "system") {
            return (
              <div key={i} style={{ alignSelf: "center", background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 9999, padding: "6px 14px", fontSize: 11.5, color: "var(--fg2)", fontWeight: 600, whiteSpace: "nowrap" }}>
                <i data-lucide="gavel" style={{ width: 12, height: 12, verticalAlign: "-2px", marginRight: 6 }}></i>{m.body}
                <span style={{ marginLeft: 10, color: "var(--fg3)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>{m.time}</span>
              </div>
            );
          }
          const isLawyer = m.from === "lawyer";
          return (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: isLawyer ? "row" : "row-reverse" }}>
              {isLawyer && (
                <div style={{ width: 34, height: 34, borderRadius: 9999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none" }}>AH</div>
              )}
              <div style={{ maxWidth: "68%" }}>
                <div style={{ fontSize: 10.5, color: "var(--fg3)", marginBottom: 4, fontWeight: 600, textAlign: isLawyer ? "left" : "right" }}>
                  {isLawyer && m.name + " · "}<span style={{ fontFamily: "var(--font-mono)" }}>{m.time}</span>
                </div>
                <div style={{
                  background: isLawyer ? "#fff" : "var(--primary)",
                  color: isLawyer ? "var(--fg1)" : "#fff",
                  padding: "12px 16px",
                  borderRadius: isLawyer ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
                  border: isLawyer ? "1px solid var(--border)" : "none",
                  fontSize: 13.5,
                  lineHeight: "20px",
                  boxShadow: isLawyer ? "var(--shadow-card)" : "none",
                }}>
                  {m.body}
                  {m.attach && (
                    <div style={{ marginTop: 10, display: "flex", gap: 10, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: 10, alignItems: "center" }}>
                      <div style={{ width: 42, height: 54, borderRadius: 5, overflow: "hidden", flex: "none", background: "#EFEDE8" }}>
                        <img src={m.attach.thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.attach.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{m.attach.meta}</div>
                      </div>
                      <i data-lucide="download" style={{ width: 16, height: 16, color: "var(--primary)", marginLeft: "auto" }}></i>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 14, boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 13, color: "var(--fg3)", minHeight: 42 }}>Reply to Ahmed…</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 12, color: "var(--fg3)" }}>
            <i data-lucide="paperclip" style={{ width: 15, height: 15 }}></i>
            <i data-lucide="image" style={{ width: 15, height: 15 }}></i>
            <i data-lucide="languages" style={{ width: 15, height: 15 }}></i>
          </div>
          <button style={{ background: "var(--primary)", color: "#fff", border: 0, borderRadius: 9, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Send</button>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11.5, color: "var(--fg3)", lineHeight: "18px", textAlign: "center" }}>
        Messages are encrypted and retained with your case file. Court hearings post here automatically.
      </div>
    </CPortalShell>
  );
}

function CPortalDocViewer() {
  return (
    <CPortalShell linkLabel="Document · read-only">
      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--fg3)", marginBottom: 8, alignItems: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <i data-lucide="chevron-left" style={{ width: 13, height: 13 }}></i> Back to case
        </span>
        <span>·</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>W.P. 2076/2019</span>
        <span>·</span>
        <span>Redtone Telecom v CIR</span>
      </div>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.015em", margin: "6px 0 4px" }}>order-18-apr-2026.jpg</h1>
      <div style={{ fontSize: 12.5, color: "var(--fg2)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>2.1 MB</span><span>·</span>
        <span>Uploaded 18 Apr, 2026 by Ahmed Hassan</span><span>·</span>
        <span style={{ background: "#E1F5EE", color: "#085041", fontWeight: 700, padding: "2px 8px", borderRadius: 5, fontSize: 11, whiteSpace: "nowrap" }}>OCR complete · EN + UR</span>
      </div>

      <div style={{ marginTop: 22, background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 12, boxShadow: "var(--shadow-card)" }}>
        <div style={{ background: "#F4EFE4", borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--fg2)", whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--fg1)" }}>1 / 1</span>
            <span>·</span>
            <span>Page 1 of 1</span>
          </div>
          <div style={{ display: "flex", gap: 12, color: "var(--fg2)" }}>
            <i data-lucide="zoom-out" style={{ width: 15, height: 15 }}></i>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>100%</span>
            <i data-lucide="zoom-in" style={{ width: 15, height: 15 }}></i>
            <span style={{ width: 1, background: "var(--border)" }}></span>
            <i data-lucide="rotate-cw" style={{ width: 15, height: 15 }}></i>
            <i data-lucide="download" style={{ width: 15, height: 15, color: "var(--primary)" }}></i>
          </div>
        </div>
        <div style={{ padding: 16, display: "flex", justifyContent: "center", background: "#FBFAF7", marginTop: 8, borderRadius: 8 }}>
          <div style={{ width: 460, background: "#fff", border: "1px solid var(--border)", boxShadow: "0 4px 18px rgba(0,0,0,0.08)", aspectRatio: "8.5 / 11", overflow: "hidden" }}>
            <img src="../assets/hearing-order-sample.png" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 22, background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <i data-lucide="sparkles" style={{ width: 15, height: 15, color: "var(--primary)" }}></i>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Summary — prepared by Wakeel</div>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>verified by A. Hassan</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--fg2)", lineHeight: "21px", marginTop: 10 }}>
          The Hon'ble bench has heard arguments on the main writ petition. Order has been <strong style={{ color: "var(--fg1)" }}>reserved</strong> and case is adjourned to <strong style={{ color: "var(--fg1)" }}>14 May 2026</strong> for pronouncement. No further pleadings are required. Both parties are directed to be present or represented on the next date.
        </div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[["Outcome", "Arguments heard"], ["Next step", "Order pronouncement"], ["Action required", "None"]].map(([k, v]) => (
            <div key={k} style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--fg3)", letterSpacing: "0.1em" }}>{k.toUpperCase()}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg1)", marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22, background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", fontSize: 12.5, color: "var(--fg2)", lineHeight: "19px" }}>
        <strong style={{ color: "var(--fg1)" }}>Transcript (Urdu, extracted):</strong> عدالت نے فریقین کے دلائل سننے کے بعد فیصلہ محفوظ رکھ لیا ہے۔ اگلی تاریخ <span style={{ fontFamily: "var(--font-mono)" }}>14 مئی 2026</span> مقرر کی گئی ہے۔
      </div>
    </CPortalShell>
  );
}

Object.assign(window, { CPortalHome, CPortalChat, CPortalDocViewer });
