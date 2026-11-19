PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL CHECK (length(username) BETWEEN 3 AND 20),
  username_key TEXT NOT NULL UNIQUE,
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  password_hash TEXT,
  is_guest INTEGER NOT NULL DEFAULT 0 CHECK (is_guest IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 48),
  icon_emoji TEXT NOT NULL,
  icon_color TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  invite_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);

CREATE TABLE IF NOT EXISTS server_members (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_user_joined
  ON server_members(user_id, joined_at);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 32),
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_channels_server_position
  ON channels(server_id, position);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (length(content) <= 2000),
  reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  client_id TEXT CHECK (client_id IS NULL OR length(client_id) <= 64),
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  CHECK (deleted_at IS NOT NULL OR length(content) > 0),
  CHECK (deleted_at IS NULL OR content = '')
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client
  ON messages(channel_id, author_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(emoji) <= 8),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id, emoji)
);
