import type { NcpTool } from "@nextclaw/ncp";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDurationMs(args: unknown): number {
  const rawValue = isRecord(args) ? args.durationMs : undefined;
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return 1_000;
  }

  return Math.max(0, Math.min(10_000, Math.trunc(rawValue)));
}

export function createSleepTool(): NcpTool {
  return {
    name: "sleep",
    description: "Pauses for a short duration before continuing.",
    parameters: {
      type: "object",
      properties: {
        durationMs: {
          type: "integer",
          description: "How long to sleep in milliseconds. Max 10000.",
          minimum: 0,
          maximum: 10_000,
        },
      },
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<unknown> {
      const durationMs = normalizeDurationMs(args);
      const startedAt = new Date();
      await sleep(durationMs);

      return {
        durationMs,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
