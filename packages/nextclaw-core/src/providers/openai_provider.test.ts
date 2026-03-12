import { describe, expect, it } from "vitest";
import { OpenAICompatibleProvider } from "./openai_provider.js";

describe("OpenAICompatibleProvider responses payload parser", () => {
  const provider = new OpenAICompatibleProvider({
    apiKey: "sk-test",
    apiBase: "http://127.0.0.1:9/v1",
    defaultModel: "gpt-test"
  });

  it("unwraps response.completed envelope from SSE payload", () => {
    const raw = [
      "event: response.created",
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}',
      "event: response.completed",
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"OK"}]}]}}',
      "data: [DONE]"
    ].join("\n");

    const parsed = (provider as unknown as { parseResponsesPayload: (payload: string) => Record<string, unknown> })
      .parseResponsesPayload(raw);
    const output = parsed.output as Array<Record<string, unknown>> | undefined;
    expect(Array.isArray(output)).toBe(true);
    expect((parsed as { status?: string }).status).toBe("completed");
  });

  it("prefers SSE frame with response payload over trailing event metadata", () => {
    const raw = [
      'data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"done"}]}]}}',
      'data: {"type":"response.done"}'
    ].join("\n");

    const parsed = (provider as unknown as { extractSseJson: (payload: string) => Record<string, unknown> | null })
      .extractSseJson(raw);
    expect(parsed).not.toBeNull();
    expect(Array.isArray((parsed as { output?: unknown }).output)).toBe(true);
  });
});
