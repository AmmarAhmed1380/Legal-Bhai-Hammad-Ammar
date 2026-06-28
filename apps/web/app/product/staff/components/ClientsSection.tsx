import { type Dispatch, type SetStateAction, useState, type CSSProperties } from "react";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  type ClientSummary,
  type ClientDetailPayload,
  type NotificationPreference,
} from "../page";
import { formatDateTime, formatPhone } from "./helpers";

interface ClientsSectionProps {
  newClient: { displayName: string; phone: string; language: string };
  setNewClient: Dispatch<SetStateAction<{ displayName: string; phone: string; language: string }>>;
  createClient: () => void;
  clients: ClientSummary[];
  openClient: (clientId: string) => void;
  clientDetail: ClientDetailPayload | null;
  clientDraft: { displayName: string; language: string; status: string };
  setClientDraft: Dispatch<SetStateAction<{ displayName: string; language: string; status: string }>>;
  updateClient: () => void;
  archiveClient: () => void;
  clientNotificationPreference: NotificationPreference | null;
  setClientNotificationPreference: Dispatch<SetStateAction<NotificationPreference | null>>;
  saveClientNotificationPreference: () => void;
  openMatter: (matterId: string) => void;
  router: AppRouterInstance;

  clientSearch: string;
  setClientSearch: Dispatch<SetStateAction<string>>;
  clientStatusFilter: "all" | "active" | "invited" | "archived";
  setClientStatusFilter: Dispatch<SetStateAction<"all" | "active" | "invited" | "archived">>;
}

export default function ClientsSection({
  newClient,
  setNewClient,
  createClient,
  clients,
  openClient,
  clientDetail,
  clientDraft,
  setClientDraft,
  updateClient,
  archiveClient,
  clientNotificationPreference,
  setClientNotificationPreference,
  saveClientNotificationPreference,
  openMatter,
  router,
  clientSearch,
  setClientSearch,
  clientStatusFilter,
  setClientStatusFilter,
}: ClientsSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const modalOverlayStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 37, 30, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(8px)",
  };

  const modalContentStyle: CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "18px",
    border: "1px solid var(--border)",
    padding: "32px",
    width: "90%",
    maxWidth: "520px",
    maxHeight: "85vh",
    overflowY: "auto",
    position: "relative",
    boxShadow: "0 24px 80px rgba(26, 26, 25, 0.2)",
  };

  const labelStyle: CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <section className="dashboard-grid clients-layout" style={{ gridTemplateColumns: "380px minmax(0, 1fr)", gap: "24px", minWidth: 0 }}>
      {/* Left Column: Clients Sidebar */}
      <aside className="panel clients-sidebar-panel" style={{ animation: "fadeIn 0.2s ease", boxSizing: "border-box", minWidth: 0 }}>
        <div className="clients-sidebar-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "20px", fontWeight: 800 }}>Clients</h2>
          <div className="clients-sidebar-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              className="button"
              type="button"
              onClick={() => setIsAddOpen(true)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                borderRadius: "8px"
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New
            </button>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search client name or phone..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            style={{ padding: "8px 12px", fontSize: "14px" }}
          />
        </div>

        <div className="clients-status-filter" style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          backgroundColor: "rgba(0, 0, 0, 0.03)",
          padding: "4px",
          borderRadius: "10px",
          border: "1px solid var(--border)",
          marginBottom: 16
        }}>
          {["all", "active", "invited", "archived"].map((status) => {
            const isActive = clientStatusFilter === status;
            return (
              <button
                key={status}
                className="button-secondary"
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "12px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: isActive ? "#ffffff" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                  boxShadow: isActive ? "0 2px 6px rgba(0, 0, 0, 0.05)" : "none",
                  transition: "all 0.2s ease",
                  textAlign: "center",
                  textTransform: "capitalize",
                }}
                onClick={() => setClientStatusFilter(status as any)}
              >
                {status}
              </button>
            );
          })}
        </div>

        <div className="case-list clients-list" style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
          {clients
            .filter((client) => {
              const matchesSearch =
                client.displayName.toLowerCase().includes(clientSearch.toLowerCase()) ||
                client.phone.includes(clientSearch);
              const matchesStatus =
                clientStatusFilter === "all" || client.status === clientStatusFilter;
              return matchesSearch && matchesStatus;
            })
            .map((client) => {
              const isSelected = clientDetail?.client.id === client.id;
              return (
                <button
                  key={client.id}
                  className="case-card"
                  type="button"
                  onClick={() => void openClient(client.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                    borderLeft: isSelected ? "4px solid var(--primary)" : "4px solid rgba(0, 0, 0, 0.08)",
                    backgroundColor: isSelected ? "rgba(15, 110, 86, 0.04)" : "var(--surface)",
                    width: "100%",
                    padding: "16px",
                    borderRadius: "14px",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    transform: isSelected ? "translateX(2px)" : "none",
                    boxShadow: isSelected ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = isSelected ? "translateX(4px)" : "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = isSelected ? "translateX(2px)" : "none";
                    e.currentTarget.style.boxShadow = isSelected ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{client.displayName}</strong>
                    <span className={`badge ${client.status === "active" ? "live" : "conflict"}`} style={{ fontSize: "9px", padding: "2px 6px" }}>
                      {client.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="muted" style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 11.24z" />
                      </svg>
                      <span>{formatPhone(client.phone)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>
                          {client.matterCount} {client.matterCount === 1 ? "matter" : "matters"}
                        </span>
                      </div>
                      {client.nextHearingAt && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span>Next: {formatDateTime(client.nextHearingAt).slice(0, 10)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      {/* Right Column: Client details and workspace */}
      <div className="clients-detail-column" style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
        {clientDetail ? (
          <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header Details Panel */}
            <div
              className="clients-detail-header panel"
              style={{
                padding: "24px",
                borderLeft: "6px solid var(--primary)",
                background: "linear-gradient(135deg, #ffffff 0%, #fafaf9 100%)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div className="clients-detail-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                <div className="clients-detail-copy">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <h2 className="clients-detail-title" style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "10px" }}>
                      {clientDetail.client.displayName}
                      <span className={`badge ${clientDetail.client.status === "active" ? "live" : "conflict"}`} style={{ fontSize: "11px", padding: "4px 10px" }}>
                        {clientDetail.client.status.toUpperCase()}
                      </span>
                    </h2>
                  </div>
                  <div className="clients-detail-actions" style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setIsEditOpen(true)}
                      style={{
                        padding: "0 10px",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        borderRadius: "8px",
                        height: "28px",
                        lineHeight: 1
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit Client
                    </button>
                    {clientDetail.client.status !== "archived" && (
                      <button
                        className="button-danger"
                        type="button"
                        onClick={archiveClient}
                        style={{
                          padding: "0 10px",
                          fontSize: "12px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          borderRadius: "8px",
                          height: "28px",
                          border: "1px solid var(--accent)",
                          backgroundColor: "transparent",
                          color: "var(--accent)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          lineHeight: 1
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--accent-light)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        Archive Client
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{
                height: "1px",
                backgroundColor: "var(--border)",
                margin: "4px 0"
              }} />

              <div className="clients-detail-meta" style={{ display: "flex", flexWrap: "wrap", gap: "24px", fontSize: "13px", color: "var(--text-secondary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 11.24z" />
                  </svg>
                  <span><strong>Phone:</strong> {formatPhone(clientDetail.client.phone)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>
                    <strong>Language:</strong>{" "}
                    {clientDetail.client.language === "en"
                      ? "English"
                      : clientDetail.client.language === "ur"
                        ? "Urdu"
                        : clientDetail.client.language}
                  </span>
                </div>
                {clientDetail.client.nextHearingAt && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span><strong>Next Hearing:</strong> {formatDateTime(clientDetail.client.nextHearingAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notification reminder consent */}
            <div className="panel clients-consent-panel" style={{ padding: "24px" }}>
              <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: "16px", fontWeight: 700 }}>Client Reminder Consent</h3>
              <p className="muted" style={{ marginBottom: 16, fontSize: "13px" }}>Enable SMS only after the client has agreed to hearing reminders.</p>
              {clientNotificationPreference ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="checkbox-row" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                      checked={clientNotificationPreference.smsEnabled}
                      disabled={clientDetail.client.status === "archived"}
                      onChange={(event) =>
                        setClientNotificationPreference({
                          ...clientNotificationPreference,
                          smsEnabled: event.target.checked,
                          optedOutAt: null,
                        })
                      }
                    />
                    Client Consented To SMS Reminders
                  </label>
                  <button
                    className="button-secondary"
                    type="button"
                    style={{ alignSelf: "flex-start", padding: "8px 16px", fontSize: "13px" }}
                    onClick={saveClientNotificationPreference}
                  >
                    Save Reminder Consent
                  </button>
                </div>
              ) : null}
            </div>

            {/* Split Grid for Matters and Threads */}
            <div className="equal-detail-grid clients-linked-grid">
              <div className="panel clients-linked-matters-panel" style={{ padding: "24px" }}>
                <h2 style={{ marginTop: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Shared Matters</h2>
                <div className="grid" style={{ gap: "12px" }}>
                  {clientDetail.matters.length === 0 ? (
                    <div className="muted" style={{ padding: "10px 0", fontSize: "13px" }}>No shared matters linked.</div>
                  ) : (
                    clientDetail.matters.map((matter) => (
                      <div key={matter.id} className="case-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{matter.rawCaseNumber}</strong>
                          <span className="badge live" style={{ fontSize: "9px", padding: "2px 6px" }}>
                            {matter.stage.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/matters");
                              openMatter(matter.id);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              background: "none",
                              border: "none",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              color: "var(--primary)",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              textDecoration: "underline",
                              transition: "background-color 0.2s",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(15, 110, 86, 0.05)")}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            {matter.title}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel clients-threads-panel" style={{ padding: "24px" }}>
                <h2 style={{ marginTop: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Threads</h2>
                <div className="grid" style={{ gap: "12px" }}>
                  {clientDetail.threadSummaries.length === 0 ? (
                    <div className="muted" style={{ padding: "10px 0", fontSize: "13px" }}>No chat threads available.</div>
                  ) : (
                    clientDetail.threadSummaries.map((thread) => (
                      <div key={thread.id} className="case-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>{thread.matter.rawCaseNumber}</strong>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/matters");
                              openMatter(thread.matter.id);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              background: "none",
                              border: "none",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              color: "var(--primary)",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              textDecoration: "underline",
                              transition: "background-color 0.2s",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(15, 110, 86, 0.05)")}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            {thread.matter.title}
                          </button>
                          <p className="muted" style={{ margin: "4px 0 0", fontSize: "12px", borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
                            <strong>Last message:</strong> {thread.lastMessage?.body ?? "No client message yet"}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="panel clients-empty-state" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
            <div className="muted" style={{ textAlign: "center", fontSize: "16px", fontWeight: 500 }}>
              Select a client from the list to view details.
            </div>
          </section>
        )}
      </div>

      {/* Add Client Modal */}
      {isAddOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsAddOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Add Client</h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  transition: "background-color 0.2s ease, color 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
                title="Close dialog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="field">
              <label style={labelStyle}>Name</label>
              <input
                value={newClient.displayName}
                onChange={(event) => setNewClient({ ...newClient, displayName: event.target.value })}
                placeholder="Full Name"
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Phone Number</label>
              <input
                value={newClient.phone}
                onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })}
                placeholder=""
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Language</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={newClient.language}
                  onChange={(event) => setNewClient({ ...newClient, language: event.target.value })}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <button
              className="button"
              type="button"
              onClick={() => {
                createClient();
                setIsAddOpen(false);
              }}
              style={{ width: "100%", marginTop: 12 }}
            >
              Create Client
            </button>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {isEditOpen && clientDetail && (
        <div style={modalOverlayStyle} onClick={() => setIsEditOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Edit Client</h2>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-secondary)",
                  transition: "background-color 0.2s ease, color 0.2s ease"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
                title="Close dialog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="field">
              <label style={labelStyle}>Name</label>
              <input
                value={clientDraft.displayName}
                onChange={(event) => setClientDraft({ ...clientDraft, displayName: event.target.value })}
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Language</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={clientDraft.language}
                  onChange={(event) => setClientDraft({ ...clientDraft, language: event.target.value })}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="field">
              <label style={labelStyle}>Status</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={clientDraft.status}
                  onChange={(event) => setClientDraft({ ...clientDraft, status: event.target.value })}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="archived">Archived</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="actions" style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button
                className="button"
                type="button"
                onClick={() => {
                  updateClient();
                  setIsEditOpen(false);
                }}
                style={{ flex: 1 }}
              >
                Save Client
              </button>
              {clientDetail.client.status !== "archived" ? (
                <button
                  className="button-danger"
                  type="button"
                  onClick={() => {
                    archiveClient();
                    setIsEditOpen(false);
                  }}
                  style={{ flex: 1 }}
                >
                  Archive Client
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
