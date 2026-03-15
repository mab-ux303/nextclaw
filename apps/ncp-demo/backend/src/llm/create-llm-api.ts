import type { NcpLLMApi } from "@nextclaw/ncp";
import { DemoClockNcpLLMApi } from "./demo-llm.js";
import { OpenAICompatibleNcpLLMApi } from "./openai-compatible-llm.js";

export type DemoLlmMode = "mock" | "openai";

function parseReasoningEffort(
  value: string | undefined,
): "low" | "medium" | "high" | "none" | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "low" || v === "medium" || v === "high" || v === "none") return v;
  return undefined;
}

function parseEnableThinking(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

export function createLlmApi(): { api: NcpLLMApi; mode: DemoLlmMode } {
  const mode = (process.env.NCP_DEMO_LLM_MODE ?? "auto").trim().toLowerCase();
  if (mode === "mock") {
    return { api: new DemoClockNcpLLMApi(), mode: "mock" };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || process.env.base_url?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.3-codex";
  const reasoningEffort = parseReasoningEffort(process.env.NCP_DEMO_REASONING_EFFORT?.trim());
  const enableThinking = parseEnableThinking(process.env.NCP_DEMO_ENABLE_THINKING?.trim());

  if (apiKey && baseUrl) {
    return {
      api: new OpenAICompatibleNcpLLMApi({
        apiKey,
        baseUrl,
        model,
        reasoningEffort,
        enableThinking,
      }),
      mode: "openai",
    };
  }

  return { api: new DemoClockNcpLLMApi(), mode: "mock" };
}
