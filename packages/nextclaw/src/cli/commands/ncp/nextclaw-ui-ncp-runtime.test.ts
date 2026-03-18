import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { NextclawUiNcpRuntime } from "./nextclaw-ui-ncp-runtime.js";

function createSessionEvent(message: Record<string, unknown>, seq: number): SessionEvent {
  return {
    seq,
    type: "message",
    timestamp: "2026-03-18T00:00:00.000Z",
    data: {
      message,
    },
  };
}

async function collectEvents(events: AsyncIterable<NcpEndpointEvent>): Promise<NcpEndpointEvent[]> {
  const output: NcpEndpointEvent[] = [];
  for await (const event of events) {
    output.push(event);
  }
  return output;
}

describe("NextclawUiNcpRuntime", () => {
  it("bridges assistant deltas, tool events, and final completion into NCP events", async () => {
    const runtime = new NextclawUiNcpRuntime({
      async processDirect(params) {
        params.onAssistantDelta?.("Checking ");
        params.onAssistantDelta?.("workspace");
        params.onSessionEvent?.(
          createSessionEvent(
            {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: "{\"path\":\"README.md\"}",
                  },
                },
              ],
            },
            1,
          ),
        );
        params.onSessionEvent?.(
          createSessionEvent(
            {
              role: "tool",
              tool_call_id: "call-1",
              name: "read_file",
              content: "file-content",
            },
            2,
          ),
        );
        params.onSessionEvent?.(
          createSessionEvent(
            {
              role: "assistant",
              content: "Done",
            },
            3,
          ),
        );
        return "Done";
      },
    });

    const events = await collectEvents(
      runtime.run({
        sessionId: "session-1",
        messages: [
          {
            id: "user-1",
            sessionId: "session-1",
            role: "user",
            status: "final",
            timestamp: "2026-03-18T00:00:00.000Z",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
    );

    expect(events[0]?.type).toBe(NcpEventType.RunStarted);
    expect(events.some((event) => event.type === NcpEventType.MessageTextStart)).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === NcpEventType.MessageToolCallStart &&
          event.payload.toolName === "read_file",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === NcpEventType.MessageToolCallResult &&
          event.payload.toolCallId === "call-1",
      ),
    ).toBe(true);
    expect(events[events.length - 1]?.type).toBe(NcpEventType.RunFinished);
  });

  it("falls back to final reply text when provider emits no assistant deltas or assistant session text", async () => {
    const runtime = new NextclawUiNcpRuntime({
      async processDirect() {
        return "Fallback answer";
      },
    });

    const events = await collectEvents(
      runtime.run({
        sessionId: "session-2",
        messages: [
          {
            id: "user-1",
            sessionId: "session-2",
            role: "user",
            status: "final",
            timestamp: "2026-03-18T00:00:00.000Z",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
    );

    expect(
      events.some(
        (event) =>
          event.type === NcpEventType.MessageTextDelta &&
          event.payload.delta === "Fallback answer",
      ),
    ).toBe(true);
  });
});
