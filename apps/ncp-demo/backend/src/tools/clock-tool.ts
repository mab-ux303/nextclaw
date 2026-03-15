import type { NcpTool } from "@nextclaw/ncp";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createClockTool(): NcpTool {
  return {
    name: "get_current_time",
    description: "Returns local time for a timezone.",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone string, e.g. Asia/Shanghai.",
        },
      },
      required: ["timezone"],
      additionalProperties: false,
    },
    async execute(args: unknown): Promise<unknown> {
      const timezone =
        isRecord(args) && typeof args.timezone === "string" && args.timezone.trim().length > 0
          ? args.timezone
          : "UTC";
      const date = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour12: false,
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return {
        timezone,
        iso: date.toISOString(),
        local: formatter.format(date),
      };
    },
  };
}
