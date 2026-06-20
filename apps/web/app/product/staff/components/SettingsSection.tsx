import { type Dispatch, type SetStateAction } from "react";
import {
  type StaffProfile,
  type NotificationPreference,
  type TeamMember,
} from "../page";
import { formatPhone, formatRole, toTitleCase } from "./helpers";

interface SettingsSectionProps {
  profile: StaffProfile;
  settingsTab: "profile" | "workspace";
  setSettingsTab: Dispatch<SetStateAction<"profile" | "workspace">>;
  notificationPreference: NotificationPreference | null;
  setNotificationPreference: Dispatch<SetStateAction<NotificationPreference | null>>;
  saveNotificationPreference: () => void;
  teamMembers: TeamMember[];
  setTeamMembers: Dispatch<SetStateAction<TeamMember[]>>;
  invitePhone: string;
  setInvitePhone: Dispatch<SetStateAction<string>>;
  inviteEmail: string;
  setInviteEmail: Dispatch<SetStateAction<string>>;
  inviteRole: "owner" | "lawyer" | "assistant" | "billing" | "co_owner";
  setInviteRole: Dispatch<SetStateAction<"owner" | "lawyer" | "assistant" | "billing" | "co_owner">>;
  inviteOfficeLabel: string;
  setInviteOfficeLabel: Dispatch<SetStateAction<string>>;
  handleSendInvite: () => void;
  handleUpdateMembership: (membershipId: string, role: string, officeLabel: string | null) => void;
}

export default function SettingsSection({
  profile,
  settingsTab,
  setSettingsTab,
  notificationPreference,
  setNotificationPreference,
  saveNotificationPreference,
  teamMembers,
  setTeamMembers,
  invitePhone,
  setInvitePhone,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteOfficeLabel,
  setInviteOfficeLabel,
  handleSendInvite,
  handleUpdateMembership,
}: SettingsSectionProps) {
  const isOwnerOrCoOwner =
    profile.staffMembership.role === "owner" || profile.staffMembership.role === "co_owner";

  return (
    <section>
      {isOwnerOrCoOwner && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            className={settingsTab === "profile" ? "button" : "button-secondary"}
            onClick={() => setSettingsTab("profile")}
            style={{ flex: 1 }}
          >
            My Profile & Preferences
          </button>
          <button
            type="button"
            className={settingsTab === "workspace" ? "button" : "button-secondary"}
            onClick={() => setSettingsTab("workspace")}
            style={{ flex: 1 }}
          >
            Workspace Settings & Members
          </button>
        </div>
      )}

      {settingsTab === "profile" || !isOwnerOrCoOwner ? (
        <div className="grid">
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Profile And Session Settings</h2>
            <div className="info-list">
              <div>
                <strong>Name:</strong> {profile.staffUser.displayName}
              </div>
              <div>
                <strong>Phone:</strong> {formatPhone(profile.staffUser.phone)}
              </div>
              <div>
                <strong>Role:</strong> {formatRole(profile.staffMembership.role)}
              </div>
              <div>
                <strong>Language:</strong>{" "}
                {profile.staffUser.language === "en"
                  ? "English"
                  : profile.staffUser.language === "ur"
                    ? "Urdu"
                    : profile.staffUser.language}
              </div>
            </div>
          </div>
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Notification Preferences</h2>
            {notificationPreference ? (
              <div className="grid">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPreference.emailEnabled}
                    onChange={(event) =>
                      setNotificationPreference({
                        ...notificationPreference,
                        emailEnabled: event.target.checked,
                      })
                    }
                  />
                  Receive Lawyer Agenda Emails
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={notificationPreference.smsEnabled}
                    onChange={(event) =>
                      setNotificationPreference({
                        ...notificationPreference,
                        smsEnabled: event.target.checked,
                      })
                    }
                  />
                  Receive Lawyer Agenda SMS
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={Boolean(notificationPreference.optedOutAt)}
                    onChange={(event) =>
                      setNotificationPreference({
                        ...notificationPreference,
                        optedOutAt: event.target.checked ? new Date().toISOString() : null,
                      })
                    }
                  />
                  Pause All Notifications
                </label>
                <button className="button" type="button" onClick={saveNotificationPreference}>
                  Save Preferences
                </button>
              </div>
            ) : (
              <div className="muted">Notification preferences are unavailable.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid">
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Workspace / Firm Details</h2>
            {profile.firm ? (
              <div className="info-list" style={{ marginBottom: 20 }}>
                <div>
                  <strong>Firm Name:</strong> {profile.firm.name}
                </div>
                <div>
                  <strong>City:</strong> {profile.firm.primaryCity}
                </div>
                <div>
                  <strong>Timezone:</strong> {profile.firm.timezone}
                </div>
                <div>
                  <strong>Billing Plan:</strong> {profile.firm.billingPlan}
                </div>
                <div>
                  <strong>Status:</strong> <span className="badge live">{profile.firm.status}</span>
                </div>
              </div>
            ) : (
              <div className="muted">No workspace details found.</div>
            )}

            <h3 style={{ marginTop: 24, marginBottom: 12 }}>Invite New Member</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Phone Number (e.g. 03001234567)</label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Email Address (Optional)</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{ width: "100%" }}
                >
                  <option value="lawyer">Lawyer</option>
                  <option value="assistant">Assistant</option>
                  <option value="billing">Billing Officer</option>
                  <option value="co_owner">Co-Owner</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Office Label (e.g. Islamabad HQ)</label>
                <input
                  type="text"
                  value={inviteOfficeLabel}
                  onChange={(e) => setInviteOfficeLabel(e.target.value)}
                  placeholder=""
                />
              </div>
              <button className="button" type="button" onClick={handleSendInvite} style={{ marginTop: 8 }}>
                Send Invitation
              </button>
            </div>
          </div>

          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>Manage Employees / Staff</h2>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Total Members: {teamMembers.length}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "rgba(255, 255, 255, 0.4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong style={{ fontSize: "14px" }}>
                        {member.displayName === member.phone ? formatPhone(member.phone) : member.displayName}
                      </strong>
                      {member.email && (
                        <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                          {member.email}
                        </div>
                      )}
                      <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                        Phone: {formatPhone(member.phone)}
                      </div>
                      <div className="muted" style={{ fontSize: "12px", marginTop: "2px" }}>
                        Role: {formatRole(member.membership.role)}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span className={`badge ${member.status === "active" ? "live" : "secondary"}`}>
                        {toTitleCase(member.status)}
                      </span>
                      {member.membership.officeLabel && (
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {member.membership.officeLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Modify role / actions if not current user */}
                  {member.id !== profile.staffUser.id && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>Role:</span>
                      <select
                        value={member.membership.role}
                        onChange={(e) =>
                          handleUpdateMembership(
                            member.membership.id,
                            e.target.value,
                            member.membership.officeLabel
                          )
                        }
                        style={{ padding: "4px 8px", fontSize: "12px", height: "auto", width: "auto" }}
                      >
                        <option value="owner">Owner</option>
                        <option value="co_owner">Co-Owner</option>
                        <option value="lawyer">Lawyer</option>
                        <option value="assistant">Assistant</option>
                        <option value="billing">Billing Officer</option>
                      </select>

                      <input
                        type="text"
                        value={member.membership.officeLabel || ""}
                        placeholder="Office Label"
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          setTeamMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id
                                ? { ...m, membership: { ...m.membership, officeLabel: newLabel } }
                                : m
                            )
                          );
                        }}
                        onBlur={(e) => {
                          handleUpdateMembership(
                            member.membership.id,
                            member.membership.role,
                            e.target.value || null
                          );
                        }}
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          height: "auto",
                          flex: 1,
                          minWidth: 80,
                        }}
                      />
                    </div>
                  )}

                  {member.id === profile.staffUser.id && (
                    <div className="muted" style={{ fontSize: "11px", fontStyle: "italic", marginTop: "4px" }}>
                      You (Current User) — Role cannot be modified here.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
