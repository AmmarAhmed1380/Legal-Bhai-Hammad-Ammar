/* global React */
const { useState } = React;

function Login({ onEnter }) {
  const users = [
    { label: "Admin", phone: "03001234567" },
    { label: "Associate", phone: "03007654321" },
    { label: "Junior", phone: "03001112222" },
  ];
  const [phone, setPhone] = useState(users[0].phone);
  return (
    <div style={{ padding: "0 20px", paddingTop: 60 }}>
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 14, boxShadow: "var(--shadow-card)" }}>
        <Eyebrow>WAKEEL DEMO</Eyebrow>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--fg1)", lineHeight: "30px" }}>Lawyer mobile workflow</div>
        <div style={{ fontSize: 13, color: "var(--fg2)", lineHeight: "19px" }}>
          Use a seeded demo number and fixed code 111111. This app covers today's hearings, case review, hearing upload, OCR hook, and SMS preview.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {users.map(u => (
            <Chip key={u.phone} active={phone === u.phone} onClick={() => setPhone(u.phone)}>{u.label}</Chip>
          ))}
        </div>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--font-mono)" }}
        />
        <PrimaryBtn full onClick={onEnter}>Enter mobile demo</PrimaryBtn>
        <div style={{ background: "#FBFAF7", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", fontSize: 12, color: "var(--fg2)" }}>
          <strong style={{ color: "var(--fg1)", display: "block" }}>Demo code</strong>111111
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
