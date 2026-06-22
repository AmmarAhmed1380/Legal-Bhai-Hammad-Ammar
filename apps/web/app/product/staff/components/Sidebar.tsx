import Link from "next/link";
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
  return (
    <>
      <div className="top-bar">
        <div>
          <div className="eyebrow">Lawyer Portal</div>
          <h1 className="title" style={{ marginBottom: 0 }}>
            {profile.firm?.name}
          </h1>
        </div>
        <div className="actions">
          <button className="button" type="button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>

      {activeSection !== "onboarding" ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="actions" style={{ flexWrap: "wrap", overflow: "visible", paddingTop: "4px", marginTop: "-4px" }}>
            {STAFF_NAV.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  className={isActive ? "button" : "button-secondary"}
                  href={item.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: "translateY(0)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    if (isActive) {
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.3)";
                    } else {
                      e.currentTarget.style.backgroundColor = "var(--primary-light)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 110, 86, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    if (isActive) {
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 110, 86, 0.2)";
                    } else {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  <span>{item.label}</span>
                  {item.id === "alerts" && typeof unreadAlertsCount === "number" && unreadAlertsCount > 0 && (
                    <span 
                      className="badge conflict" 
                      style={{ 
                        fontSize: "11px", 
                        padding: "2px 6px",
                        borderRadius: "6px",
                        marginLeft: "2px"
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
