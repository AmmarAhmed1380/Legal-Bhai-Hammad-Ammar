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
}

export default function Sidebar({ profile, activeSection, signOut }: SidebarProps) {
  return (
    <>
      <div className="top-bar">
        <div>
          <div className="eyebrow">Legal Bhai Lawyer Workspace</div>
          <h1 className="title" style={{ marginBottom: 4 }}>
            {profile.firm?.name}
          </h1>
          <p className="muted">
            {profile.staffUser.displayName} · {profile.staffMembership.role.charAt(0).toUpperCase() + profile.staffMembership.role.slice(1)} · {profile.staffMembership.officeLabel ?? "Main Office"}
          </p>
        </div>
        <div className="actions">
          <button className="button" type="button" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>

      {activeSection !== "onboarding" ? (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="actions" style={{ flexWrap: "wrap" }}>
            {STAFF_NAV.map((item) => (
              <Link
                key={item.id}
                className={activeSection === item.id ? "button" : "button-secondary"}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
