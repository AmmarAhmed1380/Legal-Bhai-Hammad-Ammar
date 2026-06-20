import { type ClientMatterDetail } from "../page";
import { formatDateTime } from "./helpers";

interface HearingsTabProps {
  selectedMatter: ClientMatterDetail;
}

export default function HearingsTab({ selectedMatter }: HearingsTabProps) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Hearings</h2>
      {selectedMatter.hearings.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No hearing events recorded for this matter.</p>
      ) : (
        <div className="grid">
          {selectedMatter.hearings.map((hearing) => (
            <article key={hearing.id} className="hearing">
              <strong>{formatDateTime(hearing.listedAt)}</strong>
              <div>{hearing.outcome}</div>
              {hearing.notes ? <p className="muted">{hearing.notes}</p> : null}
              {"nextDate" in hearing && hearing.nextDate ? (
                <div className="muted" style={{ marginTop: 6, fontSize: "12px" }}>
                  Next Date: {formatDateTime(hearing.nextDate)}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
