import { type ClientMatterDetail } from "../page";
import { toTitleCase } from "./helpers";

interface DocumentsTabProps {
  selectedMatter: ClientMatterDetail;
  openDocument: (documentId: string) => void;
}

export default function DocumentsTab({
  selectedMatter,
  openDocument,
}: DocumentsTabProps) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Documents</h2>
      {selectedMatter.documents.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No documents have been shared for this matter.</p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "16px",
          marginTop: "16px"
        }}>
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
              <div style={{
                height: "90px",
                background: "rgba(15, 110, 86, 0.04)",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                color: "var(--primary)"
              }}>
                {document.mimeType.toLowerCase() === "application/pdf" ? (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                )}
              </div>

              {/* Bottom Section: Title Info */}
              <div style={{
                padding: "12px 14px 13px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flex: 1
              }}>
                <div style={{
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
                  lineHeight: "1.4"
                }} title={document.title}>
                  {document.title}
                </div>

                <span style={{
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
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)"
                }}>
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
