import type { Context } from "hono";
import {
  appendAuditLog
} from "../repositories/platform-repository";
import {
  createRemoteSession,
  getRemoteDeviceById,
  getRemoteDeviceByInstallId,
  getRemoteSessionByToken,
  listRemoteDevicesByUserId,
  toRemoteDeviceView,
  toRemoteSessionView,
  touchRemoteSession,
  upsertRemoteDevice
} from "../repositories/remote-repository";
import { ensurePlatformBootstrap, requireAuthUser } from "../services/platform-service";
import type { Env } from "../types/platform";
import { DEFAULT_REMOTE_SESSION_TTL_SECONDS } from "../types/platform";
import {
  apiError,
  buildCookie,
  optionalTrimmedString,
  parseBearerToken,
  parseCookieHeader,
  randomOpaqueToken,
  readJson,
  readString,
  sanitizeResponseHeaders,
  verifySessionToken
} from "../utils/platform-utils";

const REMOTE_SESSION_COOKIE = "nextclaw_remote_session";

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function readConnectToken(c: Context<{ Bindings: Env }>): string | null {
  const fromHeader = parseBearerToken(c.req.header("authorization"));
  if (fromHeader) {
    return fromHeader;
  }
  const raw = c.req.query("token");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function buildRemoteOpenUrl(c: Context<{ Bindings: Env }>, token: string): string {
  const url = new URL(c.req.url);
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || c.req.header("host")?.trim() || url.host;
  const protocol = forwardedProto || url.protocol.replace(/:$/, "");
  return `${protocol}://${host}/platform/remote/open?token=${encodeURIComponent(token)}`;
}

function isUpgradeWebSocket(c: Context<{ Bindings: Env }>): boolean {
  return c.req.header("upgrade")?.toLowerCase() === "websocket";
}

async function requireAuthUserFromConnectToken(c: Context<{ Bindings: Env }>) {
  const token = readConnectToken(c);
  if (!token) {
    return {
      ok: false as const,
      response: apiError(c, 401, "UNAUTHORIZED", "Missing bearer token.")
    };
  }
  const secret = c.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    return {
      ok: false as const,
      response: apiError(c, 503, "UNAVAILABLE", "Auth secret is not configured.")
    };
  }
  const payload = await verifySessionToken(token, secret);
  if (!payload) {
    return {
      ok: false as const,
      response: apiError(c, 401, "UNAUTHORIZED", "Invalid or expired token.")
    };
  }
  return requireAuthUser({
    env: c.env,
    req: {
      header: (name: string) => {
        if (name.toLowerCase() === "authorization") {
          return `Bearer ${token}`;
        }
        return c.req.header(name);
      }
    }
  });
}

export async function registerRemoteDeviceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const deviceInstallId = readString(body, "deviceInstallId").trim();
  const displayName = readString(body, "displayName").trim();
  const platform = readString(body, "platform").trim();
  const appVersion = readString(body, "appVersion").trim();
  const localOrigin = readString(body, "localOrigin").trim();
  const nowIso = new Date().toISOString();

  if (!deviceInstallId || !displayName || !platform || !appVersion || !localOrigin) {
    return apiError(c, 400, "INVALID_BODY", "deviceInstallId, displayName, platform, appVersion, and localOrigin are required.");
  }

  const existing = await getRemoteDeviceByInstallId(c.env.NEXTCLAW_PLATFORM_DB, deviceInstallId);
  if (existing && existing.user_id !== auth.user.id) {
    return apiError(c, 409, "DEVICE_OWNED", "This device is already linked to another account.");
  }

  const deviceId = existing?.id ?? crypto.randomUUID();
  await upsertRemoteDevice(c.env.NEXTCLAW_PLATFORM_DB, {
    id: deviceId,
    userId: auth.user.id,
    deviceInstallId,
    displayName,
    platform,
    appVersion,
    localOrigin,
    status: "offline",
    lastSeenAt: nowIso
  });

  const device = await getRemoteDeviceById(c.env.NEXTCLAW_PLATFORM_DB, deviceId);
  if (!device) {
    return apiError(c, 500, "REMOTE_DEVICE_FAILED", "Failed to persist remote device.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: existing ? "remote.device.updated" : "remote.device.created",
    targetType: "remote_device",
    targetId: device.id,
    beforeJson: existing ? JSON.stringify(toRemoteDeviceView(existing)) : null,
    afterJson: JSON.stringify(toRemoteDeviceView(device)),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: {
      device: toRemoteDeviceView(device)
    }
  });
}

export async function listRemoteDevicesHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const now = Date.now();
  const rows = await listRemoteDevicesByUserId(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  const items = rows.map((row) => {
    const lastSeenMs = Date.parse(row.last_seen_at);
    const isFresh = Number.isFinite(lastSeenMs) && now - lastSeenMs <= 30_000;
    return {
      ...toRemoteDeviceView(row),
      status: isFresh ? "online" : "offline"
    };
  });
  return c.json({ ok: true, data: { items } });
}

export async function openRemoteDeviceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const deviceId = c.req.param("deviceId")?.trim() ?? "";
  if (!deviceId) {
    return apiError(c, 400, "INVALID_DEVICE", "deviceId is required.");
  }
  const device = await getRemoteDeviceById(c.env.NEXTCLAW_PLATFORM_DB, deviceId);
  if (!device || device.user_id !== auth.user.id) {
    return apiError(c, 404, "DEVICE_NOT_FOUND", "Remote device not found.");
  }

  const lastSeenMs = Date.parse(device.last_seen_at);
  if (!Number.isFinite(lastSeenMs) || Date.now() - lastSeenMs > 30_000) {
    return apiError(c, 409, "DEVICE_OFFLINE", "Remote device is offline.");
  }

  const sessionId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + DEFAULT_REMOTE_SESSION_TTL_SECONDS * 1000).toISOString();
  await createRemoteSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    token,
    userId: auth.user.id,
    deviceId: device.id,
    expiresAt
  });

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.session.created",
    targetType: "remote_session",
    targetId: sessionId,
    beforeJson: null,
    afterJson: JSON.stringify({ id: sessionId, deviceId: device.id, expiresAt }),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: toRemoteSessionView({
      id: sessionId,
      token,
      user_id: auth.user.id,
      device_id: device.id,
      status: "active",
      expires_at: expiresAt,
      last_used_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso
    }, buildRemoteOpenUrl(c, token))
  });
}

export async function openRemoteSessionRedirectHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const token = optionalTrimmedString(c.req.query("token") ?? "");
  if (!token) {
    return apiError(c, 400, "INVALID_TOKEN", "Missing remote session token.");
  }
  const session = await getRemoteSessionByToken(c.env.NEXTCLAW_PLATFORM_DB, token);
  if (!session || session.status !== "active") {
    return apiError(c, 404, "SESSION_NOT_FOUND", "Remote session not found.");
  }
  if (Date.parse(session.expires_at) <= Date.now()) {
    return apiError(c, 410, "SESSION_EXPIRED", "Remote session expired.");
  }

  const headers = new Headers();
  headers.set("Set-Cookie", buildCookie({
    name: REMOTE_SESSION_COOKIE,
    value: token,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    maxAgeSeconds: DEFAULT_REMOTE_SESSION_TTL_SECONDS
  }));
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
}

export async function remoteConnectorWebSocketHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  if (!isUpgradeWebSocket(c)) {
    return apiError(c, 426, "UPGRADE_REQUIRED", "Expected websocket upgrade.");
  }
  const auth = await requireAuthUserFromConnectToken(c);
  if (!auth.ok) {
    return auth.response;
  }
  const deviceId = c.req.query("deviceId")?.trim() ?? "";
  if (!deviceId) {
    return apiError(c, 400, "INVALID_DEVICE", "deviceId is required.");
  }
  const device = await getRemoteDeviceById(c.env.NEXTCLAW_PLATFORM_DB, deviceId);
  if (!device || device.user_id !== auth.user.id) {
    return apiError(c, 404, "DEVICE_NOT_FOUND", "Remote device not found.");
  }

  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(c.env.NEXTCLAW_REMOTE_RELAY.idFromName(device.id));
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-nextclaw-remote-device-id", device.id);
  headers.set("x-nextclaw-remote-user-id", auth.user.id);
  return stub.fetch(new Request(c.req.raw, { headers }));
}

export async function remoteProxyHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/platform/") || url.pathname.startsWith("/v1/") || url.pathname === "/health") {
    return apiError(c, 404, "NOT_FOUND", "endpoint not found");
  }
  if (isUpgradeWebSocket(c)) {
    return apiError(c, 501, "REMOTE_WS_UNAVAILABLE", "Remote WebSocket proxy is not enabled in this MVP.");
  }
  const cookies = parseCookieHeader(c.req.header("cookie"));
  const token = cookies[REMOTE_SESSION_COOKIE]?.trim();
  if (!token) {
    return new Response("Remote session cookie missing. Open this device from NextClaw Platform first.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  const session = await getRemoteSessionByToken(c.env.NEXTCLAW_PLATFORM_DB, token);
  if (!session || session.status !== "active") {
    return new Response("Remote session not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  if (Date.parse(session.expires_at) <= Date.now()) {
    return new Response("Remote session expired.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
  const device = await getRemoteDeviceById(c.env.NEXTCLAW_PLATFORM_DB, session.device_id);
  if (!device) {
    return new Response("Remote device not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const nowIso = new Date().toISOString();
  await touchRemoteSession(c.env.NEXTCLAW_PLATFORM_DB, session.id, nowIso);
  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(c.env.NEXTCLAW_REMOTE_RELAY.idFromName(device.id));
  const path = `${url.pathname}${url.search}`;
  const rawBody =
    c.req.method === "GET" || c.req.method === "HEAD"
      ? null
      : new Uint8Array(await c.req.raw.arrayBuffer());
  const response = await stub.fetch("https://remote-relay.internal/proxy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nextclaw-remote-device-id": device.id
    },
    body: JSON.stringify({
      method: c.req.method,
      path,
      headers: Array.from(c.req.raw.headers.entries()).filter(([key]) => {
        const lower = key.toLowerCase();
        return ![
          "cookie",
          "host",
          "connection",
          "content-length",
          "cf-connecting-ip",
          "x-forwarded-for",
          "x-forwarded-proto"
        ].includes(lower);
      }),
      bodyBase64: rawBody ? encodeBase64(rawBody) : ""
    })
  });
  return new Response(response.body, {
    status: response.status,
    headers: sanitizeResponseHeaders(response.headers)
  });
}
