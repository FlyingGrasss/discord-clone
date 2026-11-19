import type { AppDatabase } from "../db.js";

export interface MessageRow {
  id: number;
  channel_id: string;
  author_id: string;
  content: string;
  reply_to_id: number | null;
  client_id: string | null;
  created_at: number;
  edited_at: number | null;
  deleted_at: number | null;
}

export interface MessageWithAuthorRow extends MessageRow {
  author_username: string;
  author_is_guest: number;
}

export interface NewMessageRow {
  channelId: string;
  authorId: string;
  content: string;
  replyToId: number | null;
  clientId: string | null;
  createdAt: number;
}

export interface MessageQuery {
  before?: number;
  after?: number;
  limit: number;
}

const MESSAGE_SELECT = `
  SELECT
    m.id, m.channel_id, m.author_id, m.content, m.reply_to_id, m.client_id,
    m.created_at, m.edited_at, m.deleted_at,
    u.username AS author_username,
    u.is_guest AS author_is_guest
  FROM messages m
  JOIN users u ON u.id = m.author_id
`;

export function insertMessage(db: AppDatabase, message: NewMessageRow): number {
  const result = db
    .prepare(
      `INSERT INTO messages
         (channel_id, author_id, content, reply_to_id, client_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      message.channelId,
      message.authorId,
      message.content,
      message.replyToId,
      message.clientId,
      message.createdAt,
    );

  return Number(result.lastInsertRowid);
}

export function findMessageById(
  db: AppDatabase,
  id: number,
): MessageWithAuthorRow | undefined {
  return db
    .prepare(`${MESSAGE_SELECT} WHERE m.id = ?`)
    .get(id) as MessageWithAuthorRow | undefined;
}

export function findMessageByClientId(
  db: AppDatabase,
  channelId: string,
  authorId: string,
  clientId: string,
): MessageWithAuthorRow | undefined {
  return db
    .prepare(
      `${MESSAGE_SELECT}
       WHERE m.channel_id = ? AND m.author_id = ? AND m.client_id = ?`,
    )
    .get(channelId, authorId, clientId) as MessageWithAuthorRow | undefined;
}

/**
 * Returns at most `limit + 1` rows (caller uses the extra row for hasMore).
 * A page without a cursor starts at the newest message; `after` pages move
 * forward and are already chronological; `before`/default pages are newest
 * first and must be reversed by the caller.
 */
export function queryMessages(
  db: AppDatabase,
  channelId: string,
  query: MessageQuery,
): MessageWithAuthorRow[] {
  const conditions = ["m.channel_id = ?"];
  const params: Array<string | number> = [channelId];

  if (query.after !== undefined) {
    conditions.push("m.id > ?");
    params.push(query.after);
  } else if (query.before !== undefined) {
    conditions.push("m.id < ?");
    params.push(query.before);
  }

  const direction = query.after !== undefined ? "ASC" : "DESC";
  params.push(query.limit + 1);

  return db
    .prepare(
      `${MESSAGE_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.id ${direction}
       LIMIT ?`,
    )
    .all(...params) as MessageWithAuthorRow[];
}

export function updateMessageContent(
  db: AppDatabase,
  id: number,
  content: string,
  editedAt: number,
): void {
  db.prepare("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?").run(
    content,
    editedAt,
    id,
  );
}

export function softDeleteMessage(
  db: AppDatabase,
  id: number,
  deletedAt: number,
): void {
  db.prepare(
    "UPDATE messages SET content = '', deleted_at = ?, edited_at = NULL WHERE id = ?",
  ).run(deletedAt, id);
}
