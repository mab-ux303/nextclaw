import type { Context } from "hono";
import type { ChatSessionTypesView, UiNcpSessionListView, UiNcpSessionMessagesView } from "../types.js";
import { err, ok } from "./response.js";
import type { UiRouterOptions } from "./types.js";

function readPositiveInt(value: string | undefined): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export class NcpSessionRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly getSessionTypes = async (c: Context) => {
    const listSessionTypes = this.options.ncpAgent?.listSessionTypes;
    const payload: ChatSessionTypesView = listSessionTypes
      ? await listSessionTypes()
      : {
          defaultType: "native",
          options: [{ value: "native", label: "Native" }],
        };
    return c.json(ok(payload));
  };

  readonly listSessions = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessions = await sessionApi.listSessions({
      limit: readPositiveInt(c.req.query("limit")),
    });
    const payload: UiNcpSessionListView = {
      sessions,
      total: sessions.length,
    };
    return c.json(ok(payload));
  };

  readonly getSession = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const session = await sessionApi.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }
    return c.json(ok(session));
  };

  readonly listSessionMessages = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const session = await sessionApi.getSession(sessionId);
    if (!session) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    const messages = await sessionApi.listSessionMessages(sessionId, {
      limit: readPositiveInt(c.req.query("limit")),
    });
    const payload: UiNcpSessionMessagesView = {
      sessionId,
      messages,
      total: messages.length,
    };
    return c.json(ok(payload));
  };

  readonly deleteSession = async (c: Context) => {
    const sessionApi = this.options.ncpAgent?.sessionApi;
    if (!sessionApi) {
      return c.json(err("NOT_AVAILABLE", "ncp session api unavailable"), 503);
    }

    const sessionId = decodeURIComponent(c.req.param("sessionId"));
    const existing = await sessionApi.getSession(sessionId);
    if (!existing) {
      return c.json(err("NOT_FOUND", `ncp session not found: ${sessionId}`), 404);
    }

    await sessionApi.deleteSession(sessionId);
    this.options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok({ deleted: true, sessionId }));
  };
}
