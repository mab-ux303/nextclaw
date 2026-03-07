PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  free_limit_usd REAL NOT NULL DEFAULT 0,
  free_used_usd REAL NOT NULL DEFAULT 0,
  paid_balance_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('usage_free', 'usage_paid', 'usage_mixed', 'recharge', 'admin_adjust')),
  amount_usd REAL NOT NULL,
  free_amount_usd REAL NOT NULL DEFAULT 0,
  paid_amount_usd REAL NOT NULL DEFAULT 0,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  request_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_created_at ON usage_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_request_id ON usage_ledger(request_id);

CREATE TABLE IF NOT EXISTS recharge_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_usd REAL NOT NULL CHECK (amount_usd > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_user_id TEXT,
  rejected_at TEXT,
  rejected_by_user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id),
  FOREIGN KEY (rejected_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_recharge_intents_user_created_at ON recharge_intents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recharge_intents_status_created_at ON recharge_intents(status, created_at DESC);
