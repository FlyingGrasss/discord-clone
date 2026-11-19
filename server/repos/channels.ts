import type { AppDatabase } from "../db.js";

export interface ChannelRow {
  id: string;
  server_id: string;
  name: string;
  position: number;
  created_at: number;
}

export interface NewChannelRow {
  id: string;
  serverId: string;
  name: string;
  position: number;
  createdAt: number;
}

export interface ChannelWithOwnerRow extends ChannelRow {
  owner_id: string;
}

const CHANNEL_COLUMNS = "id, server_id, name, position, created_at";

export function insertChannel(db: AppDatabase, channel: NewChannelRow): void {
  db.prepare(
    `INSERT INTO channels (id, server_id, name, position, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    channel.id,
    channel.serverId,
    channel.name,
    channel.position,
    channel.createdAt,
  );
}

export function findChannelById(
  db: AppDatabase,
  id: string,
): ChannelWithOwnerRow | undefined {
  return db
    .prepare(
      `SELECT
         c.id, c.server_id, c.name, c.position, c.created_at,
         s.owner_id
       FROM channels c
       JOIN servers s ON s.id = c.server_id
       WHERE c.id = ?`,
    )
    .get(id) as ChannelWithOwnerRow | undefined;
}

export function findChannelByName(
  db: AppDatabase,
  serverId: string,
  name: string,
): ChannelRow | undefined {
  return db
    .prepare(
      `SELECT ${CHANNEL_COLUMNS} FROM channels WHERE server_id = ? AND name = ?`,
    )
    .get(serverId, name) as ChannelRow | undefined;
}

export function listChannelsByServer(
  db: AppDatabase,
  serverId: string,
): ChannelRow[] {
  return db
    .prepare(
      `SELECT ${CHANNEL_COLUMNS}
       FROM channels
       WHERE server_id = ?
       ORDER BY position ASC, created_at ASC, id ASC`,
    )
    .all(serverId) as ChannelRow[];
}

export function countChannelsByServer(db: AppDatabase, serverId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM channels WHERE server_id = ?")
    .get(serverId) as { count: number };
  return row.count;
}

export function nextChannelPosition(db: AppDatabase, serverId: string): number {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM channels WHERE server_id = ?",
    )
    .get(serverId) as { next: number };
  return row.next;
}

export function renameChannel(
  db: AppDatabase,
  id: string,
  name: string,
): void {
  db.prepare("UPDATE channels SET name = ? WHERE id = ?").run(name, id);
}

export function deleteChannel(db: AppDatabase, id: string): boolean {
  return db.prepare("DELETE FROM channels WHERE id = ?").run(id).changes > 0;
}
