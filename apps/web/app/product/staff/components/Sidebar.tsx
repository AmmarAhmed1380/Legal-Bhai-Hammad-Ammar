import Link from "next/link";
import { useEffect, useState } from "react";
import { type StaffSection, type StaffProfile } from "../page";

export const STAFF_NAV: Array<{ id: StaffSection; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "/overview" },
  { id: "matters", label: "Matters", href: "/matters" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "alerts", label: "Alerts", href: "/alerts" },
  { id: "clients", label: "Clients", href: "/clients" },
  { id: "vault", label: "Vault", href: "/vault" },
  { id: "settings", label: "Settings", href: "/settings" },
];

interface SidebarProps {
  profile: StaffProfile;
  activeSection: StaffSection;
  signOut: () => void;
  unreadAlertsCount?: number;
}

export default function Sidebar({ profile, activeSection, signOut, unreadAlertsCount }: SidebarProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const activeNavLabel = STAFF_NAV.find((item) => item.id === activeSection)?.label ?? "Navigation";

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeSection]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <>
      {isMobileNavOpen ? (
        <button
          type="button"
          className="staff-nav-overlay"
          aria-label="Close navigation"
          onClick={() => setIsMobileNavOpen(false)}
        />
      ) : null}

      <div className="top-bar staff-shell-header">
        <button
          className={`staff-icon-button staff-menu-button ${isMobileNavOpen ? "staff-menu-button-hidden" : ""}`}
          type="button"
          onClick={() => setIsMobileNavOpen((open) => !open)}
          aria-expanded={isMobileNavOpen}
          aria-controls="staff-navigation"
          aria-label="Open navigation menu"
        >
          <span className="staff-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="staff-shell-title">
          <div className="eyebrow">Lawyer Portal</div>
          <h1 className="title" style={{ marginBottom: 0 }}>
            {profile.firm?.name}
          </h1>
        </div>
        <div className="actions staff-shell-actions">
          <button className="button staff-signout-button" type="button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>

      {activeSection !== "onboarding" ? (
        <section className={`panel staff-navigation-panel ${isMobileNavOpen ? "open" : ""}`} id="staff-navigation">
          <div className="staff-navigation-panel-header">
            <button
              type="button"
              className="staff-icon-button staff-nav-close-button"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
            <div>
              <div className="eyebrow">Navigation</div>
              <strong>{activeNavLabel}</strong>
            </div>
          </div>
          <div className="actions staff-nav-actions">
            {STAFF_NAV.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  className={`staff-nav-tab ${isActive ? "button" : "button-secondary"}`}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.id === "alerts" && typeof unreadAlertsCount === "number" && unreadAlertsCount > 0 && (
                    <span
                      className="badge conflict"
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "6px",
                        marginLeft: "2px",
                      }}
                    >
                      {unreadAlertsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
