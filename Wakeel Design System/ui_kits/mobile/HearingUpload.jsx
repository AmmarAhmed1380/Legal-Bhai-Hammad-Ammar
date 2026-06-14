/* global React */
const { useState } = React;

function HearingUpload({ record, onBack, onSaved }) {
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("2026-05-14");
  const [hasImage, setHasImage] = useState(false);

  return (
    <div style={{ padding: "4px 20px 120px", overflow: "auto", height: "100%" }}>
      <div onClick={onBack} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        <i data-lucide="arrow-left" style={{ width: 14, height: 14 }}></i> Back
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--fg1)", marginBottom: 4 }}>Add hearing log</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg2)", marginBottom: 16 }}>{record.num}</div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg2)" }}>What happened in court?</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontFamily: "var(--font-sans)", fontSize: 14, resize: "none" }}
            placeholder="Arguments concluded, reserved for order."/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg2)" }}>Next date</label>
          <input value={nextDate} onChange={e => setNextDate(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--font-mono)" }}/>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SecondaryBtn onClick={() => setHasImage(true)}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <i data-lucide="camera" style={{ width: 14, height: 14 }}></i> {hasImage ? "Change image" : "Pick order image"}
            </span>
          </SecondaryBtn>
          <PrimaryBtn onClick={onSaved}>Save hearing</PrimaryBtn>
        </div>
        {hasImage && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", aspectRatio: "1.2", background: "#EFEDE8", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg3)", fontSize: 12 }}>
            <img src="../../assets/hearing-order-sample.png" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          </div>
        )}
        {hasImage && (
          <div style={{ fontSize: 11, color: "var(--fg3)", fontFamily: "var(--font-mono)" }}>OCR: pending_config — enable GOOGLE_CLOUD_VISION_API_KEY to extract text.</div>
        )}
      </div>
    </div>
  );
}

function SmsPreviewScreen({ record, onBack }) {
  const [variant, setVariant] = useState("post_hearing");
  const texts = {
    reminder: `Dear Ahmed Zubair, your case ${record.num} is listed on 2026-04-18. Court: Islamabad High Court. — Wakeel demo`,
    post_hearing: `Dear Ahmed Zubair, your case ${record.num} was heard today. Next date: 2026-05-14. Status: Arguments concluded, reserved for order. — Wakeel demo`,
  };
  return (
    <div style={{ padding: "4px 20px 120px", overflow: "auto", height: "100%" }}>
      <div onClick={onBack} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        <i data-lucide="arrow-left" style={{ width: 14, height: 14 }}></i> Back
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--fg1)", marginBottom: 4 }}>Client SMS preview</div>
      <div style={{ fontSize: 13, color: "var(--fg2)", marginBottom: 14 }}>Preview only. Nothing is sent from the demo.</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Chip active={variant === "reminder"} onClick={() => setVariant("reminder")}>reminder</Chip>
        <Chip active={variant === "post_hearing"} onClick={() => setVariant("post_hearing")}>post-hearing</Chip>
      </div>
      <div style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <Eyebrow>{variant === "reminder" ? "REMINDER · EN" : "POST-HEARING · EN"}</Eyebrow>
        <div style={{ fontSize: 13, lineHeight: "20px", color: "var(--fg1)", marginTop: 8 }}>{texts[variant]}</div>
      </div>
      <div style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <Eyebrow>URDU PREVIEW</Eyebrow>
        <div style={{ fontFamily: "var(--font-urdu)", direction: "rtl", fontSize: 17, lineHeight: 2.2, color: "var(--fg1)", marginTop: 8 }}>
          آپ کا مقدمہ {record.num} مورخہ 14 مئی کو اسلام آباد ہائی کورٹ میں پیش ہو گا۔
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HearingUpload, SmsPreviewScreen });
