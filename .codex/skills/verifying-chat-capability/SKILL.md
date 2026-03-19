---
name: verifying-chat-capability
description: Use when checking whether a running NextClaw service can produce real assistant output for a specific session type and model, especially after runtime, plugin, provider, or model-routing changes
---

# Verifying Chat Capability

## Overview

Use the reusable smoke command instead of ad-hoc curl or UI clicking when validating NCP chat capability.

## When to Use

- A session type such as `native`, `codex`, or another plugin runtime may be broken.
- A model/provider change might only fail on a specific route.
- You need a quick non-unit validation against a running local service.

## Command

```bash
pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792
```

## Quick Reference

```bash
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --port 18792
pnpm smoke:ncp-chat -- --session-type native --model openai/gpt-5.3-codex --base-url http://127.0.0.1:18792
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --prompt "Reply exactly OK" --json
```

## Success Criteria

- Exit code is `0`
- Output shows `Result: PASS`
- `Assistant Text` is non-empty
- No `run.error` or `message.failed`

## Common Mistakes

- Testing the wrong port: `pnpm dev start` usually serves API on `18792` in this repo.
- Forgetting `--session-type`: the smoke should target the exact runtime under investigation.
- Treating native success as codex success: run both explicitly when debugging runtime-specific issues.
