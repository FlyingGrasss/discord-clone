const countFormatter = new Intl.NumberFormat("tr-TR");
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCount(value: number): string {
  return countFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatMemberCount(count: number): string {
  return `${formatCount(count)} üye`;
}

export function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatRetryAfter(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `${seconds} saniye sonra tekrar dene.`;
}

/** Produces a short avatar fallback from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return Array.from(parts[0]!).slice(0, 2).join("").toLocaleUpperCase("tr-TR");
  }

  const first = Array.from(parts[0]!)[0] ?? "";
  const last = Array.from(parts[parts.length - 1]!)[0] ?? "";
  return `${first}${last}`.toLocaleUpperCase("tr-TR");
}
