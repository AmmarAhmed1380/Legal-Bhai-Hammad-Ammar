export function normalizePakistanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (/^03\d{9}$/.test(digits)) {
    return digits;
  }
  if (/^923\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }
  if (/^3\d{9}$/.test(digits)) {
    return `0${digits}`;
  }
  return null;
}

export function toPakistanE164(value: string): string | null {
  const normalized = normalizePakistanPhone(value);
  return normalized ? `+92${normalized.slice(1)}` : null;
}
