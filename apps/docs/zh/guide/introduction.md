# NextClaw 介绍

**你的专属神级管家，兼容 OpenClaw，且以 UI 为先。**

NextClaw 是运行在你本机的专属神级管家。你可以通过 CLI 或即时通讯渠道（Telegram、Discord、WhatsApp、飞书等）与它对话，同时在你的控制下调度互联网资源与海量算力。Web UI 仅用于配置：设置默认模型、AI 提供商（API Key、端点）和消息渠道。一条命令启动，其余在浏览器里完成。

---

## 由来

受 [OpenClaw](https://github.com/openclaw/openclaw) 与 [nanobot](https://github.com/HKUDS/nanobot) 启发，NextClaw 在保留 OpenClaw 插件与渠道生态的同时，采用更小的代码库和以配置 UI 为核心的使用方式。代码量每日与 OpenClaw 对比（见 [code volume 指标](https://github.com/Peiiii/nextclaw/blob/master/docs/metrics/code-volume/comparison.json)）；NextClaw 约为 OpenClaw 的 3.84%（约 2.6 万行 vs 约 67.6 万行），「轻量」有据可查。

---

## 为什么选 NextClaw？

| 优势 | 说明 |
|------|------|
| **功能完整** | 多 Provider、多渠道、Cron/Heartbeat、网页搜索、执行命令、记忆、子 Agent 等与 OpenClaw 对齐。 |
| **OpenClaw 兼容** | 同一套插件 SDK 与渠道插件格式，现有 OpenClaw 渠道插件可直接使用。 |
| **上手简单** | 一条命令 `nextclaw start`，其余在浏览器里完成，无复杂 CLI 流程、无单独 daemon。 |
| **易维护** | 运行时能力集中在内置模块，减少隐式耦合，方便长期维护。 |
| **轻量** | 源于 nanobot，代码库小，运行与维护成本低。 |

**适合：** 快速试玩、备用机、想要「多渠道 + 多模型」但不想高维护成本的个人用户。

---

## 核心能力

### 一键启动与配置 UI

- `nextclaw start` — 后台启动网关 + 配置 UI（默认 http://127.0.0.1:18791，可绑定 0.0.0.0）。
- UI 负责：**Models**（默认模型与参数）、**Providers**（API Key、端点）、**Channels**（启用与凭证）。

### 多 Provider

OpenRouter、OpenAI、Anthropic、MiniMax、Moonshot、Gemini、DeepSeek、DashScope、智谱、Groq、vLLM、AiHubMix 等，任意 OpenAI 兼容端点可通过 `apiBase` + `apiKey` 使用。

### 多渠道

Telegram、Discord、Slack、飞书、钉钉、企业微信、WhatsApp、Email、QQ、Mochat 等，在 UI 中启用与配置。支持群组策略、@ 提及、白名单等（与 OpenClaw 对齐）。

### 自动化

- **Cron：** 一次性、cron 表达式或固定间隔；可选将结果投递到指定渠道。
- **Heartbeat：** 定期读取工作区 `HEARTBEAT.md`，由 Agent 执行其中任务。

### 内置工具

文件读写/编辑、列目录、`exec`、网页搜索、抓取 URL、发消息、spawn 子 Agent、会话列表/历史/发送、memory 检索、gateway 配置与运维、cron 管理等。

### 多 Agent 与路由

单进程多 Agent（`agents.list`），通过 `bindings` 按 channel + accountId（及可选 peer）路由到不同 agentId。会话隔离：`session.dmScope`（main / per-peer / per-channel-peer / per-account-channel-peer）。详见 [多 Agent 路由](/zh/guide/multi-agent)。

### 插件与 Skills

OpenClaw 格式插件（含渠道插件），可从本地或 npm 安装。Skills / ClawHub：`nextclaw skills install <slug>`；工作区 `skills/` 与 context 注入。详见 [配置](/zh/guide/configuration) 与 [命令](/zh/guide/commands)。

---

## 架构概览

- **单网关进程：** 渠道接入、路由、会话、Agent 池、工具与记忆同一进程，便于观测与重启。
- **配置：** `~/.nextclaw/config.json`。多数项（providers、channels、agents.defaults、context、tools）支持热更新，无需重启。
- **包结构：** `nextclaw`（CLI）、`nextclaw-core`（Agent 循环、Provider、内置工具、Cron、Session、Memory）、`nextclaw-server`（HTTP/WebSocket 与 UI、渠道对接）、`nextclaw-ui`（配置 UI）、`nextclaw-openclaw-compat`（插件 SDK）、`nextclaw-channel-runtime` 与 `nextclaw-channel-plugin-*`（渠道运行时与各渠道插件）。

---

## 快速开始

```bash
npm i -g nextclaw
nextclaw start
```

浏览器打开 **http://127.0.0.1:18791**，在 UI 里选择 Provider（如 OpenRouter）和模型即可。停止：`nextclaw stop`。

---

## 延伸阅读

- [快速开始](/zh/guide/getting-started) — 安装与首次运行
- [配置](/zh/guide/configuration) — Provider、模型、工作区
- [渠道](/zh/guide/channels) — 连接 Telegram、Discord、Slack 等
- [多 Agent 路由](/zh/guide/multi-agent) — bindings 与会话隔离
- [命令](/zh/guide/commands) — 完整 CLI 参考
- [GitHub](https://github.com/Peiiii/nextclaw) · [npm](https://www.npmjs.com/package/nextclaw)
