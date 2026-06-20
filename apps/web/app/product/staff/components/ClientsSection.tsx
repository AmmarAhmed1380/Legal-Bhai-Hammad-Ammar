import { type Dispatch, type SetStateAction } from "react";
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
}: ClientsSectionProps) {
  return (
    <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Add Client</h2>
        <div className="grid">
          <div className="field">
            <label>Name:</label>
            <input
              value={newClient.displayName}
              onChange={(event) => setNewClient({ ...newClient, displayName: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Phone Number:</label>
            <input
              value={newClient.phone}
              onChange={(event) => setNewClient({ ...newClient, phone: event.target.value })}
            />
          </div>
          <div className="field">
            <label>Language:</label>
            <select
              className="input"
              value={newClient.language}
              onChange={(event) => setNewClient({ ...newClient, language: event.target.value })}
            >
              <option value="en">English</option>
              <option value="ur">Urdu</option>
            </select>
          </div>
        </div>
        <button className="button" type="button" onClick={createClient}>
          Create Client
        </button>
        <hr style={{ margin: "24px 0" }} />
        <h2 style={{ marginTop: 0 }}>Client CRM</h2>
        <div className="case-list">
          {clients.map((client) => (
            <button
              key={client.id}
              className="case-card"
              type="button"
              onClick={() => void openClient(client.id)}
              style={{ textAlign: "left", cursor: "pointer" }}
            >
              <strong>{client.displayName}</strong>
              <p className="muted">
                {formatPhone(client.phone)} · {client.matterCount} {client.matterCount === 1 ? "matter" : "matters"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {clientDetail ? (
        <section>
          <div className="panel" style={{ width: "100%" }}>
            <h2 style={{ marginTop: 0 }}>{clientDetail.client.displayName}</h2>
            <div className="info-list">
              <div>
                <strong>Phone:</strong> {formatPhone(clientDetail.client.phone)}
              </div>
              <div>
                <strong>Language:</strong>{" "}
                {clientDetail.client.language === "en"
                  ? "English"
                  : clientDetail.client.language === "ur"
                    ? "Urdu"
                    : clientDetail.client.language}
              </div>
              <div>
                <strong>Next Hearing:</strong>{" "}
                {clientDetail.client.nextHearingAt ? formatDateTime(clientDetail.client.nextHearingAt) : "TBC"}
              </div>
            </div>
            <hr style={{ margin: "24px 0" }} />
            <h3>Edit Client</h3>
            <div className="field">
              <label>Status</label>
              <select
                value={clientDraft.status}
                onChange={(event) => setClientDraft({ ...clientDraft, status: event.target.value })}
              >
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button className="button" type="button" onClick={updateClient}>
                Save Client
              </button>
              {clientDetail.client.status !== "archived" ? (
                <button className="button-danger" type="button" onClick={archiveClient}>
                  Archive Client
                </button>
              ) : null}
            </div>
            <hr style={{ margin: "24px 0" }} />
            <h3>Client Reminder Consent</h3>
            <p className="muted">Enable SMS only after the client has agreed to hearing reminders.</p>
            {clientNotificationPreference ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
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
                  onClick={saveClientNotificationPreference}
                >
                  Save Reminder Consent
                </button>
              </div>
            ) : null}
          </div>

          <div className="detail-grid">
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>Shared Matters</h2>
              <div className="grid">
                {clientDetail.matters.map((matter) => (
                  <button
                    key={matter.id}
                    className="case-card"
                    onClick={() => {
                      router.push("/matters");
                      void openMatter(matter.id);
                    }}
                    style={{ padding: 14, textAlign: "left", cursor: "pointer" }}
                  >
                    <strong>{matter.rawCaseNumber}</strong>
                    <p className="muted">{matter.title}</p>
                  </button>
                ))}
              </div>
            </div>

            <aside className="grid">
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Threads</h2>
                <div className="grid">
                  {clientDetail.threadSummaries.map((thread) => (
                    <button
                      key={thread.id}
                      className="case-card"
                      onClick={() => {
                        router.push("/matters");
                        void openMatter(thread.matter.id);
                      }}
                      style={{ padding: 14, textAlign: "left", cursor: "pointer" }}
                    >
                      <strong>{thread.matter.rawCaseNumber}</strong>
                      <p className="muted">{thread.lastMessage?.body ?? "No client message yet"}</p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}
    </section>
  );
}
