export function normalizePakistanPhone(value: string): string | null {
  const clean = value.trim();
  
  // Handle US numbers
  if (clean.startsWith("+1") || clean.startsWith("1")) {
    const digits = clean.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1${digits.slice(1)}`;
    }
    if (digits.length === 10) {
      return `+1${digits}`;
    }
  }

  const digits = clean.replace(/\D/g, "");
  if (/^03\d{9}$/.test(digits)) {
    return digits;
  }
  if (/^923\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }
  if (/^3\d{9}$/.test(digits)) {
    return `0${digits}`;
  }
  
  // Allow international formats starting with '+'
  if (clean.startsWith("+")) {
    return `+${digits}`;
  }
  return null;
}

export function toPakistanE164(value: string): string | null {
  const normalized = normalizePakistanPhone(value);
  if (!normalized) return null;
  if (normalized.startsWith("+")) {
    return normalized;
  }
  return `+92${normalized.slice(1)}`;
}
