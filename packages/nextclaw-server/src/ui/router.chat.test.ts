import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-chat-router-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
});

function parseSseEvents(payload: string): Array<{ event: string; data: string }> {
  return payload
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event: "));
      const dataLines = lines.filter((line) => line.startsWith("data: "));
      return {
        event: eventLine ? eventLine.slice("event: ".length).trim() : "message",
        data: dataLines.map((line) => line.slice("data: ".length)).join("\n")
      };
    });
}

describe("chat turn route", () => {
  it("returns 503 when chat runtime is not configured", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/chat/turn", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: "hello"
      })
    });

    expect(response.status).toBe(503);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_AVAILABLE");
  });

  it("returns chat capabilities from runtime", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const getCapabilities = vi.fn(async () => ({
      stopSupported: false,
      stopReason: "engine does not support stop"
    }));
    const app = createUiRouter({
      configPath,
      publish: () => {},
      chatRuntime: {
        processTurn: vi.fn(async () => ({
          reply: "ok",
          sessionKey: "agent:main:ui:direct:web-test"
        })),
        getCapabilities
      }
    });

    const response = await app.request("http://localhost/api/chat/capabilities?agentId=main&sessionKey=agent:main:ui:test", {
      method: "GET"
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        stopSupported: boolean;
        stopReason?: string;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.stopSupported).toBe(false);
    expect(payload.data.stopReason).toContain("support");
    expect(getCapabilities).toHaveBeenCalledWith({
      agentId: "main",
      sessionKey: "agent:main:ui:test"
    });
  });

  it("returns 400 when message is missing", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {},
      chatRuntime: {
        processTurn: vi.fn(async () => ({
          reply: "ok",
          sessionKey: "agent:main:ui:direct:web-test"
        }))
      }
    });

    const response = await app.request("http://localhost/api/chat/turn", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("INVALID_BODY");
  });

  it("stops a running chat turn when stop endpoint is called", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const stopTurn = vi.fn(async () => ({
      stopped: true,
      runId: "run-test",
      sessionKey: "agent:main:ui:direct:web-123"
    }));
    const app = createUiRouter({
      configPath,
      publish: () => {},
      chatRuntime: {
        processTurn: vi.fn(async () => ({
          reply: "ok",
          sessionKey: "agent:main:ui:direct:web-123"
        })),
        stopTurn
      }
    });

    const response = await app.request("http://localhost/api/chat/turn/stop", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        runId: "run-test",
        sessionKey: "agent:main:ui:direct:web-123",
        agentId: "main"
      })
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        stopped: boolean;
        runId: string;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.stopped).toBe(true);
    expect(payload.data.runId).toBe("run-test");
    expect(stopTurn).toHaveBeenCalledWith({
      runId: "run-test",
      sessionKey: "agent:main:ui:direct:web-123",
      agentId: "main"
    });
  });

  it("calls runtime and returns normalized chat turn response", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const publish = vi.fn();
    const processTurn = vi.fn(async () => ({
      reply: "world",
      sessionKey: "agent:engineer:ui:direct:web-123",
      agentId: "engineer",
      model: "openai/gpt-5"
    }));

    const app = createUiRouter({
      configPath,
      publish,
      chatRuntime: {
        processTurn
      }
    });

    const response = await app.request("http://localhost/api/chat/turn", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: "hello",
        sessionKey: "agent:engineer:ui:direct:web-123",
        agentId: "engineer",
        model: "openai/gpt-5"
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        reply: string;
        sessionKey: string;
        agentId?: string;
        model?: string;
        durationMs: number;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.reply).toBe("world");
    expect(payload.data.sessionKey).toBe("agent:engineer:ui:direct:web-123");
    expect(payload.data.agentId).toBe("engineer");
    expect(payload.data.model).toBe("openai/gpt-5");
    expect(payload.data.durationMs).toBeGreaterThanOrEqual(0);

    expect(processTurn).toHaveBeenCalledTimes(1);
    expect(processTurn).toHaveBeenCalledWith({
      message: "hello",
      sessionKey: "agent:engineer:ui:direct:web-123",
      channel: "ui",
      chatId: "web-ui",
      agentId: "engineer",
      model: "openai/gpt-5"
    });

    expect(publish).toHaveBeenCalledWith({
      type: "config.updated",
      payload: {
        path: "session"
      }
    });
  });

  it("returns 503 for stream route when chat runtime is not configured", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);

    const app = createUiRouter({
      configPath,
      publish: () => {}
    });

    const response = await app.request("http://localhost/api/chat/turn/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: "hello"
      })
    });

    expect(response.status).toBe(503);
    const payload = await response.json() as {
      ok: boolean;
      error: {
        code: string;
      };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_AVAILABLE");
  });

  it("streams delta and final events for chat turn stream route", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const publish = vi.fn();
    const processTurn = vi.fn(async () => ({
      reply: "fallback",
      sessionKey: "agent:engineer:ui:direct:web-123"
    }));
    const processTurnStream = vi.fn(async function* () {
      yield { type: "delta", delta: "hel" } as const;
      yield { type: "delta", delta: "lo" } as const;
      yield {
        type: "final",
        result: {
          reply: "hello",
          sessionKey: "agent:engineer:ui:direct:web-123",
          agentId: "engineer",
          model: "openai/gpt-5"
        }
      } as const;
    });

    const app = createUiRouter({
      configPath,
      publish,
      chatRuntime: {
        processTurn,
        processTurnStream
      }
    });

    const response = await app.request("http://localhost/api/chat/turn/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        message: "hello",
        sessionKey: "agent:engineer:ui:direct:web-123",
        agentId: "engineer",
        model: "openai/gpt-5"
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const rawPayload = await response.text();
    const events = parseSseEvents(rawPayload);
    const eventNames = events.map((event) => event.event);
    expect(eventNames).toContain("ready");
    expect(eventNames).toContain("delta");
    expect(eventNames).toContain("final");
    expect(eventNames).toContain("done");
    expect(events.filter((event) => event.event === "delta").map((event) => JSON.parse(event.data).delta)).toEqual([
      "hel",
      "lo"
    ]);
    const readyEvent = events.find((event) => event.event === "ready");
    expect(readyEvent).toBeTruthy();
    const readyData = JSON.parse(readyEvent!.data) as {
      runId?: string;
      stopSupported?: boolean;
    };
    expect(typeof readyData.runId).toBe("string");
    expect(readyData.stopSupported).toBe(false);

    const finalEvent = events.find((event) => event.event === "final");
    expect(finalEvent).toBeTruthy();
    const finalData = JSON.parse(finalEvent!.data) as {
      reply: string;
      sessionKey: string;
      agentId?: string;
      model?: string;
    };
    expect(finalData.reply).toBe("hello");
    expect(finalData.sessionKey).toBe("agent:engineer:ui:direct:web-123");
    expect(finalData.agentId).toBe("engineer");
    expect(finalData.model).toBe("openai/gpt-5");

    expect(processTurnStream).toHaveBeenCalledTimes(1);
    expect(processTurnStream).toHaveBeenCalledWith(expect.objectContaining({
      runId: expect.any(String)
    }));
    expect(processTurn).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith({
      type: "config.updated",
      payload: {
        path: "session"
      }
    });
  });

  it("lists and queries managed chat runs", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const run = {
      runId: "run-managed-1",
      sessionKey: "agent:engineer:ui:direct:web-123",
      agentId: "engineer",
      model: "openai/gpt-5",
      state: "running" as const,
      requestedAt: "2026-03-05T00:00:00.000Z",
      startedAt: "2026-03-05T00:00:01.000Z",
      stopSupported: true,
      eventCount: 1
    };
    const listRuns = vi.fn(async () => ({
      runs: [run],
      total: 1
    }));
    const getRun = vi.fn(async ({ runId }: { runId: string }) => (runId === run.runId ? run : null));

    const app = createUiRouter({
      configPath,
      publish: () => {},
      chatRuntime: {
        processTurn: vi.fn(async () => ({
          reply: "ok",
          sessionKey: run.sessionKey
        })),
        listRuns,
        getRun
      }
    });

    const listResponse = await app.request(
      `http://localhost/api/chat/runs?sessionKey=${encodeURIComponent(run.sessionKey)}&states=queued,running`
    );
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json() as {
      ok: boolean;
      data: {
        total: number;
        runs: Array<{ runId: string; state: string }>;
      };
    };
    expect(listPayload.ok).toBe(true);
    expect(listPayload.data.total).toBe(1);
    expect(listPayload.data.runs[0]?.runId).toBe(run.runId);
    expect(listPayload.data.runs[0]?.state).toBe("running");
    expect(listRuns).toHaveBeenCalledWith({
      sessionKey: run.sessionKey,
      states: ["queued", "running"]
    });

    const detailResponse = await app.request(`http://localhost/api/chat/runs/${run.runId}`);
    expect(detailResponse.status).toBe(200);
    const detailPayload = await detailResponse.json() as {
      ok: boolean;
      data: { runId: string; sessionKey: string };
    };
    expect(detailPayload.ok).toBe(true);
    expect(detailPayload.data.runId).toBe(run.runId);
    expect(detailPayload.data.sessionKey).toBe(run.sessionKey);
    expect(getRun).toHaveBeenCalledWith({ runId: run.runId });
  });

  it("streams managed run by runId for reconnect", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const run = {
      runId: "run-managed-2",
      sessionKey: "agent:engineer:ui:direct:web-456",
      agentId: "engineer",
      model: "openai/gpt-5",
      state: "completed" as const,
      requestedAt: "2026-03-05T01:00:00.000Z",
      startedAt: "2026-03-05T01:00:01.000Z",
      completedAt: "2026-03-05T01:00:03.000Z",
      stopSupported: true,
      eventCount: 2,
      reply: "hello"
    };
    const getRun = vi.fn(async ({ runId }: { runId: string }) => (runId === run.runId ? run : null));
    const streamRun = vi.fn(async function* () {
      yield { type: "delta", delta: "hel" } as const;
      yield {
        type: "final",
        result: {
          reply: "hello",
          sessionKey: run.sessionKey,
          agentId: run.agentId,
          model: run.model
        }
      } as const;
    });

    const app = createUiRouter({
      configPath,
      publish: () => {},
      chatRuntime: {
        processTurn: vi.fn(async () => ({
          reply: "ok",
          sessionKey: run.sessionKey
        })),
        getRun,
        streamRun
      }
    });

    const response = await app.request(
      `http://localhost/api/chat/runs/${run.runId}/stream?fromEventIndex=0`,
      { method: "GET" }
    );
    expect(response.status).toBe(200);
    const payload = await response.text();
    const events = parseSseEvents(payload);
    const names = events.map((event) => event.event);
    expect(names).toContain("ready");
    expect(names).toContain("delta");
    expect(names).toContain("final");
    expect(names).toContain("done");
    expect(streamRun).toHaveBeenCalledWith({ runId: run.runId, fromEventIndex: 0 });
  });
});
