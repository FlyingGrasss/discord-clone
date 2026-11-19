import { STATUS_CODES, type IncomingMessage, type Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import {
  PROTOCOL_VERSION,
  REACTION_EMOJIS,
  REALTIME_PATH,
  WS_CLOSE_NORMAL,
  WS_CLOSE_PROTOCOL,
  WS_CLOSE_SLOW_CONSUMER,
  WS_HEARTBEAT_MS,
  WS_MAX_BUFFERED_BYTES,
  WS_MAX_CONNECTIONS_PER_SERVER,
  WS_MAX_CONNECTIONS_PER_USER,
  WS_MAX_PAYLOAD_BYTES,
  WS_TYPING_THROTTLE_MS,
  WS_TYPING_TTL_MS,
  isReactionEmoji,
  type ErrorPayload,
  type PublicUser,
  type ReactionGroup,
  type RealtimeErrorCode,
  type ServerMessage,
  type WorkspaceChangeKind,
} from "../shared/protocol.js";
import type { MessageDto } from "../shared/types.js";
import {
  validateClientId,
  validateMessageContent,
  validateReplyToId,
} from "../shared/validation.js";
import type { AppContext } from "./context.js";
import { ApiError, forbidden, notFound } from "./errors.js";
import { TokenBucketRateLimiter } from "./rate-limit.js";
import { findChannelById, type ChannelWithOwnerRow } from "./repos/channels.js";
import { findMessageById, type MessageWithAuthorRow } from "./repos/messages.js";
import { findServerById, isMember } from "./repos/servers.js";
import { findUserById, type UserRow } from "./repos/users.js";

export interface RealtimeHandle {
  close(): Promise<void>;
}

interface ConnectionState {
  ws: WebSocket;
  userId: string;
  serverId: string;
  user: PublicUser;
  isAlive: boolean;
  closing: boolean;
  removed: boolean;
}

interface PresenceEntry {
  user: PublicUser;
  connections: number;
}

interface ReactionRow {
  emoji: string;
  user_id: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMessageId(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    !Number.isSafeInteger(value)
  ) {
    return null;
  }
  return value;
}

function rawDataToText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  return Buffer.from(data).toString("utf8");
}

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    isGuest: user.is_guest === 1,
  };
}

function toMessageDto(row: MessageWithAuthorRow): MessageDto {
  return {
    id: row.id,
    channelId: row.channel_id,
    author: {
      id: row.author_id,
      username: row.author_username,
      isGuest: row.author_is_guest === 1,
    },
    content: row.content,
    replyToId: row.reply_to_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
  };
}

function rejectUpgrade(
  socket: Duplex,
  status: number,
  code: string,
  message: string,
): void {
  const body = JSON.stringify({ error: { code, message } });
  const reason = STATUS_CODES[status] ?? "Error";
  try {
    socket.end(
      `HTTP/1.1 ${status} ${reason}\r\n` +
        "Connection: close\r\n" +
        "Content-Type: application/json; charset=utf-8\r\n" +
        `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n` +
        "\r\n" +
        body,
    );
  } catch {
    socket.destroy();
  }
}

/**
 * Attaches the realtime WebSocket layer to an already-created HTTP server.
 * Callers own the HTTP lifecycle; close this handle before closing the server
 * so the upgrade sockets are terminated cleanly.
 */
export function attachRealtime(ctx: AppContext, httpServer: HttpServer): RealtimeHandle {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: WS_MAX_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });

  const connections = new Set<ConnectionState>();
  const serverConnections = new Map<string, Set<ConnectionState>>();
  const userConnections = new Map<string, Set<ConnectionState>>();
  const presence = new Map<string, Map<string, PresenceEntry>>();
  const typingThrottle = new Map<string, number>();
  const messageLimiter = new TokenBucketRateLimiter(5, 1_000);

  let disposed = false;

  const sendRaw = (state: ConnectionState, payload: string): void => {
    if (state.closing || state.ws.readyState !== WebSocket.OPEN) return;

    if (state.ws.bufferedAmount >= WS_MAX_BUFFERED_BYTES) {
      state.closing = true;
      state.ws.close(WS_CLOSE_SLOW_CONSUMER, "slow consumer");
      return;
    }

    try {
      state.ws.send(payload, (error) => {
        if (!error) return;
        state.closing = true;
        state.ws.terminate();
      });
    } catch {
      state.closing = true;
      state.ws.terminate();
      return;
    }

    if (state.ws.bufferedAmount >= WS_MAX_BUFFERED_BYTES) {
      state.closing = true;
      state.ws.close(WS_CLOSE_SLOW_CONSUMER, "slow consumer");
    }
  };

  const send = (state: ConnectionState, message: ServerMessage): void => {
    sendRaw(state, JSON.stringify(message));
  };

  const sendError = (
    state: ConnectionState,
    code: RealtimeErrorCode,
    message: string,
    clientId?: string,
    retryAfterMs?: number,
  ): void => {
    const payload: ErrorPayload & { type: "error" } = {
      type: "error",
      code,
      message,
      ...(clientId ? { clientId } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
    send(state, payload);
  };

  const sendApiFailure = (
    state: ConnectionState,
    error: unknown,
    clientId?: string,
  ): void => {
    if (error instanceof ApiError) {
      sendError(state, error.code, error.message, clientId, error.retryAfterMs);
      return;
    }

    console.error(
      "[realtime] işlem hatası:",
      error instanceof Error ? error.message : "bilinmeyen hata",
    );
    sendError(
      state,
      "INTERNAL_ERROR",
      "Beklenmeyen bir sunucu hatası oluştu.",
      clientId,
    );
  };

  const broadcast = (
    serverId: string,
    message: ServerMessage,
    except?: ConnectionState,
  ): void => {
    const states = serverConnections.get(serverId);
    if (!states || states.size === 0) return;

    const payload = JSON.stringify(message);
    for (const state of [...states]) {
      if (state === except) continue;
      sendRaw(state, payload);
    }
  };

  const listReactions = (messageId: number): ReactionGroup[] => {
    const rows = ctx.db
      .prepare(
        `SELECT emoji, user_id
         FROM reactions
         WHERE message_id = ?
         ORDER BY created_at ASC, user_id ASC`,
      )
      .all(messageId) as ReactionRow[];

    const byEmoji = new Map<string, string[]>();
    for (const row of rows) {
      let userIds = byEmoji.get(row.emoji);
      if (!userIds) {
        userIds = [];
        byEmoji.set(row.emoji, userIds);
      }
      userIds.push(row.user_id);
    }

    const reactions: ReactionGroup[] = [];
    for (const emoji of REACTION_EMOJIS) {
      const userIds = byEmoji.get(emoji);
      if (userIds) reactions.push({ emoji, userIds });
    }
    return reactions;
  };

  const broadcastReactions = (
    serverId: string,
    messageId: number,
    channelId: string,
  ): void => {
    broadcast(serverId, {
      type: "message:reactions",
      messageId,
      channelId,
      reactions: listReactions(messageId),
    });
  };

  const requireChannel = (
    state: ConnectionState,
    channelId: string,
  ): ChannelWithOwnerRow => {
    const channel = findChannelById(ctx.db, channelId);
    if (!channel) throw notFound("Kanal bulunamadı.");
    if (channel.server_id !== state.serverId) {
      throw forbidden("Kanal bu sunucuya ait değil.");
    }

    // Membership can change while the socket is open; re-check every action.
    ctx.services.workspace.requireMember(state.userId, state.serverId);
    return channel;
  };

  const requireMessage = (
    state: ConnectionState,
    messageId: number,
  ): MessageWithAuthorRow => {
    const message = findMessageById(ctx.db, messageId);
    if (!message) throw notFound("Mesaj bulunamadı.");
    requireChannel(state, message.channel_id);
    return message;
  };

  const protocolViolation = (state: ConnectionState, message: string): void => {
    if (state.closing) return;
    sendError(state, "PROTOCOL_ERROR", message);
    state.closing = true;
    state.ws.close(WS_CLOSE_PROTOCOL, "protocol violation");
  };

  const toggleReaction = (
    messageId: number,
    userId: string,
    emoji: string,
  ): void => {
    const existing = ctx.db
      .prepare(
        "SELECT 1 AS present FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      )
      .get(messageId, userId, emoji);

    if (existing) {
      ctx.db
        .prepare(
          "DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
        )
        .run(messageId, userId, emoji);
      return;
    }

    ctx.db
      .prepare(
        "INSERT INTO reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(messageId, userId, emoji, Date.now());
  };

  const handleSend = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    const clientIdResult = validateClientId(message.clientId);
    if (!clientIdResult.ok || clientIdResult.value === null) {
      sendError(
        state,
        "VALIDATION_ERROR",
        clientIdResult.ok ? "İstemci kimliği gerekli." : clientIdResult.error.message,
      );
      return;
    }
    const clientId = clientIdResult.value;

    const channelId = typeof message.channelId === "string" ? message.channelId : "";
    if (channelId.length === 0) {
      sendError(state, "VALIDATION_ERROR", "Kanal kimliği gerekli.", clientId);
      return;
    }

    const contentResult = validateMessageContent(message.content);
    if (!contentResult.ok) {
      sendError(state, "VALIDATION_ERROR", contentResult.error.message, clientId);
      return;
    }

    const replyResult = validateReplyToId(message.replyToId);
    if (!replyResult.ok) {
      sendError(state, "VALIDATION_ERROR", replyResult.error.message, clientId);
      return;
    }

    const decision = messageLimiter.take(state.userId);
    if (!decision.allowed) {
      sendError(
        state,
        "RATE_LIMITED",
        "Çok fazla mesaj gönderdin. Lütfen biraz bekle.",
        clientId,
        decision.retryAfterMs,
      );
      return;
    }

    try {
      requireChannel(state, channelId);
      ctx.services.chat.createMessage(state.userId, channelId, {
        content: contentResult.value,
        replyToId: replyResult.value,
        clientId,
      });
    } catch (error) {
      sendApiFailure(state, error, clientId);
    }
  };

  const handleEdit = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    const messageId = readMessageId(message.messageId);
    if (messageId === null) {
      sendError(state, "VALIDATION_ERROR", "Mesaj kimliği geçersiz.");
      return;
    }

    const contentResult = validateMessageContent(message.content);
    if (!contentResult.ok) {
      sendError(state, "VALIDATION_ERROR", contentResult.error.message);
      return;
    }

    try {
      const existing = requireMessage(state, messageId);
      ctx.services.chat.editMessage(
        state.userId,
        existing.channel_id,
        messageId,
        contentResult.value,
      );
    } catch (error) {
      sendApiFailure(state, error);
    }
  };

  const handleDelete = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    const messageId = readMessageId(message.messageId);
    if (messageId === null) {
      sendError(state, "VALIDATION_ERROR", "Mesaj kimliği geçersiz.");
      return;
    }

    try {
      const existing = requireMessage(state, messageId);
      ctx.services.chat.deleteMessage(state.userId, existing.channel_id, messageId);
    } catch (error) {
      sendApiFailure(state, error);
    }
  };

  const handleReaction = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    const messageId = readMessageId(message.messageId);
    if (messageId === null) {
      sendError(state, "VALIDATION_ERROR", "Mesaj kimliği geçersiz.");
      return;
    }

    if (!isReactionEmoji(message.emoji)) {
      sendError(state, "VALIDATION_ERROR", "Bu tepki desteklenmiyor.");
      return;
    }

    try {
      const existing = requireMessage(state, messageId);
      if (existing.deleted_at !== null) throw notFound("Mesaj bulunamadı.");

      toggleReaction(messageId, state.userId, message.emoji);
      broadcast(state.serverId, {
        type: "message:reactions",
        messageId,
        channelId: existing.channel_id,
        reactions: listReactions(messageId),
      });
    } catch (error) {
      sendApiFailure(state, error);
    }
  };

  const handleTyping = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    const channelId = typeof message.channelId === "string" ? message.channelId : "";
    if (channelId.length === 0) {
      sendError(state, "VALIDATION_ERROR", "Kanal kimliği gerekli.");
      return;
    }

    try {
      requireChannel(state, channelId);
    } catch (error) {
      sendApiFailure(state, error);
      return;
    }

    const now = Date.now();
    const last = typingThrottle.get(state.userId) ?? 0;
    if (now - last < WS_TYPING_THROTTLE_MS) return;
    typingThrottle.set(state.userId, now);

    broadcast(state.serverId, {
      type: "typing",
      channelId,
      user: state.user,
      expiresAt: now + WS_TYPING_TTL_MS,
    });
  };

  const handlePing = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    if (typeof message.t !== "number" || !Number.isFinite(message.t)) {
      sendError(state, "VALIDATION_ERROR", "Ping değeri sayı olmalı.");
      return;
    }

    try {
      ctx.services.workspace.requireMember(state.userId, state.serverId);
    } catch (error) {
      sendApiFailure(state, error);
      return;
    }

    send(state, { type: "pong", t: message.t });
  };

  const handleClientMessage = (
    state: ConnectionState,
    message: Record<string, unknown>,
  ): void => {
    switch (message.type) {
      case "message:send":
        handleSend(state, message);
        break;
      case "message:edit":
        handleEdit(state, message);
        break;
      case "message:delete":
        handleDelete(state, message);
        break;
      case "reaction:toggle":
        handleReaction(state, message);
        break;
      case "typing":
        handleTyping(state, message);
        break;
      case "ping":
        handlePing(state, message);
        break;
      default:
        protocolViolation(state, "Bilinmeyen protokol mesajı.");
        break;
    }
  };

  const cleanup = (state: ConnectionState): void => {
    if (state.removed) return;
    state.removed = true;

    connections.delete(state);

    const userSet = userConnections.get(state.userId);
    userSet?.delete(state);
    if (userSet && userSet.size === 0) {
      userConnections.delete(state.userId);
      typingThrottle.delete(state.userId);
    }

    const serverSet = serverConnections.get(state.serverId);
    serverSet?.delete(state);
    if (serverSet && serverSet.size === 0) {
      serverConnections.delete(state.serverId);
    }

    const users = presence.get(state.serverId);
    if (!users) return;

    const entry = users.get(state.userId);
    if (!entry) return;

    entry.connections -= 1;
    if (entry.connections > 0) return;

    users.delete(state.userId);
    if (users.size === 0) {
      presence.delete(state.serverId);
    }

    if (
      !disposed &&
      (serverConnections.get(state.serverId)?.size ?? 0) > 0
    ) {
      broadcast(state.serverId, {
        type: "presence:offline",
        userId: state.userId,
      });
    }
  };

  const closeServerConnections = (
    serverId: string,
    kind: WorkspaceChangeKind,
    userId?: string,
  ): void => {
    const states = [...(serverConnections.get(serverId) ?? [])];
    const affected = states.filter(
      (state) =>
        !state.closing && (kind === "member:left" ? state.userId === userId : true),
    );
    if (affected.length === 0) return;

    broadcast(serverId, {
      type: "workspace:changed",
      kind,
      ...(userId ? { userId } : {}),
    });

    if (kind === "server:deleted") {
      presence.delete(serverId);
    }

    const reason = kind === "server:deleted" ? "server deleted" : "membership ended";
    for (const state of affected) {
      state.closing = true;
      try {
        state.ws.close(WS_CLOSE_NORMAL, reason);
      } catch {
        state.ws.terminate();
      }
    }
  };

  const auditWorkspace = (): void => {
    if (disposed) return;

    for (const serverId of [...serverConnections.keys()]) {
      const states = serverConnections.get(serverId);
      if (!states || states.size === 0) {
        serverConnections.delete(serverId);
        presence.delete(serverId);
        continue;
      }

      if (!findServerById(ctx.db, serverId)) {
        closeServerConnections(serverId, "server:deleted");
        continue;
      }

      const userIds = new Set<string>();
      for (const state of states) userIds.add(state.userId);

      for (const userId of userIds) {
        if (isMember(ctx.db, serverId, userId)) continue;
        closeServerConnections(serverId, "member:left", userId);
      }
    }
  };

  const registerConnection = (
    ws: WebSocket,
    userId: string,
    serverId: string,
    userRow: UserRow,
  ): void => {
    const user = toPublicUser(userRow);
    const state: ConnectionState = {
      ws,
      userId,
      serverId,
      user,
      isAlive: true,
      closing: false,
      removed: false,
    };

    connections.add(state);

    let serverSet = serverConnections.get(serverId);
    if (!serverSet) {
      serverSet = new Set();
      serverConnections.set(serverId, serverSet);
    }
    serverSet.add(state);

    let userSet = userConnections.get(userId);
    if (!userSet) {
      userSet = new Set();
      userConnections.set(userId, userSet);
    }
    userSet.add(state);

    let users = presence.get(serverId);
    if (!users) {
      users = new Map();
      presence.set(serverId, users);
    }

    const existingPresence = users.get(userId);
    const firstConnectionForUser = existingPresence === undefined;
    if (existingPresence) {
      existingPresence.connections += 1;
    } else {
      users.set(userId, { user, connections: 1 });
    }

    ws.on("pong", () => {
      state.isAlive = true;
    });

    ws.on("message", (data, isBinary) => {
      if (state.closing) return;

      if (isBinary) {
        protocolViolation(state, "İkili çerçeve desteklenmiyor.");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawDataToText(data));
      } catch {
        protocolViolation(state, "Mesaj geçerli JSON değil.");
        return;
      }

      if (!isRecord(parsed) || typeof parsed.type !== "string") {
        protocolViolation(state, "Protokol mesajı bir nesne ve type alanı içermeli.");
        return;
      }

      try {
        handleClientMessage(state, parsed);
      } catch (error) {
        sendApiFailure(state, error);
      }
    });

    ws.on("error", () => {
      // The ws receiver already initiates the protocol-level close (for
      // example 1009 for oversized payloads); just stop using this socket.
      state.closing = true;
    });

    ws.on("close", () => {
      cleanup(state);
    });

    send(state, {
      type: "ready",
      protocolVersion: PROTOCOL_VERSION,
      serverId,
      self: user,
      online: [...users.values()].map((entry) => entry.user),
    });

    if (firstConnectionForUser) {
      broadcast(serverId, { type: "presence:online", user }, state);
    }
  };

  const onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    let url: URL;
    try {
      url = new URL(request.url ?? "", `http://${request.headers.host ?? "localhost"}`);
    } catch {
      rejectUpgrade(socket, 400, "VALIDATION_ERROR", "Geçersiz istek adresi.");
      return;
    }

    if (url.pathname !== REALTIME_PATH) {
      rejectUpgrade(socket, 404, "NOT_FOUND", "Kaynak bulunamadı.");
      return;
    }

    if (request.method !== "GET") {
      rejectUpgrade(socket, 405, "VALIDATION_ERROR", "Yalnızca GET destekleniyor.");
      return;
    }

    const origin = request.headers.origin;
    if (typeof origin !== "string" || !ctx.config.allowedOrigins.includes(origin)) {
      rejectUpgrade(socket, 403, "FORBIDDEN", "İstek kaynağına izin verilmiyor.");
      return;
    }

    const record = ctx.tickets.consume(url.searchParams.get("ticket") ?? "");
    if (!record) {
      rejectUpgrade(
        socket,
        401,
        "UNAUTHORIZED",
        "Realtime bileti geçersiz veya süresi dolmuş.",
      );
      return;
    }

    const userRow = findUserById(ctx.db, record.userId);
    if (!userRow) {
      rejectUpgrade(socket, 401, "UNAUTHORIZED", "Oturum gerekli.");
      return;
    }

    try {
      ctx.services.workspace.requireMember(record.userId, record.serverId);
    } catch {
      rejectUpgrade(socket, 403, "FORBIDDEN", "Bu sunucuya erişim yok.");
      return;
    }

    if (
      (userConnections.get(record.userId)?.size ?? 0) >=
      WS_MAX_CONNECTIONS_PER_USER
    ) {
      rejectUpgrade(
        socket,
        429,
        "TOO_MANY_CONNECTIONS",
        "Kullanıcı başına bağlantı sınırı aşıldı.",
      );
      return;
    }

    if (
      (serverConnections.get(record.serverId)?.size ?? 0) >=
      WS_MAX_CONNECTIONS_PER_SERVER
    ) {
      rejectUpgrade(
        socket,
        503,
        "SERVER_LIMIT",
        "Sunucu başına bağlantı sınırı aşıldı.",
      );
      return;
    }

    try {
      wss.handleUpgrade(request, socket, head, (ws) => {
        registerConnection(ws, record.userId, record.serverId, userRow);
      });
    } catch {
      socket.destroy();
    }
  };

  const unsubscribeNew = ctx.events.on("message:new", (event) => {
    broadcast(event.serverId, { type: "message:new", message: event.message });
    broadcastReactions(event.serverId, event.message.id, event.channelId);
  });

  const unsubscribeUpdated = ctx.events.on("message:updated", (event) => {
    broadcast(event.serverId, { type: "message:update", message: event.message });
    broadcastReactions(event.serverId, event.message.id, event.channelId);
  });

  const unsubscribeDeleted = ctx.events.on("message:deleted", (event) => {
    const row = findMessageById(ctx.db, event.messageId);
    if (!row) return;

    broadcast(event.serverId, {
      type: "message:update",
      message: toMessageDto(row),
    });
    broadcastReactions(event.serverId, event.messageId, event.channelId);
  });

  const heartbeat = setInterval(() => {
    for (const state of [...connections]) {
      if (state.ws.readyState !== WebSocket.OPEN) continue;

      if (!state.isAlive) {
        state.closing = true;
        state.ws.terminate();
        continue;
      }

      state.isAlive = false;
      try {
        state.ws.ping();
      } catch {
        state.closing = true;
        state.ws.terminate();
      }
    }
  }, WS_HEARTBEAT_MS);
  heartbeat.unref?.();

  const audit = setInterval(auditWorkspace, 1_000);
  audit.unref?.();

  wss.on("error", (error) => {
    console.error("[realtime] sunucu hatası:", error.message);
  });

  httpServer.on("upgrade", onUpgrade);

  let closingPromise: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (closingPromise) return closingPromise;

    closingPromise = (async () => {
      disposed = true;
      clearInterval(heartbeat);
      clearInterval(audit);
      httpServer.off("upgrade", onUpgrade);
      unsubscribeNew();
      unsubscribeUpdated();
      unsubscribeDeleted();

      const socketClosed = [...connections].map(
        (state) =>
          new Promise<void>((resolve) => {
            if (state.ws.readyState === WebSocket.CLOSED) {
              resolve();
              return;
            }
            state.closing = true;
            state.ws.once("close", () => resolve());
            state.ws.terminate();
          }),
      );
      await Promise.all(socketClosed);

      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
    })();

    return closingPromise;
  };

  return { close };
}
