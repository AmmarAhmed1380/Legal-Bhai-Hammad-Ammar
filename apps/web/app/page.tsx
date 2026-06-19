"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  productJsonRequest,
  readStoredProductAuth,
  writeStoredProductAuth,
} from "../lib/product-api";

const STAFF_STORAGE_KEY = "legalbahi-staff-auth";
const CLIENT_STORAGE_KEY = "legalbahi-client-auth";

const MOCK_STAFF = [
  { label: "Owner", phone: "3001234567" },
  { label: "Lawyer", phone: "3007654321" },
  { label: "Assistant", phone: "3001112222" },
];

const MOCK_CLIENTS = [
  { label: "Ahmed Zubair", phone: "3005550001" },
  { label: "Farooq Traders", phone: "3005550002" },
];

const formatPhoneNumber = (value: string) => {
  const clean = value.replace(/\D/g, "");
  const digits = clean.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export default function HomePage() {
  const router = useRouter();

  // Navigation and authentication state
  const [authHydrated, setAuthHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"lawyer" | "client">("lawyer");
  const [registrationMode, setRegistrationMode] = useState(false);

  // Form fields
  const [phone, setPhone] = useState(formatPhoneNumber("3001234567"));
  const [titlePrefix, setTitlePrefix] = useState("Adv.");
  const [isSelectFocused, setIsSelectFocused] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  useEffect(() => {
    const code = otpDigits.join("");
    setLoginCode(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      if (activeTab === "lawyer") {
        void verifyLawyerLogin();
      } else {
        void verifyClientLogin();
      }
    }
  }, [otpDigits, activeTab]);

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanValue;
    setOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`otp-input-${index - 1}`);
        if (prevInput) {
          const nextDigits = [...otpDigits];
          nextDigits[index - 1] = "";
          setOtpDigits(nextDigits);
          (prevInput as HTMLInputElement).focus();
        }
      } else {
        const nextDigits = [...otpDigits];
        nextDigits[index] = "";
        setOtpDigits(nextDigits);
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const code = otpDigits.join("");
      if (activeTab === "lawyer") {
        void verifyLawyerLogin(code);
      } else {
        void verifyClientLogin(code);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      setOtpDigits(pasteData.split(""));
      const lastInput = document.getElementById("otp-input-5");
      if (lastInput) {
        (lastInput as HTMLInputElement).focus();
      }
    }
  };

  // OTP and flow states
  const [otpRequested, setOtpRequested] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);

  // Check active sessions on load
  useEffect(() => {
    const staffAuth = readStoredProductAuth(STAFF_STORAGE_KEY);
    const clientAuth = readStoredProductAuth(CLIENT_STORAGE_KEY);

    if (staffAuth) {
      router.replace("/overview");
    } else if (clientAuth) {
      router.replace("/client");
    } else {
      setAuthHydrated(true);
    }
  }, [router]);

  // Adjust default phone numbers when switching tabs
  const handleTabChange = (tab: "lawyer" | "client") => {
    setActiveTab(tab);
    setPhone(tab === "lawyer" ? formatPhoneNumber(MOCK_STAFF[0].phone) : formatPhoneNumber(MOCK_CLIENTS[0].phone));
    setOtpRequested(false);
    setLoginCode("");
    setOperationStatus(null);
    setRegistrationMode(false);
  };

  const handleSubTabChange = (mode: boolean) => {
    setRegistrationMode(mode);
    setOtpRequested(false);
    setLoginCode("");
    setOperationStatus(null);
  };

  // 1. Lawyer Workspace OTP Request
  const startLawyerLogin = async () => {
    setOperationStatus("Requesting OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      const response = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: formattedPhone, actorType: "staff" }),
      });
      if (response.devCode) {
        setLoginCode(response.devCode);
        setOperationStatus(`OTP Sent. (Development OTP: ${response.devCode} autofilled)`);
      } else {
        setOperationStatus("OTP code sent to your phone number.");
      }
      setOtpRequested(true);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  // 2. Lawyer Workspace OTP Verification (Login or Register)
  const verifyLawyerLogin = async (codeOverride?: string) => {
    const codeToUse = codeOverride || loginCode;
    setOperationStatus(registrationMode ? "Creating workspace..." : "Verifying OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      const path = registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify";
      const fullDisplayName = registrationMode && titlePrefix ? `${titlePrefix} ${displayName}`.trim() : displayName;
      const bodyPayload = registrationMode
        ? { phone: formattedPhone, code: codeToUse, displayName: fullDisplayName, firmName, email: "", primaryCity: "Islamabad" }
        : { phone: formattedPhone, actorType: "staff", code: codeToUse };

      const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>(path, {
        method: "POST",
        body: JSON.stringify(bodyPayload),
      });

      const nextAuth = { token: payload.token, refreshToken: payload.refreshToken };
      writeStoredProductAuth(STAFF_STORAGE_KEY, nextAuth);
      setOperationStatus("Authentication successful! Redirecting...");
      router.replace("/overview");
    } catch (err: any) {
      setOperationStatus(err.message || "Authentication failed. Please check the code.");
    }
  };

  // 3. Client OTP Request
  const startClientLogin = async () => {
    setOperationStatus("Requesting client OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      const response = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: formattedPhone, actorType: "client" }),
      });
      if (response.devCode) {
        setLoginCode(response.devCode);
        setOperationStatus(`OTP Sent. (Development OTP: ${response.devCode} autofilled)`);
      } else {
        setOperationStatus("OTP code sent to your phone number.");
      }
      setOtpRequested(true);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  // 4. Client OTP Verification
  const verifyClientLogin = async (codeOverride?: string) => {
    const codeToUse = codeOverride || loginCode;
    setOperationStatus("Verifying client OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`;
      const payload = await productJsonRequest<{ token: string; refreshToken: string | null }>("/v1/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: formattedPhone, actorType: "client", code: codeToUse }),
      });

      const nextAuth = { token: payload.token, refreshToken: payload.refreshToken };
      writeStoredProductAuth(CLIENT_STORAGE_KEY, nextAuth);
      setOperationStatus("Authentication successful! Redirecting...");
      router.replace("/client");
    } catch (err: any) {
      setOperationStatus(err.message || "Authentication failed. Please check the code.");
    }
  };

  if (!authHydrated) {
    return (
      <main className="page-shell">
        <section className="auth-card" style={{ textAlign: "center" }}>
          <div className="eyebrow">Legal Bhai</div>
          <h1 className="title" style={{ fontSize: 24 }}>Connecting Session...</h1>
          <p className="muted">Retrieving client and workspace authentication status.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      {/* Root Layout Header */}
      <div style={{ textAlign: "center", marginBottom: 32, marginTop: 16 }}>
        <h1 className="title" style={{ fontSize: 42, margin: "8px 0 4px", lineHeight: "1.25", paddingBottom: "8px" }}>Legal Bhai</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
          Secure matter hearing dates, client updates, cause-list matching, and private document management.
        </p>
      </div>

      <section className="auth-card" style={{ paddingBottom: 24 }}>
        {/* Workspace Selection Tabs */}
        {!otpRequested && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button
              type="button"
              className={activeTab === "lawyer" ? "button" : "button-secondary"}
              style={{ flex: 1, padding: "10px 0" }}
              onClick={() => handleTabChange("lawyer")}
            >
              Lawyer Portal
            </button>
            <button
              type="button"
              className={activeTab === "client" ? "button" : "button-secondary"}
              style={{ flex: 1, padding: "10px 0" }}
              onClick={() => handleTabChange("client")}
            >
              Client Portal
            </button>
          </div>
        )}

        {/* Operation Notifications */}
        {operationStatus ? (
          <div style={{
            padding: 12,
            borderRadius: 8,
            backgroundColor: "var(--primary-light)",
            border: "1px solid rgba(15, 110, 86, 0.1)",
            color: "var(--primary-dark)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20,
            textAlign: "center"
          }}>
            {operationStatus}
          </div>
        ) : null}

        {/* 1. LAWYER PORTAL FORM */}
        {activeTab === "lawyer" && (
          <div>
            {!otpRequested && (
              <div className="field">
                <label>Phone Number</label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    pointerEvents: "none"
                  }}>
                    <span style={{
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontSize: "14px"
                    }}>
                      +92
                    </span>
                    <div style={{
                      width: "2px",
                      height: "16px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.35,
                      marginLeft: "14px",
                      borderRadius: "1px",
                      transform: "translateY(1px)"
                    }} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void startLawyerLogin();
                      }
                    }}
                    placeholder="(300) 123-4567"
                    style={{
                      paddingLeft: "66px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Lawyer Registration Extra Fields */}
            {registrationMode && !otpRequested && (
              <>
                <div className="field">
                  <label>Position</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <select
                      value={titlePrefix}
                      onChange={(e) => {
                        setTitlePrefix(e.target.value);
                        e.target.blur();
                      }}
                      onFocus={() => setIsSelectFocused(true)}
                      onBlur={() => setIsSelectFocused(false)}
                      style={{
                        width: "100%",
                        appearance: "none",
                        backgroundImage: "none",
                        paddingRight: "40px"
                      }}
                    >
                      <option value="Adv.">Adv.</option>
                      <option value="Barrister">Barrister</option>
                      <option value="AOR">AOR</option>
                      <option value="Sr. Adv.">Sr. Adv.</option>
                      <option value="">None</option>
                    </select>
                    {/* Custom animated SVG Arrow */}
                    <div style={{
                      position: "absolute",
                      right: "16px",
                      top: "50%",
                      transform: `translateY(-50%) rotate(${isSelectFocused ? "180deg" : "0deg"}) scale(${isSelectFocused ? 0.7 : 1}) translateX(${isSelectFocused ? "4px" : "0px"})`,
                      transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                      opacity: isSelectFocused ? 0.3 : 1,
                      pointerEvents: "none",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--text-secondary)"
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Muhammad Ali"
                  />
                </div>
                <div className="field">
                  <label>Firm / Chamber Name</label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="e.g. Ali & Partners"
                  />
                </div>
              </>
            )}

            {/* OTP Input Fields (6 individual boxes) */}
            {otpRequested && (
              <div className="field">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpRequested(false);
                      setOtpDigits(Array(6).fill(""));
                      setLoginCode("");
                      setOperationStatus(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Go back"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: "48px",
                        height: "48px",
                        fontSize: "20px",
                        fontWeight: "700",
                        textAlign: "center",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "rgba(255, 255, 255, 0.8)"
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions for OTP mode (Resend OTP / Change Number) above verify button */}
            {otpRequested && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                fontSize: "13px"
              }}>
                <button
                  type="button"
                  onClick={() => void startLawyerLogin()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpRequested(false);
                    setOtpDigits(Array(6).fill(""));
                    setLoginCode("");
                    setOperationStatus(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  Change Number
                </button>
              </div>
            )}

            <button
              type="button"
              className="button"
              style={{ width: "100%", marginTop: otpRequested ? 0 : 12 }}
              onClick={() => void (otpRequested ? verifyLawyerLogin() : startLawyerLogin())}
            >
              {otpRequested ? (registrationMode ? "Verify & Create Workspace" : "Verify & Sign In") : "Request OTP"}
            </button>

            {/* Toggle Sign In / Create Workspace underneath the Request OTP button */}
            {!otpRequested && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                {registrationMode ? (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Already have a workspace?{" "}
                    <button
                      type="button"
                      onClick={() => handleSubTabChange(false)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline"
                      }}
                    >
                      Sign In
                    </button>
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Don't have a workspace?{" "}
                    <button
                      type="button"
                      onClick={() => handleSubTabChange(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline"
                      }}
                    >
                      Create Workspace
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. CLIENT PORTAL FORM */}
        {activeTab === "client" && (
          <div>
            {!otpRequested && (
              <div className="field">
                <label>Phone Number</label>
                <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    pointerEvents: "none"
                  }}>
                    <span style={{
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      fontSize: "14px"
                    }}>
                      +92
                    </span>
                    <div style={{
                      width: "2px",
                      height: "16px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.35,
                      marginLeft: "14px",
                      borderRadius: "1px",
                      transform: "translateY(1px)"
                    }} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void startClientLogin();
                      }
                    }}
                    placeholder="(300) 123-4567"
                    style={{
                      paddingLeft: "66px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* OTP Input Fields (6 individual boxes) */}
            {otpRequested && (
              <div className="field">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpRequested(false);
                      setOtpDigits(Array(6).fill(""));
                      setLoginCode("");
                      setOperationStatus(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      padding: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    title="Go back"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                  </button>
                  <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: "48px",
                        height: "48px",
                        fontSize: "20px",
                        fontWeight: "700",
                        textAlign: "center",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "rgba(255, 255, 255, 0.8)"
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions for OTP mode (Resend OTP / Change Number) above verify button */}
            {otpRequested && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                fontSize: "13px"
              }}>
                <button
                  type="button"
                  onClick={() => void startClientLogin()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpRequested(false);
                    setOtpDigits(Array(6).fill(""));
                    setLoginCode("");
                    setOperationStatus(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline"
                  }}
                >
                  Change Number
                </button>
              </div>
            )}

            <button
              type="button"
              className="button"
              style={{ width: "100%", marginTop: otpRequested ? 0 : 12 }}
              onClick={() => void (otpRequested ? verifyClientLogin() : startClientLogin())}
            >
              {otpRequested ? "Verify & Sign In" : "Request OTP"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
