export function isIsoDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isIsoDateOrDateTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const datePart = value.slice(0, 10);
  if (!isIsoDateOnly(datePart)) {
    return false;
  }
  return value === datePart || (value[10] === "T" && !Number.isNaN(Date.parse(value)));
}
