/** Shared, framework-free limits and stable identifiers. */

export const API_DEFAULT_PORT = 4300;
export const API_DEFAULT_HOST = "127.0.0.1";

export const SESSION_COOKIE_NAME = "meydan_session";
export const SESSION_TOKEN_BYTES = 32;
export const SESSION_TTL_REGISTERED_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_GUEST_MS = 24 * 60 * 60 * 1000;

export const CSRF_HEADER_NAME = "x-meydan-client";
export const CSRF_HEADER_VALUE = "web";
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

export const MAX_BODY_BYTES = 64 * 1024;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const EMAIL_MAX_LENGTH = 254;

export const SERVER_NAME_MIN_LENGTH = 2;
export const SERVER_NAME_MAX_LENGTH = 48;
export const CHANNEL_NAME_MAX_LENGTH = 32;
export const MESSAGE_MAX_LENGTH = 2000;
export const CLIENT_ID_MAX_LENGTH = 64;
export const ICON_EMOJI_MAX_CODEPOINTS = 8;
export const INVITE_CODE_LENGTH = 8;

export const DEFAULT_SERVER_ICON_EMOJI = "💬";
export const DEFAULT_SERVER_ICON_COLOR = "#5865f2";
export const DEFAULT_CHANNEL_NAME = "genel";

export const MESSAGE_PAGE_DEFAULT_LIMIT = 50;
export const MESSAGE_PAGE_MAX_LIMIT = 100;

export const TICKET_TTL_MS = 30_000;
export const TICKET_BYTES = 32;

export const SCRYPT_PARAMS = {
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
} as const;

export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 60_000 },
  register: { limit: 3, windowMs: 60_000 },
  guest: { limit: 3, windowMs: 60_000 },
} as const;
