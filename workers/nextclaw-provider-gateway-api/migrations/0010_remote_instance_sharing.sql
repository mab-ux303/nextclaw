PRAGMA foreign_keys = ON;

ALTER TABLE remote_sessions
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'owner_open'
  CHECK (source_type IN ('owner_open', 'share_grant'));

ALTER TABLE remote_sessions
  ADD COLUMN source_grant_id TEXT;

ALTER TABLE remote_sessions
  ADD COLUMN opened_by_user_id TEXT;

ALTER TABLE remote_sessions
  ADD COLUMN revoked_at TEXT;

CREATE INDEX IF NOT EXISTS idx_remote_sessions_source_grant_active
  ON remote_sessions(source_grant_id, status, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS remote_share_grants (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES remote_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_remote_share_grants_owner_updated_at
  ON remote_share_grants(owner_user_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_remote_share_grants_device_updated_at
  ON remote_share_grants(device_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_remote_share_grants_token_status
  ON remote_share_grants(token, status);
