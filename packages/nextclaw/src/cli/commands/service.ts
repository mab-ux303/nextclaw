import * as NextclawCore from "@nextclaw/core";
import {
  getPluginChannelBindings,
  resolvePluginChannelMessageToolHints,
  setPluginRuntimeBridge,
  startPluginChannelGateways,
  stopPluginChannelGateways
} from "@nextclaw/openclaw-compat";
import { startUiServer, type UiServerEvent } from "@nextclaw/server";
import { appendFileSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import { GatewayControllerImpl } from "../gateway/controller.js";
import { ConfigReloader } from "../config-reloader.js";
import { MissingProvider } from "../missing-provider.js";
import {
  buildServeArgs,
  clearServiceState,
  getPackageVersion,
  isLoopbackHost,
  isProcessRunning,
  openBrowser,
  readServiceState,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  resolvePublicIp,
  waitForExit,
  writeServiceState,
  findExecutableOnPath,
  type ServiceState
} from "../utils.js";
import {
  loadPluginRegistry,
  logPluginDiagnostics,
  mergePluginConfigView,
  toExtensionRegistry,
  toPluginConfigView
} from "./plugins.js";
import type { RequestRestartParams } from "../types.js";
import {
  consumeRestartSentinel,
  formatRestartSentinelMessage,
  parseSessionKey
} from "../restart-sentinel.js";
import { GatewayAgentRuntimePool } from "./agent-runtime-pool.js";
import { UiChatRunCoordinator } from "./ui-chat-run-coordinator.js";

const {
  APP_NAME,
  ChannelManager,
  CronService,
  getApiBase,
  getConfigPath,
  getDataDir,
  getProvider,
  getProviderName,
  getWorkspacePath,
  HeartbeatService,
  LiteLLMProvider,
  loadConfig,
  MessageBus,
  ProviderManager,
  resolveConfigSecrets,
  saveConfig,
  SessionManager,
  parseAgentScopedSessionKey
} = NextclawCore;

type Config = NextclawCore.Config;
type LLMProvider = NextclawCore.LLMProvider;
type MessageBus = NextclawCore.MessageBus;
type SessionManager = NextclawCore.SessionManager;
type LiteLLMProvider = NextclawCore.LiteLLMProvider;
type SkillInfo = {
  name: string;
  path: string;
  source: "workspace" | "builtin";
};
type SkillsLoaderInstance = {
  listSkills: (filterUnavailable?: boolean) => SkillInfo[];
};
type SkillsLoaderConstructor = new (workspace: string, builtinSkillsDir?: string) => SkillsLoaderInstance;

function createSkillsLoader(workspace: string): SkillsLoaderInstance | null {
  const ctor = (NextclawCore as { SkillsLoader?: SkillsLoaderConstructor }).SkillsLoader;
  if (!ctor) {
    return null;
  }
  return new ctor(workspace);
}

export class ServiceCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  async startGateway(
    options: { uiOverrides?: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null } = {}
  ): Promise<void> {
    const runtimeConfigPath = getConfigPath();
    const config = resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath });
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    let pluginRegistry = loadPluginRegistry(config, workspace);
    let extensionRegistry = toExtensionRegistry(pluginRegistry);
    logPluginDiagnostics(pluginRegistry);

    const bus = new MessageBus();
    const provider =
      options.allowMissingProvider === true ? this.makeProvider(config, { allowMissing: true }) : this.makeProvider(config);
    const providerManager = new ProviderManager({
      defaultProvider: provider ?? this.makeMissingProvider(config),
      config
    });
    const sessionManager = new SessionManager(workspace);

    let pluginGatewayHandles: Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"] = [];
    const pluginGatewayLogger = {
      info: (message: string) => console.log(`[plugins] ${message}`),
      warn: (message: string) => console.warn(`[plugins] ${message}`),
      error: (message: string) => console.error(`[plugins] ${message}`),
      debug: (message: string) => console.debug(`[plugins] ${message}`)
    };
    const logPluginGatewayDiagnostics = (
      diagnostics: Awaited<ReturnType<typeof startPluginChannelGateways>>["diagnostics"]
    ): void => {
      for (const diag of diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        const text = `${prefix}${diag.message}`;
        if (diag.level === "error") {
          console.error(`[plugins] ${text}`);
        } else {
          console.warn(`[plugins] ${text}`);
        }
      }
    };

    const cronStorePath = join(getDataDir(), "cron", "jobs.json");
    const cron = new CronService(cronStorePath);

    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiStaticDir = options.uiStaticDir === undefined ? resolveUiStaticDir() : options.uiStaticDir;
    if (!provider) {
      console.warn("Warning: No API key configured. The gateway is running, but agent replies are disabled until provider config is set.");
    }

    const channels = new ChannelManager(config, bus, sessionManager, extensionRegistry.channels);
    const reloader = new ConfigReloader({
      initialConfig: config,
      channels,
      bus,
      sessionManager,
      providerManager,
      makeProvider: (nextConfig) => this.makeProvider(nextConfig, { allowMissing: true }) ?? this.makeMissingProvider(nextConfig),
      loadConfig: () => resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }),
      getExtensionChannels: () => extensionRegistry.channels,
      onRestartRequired: (paths) => {
        void this.deps.requestRestart({
          reason: `config reload requires restart: ${paths.join(", ")}`,
          manualMessage: `Config changes require restart: ${paths.join(", ")}`,
          strategy: "background-service-or-manual"
        });
      }
    });
    const gatewayController = new GatewayControllerImpl({
      reloader,
      cron,
      sessionManager,
      getConfigPath,
      saveConfig,
      requestRestart: async (options) => {
        await this.deps.requestRestart({
          reason: options?.reason ?? "gateway tool restart",
          manualMessage: "Restart the gateway to apply changes.",
          strategy: "background-service-or-exit",
          delayMs: options?.delayMs,
          silentOnServiceRestart: true
        });
      }
    });

    const runtimePool = new GatewayAgentRuntimePool({
      bus,
      providerManager,
      sessionManager,
      config,
      cronService: cron,
      restrictToWorkspace: config.tools.restrictToWorkspace,
      braveApiKey: config.tools.web.search.apiKey || undefined,
      execConfig: config.tools.exec,
      contextConfig: config.agents.context,
      gatewayController,
      extensionRegistry,
      resolveMessageToolHints: ({ channel, accountId }) =>
        resolvePluginChannelMessageToolHints({
          registry: pluginRegistry,
          channel,
          cfg: resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }),
          accountId
        })
    });

    reloader.setApplyAgentRuntimeConfig((nextConfig) => runtimePool.applyRuntimeConfig(nextConfig));
    reloader.setReloadPlugins(async (nextConfig) => {
      const nextWorkspace = getWorkspacePath(nextConfig.agents.defaults.workspace);
      const nextPluginRegistry = loadPluginRegistry(nextConfig, nextWorkspace);
      const nextExtensionRegistry = toExtensionRegistry(nextPluginRegistry);
      logPluginDiagnostics(nextPluginRegistry);

      await stopPluginChannelGateways(pluginGatewayHandles);
      const startedPluginGateways = await startPluginChannelGateways({
        registry: nextPluginRegistry,
        logger: pluginGatewayLogger
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);

      pluginRegistry = nextPluginRegistry;
      extensionRegistry = nextExtensionRegistry;
      pluginChannelBindings = getPluginChannelBindings(nextPluginRegistry);
      runtimePool.applyExtensionRegistry(nextExtensionRegistry);
      runtimePool.applyRuntimeConfig(nextConfig);
      console.log("Config reload: plugin channel gateways restarted.");
    });

    let pluginChannelBindings = getPluginChannelBindings(pluginRegistry);
    setPluginRuntimeBridge({
      loadConfig: () =>
        toPluginConfigView(resolveConfigSecrets(loadConfig(), { configPath: runtimeConfigPath }), pluginChannelBindings),
      writeConfigFile: async (nextConfigView) => {
        if (!nextConfigView || typeof nextConfigView !== "object" || Array.isArray(nextConfigView)) {
          throw new Error("plugin runtime writeConfigFile expects an object config");
        }
        const current = loadConfig();
        const next = mergePluginConfigView(current, nextConfigView, pluginChannelBindings);
        saveConfig(next);
      },
      dispatchReplyWithBufferedBlockDispatcher: async ({ ctx, dispatcherOptions }) => {
        const bodyForAgent = typeof ctx.BodyForAgent === "string" ? ctx.BodyForAgent : "";
        const body = typeof ctx.Body === "string" ? ctx.Body : "";
        const content = (bodyForAgent || body).trim();
        if (!content) {
          return;
        }

        const sessionKey =
          typeof ctx.SessionKey === "string" && ctx.SessionKey.trim().length > 0 ? ctx.SessionKey : undefined;
        const channel =
          typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel.trim().length > 0
            ? ctx.OriginatingChannel
            : "cli";
        const chatId =
          typeof ctx.OriginatingTo === "string" && ctx.OriginatingTo.trim().length > 0
            ? ctx.OriginatingTo
            : typeof ctx.SenderId === "string" && ctx.SenderId.trim().length > 0
              ? ctx.SenderId
              : "direct";
        const modelOverride =
          typeof (ctx as { Model?: unknown }).Model === "string" && (ctx as { Model?: string }).Model?.trim().length
            ? (ctx as { Model: string }).Model.trim()
            : typeof (ctx as { AgentModel?: unknown }).AgentModel === "string" &&
                (ctx as { AgentModel?: string }).AgentModel?.trim().length
              ? (ctx as { AgentModel: string }).AgentModel.trim()
              : undefined;

        try {
          const response = await runtimePool.processDirect({
            content,
            sessionKey,
            channel,
            chatId,
            agentId:
              typeof (ctx as { AgentId?: unknown }).AgentId === "string"
                ? (ctx as { AgentId: string }).AgentId
                : undefined,
            metadata: {
              ...(typeof ctx.AccountId === "string" && ctx.AccountId.trim().length > 0
                ? { account_id: ctx.AccountId }
                : {}),
              ...(modelOverride ? { model: modelOverride } : {})
            }
          });
          const replyText = typeof response === "string" ? response : String(response ?? "");
          if (replyText.trim()) {
            await dispatcherOptions.deliver({ text: replyText }, { kind: "final" });
          }
        } catch (error) {
          dispatcherOptions.onError?.(error);
          throw error;
        }
      }
    });

    cron.onJob = async (job) => {
      const response = await runtimePool.processDirect({
        content: job.payload.message,
        sessionKey: `cron:${job.id}`,
        channel: job.payload.channel ?? "cli",
        chatId: job.payload.to ?? "direct",
        agentId: runtimePool.primaryAgentId
      });
      if (job.payload.deliver && job.payload.to) {
        await bus.publishOutbound({
          channel: job.payload.channel ?? "cli",
          chatId: job.payload.to,
          content: response,
          media: [],
          metadata: {}
        });
      }
      return response;
    };

    const heartbeat = new HeartbeatService(
      workspace,
      async (promptText) =>
        runtimePool.processDirect({ content: promptText, sessionKey: "heartbeat", agentId: runtimePool.primaryAgentId }),
      30 * 60,
      true
    );
    if (reloader.getChannels().enabledChannels.length) {
      console.log(`✓ Channels enabled: ${reloader.getChannels().enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }

    this.startUiIfEnabled(uiConfig, uiStaticDir, cron, runtimePool, sessionManager);

    const cronStatus = cron.status();
    if (cronStatus.jobs > 0) {
      console.log(`✓ Cron: ${cronStatus.jobs} scheduled jobs`);
    }
    console.log("✓ Heartbeat: every 30m");

    const configPath = resolve(getConfigPath());
    const watcher = chokidar.watch(configPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    });
    watcher.on("all", (event, changedPath) => {
      if (resolve(changedPath) !== configPath) {
        return;
      }
      if (event === "add") {
        reloader.scheduleReload("config add");
        return;
      }
      if (event === "change") {
        reloader.scheduleReload("config change");
        return;
      }
      if (event === "unlink") {
        reloader.scheduleReload("config unlink");
      }
    });

    await cron.start();
    await heartbeat.start();

    try {
      const startedPluginGateways = await startPluginChannelGateways({
        registry: pluginRegistry,
        logger: pluginGatewayLogger
      });
      pluginGatewayHandles = startedPluginGateways.handles;
      logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);

      await reloader.getChannels().startAll();
      await this.wakeFromRestartSentinel({ bus, sessionManager });
      await runtimePool.run();
    } finally {
      await stopPluginChannelGateways(pluginGatewayHandles);
      setPluginRuntimeBridge(null);
    }
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private resolveMostRecentRoutableSessionKey(sessionManager: SessionManager): string | undefined {
    const sessions = sessionManager.listSessions();
    let best: { key: string; updatedAt: number } | null = null;

    for (const session of sessions) {
      const key = this.normalizeOptionalString((session as Record<string, unknown>).key);
      if (!key || key.startsWith("cli:")) {
        continue;
      }

      const metadataRaw = (session as Record<string, unknown>).metadata;
      const metadata =
        metadataRaw && typeof metadataRaw === "object" && !Array.isArray(metadataRaw)
          ? (metadataRaw as Record<string, unknown>)
          : {};
      const contextRaw = metadata.last_delivery_context;
      const context =
        contextRaw && typeof contextRaw === "object" && !Array.isArray(contextRaw)
          ? (contextRaw as Record<string, unknown>)
          : {};
      const hasRoute =
        Boolean(this.normalizeOptionalString(context.channel)) && Boolean(this.normalizeOptionalString(context.chatId));
      const hasFallbackRoute =
        Boolean(this.normalizeOptionalString(metadata.last_channel)) && Boolean(this.normalizeOptionalString(metadata.last_to));
      if (!hasRoute && !hasFallbackRoute) {
        continue;
      }

      const updatedAtRaw = this.normalizeOptionalString((session as Record<string, unknown>).updated_at);
      const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : Number.NaN;
      const score = Number.isFinite(updatedAt) ? updatedAt : 0;
      if (!best || score >= best.updatedAt) {
        best = { key, updatedAt: score };
      }
    }

    return best?.key;
  }

  private buildRestartWakePrompt(params: {
    summary: string;
    reason?: string;
    note?: string;
    replyTo?: string;
  }): string {
    const lines = [
      "System event: the gateway has restarted successfully.",
      "Please send one short confirmation to the user that you are back online.",
      "Do not call any tools.",
      "Use the same language as the user's recent conversation.",
      `Reference summary: ${params.summary}`
    ];

    const reason = this.normalizeOptionalString(params.reason);
    if (reason) {
      lines.push(`Restart reason: ${reason}`);
    }

    const note = this.normalizeOptionalString(params.note);
    if (note) {
      lines.push(`Extra note: ${note}`);
    }

    const replyTo = this.normalizeOptionalString(params.replyTo);
    if (replyTo) {
      lines.push(`Reply target message id: ${replyTo}. If suitable, include [[reply_to:${replyTo}]].`);
    }

    return lines.join("\n");
  }

  private async wakeFromRestartSentinel(params: {
    bus: MessageBus;
    sessionManager: SessionManager;
  }): Promise<void> {
    const sentinel = await consumeRestartSentinel();
    if (!sentinel) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));

    const payload = sentinel.payload;
    const summary = formatRestartSentinelMessage(payload);
    const sentinelSessionKey = this.normalizeOptionalString(payload.sessionKey);
    const fallbackSessionKey = sentinelSessionKey ? undefined : this.resolveMostRecentRoutableSessionKey(params.sessionManager);
    if (!sentinelSessionKey && fallbackSessionKey) {
      console.warn(`Warning: restart sentinel missing sessionKey; fallback to ${fallbackSessionKey}.`);
    }
    const sessionKey = sentinelSessionKey ?? fallbackSessionKey ?? "cli:default";
    const parsedSession = parseSessionKey(sessionKey);
    const parsedAgentSession = parseAgentScopedSessionKey(sessionKey);
    const parsedSessionRoute = parsedSession && parsedSession.channel !== "agent" ? parsedSession : null;

    const context = payload.deliveryContext;
    const channel =
      this.normalizeOptionalString(context?.channel) ??
      parsedSessionRoute?.channel ??
      this.normalizeOptionalString((params.sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_channel);
    const chatId =
      this.normalizeOptionalString(context?.chatId) ??
      parsedSessionRoute?.chatId ??
      this.normalizeOptionalString((params.sessionManager.getIfExists(sessionKey)?.metadata ?? {}).last_to);
    const replyTo = this.normalizeOptionalString(context?.replyTo);
    const accountId = this.normalizeOptionalString(context?.accountId);

    if (!channel || !chatId) {
      console.warn(`Warning: restart sentinel cannot resolve route for session ${sessionKey}.`);
      return;
    }

    const prompt = this.buildRestartWakePrompt({
      summary,
      reason: this.normalizeOptionalString(payload.stats?.reason),
      note: this.normalizeOptionalString(payload.message),
      ...(replyTo ? { replyTo } : {})
    });

    const metadata: Record<string, unknown> = {
      source: "restart-sentinel",
      restart_summary: summary,
      session_key_override: sessionKey,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(parsedAgentSession ? { target_agent_id: parsedAgentSession.agentId } : {}),
      ...(accountId ? { account_id: accountId, accountId } : {})
    };

    await params.bus.publishInbound({
      channel: "system",
      senderId: "restart-sentinel",
      chatId: `${channel}:${chatId}`,
      content: prompt,
      timestamp: new Date(),
      attachments: [],
      metadata
    });
  }

  async runForeground(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);

    if (options.open) {
      openBrowser(uiUrl);
    }

    await this.startGateway({
      uiOverrides: options.uiOverrides,
      allowMissingProvider: true,
      uiStaticDir: resolveUiStaticDir()
    });
  }

  async startService(options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
    startupTimeoutMs?: number;
  }): Promise<void> {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const apiUrl = `${uiUrl}/api`;
    const staticDir = resolveUiStaticDir();

    const existing = readServiceState();
    if (existing && isProcessRunning(existing.pid)) {
      console.log(`✓ ${APP_NAME} is already running (PID ${existing.pid})`);
      console.log(`UI: ${existing.uiUrl}`);
      console.log(`API: ${existing.apiUrl}`);

      const parsedUi = (() => {
        try {
          const parsed = new URL(existing.uiUrl);
          const port = Number(parsed.port || 80);
          return {
            host: existing.uiHost ?? parsed.hostname,
            port: Number.isFinite(port) ? port : existing.uiPort ?? 18791
          };
        } catch {
          return {
            host: existing.uiHost ?? "127.0.0.1",
            port: existing.uiPort ?? 18791
          };
        }
      })();

      if (parsedUi.host !== uiConfig.host || parsedUi.port !== uiConfig.port) {
        console.log(
          `Detected running service UI bind (${parsedUi.host}:${parsedUi.port}); enforcing (${uiConfig.host}:${uiConfig.port})...`
        );
        await this.stopService();

        const stateAfterStop = readServiceState();
        if (stateAfterStop && isProcessRunning(stateAfterStop.pid)) {
          console.error("Error: Failed to stop running service while enforcing public UI exposure.");
          return;
        }

        return this.startService(options);
      }

      await this.printPublicUiUrls(parsedUi.host, parsedUi.port);
      console.log(`Logs: ${existing.logPath}`);
      this.printServiceControlHints();
      return;
    }
    if (existing) {
      clearServiceState();
    }

    if (!staticDir) {
      console.log("Warning: UI frontend not found in package assets.");
    }

    const logPath = resolveServiceLogPath();
    const logDir = resolve(logPath, "..");
    mkdirSync(logDir, { recursive: true });
    const logFd = openSync(logPath, "a");
    const readinessTimeoutMs = this.resolveStartupTimeoutMs(options.startupTimeoutMs);
    const quickPhaseTimeoutMs = Math.min(8000, readinessTimeoutMs);
    const extendedPhaseTimeoutMs = Math.max(0, readinessTimeoutMs - quickPhaseTimeoutMs);
    this.appendStartupStage(
      logPath,
      `start requested: ui=${uiConfig.host}:${uiConfig.port}, readinessTimeoutMs=${readinessTimeoutMs}`
    );
    console.log(`Starting ${APP_NAME} background service (readiness timeout ${Math.ceil(readinessTimeoutMs / 1000)}s)...`);

    const serveArgs = buildServeArgs({
      uiPort: uiConfig.port
    });
    this.appendStartupStage(logPath, `spawning background process: ${process.execPath} ${[...process.execArgv, ...serveArgs].join(" ")}`);
    const child = spawn(process.execPath, [...process.execArgv, ...serveArgs], {
      env: process.env,
      stdio: ["ignore", logFd, logFd],
      detached: true
    });
    this.appendStartupStage(logPath, `spawned background process pid=${child.pid ?? "unknown"}`);
    closeSync(logFd);
    if (!child.pid) {
      this.appendStartupStage(logPath, "spawn failed: child pid missing");
      console.error("Error: Failed to start background service.");
      return;
    }

    const healthUrl = `${apiUrl}/health`;
    this.appendStartupStage(logPath, `health probe started: ${healthUrl} (phase=quick, timeoutMs=${quickPhaseTimeoutMs})`);
    let readiness = await this.waitForBackgroundServiceReady({
      pid: child.pid,
      healthUrl,
      timeoutMs: quickPhaseTimeoutMs
    });

    if (!readiness.ready && isProcessRunning(child.pid) && extendedPhaseTimeoutMs > 0) {
      console.warn(
        `Warning: Background service is still running but not ready after ${Math.ceil(quickPhaseTimeoutMs / 1000)}s; waiting up to ${Math.ceil(extendedPhaseTimeoutMs / 1000)}s more.`
      );
      this.appendStartupStage(
        logPath,
        `health probe entering extended phase (timeoutMs=${extendedPhaseTimeoutMs}, lastError=${readiness.lastProbeError ?? "none"})`
      );
      readiness = await this.waitForBackgroundServiceReady({
        pid: child.pid,
        healthUrl,
        timeoutMs: extendedPhaseTimeoutMs
      });
    }

    if (!readiness.ready) {
      if (!isProcessRunning(child.pid)) {
        clearServiceState();
        const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
        this.appendStartupStage(logPath, `startup failed: process exited before ready.${hint}`);
        console.error(`Error: Failed to start background service. Check logs: ${logPath}.${hint}`);
        return;
      }
      this.appendStartupStage(
        logPath,
        `startup degraded: process alive but health probe timed out after ${readinessTimeoutMs}ms (lastError=${readiness.lastProbeError ?? "none"})`
      );
    }

    child.unref();

    const state: ServiceState = {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      uiUrl,
      apiUrl,
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      logPath,
      startupState: readiness.ready ? "ready" : "degraded",
      startupLastProbeError: readiness.lastProbeError,
      startupTimeoutMs: readinessTimeoutMs,
      startupCheckedAt: new Date().toISOString()
    };
    writeServiceState(state);

    if (!readiness.ready) {
      const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
      console.warn(
        `Warning: ${APP_NAME} is running (PID ${state.pid}) but not healthy yet after ${Math.ceil(readinessTimeoutMs / 1000)}s. Marked as degraded.${hint}`
      );
      console.warn(`Tip: Run "${APP_NAME} status --json" and check logs: ${logPath}`);
    } else {
      console.log(`✓ ${APP_NAME} started in background (PID ${state.pid})`);
    }
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    await this.printPublicUiUrls(uiConfig.host, uiConfig.port);
    console.log(`Logs: ${logPath}`);
    this.printServiceControlHints();

    if (options.open) {
      openBrowser(uiUrl);
    }
  }

  async stopService(): Promise<void> {
    const state = readServiceState();
    if (!state) {
      console.log("No running service found.");
      return;
    }
    if (!isProcessRunning(state.pid)) {
      console.log("Service is not running. Cleaning up state.");
      clearServiceState();
      return;
    }

    console.log(`Stopping ${APP_NAME} (PID ${state.pid})...`);
    try {
      process.kill(state.pid, "SIGTERM");
    } catch (error) {
      console.error(`Failed to stop service: ${String(error)}`);
      return;
    }

    const stopped = await waitForExit(state.pid, 3000);
    if (!stopped) {
      try {
        process.kill(state.pid, "SIGKILL");
      } catch (error) {
        console.error(`Failed to force stop service: ${String(error)}`);
        return;
      }
      await waitForExit(state.pid, 2000);
    }

    clearServiceState();
    console.log(`✓ ${APP_NAME} stopped`);
  }

  async waitForBackgroundServiceReady(params: {
    pid: number;
    healthUrl: string;
    timeoutMs: number;
  }): Promise<{ ready: boolean; lastProbeError: string | null }> {
    const startedAt = Date.now();
    let lastProbeError: string | null = null;
    while (Date.now() - startedAt < params.timeoutMs) {
      if (!isProcessRunning(params.pid)) {
        return { ready: false, lastProbeError };
      }
      const probe = await this.probeHealthEndpoint(params.healthUrl);
      if (!probe.healthy) {
        lastProbeError = probe.error;
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (isProcessRunning(params.pid)) {
        return { ready: true, lastProbeError: null };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return { ready: false, lastProbeError };
  }

  private resolveStartupTimeoutMs(overrideTimeoutMs: number | undefined): number {
    const fallback = process.platform === "win32" ? 28000 : 33000;
    const envRaw = process.env.NEXTCLAW_START_TIMEOUT_MS?.trim();
    const envValue = envRaw ? Number(envRaw) : Number.NaN;
    const fromEnv = Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : null;
    const fromOverride = Number.isFinite(overrideTimeoutMs) && Number(overrideTimeoutMs) > 0
      ? Math.floor(Number(overrideTimeoutMs))
      : null;
    const resolved = fromOverride ?? fromEnv ?? fallback;
    return Math.max(3000, resolved);
  }

  private appendStartupStage(logPath: string, message: string): void {
    try {
      appendFileSync(logPath, `[${new Date().toISOString()}] [startup] ${message}\n`, "utf-8");
    } catch {
      // Best-effort diagnostics only.
    }
  }

  private async probeHealthEndpoint(
    healthUrl: string
  ): Promise<{ healthy: boolean; error: string | null }> {
    let parsed: URL;
    try {
      parsed = new URL(healthUrl);
    } catch {
      return { healthy: false, error: "invalid health URL" };
    }

    const requestImpl = parsed.protocol === "https:" ? httpsRequest : httpRequest;

    return new Promise((resolve) => {
      const req = requestImpl(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port
            ? Number(parsed.port)
            : parsed.protocol === "https:"
              ? 443
              : 80,
          method: "GET",
          path: `${parsed.pathname}${parsed.search}`,
          timeout: 1000,
          headers: { Accept: "application/json" }
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => {
            if (typeof chunk === "string") {
              chunks.push(Buffer.from(chunk));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
              resolve({ healthy: false, error: `http ${res.statusCode ?? "unknown"}` });
              return;
            }

            try {
              const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
                ok?: boolean;
                data?: { status?: string };
              };
              const healthy = payload?.ok === true && payload?.data?.status === "ok";
              if (!healthy) {
                resolve({ healthy: false, error: "health payload not ok" });
                return;
              }
              resolve({ healthy: true, error: null });
            } catch {
              resolve({ healthy: false, error: "invalid health JSON response" });
            }
          });
        }
      );

      req.on("timeout", () => {
        req.destroy(new Error("probe timeout"));
      });
      req.on("error", (error) => {
        resolve({ healthy: false, error: error.message || String(error) });
      });
      req.end();
    });
  }

  createMissingProvider(config: ReturnType<typeof loadConfig>): LLMProvider {
    return this.makeMissingProvider(config);
  }

  createProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }): LiteLLMProvider | null {
    if (options?.allowMissing) {
      return this.makeProvider(config, { allowMissing: true });
    }
    return this.makeProvider(config);
  }

  private makeMissingProvider(config: ReturnType<typeof loadConfig>): LLMProvider {
    return new MissingProvider(config.agents.defaults.model);
  }

  private makeProvider(config: ReturnType<typeof loadConfig>, options: { allowMissing: true }): LiteLLMProvider | null;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: false }): LiteLLMProvider;
  private makeProvider(config: ReturnType<typeof loadConfig>, options?: { allowMissing?: boolean }) {
    const provider = getProvider(config);
    const model = config.agents.defaults.model;
    if (!provider?.apiKey && !model.startsWith("bedrock/")) {
      if (options?.allowMissing) {
        return null;
      }
      console.error("Error: No API key configured.");
      console.error(`Set one in ${getConfigPath()} under providers section`);
      process.exit(1);
    }
    return new LiteLLMProvider({
      apiKey: provider?.apiKey ?? null,
      apiBase: getApiBase(config),
      defaultModel: model,
      extraHeaders: provider?.extraHeaders ?? null,
      providerName: getProviderName(config),
      wireApi: provider?.wireApi ?? null
    });
  }

  private async printPublicUiUrls(host: string, port: number): Promise<void> {
    if (isLoopbackHost(host)) {
      console.log("Public URL: disabled (UI host is loopback). Current release expects public exposure; run nextclaw restart.");
      return;
    }

    const publicIp = await resolvePublicIp();
    if (!publicIp) {
      console.log("Public URL: UI is exposed, but automatic public IP detection failed.");
      return;
    }

    const publicBase = `http://${publicIp}:${port}`;
    console.log(`Public UI (if firewall/NAT allows): ${publicBase}`);
    console.log(`Public API (if firewall/NAT allows): ${publicBase}/api`);
  }

  private printServiceControlHints(): void {
    console.log("Service controls:");
    console.log(`  - Check status: ${APP_NAME} status`);
    console.log(`  - If you need to stop the service, run: ${APP_NAME} stop`);
  }

  private startUiIfEnabled(
    uiConfig: Config["ui"],
    uiStaticDir: string | null,
    cronService: NextclawCore.CronService,
    runtimePool: GatewayAgentRuntimePool,
    sessionManager: SessionManager
  ): void {
    if (!uiConfig.enabled) {
      return;
    }
    const resolveStopCapability = (params: {
      sessionKey?: string;
      agentId?: string;
      channel?: string;
      chatId?: string;
      metadata?: Record<string, unknown>;
    }) => runtimePool.supportsTurnAbort({
      sessionKey: params.sessionKey,
      agentId: params.agentId,
      channel: params.channel,
      chatId: params.chatId,
      metadata: params.metadata
    });
    const resolveChatTurnParams = (params: {
      message: string;
      sessionKey?: string;
      agentId?: string;
      channel?: string;
      chatId?: string;
      model?: string;
      metadata?: Record<string, unknown>;
      runId?: string;
    }) => {
      const sessionKey =
        typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
          ? params.sessionKey.trim()
          : `ui:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
      const inferredAgentId =
        typeof params.agentId === "string" && params.agentId.trim().length > 0
          ? params.agentId.trim()
          : parseAgentScopedSessionKey(sessionKey)?.agentId;
      const model = typeof params.model === "string" && params.model.trim().length > 0 ? params.model.trim() : undefined;
      const metadata =
        params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
          ? { ...params.metadata }
          : {};
      if (model) {
        metadata.model = model;
      }
      const runId = typeof params.runId === "string" && params.runId.trim().length > 0
        ? params.runId.trim()
        : undefined;
      return {
        runId,
        sessionKey,
        inferredAgentId,
        model,
        metadata,
        channel: typeof params.channel === "string" && params.channel.trim().length > 0 ? params.channel : "ui",
        chatId: typeof params.chatId === "string" && params.chatId.trim().length > 0 ? params.chatId : "web-ui"
      };
    };

    const buildTurnResult = (params: {
      reply: string;
      sessionKey: string;
      inferredAgentId?: string;
      model?: string;
    }) => ({
      reply: params.reply,
      sessionKey: params.sessionKey,
      ...(params.inferredAgentId ? { agentId: params.inferredAgentId } : {}),
      ...(params.model ? { model: params.model } : {})
    });

    let publishUiEvent: ((event: UiServerEvent) => void) | null = null;
    const runCoordinator = new UiChatRunCoordinator({
      runtimePool,
      sessionManager,
      onRunUpdated: (run) => {
        publishUiEvent?.({ type: "run.updated", payload: { run } });
      }
    });

    const uiServer = startUiServer({
      host: uiConfig.host,
      port: uiConfig.port,
      configPath: getConfigPath(),
      productVersion: getPackageVersion(),
      staticDir: uiStaticDir ?? undefined,
      cronService,
      marketplace: {
        apiBaseUrl: process.env.NEXTCLAW_MARKETPLACE_API_BASE,
        installer: {
          installPlugin: (spec) => this.installMarketplacePlugin(spec),
          installSkill: (params) => this.installMarketplaceSkill(params),
          enablePlugin: (id) => this.enableMarketplacePlugin(id),
          disablePlugin: (id) => this.disableMarketplacePlugin(id),
          uninstallPlugin: (id) => this.uninstallMarketplacePlugin(id),
          uninstallSkill: (slug) => this.uninstallMarketplaceSkill(slug)
        }
      },
      chatRuntime: {
        getCapabilities: async (params) => {
          const sessionKey =
            typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
              ? params.sessionKey.trim()
              : `ui:capability:${Date.now().toString(36)}`;
          const capability = resolveStopCapability({
            sessionKey,
            agentId: typeof params.agentId === "string" ? params.agentId : undefined,
            channel: "ui",
            chatId: "web-ui",
            metadata: {}
          });
          return {
            stopSupported: capability.supported,
            ...(capability.reason ? { stopReason: capability.reason } : {})
          };
        },
        processTurn: async (params) => {
          const resolved = resolveChatTurnParams(params);

          const reply = await runtimePool.processDirect({
            content: params.message,
            sessionKey: resolved.sessionKey,
            channel: resolved.channel,
            chatId: resolved.chatId,
            agentId: resolved.inferredAgentId,
            metadata: resolved.metadata
          });

          return buildTurnResult({
            reply,
            sessionKey: resolved.sessionKey,
            inferredAgentId: resolved.inferredAgentId,
            model: resolved.model
          });
        },
        startTurnRun: async (params) => {
          return runCoordinator.startRun(params);
        },
        listRuns: async (params) => {
          return runCoordinator.listRuns(params);
        },
        getRun: async (params) => {
          return runCoordinator.getRun(params);
        },
        streamRun: async function* (params) {
          for await (const event of runCoordinator.streamRun(params)) {
            yield event;
          }
        },
        stopTurn: async (params) => {
          return await runCoordinator.stopRun(params);
        },
        processTurnStream: async function* (params) {
          const run = runCoordinator.startRun(params);
          for await (const event of runCoordinator.streamRun({ runId: run.runId })) {
            yield event;
          }
        }
      }
    });
    publishUiEvent = uiServer.publish;
    const uiUrl = `http://${uiServer.host}:${uiServer.port}`;
    console.log(`✓ UI API: ${uiUrl}/api`);
    if (uiStaticDir) {
      console.log(`✓ UI frontend: ${uiUrl}`);
    }
    void this.printPublicUiUrls(uiServer.host, uiServer.port);
    if (uiConfig.open) {
      openBrowser(uiUrl);
    }
  }

  private async installMarketplacePlugin(spec: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "install", spec]);
    const summary = this.pickLastOutputLine(output) ?? `Installed plugin: ${spec}`;
    return { message: summary, output };
  }

  private async installMarketplaceSkill(params: {
    slug: string;
    kind?: "npm" | "clawhub" | "git" | "builtin";
    skill?: string;
    installPath?: string;
    version?: string;
    registry?: string;
    force?: boolean;
  }): Promise<{ message: string; output?: string }> {
    if (params.kind === "builtin") {
      const result = this.installBuiltinMarketplaceSkill(params.slug, params.force);
      if (!result) {
        throw new Error(`Builtin skill not found: ${params.slug}`);
      }
      return result;
    }

    if (params.kind === "git") {
      return await this.installGitMarketplaceSkill(params);
    }

    const args = ["skills", "install", params.slug];
    if (params.version) {
      args.push("--version", params.version);
    }
    if (params.registry) {
      args.push("--registry", params.registry);
    }
    if (params.force) {
      args.push("--force");
    }

    try {
      const output = await this.runCliSubcommand(args);
      const summary = this.pickLastOutputLine(output) ?? `Installed skill: ${params.slug}`;
      return { message: summary, output };
    } catch (error) {
      const fallback = this.installBuiltinMarketplaceSkill(params.slug, params.force);
      if (!fallback) {
        throw error;
      }
      return fallback;
    }
  }

  private async installGitMarketplaceSkill(params: {
    slug: string;
    skill?: string;
    installPath?: string;
    registry?: string;
    force?: boolean;
  }): Promise<{ message: string; output?: string }> {
    const source = params.slug.trim();
    if (!source) {
      throw new Error("Git skill source is required");
    }

    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const skillName = this.resolveGitSkillName(params.skill, source);
    const destination = this.resolveSkillInstallPath(workspace, params.installPath, skillName);
    const destinationSkillFile = join(destination, "SKILL.md");

    if (existsSync(destinationSkillFile) && !params.force) {
      return {
        message: `${skillName} is already installed`,
        output: destination
      };
    }
    if (existsSync(destination) && !params.force) {
      throw new Error(`Skill install path already exists: ${destination} (use force to overwrite)`);
    }

    if (existsSync(destination) && params.force) {
      rmSync(destination, { recursive: true, force: true });
    }

    const materialized = await this.materializeMarketplaceGitSkillSource({ source, skillName });
    try {
      const installSkillFile = join(materialized.skillDir, "SKILL.md");
      if (!existsSync(installSkillFile)) {
        throw new Error(`git skill source does not contain SKILL.md for ${skillName}`);
      }

      mkdirSync(dirname(destination), { recursive: true });
      cpSync(materialized.skillDir, destination, { recursive: true, force: true });
      return {
        message: `Installed skill: ${skillName}`,
        output: [
          `Source: ${source}`,
          `Materialized skill: ${materialized.skillDir}`,
          `Workspace target: ${destination}`,
          materialized.commandOutput
        ].filter(Boolean).join("\n")
      };
    } finally {
      rmSync(materialized.tempRoot, { recursive: true, force: true });
    }
  }

  private async materializeMarketplaceGitSkillSource(params: {
    source: string;
    skillName: string;
  }): Promise<{ tempRoot: string; skillDir: string; commandOutput: string }> {
    const parsed = this.parseMarketplaceGitSkillSource(params.source);
    const gitPath = findExecutableOnPath("git");
    if (!gitPath) {
      throw new Error("git is required to install marketplace git skills");
    }

    const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-marketplace-skill-"));
    const repoDir = join(tempRoot, "repo");
    try {
      const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none", "--sparse"];
      if (parsed.ref) {
        cloneArgs.push("--branch", parsed.ref);
      }
      cloneArgs.push(parsed.repoUrl, repoDir);
      const cloneResult = await this.runCommand(gitPath, cloneArgs, {
        cwd: tempRoot,
        timeoutMs: 180_000
      });
      const sparseResult = await this.runCommand(gitPath, ["-C", repoDir, "sparse-checkout", "set", parsed.skillPath], {
        cwd: tempRoot,
        timeoutMs: 60_000
      });
      const skillDir = join(repoDir, parsed.skillPath);
      return {
        tempRoot,
        skillDir,
        commandOutput: [
          `Git repository: ${parsed.repoUrl}`,
          `Git path: ${parsed.skillPath}`,
          this.mergeCommandOutput(cloneResult.stdout, cloneResult.stderr),
          this.mergeCommandOutput(sparseResult.stdout, sparseResult.stderr)
        ].filter(Boolean).join("\n")
      };
    } catch (error) {
      rmSync(tempRoot, { recursive: true, force: true });
      throw error;
    }
  }

  private parseMarketplaceGitSkillSource(source: string): {
    repoUrl: string;
    skillPath: string;
    ref?: string;
  } {
    const trimmed = source.trim();
    if (!trimmed) {
      throw new Error("Git skill source is required");
    }

    if (trimmed.includes("://")) {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.hostname !== "github.com") {
        throw new Error(`Unsupported git skill source host: ${parsedUrl.hostname}`);
      }
      const parts = parsedUrl.pathname.split("/").filter(Boolean);
      if (parts.length < 5 || (parts[2] !== "tree" && parts[2] !== "blob")) {
        throw new Error(`Unsupported GitHub skill source URL: ${source}`);
      }
      const [owner, repoRaw, , ref, ...pathParts] = parts;
      const repo = repoRaw.replace(/\.git$/i, "");
      if (!owner || !repo || !ref || pathParts.length === 0) {
        throw new Error(`Unsupported GitHub skill source URL: ${source}`);
      }
      return {
        repoUrl: `https://github.com/${owner}/${repo}.git`,
        skillPath: pathParts.join("/"),
        ref
      };
    }

    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length < 3) {
      throw new Error(`Unsupported git skill source: ${source}`);
    }

    const owner = parts[0] ?? "";
    const repoWithOptionalRef = parts[1] ?? "";
    const pathParts = parts.slice(2);
    const atIndex = repoWithOptionalRef.indexOf("@");
    const repo = (atIndex >= 0 ? repoWithOptionalRef.slice(0, atIndex) : repoWithOptionalRef).replace(/\.git$/i, "");
    const ref = atIndex >= 0 ? repoWithOptionalRef.slice(atIndex + 1) : undefined;
    if (!owner || !repo || pathParts.length === 0) {
      throw new Error(`Unsupported git skill source: ${source}`);
    }

    return {
      repoUrl: `https://github.com/${owner}/${repo}.git`,
      skillPath: pathParts.join("/"),
      ref: ref && ref.trim().length > 0 ? ref.trim() : undefined
    };
  }

  private async enableMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "enable", id]);
    const summary = this.pickLastOutputLine(output) ?? `Enabled plugin: ${id}`;
    return { message: summary, output };
  }

  private async disableMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "disable", id]);
    const summary = this.pickLastOutputLine(output) ?? `Disabled plugin: ${id}`;
    return { message: summary, output };
  }

  private async uninstallMarketplacePlugin(id: string): Promise<{ message: string; output?: string }> {
    const output = await this.runCliSubcommand(["plugins", "uninstall", id, "--force"]);
    const summary = this.pickLastOutputLine(output) ?? `Uninstalled plugin: ${id}`;
    return { message: summary, output };
  }

  private async uninstallMarketplaceSkill(slug: string): Promise<{ message: string; output?: string }> {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const targetDir = join(workspace, "skills", slug);

    if (!existsSync(targetDir)) {
      throw new Error(`Skill not installed in workspace: ${slug}`);
    }

    rmSync(targetDir, { recursive: true, force: true });

    return {
      message: `Uninstalled skill: ${slug}`,
      output: `Removed ${targetDir}`
    };
  }

  private installBuiltinMarketplaceSkill(
    slug: string,
    force: boolean | undefined
  ): { message: string; output?: string } | null {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const destination = join(workspace, "skills", slug);
    const destinationSkillFile = join(destination, "SKILL.md");

    if (existsSync(destinationSkillFile) && !force) {
      return {
        message: `${slug} is already installed`,
        output: destination
      };
    }

    const loader = createSkillsLoader(workspace);
    const builtin = (loader?.listSkills(false) ?? []).find((skill) => skill.name === slug && skill.source === "builtin");

    if (!builtin) {
      if (existsSync(destinationSkillFile)) {
        return {
          message: `${slug} is already installed`,
          output: destination
        };
      }
      return null;
    }

    mkdirSync(join(workspace, "skills"), { recursive: true });
    cpSync(dirname(builtin.path), destination, { recursive: true, force: true });
    return {
      message: `Installed skill: ${slug}`,
      output: `Copied builtin skill to ${destination}`
    };
  }

  private resolveGitSkillName(skill: string | undefined, source: string): string {
    const fromRequest = typeof skill === "string" ? skill.trim() : "";
    if (fromRequest) {
      return this.validateSkillName(fromRequest);
    }

    const normalizedSource = source.replace(/[?#].*$/, "").replace(/\/+$/, "");
    const parts = normalizedSource.split("/").filter(Boolean);
    const inferred = parts.length > 0 ? parts[parts.length - 1] : "";
    if (!inferred) {
      throw new Error("Git skill install requires a specific skill name");
    }
    return this.validateSkillName(inferred);
  }

  private validateSkillName(skillName: string): string {
    if (!/^[A-Za-z0-9._-]+$/.test(skillName)) {
      throw new Error(`Invalid skill name: ${skillName}`);
    }
    return skillName;
  }

  private resolveSkillInstallPath(workspace: string, installPath: string | undefined, skillName: string): string {
    const requested = typeof installPath === "string" && installPath.trim().length > 0
      ? installPath.trim()
      : join("skills", skillName);
    if (isAbsolute(requested)) {
      throw new Error("installPath must be relative to workspace");
    }

    const destination = resolve(workspace, requested);
    const rel = relative(workspace, destination);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error("installPath escapes workspace");
    }
    return destination;
  }

  private mergeCommandOutput(stdout: string, stderr: string): string {
    return `${stdout}\n${stderr}`.trim();
  }

  private runCliSubcommand(args: string[], timeoutMs = 180_000): Promise<string> {
    const cliEntry = fileURLToPath(new URL("../index.js", import.meta.url));
    return this.runCommand(process.execPath, [...process.execArgv, cliEntry, ...args], {
      cwd: process.cwd(),
      timeoutMs
    }).then((result) => this.mergeCommandOutput(result.stdout, result.stderr));
  }

  private async runCommandWithFallback(
    commandCandidates: string[],
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    let lastError: Error | null = null;
    for (const command of commandCandidates) {
      try {
        return await this.runCommand(command, args, options);
      } catch (error) {
        const message = String(error);
        lastError = error instanceof Error ? error : new Error(message);
        if (message.startsWith("failed to start command:")) {
          continue;
        }
        throw error;
      }
    }
    throw lastError ?? new Error("failed to start command");
  }

  private runCommand(
    command: string,
    args: string[],
    options: { cwd?: string; timeoutMs?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    const timeoutMs = options.timeoutMs ?? 180_000;
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: options.cwd ?? process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf-8");
      child.stderr?.setEncoding("utf-8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        rejectPromise(new Error(`command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        rejectPromise(new Error(`failed to start command: ${String(error)}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const output = this.mergeCommandOutput(stdout, stderr);
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(output || `command failed with code ${code ?? 1}`));
      });
    });
  }

  private pickLastOutputLine(output: string): string | null {
    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines[lines.length - 1] : null;
  }
}
