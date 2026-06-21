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
  { label: "Demo Lawyer", phone: "6012109282" },
];

const MOCK_CLIENTS = [
  { label: "Demo Client", phone: "6012109282" },
];

const formatPhoneNumber = (value: string) => {
  const clean = value.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    const digits = clean.slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  } else {
    const digits = clean.slice(0, 10);
    if (digits.length === 0) return "";
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
};

export default function HomePage() {
  const router = useRouter();

  // Navigation and authentication state
  const [authHydrated, setAuthHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"lawyer" | "client">("lawyer");
  const [registrationMode, setRegistrationMode] = useState(false);

  // Form fields
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);

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
    setPhone("");
    setCountryCode("+1");
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
  const startLawyerLogin = async () => {
    if (registrationMode) {
      if (!displayName.trim() || !firmName.trim() || !primaryCity.trim()) {
        setOperationStatus("Please fill in all required fields (Full Name, Firm/Chamber Name, and Primary City) to create a workspace.");
        return;
      }
    }
    setOperationStatus("Requesting OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = countryCode === "+92"
        ? (cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`)
        : `${countryCode}${cleanPhone}`;
      const response = await productJsonRequest<{ devCode: string | null }>("/v1/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({
          phone: formattedPhone,
          actorType: "staff",
          purpose: registrationMode ? "register" : "login"
        }),
      });
      
      setLoginCode("");
      setOtpDigits(Array(6).fill(""));
      setOperationStatus("OTP code sent to your phone number.");
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
      const formattedPhone = countryCode === "+92"
        ? (cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`)
        : `${countryCode}${cleanPhone}`;
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
  const startClientLogin = async () => {
    setOperationStatus("Requesting client OTP...");
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const formattedPhone = countryCode === "+92"
        ? (cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`)
        : `${countryCode}${cleanPhone}`;
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
      setOperationStatus("OTP code sent to your phone number.");
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
      const formattedPhone = countryCode === "+92"
        ? (cleanPhone.startsWith("0") ? cleanPhone : `0${cleanPhone}`)
        : `${countryCode}${cleanPhone}`;
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
                  {isCountryDropdownOpen && (
                    <div
                      onClick={() => setIsCountryDropdownOpen(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9,
                        background: "transparent",
                      }}
                    />
                  )}
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    zIndex: 10,
                  }}>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                        style={{
                          width: "64px",
                          background: "none",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          outline: "none",
                          userSelect: "none",
                          fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                          padding: 0
                        }}
                      >
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
                          backgroundColor: countryCode === "+92" ? "rgba(15, 110, 86, 0.1)" : "rgba(216, 90, 48, 0.1)",
                          color: countryCode === "+92" ? "var(--primary)" : "var(--accent)",
                          flexShrink: 0,
                          marginRight: "8px",
                          fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                          letterSpacing: "-0.2px"
                        }}>
                          {countryCode === "+92" ? "PK" : "US"}
                        </div>
                        <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "13px", marginRight: "3px", fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>{countryCode}</span>
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            opacity: 0.6,
                            transform: isCountryDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease"
                          }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
 
                      {isCountryDropdownOpen && (
                        <div style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: "-8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                          padding: "6px",
                          zIndex: 11,
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          minWidth: "220px",
                          width: "max-content",
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryCode("+92");
                              setIsCountryDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                              padding: "10px 12px",
                              border: "none",
                              background: countryCode === "+92" ? "var(--primary-light)" : "none",
                              color: countryCode === "+92" ? "var(--primary-dark)" : "var(--text-primary)",
                              fontWeight: countryCode === "+92" ? 700 : 500,
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (countryCode !== "+92") e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (countryCode !== "+92") e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <div style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor: "rgba(15, 110, 86, 0.15)",
                              color: "var(--primary)",
                              flexShrink: 0,
                            }}>
                              PK
                            </div>
                            <span style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>Pakistan (+92)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryCode("+1");
                              setIsCountryDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                              padding: "10px 12px",
                              border: "none",
                              background: countryCode === "+1" ? "var(--primary-light)" : "none",
                              color: countryCode === "+1" ? "var(--primary-dark)" : "var(--text-primary)",
                              fontWeight: countryCode === "+1" ? 700 : 500,
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (countryCode !== "+1") e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (countryCode !== "+1") e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <div style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor: "rgba(216, 90, 48, 0.15)",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}>
                              US
                            </div>
                            <span style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>United States (+1)</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{
                      width: "1px",
                      height: "18px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.25,
                      marginLeft: "6px",
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
                    placeholder=""
                    style={{
                      paddingLeft: "96px",
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
                  {isCountryDropdownOpen && (
                    <div
                      onClick={() => setIsCountryDropdownOpen(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9,
                        background: "transparent",
                      }}
                    />
                  )}
                  <div style={{
                    position: "absolute",
                    left: "14px",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                    zIndex: 10,
                  }}>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                        style={{
                          width: "64px",
                          background: "none",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          outline: "none",
                          userSelect: "none",
                          fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                          padding: 0
                        }}
                      >
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
                          backgroundColor: countryCode === "+92" ? "rgba(15, 110, 86, 0.1)" : "rgba(216, 90, 48, 0.1)",
                          color: countryCode === "+92" ? "var(--primary)" : "var(--accent)",
                          flexShrink: 0,
                          marginRight: "8px",
                          fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                          letterSpacing: "-0.2px"
                        }}>
                          {countryCode === "+92" ? "PK" : "US"}
                        </div>
                        <span style={{ color: "var(--text-primary)", fontWeight: 500, fontSize: "13px", marginRight: "3px", fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>{countryCode}</span>
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            opacity: 0.6,
                            transform: isCountryDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease"
                          }}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      {isCountryDropdownOpen && (
                        <div style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: "-8px",
                          backgroundColor: "#ffffff",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                          padding: "6px",
                          zIndex: 11,
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          minWidth: "220px",
                          width: "max-content",
                        }}>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryCode("+92");
                              setIsCountryDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                              padding: "10px 12px",
                              border: "none",
                              background: countryCode === "+92" ? "var(--primary-light)" : "none",
                              color: countryCode === "+92" ? "var(--primary-dark)" : "var(--text-primary)",
                              fontWeight: countryCode === "+92" ? 700 : 500,
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (countryCode !== "+92") e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (countryCode !== "+92") e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <div style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor: "rgba(15, 110, 86, 0.15)",
                              color: "var(--primary)",
                              flexShrink: 0,
                            }}>
                              PK
                            </div>
                            <span style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>Pakistan (+92)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryCode("+1");
                              setIsCountryDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                              padding: "10px 12px",
                              border: "none",
                              background: countryCode === "+1" ? "var(--primary-light)" : "none",
                              color: countryCode === "+1" ? "var(--primary-dark)" : "var(--text-primary)",
                              fontWeight: countryCode === "+1" ? 700 : 500,
                              borderRadius: "8px",
                              fontSize: "14px",
                              fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => {
                              if (countryCode !== "+1") e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (countryCode !== "+1") e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <div style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor: "rgba(216, 90, 48, 0.15)",
                              color: "var(--accent)",
                              flexShrink: 0,
                            }}>
                              US
                            </div>
                            <span style={{ fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif' }}>United States (+1)</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{
                      width: "1px",
                      height: "18px",
                      backgroundColor: "var(--text-secondary)",
                      opacity: 0.25,
                      marginLeft: "6px",
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
                    placeholder=""
                    style={{
                      paddingLeft: "96px",
                      fontSize: "15px",
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
