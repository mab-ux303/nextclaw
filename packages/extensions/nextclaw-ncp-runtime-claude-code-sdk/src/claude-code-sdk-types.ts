import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
} from "@nextclaw/ncp";

export type ClaudeCodeMessage = {
  type?: string;
  subtype?: string;
  session_id?: string;
  message?: {
    content?: unknown;
  };
  event?: unknown;
  result?: unknown;
  errors?: unknown;
  error?: unknown;
};

export type ClaudeCodeQuery = AsyncIterable<ClaudeCodeMessage> & {
  close?: () => void;
};

export type ClaudeCodeQueryOptions = {
  abortController?: AbortController;
  cwd?: string;
  model?: string;
  env?: Record<string, string | undefined>;
  resume?: string;
  [key: string]: unknown;
};

export type ClaudeCodeSdkModule = {
  query: (params: {
    prompt: string;
    options?: ClaudeCodeQueryOptions;
  }) => ClaudeCodeQuery;
};

export type TextStreamState = {
  emittedText: string;
  textStarted: boolean;
};

export type ClaudeCodeLoader = {
  loadClaudeCodeSdkModule: () => Promise<ClaudeCodeSdkModule>;
};

export type ClaudeCodeSdkNcpAgentRuntimeConfig = {
  sessionId: string;
  apiKey: string;
  apiBase?: string;
  model?: string;
  workingDirectory: string;
  sessionRuntimeId?: string | null;
  env?: Record<string, string>;
  baseQueryOptions?: Record<string, unknown>;
  requestTimeoutMs?: number;
  sessionMetadata?: Record<string, unknown>;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<string> | string;
  stateManager?: NcpAgentConversationStateManager;
};
