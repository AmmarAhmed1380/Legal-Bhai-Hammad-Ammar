"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const OTP_ERROR_MESSAGE = "Invalid OTP. Please try again.";

const userFacingOtpError = (err: unknown) => {
  if (err instanceof Error && /invalid\s+otp|verification code|code/i.test(err.message)) {
    return OTP_ERROR_MESSAGE;
  }
  return err instanceof Error ? err.message : "Authentication failed. Please try again.";
};

export default function HomePage() {
  const router = useRouter();

  // Navigation and authentication state
  const [authHydrated, setAuthHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"lawyer" | "client">("lawyer");
  const [registrationMode, setRegistrationMode] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [loginContentVisible, setLoginContentVisible] = useState(true);
  const [pendingTransition, setPendingTransition] = useState<{
    activeTab?: "lawyer" | "client";
    registrationMode?: boolean;
    otpRequested?: boolean;
  } | null>(null);

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

  useEffect(() => {
    if (otpRequested) {
      const prefix = activeTab === "lawyer" ? "otp-input" : "client-otp-input";
      const timer = setTimeout(() => {
        focusOtpInput(prefix, 0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [otpRequested, activeTab]);

  useEffect(() => {
    if (!otpRequested) {
      const timer = setTimeout(() => {
        const input = document.getElementById("phone-input");
        if (input) {
          input.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [otpRequested, activeTab, registrationMode]);

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
  const triggerLoginTransition = (nextState: {
    activeTab?: "lawyer" | "client";
    registrationMode?: boolean;
    otpRequested?: boolean;
  }) => {
    const isTabChange = nextState.activeTab !== undefined && nextState.activeTab !== activeTab;
    const isRegModeChange = nextState.registrationMode !== undefined && nextState.registrationMode !== registrationMode;
    const isOtpChange = nextState.otpRequested !== undefined && nextState.otpRequested !== otpRequested;

    if (!isTabChange && !isRegModeChange && !isOtpChange) {
      return;
    }

    setPendingTransition(nextState);
    setLoginContentVisible(false);
  };

  const handleLoginTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName === "opacity" && !loginContentVisible && pendingTransition) {
      if (pendingTransition.activeTab !== undefined) {
        setActiveTab(pendingTransition.activeTab);
        setPhone("");
        setOtpRequested(false);
        setLoginCode("");
        setOtpDigits(Array(6).fill(""));
        setOperationStatus(null);
        setErrorText(null);
        setRegistrationMode(false);
        setEmail("");
        setPrimaryCity("");
      } else if (pendingTransition.registrationMode !== undefined) {
        setRegistrationMode(pendingTransition.registrationMode);
        setOtpRequested(false);
        setLoginCode("");
        setOtpDigits(Array(6).fill(""));
        setOperationStatus(null);
        setErrorText(null);
        setEmail("");
        setPrimaryCity("");
      } else if (pendingTransition.otpRequested !== undefined) {
        setOtpRequested(pendingTransition.otpRequested);
        setLoginCode("");
        setOtpDigits(Array(6).fill(""));
        setOperationStatus(null);
        setErrorText(null);
      }

      setPendingTransition(null);
      setLoginContentVisible(true);
    }
  };

  const handleTabChange = (tab: "lawyer" | "client") => {
    triggerLoginTransition({ activeTab: tab });
  };

  const handleSubTabChange = (mode: boolean) => {
    triggerLoginTransition({ registrationMode: mode });
  };

  // 1. Lawyer Workspace OTP Request
  const startLawyerLogin = async (options?: { resend?: boolean }) => {
    setErrorText(null);
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
      if (options?.resend) {
        setOtpRequested(true);
      } else {
        triggerLoginTransition({ otpRequested: true });
      }
      setTimeout(() => focusOtpInput("otp-input", 0), 0);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  const resetOtpFlow = () => {
    triggerLoginTransition({ otpRequested: false });
  };

  // 2. Lawyer Workspace OTP Verification (Login or Register)
  const verifyLawyerLogin = async (codeOverride?: string) => {
    setErrorText(null);
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
      setErrorText(userFacingOtpError(err));
      setOperationStatus(null);
    }
  };

  // 3. Client OTP Request
  const startClientLogin = async (options?: { resend?: boolean }) => {
    setErrorText(null);
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
      if (options?.resend) {
        setOtpRequested(true);
      } else {
        triggerLoginTransition({ otpRequested: true });
      }
      setTimeout(() => focusOtpInput("client-otp-input", 0), 0);
    } catch (err: any) {
      setOperationStatus(err.message || "Failed to request OTP.");
    }
  };

  // 4. Client OTP Verification
  const verifyClientLogin = async (codeOverride?: string) => {
    setErrorText(null);
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
      setErrorText(userFacingOtpError(err));
      setOperationStatus(null);
    }
  };

  if (!authHydrated) {
    return null;
  }

  return (
    <main className="split-layout-container">
      {/* Left Column: Brand Hero Showcase */}
      <section className="brand-hero-panel">
        <div className="ambient-blur-glow" />
        
        {/* Main Content Wrapper (holds Logo + Features closer together) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "36px", position: "relative", zIndex: 2, margin: "auto 0" }}>
          {/* Top Branding Section */}
          <div>
            <div className="brand-badge">
              Pakistani Advocate Network
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "28px", fontWeight: 800, margin: 0, letterSpacing: "-0.03em", color: "#ffffff", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Legal Bhai
              </h1>
            </div>
          </div>

          {/* Middle Value Proposition Section */}
          <div className="brand-hero-content" style={{ margin: 0, maxWidth: "540px" }}>
            <h2 className="brand-hero-title">
              The modern digital backbone for your advocate practice.
            </h2>
            <p className="brand-hero-subtitle" style={{ marginBottom: "28px" }}>
              Synchronize hearing dates, automate cause-lists, securely communicate orders with clients, and manage case documentation in one unified workspace.
            </p>

            <div className="brand-features-list">
              {/* Feature 1 */}
              <div className="brand-feature-item">
                <div className="brand-feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="brand-feature-text">
                  <span className="brand-feature-title">Automated Cause-Lists</span>
                  <span className="brand-feature-desc">Never check high court or district court list entries manually again. Sync cases automatically.</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="brand-feature-item">
                <div className="brand-feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="brand-feature-text">
                  <span className="brand-feature-title">Secure Case Vault</span>
                  <span className="brand-feature-desc">Upload, review, and organize orders, petitions, and evidence under bank-grade zero-trust storage.</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="brand-feature-item">
                <div className="brand-feature-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="brand-feature-text">
                  <span className="brand-feature-title">Advocate-Client Bridge</span>
                  <span className="brand-feature-desc">Automated updates, hearing calendars, and files shared instantly with clients in their dedicated portal.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Indicators */}
        <div className="brand-hero-footer">
          <span>Standardized for High & District Courts</span>
          <Link href="/privacy" className="brand-hero-footer-link">
            Data Protection &amp; Privacy Policy
          </Link>
        </div>
      </section>

      {/* Right Column: Portal Login Container */}
      <section className="login-form-panel">
        <div className="login-form-wrapper">
          {/* Brand Header for Mobile View only */}
          <div className="mobile-brand-header">
            <h1 className="title" style={{ fontSize: 36, margin: "0 0 4px", textAlign: "center", paddingBottom: 4 }}>Legal Bhai</h1>
            <p className="muted" style={{ fontSize: 14, textAlign: "center", marginBottom: 24, maxWidth: "100%" }}>
              Automated hearing updates, private case files, and client dashboard.
            </p>
          </div>

          {/* Dynamic Welcome Heading */}
          <div style={{ marginBottom: 24, paddingLeft: 4 }}>
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {activeTab === "lawyer" ? (registrationMode ? "Create Workspace" : "Advocate Portal") : "Client Access"}
            </h2>
            <p className="muted" style={{ fontSize: "13px", margin: 0, lineHeight: 1.4 }}>
              {activeTab === "lawyer" 
                ? (registrationMode ? "Create your workspace to register your advocacy firm." : "Access your matters, vault documents, and cause-list sync.") 
                : "View your active matters, hearing dates, and shared files."}
            </p>
          </div>

          <section className="auth-card" style={{ margin: "0 auto", paddingBottom: 24, width: "100%" }}>
          <div
            className={`transition-opacity duration-250 ease-out ${loginContentVisible ? "opacity-100" : "opacity-0"}`}
          onTransitionEnd={handleLoginTransitionEnd}
        >
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
            <div
              className={`auth-flow-stack ${otpRequested ? "auth-flow-stack--otp" : ""}`}
              style={registrationMode && !otpRequested ? { minHeight: 360 } : undefined}
            >
              <div className={`auth-flow-panel ${otpRequested ? "auth-flow-panel--hidden" : "auth-flow-panel--visible"}`}>
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
                      id="phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void startLawyerLogin();
                        }
                      }}
                      style={{
                        paddingLeft: "84px",
                        fontSize: "15px",
                      }}
                      placeholder="300-1234567"
                    />
                  </div>
                </div>

                {registrationMode ? (
                  <>
                    <div className="field">
                      <label>Full Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Advocate Muhammad Ali"
                      />
                    </div>
                    <div className="field">
                      <label>Firm / Chamber Name</label>
                      <input
                        type="text"
                        value={firmName}
                        onChange={(e) => setFirmName(e.target.value)}
                        placeholder="e.g. Ali & Co. Chambers"
                      />
                    </div>
                    <div className="field">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. ali@legalbhai.pk (optional)"
                      />
                    </div>
                    <div className="field">
                      <label>Primary City</label>
                      <input
                        type="text"
                        value={primaryCity}
                        onChange={(e) => setPrimaryCity(e.target.value)}
                        placeholder="e.g. Lahore"
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className={`auth-flow-panel ${otpRequested ? "auth-flow-panel--visible" : "auth-flow-panel--hidden"}`}>
                <div className="field">
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                  </div>
                  <div className="otp-digit-row">
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
                        className="otp-digit-input"
                      />
                    ))}
                  </div>
                  {errorText ? (
                    <div style={{
                      color: "var(--danger)",
                      background: "var(--accent-light)",
                      border: "1px solid rgba(216, 90, 48, 0.2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: "14px",
                      textAlign: "center",
                      marginBottom: 16,
                      fontWeight: 600
                    }}>
                      {errorText}
                    </div>
                  ) : null}
                </div>

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
              </div>
            </div>

            <button
              type="button"
              className="button"
              style={{ width: "100%", marginTop: otpRequested ? 8 : 16 }}
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
            <div className={`auth-flow-stack ${otpRequested ? "auth-flow-stack--otp" : ""}`}>
              <div className={`auth-flow-panel ${otpRequested ? "auth-flow-panel--hidden" : "auth-flow-panel--visible"}`}>
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
                      id="phone-input"
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
                      placeholder="300-1234567"
                    />
                  </div>
                </div>
              </div>

              <div className={`auth-flow-panel ${otpRequested ? "auth-flow-panel--visible" : "auth-flow-panel--hidden"}`}>
                <div className="field">
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>OTP Verification Code:</label>
                  </div>
                  <div className="otp-digit-row">
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
                        className="otp-digit-input"
                      />
                    ))}
                  </div>
                  {errorText ? (
                    <div style={{
                      color: "var(--danger)",
                      background: "var(--accent-light)",
                      border: "1px solid rgba(216, 90, 48, 0.2)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: "14px",
                      textAlign: "center",
                      marginBottom: 16,
                      fontWeight: 600
                    }}>
                      {errorText}
                    </div>
                  ) : null}
                </div>

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
              </div>
            </div>

            <button
              type="button"
              className="button"
              style={{ width: "100%", marginTop: otpRequested ? 8 : 16 }}
              onClick={() => void (otpRequested ? verifyClientLogin() : startClientLogin())}
            >
              {otpRequested ? "Verify & Sign In" : "Request OTP"}
            </button>
          </div>
        )}
        </div>
        
        {/* Security Lock Notice */}
        <div style={{ 
          marginTop: "24px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          gap: "8px", 
          fontSize: "12px", 
          color: "var(--text-tertiary)" 
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontWeight: 500 }}>Secure, encrypted connection</span>
        </div>
      </section>
      </div>
      </section>
    </main>
  );
}
