import { type Dispatch, type SetStateAction, useState, type CSSProperties } from "react";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  type CalendarItem,
  type UnmatchedCauseEntry,
  type MatterListItem,
  type CourtSource,
} from "../page";
import { courtLabel, formatDateTime, formatSourceType, toTitleCase } from "./helpers";

interface CalendarSectionProps {
  calendar: CalendarItem[];
  unmatchedCauseEntries: UnmatchedCauseEntry[];
  courtReviewMatterIds: Record<string, string>;
  setCourtReviewMatterIds: Dispatch<SetStateAction<Record<string, string>>>;
  matters: MatterListItem[];
  linkUnmatchedCauseEntry: (entryId: string) => void;
  calendarConflicts: CalendarItem[];
  courtSources: CourtSource[];
  openMatter: (matterId: string) => void;
  router: AppRouterInstance;
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
  openMatter,
  router,
}: CalendarSectionProps) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Calendar Year/Month navigation states initialized dynamically to current date
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Popup detail modal state
  const [activeHearing, setActiveHearing] = useState<CalendarItem | null>(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Generate calendar days grid
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

  interface CalendarCell {
    day: number;
    isCurrentMonth: boolean;
    dateString: string;
  }

  const cells: CalendarCell[] = [];

  // Trailing previous month days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthTotalDays - i;
    const pm = currentMonth === 0 ? 11 : currentMonth - 1;
    const py = currentMonth === 0 ? currentYear - 1 : currentYear;
    const mStr = String(pm + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    cells.push({
      day,
      isCurrentMonth: false,
      dateString: `${py}-${mStr}-${dStr}`,
    });
  }

  // Active month days
  for (let i = 1; i <= totalDays; i++) {
    const mStr = String(currentMonth + 1).padStart(2, "0");
    const dStr = String(i).padStart(2, "0");
    cells.push({
      day: i,
      isCurrentMonth: true,
      dateString: `${currentYear}-${mStr}-${dStr}`,
    });
  }

  // Padding next month days to align grid to 42 cells (6 rows * 7 columns)
  const remainingCells = 42 - cells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nm = currentMonth === 11 ? 0 : currentMonth + 1;
    const ny = currentMonth === 11 ? currentYear + 1 : currentYear;
    const mStr = String(nm + 1).padStart(2, "0");
    const dStr = String(i).padStart(2, "0");
    cells.push({
      day: i,
      isCurrentMonth: false,
      dateString: `${ny}-${mStr}-${dStr}`,
    });
  }

  // Find hearings matching cell dateString (checks YYYY-MM-DD prefix)
  const getHearingsForDate = (dateStr: string) => {
    return calendar.filter((item) => {
      if (!item.listedAt) return false;
      return item.listedAt.startsWith(dateStr);
    });
  };

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

  const reviewPanelHeaderStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  };

  const reviewCardStyle = (tone: "conflict" | "review"): CSSProperties => ({
    position: "relative",
    overflow: "hidden",
    padding: "16px",
    borderRadius: "16px",
    border: tone === "conflict" ? "1px solid rgba(216, 90, 48, 0.18)" : "1px solid rgba(15, 110, 86, 0.14)",
    background:
      tone === "conflict"
        ? "linear-gradient(135deg, rgba(250, 236, 231, 0.95) 0%, rgba(255, 250, 247, 0.98) 100%)"
        : "linear-gradient(135deg, rgba(225, 245, 238, 0.92) 0%, rgba(247, 252, 250, 0.98) 100%)",
    boxShadow:
      tone === "conflict"
        ? "0 8px 24px rgba(216, 90, 48, 0.08)"
        : "0 8px 24px rgba(15, 110, 86, 0.06)",
  });

  const reviewEyebrowStyle = (tone: "conflict" | "review"): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: tone === "conflict" ? "var(--accent)" : "var(--primary-dark)",
    background: tone === "conflict" ? "rgba(216, 90, 48, 0.12)" : "rgba(15, 110, 86, 0.10)",
  });

  const reviewMetaStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 10px",
    alignItems: "center",
    color: "var(--text-secondary)",
    fontSize: "12px",
    minWidth: 0,
    overflowWrap: "anywhere",
  };

  const emptyStateStyle = (tone: "conflict" | "review"): CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderRadius: "16px",
    border: tone === "conflict" ? "1px dashed rgba(216, 90, 48, 0.24)" : "1px dashed rgba(15, 110, 86, 0.22)",
    background:
      tone === "conflict"
        ? "linear-gradient(135deg, rgba(250, 236, 231, 0.55) 0%, rgba(255, 250, 247, 0.88) 100%)"
        : "linear-gradient(135deg, rgba(225, 245, 238, 0.5) 0%, rgba(247, 252, 250, 0.88) 100%)",
  });

  const emptyStateIconStyle = (tone: "conflict" | "review"): CSSProperties => ({
    width: "36px",
    height: "36px",
    borderRadius: "12px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: tone === "conflict" ? "rgba(216, 90, 48, 0.12)" : "rgba(15, 110, 86, 0.12)",
    color: tone === "conflict" ? "var(--accent)" : "var(--primary)",
  });

  return (
    <section className="calendar-detail-grid staff-calendar-layout" style={{ minWidth: 0 }}>
      {/* Left Column: Possible Conflicts & Court Entries review */}
      <div className="calendar-review-column" style={{ display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
        {/* Possible Conflicts Panel */}
        <div className="panel">
          <div style={reviewPanelHeaderStyle}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>Possible Conflicts</h2>
              <div className="muted" style={{ fontSize: "12px" }}>Hearings that may overlap or need a manual check.</div>
            </div>
            <span style={reviewEyebrowStyle("conflict")}>{calendarConflicts.length} flagged</span>
          </div>
          {calendarConflicts.length === 0 ? (
            <div style={emptyStateStyle("conflict")}>
              <div style={emptyStateIconStyle("conflict")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>No scheduling conflicts</div>
                <div className="muted" style={{ fontSize: "13px", overflowWrap: "anywhere" }}>
                  Everything on the calendar appears to be aligned right now.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid">
              {calendarConflicts.map((item) => (
                <div key={item.id} style={reviewCardStyle("conflict")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={reviewEyebrowStyle("conflict")}>Possible overlap</div>
                      <div style={{ marginTop: 8, fontSize: "15px", fontWeight: 800, color: "var(--text-primary)", overflowWrap: "anywhere" }}>
                        {item.matter.rawCaseNumber}
                      </div>
                    </div>
                    <span className="badge conflict" style={{ flexShrink: 0 }}>Review</span>
                  </div>
                  <div style={reviewMetaStyle}>
                    <span>{formatDateTime(item.listedAt)}</span>
                    <span className="bullet-separator">•</span>
                    <span>{item.matter.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Court Entries Needing Review Panel */}
        <div className="panel">
          <div style={reviewPanelHeaderStyle}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>Court Entries Needing Review</h2>
              <div className="muted" style={{ fontSize: "12px" }}>Unmatched cause-list entries waiting for a matter match.</div>
            </div>
            <span style={reviewEyebrowStyle("review")}>{unmatchedCauseEntries.length} queued</span>
          </div>
          {unmatchedCauseEntries.length === 0 ? (
            <div style={emptyStateStyle("review")}>
              <div style={emptyStateIconStyle("review")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M5 7h14" />
                  <path d="M5 12h2" />
                  <path d="M5 17h2" />
                  <path d="M17 17h2" />
                  <path d="M17 12h2" />
                </svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>No court entries waiting for review</div>
                <div className="muted" style={{ fontSize: "13px", overflowWrap: "anywhere" }}>
                  New cause-list entries will appear here when they need a matter match.
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: "13px" }}>
                Link only after confirming the cause-list entry belongs to one of your matters.
              </p>
              <div className="grid">
                {unmatchedCauseEntries.map((entry) => (
                  <div key={entry.id} style={reviewCardStyle("review")}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "10px" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={reviewEyebrowStyle("review")}>Needs linking</div>
                        <div style={{ marginTop: 8, fontSize: "15px", fontWeight: 800, color: "var(--text-primary)", overflowWrap: "anywhere" }}>
                          {entry.rawCaseNumber}
                        </div>
                      </div>
                      <span className="badge live" style={{ flexShrink: 0 }}>Court Entry</span>
                    </div>
                    <div style={reviewMetaStyle}>
                      <span>{courtLabel(entry.courtId ?? "")}</span>
                      <span className="bullet-separator">•</span>
                      <span>{toTitleCase(entry.listType)}</span>
                      <span className="bullet-separator">•</span>
                      <span>{entry.listDate}</span>
                      <span className="bullet-separator">•</span>
                      <span>{entry.courtroom ?? "Courtroom TBC"}</span>
                    </div>
                    <div className="field" style={{ marginTop: 14 }}>
                      <label style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>
                        Confirmed workspace matter
                      </label>
                      <select
                        value={courtReviewMatterIds[entry.id] ?? ""}
                        onChange={(event) =>
                          setCourtReviewMatterIds({ ...courtReviewMatterIds, [entry.id]: event.target.value })
                        }
                      >
                        <option value="">Select a matter</option>
                        {matters.map((matter) => (
                          <option key={matter.id} value={matter.id}>
                            {matter.rawCaseNumber} - {matter.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={!courtReviewMatterIds[entry.id]}
                      onClick={() => void linkUnmatchedCauseEntry(entry.id)}
                      style={{ width: "100%", marginTop: 2 }}
                    >
                      Confirm And Link
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Monthly Calendar Panel */}
      <div className="panel calendar-month-panel" style={{ minWidth: 0 }}>
        <div className="calendar-month-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 className="calendar-month-title" style={{ margin: 0 }}>Monthly Calendar</h2>
          <div className="calendar-month-controls" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button 
              className="button-secondary" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                width: "32px", 
                height: "32px", 
                padding: 0, 
                borderRadius: "8px", 
                cursor: "pointer" 
              }} 
              onClick={handlePrevMonth}
              title="Previous Month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <strong style={{ fontSize: "16px", minWidth: "120px", textAlign: "center" }}>
              {monthNames[currentMonth]} {currentYear}
            </strong>
            <button 
              className="button-secondary" 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                width: "32px", 
                height: "32px", 
                padding: 0, 
                borderRadius: "8px", 
                cursor: "pointer" 
              }} 
              onClick={handleNextMonth}
              title="Next Month"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar Monthly Grid View */}
        <div className="calendar-grid-shell" style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", backgroundColor: "white", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.015)" }}>
          {/* Weekday labels header */}
          <div className="calendar-weekdays" style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "rgba(0, 0, 0, 0.02)",
            textAlign: "center",
            fontWeight: 800,
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "12px 0"
          }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => {
              const isWeekend = day === "Sun" || day === "Sat";
              return (
                <div key={day} style={{ color: isWeekend ? "var(--accent)" : "var(--text-secondary)" }}>{day}</div>
              );
            })}
          </div>

          {/* Monthly day grid cells */}
          <div className="calendar-day-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {cells.map((cell, idx) => {
              const cellHearings = getHearingsForDate(cell.dateString);
              const isToday = cell.dateString === todayStr;
              return (
                <div
                  key={idx}
                  className="calendar-cell"
                  style={{
                    borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--border)" : "none",
                    borderBottom: idx < 35 ? "1px solid var(--border)" : "none",
                    minHeight: "96px",
                    padding: "8px",
                    backgroundColor: isToday 
                      ? "rgba(15, 110, 86, 0.03)" 
                      : (cell.isCurrentMonth ? "white" : "rgba(0,0,0,0.015)"),
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: isToday ? "inset 0 0 0 1px rgba(15, 110, 86, 0.2)" : "none",
                  }}
                >
                  <div style={{
                    alignSelf: "flex-end",
                    fontWeight: 700,
                    fontSize: "11px",
                    color: isToday ? "white" : (cell.isCurrentMonth ? "var(--text-primary)" : "var(--text-tertiary)"),
                    marginBottom: "6px",
                    backgroundColor: isToday ? "var(--primary)" : "transparent",
                    borderRadius: isToday ? "50%" : "none",
                    width: isToday ? "20px" : "auto",
                    height: isToday ? "20px" : "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    {cell.day}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto" }}>
                    {cellHearings.map((hearing) => (
                      <button
                        key={hearing.id}
                        type="button"
                        onClick={() => setActiveHearing(hearing)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: hearing.conflictState === "possible" ? "var(--accent-light)" : "var(--primary-light)",
                          border: "none",
                          borderLeft: `3px solid ${hearing.conflictState === "possible" ? "var(--accent)" : "var(--primary)"}`,
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: hearing.conflictState === "possible" ? "var(--accent)" : "var(--primary-dark)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                          transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.06)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.02)";
                        }}
                        title={`${hearing.matter.rawCaseNumber}: ${hearing.matter.title}`}
                      >
                        {hearing.matter.rawCaseNumber}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hearing Details Overlay Modal */}
      {activeHearing && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Hearing Details</h2>
              <button
                type="button"
                onClick={() => setActiveHearing(null)}
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
            
          <div className="calendar-modal-body" style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
              <div className="field">
                <label style={labelStyle}>Case Number</label>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>{activeHearing.matter.rawCaseNumber}</div>
              </div>
              <div className="field">
                <label style={labelStyle}>Matter Title</label>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{activeHearing.matter.title}</div>
              </div>
              <div className="field">
                <label style={labelStyle}>Listed At</label>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{formatDateTime(activeHearing.listedAt)}</div>
              </div>
              <div className="calendar-modal-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="field">
                  <label style={labelStyle}>Courtroom</label>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{activeHearing.courtroom ?? "TBC"}</div>
                </div>
                <div className="field">
                  <label style={labelStyle}>Bench</label>
                  <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{activeHearing.bench ?? "TBC"}</div>
                </div>
              </div>
              <div className="field">
                <label style={labelStyle}>Sync Source</label>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{formatSourceType(activeHearing.sourceType)}</div>
              </div>
            </div>

            <div className="calendar-modal-actions" style={{ display: "flex", gap: "10px" }}>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setActiveHearing(null)}
                style={{ flex: 1 }}
              >
                Close
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  router.push("/matters");
                  openMatter(activeHearing.matter.id);
                  setActiveHearing(null);
                }}
                style={{ flex: 1 }}
              >
                Open Matter
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
