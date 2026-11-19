import { formatDate } from "@/lib/format";

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Stable per-name hue; mixed with the current text token for both themes. */
export function authorColor(name: string): string {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  const hue = hash % 360;
  return `color-mix(in srgb, hsl(${hue} 68% 58%) 72%, var(--text))`;
}

export function truncatePreview(text: string, limit = 120): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  if (characters.length <= limit) return characters.join("");
  return `${characters.slice(0, limit).join("")}…`;
}

export function formatMessageTime(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

export function messageDateTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function startOfDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(left: number, right: number): boolean {
  return startOfDayKey(left) === startOfDayKey(right);
}

export function formatDayLabel(timestamp: number): string {
  const now = Date.now();
  if (isSameDay(timestamp, now)) return "Bugün";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(timestamp, yesterday.getTime())) return "Dün";

  return formatDate(timestamp);
}

export function needsDaySeparator(
  previousTimestamp: number | null,
  timestamp: number,
): boolean {
  if (previousTimestamp === null) return true;
  return !isSameDay(previousTimestamp, timestamp);
}
