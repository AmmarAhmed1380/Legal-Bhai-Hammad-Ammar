export function formatPakistanDisplayPhone(phone: string): string {
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
    return `+92 (${local.slice(0, 3)}) ${local.slice(3)}`;
  }
  return phone;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "To Be Confirmed";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  
  const dateStr = d.toLocaleDateString("en-US", { timeZone: "Asia/Karachi", month: "short", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true });
  
  if (value.length <= 10) return dateStr;
  return `${dateStr} | ${timeStr} PKT`;
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

export const PILOT_COURTS = [
  { id: "ihc", label: "Islamabad High Court" },
  { id: "lhc-rawalpindi-bench", label: "Lahore High Court Rawalpindi Bench" },
  { id: "rwp-district-sessions", label: "Rawalpindi District & Sessions Court" },
  { id: "rwp-civil-courts", label: "Rawalpindi Civil Courts" },
  { id: "rwp-family-courts", label: "Rawalpindi Family Courts" },
  { id: "rwp-criminal-magisterial", label: "Rawalpindi Criminal & Magisterial Courts" },
] as const;

export function formatCourtId(courtId: string): string {
  if (!courtId) return "";
  const found = PILOT_COURTS.find((court) => court.id === courtId.toLowerCase());
  if (found) return found.label;
  if (courtId.toLowerCase() === "ihc") return "Islamabad High Court";
  if (courtId.toLowerCase() === "rwp-district-sessions") return "Rawalpindi District & Sessions Court";
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
