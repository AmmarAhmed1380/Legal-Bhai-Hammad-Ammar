import { type Dispatch, type SetStateAction } from "react";
import { getDownloadFilename } from "./helpers";

interface DocumentViewerModalProps {
  viewingDocument: { id: string; title: string; mimeType?: string };
  viewingDocumentUrl: string;
  closeDocumentViewer: () => void;
  zoomScale: number;
  setZoomScale: Dispatch<SetStateAction<number>>;
  isCloseHovered: boolean;
  setIsCloseHovered: (val: boolean) => void;
}

export default function DocumentViewerModal({
  viewingDocument,
  viewingDocumentUrl,
  closeDocumentViewer,
  zoomScale,
  setZoomScale,
  isCloseHovered,
  setIsCloseHovered,
}: DocumentViewerModalProps) {
  const isImage = viewingDocument.mimeType?.startsWith("image/");
  const isDocx = viewingDocument.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return (
    <div style={{
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
      padding: "20px"
    }} onClick={closeDocumentViewer}>
      <div style={{
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
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "#fcfbfa"
        }}>
          <h3 style={{
            margin: 0,
            color: "var(--primary-dark)",
            fontSize: "18px",
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginRight: "16px"
          }}>
            {viewingDocument.title}
          </h3>
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {/* Magnification Controls */}
            {isImage && (
              <div style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(0, 0, 0, 0.05)",
                borderRadius: "20px",
                padding: "2px 8px",
                marginRight: "16px"
              }}>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(0.25, prev - 0.25))}
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
                    padding: 0
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  title="Zoom Out"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                </button>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                  minWidth: "42px",
                  textAlign: "center"
                }}>
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(3, prev + 0.25))}
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
                    padding: 0
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  title="Zoom In"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
                    padding: 0
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  title="Reset Zoom"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                fontSize: "20px",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                outline: "none",
                marginRight: "8px"
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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
                padding: 0
              }}
              title="Close"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: "var(--primary-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          padding: (isImage || isDocx) ? "10px" : "0"
        }}>
          {isImage ? (
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
                transition: "transform 0.15s ease-out"
              }}
            />
          ) : isDocx ? (
            <div style={{
              width: "min(820px, 100%)",
              height: "100%",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: "10px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.18)",
              padding: "54px 64px",
              color: "#111827",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.75,
            }}>
              <div style={{ textAlign: "center", fontWeight: 800, fontSize: "18px", textTransform: "uppercase", marginBottom: 28 }}>
                {viewingDocument.title.replace(/\.docx$/i, "")}
              </div>
              <p style={{ textAlign: "justify" }}>
                This Microsoft Word document is available in the secure LegalBahi document vault. Browser engines do not natively render
                DOCX files inside an iframe, so LegalBahi shows this in-window legal document preview while keeping the original Word
                file available from the download button above.
              </p>
              <p style={{ textAlign: "justify" }}>
                The seeded file contains dense written objections covering jurisdiction, maintainability, factual background, relied-upon
                correspondence, objections to recovery proceedings, and prayer clauses for W.P. 2076/2019. It is stored and served with
                the native Word MIME type for upload/download compatibility demonstrations.
              </p>
              <p style={{ textAlign: "justify" }}>
                For the live pilot, uploaded Word documents can be retained in their original format and surfaced with metadata, search
                text, OCR status, and secure matter-level access controls without automatically downloading on card click.
              </p>
            </div>
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
  );
}
