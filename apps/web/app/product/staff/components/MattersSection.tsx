import { type Dispatch, type SetStateAction } from "react";
import {
  type MatterListItem,
  type MatterDetail,
  type CsvImportPreview,
  type ClientSummary,
  type MessageRecord,
} from "../page";
import { PRODUCT_API_BASE_URL } from "../../../../lib/product-api";
import { courtLabel, formatDateTime, formatMimeType, toTitleCase } from "./helpers";

const PILOT_COURTS = [
  { id: "ihc", label: "Islamabad High Court" },
  { id: "lhc-rawalpindi-bench", label: "Lahore High Court Rawalpindi Bench" },
  { id: "rwp-district-sessions", label: "Rawalpindi District & Sessions Courts" },
  { id: "rwp-civil-courts", label: "Rawalpindi Civil Courts" },
  { id: "rwp-family-courts", label: "Rawalpindi Family Courts" },
  { id: "rwp-criminal-magisterial", label: "Rawalpindi Criminal & Magisterial Courts" },
] as const;

interface MattersSectionProps {
  newMatter: { courtId: string; rawCaseNumber: string; title: string; nextHearingAt: string };
  setNewMatter: Dispatch<SetStateAction<{ courtId: string; rawCaseNumber: string; title: string; nextHearingAt: string }>>;
  createMatter: () => void;
  csvImport: string;
  setCsvImport: Dispatch<SetStateAction<string>>;
  previewCsvImport: () => void;
  csvPreview: CsvImportPreview | null;
  confirmCsvImport: () => void;
  downloadRejectedRows: () => void;
  matterSearch: string;
  setMatterSearch: Dispatch<SetStateAction<string>>;
  matterStatusFilter: "all" | "open" | "closed";
  setMatterStatusFilter: Dispatch<SetStateAction<"all" | "open" | "closed">>;
  matters: MatterListItem[];
  openMatter: (matterId: string) => void;
  selectedMatter: MatterDetail | null;
  matterDraft: { courtId: string; rawCaseNumber: string; title: string; stage: string; status: string; nextHearingAt: string };
  setMatterDraft: Dispatch<SetStateAction<{ courtId: string; rawCaseNumber: string; title: string; stage: string; status: string; nextHearingAt: string }>>;
  saveMatter: () => void;
  archiveMatter: () => void;
  hearingListedAt: string;
  setHearingListedAt: Dispatch<SetStateAction<string>>;
  hearingOutcome: string;
  setHearingOutcome: Dispatch<SetStateAction<string>>;
  hearingNotes: string;
  setHearingNotes: Dispatch<SetStateAction<string>>;
  hearingNextDate: string;
  setHearingNextDate: Dispatch<SetStateAction<string>>;
  setHearingFile: Dispatch<SetStateAction<File | null>>;
  captureHearing: () => void;
  hearingStatus: string | null;
  matterClientId: string;
  setMatterClientId: Dispatch<SetStateAction<string>>;
  clients: ClientSummary[];
  linkClientToMatter: () => void;
  unlinkClientFromMatter: () => void;
  createPortalLink: () => void;
  portalUrl: string | null;
  messages: MessageRecord[];
  messageDraft: string;
  setMessageDraft: Dispatch<SetStateAction<string>>;
  sendMessage: () => void;
  partyNameDrafts: Record<string, string>;
  setPartyNameDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  updateParty: (partyId: string) => void;
  deleteParty: (partyId: string) => void;
  newParty: { displayName: string; partyType: "petitioner" | "respondent" | "applicant" | "other" };
  setNewParty: Dispatch<SetStateAction<{ displayName: string; partyType: "petitioner" | "respondent" | "applicant" | "other" }>>;
  addParty: () => void;
  documentUpload: { title: string; type: string; portalVisible: boolean };
  setDocumentUpload: Dispatch<SetStateAction<{ title: string; type: string; portalVisible: boolean }>>;
  setDocumentFile: Dispatch<SetStateAction<File | null>>;
  documentFile: File | null;
  uploadDocument: () => void;
  openDocument: (docId: string) => void;
}

export default function MattersSection({
  newMatter,
  setNewMatter,
  createMatter,
  csvImport,
  setCsvImport,
  previewCsvImport,
  csvPreview,
  confirmCsvImport,
  downloadRejectedRows,
  matterSearch,
  setMatterSearch,
  matterStatusFilter,
  setMatterStatusFilter,
  matters,
  openMatter,
  selectedMatter,
  matterDraft,
  setMatterDraft,
  saveMatter,
  archiveMatter,
  hearingListedAt,
  setHearingListedAt,
  hearingOutcome,
  setHearingOutcome,
  hearingNotes,
  setHearingNotes,
  hearingNextDate,
  setHearingNextDate,
  setHearingFile,
  captureHearing,
  hearingStatus,
  matterClientId,
  setMatterClientId,
  clients,
  linkClientToMatter,
  unlinkClientFromMatter,
  createPortalLink,
  portalUrl,
  messages,
  messageDraft,
  setMessageDraft,
  sendMessage,
  partyNameDrafts,
  setPartyNameDrafts,
  updateParty,
  deleteParty,
  newParty,
  setNewParty,
  addParty,
  documentUpload,
  setDocumentUpload,
  setDocumentFile,
  documentFile,
  uploadDocument,
  openDocument,
}: MattersSectionProps) {
  return (
    <section className="dashboard-grid" style={{ gridTemplateColumns: "380px minmax(0, 1fr)" }}>
      <aside className="panel">
        <h2 style={{ marginTop: 0 }}>Add Matter</h2>
        <div className="field">
          <label>Court</label>
          <div style={{ position: "relative", width: "100%" }}>
            <select
              value={newMatter.courtId}
              onChange={(event) => {
                setNewMatter({ ...newMatter, courtId: event.target.value });
                event.target.blur();
              }}
              style={{
                width: "100%",
                appearance: "none",
                backgroundImage: "none",
                paddingRight: "40px",
              }}
            >
              {PILOT_COURTS.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.label}
                </option>
              ))}
            </select>
            <div
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                color: "var(--text-secondary)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>
        <div className="field">
          <label>Case number</label>
          <input
            value={newMatter.rawCaseNumber}
            onChange={(event) => setNewMatter({ ...newMatter, rawCaseNumber: event.target.value })}
          />
        </div>
        <div className="field">
          <label>Title</label>
          <input
            value={newMatter.title}
            onChange={(event) => setNewMatter({ ...newMatter, title: event.target.value })}
          />
        </div>
        <div className="field">
          <label>Next Date</label>
          <input
            type="date"
            value={newMatter.nextHearingAt}
            onChange={(event) => setNewMatter({ ...newMatter, nextHearingAt: event.target.value })}
          />
        </div>
        <button className="button" type="button" onClick={createMatter}>
          Create Matter
        </button>
        <hr style={{ margin: "24px 0" }} />
        <h2>CSV Import</h2>
        <div
          className="case-card"
          style={{ padding: "14px", marginBottom: "14px", backgroundColor: "rgba(0,0,0,0.02)" }}
        >
          <strong style={{ display: "block", marginBottom: "6px", fontSize: "14px" }}>
            How does CSV Import work?
          </strong>
          <ol
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              lineHeight: "1.5",
              color: "var(--text-secondary)",
            }}
          >
            <li>Download the case import spreadsheet template.</li>
            <li>Add your cases inside Excel or Google Sheets.</li>
            <li>Copy the CSV data and paste it into the textbox below.</li>
            <li>
              Click <strong>Validate Import</strong> to preview duplicates or formatting issues, then confirm.
            </li>
          </ol>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            className="button-secondary"
            href={`${PRODUCT_API_BASE_URL}/v1/matters/import-template.csv`}
            style={{ textAlign: "center" }}
          >
            Download CSV Template
          </a>
          <textarea
            value={csvImport}
            onChange={(event) => setCsvImport(event.target.value)}
            placeholder="Paste your CSV data rows here"
            style={{ minHeight: 120 }}
          />
          <button className="button-secondary" type="button" onClick={previewCsvImport}>
            Validate Import
          </button>
        </div>
        {csvPreview ? (
          <div className="case-card" style={{ marginTop: 12, padding: 14 }}>
            <strong>
              {csvPreview.acceptedRows} accepted · {csvPreview.rejectedRows} rejected
            </strong>
            <div className="grid" style={{ marginTop: 10 }}>
              {csvPreview.rows.slice(0, 8).map((row) => (
                <div key={row.rowNumber}>
                  Row {row.rowNumber}:{" "}
                  <span className={`badge ${row.state === "rejected" ? "conflict" : "live"}`}>
                    {row.state}
                  </span>
                  {row.error ? <div className="muted">{row.error}</div> : null}
                </div>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              {csvPreview.status === "preview" && csvPreview.acceptedRows > 0 ? (
                <button className="button" type="button" onClick={confirmCsvImport}>
                  Confirm Import
                </button>
              ) : null}
              {csvPreview.rejectedRows > 0 ? (
                <button className="button-secondary" type="button" onClick={downloadRejectedRows}>
                  Download Rejected Rows
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <hr style={{ margin: "24px 0" }} />
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Matter Roster</h2>

        <div className="field" style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="🔍 Search case number or title..."
            value={matterSearch}
            onChange={(e) => setMatterSearch(e.target.value)}
            style={{ padding: "8px 12px", fontSize: "14px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: 16 }}>
          <button
            className="button-secondary"
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: matterStatusFilter === "all" ? "var(--primary-light)" : "transparent",
              color: matterStatusFilter === "all" ? "var(--primary-dark)" : "var(--text-secondary)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => setMatterStatusFilter("all")}
          >
            All
          </button>
          <button
            className="button-secondary"
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: matterStatusFilter === "open" ? "var(--primary-light)" : "transparent",
              color: matterStatusFilter === "open" ? "var(--primary-dark)" : "var(--text-secondary)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => setMatterStatusFilter("open")}
          >
            Open
          </button>
          <button
            className="button-secondary"
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: "12px",
              fontWeight: 600,
              backgroundColor: matterStatusFilter === "closed" ? "var(--primary-light)" : "transparent",
              color: matterStatusFilter === "closed" ? "var(--primary-dark)" : "var(--text-secondary)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            onClick={() => setMatterStatusFilter("closed")}
          >
            Closed
          </button>
        </div>

        <div className="case-list">
          {matters
            .filter((matter) => {
              const matchesSearch =
                matter.rawCaseNumber.toLowerCase().includes(matterSearch.toLowerCase()) ||
                matter.title.toLowerCase().includes(matterSearch.toLowerCase());
              const matchesStatus =
                matterStatusFilter === "all" ||
                (matterStatusFilter === "open" && matter.status === "open") ||
                (matterStatusFilter === "closed" &&
                  (matter.status === "closed" || matter.status === "on_hold"));
              return matchesSearch && matchesStatus;
            })
            .map((matter) => (
              <button
                key={matter.id}
                className="case-card"
                type="button"
                onClick={() => void openMatter(matter.id)}
                style={{ textAlign: "left", cursor: "pointer" }}
              >
                <div className="top-bar" style={{ marginBottom: 10 }}>
                  <strong>{matter.rawCaseNumber}</strong>
                  <span className="badge live">
                    {matter.stage.charAt(0).toUpperCase() + matter.stage.slice(1)}
                  </span>
                </div>
                <div>{matter.title}</div>
                <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
                  {courtLabel(matter.courtId)} · {matter.status.charAt(0).toUpperCase() + matter.status.slice(1)} ·
                  Next {matter.nextHearingAt ?? "TBC"}
                </p>
              </button>
            ))}
        </div>
      </aside>

      {selectedMatter ? (
        <section className="grid">
          <div className="detail-grid">
            <div className="grid">
              <div
                className="panel"
                style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>{selectedMatter.rawCaseNumber}</h2>
                <div style={{ margin: 0, fontSize: "14px", lineHeight: "1.4", color: "var(--text-secondary)" }}>
                  {selectedMatter.title}
                </div>
                <div className="info-list" style={{ gap: "8px", marginTop: "4px" }}>
                  <div>
                    <strong>Court:</strong> {courtLabel(selectedMatter.courtId)}
                  </div>
                  <div>
                    <strong>Stage:</strong> {toTitleCase(selectedMatter.stage)}
                  </div>
                  <div>
                    <strong>Type:</strong> {toTitleCase(selectedMatter.matterType)}
                  </div>
                  <div>
                    <strong>Next Hearing:</strong>{" "}
                    {selectedMatter.nextHearingAt ? formatDateTime(selectedMatter.nextHearingAt) : "TBC"}
                  </div>
                </div>
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Edit Matter</h2>
                <div className="field">
                  <label>Court</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <select
                      value={matterDraft.courtId}
                      onChange={(event) => {
                        setMatterDraft({ ...matterDraft, courtId: event.target.value });
                        event.target.blur();
                      }}
                      style={{
                        width: "100%",
                        appearance: "none",
                        backgroundImage: "none",
                        paddingRight: "40px",
                      }}
                    >
                      {PILOT_COURTS.map((court) => (
                        <option key={court.id} value={court.id}>
                          {court.label}
                        </option>
                      ))}
                    </select>
                    <div
                      style={{
                        position: "absolute",
                        right: "16px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Case number</label>
                  <input
                    value={matterDraft.rawCaseNumber}
                    onChange={(event) => setMatterDraft({ ...matterDraft, rawCaseNumber: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Title</label>
                  <input
                    value={matterDraft.title}
                    onChange={(event) => setMatterDraft({ ...matterDraft, title: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Stage</label>
                  <input
                    value={matterDraft.stage}
                    onChange={(event) => setMatterDraft({ ...matterDraft, stage: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select
                    value={matterDraft.status}
                    onChange={(event) => setMatterDraft({ ...matterDraft, status: event.target.value })}
                  >
                    <option value="open">Open</option>
                    <option value="on_hold">On hold</option>
                    <option value="closed">Closed / archived</option>
                  </select>
                </div>
                <div className="field">
                  <label>Next Date</label>
                  <input
                    type="date"
                    value={matterDraft.nextHearingAt}
                    onChange={(event) => setMatterDraft({ ...matterDraft, nextHearingAt: event.target.value })}
                  />
                </div>
                <div className="actions">
                  <button className="button" type="button" onClick={saveMatter}>
                    Save Matter
                  </button>
                  {matterDraft.status !== "closed" ? (
                    <button className="button-danger" type="button" onClick={archiveMatter}>
                      Archive Matter
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Hearings</h2>
                <div className="grid">
                  {selectedMatter.hearings.map((hearing) => (
                    <article key={hearing.id} className="hearing">
                      <strong>{formatDateTime(hearing.listedAt)}</strong>
                      <div>{hearing.outcome}</div>
                      <p className="muted">{hearing.notes}</p>
                      <div className="muted">
                        {hearing.sourceType}
                        {hearing.nextDate ? ` · Next ${hearing.nextDate}` : ""}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Parties</h2>
                <div className="grid">
                  {selectedMatter.parties.map((party) => (
                    <div key={party.id} className="case-card" style={{ padding: 14 }}>
                      <div className="field">
                        <label>{party.partyType.charAt(0).toUpperCase() + party.partyType.slice(1)}</label>
                        <input
                          value={partyNameDrafts[party.id] ?? party.displayName}
                          onChange={(event) =>
                            setPartyNameDrafts({ ...partyNameDrafts, [party.id]: event.target.value })
                          }
                        />
                      </div>
                      <div className="actions" style={{ marginTop: 10 }}>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => updateParty(party.id)}
                        >
                          Save
                        </button>
                        <button
                          className="button-danger"
                          type="button"
                          onClick={() => deleteParty(party.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Party name</label>
                  <input
                    value={newParty.displayName}
                    onChange={(event) => setNewParty({ ...newParty, displayName: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Party type</label>
                  <select
                    value={newParty.partyType}
                    onChange={(event) =>
                      setNewParty({
                        ...newParty,
                        partyType: event.target.value as typeof newParty.partyType,
                      })
                    }
                  >
                    <option value="petitioner">Petitioner</option>
                    <option value="respondent">Respondent</option>
                    <option value="applicant">Applicant</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button className="button-secondary" type="button" onClick={addParty}>
                  Add party
                </button>
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Documents</h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "16px",
                    marginTop: "16px",
                  }}
                >
                  {selectedMatter.documents.map((document) => (
                    <div
                      key={document.id}
                      onClick={() => openDocument(document.id)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        background: "var(--surface)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        transition: "all 0.2s ease",
                        overflow: "hidden",
                        minHeight: "160px",
                        boxShadow: "0 4px 12px rgba(15, 110, 86, 0.02)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.boxShadow = "0 12px 24px rgba(15, 110, 86, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 110, 86, 0.02)";
                      }}
                    >
                      {/* Top Section: Large File Type Thumbnail */}
                      <div
                        style={{
                          height: "90px",
                          background: "rgba(15, 110, 86, 0.04)",
                          borderBottom: "1px solid var(--border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          color: "var(--primary)",
                        }}
                      >
                        {document.mimeType.toLowerCase() === "application/pdf" ? (
                          <svg
                            width="36"
                            height="36"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                        ) : (
                          <svg
                            width="36"
                            height="36"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                        )}
                      </div>

                      {/* Bottom Section: Title Info */}
                      <div
                        style={{
                          padding: "12px 14px 13px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            fontSize: "13px",
                            textAlign: "center",
                            wordBreak: "break-all",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: "1.4",
                          }}
                          title={document.title}
                        >
                          {document.title}
                        </div>

                        <span
                          style={{
                            fontSize: document.type === "hearing_order" ? "10px" : "8.5px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: document.type === "hearing_order" ? "4px 8px" : "3px 6px",
                            borderRadius: "6px",
                            background: "rgba(255, 255, 255, 0.95)",
                            backdropFilter: "blur(4px)",
                            border: "1px solid rgba(15, 110, 86, 0.15)",
                            color: "var(--primary-dark)",
                            display: "inline-flex",
                            alignItems: "center",
                            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          {toTitleCase(document.type)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <hr style={{ margin: "24px 0" }} />
                <h3>Upload Private Document</h3>
                <div className="field">
                  <label>Title</label>
                  <input
                    value={documentUpload.title}
                    onChange={(event) =>
                      setDocumentUpload({ ...documentUpload, title: event.target.value })
                    }
                    placeholder="Uses file name when blank"
                  />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select
                    value={documentUpload.type}
                    onChange={(event) => setDocumentUpload({ ...documentUpload, type: event.target.value })}
                  >
                    <option value="hearing_order">Hearing order</option>
                    <option value="pleading">Pleading</option>
                    <option value="evidence">Evidence</option>
                    <option value="note">Note</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="field">
                  <label>File</label>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={documentUpload.portalVisible}
                    onChange={(event) =>
                      setDocumentUpload({ ...documentUpload, portalVisible: event.target.checked })
                    }
                  />
                  Share With Linked Client
                </label>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={!documentFile}
                  onClick={uploadDocument}
                >
                  Upload Document
                </button>
              </div>
            </div>

            <aside className="grid">
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Capture Hearing</h2>
                <div className="field">
                  <label>Listed at</label>
                  <input
                    type="datetime-local"
                    value={hearingListedAt}
                    onChange={(event) => setHearingListedAt(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Outcome</label>
                  <input
                    value={hearingOutcome}
                    onChange={(event) => setHearingOutcome(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Hearing Notes</label>
                  <textarea
                    value={hearingNotes}
                    onChange={(event) => setHearingNotes(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Next Date</label>
                  <input
                    type="date"
                    value={hearingNextDate}
                    onChange={(event) => setHearingNextDate(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Order Image Or PDF</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(event) => setHearingFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <button className="button" type="button" onClick={captureHearing}>
                  Save Hearing Update
                </button>
                {hearingStatus ? <p className="muted" style={{ marginTop: 12 }}>{hearingStatus}</p> : null}
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Client Access</h2>
                <p className="muted">Link a client account before generating its protected one-matter portal.</p>
                <div className="field">
                  <label>Client</label>
                  <select value={matterClientId} onChange={(event) => setMatterClientId(event.target.value)}>
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={!matterClientId}
                    onClick={linkClientToMatter}
                  >
                    Link Client To Matter
                  </button>
                  <button
                    className="button-danger"
                    type="button"
                    disabled={!matterClientId}
                    onClick={unlinkClientFromMatter}
                  >
                    Unlink Selected Client
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={!matterClientId}
                    onClick={createPortalLink}
                  >
                    Create Portal Link
                  </button>
                </div>
                {portalUrl ? (
                  <p className="muted" style={{ marginTop: 12, wordBreak: "break-all" }}>
                    <a href={portalUrl} target="_blank" rel="noreferrer">
                      {portalUrl}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="panel">
                <h2 style={{ marginTop: 0 }}>Chat</h2>
                <div
                  style={{
                    maxHeight: 280,
                    overflowY: "auto",
                    overflowX: "hidden",
                    paddingRight: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {messages.map((message) => {
                    const isMe = message.senderType === "staff";
                    return (
                      <div
                        key={message.id}
                        style={{
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          maxWidth: "75%",
                          backgroundColor: isMe ? "var(--primary-light)" : "#ffffff",
                          border: isMe ? "none" : "1px solid var(--border)",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          padding: "12px 16px",
                          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                          position: "relative",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "12px",
                            color: isMe ? "var(--primary-dark)" : "var(--text-secondary)",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          {isMe ? "Counsel" : "Client"}
                        </strong>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "var(--text-primary)",
                            wordBreak: "break-word",
                            lineHeight: "1.4",
                          }}
                        >
                          {message.body}
                        </p>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "var(--text-tertiary)",
                            marginTop: "4px",
                            textAlign: isMe ? "right" : "left",
                          }}
                        >
                          {message.deliveryChannel} · {formatDateTime(message.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", position: "relative", marginTop: 12 }}>
                  <input
                    type="text"
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Write a reply..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        sendMessage();
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "14px 50px 14px 20px",
                      borderRadius: "24px",
                      border: "1px solid var(--border)",
                      background: "rgba(255, 255, 255, 0.9)",
                      fontSize: "14px",
                      outline: "none",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!messageDraft.trim()}
                    style={{
                      position: "absolute",
                      right: "6px",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "none",
                      background: messageDraft.trim() ? "var(--primary)" : "var(--text-tertiary)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      padding: 0,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : null}
    </section>
  );
}
