import type {
  RemoteDeviceRow,
  RemoteDeviceView,
  RemoteSessionRow,
  RemoteSessionView
} from "../types/platform";

export async function getRemoteDeviceByInstallId(db: D1Database, deviceInstallId: string): Promise<RemoteDeviceRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, device_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, created_at, updated_at
       FROM remote_devices
      WHERE device_install_id = ?`
  )
    .bind(deviceInstallId)
    .first<RemoteDeviceRow>();
  return row ?? null;
}

export async function getRemoteDeviceById(db: D1Database, deviceId: string): Promise<RemoteDeviceRow | null> {
  const row = await db.prepare(
    `SELECT id, user_id, device_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, created_at, updated_at
       FROM remote_devices
      WHERE id = ?`
  )
    .bind(deviceId)
    .first<RemoteDeviceRow>();
  return row ?? null;
}

export async function listRemoteDevicesByUserId(db: D1Database, userId: string): Promise<RemoteDeviceRow[]> {
  const rows = await db.prepare(
    `SELECT id, user_id, device_install_id, display_name, platform, app_version,
            local_origin, status, last_seen_at, created_at, updated_at
       FROM remote_devices
      WHERE user_id = ?
      ORDER BY updated_at DESC, id DESC`
  )
    .bind(userId)
    .all<RemoteDeviceRow>();
  return rows.results ?? [];
}

export async function upsertRemoteDevice(
  db: D1Database,
  payload: {
    id: string;
    userId: string;
    deviceInstallId: string;
    displayName: string;
    platform: string;
    appVersion: string;
    localOrigin: string;
    status: "online" | "offline";
    lastSeenAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO remote_devices (
      id, user_id, device_install_id, display_name, platform, app_version,
      local_origin, status, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_install_id) DO UPDATE SET
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      platform = excluded.platform,
      app_version = excluded.app_version,
      local_origin = excluded.local_origin,
      status = excluded.status,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at`
  )
    .bind(
      payload.id,
      payload.userId,
      payload.deviceInstallId,
      payload.displayName,
      payload.platform,
      payload.appVersion,
      payload.localOrigin,
      payload.status,
      payload.lastSeenAt,
      now,
      now
    )
    .run();
}

export async function touchRemoteDevice(
  db: D1Database,
  deviceId: string,
  payload: {
    status: "online" | "offline";
    lastSeenAt: string;
  }
): Promise<void> {
  await db.prepare(
    `UPDATE remote_devices
        SET status = ?,
            last_seen_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(payload.status, payload.lastSeenAt, payload.lastSeenAt, deviceId)
    .run();
}

export async function createRemoteSession(
  db: D1Database,
  payload: {
    id: string;
    token: string;
    userId: string;
    deviceId: string;
    expiresAt: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO remote_sessions (
      id, token, user_id, device_id, status, expires_at, last_used_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  )
    .bind(payload.id, payload.token, payload.userId, payload.deviceId, payload.expiresAt, now, now, now)
    .run();
}

export async function getRemoteSessionByToken(db: D1Database, token: string): Promise<RemoteSessionRow | null> {
  const row = await db.prepare(
    `SELECT id, token, user_id, device_id, status, expires_at, last_used_at, created_at, updated_at
       FROM remote_sessions
      WHERE token = ?`
  )
    .bind(token)
    .first<RemoteSessionRow>();
  return row ?? null;
}

export async function touchRemoteSession(db: D1Database, sessionId: string, lastUsedAt: string): Promise<void> {
  await db.prepare(
    `UPDATE remote_sessions
        SET last_used_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(lastUsedAt, lastUsedAt, sessionId)
    .run();
}

export function toRemoteDeviceView(row: RemoteDeviceRow): RemoteDeviceView {
  return {
    id: row.id,
    deviceInstallId: row.device_install_id,
    displayName: row.display_name,
    platform: row.platform,
    appVersion: row.app_version,
    localOrigin: row.local_origin,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toRemoteSessionView(row: RemoteSessionRow, openUrl: string): RemoteSessionView {
  return {
    id: row.id,
    deviceId: row.device_id,
    status: row.status,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    openUrl
  };
}
