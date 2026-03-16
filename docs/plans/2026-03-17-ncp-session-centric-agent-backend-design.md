# NCP Session-Centric Agent Backend Design

## Goal

Refactor `DefaultNcpAgentBackend` from a run-centric backend into a session-centric backend.

Target properties:

- A session can have at most one active execution at a time.
- Streaming is live-only and session-scoped.
- No persisted run event log.
- No run-level store or controller registry.
- Session persistence keeps conversation history only.

This design matches the product assumption that upper layers care about the current live reply of a session, not historical run replay.

## Non-goals

- No reconnect-and-catch-up event replay.
- No support for attaching to an already-finished run.
- No cross-process active execution recovery after backend restart.
- No multi-run concurrency within one session.

## Current Problems

The current backend mixes two different models:

- `send()` is a live execution path.
- `stream()` is a stored-event read path.

That split forces the backend to maintain `AgentRunStore`, `RunControllerRegistry`, `activeRunId`, and run-level lookup semantics, even though the desired product behavior is "stream the current session response now".

As a result:

- Backend complexity is higher than needed.
- Interface naming becomes awkward because store APIs are carrying both persistence and protocol lookup responsibilities.
- Product semantics and protocol semantics are drifting apart.

## Proposed Architecture

### 1. Keep `AgentSessionStore`

`AgentSessionStore` remains the only persistence abstraction.

Persisted data:

- `sessionId`
- `messages`
- `updatedAt`

Removed from persistence:

- `activeRunId`

After a process restart, every restored session is considered idle. Only finalized message history is restored.

### 2. Remove run persistence and run controller abstractions

Delete these backend-level concepts:

- `AgentRunStore`
- `RunRecord`
- `RunControllerRegistry`

Run is no longer a persisted backend concept. It may still appear inside emitted NCP events if runtime emits `runId`, but backend does not store or manage runs as first-class persisted records.

### 3. Move live execution state into `LiveSessionState`

Extend `LiveSessionState` with an in-memory execution object:

```ts
type LiveSessionExecution = {
  controller: AbortController;
  requestMessageId: string;
  correlationId?: string;
  publisher: EventPublisher;
  closed: boolean;
};

type LiveSessionState = {
  sessionId: string;
  runtime: NcpAgentRuntime;
  stateManager: NcpAgentConversationStateManager;
  activeExecution: LiveSessionExecution | null;
};
```

This makes execution ownership explicit: the live execution belongs to the session, not to a separate run store.

### 4. `send()` becomes the single source of live execution

`DefaultNcpAgentBackend.send()` behavior:

1. Load or create `LiveSessionState`.
2. Reject the request if `activeExecution` already exists.
3. Create a new `AbortController`.
4. Create a per-session live publisher for stream subscribers.
5. Run the runtime and, for each emitted event:
   - dispatch it into `stateManager`
   - publish it to the backend-wide publisher
   - publish it to the session live publisher
   - persist the session snapshot
6. On finish, error, or abort:
   - close the session live publisher
   - set `activeExecution = null`
   - persist the final session snapshot

This gives one clear truth: session execution is live while the runtime is running, and gone when it ends.

### 5. `stream()` becomes session-scoped live subscription

`stream()` should no longer read from persistence.

New semantic shape:

```ts
stream({
  sessionId,
  signal,
}): AsyncIterable<NcpEndpointEvent>
```

Behavior:

- If the session has an active execution, subscribe to its live publisher.
- If the session has no active execution, end immediately.
- A subscriber only receives events emitted after subscription starts.
- No historical events are replayed.

This is intentionally "watch the current live output", not "read the stored history of a run".

### 6. `abort()` becomes session-scoped

`abort()` should target the current active execution of a session:

```ts
abort({ sessionId }): Promise<void>
```

Behavior:

- Find the live session by `sessionId`.
- If there is no active execution, do nothing.
- If there is an active execution, abort its controller.

No run lookup by `runId`, `messageId`, or `correlationId` is needed in the backend layer anymore.

## Type Changes

### `AgentSessionRecord`

Before:

```ts
type AgentSessionRecord = {
  sessionId: string;
  messages: NcpMessage[];
  activeRunId: string | null;
  updatedAt: string;
};
```

After:

```ts
type AgentSessionRecord = {
  sessionId: string;
  messages: NcpMessage[];
  updatedAt: string;
};
```

### `NcpSessionSummary`

Keep:

- `sessionId`
- `messageCount`
- `updatedAt`
- `status`

Remove:

- `activeRunId`

Status is derived from whether `LiveSessionState.activeExecution` exists in the current process.

## Protocol Changes

This design is a protocol-level breaking change, not just a backend refactor.

### `NcpStreamRequestPayload`

Before:

```ts
type NcpStreamRequestPayload = {
  sessionId: string;
  runId: string;
  fromEventIndex?: number;
  metadata?: Record<string, unknown>;
};
```

After:

```ts
type NcpStreamRequestPayload = {
  sessionId: string;
  metadata?: Record<string, unknown>;
};
```

### `NcpMessageAbortPayload`

Recommended shape:

```ts
type NcpMessageAbortPayload = {
  sessionId: string;
};
```

### Manifest capability

Replace `supportsRunStream` with a session-scoped capability, for example:

```ts
supportsLiveSessionStream: boolean;
```

This is more honest than saying the endpoint supports streaming an existing run by `runId`.

## Required Code Changes

### `@nextclaw/ncp`

- Update `NcpStreamRequestPayload`
- Update `NcpMessageAbortPayload`
- Update `NcpSessionSummary`
- Update manifest capability field and docs

### `@nextclaw/ncp-toolkit`

- Remove `AgentRunStore`
- Remove `RunRecord`
- Remove `RunControllerRegistry`
- Update `AgentSessionRecord`
- Extend `LiveSessionState` with `activeExecution`
- Update `AgentLiveSessionRegistry`
- Refactor `DefaultNcpAgentBackend`
- Simplify or inline `AgentRunExecutor`
- Update tests that currently assume run-store-backed streaming

### `@nextclaw/ncp-http-agent-server`

- Update `/stream` semantics from run-based reading to live session subscription
- Remove stored-stream wording from docs and types
- Ensure SSE closes cleanly when active session execution ends

### `apps/ncp-demo/backend`

- Delete file-based run store
- Keep file-based session store
- Update backend wiring to inject only `sessionStore`

### `apps/ncp-demo/frontend`

- Stop depending on `activeRunId`
- Use session status plus `sessionId` for live stream attachment

## Runtime Behavior

### Session lifecycle

- Idle session: persisted messages exist, `activeExecution = null`
- Running session: runtime is producing events, `activeExecution != null`
- Finished session: messages persisted, `activeExecution = null`

### Restart behavior

On restart:

- historical messages are restored from `sessionStore`
- no active execution is restored
- session status becomes idle

This is acceptable because the target model explicitly does not support persistent live stream recovery.

## Validation Plan

1. Send a message for a fresh session and verify live streaming still works.
2. Start a second request in the same session while one is active and verify it is rejected.
3. Subscribe to `stream(sessionId)` mid-run and verify only subsequent events are received.
4. Abort by `sessionId` and verify the active execution stops.
5. Restart backend and verify message history remains but live execution does not.
6. Delete session and verify persisted messages and in-memory execution state are both cleared.

## Risks

1. This is a breaking protocol change for any client that uses `runId`-based stream attachment.
2. Reconnect-after-disconnect no longer gives missed events.
3. Multi-observer historical attachment is no longer supported.
4. If product later needs run replay, run-level storage will have to be reintroduced.

## Recommendation

Proceed with a clean break instead of a compatibility bridge.

Why:

- The desired product semantics are already session-centric.
- A half-compatible design would keep `runId`-shaped protocol and state baggage around.
- A clean break produces a much smaller and more honest backend model.

Recommended implementation order:

1. Update protocol types in `@nextclaw/ncp`
2. Refactor `@nextclaw/ncp-toolkit` backend internals
3. Update HTTP agent server
4. Update demo backend and frontend
5. Run end-to-end smoke tests for session send, stream, abort, restart, and delete
