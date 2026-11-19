import type { AppDatabase } from "../db.js";

export interface UserRow {
  id: string;
  username: string;
  username_key: string;
  email: string | null;
  password_hash: string | null;
  is_guest: number;
  created_at: number;
}

export interface NewUserRow {
  id: string;
  username: string;
  usernameKey: string;
  email: string | null;
  passwordHash: string | null;
  isGuest: boolean;
  createdAt: number;
}

const USER_COLUMNS =
  "id, username, username_key, email, password_hash, is_guest, created_at";

export function insertUser(db: AppDatabase, user: NewUserRow): void {
  db.prepare(
    `INSERT INTO users (id, username, username_key, email, password_hash, is_guest, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.username,
    user.usernameKey,
    user.email,
    user.passwordHash,
    user.isGuest ? 1 : 0,
    user.createdAt,
  );
}

export function findUserById(db: AppDatabase, id: string): UserRow | undefined {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as
    | UserRow
    | undefined;
}

export function findUserByUsernameKey(
  db: AppDatabase,
  key: string,
): UserRow | undefined {
  return db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username_key = ?`)
    .get(key) as UserRow | undefined;
}
