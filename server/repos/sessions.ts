import type { AppDatabase } from "../db.js";
import type { UserRow } from "./users.js";

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: number;
  expires_at: number;
}

export interface NewSessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface ResolvedSession {
  sessionId: string;
  expiresAt: number;
  user: UserRow;
}

interface SessionJoinRow {
  session_id: string;
  expires_at: number;
  user_id: string;
  username: string;
  username_key: string;
  email: string | null;
  password_hash: string | null;
  is_guest: number;
  created_at: number;
}

export function insertSession(db: AppDatabase, session: NewSessionRow): void {
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.userId,
    session.tokenHash,
    session.createdAt,
    session.expiresAt,
  );
}

export function findSessionByTokenHash(
  db: AppDatabase,
  tokenHash: string,
  now: number,
): ResolvedSession | undefined {
  const row = db
    .prepare(
      `SELECT
         s.id AS session_id,
         s.expires_at,
         u.id AS user_id,
         u.username,
         u.username_key,
         u.email,
         u.password_hash,
         u.is_guest,
         u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as SessionJoinRow | undefined;

  if (!row) return undefined;

  return {
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      username: row.username,
      username_key: row.username_key,
      email: row.email,
      password_hash: row.password_hash,
      is_guest: row.is_guest,
      created_at: row.created_at,
    },
  };
}

export function deleteSessionByTokenHash(db: AppDatabase, tokenHash: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function deleteExpiredSessions(db: AppDatabase, now: number): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
}
