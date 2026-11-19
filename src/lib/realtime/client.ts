"use client";

import {
  PROTOCOL_VERSION,
  REALTIME_PATH,
  WS_CLOSE_AUTH,
  WS_CLOSE_FORBIDDEN,
  type CallServerMessage,
  type ClientMessage,
  type ErrorPayload,
  type MessageReactionsPayload,
  type PublicUser,
  type ReadyPayload,
  type ServerMessage,
  type TypingEventPayload,
  type WorkspaceChangedPayload,
} from "@shared/protocol";
import type { MessageDto, MessagePage, RealtimeTicketDto } from "@shared/types";
import { ApiError, apiFetch } from "@/lib/api";

export const REALTIME_CONNECTION_ERROR = "Canlı sohbet bağlantısı kurulamadı.";
export const REALTIME_RECONNECTING_MESSAGE =
  "Bağlantı kesildi. Yeniden bağlanılıyor…";

const HEARTBEAT_INTERVAL_MS = 25_000;
const SILENCE_TIMEOUT_MS = 60_000;
const SILENCE_CHECK_INTERVAL_MS = 5_000;
const BACKOFF_MIN_MS = 500;
const BACKOFF_MAX_MS = 8_000;
const GAP_FILL_LIMIT = 100;
const GAP_FILL_MAX_ROUNDS = 10;

export type RealtimeStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface ChannelRealtimeHandlers {
  onStatusChange?: (status: RealtimeStatus) => void;
  onReady?: (payload: ReadyPayload) => void;
  onMessageNew?: (message: MessageDto) => void;
  onMessageUpdate?: (message: MessageDto) => void;
  onMessageReactions?: (payload: MessageReactionsPayload) => void;
  onTyping?: (payload: TypingEventPayload) => void;
  onPresenceOnline?: (user: PublicUser) => void;
  onPresenceOffline?: (userId: string) => void;
  onWorkspaceChanged?: (payload: WorkspaceChangedPayload) => void;
  onOperationError?: (payload: ErrorPayload) => void;
  onCallEvent?: (message: CallServerMessage) => void;
  onGapMessages?: (messages: MessageDto[]) => void;
  onFatalError?: (message: string) => void;
}

export interface ChannelRealtimeClientOptions {
  serverId: string;
  channelId: string;
  getLastMessageId: () => number | null;
  handlers: ChannelRealtimeHandlers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildSocketUrl(ticket: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = process.env.NEXT_PUBLIC_REALTIME_PORT?.trim() || "4300";
  return `${protocol}//${window.location.hostname}:${port}${REALTIME_PATH}?ticket=${encodeURIComponent(ticket)}`;
}

function backoffDelay(attempt: number): number {
  const base = Math.min(
    BACKOFF_MAX_MS,
    BACKOFF_MIN_MS * 2 ** Math.min(attempt, 4),
  );
  // Full-ish jitter keeps reconnect stampedes apart while staying in 0.5–8s.
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, Math.round(jittered)));
}

/**
 * Channel-scoped WebSocket client. It owns the ticket handshake, heartbeat,
 * reconnect/backoff and post-reconnect gap fill, and reports every protocol
 * event through the supplied handlers.
 */
export class ChannelRealtimeClient {
  private readonly serverId: string;
  private readonly channelId: string;
  private readonly getLastMessageId: () => number | null;
  private readonly handlers: ChannelRealtimeHandlers;

  private socket: WebSocket | null = null;
  private status: RealtimeStatus = "closed";
  private started = false;
  private destroyed = false;
  private attempt = 0;
  private lastInboundAt = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private silenceTimer: number | null = null;

  constructor(options: ChannelRealtimeClientOptions) {
    this.serverId = options.serverId;
    this.channelId = options.channelId;
    this.getLastMessageId = options.getLastMessageId;
    this.handlers = options.handlers;
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.setStatus("connecting");
    void this.connect();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearTimers();

    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    try {
      socket.close(1000, "client closed");
    } catch {
      // The browser tears the socket down on its own.
    }
  }

  sendClientMessage(message: ClientMessage): boolean {
    return this.sendRaw(message);
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.handlers.onStatusChange?.(next);
  }

  private sendRaw(message: ClientMessage): boolean {
    const socket = this.socket;
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      this.status !== "open"
    ) {
      return false;
    }

    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private async connect(): Promise<void> {
    if (this.destroyed) return;

    let ticket: string;
    try {
      const grant = await apiFetch<RealtimeTicketDto>("/api/realtime/ticket", {
        method: "POST",
        body: JSON.stringify({ serverId: this.serverId }),
      });
      ticket = grant.ticket;
    } catch (error) {
      if (this.destroyed) return;
      if (this.isTerminalTicketError(error)) {
        this.failFatally();
        return;
      }
      this.scheduleReconnect();
      return;
    }

    if (this.destroyed) return;

    let socket: WebSocket;
    try {
      socket = new WebSocket(buildSocketUrl(ticket));
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.addEventListener("open", () => {
      this.lastInboundAt = Date.now();
    });

    socket.addEventListener("message", (event) => {
      this.handleIncoming(event.data);
    });

    socket.addEventListener("close", (event) => {
      this.handleClose(event.code, socket);
    });

    socket.addEventListener("error", () => {
      // A close event follows; reconnection is handled there.
    });
  }

  private isTerminalTicketError(error: unknown): boolean {
    return (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    );
  }

  private handleIncoming(raw: unknown): void {
    if (this.destroyed || typeof raw !== "string") return;
    this.lastInboundAt = Date.now();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isRecord(parsed) || typeof parsed.type !== "string") return;
    const message = parsed as unknown as ServerMessage;

    switch (message.type) {
      case "ready":
        this.handleReady(message);
        break;
      case "message:new":
        this.handlers.onMessageNew?.(message.message);
        break;
      case "message:update":
        this.handlers.onMessageUpdate?.(message.message);
        break;
      case "message:reactions":
        this.handlers.onMessageReactions?.(message);
        break;
      case "typing":
        this.handlers.onTyping?.(message);
        break;
      case "presence:online":
        this.handlers.onPresenceOnline?.(message.user);
        break;
      case "presence:offline":
        this.handlers.onPresenceOffline?.(message.userId);
        break;
      case "workspace:changed":
        this.handlers.onWorkspaceChanged?.(message);
        break;
      case "call:peers":
      case "call:peer-joined":
      case "call:peer-left":
      case "call:state":
      case "call:signal":
        this.handlers.onCallEvent?.(message);
        break;
      case "error":
        this.handlers.onOperationError?.(message);
        break;
      case "pong":
        break;
      default:
        break;
    }
  }

  private handleReady(payload: ReadyPayload): void {
    if (this.destroyed) return;

    if (payload.protocolVersion !== PROTOCOL_VERSION) {
      this.failFatally();
      return;
    }

    this.attempt = 0;
    this.lastInboundAt = Date.now();
    this.setStatus("open");
    this.startHeartbeat();
    this.handlers.onReady?.(payload);
    void this.fillGap();
  }

  private handleClose(code: number, socket: WebSocket): void {
    if (this.socket !== socket) return;
    this.socket = null;
    this.stopHeartbeat();

    if (this.destroyed) return;

    if (code === WS_CLOSE_AUTH || code === WS_CLOSE_FORBIDDEN) {
      this.failFatally();
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer !== null) return;

    this.setStatus("reconnecting");
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed) void this.connect();
    }, delay);
  }

  private failFatally(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearTimers();

    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try {
        socket.close(1000, "fatal");
      } catch {
        // Already closing.
      }
    }

    this.setStatus("closed");
    this.handlers.onFatalError?.(REALTIME_CONNECTION_ERROR);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastInboundAt = Date.now();

    this.pingTimer = window.setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      this.sendRaw({ type: "ping", t: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);

    this.silenceTimer = window.setInterval(() => {
      const socket = this.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastInboundAt <= SILENCE_TIMEOUT_MS) return;

      this.setStatus("reconnecting");
      try {
        socket.close(4000, "silence");
      } catch {
        // The close handler will schedule the reconnect.
      }
    }, SILENCE_CHECK_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.silenceTimer !== null) {
      window.clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async fillGap(): Promise<void> {
    let cursor = this.getLastMessageId();

    for (let round = 0; round < GAP_FILL_MAX_ROUNDS; round += 1) {
      if (this.destroyed || this.socket?.readyState !== WebSocket.OPEN) return;

      const query =
        cursor === null
          ? `limit=${GAP_FILL_LIMIT}`
          : `after=${cursor}&limit=${GAP_FILL_LIMIT}`;

      let page: MessagePage;
      try {
        page = await apiFetch<MessagePage>(
          `/api/channels/${encodeURIComponent(this.channelId)}/messages?${query}`,
        );
      } catch {
        return;
      }

      if (this.destroyed) return;
      if (page.messages.length === 0) return;

      this.handlers.onGapMessages?.(page.messages);
      if (!page.hasMore) return;

      const last = page.messages[page.messages.length - 1];
      if (!last || last.id === cursor) return;
      cursor = last.id;
    }
  }
}
