/** Realtime WebSocket wire protocol (protocolVersion 1). */

import type { ApiErrorCode, MessageDto } from "./types";

export const PROTOCOL_VERSION = 1;

export const REALTIME_PATH = "/ws";

export const WS_MAX_PAYLOAD_BYTES = 8 * 1024;
export const WS_HEARTBEAT_MS = 30_000;
export const WS_MAX_CONNECTIONS_PER_USER = 5;
export const WS_MAX_CONNECTIONS_PER_SERVER = 200;
export const WS_MAX_BUFFERED_BYTES = 512 * 1024;
export const WS_TYPING_THROTTLE_MS = 3_000;
export const WS_TYPING_TTL_MS = 5_000;

export const WS_CLOSE_NORMAL = 1000;
export const WS_CLOSE_AUTH = 4001;
export const WS_CLOSE_FORBIDDEN = 4002;
export const WS_CLOSE_PROTOCOL = 4003;
export const WS_CLOSE_SLOW_CONSUMER = 1013;

/**
 * The reaction palette is fixed by the protocol. shared/constants.ts has no
 * reaction set yet, so the single source of truth lives here.
 */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === "string" && (REACTION_EMOJIS as readonly string[]).includes(value);
}

export interface PublicUser {
  id: string;
  username: string;
  isGuest: boolean;
}

export interface ReactionGroup {
  emoji: string;
  userIds: string[];
}

export type WorkspaceChangeKind = "server:deleted" | "member:left";

export type RealtimeErrorCode =
  | ApiErrorCode
  | "PROTOCOL_ERROR"
  | "TOO_MANY_CONNECTIONS"
  | "SERVER_LIMIT";

// Client -> server payloads

export interface MessageSendPayload {
  clientId: string;
  channelId: string;
  content: string;
  replyToId?: number | null;
}

export interface MessageEditPayload {
  messageId: number;
  content: string;
}

export interface MessageDeletePayload {
  messageId: number;
}

export interface ReactionTogglePayload {
  messageId: number;
  emoji: ReactionEmoji;
}

export interface TypingPayload {
  channelId: string;
}

export interface PingPayload {
  t: number;
}

export type ClientMessage =
  | ({ type: "message:send" } & MessageSendPayload)
  | ({ type: "message:edit" } & MessageEditPayload)
  | ({ type: "message:delete" } & MessageDeletePayload)
  | ({ type: "reaction:toggle" } & ReactionTogglePayload)
  | ({ type: "typing" } & TypingPayload)
  | ({ type: "ping" } & PingPayload);

// Server -> client payloads

export interface ReadyPayload {
  protocolVersion: typeof PROTOCOL_VERSION;
  serverId: string;
  self: PublicUser;
  online: PublicUser[];
}

export interface MessageNewPayload {
  message: MessageDto;
}

export interface MessageUpdatePayload {
  message: MessageDto;
}

export interface MessageReactionsPayload {
  messageId: number;
  channelId: string;
  reactions: ReactionGroup[];
}

export interface TypingEventPayload {
  channelId: string;
  user: PublicUser;
  expiresAt: number;
}

export interface PresenceOnlinePayload {
  user: PublicUser;
}

export interface PresenceOfflinePayload {
  userId: string;
}

export interface WorkspaceChangedPayload {
  kind: WorkspaceChangeKind;
  channelId?: string;
  userId?: string;
}

export interface PongPayload {
  t: number;
}

export interface ErrorPayload {
  code: RealtimeErrorCode;
  message: string;
  clientId?: string;
  retryAfterMs?: number;
}

export type ServerMessage =
  | ({ type: "ready" } & ReadyPayload)
  | ({ type: "message:new" } & MessageNewPayload)
  | ({ type: "message:update" } & MessageUpdatePayload)
  | ({ type: "message:reactions" } & MessageReactionsPayload)
  | ({ type: "typing" } & TypingEventPayload)
  | ({ type: "presence:online" } & PresenceOnlinePayload)
  | ({ type: "presence:offline" } & PresenceOfflinePayload)
  | ({ type: "workspace:changed" } & WorkspaceChangedPayload)
  | ({ type: "pong" } & PongPayload)
  | ({ type: "error" } & ErrorPayload);
