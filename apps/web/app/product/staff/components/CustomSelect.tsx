import { type SelectHTMLAttributes } from "react";

interface CustomSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperStyle?: React.CSSProperties;
}

export default function CustomSelect({ wrapperStyle, style, children, ...props }: CustomSelectProps) {
  return (
    <div style={{ position: "relative", width: "100%", ...wrapperStyle }}>
      <select
        style={{ width: "100%", margin: 0, appearance: "none", backgroundImage: "none", paddingRight: "40px", ...style }}
        {...props}
      >
        {children}
      </select>
      <div style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-secondary)" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
  );
}
