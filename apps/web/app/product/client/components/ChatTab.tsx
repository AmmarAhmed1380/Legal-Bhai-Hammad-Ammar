import { type ClientProfile, type MessageRecord } from "../page";
import { formatDateTime } from "./helpers";

interface ChatTabProps {
  messages: MessageRecord[];
  draft: string;
  setDraft: (value: string) => void;
  sendMessage: () => void;
  profile: ClientProfile;
}

export default function ChatTab({
  messages,
  draft,
  setDraft,
  sendMessage,
  profile,
}: ChatTabProps) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Chat</h2>
      <div style={{
        maxHeight: 380,
        overflowY: "auto",
        overflowX: "hidden",
        paddingRight: "12px",
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        {messages.length === 0 ? (
          <p className="muted" style={{ margin: "10px 0", fontSize: 13, textAlign: "center" }}>
            No chat history found. Send a message to start conversing with your counsel.
          </p>
        ) : (
          messages.map((message) => {
            const isMe = message.senderType === "client";
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
                  position: "relative"
                }}
              >
                <strong style={{
                  fontSize: "12px",
                  color: isMe ? "var(--primary-dark)" : "var(--text-secondary)",
                  display: "block",
                  marginBottom: "4px"
                }}>
                  {isMe ? "You" : "Counsel"}
                </strong>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--text-primary)", wordBreak: "break-word", lineHeight: "1.4" }}>
                  {message.body}
                </p>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "4px", textAlign: isMe ? "right" : "left" }}>
                  {formatDateTime(message.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Message input box */}
      <div style={{ display: "flex", alignItems: "center", position: "relative", marginTop: 12 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={profile.clientAccount.language === "ur" ? "پیغام لکھیں..." : "Write a message..."}
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
          disabled={!draft.trim()}
          style={{
            position: "absolute",
            right: "6px",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "none",
            background: draft.trim() ? "var(--primary)" : "var(--text-tertiary)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background-color 0.2s ease, transform 0.1s ease",
            padding: 0
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
