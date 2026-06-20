export function formatDateTime(value: string | null): string {
  if (!value) {
    return "To Be Confirmed";
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  
  if (value.length <= 10) return dateStr;
  return `${dateStr} • ${timeStr}`;
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
