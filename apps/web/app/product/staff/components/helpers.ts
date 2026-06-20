export const PILOT_COURTS = [
  { id: "ihc", label: "Islamabad High Court" },
  { id: "lhc-rawalpindi-bench", label: "Lahore High Court Rawalpindi Bench" },
  { id: "rwp-district-sessions", label: "Rawalpindi District & Sessions Courts" },
  { id: "rwp-civil-courts", label: "Rawalpindi Civil Courts" },
  { id: "rwp-family-courts", label: "Rawalpindi Family Courts" },
  { id: "rwp-criminal-magisterial", label: "Rawalpindi Criminal & Magisterial Courts" },
] as const;

export function courtLabel(courtId: string): string {
  const found = PILOT_COURTS.find((court) => court.id === courtId);
  if (found) return found.label;
  return formatCourtId(courtId);
}

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function formatMimeType(mime: string): string {
  if (!mime) return "";
  if (mime.toLowerCase().startsWith("image/")) return "Image";
  if (mime.toLowerCase() === "application/pdf") return "PDF";
  return mime.split("/")[1]?.toUpperCase() || mime;
}

export function formatCourtId(courtId: string): string {
  if (!courtId) return "";
  if (courtId.toLowerCase() === "ihc") return "IHC";
  return courtId.toUpperCase();
}

export function getDownloadFilename(title: string, mimeType?: string): string {
  if (!title) title = "document";
  
  // Check if title already ends with a common file extension (case-insensitive)
  const hasExt = /\.[a-zA-Z0-9]{2,4}$/.test(title);
  if (hasExt) {
    return title;
  }
  
  if (!mimeType) {
    return title;
  }
  
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf") return `${title}.pdf`;
  if (mime === "image/png") return `${title}.png`;
  if (mime === "image/jpeg" || mime === "image/jpg") return `${title}.jpg`;
  if (mime === "image/gif") return `${title}.gif`;
  
  // fallback for other/unknown mime types
  const parts = mime.split("/");
  if (parts.length === 2 && parts[1]) {
    return `${title}.${parts[1]}`;
  }
  
  return title;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "TBC";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  
  const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  
  if (value.length <= 10) return dateStr; // If it's just YYYY-MM-DD
  return `${dateStr} • ${timeStr}`;
}

export function formatRole(role: string): string {
  if (!role) return "";
  const r = role.toLowerCase();
  if (r === "co_owner" || r === "co-owner") return "Co-Owner";
  if (r === "owner") return "Owner";
  if (r === "lawyer") return "Lawyer";
  if (r === "assistant") return "Assistant";
  if (r === "billing") return "Billing Officer";
  return r.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function formatPhone(phone: string): string {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  
  if (phone.startsWith("+1") || (digits.length === 11 && digits.startsWith("1"))) {
    const local = digits.startsWith("1") ? digits.slice(1) : digits;
    if (local.length === 10) {
      return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
    }
  }
  
  let local = digits;
  if (digits.startsWith("92")) {
    local = digits.slice(2);
  } else if (digits.startsWith("0")) {
    local = digits.slice(1);
  }
  
  if (local.length === 10) {
    return `+92 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `+92 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  
  if (local.length >= 3) {
    return `(+92) ${local.slice(0, 3)}-${local.slice(3)}`;
  }
  return phone;
}

export function formatCurrency(value: number): string {
  return `PKR ${value.toLocaleString()}`;
}
