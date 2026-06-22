import { type Dispatch, type SetStateAction, useEffect, useState, type CSSProperties } from "react";
import { type DocumentRecord, type SearchHit, type MatterListItem } from "../page";
import { formatMimeType, getDownloadFilename, toTitleCase } from "./helpers";

interface VaultSectionProps {
  searchVault: (query: string) => Promise<SearchHit[]>;
  documents: DocumentRecord[];
  openDocument: (docId: string) => void;
  updateDocumentVisibility: (doc: DocumentRecord) => void;
  viewingDocumentUrl: string | null;
  viewingDocument: { id: string; title: string; mimeType?: string } | null;
  closeDocumentViewer: () => void;
  zoomScale: number;
  setZoomScale: Dispatch<SetStateAction<number>>;
  isCloseHovered: boolean;
  setIsCloseHovered: Dispatch<SetStateAction<boolean>>;
  matters: MatterListItem[];
  uploadVaultDocument: (
    file: File,
    title: string,
    type: string,
    portalVisible: boolean,
    matterId: string | null
  ) => Promise<void>;
}

export default function VaultSection({
  searchVault,
  documents,
  openDocument,
  updateDocumentVisibility,
  viewingDocumentUrl,
  viewingDocument,
  closeDocumentViewer,
  zoomScale,
  setZoomScale,
  isCloseHovered,
  setIsCloseHovered,
  matters,
  uploadVaultDocument,
}: VaultSectionProps) {
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("general");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPortalVisible, setDocPortalVisible] = useState(false);
  const [docMatterId, setDocMatterId] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      const trimmed = debouncedQuery.trim();
      if (!trimmed) {
        setSearchHits([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const hits = await searchVault(trimmed);
        if (!cancelled) {
          setSearchHits(hits);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchVault]);

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

  const closeUploadModal = () => {
    setIsUploadDocOpen(false);
    setDocFile(null);
    setDocTitle("");
    setDocPortalVisible(false);
    setDocMatterId("");
  };

  const vaultGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: "16px",
  };

  const searchResultDocuments = searchHits
    .map((hit) => documents.find((document) => document.id === hit.id))
    .filter((document): document is DocumentRecord => document !== undefined);

  const renderDocumentCard = (document: DocumentRecord) => (
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
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.02)",
        transition: "transform 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
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
          position: "relative",
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
        <span
          className={`badge compact ${document.portalVisible ? "live" : "conflict"}`}
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            fontSize: "8px",
            padding: "2px 6px 3px",
            letterSpacing: "0.04em",
          }}
        >
          {document.portalVisible ? "Shared" : "Internal"}
        </span>
      </div>
      <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          <div
            title={document.title}
            style={{
              flex: 1,
              minWidth: 0,
              fontWeight: 700,
              fontSize: "12px",
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {document.title}
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: "10px",
              color: "var(--text-secondary)",
              background: "#f3f4f6",
              padding: "2px 6px",
              borderRadius: "10px",
              whiteSpace: "nowrap",
              maxWidth: "42%",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={toTitleCase(document.type)}
          >
            {toTitleCase(document.type)}
          </span>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void updateDocumentVisibility(document);
          }}
          style={{
            fontSize: "10px",
            padding: "4px 0",
            width: "100%",
            borderRadius: "6px",
          }}
        >
          {document.portalVisible ? "Make Internal" : "Share Client"}
        </button>
      </div>
    </div>
  );

  return (
    <section>
      <div className="panel" style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 0 }}>Document Vault</h2>
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Document
          </button>
        </div>
        <div className="field-row" style={{ marginBottom: 16 }}>
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (event.target.value.trim()) {
                setIsSearching(true);
              } else {
                setIsSearching(false);
                setSearchHits([]);
              }
            }}
            placeholder="Search document title or OCR text"
            style={{
              flex: 1,
              minWidth: 220,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          />
        </div>
        {searchQuery.trim().length > 0 ? (
          isSearching ? (
            <p className="vault-search-loading" style={{ margin: "0 0 16px" }}>Searching vault registry...</p>
          ) : searchResultDocuments.length === 0 ? (
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>No matching documents found.</p>
          ) : (
            <div style={vaultGridStyle}>{searchResultDocuments.map(renderDocumentCard)}</div>
          )
        ) : (
          <div style={vaultGridStyle}>{documents.map(renderDocumentCard)}</div>
        )}
      </div>

      {/* Lightbox Document Viewer */}
      {viewingDocumentUrl && viewingDocument && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={closeDocumentViewer}
        >
          <div
            style={{
              backgroundColor: "white",
              width: "95%",
              maxWidth: "1400px",
              height: "95%",
              maxHeight: "920px",
              borderRadius: "18px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "#fcfbfa",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--primary-dark)",
                  fontSize: "18px",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginRight: "16px",
                }}
              >
                {viewingDocument.title}
              </h3>
              <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {/* Magnification Controls */}
                {viewingDocument.mimeType?.startsWith("image/") && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(0, 0, 0, 0.05)",
                      borderRadius: "20px",
                      padding: "2px 8px",
                      marginRight: "16px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setZoomScale((prev) => Math.max(0.25, prev - 0.25))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                      title="Zoom Out"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                      </svg>
                    </button>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        minWidth: "42px",
                        textAlign: "center",
                      }}
                    >
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomScale((prev) => Math.min(3, prev + 0.25))}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                      title="Zoom In"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                        transition: "background-color 0.2s ease",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                      }}
                      title="Reset Zoom"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Download Button */}
                <a
                  href={viewingDocumentUrl}
                  download={getDownloadFilename(viewingDocument.title, viewingDocument.mimeType)}
                  style={{
                    background: "none",
                    border: "none",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                    outline: "none",
                    marginRight: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                  title="Download File"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </a>
                {/* Close Button */}
                <button
                  type="button"
                  onClick={closeDocumentViewer}
                  onMouseEnter={() => setIsCloseHovered(true)}
                  onMouseLeave={() => setIsCloseHovered(false)}
                  style={{
                    background: isCloseHovered ? "rgba(0, 0, 0, 0.08)" : "none",
                    border: "none",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                    outline: "none",
                    padding: 0,
                  }}
                  title="Close"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                backgroundColor: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "auto",
                padding: viewingDocument.mimeType?.startsWith("image/") ? "10px" : "0",
              }}
            >
              {viewingDocument.mimeType?.startsWith("image/") ? (
                <img
                  src={viewingDocumentUrl}
                  alt={viewingDocument.title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.15s ease-out",
                  }}
                />
              ) : (
                <iframe
                  src={viewingDocumentUrl}
                  width="100%"
                  height="100%"
                  style={{ border: "none" }}
                  title={viewingDocument.title}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Document Upload Modal */}
      {isUploadDocOpen && (
        <div style={modalOverlayStyle} onClick={closeUploadModal}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Upload Document to Vault</h2>
              <button
                type="button"
                onClick={closeUploadModal}
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
                value={docTitle}
                onChange={(event) => setDocTitle(event.target.value)}
                placeholder="Uses file name when blank"
              />
            </div>
            <div className="field">
              <label style={labelStyle}>Type</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={docType}
                  onChange={(event) => {
                    setDocType(event.target.value);
                    event.target.blur();
                  }}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="general">General</option>
                  <option value="hearing_order">Hearing order</option>
                  <option value="pleading">Pleading</option>
                  <option value="evidence">Evidence</option>
                  <option value="notice">Court Notice</option>
                  <option value="invoice">Invoice</option>
                  <option value="cnic">Identity Document (CNIC)</option>
                  <option value="receipt">Receipt</option>
                  <option value="cause_list">Cause List</option>
                  <option value="note">Office Note</option>
                </select>
                <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            <div className="field">
              <label style={labelStyle}>Associate with Matter (Optional)</label>
              <div style={{ position: "relative", width: "100%" }}>
                <select
                  value={docMatterId}
                  onChange={(event) => {
                    setDocMatterId(event.target.value);
                    event.target.blur();
                  }}
                  style={{ width: "100%", appearance: "none", backgroundImage: "none", paddingRight: "40px" }}
                >
                  <option value="">General / Unlinked</option>
                  {matters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.rawCaseNumber} - {m.title}
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
                onClick={() => document.getElementById("vault-file-input")?.click()}
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
                  id="vault-file-input"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setDocFile(file);
                  }}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px", opacity: 0.8, display: "inline-block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {docFile ? docFile.name : "Select or Drop file..."}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  {docFile ? `${(docFile.size / 1024 / 1024).toFixed(2)} MB` : "Support PDF, doc/docx, or images up to 10MB"}
                </div>
              </div>
            </div>

            <label className="checkbox-field" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={docPortalVisible}
                disabled={!docMatterId}
                onChange={(event) => setDocPortalVisible(event.target.checked)}
                style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
              />
              Share with Linked Client(s) {!docMatterId && <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>(requires matter linkage)</span>}
            </label>

            <div className="actions" style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              <button
                className="button-secondary"
                type="button"
                disabled={isUploading}
                onClick={closeUploadModal}
                style={{ flex: 1, padding: "14px" }}
              >
                Cancel
              </button>
              <button
                className="button"
                type="button"
                disabled={!docFile || isUploading}
                onClick={async () => {
                  if (!docFile) return;
                  setIsUploading(true);
                  try {
                    await uploadVaultDocument(docFile, docTitle, docType, docPortalVisible && !!docMatterId, docMatterId || null);
                    closeUploadModal();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsUploading(false);
                  }
                }}
                style={{ flex: 1, padding: "14px" }}
              >
                {isUploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
