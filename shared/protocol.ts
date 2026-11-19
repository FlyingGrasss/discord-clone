/** Realtime WebSocket wire protocol (protocolVersion 1). */

import type { ApiErrorCode, MessageDto } from "./types";

export const PROTOCOL_VERSION = 1;

export const REALTIME_PATH = "/ws";

// WebRTC SDP bodies are far larger than chat messages; keep the socket limit
// generous enough for an offer that carries audio and a screen-share video
// m-line while still bounding per-frame memory.
export const WS_MAX_PAYLOAD_BYTES = 64 * 1024;
export const WS_HEARTBEAT_MS = 30_000;
export const WS_MAX_CONNECTIONS_PER_USER = 5;
export const WS_MAX_CONNECTIONS_PER_SERVER = 200;
export const WS_MAX_BUFFERED_BYTES = 512 * 1024;
export const WS_TYPING_THROTTLE_MS = 3_000;
export const WS_TYPING_TTL_MS = 5_000;

/** Peer-to-peer call limits. Media itself never reaches the server. */
export const CALL_MAX_PARTICIPANTS = 5;
export const CALL_STUN_URLS = ["stun:stun.l.google.com:19302"] as const;
export const CALL_SIGNAL_MAX_SDP_LENGTH = 60_000;
export const CALL_SIGNAL_MAX_CANDIDATE_LENGTH = 4_096;
export const CALL_AVATAR_COLORS = [
  "#5865f2",
  "#e5484d",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#1098ad",
  "#e8590c",
  "#5c7cfa",
] as const;

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
  | "SERVER_LIMIT"
  | "CALL_FULL";

// Peer-to-peer call signaling. Media never crosses the WebSocket; only SDP and
// ICE candidates do. The server keeps a channel-scoped, in-memory registry.

export interface CallPeer {
  userId: string;
  username: string;
  avatarColor: string;
  screenSharing: boolean;
}

export interface CallIceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type CallSignalKind = "offer" | "answer" | "ice";

export interface CallSignalData {
  kind: CallSignalKind;
  sdp?: string;
  candidate?: CallIceCandidate;
}

export interface CallJoinPayload {
  channelId: string;
}

export interface CallLeavePayload {
  channelId: string;
}

export interface CallSignalPayload {
  channelId: string;
  toUserId: string;
  data: CallSignalData;
}

/** Client report. The relayed `call:state` adds `userId` from the connection. */
export interface CallStateUpdatePayload {
  channelId: string;
  muted: boolean;
  screenSharing: boolean;
}

export interface CallPeersPayload {
  channelId: string;
  peers: CallPeer[];
}

export interface CallPeerJoinedPayload {
  channelId: string;
  user: CallPeer;
}

export interface CallPeerLeftPayload {
  channelId: string;
  userId: string;
}

export interface CallStatePayload {
  channelId: string;
  userId: string;
  muted: boolean;
  screenSharing: boolean;
}

/** Relayed signal: `{ fromUserId, ...data }` plus the channel scope. */
export interface CallSignalEventPayload extends CallSignalData {
  channelId: string;
  fromUserId: string;
}

/** Deterministic avatar accent used by the call chips; no schema column. */
export function callAvatarColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return CALL_AVATAR_COLORS[hash % CALL_AVATAR_COLORS.length] ?? CALL_AVATAR_COLORS[0];
}

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
  | ({ type: "call:join" } & CallJoinPayload)
  | ({ type: "call:leave" } & CallLeavePayload)
  | ({ type: "call:signal" } & CallSignalPayload)
  | ({ type: "call:state" } & CallStateUpdatePayload)
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

export type CallServerMessage =
  | ({ type: "call:peers" } & CallPeersPayload)
  | ({ type: "call:peer-joined" } & CallPeerJoinedPayload)
  | ({ type: "call:peer-left" } & CallPeerLeftPayload)
  | ({ type: "call:state" } & CallStatePayload)
  | ({ type: "call:signal" } & CallSignalEventPayload);

export type ServerMessage =
  | ({ type: "ready" } & ReadyPayload)
  | ({ type: "message:new" } & MessageNewPayload)
  | ({ type: "message:update" } & MessageUpdatePayload)
  | ({ type: "message:reactions" } & MessageReactionsPayload)
  | ({ type: "typing" } & TypingEventPayload)
  | ({ type: "presence:online" } & PresenceOnlinePayload)
  | ({ type: "presence:offline" } & PresenceOfflinePayload)
  | ({ type: "workspace:changed" } & WorkspaceChangedPayload)
  | CallServerMessage
  | ({ type: "pong" } & PongPayload)
  | ({ type: "error" } & ErrorPayload);
