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

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

const toPakistanPhoneSubmit = (value: string) => {
  const clean = value.replace(/\D/g, "");
  return clean.startsWith("0") ? clean : `0${clean}`;
};

export default function HomePage() {
  const router = useRouter();

  // Navigation and authentication state
  const [authHydrated, setAuthHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"lawyer" | "client">("lawyer");
  const [registrationMode, setRegistrationMode] = useState(false);

  // Form fields
  const [phone, setPhone] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [primaryCity, setPrimaryCity] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  useEffect(() => {
    const code = otpDigits.join("");
    setLoginCode(code);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      if (activeTab === "lawyer") {
        void verifyLawyerLogin(code);
      } else {
        void verifyClientLogin(code);
      }
    }
  }, [otpDigits, activeTab]);

  const otpInputId = (prefix: string, index: number) => `${prefix}-${index}`;

  const focusOtpInput = (prefix: string, index: number) => {
    const input = document.getElementById(otpInputId(prefix, index));
    if (input) {
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }
  };

  const handleOtpChange = (index: number, value: string, inputPrefix = "otp-input") => {
    const cleanValue = value.replace(/[^0-9]/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanValue;
    setOtpDigits(nextDigits);

    if (cleanValue && index < 5) {
      focusOtpInput(inputPrefix, index + 1);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>, inputPrefix = "otp-input") => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const nextDigits = [...otpDigits];
        nextDigits[index - 1] = "";
        setOtpDigits(nextDigits);
        focusOtpInput(inputPrefix, index - 1);
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

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>, inputPrefix = "otp-input") => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      setOtpDigits(pasteData.split(""));
      focusOtpInput(inputPrefix, 5);
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
    setPhone("");
    setOtpRequested(false);
    setLoginCode("");
    setOtpDigits(Array(6).fill(""));
    setOperationStatus(null);
    setRegistrationMode(false);
    setEmail("");
    setPrimaryCity("");
  };

  const handleSubTabChange = (mode: boolean) => {
    setRegistrationMode(mode);
    setOtpRequested(false);
    setLoginCode("");
    setOtpDigits(Array(6).fill(""));
    setOperationStatus(null);
    setEmail("");
    setPrimaryCity("");
  };

  // 1. Lawyer Workspace OTP Request
  const startLawyerLogin = async (options?: { resend?: boolean }) => {
    if (registrationMode) {
      if (!displayName.trim() || !firmName.trim() || !primaryCity.trim()) {
        setOperationStatus("Please fill in all required fields (Full Name, Firm/Chamber Name, and Primary City) to create a workspace.");
        return;
      }
    }
    setOperationStatus(options?.resend ? "Sending a new verification code..." : "Requesting OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          actorType: "staff",
          purpose: registrationMode ? "register" : "login"
        }),
      });
      
      setLoginCode("");
      setOtpDigits(Array(6).fill(""));
      setOperationStatus(
        options?.resend
          ? "A new verification code has been sent to your phone number."
          : "A verification code has been sent to your phone number.",
      );
      setOtpRequested(true);
      setTimeout(() => focusOtpInput("otp-input", 0), 0);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  const resetOtpFlow = () => {
    setOtpRequested(false);
    setOtpDigits(Array(6).fill(""));
    setLoginCode("");
    setOperationStatus(null);
  };

  // 2. Lawyer Workspace OTP Verification (Login or Register)
  const verifyLawyerLogin = async (codeOverride?: string) => {
    const codeToUse = codeOverride || loginCode;
    setOperationStatus(registrationMode ? "Creating workspace..." : "Verifying OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      const path = registrationMode ? "/v1/auth/staff/register" : "/v1/auth/otp/verify";
      const bodyPayload = registrationMode
        ? {
            phone: formattedPhone,
            code: codeToUse,
            displayName: displayName.trim(),
            firmName,
            email: email.trim() ? email.trim() : null,
            primaryCity
          }
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
  const startClientLogin = async (options?: { resend?: boolean }) => {
    setOperationStatus(options?.resend ? "Sending a new verification code..." : "Requesting client OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
      const response = await productJsonRequest<{ devCode: string | null; expiresAt: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          actorType: "client",
          purpose: "login"
        }),
      });
      
      if (response.expiresAt === null) {
        setOperationStatus("Client account not found. Please contact your lawyer to add you to their workspace.");
        return;
      }
      
      setLoginCode("");
      setOtpDigits(Array(6).fill(""));
      setOperationStatus(
        options?.resend
          ? "A new verification code has been sent to your phone number."
          : "A verification code has been sent to your phone number.",
      );
      setOtpRequested(true);
      setTimeout(() => focusOtpInput("client-otp-input", 0), 0);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  // 4. Client OTP Verification
  const verifyClientLogin = async (codeOverride?: string) => {
    const codeToUse = codeOverride || loginCode;
    setOperationStatus("Verifying client OTP...");
    try {
      const formattedPhone = toPakistanPhoneSubmit(phone);
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
                    gap: "8px",
                    height: "100%",
                    zIndex: 10,
                  }}>
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 500,
                      lineHeight: 1,
                      backgroundColor: "rgba(15, 110, 86, 0.1)",
                      color: "var(--primary)",
                      flexShrink: 0,
                      fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                    }}>
                      PK
                    </div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "13px", fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>+92</span>
                    <div style={{
                      width: "1px",
                      height: "18px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.25,
                    }} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (activeTab === "lawyer") {
                          void startLawyerLogin();
                        } else {
                          void startClientLogin();
                        }
                      }
                    }}
                    style={{
                      paddingLeft: "84px",
                      fontSize: "15px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Lawyer Registration Extra Fields */}
            {registrationMode && !otpRequested && (
              <>
                <div className="field">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder=""
                  />
                </div>
                <div className="field">
                  <label>Firm / Chamber Name</label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder=""
                  />
                </div>
                <div className="field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder=""
                  />
                </div>
                <div className="field">
                  <label>Primary City</label>
                  <input
                    type="text"
                    value={primaryCity}
                    onChange={(e) => setPrimaryCity(e.target.value)}
                    placeholder=""
                  />
                </div>
              </>
            )}

            {/* OTP Input Fields (6 individual boxes) */}
            {otpRequested && (
              <div className="field">
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={otpInputId("otp-input", idx)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value, "otp-input")}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e, "otp-input")}
                      onPaste={(e) => handleOtpPaste(e, "otp-input")}
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
                  onClick={() => void startLawyerLogin({ resend: true })}
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
                  onClick={resetOtpFlow}
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
                    gap: "8px",
                    height: "100%",
                    zIndex: 10,
                  }}>
                    <div style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 500,
                      lineHeight: 1,
                      backgroundColor: "rgba(15, 110, 86, 0.1)",
                      color: "var(--primary)",
                      flexShrink: 0,
                      fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                    }}>
                      PK
                    </div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "13px", fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>+92</span>
                    <div style={{
                      width: "1px",
                      height: "18px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.25,
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
                    style={{
                      paddingLeft: "84px",
                      fontSize: "15px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* OTP Input Fields (6 individual boxes) */}
            {otpRequested && (
              <div className="field">
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                </div>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: 20 }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      id={otpInputId("client-otp-input", idx)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value, "client-otp-input")}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e, "client-otp-input")}
                      onPaste={(e) => handleOtpPaste(e, "client-otp-input")}
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
                  onClick={() => void startClientLogin({ resend: true })}
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
                  onClick={resetOtpFlow}
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
