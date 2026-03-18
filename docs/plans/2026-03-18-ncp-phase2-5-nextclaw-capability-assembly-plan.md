# NCP Phase 2.5：Nextclaw Capability Assembly Plan

## 背景

当前 NCP 并行链路已经完成了前后端通路、会话存储适配、共享展示层切换与基础 NCP runtime 接入，但在能力层面仍未达到可替换 legacy agent 的标准。

问题根因不是 NCP 协议或前端切换层，而是当前 UI NCP backend 的运行时装配过浅：

- 已有：`DefaultNcpAgentBackend` + `NextclawAgentSessionStore` + `ProviderManagerNcpLLMApi`
- 缺失：Nextclaw 原有 agent loop 中的工具体系、上下文体系、extension/gateway/session/memory/subagent 等能力装配

也就是说，当前链路更接近“通用 NCP agent backend + LLM provider”，而不是“装配了 Nextclaw 真实能力的 NCP backend”。

## 目标

本阶段的目标不是继续扩展前端，而是让 NCP backend 真正承载 Nextclaw agent 的核心能力，并达到以下结果：

1. NCP 新链路执行时复用 Nextclaw 当前真实 agent 能力，而不是裸 LLM loop。
2. 保持 NCP 协议、session store、前端链路与共享 UI 不变。
3. 避免复制一套 legacy agent 逻辑，优先做运行时桥接与事件适配。
4. 能在完成后重新切回 NCP 默认链路，并具备充分验证依据。

## 方案判断

存在两条路径：

1. 把 legacy `ToolRegistry + ContextBuilder + policy` 逐个适配进 `DefaultNcpAgentRuntime`
2. 直接让 UI NCP backend 调用现有 `GatewayAgentRuntimePool.processDirect()`，并把 `onAssistantDelta/onSessionEvent` 翻译为 NCP 事件

本方案选择路径 2，理由如下：

- 能力最完整：直接复用 Nextclaw 当前真实 engine / AgentLoop
- 风险最低：不需要重新复制或重写大量工具与上下文逻辑
- 交付最快：只新增一层 runtime adapter，不破坏 NCP backend/session store 结构
- 架构更干净：NCP 继续负责协议与前后端通路，Nextclaw 继续负责业务能力执行

## 目标架构

```text
NCP Client/UI
  -> NCP HTTP Agent Endpoint
  -> DefaultNcpAgentBackend
  -> NextclawUiNcpRuntime
  -> GatewayAgentRuntimePool.processDirect()
  -> NativeAgentEngine / AgentLoop / Extension Tools / Gateway / Memory / Sessions / Skills
```

职责划分：

- `DefaultNcpAgentBackend`
  - 继续负责 session lifecycle、abort、live stream、session API
- `NextclawAgentSessionStore`
  - 继续负责 NCP <-> legacy session persistence 映射
- `NextclawUiNcpRuntime`
  - 新增
  - 负责把 `processDirect()` 的 assistant delta 与 session event 转成 NCP event stream
- `GatewayAgentRuntimePool`
  - 继续负责真正的 Nextclaw agent 能力执行

## 实现拆分

### 1. Runtime Adapter

新增 `NextclawUiNcpRuntime`：

- 输入：`NcpAgentRunInput`
- 调用：`runtimePool.processDirect({ ... })`
- 监听：
  - `onAssistantDelta`
  - `onSessionEvent`
- 输出：
  - `run.started`
  - `message.text-*`
  - `message.reasoning-*`
  - `message.tool-call-*`
  - `run.finished`

关键约束：

- 整个 run 只维护一个 assistant `messageId`，避免状态管理器在多 messageId 下丢失 streaming message
- 工具调用与结果统一落到同一 assistant message 上
- 若 provider 未提供流式 delta，则在 `processDirect()` 返回后补发完整 text 事件

### 2. Metadata Mapping

继续保留 NCP metadata 协议，但 runtime adapter 要将以下字段传入 `processDirect()`：

- `model`
- `thinking`
- `session_type`
- `requested_skills`
- 其它 UI NCP metadata

默认 channel/chatId 统一使用 UI 会话语义，例如：

- `channel = "ui"`
- `chatId = "web-ui"`

`sessionKey` 直接使用 NCP `sessionId`，保持与 `NextclawAgentSessionStore` 一致。

### 3. createUiNcpAgent 重构

`create-ui-ncp-agent.ts` 从：

- `ProviderManagerNcpLLMApi + DefaultNcpAgentRuntime`

切换为：

- `NextclawUiNcpRuntime + DefaultNcpAgentBackend`

也就是说，UI NCP agent 不再自己实现一套空工具 registry，而是桥接到现有 Nextclaw runtime pool。

### 4. 验证与切换

完成后必须验证：

1. NCP 路径可调用真实 Nextclaw tool/session/memory 等能力
2. `stop` / abort 仍可用
3. session list / delete / message history 保持可读可写
4. 再将默认链路切回 NCP

## 非目标

本阶段不做：

- 删除 legacy 链路
- 大规模重构 `AgentLoop`
- 将所有 legacy session event 完整映射为细粒度 NCP reasoning semantics
- 将 NCP runtime 通用包改造成承载 Nextclaw 业务逻辑

## 验收标准

1. NCP UI backend 执行的是真实 Nextclaw runtime，而不是空 `DefaultNcpToolRegistry`
2. 通过 NCP 链路能触发 Nextclaw tools / skills / session / memory / extension 能力
3. NCP 前端聊天链路可发送、流式回复、停止、切会话、删会话
4. 默认链路可重新切回 NCP 并完成构建与冒烟验证
