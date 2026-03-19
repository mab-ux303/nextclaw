import { getConfigPath, getDataDir, loadConfig, type Config } from "@nextclaw/core";
import { ensureUiBridgeSecret } from "@nextclaw/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostname, platform as readPlatform } from "node:os";
import type { RemoteConnectCommandOptions } from "../types.js";
import { getPackageVersion, isProcessRunning, readServiceState } from "../utils.js";

type RegisteredRemoteDevice = {
  id: string;
  deviceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  status: "online" | "offline";
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

type RelayRequestFrame = {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers: Array<[string, string]>;
  bodyBase64?: string;
};

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function decodeBase64(base64: string | undefined): Uint8Array {
  if (!base64) {
    return new Uint8Array();
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export class RemoteCommands {
  private readonly remoteDir = join(getDataDir(), "remote");
  private readonly devicePath = join(this.remoteDir, "device.json");

  private ensureDeviceInstallId(): string {
    const existing = readJsonFile<{ deviceInstallId?: string }>(this.devicePath);
    if (existing?.deviceInstallId?.trim()) {
      return existing.deviceInstallId.trim();
    }
    const deviceInstallId = crypto.randomUUID();
    ensureDir(this.remoteDir);
    writeJsonFile(this.devicePath, { deviceInstallId });
    return deviceInstallId;
  }

  private resolvePlatformAccess(opts: RemoteConnectCommandOptions): {
    platformBase: string;
    token: string;
    config: Config;
  } {
    const config = loadConfig(getConfigPath());
    const providers = config.providers as Record<string, { apiBase?: string | null; apiKey?: string }>;
    const nextclawProvider = providers.nextclaw;
    const token = typeof nextclawProvider?.apiKey === "string" ? nextclawProvider.apiKey.trim() : "";
    if (!token) {
      throw new Error('NextClaw platform token is missing. Run "nextclaw login" first.');
    }
    const configuredApiBase = typeof nextclawProvider?.apiBase === "string" ? nextclawProvider.apiBase.trim() : "";
    const rawApiBase = typeof opts.apiBase === "string" && opts.apiBase.trim().length > 0
      ? opts.apiBase.trim()
      : configuredApiBase;
    if (!rawApiBase) {
      throw new Error("Platform API base is missing. Pass --api-base or run nextclaw login.");
    }
    const platformBase = rawApiBase.replace(/\/v1\/?$/i, "");
    return { platformBase, token, config };
  }

  private resolveLocalOrigin(config: Config, opts: RemoteConnectCommandOptions): string {
    if (typeof opts.localOrigin === "string" && opts.localOrigin.trim().length > 0) {
      return opts.localOrigin.trim().replace(/\/$/, "");
    }
    const state = readServiceState();
    if (state && isProcessRunning(state.pid) && Number.isFinite(state.uiPort)) {
      return `http://127.0.0.1:${state.uiPort}`;
    }
    const configuredPort = typeof config.ui?.port === "number" && Number.isFinite(config.ui.port)
      ? config.ui.port
      : 18791;
    return `http://127.0.0.1:${configuredPort}`;
  }

  private async ensureLocalUiHealthy(localOrigin: string): Promise<void> {
    const response = await fetch(`${localOrigin}/api/health`);
    if (!response.ok) {
      throw new Error(`Local UI is not healthy at ${localOrigin}. Start NextClaw first.`);
    }
  }

  private async registerDevice(params: {
    platformBase: string;
    token: string;
    deviceInstallId: string;
    displayName: string;
    localOrigin: string;
  }): Promise<RegisteredRemoteDevice> {
    const response = await fetch(`${params.platformBase}/platform/remote/devices/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${params.token}`
      },
      body: JSON.stringify({
        deviceInstallId: params.deviceInstallId,
        displayName: params.displayName,
        platform: readPlatform(),
        appVersion: getPackageVersion(),
        localOrigin: params.localOrigin
      })
    });
    const payload = await response.json() as { ok?: boolean; data?: { device?: RegisteredRemoteDevice }; error?: { message?: string } };
    if (!response.ok || !payload.ok || !payload.data?.device) {
      throw new Error(payload.error?.message ?? `Failed to register remote device (${response.status}).`);
    }
    return payload.data.device;
  }

  private async requestBridgeCookie(localOrigin: string): Promise<string | null> {
    const response = await fetch(`${localOrigin}/api/auth/bridge`, {
      method: "POST",
      headers: {
        "x-nextclaw-ui-bridge-secret": ensureUiBridgeSecret()
      }
    });
    const payload = await response.json() as { ok?: boolean; data?: { cookie?: string | null }; error?: { message?: string } };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error?.message ?? `Failed to request local auth bridge (${response.status}).`);
    }
    return typeof payload.data?.cookie === "string" && payload.data.cookie.trim().length > 0
      ? payload.data.cookie.trim()
      : null;
  }

  private async handleRelayRequest(params: {
    frame: RelayRequestFrame;
    localOrigin: string;
    socket: WebSocket;
  }): Promise<void> {
    const bridgeCookie = await this.requestBridgeCookie(params.localOrigin);
    const url = new URL(params.frame.path, params.localOrigin);
    const headers = new Headers();
    for (const [key, value] of params.frame.headers) {
      const lower = key.toLowerCase();
      if ([
        "host",
        "connection",
        "content-length",
        "cookie",
        "x-forwarded-for",
        "x-forwarded-proto",
        "cf-connecting-ip"
      ].includes(lower)) {
        continue;
      }
      headers.set(key, value);
    }
    if (bridgeCookie) {
      headers.set("cookie", bridgeCookie);
    }

    const bodyBytes = decodeBase64(params.frame.bodyBase64);
    const response = await fetch(url, {
      method: params.frame.method,
      headers,
      body: params.frame.method === "GET" || params.frame.method === "HEAD" ? undefined : bodyBytes
    });
    const responseHeaders = Array.from(response.headers.entries()).filter(([key]) => {
      const lower = key.toLowerCase();
      return !["content-length", "connection", "transfer-encoding", "set-cookie"].includes(lower);
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (response.body && contentType.startsWith("text/event-stream")) {
      params.socket.send(JSON.stringify({
        type: "response.start",
        requestId: params.frame.requestId,
        status: response.status,
        headers: responseHeaders
      }));
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value && value.length > 0) {
            params.socket.send(JSON.stringify({
              type: "response.chunk",
              requestId: params.frame.requestId,
              bodyBase64: encodeBase64(value)
            }));
          }
        }
      } finally {
        reader.releaseLock();
      }
      params.socket.send(JSON.stringify({
        type: "response.end",
        requestId: params.frame.requestId
      }));
      return;
    }

    const responseBody = response.body ? new Uint8Array(await response.arrayBuffer()) : new Uint8Array();
    params.socket.send(JSON.stringify({
      type: "response",
      requestId: params.frame.requestId,
      status: response.status,
      headers: responseHeaders,
      bodyBase64: encodeBase64(responseBody)
    }));
  }

  private async connectOnce(params: {
    wsUrl: string;
    localOrigin: string;
  }): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(params.wsUrl);
      const pingTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping", at: new Date().toISOString() }));
        }
      }, 15_000);

      socket.addEventListener("open", () => {
        console.log(`✓ Remote connector connected: ${params.wsUrl}`);
      });

      socket.addEventListener("message", (event) => {
        void (async () => {
          let frame: RelayRequestFrame | null = null;
          try {
            frame = JSON.parse(String(event.data ?? "")) as RelayRequestFrame;
          } catch {
            return;
          }
          if (!frame || frame.type !== "request") {
            return;
          }
          try {
            await this.handleRelayRequest({ frame, localOrigin: params.localOrigin, socket });
          } catch (error) {
            socket.send(JSON.stringify({
              type: "response.error",
              requestId: frame.requestId,
              message: error instanceof Error ? error.message : String(error)
            }));
          }
        })();
      });

      socket.addEventListener("close", () => {
        clearInterval(pingTimer);
        resolve();
      });

      socket.addEventListener("error", () => {
        clearInterval(pingTimer);
        reject(new Error("Remote connector websocket failed."));
      });
    });
  }

  async connect(opts: RemoteConnectCommandOptions = {}): Promise<void> {
    const { platformBase, token, config } = this.resolvePlatformAccess(opts);
    const localOrigin = this.resolveLocalOrigin(config, opts);
    await this.ensureLocalUiHealthy(localOrigin);
    const deviceInstallId = this.ensureDeviceInstallId();
    const displayName = typeof opts.name === "string" && opts.name.trim().length > 0
      ? opts.name.trim()
      : hostname();
    const device = await this.registerDevice({
      platformBase,
      token,
      deviceInstallId,
      displayName,
      localOrigin
    });

    console.log(`✓ Remote device registered: ${device.displayName} (${device.id})`);
    console.log(`✓ Local origin: ${localOrigin}`);
    console.log(`✓ Platform: ${platformBase}`);

    const wsUrl = `${platformBase.replace(/^http/i, "ws")}/platform/remote/connect?deviceId=${encodeURIComponent(device.id)}&token=${encodeURIComponent(token)}`;
    do {
      try {
        await this.connectOnce({ wsUrl, localOrigin });
      } catch (error) {
        console.error(`Remote connector error: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (opts.once) {
        break;
      }
      console.log("Remote connector disconnected. Reconnecting in 3s...");
      await delay(3_000);
    } while (!opts.once);
  }
}
