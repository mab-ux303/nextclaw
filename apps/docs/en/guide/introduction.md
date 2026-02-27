# Introduction to NextClaw

**Your omnipotent personal assistant, OpenClaw-compatible and UI-first.**

NextClaw is your omnipotent personal assistant running locally. You talk to it via the CLI or through messaging channels (Telegram, Discord, WhatsApp, Feishu, and more), while it orchestrates internet resources and raw compute under your control. The web UI is for configuration only: set your default model, AI providers (API keys, base URLs), and message channels. One command, then configure everything in the browser.

---

## Origins

Inspired by [OpenClaw](https://github.com/openclaw/openclaw) and [nanobot](https://github.com/HKUDS/nanobot), NextClaw keeps OpenClaw’s plugin and channel ecosystem while using a smaller codebase and a UI-first workflow. Code size is tracked daily against OpenClaw (see [code volume metrics](https://github.com/Peiiii/nextclaw/blob/master/docs/metrics/code-volume/comparison.json)); NextClaw is roughly 3.84% of OpenClaw’s codebase (about 26k vs 676k lines), so “lightweight” is measurable.

---

## Why NextClaw?

| Advantage | Description |
|-----------|-------------|
| **Feature-rich** | Multi-provider, multi-channel, cron/heartbeat, web search, exec, memory, subagents — aligned with OpenClaw where it matters. |
| **OpenClaw compatible** | Same plugin SDK and channel plugin format; built-in channel plugins (Telegram, Discord, WhatsApp, etc.) are OpenClaw-style and configurable the same way. |
| **Easier to use** | One command (`nextclaw start`), then configure everything in the built-in UI. No complex CLI workflows or separate daemon. |
| **Maintainable** | Runtime capabilities stay focused on built-ins, reducing hidden coupling and long-term maintenance cost. |
| **Lightweight** | Evolved from nanobot; minimal codebase, fast to run and maintain. |

**Best for:** quick trials, secondary machines, or anyone who wants multi-channel and multi-provider with low maintenance overhead.

---

## Core Capabilities

### One-command start and config UI

- `nextclaw start` — background gateway + config UI (default: http://127.0.0.1:18791, bindable to 0.0.0.0).
- UI tabs: **Models** (default model and parameters), **Providers** (API keys and endpoints), **Channels** (enable and set credentials).

### Multi-provider

OpenRouter, OpenAI, Anthropic, MiniMax, Moonshot, Gemini, DeepSeek, DashScope, Zhipu, Groq, vLLM, AiHubMix, and any OpenAI-compatible endpoint via `apiBase` and `apiKey`.

### Multi-channel

Telegram, Discord, Slack, Feishu, DingTalk, WeCom, WhatsApp, Email, QQ, Mochat — enable and configure from the UI. Group policies, mentions, and allowlists are supported (OpenClaw-aligned).

### Automation

- **Cron:** one-shot, cron expression, or fixed interval; optional delivery to a channel.
- **Heartbeat:** periodic read of workspace `HEARTBEAT.md` with tasks executed by the agent.

### Built-in tools

File read/write/edit, list directory, `exec`, web search, web fetch, send message, spawn subagent, session list/history/send, memory search, gateway config and ops, cron management, and more.

### Multi-agent and routing

Single process, multiple agents (`agents.list`). Route by channel + accountId (and optionally peer) via `bindings` to different `agentId`. Session isolation with `session.dmScope` (main, per-peer, per-channel-peer, per-account-channel-peer). See [Multi-Agent Routing](/en/guide/multi-agent).

### Plugins and Skills

OpenClaw-format plugins (including channel plugins) from local paths or npm. Skills from ClawHub: `nextclaw skills install <slug>`; workspace `skills/` and context injection. See [Configuration](/en/guide/configuration) and [Commands](/en/guide/commands).

---

## Architecture (high level)

- **Single gateway process:** channel ingress, routing, sessions, agent pool, tools, and memory in one process for simpler observability and restart.
- **Config:** `~/.nextclaw/config.json`. Many keys (providers, channels, agents.defaults, context, tools) hot-reload without restart.
- **Packages:** `nextclaw` (CLI), `nextclaw-core` (agent loop, providers, tools, cron, session, memory), `nextclaw-server` (HTTP/WebSocket for UI and channels), `nextclaw-ui` (config UI), `nextclaw-openclaw-compat` (plugin SDK), `nextclaw-channel-runtime` and `nextclaw-channel-plugin-*` (channel runtime and plugins).

---

## Quick start

```bash
npm i -g nextclaw
nextclaw start
```

Open **http://127.0.0.1:18791** in your browser and set a provider (e.g. OpenRouter) and model. Stop with `nextclaw stop`.

---

## Learn more

- [Quick Start](/en/guide/getting-started) — Install and first run
- [Configuration](/en/guide/configuration) — Providers, models, workspace
- [Channels](/en/guide/channels) — Connect Telegram, Discord, Slack, and more
- [Multi-Agent Routing](/en/guide/multi-agent) — Bindings and session isolation
- [Commands](/en/guide/commands) — Full CLI reference
- [GitHub](https://github.com/Peiiii/nextclaw) · [npm](https://www.npmjs.com/package/nextclaw)
