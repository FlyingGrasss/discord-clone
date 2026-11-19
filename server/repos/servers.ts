import type { AppDatabase } from "../db.js";

export interface ServerRow {
  id: string;
  name: string;
  icon_emoji: string;
  icon_color: string;
  owner_id: string;
  invite_code: string;
  created_at: number;
}

export interface ServerSummaryRow extends ServerRow {
  is_owner: number;
}

export interface NewServerRow {
  id: string;
  name: string;
  iconEmoji: string;
  iconColor: string;
  ownerId: string;
  inviteCode: string;
  createdAt: number;
}

export interface ServerMemberRow {
  id: string;
  username: string;
  is_guest: number;
  joined_at: number;
}

const SERVER_COLUMNS =
  "id, name, icon_emoji, icon_color, owner_id, invite_code, created_at";

export function insertServer(db: AppDatabase, server: NewServerRow): void {
  db.prepare(
    `INSERT INTO servers (id, name, icon_emoji, icon_color, owner_id, invite_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    server.id,
    server.name,
    server.iconEmoji,
    server.iconColor,
    server.ownerId,
    server.inviteCode,
    server.createdAt,
  );
}

export function findServerById(db: AppDatabase, id: string): ServerRow | undefined {
  return db.prepare(`SELECT ${SERVER_COLUMNS} FROM servers WHERE id = ?`).get(id) as
    | ServerRow
    | undefined;
}

export function findServerByInviteCode(
  db: AppDatabase,
  code: string,
): ServerRow | undefined {
  return db
    .prepare(`SELECT ${SERVER_COLUMNS} FROM servers WHERE invite_code = ?`)
    .get(code) as ServerRow | undefined;
}

export function listServersForUser(
  db: AppDatabase,
  userId: string,
): ServerSummaryRow[] {
  return db
    .prepare(
      `SELECT
         s.id, s.name, s.icon_emoji, s.icon_color, s.owner_id, s.invite_code, s.created_at,
         CASE WHEN s.owner_id = ? THEN 1 ELSE 0 END AS is_owner
       FROM servers s
       JOIN server_members sm ON sm.server_id = s.id
       WHERE sm.user_id = ?
       ORDER BY sm.joined_at ASC, s.name COLLATE NOCASE ASC`,
    )
    .all(userId, userId) as ServerSummaryRow[];
}

export function updateServer(
  db: AppDatabase,
  id: string,
  values: { name: string; iconEmoji: string; iconColor: string },
): void {
  db.prepare(
    "UPDATE servers SET name = ?, icon_emoji = ?, icon_color = ? WHERE id = ?",
  ).run(values.name, values.iconEmoji, values.iconColor, id);
}

export function deleteServer(db: AppDatabase, id: string): boolean {
  return db.prepare("DELETE FROM servers WHERE id = ?").run(id).changes > 0;
}

export function addMember(
  db: AppDatabase,
  serverId: string,
  userId: string,
  joinedAt: number,
): boolean {
  return (
    db
      .prepare(
        `INSERT OR IGNORE INTO server_members (server_id, user_id, joined_at)
         VALUES (?, ?, ?)`,
      )
      .run(serverId, userId, joinedAt).changes > 0
  );
}

export function removeMember(
  db: AppDatabase,
  serverId: string,
  userId: string,
): boolean {
  return (
    db
      .prepare("DELETE FROM server_members WHERE server_id = ? AND user_id = ?")
      .run(serverId, userId).changes > 0
  );
}

export function isMember(
  db: AppDatabase,
  serverId: string,
  userId: string,
): boolean {
  return (
    db
      .prepare("SELECT 1 AS present FROM server_members WHERE server_id = ? AND user_id = ?")
      .get(serverId, userId) !== undefined
  );
}

export function countMembers(db: AppDatabase, serverId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM server_members WHERE server_id = ?")
    .get(serverId) as { count: number };
  return row.count;
}

export function listMembers(
  db: AppDatabase,
  serverId: string,
): ServerMemberRow[] {
  return db
    .prepare(
      `SELECT u.id, u.username, u.is_guest, sm.joined_at
       FROM server_members sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.server_id = ?
       ORDER BY sm.joined_at ASC, u.username COLLATE NOCASE ASC`,
    )
    .all(serverId) as ServerMemberRow[];
}
