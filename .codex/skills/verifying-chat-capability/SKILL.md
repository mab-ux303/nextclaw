---
name: smoke-testing-ncp-chat
description: Use when a running NextClaw service needs a quick real-reply check for a specific NCP session type and model
---

# Smoke Testing NCP Chat

## Overview

Use the reusable smoke command instead of ad-hoc `curl` or UI clicking when a fast real-reply check is needed.

This smoke command:

- Sends one real chat message to a running NextClaw service
- Forces the request through the specified `session-type` and `model`
- Reads the returned SSE event stream
- Prints pass/fail, assistant text, terminal event, and error details
- Exits non-zero when the route does not produce a real assistant reply

## When to Use

- A quick check is needed to confirm that one concrete chat route can return a real assistant reply.
- A specific `session-type + model` pair needs to be validated without opening the UI.
- A fast smoke is preferred over ad-hoc request assembly.

## Command

```bash
pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792
```

## Quick Reference

```bash
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --port 18792
pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.5 --port 18794
pnpm smoke:ncp-chat -- --session-type native --model openai/gpt-5.3-codex --base-url http://127.0.0.1:18792
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --prompt "Reply exactly OK" --json
```

## Success Criteria

- Exit code is `0`
- Output shows `Result: PASS`
- `Assistant Text` is non-empty
- No `run.error` or `message.failed`

When `--json` is used, the key checks are:

- `ok: true`
- `assistantText` is non-empty
- `terminalEvent` is usually `run.finished`

## Common Mistakes

- Testing the wrong port: `pnpm dev start` usually serves API on `18792` in this repo.
- Forgetting `--session-type`: the smoke should target the exact runtime under investigation.
- Treating one runtime as proof for another runtime: `native`, `codex`, and `claude` should be checked explicitly.
