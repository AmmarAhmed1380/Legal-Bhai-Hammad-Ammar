import { type Dispatch, type SetStateAction, useRef, useState, type CSSProperties } from "react";
import {
  type MatterListItem,
  type MatterDetail,
  type CsvImportPreview,
  type ClientSummary,
  type MessageRecord,
} from "../page";
import { PRODUCT_API_BASE_URL } from "../../../../lib/product-api";
import { courtLabel, formatDateTime, formatMimeType, formatSourceType, toTitleCase } from "./helpers";
import CustomSelect from "./CustomSelect";

type MatterDraft = {
  courtId: string;
  rawCaseNumber: string;
  title: string;
  stage: string;
  status: string;
  nextHearingAt: string;
};

function formatMutationError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.startsWith("Unable to") ? error.message : `${fallback}: ${error.message}`;
  }
  return fallback;
}

function FormErrorBanner({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return <div className="form-error-banner">{message}</div>;
}

const PILOT_COURTS = [
  { id: "ihc", label: "Islamabad High Court" },
  { id: "lhc-rawalpindi-bench", label: "Lahore High Court Rawalpindi Bench" },
  { id: "rwp-district-sessions", label: "Rawalpindi District & Sessions Courts" },
  { id: "rwp-civil-courts", label: "Rawalpindi Civil Courts" },
  { id: "rwp-family-courts", label: "Rawalpindi Family Courts" },
  { id: "rwp-criminal-magisterial", label: "Rawalpindi Criminal & Magisterial Courts" },
] as const;

const OUTCOME_PRESETS = [
  "Adjourned",
  "Arguments Completed",
  "Order Pronounced",
  "Evidence Recorded",
  "Pleadings Filed",
  "Interim Relief Granted"
];

interface MattersSectionProps {
  newMatter: { courtId: string; rawCaseNumber: string; title: string; nextHearingAt: string };
  setNewMatter: Dispatch<SetStateAction<{ courtId: string; rawCaseNumber: string; title: string; nextHearingAt: string }>>;
  createMatter: (signal?: AbortSignal) => Promise<void>;
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
  matterDraft: MatterDraft;
  setMatterDraft: Dispatch<SetStateAction<MatterDraft>>;
  saveMatter: (patch?: MatterDraft, signal?: AbortSignal) => Promise<void>;
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
  hearingFile: File | null;
  captureHearing: (signal?: AbortSignal) => Promise<void>;
  hearingStatus: string | null;
  matterClientId: string;
  setMatterClientId: Dispatch<SetStateAction<string>>;
  clients: ClientSummary[];
  linkClientToMatter: (clientIdOverride?: string) => void;
  unlinkClientFromMatter: (clientIdOverride?: string) => void;
  createPortalLink: (clientIdOverride?: string) => void;
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
  uploadDocument: (signal?: AbortSignal) => Promise<void>;
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
  hearingFile,
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
  const [activeTab, setActiveTab] = useState<"hearings" | "documents" | "chat" | "admin" | "access">("hearings");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [hoveredPartyId, setHoveredPartyId] = useState<string | null>(null);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [nextDateFixed, setNextDateFixed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCaptureHearingOpen, setIsCaptureHearingOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [isCreatingMatter, setIsCreatingMatter] = useState(false);
  const [isSavingMatter, setIsSavingMatter] = useState(false);
  const [isCapturingHearing, setIsCapturingHearing] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [createMatterError, setCreateMatterError] = useState<string | null>(null);
  const [saveMatterError, setSaveMatterError] = useState<string | null>(null);
  const [captureHearingError, setCaptureHearingError] = useState<string | null>(null);
  const [uploadDocumentError, setUploadDocumentError] = useState<string | null>(null);
  const createMatterAbortRef = useRef<AbortController | null>(null);
  const saveMatterAbortRef = useRef<AbortController | null>(null);
  const captureHearingAbortRef = useRef<AbortController | null>(null);
  const uploadDocumentAbortRef = useRef<AbortController | null>(null);
  const [copiedPortalUrl, setCopiedPortalUrl] = useState(false);

  const tabButtonStyle = (isActive: boolean): CSSProperties => ({
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 700,
    borderRadius: "8px",
    border: "none",
    backgroundColor: isActive ? "#ffffff" : "transparent",
    color: isActive ? "var(--primary)" : "var(--text-secondary)",
    cursor: "pointer",
    boxShadow: isActive ? "0 2px 8px rgba(0, 0, 0, 0.05)" : "none",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    transform: "translateY(0)",
  });

  const handleTabMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) => {
    e.currentTarget.style.transform = "translateY(-2px)";
    if (isActive) {
      e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.15)";
    } else {
      e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
    }
  };

  const handleTabMouseLeave = (e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) => {
    e.currentTarget.style.transform = "translateY(0)";
    if (isActive) {
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
    } else {
      e.currentTarget.style.backgroundColor = "transparent";
    }
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

  const getStageBadgeClass = (stage: string) => {
    const s = stage.toLowerCase();
    if (s === "arguments") return "badge conflict";
    if (s === "evidence") return "badge demo";
    if (s === "judgment" || s === "final") return "badge conflict";
    return "badge live";
  };

  const runMutation = async (
    abortRef: { current: AbortController | null },
    setSubmitting: Dispatch<SetStateAction<boolean>>,
    setError: Dispatch<SetStateAction<string | null>>,
    action: (signal: AbortSignal) => Promise<void>,
    fallbackMessage: string,
  ): Promise<boolean> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSubmitting(true);
    setError(null);
    try {
      await action(controller.signal);
      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        return false;
      }
      setError(formatMutationError(error, fallbackMessage));
      return false;
    } finally {
      if (!controller.signal.aborted) {
        setSubmitting(false);
      }
    }
  };

  const handleCreateMatter = async () => {
    const ok = await runMutation(
      createMatterAbortRef,
      setIsCreatingMatter,
      setCreateMatterError,
      createMatter,
      "Unable to create matter",
    );
    if (ok) {
      setIsAddOpen(false);
    }
  };

  const handleSaveMatter = async () => {
    const ok = await runMutation(
      saveMatterAbortRef,
      setIsSavingMatter,
      setSaveMatterError,
      (signal) => saveMatter(matterDraft, signal),
      "Unable to save matter",
    );
    if (ok) {
      setIsEditOpen(false);
    }
  };

  const handleCaptureHearing = async () => {
    const ok = await runMutation(
      captureHearingAbortRef,
      setIsCapturingHearing,
      setCaptureHearingError,
      captureHearing,
      "Unable to save hearing update",
    );
    if (ok) {
      setIsCaptureHearingOpen(false);
    }
  };

  const handleUploadDocument = async () => {
    const ok = await runMutation(
      uploadDocumentAbortRef,
      setIsUploadingDocument,
      setUploadDocumentError,
      uploadDocument,
      "Unable to upload document",
    );
    if (ok) {
      setIsUploadDocOpen(false);
    }
  };

  const renderMattersSidebar = (alignWithTabPanel: boolean) => (
    <aside
      className={`panel${alignWithTabPanel ? " matters-roster-panel" : ""}`}
      style={{
        animation: "fadeIn 0.2s ease",
        boxSizing: "border-box",
        ...(alignWithTabPanel ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflowX: "hidden" } : {}),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "20px", fontWeight: 800 }}>Matters</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
          <button
            className="button-secondary"
            type="button"
            onClick={() => setIsImportOpen(true)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "8px"
            }}
          >
            Import
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            title="Hide matters list"
            className="button-secondary"
            style={{
              padding: "6px 8px",
              fontSize: "12px",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <path d="M14 9l-3 3 3 3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Search case number or title..."
          value={matterSearch}
          onChange={(e) => setMatterSearch(e.target.value)}
          style={{ padding: "8px 12px", fontSize: "14px" }}
        />
      </div>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: "rgba(0, 0, 0, 0.03)",
        padding: "4px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        marginBottom: 16
      }}>
        <button
          className="button-secondary"
          style={{
            flex: 1,
            padding: "6px 0",
            fontSize: "12px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "none",
            backgroundColor: matterStatusFilter === "all" ? "#ffffff" : "transparent",
            color: matterStatusFilter === "all" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer",
            boxShadow: matterStatusFilter === "all" ? "0 2px 6px rgba(0, 0, 0, 0.05)" : "none",
            transition: "all 0.2s ease",
            textAlign: "center",
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
            fontWeight: 700,
            borderRadius: "6px",
            border: "none",
            backgroundColor: matterStatusFilter === "open" ? "#ffffff" : "transparent",
            color: matterStatusFilter === "open" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer",
            boxShadow: matterStatusFilter === "open" ? "0 2px 6px rgba(0, 0, 0, 0.05)" : "none",
            transition: "all 0.2s ease",
            textAlign: "center",
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
            fontWeight: 700,
            borderRadius: "6px",
            border: "none",
            backgroundColor: matterStatusFilter === "closed" ? "#ffffff" : "transparent",
            color: matterStatusFilter === "closed" ? "var(--primary)" : "var(--text-secondary)",
            cursor: "pointer",
            boxShadow: matterStatusFilter === "closed" ? "0 2px 6px rgba(0, 0, 0, 0.05)" : "none",
            transition: "all 0.2s ease",
            textAlign: "center",
          }}
          onClick={() => setMatterStatusFilter("closed")}
        >
          Closed
        </button>
      </div>

      <div
        className={`case-list${alignWithTabPanel ? " matters-roster-list" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          ...(alignWithTabPanel ? { flex: 1, minHeight: 0, minWidth: 0, overflowY: "auto", overflowX: "hidden", paddingTop: 8 } : {}),
        }}
      >
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
                .map((matter) => {
                  const isSelected = selectedMatter?.id === matter.id;
                  return (
                    <button
                      key={matter.id}
                      className="case-card"
                      type="button"
                      onClick={() => void openMatter(matter.id)}
                      style={{
                        textAlign: "left",
                        cursor: "pointer",
                        border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                        borderLeft: isSelected ? "4px solid var(--primary)" : "4px solid rgba(0, 0, 0, 0.08)",
                        backgroundColor: isSelected ? "rgba(15, 110, 86, 0.04)" : "var(--surface)",
                        width: "100%",
                        minWidth: 0,
                        maxWidth: "100%",
                        padding: "16px",
                        borderRadius: "14px",
                        transform: "none",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: isSelected ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = isSelected ? "0 4px 12px rgba(15, 110, 86, 0.05)" : "none";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, minWidth: 0 }}>
                        <strong style={{ fontSize: "14px", color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{matter.rawCaseNumber}</strong>
                        <span className={getStageBadgeClass(matter.stage)} style={{ fontSize: "9px", padding: "2px 6px", flexShrink: 0 }}>
                          {matter.stage.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {matter.title}
                      </div>
                      <div className="muted" style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", borderTop: "1px solid rgba(0,0,0,0.03)", paddingTop: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {courtLabel(matter.courtId)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0, flex: 1 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" style={{ opacity: 0.85, flexShrink: 0 }}>
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {matter.nextHearingAt ? `Next: ${formatDateTime(matter.nextHearingAt)}` : "No upcoming hearings"}
                            </span>
                          </div>
                          <span className={`badge ${matter.status === "open" ? "live" : "conflict"}`} style={{ fontSize: "9px", padding: "2px 8px", flexShrink: 0 }}>
                            {matter.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>
  );

  return (
    <section
      className="dashboard-grid"
      style={{
        gridTemplateColumns: isSidebarOpen ? "400px minmax(0, 1fr)" : "1fr",
        gap: "24px",
        alignItems: "stretch",
      }}
    >
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          style={{
            position: "fixed",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--primary)",
            color: "white",
            border: "1px solid var(--primary-dark)",
            borderLeft: "none",
            cursor: "pointer",
            padding: 0,
            borderRadius: "0 8px 8px 0",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "2px 0 10px rgba(15, 110, 86, 0.15)",
            zIndex: 1000,
            width: "20px",
            height: "48px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.width = "24px";
            e.currentTarget.style.backgroundColor = "var(--primary-dark)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.width = "20px";
            e.currentTarget.style.backgroundColor = "var(--primary)";
          }}
          title="Expand Sidebar"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <path d="M14 9l3 3-3 3" />
          </svg>
        </button>
      )}

      {!selectedMatter && isSidebarOpen ? renderMattersSidebar(false) : null}

      {selectedMatter && isSidebarOpen ? (
        <div className="matters-roster-column">{renderMattersSidebar(true)}</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", minHeight: 0 }}>
      {selectedMatter ? (
        <>
            <div
              className="panel"
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: "10px" }}>
                      {selectedMatter.rawCaseNumber}
                      <span className={`badge ${selectedMatter.status === "open" ? "live" : "conflict"}`} style={{ fontSize: "11px", padding: "4px 10px" }}>
                        {toTitleCase(selectedMatter.status)}
                      </span>
                    </h2>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500, lineHeight: "1.5", color: "var(--text-secondary)" }}>
                      {selectedMatter.title}
                    </span>
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
                      Edit Matter
                    </button>
                    {selectedMatter.status !== "closed" && (
                      <button
                        className="button-danger"
                        type="button"
                        onClick={archiveMatter}
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
                        Close Matter
                      </button>
                    )}
                  </div>
                </div>
                {selectedMatter.nextHearingAt && (
                  <div style={{
                    backgroundColor: "var(--accent-light)",
                    color: "var(--accent)",
                    border: "1px solid rgba(216, 90, 48, 0.15)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Next Hearing: {formatDateTime(selectedMatter.nextHearingAt)}
                  </div>
                )}
              </div>

              <div style={{
                height: "1px",
                backgroundColor: "var(--border)",
                margin: "4px 0"
              }} />

              <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", fontSize: "13px", color: "var(--text-secondary)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span><strong>Court:</strong> {courtLabel(selectedMatter.courtId)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span><strong>Stage:</strong> {toTitleCase(selectedMatter.stage)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" style={{ opacity: 0.85 }}>
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                  <span><strong>Type:</strong> {toTitleCase(selectedMatter.matterType)}</span>
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs Menu (Segment-control style) */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", marginBottom: "4px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(0, 0, 0, 0.03)",
                padding: "6px",
                borderRadius: "12px",
                width: "fit-content",
                border: "1px solid var(--border)",
                overflow: "visible"
              }}>
                <button
                  type="button"
                  style={tabButtonStyle(activeTab === "hearings")}
                  onClick={() => setActiveTab("hearings")}
                  onMouseEnter={(e) => handleTabMouseEnter(e, activeTab === "hearings")}
                  onMouseLeave={(e) => handleTabMouseLeave(e, activeTab === "hearings")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Hearings
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(activeTab === "documents")}
                  onClick={() => setActiveTab("documents")}
                  onMouseEnter={(e) => handleTabMouseEnter(e, activeTab === "documents")}
                  onMouseLeave={(e) => handleTabMouseLeave(e, activeTab === "documents")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Documents
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(activeTab === "chat")}
                  onClick={() => setActiveTab("chat")}
                  onMouseEnter={(e) => handleTabMouseEnter(e, activeTab === "chat")}
                  onMouseLeave={(e) => handleTabMouseLeave(e, activeTab === "chat")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Chat
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(activeTab === "admin")}
                  onClick={() => setActiveTab("admin")}
                  onMouseEnter={(e) => handleTabMouseEnter(e, activeTab === "admin")}
                  onMouseLeave={(e) => handleTabMouseLeave(e, activeTab === "admin")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Parties
                </button>
                <button
                  type="button"
                  style={tabButtonStyle(activeTab === "access")}
                  onClick={() => setActiveTab("access")}
                  onMouseEnter={(e) => handleTabMouseEnter(e, activeTab === "access")}
                  onMouseLeave={(e) => handleTabMouseLeave(e, activeTab === "access")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Access
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="tab-content" style={{ marginTop: 0, minHeight: 0 }}>
              {activeTab === "hearings" && (
                <div className="panel" style={{ padding: "24px", position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Hearing Timeline</h3>
                    <button
                      className="button"
                      type="button"
                      onClick={() => setIsCaptureHearingOpen(true)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "10px"
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Capture Hearing
                    </button>
                  </div>
                  {selectedMatter.hearings.length === 0 ? (
                    <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: 12 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <div>No hearings recorded yet.</div>
                    </div>
                  ) : (
                    <div style={{ position: "relative", paddingLeft: "24px" }}>
                      {/* Timeline vertical bar */}
                      <div style={{
                        position: "absolute",
                        left: "8px",
                        top: "10px",
                        bottom: "10px",
                        width: "2px",
                        backgroundColor: "rgba(15, 110, 86, 0.15)",
                      }} />

                      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        {selectedMatter.hearings.map((hearing) => (
                          <div key={hearing.id} style={{ position: "relative" }}>
                            {/* Timeline Bullet node */}
                            <div style={{
                              position: "absolute",
                              left: "-21px",
                              top: "4px",
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              backgroundColor: "var(--primary)",
                              border: "3px solid #ffffff",
                              boxShadow: "0 0 0 2px rgba(15, 110, 86, 0.2)",
                              zIndex: 2,
                            }} />

                            {/* Hearing Card Content */}
                            <div className="hearing-card-content" style={{
                              background: "#ffffff",
                              border: "1px solid var(--border)",
                              borderRadius: "12px",
                              padding: "16px",
                              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                              transition: "all 0.2s ease"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--primary)" }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                  </svg>
                                  {formatDateTime(hearing.listedAt)}
                                </div>
                                <span className="badge live" style={{ fontSize: "10px", padding: "3px 8px" }}>
                                  {formatSourceType(hearing.sourceType)}
                                </span>
                              </div>
                              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                                {hearing.outcome}
                              </div>
                              {hearing.notes && (
                                <p className="muted" style={{ fontSize: "13px", margin: "0 0 10px 0", lineHeight: "1.4" }}>
                                  {hearing.notes}
                                </p>
                              )}
                              {hearing.nextDate && (
                                <div style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  color: "var(--accent)",
                                  background: "var(--accent-light)",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid rgba(216, 90, 48, 0.1)"
                                }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  Next Date: {formatDateTime(hearing.nextDate)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "documents" && (
                <div className="panel" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Documents</h3>
                    <button
                      className="button"
                      type="button"
                      onClick={() => setIsUploadDocOpen(true)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "10px"
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Upload Document
                    </button>
                  </div>

                  {selectedMatter.documents.length === 0 ? (
                    <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>No documents uploaded.</div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: "16px",
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
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            overflow: "hidden",
                            minHeight: "130px",
                            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
                            transition: "transform 0.2s ease",
                          }}
                        >
                          <div
                            style={{
                              height: "70px",
                              background: "rgba(15, 110, 86, 0.04)",
                              borderBottom: "1px solid var(--border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--primary)",
                            }}
                          >
                            {document.mimeType.toLowerCase() === "application/pdf" ? (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            ) : (
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                            )}
                          </div>
                          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, justifyContent: "space-between" }}>
                            <div style={{ fontWeight: 700, fontSize: "12px", wordBreak: "break-all" }}>
                              {document.title}
                            </div>
                            <span style={{ fontSize: "10px", color: "var(--text-secondary)", alignSelf: "flex-start", background: "#f3f4f6", padding: "2px 6px", borderRadius: "10px" }}>
                              {toTitleCase(document.type)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "chat" && (
                <div className="panel" style={{ width: "100%", margin: 0, padding: "24px" }}>
                  <h2 style={{ marginTop: 0, marginBottom: "20px" }}>Chat</h2>
                  <div
                    style={{
                      maxHeight: 400,
                      overflowY: "auto",
                      paddingRight: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      minHeight: "200px",
                    }}
                  >
                    {messages.length === 0 ? (
                      <div className="muted" style={{ margin: "auto", textAlign: "center" }}>No messages yet. Start the conversation below.</div>
                    ) : (
                      messages.map((message) => {
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
                            }}
                          >
                            <strong style={{ fontSize: "11px", color: isMe ? "var(--primary-dark)" : "var(--text-secondary)", display: "block", marginBottom: "2px" }}>
                              {isMe ? "Counsel" : "Client"}
                            </strong>
                            <p style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", wordBreak: "break-word" }}>
                              {message.body}
                            </p>
                            <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "4px", textAlign: isMe ? "right" : "left", display: "flex", alignItems: "center", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                              {message.deliveryChannel && message.deliveryChannel !== "in_app" && message.deliveryChannel !== "in-app" && (
                                <>
                                  <span style={{ textTransform: "capitalize" }}>{message.deliveryChannel.replace(/_/g, " ")}</span>
                                  <span className="bullet-separator">•</span>
                                </>
                              )}
                              {formatDateTime(message.createdAt)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", position: "relative", marginTop: 16 }}>
                    <input
                      type="text"
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          sendMessage();
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "12px 50px 12px 16px",
                        borderRadius: "20px",
                        border: "1px solid var(--border)",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!messageDraft.trim()}
                      style={{
                        position: "absolute",
                        right: "6px",
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        border: "none",
                        background: messageDraft.trim() ? "var(--primary)" : "var(--text-tertiary)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "admin" && (
                <div className="panel" style={{ padding: "24px" }}>
                  {/* Parties Configurations */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h2 style={{ margin: 0 }}>Parties</h2>
                    <button
                      className="button"
                      type="button"
                      onClick={() => setIsAddPartyOpen(true)}
                      style={{
                        padding: "8px 16px",
                        fontSize: "13px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "10px"
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add Party
                    </button>
                  </div>
                  <div className="grid" style={{ gap: "10px" }}>
                    {selectedMatter.parties.map((party) => {
                      const isEditing = editingPartyId === party.id;
                      const isActionsVisible = hoveredPartyId === party.id || isEditing;

                      return (
                        <div
                          key={party.id}
                          className="case-card"
                          style={{ padding: 14 }}
                          onMouseEnter={() => setHoveredPartyId(party.id)}
                          onMouseLeave={() => setHoveredPartyId(null)}
                        >
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: "12px", fontWeight: 700, marginBottom: 4, display: "block" }}>
                              {party.partyType.charAt(0).toUpperCase() + party.partyType.slice(1)}
                            </label>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <input
                                id={`party-input-${party.id}`}
                                value={partyNameDrafts[party.id] ?? party.displayName}
                                readOnly={!isEditing}
                                onChange={(event) =>
                                  setPartyNameDrafts({ ...partyNameDrafts, [party.id]: event.target.value })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && isEditing) {
                                    updateParty(party.id);
                                    setEditingPartyId(null);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: "8px 12px",
                                  fontSize: "13px",
                                  backgroundColor: isEditing ? "#ffffff" : "rgba(0, 0, 0, 0.015)",
                                  border: isEditing ? "1px solid var(--primary)" : "1px solid var(--border)",
                                  borderRadius: "12px",
                                  color: isEditing ? "var(--text-primary)" : "var(--text-secondary)",
                                  cursor: isEditing ? "text" : "default",
                                  outline: "none",
                                  transition: "border-color 0.25s ease, background-color 0.25s ease, color 0.25s ease"
                                }}
                              />
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: isActionsVisible ? "8px" : "0px",
                                width: isActionsVisible ? "88px" : "0px",
                                marginLeft: isActionsVisible ? "8px" : "0px",
                                opacity: isActionsVisible ? 1 : 0,
                                overflow: "hidden",
                                transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), gap 0.25s cubic-bezier(0.4, 0, 0.2, 1), marginLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                flexShrink: 0
                              }}>
                                <button
                                  className="button-secondary"
                                  type="button"
                                  onClick={() => {
                                    if (isEditing) {
                                      updateParty(party.id);
                                      setEditingPartyId(null);
                                    } else {
                                      setEditingPartyId(party.id);
                                      setTimeout(() => {
                                        document.getElementById(`party-input-${party.id}`)?.focus();
                                      }, 50);
                                    }
                                  }}
                                  title={isEditing ? "Save changes" : "Edit name"}
                                  style={{
                                    padding: "8px",
                                    borderRadius: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    width: "40px",
                                    height: "40px",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease"
                                  }}
                                >
                                  {isEditing ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 20h9"></path>
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                  )}
                                </button>
                                <button
                                  className="button-danger"
                                  type="button"
                                  onClick={() => {
                                    deleteParty(party.id);
                                    if (isEditing) {
                                      setEditingPartyId(null);
                                    }
                                  }}
                                  title="Remove party"
                                  style={{
                                    padding: "8px",
                                    borderRadius: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    width: "40px",
                                    height: "40px",
                                    cursor: "pointer",
                                    transition: "background-color 0.2s ease"
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "access" && (
                <div className="panel" style={{ padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--primary-dark)" }}>Client Portal Access</h2>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>Manage client permissions and portal links for this matter.</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Authorized Client Portals</h3>
                    {!selectedMatter?.clients || selectedMatter.clients.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 16px", background: "rgba(0, 0, 0, 0.01)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px", opacity: 0.7, display: "inline-block" }}>
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>No clients linked to this matter yet</div>
                        <p style={{ fontSize: "11px", color: "var(--text-tertiary)", margin: "4px 0 0" }}>Grant access to let clients view timeline and upload documents.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {selectedMatter.clients.map((client) => {
                          const initials = client.displayName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
                          return (
                            <div key={client.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 2px 4px rgba(0, 0, 0, 0.01)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", color: "var(--primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" }}>
                                  {initials}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>{client.displayName}</div>
                                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{client.phone}</div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <button
                                  className="button-secondary"
                                  type="button"
                                  style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                                  onClick={() => createPortalLink(client.id)}
                                >
                                  Generate Portal Link
                                </button>
                                <button
                                  className="button-danger"
                                  type="button"
                                  style={{ padding: "8px", borderRadius: "8px", width: "32px", height: "32px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                  onClick={() => unlinkClientFromMatter(client.id)}
                                  title="Revoke access"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                                    <line x1="12" y1="2" x2="12" y2="12"></line>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {portalUrl && (
                    <div style={{ marginTop: "16px", marginBottom: "24px", padding: "16px", background: "var(--primary-light)", borderRadius: "12px", border: "1px solid rgba(15, 110, 86, 0.15)", animation: "fadeIn 0.2s ease" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <strong style={{ fontSize: "13px", color: "var(--primary-dark)" }}>Secure Portal Link Generated:</strong>
                        <button
                          type="button"
                          style={{ background: "none", border: "none", color: "var(--primary)", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => {
                            navigator.clipboard.writeText(portalUrl);
                            setCopiedPortalUrl(true);
                            setTimeout(() => setCopiedPortalUrl(false), 2000);
                          }}
                        >
                          {copiedPortalUrl ? "Copied!" : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              Copy Link
                            </>
                          )}
                        </button>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--primary-dark)", wordBreak: "break-all", background: "rgba(255,255,255,0.6)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(15, 110, 86, 0.08)", fontFamily: "monospace" }}>
                        {portalUrl}
                      </div>
                      <p style={{ margin: "8px 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>
                        Share this secure link with the client. They can use it to log in.
                      </p>
                    </div>
                  )}                   <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                    <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)" }}>Grant portal access</h3>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>Select Client Account</label>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div className="field" style={{ flex: 1, margin: 0 }}>
                        <CustomSelect
                          value={matterClientId}
                          onChange={(event) => setMatterClientId(event.target.value)}
                        >
                          <option value="">Select client...</option>
                          {clients
                            .filter(c => !selectedMatter?.clients?.some(sc => sc.id === c.id))
                            .map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.displayName} ({client.phone})
                              </option>
                            ))}
                        </CustomSelect>
                      </div>
                      <button
                        className="button"
                        type="button"
                        disabled={!matterClientId}
                        onClick={() => {
                          linkClientToMatter(matterClientId);
                          setMatterClientId("");
                        }}
                        style={{ height: "48px", padding: "0 24px", borderRadius: "12px", whiteSpace: "nowrap" }}
                      >
                        Grant Access
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </>
      ) : (
        <section className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div className="muted" style={{ textAlign: "center", fontSize: "16px", fontWeight: 500 }}>
            Select a matter to view details.
          </div>
        </section>
      )}
      </div>

      {/* Reusable Dialog Modals */}
      {/* 1. Add Matter Modal */}
      {isAddOpen && (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            createMatterAbortRef.current?.abort();
            setCreateMatterError(null);
            setIsAddOpen(false);
          }}
        >
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>New Matter</h2>
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
              <label style={labelStyle}>Court</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={newMatter.courtId}
                  onChange={(event) => {
                    setNewMatter({ ...newMatter, courtId: event.target.value });
                    event.target.blur();
                  }}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  {PILOT_COURTS.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.label}
                    </option>
                  ))}
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="field">
              <label style={labelStyle}>Title</label>
              <input
                value={newMatter.title}
                onChange={(event) => setNewMatter({ ...newMatter, title: event.target.value })}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label style={labelStyle}>Case number</label>
                <input
                  value={newMatter.rawCaseNumber}
                  onChange={(event) => setNewMatter({ ...newMatter, rawCaseNumber: event.target.value })}
                />
              </div>
              <div className="field">
                <label style={labelStyle}>Next Date</label>
                <input
                  type="date"
                  value={newMatter.nextHearingAt}
                  onChange={(event) => setNewMatter({ ...newMatter, nextHearingAt: event.target.value })}
                />
              </div>
            </div>
            <FormErrorBanner message={createMatterError} />
            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                disabled={isCreatingMatter}
                onClick={() => {
                  createMatterAbortRef.current?.abort();
                  setCreateMatterError(null);
                  setIsAddOpen(false);
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                disabled={isCreatingMatter}
                onClick={() => void handleCreateMatter()}
                style={{ flex: 1, padding: "14px" }}
              >
                {isCreatingMatter ? "Creating..." : "Create Matter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CSV Import Modal */}
      {isImportOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsImportOpen(false)}>
          <div style={{ ...modalContentStyle, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>CSV Import</h2>
                <button
                  type="button"
                  onClick={() => setShowImportHelp(!showImportHelp)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: showImportHelp ? "var(--primary)" : "var(--text-secondary)",
                    backgroundColor: showImportHelp ? "rgba(15, 110, 86, 0.1)" : "transparent",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => {
                    if (!showImportHelp) {
                      e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!showImportHelp) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }
                  }}
                  title="Show import instructions"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
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

            {showImportHelp && (
              <div className="case-card" style={{ padding: "12px", marginBottom: "12px", backgroundColor: "rgba(0,0,0,0.02)" }}>
                <strong style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>
                  How does CSV Import work?
                </strong>
                <ol style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", lineHeight: "1.4", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  <li>Download the matter import spreadsheet template.</li>
                  <li>Add your matters inside Excel or Google Sheets.</li>
                  <li>Copy the CSV data and paste it into the textbox below.</li>
                  <li>Click <strong>Validate Import</strong> to preview duplicates or formatting issues, then confirm.</li>
                </ol>
                <a
                  className="button-secondary"
                  href={`${PRODUCT_API_BASE_URL}/v1/matters/import-template.csv`}
                  style={{ textAlign: "center", padding: "8px 0", display: "block", fontSize: "13px", textDecoration: "none" }}
                >
                  Download CSV Template
                </a>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                value={csvImport}
                onChange={(event) => setCsvImport(event.target.value)}
                placeholder="Paste your CSV data rows here"
                style={{ minHeight: 100, fontSize: "13px", padding: "12px", borderRadius: "12px", border: "1px solid var(--border)", boxSizing: "border-box" }}
              />
              <button className="button-secondary" type="button" onClick={previewCsvImport} style={{ fontSize: "13px", padding: "10px 0" }}>
                Validate Import
              </button>
            </div>
            {csvPreview ? (
              <div className="case-card" style={{ marginTop: 10, padding: 12 }}>
                <strong>
                  {csvPreview.acceptedRows} accepted
                  <span className="bullet-separator">•</span>
                  {csvPreview.rejectedRows} rejected
                </strong>
                <div className="grid" style={{ marginTop: 8, maxHeight: "120px", overflowY: "auto" }}>
                  {csvPreview.rows.slice(0, 8).map((row) => (
                    <div key={row.rowNumber} style={{ fontSize: "12px", marginBottom: 4 }}>
                      Row {row.rowNumber}:{" "}
                      <span className={`badge ${row.state === "rejected" ? "conflict" : "live"}`}>
                        {row.state}
                      </span>
                      {row.error ? <div className="muted" style={{ display: "inline-block", marginLeft: 6 }}>{row.error}</div> : null}
                    </div>
                  ))}
                </div>
                <div className="actions" style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  {csvPreview.status === "preview" && csvPreview.acceptedRows > 0 ? (
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        confirmCsvImport();
                        setIsImportOpen(false);
                      }}
                    >
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
          </div>
        </div>
      )}

      {/* 3. Edit Matter Modal */}
      {isEditOpen && selectedMatter && (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            saveMatterAbortRef.current?.abort();
            setSaveMatterError(null);
            setIsEditOpen(false);
          }}
        >
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Edit Matter</h2>
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
              <label style={labelStyle}>Court</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={matterDraft.courtId}
                  onChange={(event) => {
                    setMatterDraft({ ...matterDraft, courtId: event.target.value });
                    event.target.blur();
                  }}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  {PILOT_COURTS.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.label}
                    </option>
                  ))}
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="field">
              <label style={labelStyle}>Title</label>
              <input
                value={matterDraft.title}
                onChange={(event) => setMatterDraft({ ...matterDraft, title: event.target.value })}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label style={labelStyle}>Case number</label>
                <input
                  value={matterDraft.rawCaseNumber}
                  onChange={(event) => setMatterDraft({ ...matterDraft, rawCaseNumber: event.target.value })}
                />
              </div>
              <div className="field">
                <label style={labelStyle}>Stage</label>
                <input
                  value={matterDraft.stage}
                  onChange={(event) => setMatterDraft({ ...matterDraft, stage: event.target.value })}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label style={labelStyle}>Status</label>
                <div style={{ position: "relative", width: "100%" }}>
                  <select
                    value={matterDraft.status}
                    onChange={(event) => {
                      setMatterDraft({ ...matterDraft, status: event.target.value });
                      event.target.blur();
                    }}
                    style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                  >
                    <option value="open">Open</option>
                    <option value="on_hold">On hold</option>
                    <option value="closed">Closed / archived</option>
                  </select>
                  <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="field">
                <label style={labelStyle}>Next Date</label>
                <input
                  type="date"
                  value={matterDraft.nextHearingAt}
                  onChange={(event) => setMatterDraft({ ...matterDraft, nextHearingAt: event.target.value })}
                />
              </div>
            </div>
            <FormErrorBanner message={saveMatterError} />
            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                disabled={isSavingMatter}
                onClick={() => {
                  saveMatterAbortRef.current?.abort();
                  setSaveMatterError(null);
                  setIsEditOpen(false);
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                disabled={isSavingMatter}
                onClick={() => void handleSaveMatter()}
                style={{ flex: 1, padding: "14px" }}
              >
                {isSavingMatter ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add Party Modal */}
      {isAddPartyOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsAddPartyOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Add Party</h2>
              <button
                type="button"
                onClick={() => setIsAddPartyOpen(false)}
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
              <label style={labelStyle}>Party name</label>
              <input
                value={newParty.displayName}
                onChange={(event) => setNewParty({ ...newParty, displayName: event.target.value })}
                placeholder="Enter party name"
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Party type</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={newParty.partyType}
                  onChange={(event) =>
                    setNewParty({
                      ...newParty,
                      partyType: event.target.value as typeof newParty.partyType,
                    })
                  }
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="petitioner">Petitioner</option>
                  <option value="respondent">Respondent</option>
                  <option value="applicant">Applicant</option>
                  <option value="other">Other</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setIsAddPartyOpen(false)}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  addParty();
                  setIsAddPartyOpen(false);
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                Add Party
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Capture Hearing Modal */}
      {isCaptureHearingOpen && (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            captureHearingAbortRef.current?.abort();
            setCaptureHearingError(null);
            setIsCaptureHearingOpen(false);
          }}
        >
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Capture Hearing</h2>
              <button
                type="button"
                onClick={() => setIsCaptureHearingOpen(false)}
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
              <label style={labelStyle}>Listed at</label>
              <input
                type="datetime-local"
                value={hearingListedAt}
                onChange={(event) => setHearingListedAt(event.target.value)}
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Outcome / Short Summary</label>
              <input
                value={hearingOutcome}
                onChange={(event) => setHearingOutcome(event.target.value)}
                placeholder="e.g. Order pronouncement fixed or Arguments completed"
              />
              {/* Outcome Presets */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {OUTCOME_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHearingOutcome(preset)}
                    style={{
                      fontSize: "11px",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      border: "1px solid " + (hearingOutcome === preset ? "var(--primary)" : "var(--border)"),
                      background: hearingOutcome === preset ? "var(--primary-light)" : "#ffffff",
                      color: hearingOutcome === preset ? "var(--primary-dark)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontWeight: 600,
                      transition: "all 0.2s ease"
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label style={labelStyle}>Hearing Notes</label>
              <textarea
                value={hearingNotes}
                onChange={(event) => setHearingNotes(event.target.value)}
                placeholder="Add details, directives, client instructions or summary of today's court discussion..."
                style={{ minHeight: "100px", resize: "vertical" }}
              />
            </div>

            {/* Next Date Scheduler Toggle */}
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              cursor: "pointer",
              marginBottom: "16px",
              marginTop: "16px"
            }}>
              <input
                type="checkbox"
                checked={nextDateFixed}
                onChange={(e) => {
                  setNextDateFixed(e.target.checked);
                  if (!e.target.checked) {
                    setHearingNextDate("");
                  }
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "var(--primary)"
                }}
              />
              Is the next hearing date scheduled?
            </label>

            {nextDateFixed && (
              <div className="field" style={{ animation: "fadeIn 0.2s ease" }}>
                <label style={labelStyle}>Next Hearing Date</label>
                <input
                  type="date"
                  value={hearingNextDate}
                  onChange={(event) => setHearingNextDate(event.target.value)}
                />
              </div>
            )}

            {/* Drag and Drop style custom file upload area */}
            <div className="field" style={{ marginTop: "16px", marginBottom: "24px" }}>
              <label style={labelStyle}>Order Upload (PDF or Image)</label>
              <div
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: "12px",
                  padding: "20px 16px",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}
                onClick={() => document.getElementById("hearing-file-input")?.click()}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 110, 86, 0.02)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
                }}
              >
                <input
                  id="hearing-file-input"
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setHearingFile(file);
                  }}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px", opacity: 0.8, display: "inline-block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {hearingFile ? hearingFile.name : "Select or Drop Order file..."}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  {hearingFile ? `${(hearingFile.size / 1024 / 1024).toFixed(2)} MB` : "Support PDF or images up to 10MB"}
                </div>
              </div>
            </div>

            <FormErrorBanner message={captureHearingError} />
            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                disabled={isCapturingHearing}
                onClick={() => {
                  captureHearingAbortRef.current?.abort();
                  setCaptureHearingError(null);
                  setIsCaptureHearingOpen(false);
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                disabled={isCapturingHearing}
                onClick={() => void handleCaptureHearing()}
                style={{ flex: 1, padding: "14px" }}
              >
                {isCapturingHearing ? "Saving..." : "Save Hearing Update"}
              </button>
            </div>
            {hearingStatus ? (
              <div style={{
                marginTop: 12,
                padding: 10,
                backgroundColor: "var(--primary-light)",
                color: "var(--primary-dark)",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "center"
              }}>
                {hearingStatus}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 6. Document Upload Modal */}
      {isUploadDocOpen && (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            uploadDocumentAbortRef.current?.abort();
            setUploadDocumentError(null);
            setIsUploadDocOpen(false);
          }}
        >
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Upload Private Document</h2>
              <button
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
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
              <label style={labelStyle}>Title</label>
              <input
                value={documentUpload.title}
                onChange={(event) =>
                  setDocumentUpload({ ...documentUpload, title: event.target.value })
                }
                placeholder="Uses file name when blank"
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Type</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={documentUpload.type}
                  onChange={(event) => {
                    setDocumentUpload({ ...documentUpload, type: event.target.value });
                    event.target.blur();
                  }}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="hearing_order">Hearing order</option>
                  <option value="pleading">Pleading</option>
                  <option value="evidence">Evidence</option>
                  <option value="note">Note</option>
                  <option value="general">General</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div className="field">
              <label style={labelStyle}>File</label>
              <div
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: "12px",
                  padding: "20px 16px",
                  textAlign: "center",
                  background: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative"
                }}
                onClick={() => document.getElementById("document-file-input")?.click()}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.backgroundColor = "rgba(15, 110, 86, 0.02)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
                }}
              >
                <input
                  id="document-file-input"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setDocumentFile(file);
                  }}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px", opacity: 0.8, display: "inline-block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {documentFile ? documentFile.name : "Select or Drop file..."}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  {documentFile ? `${(documentFile.size / 1024 / 1024).toFixed(2)} MB` : "Support PDF, doc/docx, or images up to 10MB"}
                </div>
              </div>
            </div>
            <label className="checkbox-field" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={documentUpload.portalVisible}
                onChange={(event) =>
                  setDocumentUpload({ ...documentUpload, portalVisible: event.target.checked })
                }
                style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
              />
              Share with Linked Client(s)
            </label>

            <FormErrorBanner message={uploadDocumentError} />
            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                disabled={isUploadingDocument}
                onClick={() => {
                  uploadDocumentAbortRef.current?.abort();
                  setUploadDocumentError(null);
                  setIsUploadDocOpen(false);
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                disabled={!documentFile || isUploadingDocument}
                onClick={() => void handleUploadDocument()}
                style={{ flex: 1, padding: "14px" }}
              >
                {isUploadingDocument ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
