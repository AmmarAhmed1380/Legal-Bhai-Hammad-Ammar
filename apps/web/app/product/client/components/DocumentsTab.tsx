import { useState } from "react";
import { type ClientMatterDetail } from "../page";
import { toTitleCase } from "./helpers";

interface DocumentsTabProps {
  selectedMatter: ClientMatterDetail;
  openDocument: (documentId: string) => void;
  onInitiateUpload: () => void;
  isUploading: boolean;
}

export default function DocumentsTab({
  selectedMatter,
  openDocument,
  onInitiateUpload,
  isUploading,
}: DocumentsTabProps) {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Get unique types present in the shared documents list, capitalized neatly for display filters
  const uniqueTypes = Array.from(
    new Set((selectedMatter.documents ?? []).map((d) => toTitleCase(d.type)))
  );
  const filterTypes = ["All", ...uniqueTypes];

  // Filter documents by active filter type (case-insensitive)
  const filteredDocuments = activeFilter === "All"
    ? selectedMatter.documents
    : selectedMatter.documents.filter((d) => toTitleCase(d.type) === activeFilter);

  return (
    <div className="panel">
      {/* Header Area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ margin: 0 }}>Documents</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onInitiateUpload}
            className="button"
            disabled={isUploading}
            style={{
              background: "var(--primary)",
              color: "white",
              padding: "12px 20px",
              borderRadius: "12px",
              cursor: isUploading ? "not-allowed" : "pointer",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              opacity: isUploading ? 0.7 : 1,
              border: 0,
              boxShadow: "0 4px 12px rgba(15, 110, 86, 0.2)",
              margin: 0,
            }}
          >
            {isUploading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2.5" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Document
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Row */}
      {selectedMatter.documents.length > 0 && (
        <div style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingTop: "6px",
          paddingBottom: "10px",
          marginBottom: "16px",
          borderBottom: "1px solid var(--border)",
        }}>
          {filterTypes.map((type) => {
            const isActive = activeFilter === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveFilter(type)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                  background: isActive ? "var(--primary)" : "var(--surface)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                   transform: "translateY(0)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  if (isActive) {
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 110, 86, 0.3)";
                  } else {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.color = "var(--primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  if (isActive) {
                    e.currentTarget.style.boxShadow = "none";
                  } else {
                    e.currentTarget.style.background = "var(--surface)";
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}



      {filteredDocuments.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {selectedMatter.documents.length === 0
            ? "No shared documents for this matter."
            : `No documents matching the category "${activeFilter}".`}
        </p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "16px",
          marginTop: "16px"
        }}>
          {filteredDocuments.map((document) => (
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
                minHeight: "150px",
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
              {/* Top Section: Compact File Type Thumbnail */}
              <div style={{
                height: "70px",
                background: "rgba(15, 110, 86, 0.04)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)"
              }}>
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

              {/* Bottom Section: Compact Title & Meta */}
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "4px", flex: 1, justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "12px", wordBreak: "break-all", marginBottom: "4px" }}>
                    {document.title}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    Uploaded by: {document.uploaderType === "client" ? "Client" : "Lawyer"}
                  </div>
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
  );
}
