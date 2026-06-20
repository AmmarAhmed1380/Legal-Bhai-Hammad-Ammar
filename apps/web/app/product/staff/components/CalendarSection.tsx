import { type Dispatch, type SetStateAction } from "react";
import {
  type CalendarItem,
  type UnmatchedCauseEntry,
  type MatterListItem,
  type CourtSource,
} from "../page";
import { courtLabel, formatDateTime, toTitleCase } from "./helpers";

interface CalendarSectionProps {
  calendar: CalendarItem[];
  unmatchedCauseEntries: UnmatchedCauseEntry[];
  courtReviewMatterIds: Record<string, string>;
  setCourtReviewMatterIds: Dispatch<SetStateAction<Record<string, string>>>;
  matters: MatterListItem[];
  linkUnmatchedCauseEntry: (entryId: string) => void;
  calendarConflicts: CalendarItem[];
  courtSources: CourtSource[];
}

export default function CalendarSection({
  calendar,
  unmatchedCauseEntries,
  courtReviewMatterIds,
  setCourtReviewMatterIds,
  matters,
  linkUnmatchedCauseEntry,
  calendarConflicts,
  courtSources,
}: CalendarSectionProps) {
  return (
    <section className="detail-grid">
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Calendar And Conflicts</h2>
        <div className="grid">
          {calendar.map((item) => (
            <div
              key={item.id}
              className="case-card"
              style={{
                padding: 14,
                borderLeftColor: item.conflictState === "possible" ? "var(--accent)" : "var(--primary)",
              }}
            >
              <strong>{item.matter.rawCaseNumber}</strong>
              <p className="muted">{item.matter.title}</p>
              <div className="muted">
                {formatDateTime(item.listedAt)} • {item.sourceType}
              </div>
            </div>
          ))}
        </div>
        <hr style={{ margin: "24px 0" }} />
        <h2>Court Entries Needing Review</h2>
        <div className="grid">
          {unmatchedCauseEntries.length === 0 ? (
            <div className="muted">No unmatched court entries.</div>
          ) : (
            <p className="muted" style={{ marginBottom: 8 }}>
              Link only after confirming the cause-list entry belongs to one of your matters.
            </p>
          )}
          {unmatchedCauseEntries.map((entry) => (
            <div key={entry.id} className="case-card" style={{ padding: 14, borderLeftColor: "var(--accent)" }}>
              <strong>{entry.rawCaseNumber}</strong>
              <div className="muted">
                {courtLabel(entry.courtId ?? "")} • {toTitleCase(entry.listType)} • {entry.listDate} • {entry.courtroom ?? "Courtroom TBC"}
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>Confirmed workspace matter</label>
                <select
                  value={courtReviewMatterIds[entry.id] ?? ""}
                  onChange={(event) =>
                    setCourtReviewMatterIds({ ...courtReviewMatterIds, [entry.id]: event.target.value })
                  }
                >
                  <option value="">Select a matter</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.rawCaseNumber} • {matter.title}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="button-secondary"
                type="button"
                disabled={!courtReviewMatterIds[entry.id]}
                onClick={() => void linkUnmatchedCauseEntry(entry.id)}
              >
                Confirm And Link
              </button>
            </div>
          ))}
        </div>
      </div>

      <aside className="grid">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Possible Conflicts</h2>
          <div className="grid">
            {calendarConflicts.map((item) => (
              <div key={item.id}>
                <strong>{item.matter.rawCaseNumber}</strong>
                <div className="muted">{formatDateTime(item.listedAt)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Court Freshness</h2>
          <div className="grid">
            {courtSources.map((source) => (
              <div key={source.id}>
                <strong>{courtLabel(source.courtId)}</strong>
                <div className="muted">{formatDateTime(source.lastSuccessfulSyncAt)}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
