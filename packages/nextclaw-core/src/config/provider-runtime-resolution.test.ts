import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configureProviderCatalog } from "../providers/registry.js";
import { ConfigSchema } from "./schema.js";
import { resolveProviderRuntime } from "./provider-runtime-resolution.js";

describe("resolveProviderRuntime", () => {
  beforeEach(() => {
    configureProviderCatalog([
      {
        id: "test-runtime-resolution-providers",
        providers: [
          {
            name: "nextclaw",
            displayName: "NextClaw Gateway",
            keywords: ["nextclaw", "dashscope/", "qwen3.5", "qwen"],
            envKey: "NEXTCLAW_API_KEY",
            defaultApiBase: "https://ai-gateway-api.nextclaw.io/v1",
            isGateway: true,
            isLocal: false,
          },
          {
            name: "deepseek",
            displayName: "DeepSeek",
            keywords: ["deepseek"],
            envKey: "DEEPSEEK_API_KEY",
            defaultApiBase: "https://api.deepseek.com",
            isGateway: false,
            isLocal: false,
          },
        ],
      },
    ]);
  });

  afterEach(() => {
    configureProviderCatalog([]);
  });

  it("resolves builtin provider runtime fields from model identifier", () => {
    const config = ConfigSchema.parse({
      providers: {
        deepseek: {
          apiKey: "sk-deepseek",
        },
      },
    });

    expect(resolveProviderRuntime(config, "deepseek-chat")).toEqual(
      expect.objectContaining({
        resolvedModel: "deepseek-chat",
        providerLocalModel: "deepseek-chat",
        providerName: "deepseek",
        providerDisplayName: "DeepSeek",
        apiKey: "sk-deepseek",
        apiBase: "https://api.deepseek.com",
      }),
    );
  });

  it("keeps custom provider internal id while exposing display and local model separately", () => {
    const config = ConfigSchema.parse({
      providers: {
        "custom-1": {
          displayName: "yunyi",
          apiKey: "sk-yunyi",
          apiBase: "https://yunyi.example.com/v1",
          models: ["gpt-5.4"],
        },
      },
    });

    expect(resolveProviderRuntime(config, "custom-1/gpt-5.4")).toEqual(
      expect.objectContaining({
        resolvedModel: "custom-1/gpt-5.4",
        providerLocalModel: "gpt-5.4",
        providerName: "custom-1",
        providerDisplayName: "yunyi",
        apiKey: "sk-yunyi",
        apiBase: "https://yunyi.example.com/v1",
      }),
    );
  });

  it("falls through disabled providers and resolves the next enabled route", () => {
    const config = ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: "nc_free_test_key",
        },
        deepseek: {
          enabled: false,
          apiKey: "sk-deepseek",
        },
      },
    });

    expect(resolveProviderRuntime(config, "deepseek-chat")).toEqual(
      expect.objectContaining({
        resolvedModel: "deepseek-chat",
        providerLocalModel: "deepseek-chat",
        providerName: "nextclaw",
        providerDisplayName: "NextClaw Gateway",
        apiKey: "nc_free_test_key",
        apiBase: "https://ai-gateway-api.nextclaw.io/v1",
      }),
    );
  });
});
