import {
  CHANNEL_NAME_MAX_LENGTH,
  CLIENT_ID_MAX_LENGTH,
  DEFAULT_CHANNEL_NAME,
  EMAIL_MAX_LENGTH,
  ICON_EMOJI_MAX_CODEPOINTS,
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_DEFAULT_LIMIT,
  MESSAGE_PAGE_MAX_LIMIT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  SERVER_NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "./constants";

export interface FieldIssue {
  field: string;
  message: string;
}

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: FieldIssue };

export const USERNAME_PATTERN = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9_]+$/u;
export const CHANNEL_NAME_PATTERN = /^[\p{L}\p{N}_-]+$/u;
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

function ok<T>(value: T): Validated<T> {
  return { ok: true, value };
}

function fail<T>(field: string, message: string): Validated<T> {
  return { ok: false, error: { field, message } };
}

export function normalizeUsername(value: string): string {
  return value.normalize("NFC").trim();
}

export function usernameKey(value: string): string {
  return normalizeUsername(value).toLocaleLowerCase("tr-TR");
}

export function validateUsername(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("username", "Kullanıcı adı gerekli.");
  }

  const normalized = normalizeUsername(value);
  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    return fail(
      "username",
      `Kullanıcı adı ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} karakter olmalı.`,
    );
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return fail(
      "username",
      "Kullanıcı adı yalnızca harf, rakam ve alt çizgi içerebilir.",
    );
  }

  return ok(normalized);
}

export function validatePassword(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("password", "Parola gerekli.");
  }

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return fail(
      "password",
      `Parola ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} karakter olmalı.`,
    );
  }

  return ok(value);
}

export function validateEmail(value: unknown): Validated<string | null> {
  if (value === undefined || value === null || value === "") {
    return ok(null);
  }

  if (typeof value !== "string") {
    return fail("email", "E-posta metin olmalı.");
  }

  const trimmed = value.trim();
  if (trimmed === "") return ok(null);

  if (
    trimmed.length > EMAIL_MAX_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(trimmed)
  ) {
    return fail("email", "Geçerli bir e-posta adresi gir.");
  }

  return ok(trimmed);
}

export function validateServerName(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("name", "Sunucu adı gerekli.");
  }

  const trimmed = value.normalize("NFC").trim();
  if (
    trimmed.length < SERVER_NAME_MIN_LENGTH ||
    trimmed.length > SERVER_NAME_MAX_LENGTH
  ) {
    return fail(
      "name",
      `Sunucu adı ${SERVER_NAME_MIN_LENGTH}–${SERVER_NAME_MAX_LENGTH} karakter olmalı.`,
    );
  }

  return ok(trimmed);
}

export function validateIconEmoji(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("iconEmoji", "Sunucu simgesi gerekli.");
  }

  const trimmed = value.trim();
  const codepoints = Array.from(trimmed).length;
  if (codepoints < 1 || codepoints > ICON_EMOJI_MAX_CODEPOINTS) {
    return fail(
      "iconEmoji",
      `Sunucu simgesi 1–${ICON_EMOJI_MAX_CODEPOINTS} karakter olmalı.`,
    );
  }

  return ok(trimmed);
}

export function validateIconColor(value: unknown): Validated<string> {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value.trim())) {
    return fail("iconColor", "Renk #RRGGBB biçiminde olmalı.");
  }

  return ok(value.trim());
}

export function normalizeChannelName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/gu, "-");
}

export function validateChannelName(value: unknown): Validated<string> {
  if (typeof value !== "string") {
    return fail("name", "Kanal adı gerekli.");
  }

  const normalized = normalizeChannelName(value);
  if (normalized.length < 1 || normalized.length > CHANNEL_NAME_MAX_LENGTH) {
    return fail(
      "name",
      `Kanal adı 1–${CHANNEL_NAME_MAX_LENGTH} karakter olmalı.`,
    );
  }

  if (!CHANNEL_NAME_PATTERN.test(normalized)) {
    return fail("name", "Kanal adı yalnızca harf, rakam, tire ve alt çizgi içerebilir.");
  }

  return ok(normalized);
}

export function validateMessageContent(value: unknown): Validated<string> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail("content", "Mesaj boş olamaz.");
  }

  if (value.length > MESSAGE_MAX_LENGTH) {
    return fail("content", `Mesaj en fazla ${MESSAGE_MAX_LENGTH} karakter olabilir.`);
  }

  return ok(value);
}

export function validateClientId(value: unknown): Validated<string | null> {
  if (value === undefined || value === null || value === "") {
    return ok(null);
  }

  if (
    typeof value !== "string" ||
    value.length > CLIENT_ID_MAX_LENGTH ||
    !CLIENT_ID_PATTERN.test(value)
  ) {
    return fail("clientId", "İstemci kimliği geçersiz.");
  }

  return ok(value);
}

export function validateReplyToId(value: unknown): Validated<number | null> {
  if (value === undefined || value === null) return ok(null);

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    !Number.isSafeInteger(value)
  ) {
    return fail("replyToId", "Yanıtlanan mesaj geçersiz.");
  }

  return ok(value);
}

export function parseMessageLimit(value: unknown): Validated<number> {
  if (value === undefined || value === null || value === "") {
    return ok(MESSAGE_PAGE_DEFAULT_LIMIT);
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > MESSAGE_PAGE_MAX_LIMIT
  ) {
    return fail("limit", `limit 1–${MESSAGE_PAGE_MAX_LIMIT} arasında olmalı.`);
  }

  return ok(parsed);
}

export function parseMessageCursor(
  value: unknown,
  field: "before" | "after",
): Validated<number | undefined> {
  if (value === undefined || value === null || value === "") {
    return ok(undefined);
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || !Number.isSafeInteger(parsed)) {
    return fail(field, `${field} geçerli bir mesaj kimliği olmalı.`);
  }

  return ok(parsed);
}

/** Used only for readable 404s and route guards; the service still checks the DB. */
export function isPlausibleInviteCode(value: string): boolean {
  return INVITE_CODE_PATTERN.test(value);
}

/** Kept for clients that want to preview normalization before submitting. */
export function previewChannelName(value: string): string {
  return normalizeChannelName(value) || DEFAULT_CHANNEL_NAME;
}
