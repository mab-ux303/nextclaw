PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS remote_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_install_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  app_version TEXT NOT NULL,
  local_origin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_remote_devices_user_updated_at
  ON remote_devices(user_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_remote_devices_status_last_seen_at
  ON remote_devices(status, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS remote_sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  expires_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES remote_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_user_updated_at
  ON remote_sessions(user_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_device_updated_at
  ON remote_sessions(device_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_token_status
  ON remote_sessions(token, status);
