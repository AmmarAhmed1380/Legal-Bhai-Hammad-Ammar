import { type AlertRecord } from "../page";
import { formatDateTime, toTitleCase } from "./helpers";

interface AlertsSectionProps {
  alerts: AlertRecord[];
  markAlertRead: (alertId: string) => void;
}

export default function AlertsSection({ alerts, markAlertRead }: AlertsSectionProps) {
  return (
    <section>
      <div className="panel" style={{ width: "100%" }}>
        <h2 style={{ marginTop: 0 }}>Alerts Inbox</h2>
        <div className="grid">
          {alerts.map((alert) => (
            <div key={alert.id} className="case-card" style={{ padding: 14 }}>
              <div className="top-bar" style={{ marginBottom: 8 }}>
                <strong>{toTitleCase(alert.title)}</strong>
                {!alert.readAt ? (
                  <button className="button-secondary" type="button" onClick={() => markAlertRead(alert.id)}>
                    Mark Read
                  </button>
                ) : (
                  <span className="badge live">Read</span>
                )}
              </div>
              <p className="muted">{toTitleCase(alert.body)}</p>
              <div className="muted">{formatDateTime(alert.createdAt)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
