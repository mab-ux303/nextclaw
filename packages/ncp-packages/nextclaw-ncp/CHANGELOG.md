# @nextclaw/ncp

## 0.2.0

### Minor Changes

- Refactor the NCP agent backend stack from run-centric semantics to session-centric live execution.
  - Replace run-based stream and abort payloads with `sessionId`-based live session APIs.
  - Rename the manifest capability from `supportsRunStream` to `supportsLiveSessionStream`.
  - Remove run-store/controller abstractions from `@nextclaw/ncp-toolkit` and move active execution ownership into the live session registry.
  - Align the HTTP client/server transports and React hooks with live session streaming.
  - Update `ncp-demo` to use the session-centric backend, add a `sleep` tool, and remove mock LLM mode.

## 0.1.1

### Patch Changes

- Expose the new NCP agent runtime/backend type exports and session delete API, and add the docs entry under Settings in the main chat sidebar.

## 0.1.0

- Bootstrap package skeleton with NCP protocol types and endpoint base abstractions.
