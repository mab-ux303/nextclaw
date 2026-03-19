import {
  findProviderByModel,
  findProviderByName,
  getApiBase,
  buildRequestedSkillsUserPrompt,
  getProvider,
  getProviderName,
  getWorkspacePath,
  SkillsLoader,
  type Config,
} from "@nextclaw/core";
import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  CodexSdkNcpAgentRuntime,
  type CodexSdkNcpAgentRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-codex-sdk";

const PLUGIN_ID = "nextclaw-ncp-runtime-plugin-codex-sdk";
const CODEX_RUNTIME_KIND = "codex";

type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

type PluginApi = {
  config: Config;
  pluginConfig?: Record<string, unknown>;
  registerNcpAgentRuntime: (registration: {
    kind: string;
    label?: string;
    createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  }) => void;
};

type PluginDefinition = {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  register: (api: PluginApi) => void;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

function resolveCodexCapabilitySpec(params: {
  model?: string;
  providerName?: string | null;
}) {
  const providerSpec = params.providerName ? findProviderByName(params.providerName) : undefined;
  const modelSpec = params.model ? findProviderByModel(params.model) : undefined;
  return providerSpec?.isGateway ? modelSpec ?? providerSpec : providerSpec ?? modelSpec;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }
    const normalized = entryValue.trim();
    if (!normalized) {
      continue;
    }
    out[entryKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readThinkingLevel(value: unknown): CodexReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }
  return undefined;
}

function resolveCodexExecutionOptions(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): {
  workingDirectory: string;
  skipGitRepoCheck: boolean;
} {
  const configuredWorkingDirectory = readString(params.pluginConfig.workingDirectory);
  const workspace = getWorkspacePath(
    configuredWorkingDirectory ?? params.config.agents.defaults.workspace,
  );

  return {
    workingDirectory: workspace,
    skipGitRepoCheck: readBoolean(params.pluginConfig.skipGitRepoCheck) ?? true,
  };
}

function resolveCodexCliConfig(
  params: {
    pluginConfig: Record<string, unknown>;
    model?: string;
    providerName?: string | null;
    apiBase?: string;
  },
): CodexSdkNcpAgentRuntimeConfig["cliConfig"] | undefined {
  const explicitConfig = readRecord(params.pluginConfig.config);
  const modelProvider =
    readString(params.pluginConfig.modelProvider) ?? readString(params.providerName) ?? "openai";
  const preferredAuthMethod =
    readString(params.pluginConfig.preferredAuthMethod) ?? "apikey";
  const apiBase = readString(params.pluginConfig.apiBase) ?? readString(params.apiBase);
  const config: Record<string, unknown> = {
    model_provider: modelProvider,
    preferred_auth_method: preferredAuthMethod,
  };
  if (modelProvider && apiBase) {
    config.model_providers = {
      [modelProvider]: {
        name: modelProvider,
        base_url: apiBase,
        wire_api: "responses",
        requires_openai_auth: true,
      },
    };
  }

  return {
    ...config,
    ...(explicitConfig ?? {}),
  } as CodexSdkNcpAgentRuntimeConfig["cliConfig"];
}

function stripProviderPrefix(model: string, providerName?: string | null): string {
  const normalizedModel = model.trim();
  const normalizedProvider = providerName?.trim().toLowerCase();
  if (!normalizedModel || !normalizedProvider) {
    return normalizedModel;
  }
  const prefix = `${normalizedProvider}/`;
  if (!normalizedModel.toLowerCase().startsWith(prefix)) {
    return normalizedModel;
  }
  return normalizedModel.slice(prefix.length);
}

function readRequestedSkills(metadata: Record<string, unknown>): string[] {
  const raw = metadata.requested_skills ?? metadata.requestedSkills;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 8);
}

function readUserText(input: NcpAgentRunInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter((part): part is Extract<typeof message.parts[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function buildCodexInputBuilder(workspace: string) {
  const skillsLoader = new SkillsLoader(workspace);
  return async (input: NcpAgentRunInput): Promise<string> => {
    const userText = readUserText(input);
    const metadata =
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    const requestedSkills = readRequestedSkills(metadata);
    return buildRequestedSkillsUserPrompt(skillsLoader, requestedSkills, userText);
  };
}

function resolveCodexModel(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}): string {
  return (
    readString(params.sessionMetadata.preferred_model) ??
    readString(params.sessionMetadata.model) ??
    readString(params.pluginConfig.model) ??
    params.config.agents.defaults.model
  );
}

const plugin: PluginDefinition = {
  id: PLUGIN_ID,
  name: "NextClaw Codex NCP Runtime",
  description: "Registers NCP session type `codex` backed by OpenAI Codex SDK.",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {},
  },
  register(api) {
    const pluginConfig = readRecord(api.pluginConfig) ?? {};

    api.registerNcpAgentRuntime({
      kind: CODEX_RUNTIME_KIND,
      label: "Codex",
      createRuntime: (runtimeParams) => {
        const nextConfig = api.config;
        const model = resolveCodexModel({
          config: nextConfig,
          pluginConfig,
          sessionMetadata: runtimeParams.sessionMetadata,
        });
        const provider = getProvider(nextConfig, model);
        const providerName = getProviderName(nextConfig, model);
        const capabilitySpec = resolveCodexCapabilitySpec({
          model,
          providerName,
        });
        const apiBase = readString(pluginConfig.apiBase) ?? getApiBase(nextConfig, model) ?? undefined;
        const apiKey = readString(pluginConfig.apiKey) ?? provider?.apiKey ?? undefined;
        if (!apiKey) {
          throw new Error(
            `[codex] missing apiKey. Set plugins.entries.${PLUGIN_ID}.config.apiKey or providers.*.apiKey for model "${model}".`,
          );
        }
        if (capabilitySpec?.supportsResponsesApi === false) {
          const capabilityProviderName = capabilitySpec.displayName ?? capabilitySpec.name ?? providerName ?? "provider";
          throw new Error(
            `[codex] model "${model}" is routed through "${capabilityProviderName}", which does not support the Responses API. Codex SDK currently only supports models available through the Responses API.`,
          );
        }

        const executionOptions = resolveCodexExecutionOptions({
          config: nextConfig,
          pluginConfig,
        });
        const thinkingLevel =
          readThinkingLevel(runtimeParams.sessionMetadata.preferred_thinking) ??
          readThinkingLevel(runtimeParams.sessionMetadata.thinking) ??
          undefined;

        return new CodexSdkNcpAgentRuntime({
          sessionId: runtimeParams.sessionId,
          apiKey,
          apiBase,
          model: stripProviderPrefix(model, providerName),
          threadId: readString(runtimeParams.sessionMetadata.codex_thread_id) ?? null,
          codexPathOverride: readString(pluginConfig.codexPathOverride),
          env: readStringRecord(pluginConfig.env),
          cliConfig: resolveCodexCliConfig({
            pluginConfig,
            model,
            providerName,
            apiBase,
          }),
          stateManager: runtimeParams.stateManager,
          sessionMetadata: runtimeParams.sessionMetadata,
          setSessionMetadata: runtimeParams.setSessionMetadata,
          inputBuilder: buildCodexInputBuilder(executionOptions.workingDirectory),
          threadOptions: {
            model,
            sandboxMode:
              readString(pluginConfig.sandboxMode) as
                | "read-only"
                | "workspace-write"
                | "danger-full-access"
                | undefined,
            workingDirectory: executionOptions.workingDirectory,
            skipGitRepoCheck: executionOptions.skipGitRepoCheck,
            modelReasoningEffort: thinkingLevel,
            networkAccessEnabled: readBoolean(pluginConfig.networkAccessEnabled),
            webSearchMode:
              readString(pluginConfig.webSearchMode) as "disabled" | "cached" | "live" | undefined,
            webSearchEnabled: readBoolean(pluginConfig.webSearchEnabled),
            approvalPolicy:
              readString(pluginConfig.approvalPolicy) as
                | "never"
                | "on-request"
                | "on-failure"
                | "untrusted"
                | undefined,
            additionalDirectories: readStringArray(pluginConfig.additionalDirectories),
          },
        });
      },
    });
  },
};

export default plugin;
