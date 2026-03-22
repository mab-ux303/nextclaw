import type { Context } from "hono";
import { appendAuditLog } from "../repositories/platform-repository";
import {
  closeRemoteAccessSessionsByGrantId,
  createRemoteShareGrant,
  getRemoteAccessSessionByToken,
  getRemoteInstanceById,
  getRemoteInstanceByInstallId,
  getRemoteShareGrantById,
  getRemoteShareGrantByToken,
  listRemoteInstancesByUserId,
  listRemoteShareGrantsByInstanceId,
  revokeRemoteShareGrant,
  toRemoteAccessSessionView,
  toRemoteInstanceView,
  toRemoteShareGrantView,
  touchRemoteAccessSession,
  upsertRemoteInstance,
} from "../repositories/remote-repository";
import { ensurePlatformBootstrap, requireAuthUser } from "../services/platform-service";
import {
  buildRemoteAccessUrl,
  buildRemoteShareUrl,
  createOwnerOpenSession,
  createShareOpenSession,
  DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS,
  encodeBase64,
  isExpiredAt,
  isUpgradeWebSocket,
  readRequestOrigin,
  REMOTE_SESSION_COOKIE,
  REMOTE_SESSION_TOUCH_THROTTLE_MS,
  requireAuthUserFromConnectToken,
  resolveRemoteAccessSession,
  validateRemoteAccessSession,
} from "../services/remote-access-service";
import type { Env } from "../types/platform";
import { DEFAULT_REMOTE_SESSION_TTL_SECONDS } from "../types/platform";
import {
  apiError,
  buildCookie,
  optionalTrimmedString,
  randomOpaqueToken,
  readJson,
  readNumber,
  readString,
  sanitizeResponseHeaders,
} from "../utils/platform-utils";

export async function registerRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(c);
  const instanceInstallId =
    readString(body, "instanceInstallId").trim()
    || readString(body, "deviceInstallId").trim();
  const displayName = readString(body, "displayName").trim();
  const platform = readString(body, "platform").trim();
  const appVersion = readString(body, "appVersion").trim();
  const localOrigin = readString(body, "localOrigin").trim();
  const nowIso = new Date().toISOString();

  if (!instanceInstallId || !displayName || !platform || !appVersion || !localOrigin) {
    return apiError(c, 400, "INVALID_BODY", "instanceInstallId, displayName, platform, appVersion, and localOrigin are required.");
  }

  const existing = await getRemoteInstanceByInstallId(c.env.NEXTCLAW_PLATFORM_DB, instanceInstallId);
  if (existing && existing.user_id !== auth.user.id) {
    return apiError(c, 409, "INSTANCE_OWNED", "This instance is already linked to another account.");
  }

  const instanceId = existing?.id ?? crypto.randomUUID();
  await upsertRemoteInstance(c.env.NEXTCLAW_PLATFORM_DB, {
    id: instanceId,
    userId: auth.user.id,
    instanceInstallId,
    displayName,
    platform,
    appVersion,
    localOrigin,
    status: "offline",
    lastSeenAt: nowIso
  });

  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance) {
    return apiError(c, 500, "REMOTE_INSTANCE_FAILED", "Failed to persist remote instance.");
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: existing ? "remote.instance.updated" : "remote.instance.created",
    targetType: "remote_instance",
    targetId: instance.id,
    beforeJson: existing ? JSON.stringify(toRemoteInstanceView(existing)) : null,
    afterJson: JSON.stringify(toRemoteInstanceView(instance)),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: {
      instance: toRemoteInstanceView(instance)
    }
  });
}

export async function listRemoteInstancesHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const rows = await listRemoteInstancesByUserId(c.env.NEXTCLAW_PLATFORM_DB, auth.user.id);
  return c.json({ ok: true, data: { items: rows.map((row) => toRemoteInstanceView(row)) } });
}

export async function openRemoteInstanceHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() || c.req.param("deviceId")?.trim() || "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }
  if (instance.status !== "online") {
    return apiError(c, 409, "INSTANCE_OFFLINE", "Remote instance is offline.");
  }

  const session = await createOwnerOpenSession({
    c,
    ownerUserId: auth.user.id,
    instanceId: instance.id
  });
  const openUrl = buildRemoteAccessUrl(c, session.id, session.token);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.access_session.created",
    targetType: "remote_access_session",
    targetId: session.id,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: session.id,
      instanceId: instance.id,
      sourceType: session.source_type,
      expiresAt: session.expires_at
    }),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: toRemoteAccessSessionView(session, openUrl)
  });
}

export async function listRemoteShareGrantsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }

  const rows = await listRemoteShareGrantsByInstanceId(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  return c.json({
    ok: true,
    data: {
      items: rows.map((row) => toRemoteShareGrantView(row, buildRemoteShareUrl(c, row.token)))
    }
  });
}

export async function createRemoteShareGrantHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }

  const body = await readJson(c);
  const requestedTtlSeconds = readNumber(body, "ttlSeconds");
  const ttlSeconds =
    Number.isFinite(requestedTtlSeconds) && requestedTtlSeconds > 0
      ? Math.min(Math.trunc(requestedTtlSeconds), DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS)
      : DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS;
  const grantId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();

  await createRemoteShareGrant(c.env.NEXTCLAW_PLATFORM_DB, {
    id: grantId,
    token,
    ownerUserId: auth.user.id,
    instanceId: instance.id,
    expiresAt
  });

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.share_grant.created",
    targetType: "remote_share_grant",
    targetId: grantId,
    beforeJson: null,
    afterJson: JSON.stringify({ id: grantId, instanceId: instance.id, expiresAt }),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: toRemoteShareGrantView({
      id: grantId,
      token,
      owner_user_id: auth.user.id,
      instance_id: instance.id,
      status: "active",
      expires_at: expiresAt,
      revoked_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      active_session_count: 0
    }, buildRemoteShareUrl(c, token))
  });
}

export async function revokeRemoteShareGrantHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const grantId = c.req.param("grantId")?.trim() ?? "";
  if (!grantId) {
    return apiError(c, 400, "INVALID_GRANT", "grantId is required.");
  }
  const grant = await getRemoteShareGrantById(c.env.NEXTCLAW_PLATFORM_DB, grantId);
  if (!grant) {
    return apiError(c, 404, "GRANT_NOT_FOUND", "Remote share grant not found.");
  }
  if (grant.owner_user_id !== auth.user.id) {
    return apiError(c, 404, "GRANT_NOT_FOUND", "Remote share grant not found.");
  }

  const revokedAt = new Date().toISOString();
  await revokeRemoteShareGrant(c.env.NEXTCLAW_PLATFORM_DB, grant.id, revokedAt);
  await closeRemoteAccessSessionsByGrantId(c.env.NEXTCLAW_PLATFORM_DB, grant.id, revokedAt);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.share_grant.revoked",
    targetType: "remote_share_grant",
    targetId: grant.id,
    beforeJson: JSON.stringify(toRemoteShareGrantView(grant, buildRemoteShareUrl(c, grant.token))),
    afterJson: JSON.stringify({
      ...toRemoteShareGrantView(grant, buildRemoteShareUrl(c, grant.token)),
      status: "revoked",
      revokedAt,
      activeSessionCount: 0
    }),
    metadataJson: null
  });

  return c.json({
    ok: true,
    data: {
      revoked: true,
      grantId: grant.id,
      revokedAt
    }
  });
}

export async function openRemoteShareHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const grantToken = optionalTrimmedString(c.req.param("grantToken") ?? "");
  if (!grantToken) {
    return new Response("Missing share token.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const grant = await getRemoteShareGrantByToken(c.env.NEXTCLAW_PLATFORM_DB, grantToken);
  if (!grant || grant.status !== "active" || grant.revoked_at || isExpiredAt(grant.expires_at)) {
    return new Response("Remote share link is no longer available.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, grant.instance_id);
  if (!instance || instance.status !== "online") {
    return new Response("Remote instance is offline.", {
      status: 409,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const session = await createShareOpenSession({ c, grant });
  const openUrl = buildRemoteAccessUrl(c, session.id, session.token);

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: grant.owner_user_id,
    action: "remote.access_session.created_from_share",
    targetType: "remote_access_session",
    targetId: session.id,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: session.id,
      instanceId: session.instance_id,
      sourceType: session.source_type,
      sourceGrantId: session.source_grant_id,
      expiresAt: session.expires_at
    }),
    metadataJson: JSON.stringify({ shareGrantId: grant.id })
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: openUrl
    }
  });
}

export async function openRemoteSessionRedirectHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const token = optionalTrimmedString(c.req.query("token") ?? "");
  if (!token) {
    return apiError(c, 400, "INVALID_TOKEN", "Missing remote session token.");
  }
  const session = await getRemoteAccessSessionByToken(c.env.NEXTCLAW_PLATFORM_DB, token);
  const validated = await validateRemoteAccessSession(c, session);
  if (!validated.ok) {
    return validated.response;
  }

  const headers = new Headers();
  headers.set("Set-Cookie", buildCookie({
    name: REMOTE_SESSION_COOKIE,
    value: token,
    path: "/",
    secure: readRequestOrigin(c).protocol === "https",
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
  const instanceId = c.req.query("instanceId")?.trim() || c.req.query("deviceId")?.trim() || "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, instanceId);
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }

  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(c.env.NEXTCLAW_REMOTE_RELAY.idFromName(instance.id));
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-nextclaw-remote-device-id", instance.id);
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

  const resolved = await validateRemoteAccessSession(c, await resolveRemoteAccessSession(c));
  if (!resolved.ok) {
    return resolved.response;
  }
  const session = resolved.session;

  const instance = await getRemoteInstanceById(c.env.NEXTCLAW_PLATFORM_DB, session.instance_id);
  if (!instance) {
    return new Response("Remote instance not found.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }

  const now = Date.now();
  const lastUsedMs = Date.parse(session.last_used_at);
  if (!Number.isFinite(lastUsedMs) || now - lastUsedMs >= REMOTE_SESSION_TOUCH_THROTTLE_MS) {
    await touchRemoteAccessSession(c.env.NEXTCLAW_PLATFORM_DB, session.id, new Date(now).toISOString());
  }

  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(c.env.NEXTCLAW_REMOTE_RELAY.idFromName(instance.id));
  const path = `${url.pathname}${url.search}`;
  const rawBody =
    c.req.method === "GET" || c.req.method === "HEAD"
      ? null
      : new Uint8Array(await c.req.raw.arrayBuffer());
  const response = await stub.fetch("https://remote-relay.internal/proxy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nextclaw-remote-device-id": instance.id
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

export const registerRemoteDeviceHandler = registerRemoteInstanceHandler;
export const listRemoteDevicesHandler = listRemoteInstancesHandler;
export const openRemoteDeviceHandler = openRemoteInstanceHandler;
