/* global React */
const { useState } = React;

function CaseDetail({ record, onBack, onOpenUpload, onOpenSms }) {
  const hearings = [
    { date: "2026-04-18", outcome: "Order passed", notes: "Matter taken up, adjourned for arguments.", ocr: "completed", next: "2026-05-14" },
    { date: "2026-03-04", outcome: "Hearing adjourned", notes: "Counsel for respondent sought time.", ocr: "pending_config", next: "2026-04-18" },
  ];

  return (
    <div style={{ padding: "4px 20px 100px", overflow: "auto", height: "100%" }}>
      <div onClick={onBack} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        <i data-lucide="arrow-left" style={{ width: 14, height: 14 }}></i> Back
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--fg1)" }}>{record.num}</div>
      <div style={{ fontSize: 14, color: "var(--fg2)", lineHeight: "20px", marginTop: 4, marginBottom: 14 }}>{record.title}</div>

      {/* Info grid */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, backgroundColor: "var(--border)", marginBottom: 14 }}>
        {[
          ["COURT", "Islamabad High Court"],
          ["STAGE", "arguments"],
          ["NEXT DATE", "14 May 2026", true],
          ["JUDGE", "Hon. Justice Farooq"],
          ["CLIENT", "Ahmed Zubair"],
          ["SOURCE", "IHC Live"],
        ].map(([label, value, accent]) => (
          <div key={label} style={{ background: "#fff", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg3)" }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: accent ? "var(--accent)" : "var(--fg1)", marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <PrimaryBtn onClick={onOpenUpload}>Add hearing log</PrimaryBtn>
        <SecondaryBtn onClick={onOpenSms}>SMS preview</SecondaryBtn>
      </div>

      {/* Timeline */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg1)", marginBottom: 12 }}>Recent hearings</div>
        <div style={{ position: "relative", paddingLeft: 24 }}>
          <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: "var(--border)" }}></div>
          {hearings.map((h, i) => (
            <div key={i} style={{ position: "relative", marginBottom: 14 }}>
              <div style={{ position: "absolute", left: -24, top: 4, width: 10, height: 10, borderRadius: 9999, background: i === 0 ? "var(--primary)" : "var(--fg3)", boxShadow: "0 0 0 3px #fff" }}></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg2)" }}>{h.date}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg1)", marginTop: 2 }}>{h.outcome}</div>
              <div style={{ fontSize: 13, color: "var(--fg2)", lineHeight: "18px", marginTop: 2 }}>{h.notes}</div>
              <div style={{ fontSize: 10.5, color: "var(--fg3)", fontFamily: "var(--font-mono)", marginTop: 4 }}>OCR: {h.ocr} · Next {h.next}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.CaseDetail = CaseDetail;
