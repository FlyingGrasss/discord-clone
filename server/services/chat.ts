import type { MessageDto, MessagePage } from "../../shared/types.js";
import {
  parseMessageCursor,
  parseMessageLimit,
  validateClientId,
  validateMessageContent,
  validateReplyToId,
  type Validated,
} from "../../shared/validation.js";
import type { AppDatabase } from "../db.js";
import { forbidden, isUniqueViolation, notFound, validationError } from "../errors.js";
import type { EventBus } from "../events.js";
import {
  findMessageByClientId,
  findMessageById,
  insertMessage,
  queryMessages,
  softDeleteMessage,
  updateMessageContent,
  type MessageWithAuthorRow,
} from "../repos/messages.js";
import type { WorkspaceService } from "./workspace.js";

export interface CreateMessageInput {
  content?: unknown;
  replyToId?: unknown;
  clientId?: unknown;
}

export interface ListMessageQuery {
  before?: unknown;
  after?: unknown;
  limit?: unknown;
}

function unwrap<T>(result: Validated<T>): T {
  if (!result.ok) throw validationError(result.error.field, result.error.message);
  return result.value;
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

export class ChatService {
  constructor(
    private readonly db: AppDatabase,
    private readonly events: EventBus,
    private readonly workspace: WorkspaceService,
  ) {}

  listMessages(
    userId: string,
    channelId: string,
    query: ListMessageQuery = {},
  ): MessagePage {
    const { channel, serverId } = this.workspace.getChannelAccess(userId, channelId);

    const before = unwrap(parseMessageCursor(query.before, "before"));
    const after = unwrap(parseMessageCursor(query.after, "after"));
    if (before !== undefined && after !== undefined) {
      throw validationError("before", "before ve after aynı anda kullanılamaz.");
    }

    const limit = unwrap(parseMessageLimit(query.limit));
    const rows = queryMessages(this.db, channelId, { before, after, limit });
    const hasMore = rows.length > limit;

    let page = rows.slice(0, limit);
    if (after === undefined) {
      page = [...page].reverse();
    }

    return {
      channel: {
        id: channel.id,
        serverId,
        name: channel.name,
        position: channel.position,
      },
      messages: page.map(toMessageDto),
      hasMore,
    };
  }

  createMessage(
    authorId: string,
    channelId: string,
    input: CreateMessageInput,
  ): MessageDto {
    const { serverId } = this.workspace.getChannelAccess(authorId, channelId);

    const content = unwrap(validateMessageContent(input.content));
    const replyToId = unwrap(validateReplyToId(input.replyToId));
    const clientId = unwrap(validateClientId(input.clientId));

    if (clientId) {
      const existing = findMessageByClientId(this.db, channelId, authorId, clientId);
      if (existing) return toMessageDto(existing);
    }

    if (replyToId !== null) {
      const reply = findMessageById(this.db, replyToId);
      if (!reply || reply.channel_id !== channelId || reply.deleted_at !== null) {
        throw validationError("replyToId", "Yanıtlanan mesaj bu kanalda bulunamadı.");
      }
    }

    const now = Date.now();
    let messageId: number;
    try {
      messageId = insertMessage(this.db, {
        channelId,
        authorId,
        content,
        replyToId,
        clientId,
        createdAt: now,
      });
    } catch (error) {
      if (isUniqueViolation(error) && clientId) {
        const existing = findMessageByClientId(this.db, channelId, authorId, clientId);
        if (existing) return toMessageDto(existing);
      }
      throw error;
    }

    const row = findMessageById(this.db, messageId);
    if (!row) throw notFound("Mesaj bulunamadı.");

    const message = toMessageDto(row);
    this.events.emit("message:new", { serverId, channelId, message });
    return message;
  }

  editMessage(
    userId: string,
    channelId: string,
    messageId: number,
    contentInput: unknown,
  ): MessageDto {
    const { serverId } = this.workspace.getChannelAccess(userId, channelId);
    const row = findMessageById(this.db, messageId);

    if (!row || row.channel_id !== channelId || row.deleted_at !== null) {
      throw notFound("Mesaj bulunamadı.");
    }
    if (row.author_id !== userId) {
      throw forbidden("Yalnızca kendi mesajını düzenleyebilirsin.");
    }

    const content = unwrap(validateMessageContent(contentInput));
    updateMessageContent(this.db, messageId, content, Date.now());

    const updatedRow = findMessageById(this.db, messageId);
    if (!updatedRow) throw notFound("Mesaj bulunamadı.");

    const message = toMessageDto(updatedRow);
    this.events.emit("message:updated", { serverId, channelId, message });
    return message;
  }

  /** Soft-deletes a message. Repeating the call is a no-op without a second event. */
  deleteMessage(userId: string, channelId: string, messageId: number): MessageDto {
    const { serverId } = this.workspace.getChannelAccess(userId, channelId);
    const row = findMessageById(this.db, messageId);

    if (!row || row.channel_id !== channelId) {
      throw notFound("Mesaj bulunamadı.");
    }
    if (row.author_id !== userId) {
      throw forbidden("Yalnızca kendi mesajını silebilirsin.");
    }

    if (row.deleted_at !== null) return toMessageDto(row);

    const deletedAt = Date.now();
    softDeleteMessage(this.db, messageId, deletedAt);

    const deletedRow = findMessageById(this.db, messageId);
    if (!deletedRow) throw notFound("Mesaj bulunamadı.");

    this.events.emit("message:deleted", {
      serverId,
      channelId,
      messageId,
      deletedAt,
    });

    return toMessageDto(deletedRow);
  }
}
