# Claude Code SDK NCP Runtime Plan

## 背景

我们已经有一条完整可工作的 `Codex SDK -> NCP runtime -> 插件 -> marketplace` 闭环。

这次要做的不是继续往旧的 engine 体系里塞 Anthropic 能力，而是复用这条已经验证成立的插件化 runtime 结构，把 Claude 接入成真正的 NCP runtime 插件。

截至 2026-03-19，Anthropic 官方 TypeScript/Node 包已经是 `@anthropic-ai/claude-code`，官方文档入口也已迁移到 Agent SDK 文档体系。因此：

- 方案口径上继续接受“Claude Code SDK 接入”这个需求表述
- 实现上直接对齐当前官方 `@anthropic-ai/claude-code`
- 不复用仓库里旧的 `@anthropic-ai/claude-agent-sdk` engine 插件结构

## 目标

1. 新增一条可插拔的 `Claude` NCP runtime。
2. 让用户安装插件后，可以在标准 NextClaw NCP 聊天入口创建 `Claude` 会话。
3. 保持默认 `native` runtime 不变，不把 Claude SDK 绑进主包主链路。
4. 完成 marketplace 可发现、可安装、可验证的正式闭环。

## 非目标

- 不把 Claude 继续做成 legacy engine-only 能力。
- 不为 Claude 单独做专属页面或专属聊天 UI。
- 不为了兼容旧 engine 插件而维持双入口双主链路。

## 设计决策

### 1. 继续沿用 Codex 的双层结构

新增两层包：

- `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`
  - 纯 runtime 适配层
  - 只负责把 Anthropic SDK 事件流映射为 NCP 事件
- `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
  - 插件包装层
  - 负责读取 NextClaw 配置、注册 runtime kind、拼接 skills prompt、暴露 plugin schema

这和 Codex 的结构保持完全一致，后续更多 runtime 继续按同一模式复制即可。

### 2. runtime kind 采用 `claude`

用户可见会话类型使用 `Claude`，runtime kind 使用 `claude`，避免把 SDK/实现细节直接暴露到会话建模层。

会话 metadata 里额外持久化：

- `session_type = "claude"`
- `claude_session_id = <sdk session id>`

这样刷新和重进后，可以继续复用同一个 Claude 会话。

### 3. Claude 相关实现只留在插件包内

主包只认“有一个插件注册了某个 runtime kind”，不感知 Claude 特例。也就是说：

- `createUiNcpAgent`
- `/api/ncp/session-types`
- 前端会话类型列表

全部继续走通用 registry，不新增 `if claude` 分支。

## 运行链路

```text
用户创建 Claude 会话
  -> session type = claude
  -> registry 根据 kind 选择 Claude runtime factory
  -> Claude runtime 调用 @anthropic-ai/claude-code
  -> SDK 事件流映射为 NCP event
  -> 现有共享 NCP UI 直接消费
```

## 配置约定

插件入口：

- `plugins.entries.nextclaw-ncp-runtime-plugin-claude-code-sdk.enabled`
- `plugins.entries.nextclaw-ncp-runtime-plugin-claude-code-sdk.config`

首期支持的关键配置：

- `apiKey`
- `apiBase`
- `model`
- `workingDirectory`
- `permissionMode`
- `allowedTools` / `disallowedTools`
- `additionalDirectories`
- `maxTurns`
- `maxThinkingTokens`
- `requestTimeoutMs`
- `pathToClaudeCodeExecutable` / `claudeCodePath`
- `env`

默认行为：

- `model` 默认回退到会话 metadata / 插件配置 / `agents.defaults.model`
- `apiKey` 默认回退到与模型匹配的 provider 配置
- `workingDirectory` 默认回退到 `agents.defaults.workspace`
- `permissionMode` 默认 `bypassPermissions`
- `includePartialMessages` 默认开启，优先把增量文本映射到 NCP 流式文本事件

## 事件映射策略

首期优先保证三件事成立：

1. 文本可以稳定流式显示
2. 会话 id 可以持续复用
3. 错误/完成态可以明确落到 NCP

因此本轮映射重点是：

- `RunStarted`
- `RunMetadata(ready/final)`
- `MessageTextStart`
- `MessageTextDelta`
- `MessageTextEnd`
- `RunError`
- `RunFinished`

Claude SDK 若返回结构化 `session_id`，则立即写回 `claude_session_id`。

## marketplace 上架策略

新增官方插件条目：

- slug: `ncp-runtime-plugin-claude-code-sdk`
- npm spec: `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`

并加入 `plugins-default` 推荐位。

## 验证闭环

### 本地验证

- `pnpm install`
- 新 runtime 包 `build/lint/tsc`
- 新 plugin 包 `build/lint/tsc`
- 相关集成测试：
  - `create-ui-ncp-agent` 会话类型暴露测试
  - marketplace 插件列表暴露测试
- `workers/marketplace-api` 的 `build/lint/tsc`
- `db:migrate:plugins:local`

### 发布闭环

1. 按项目 NPM 发布流程执行 changeset/version/publish。
2. 执行 `workers/marketplace-api` 的远端 plugins migration。
3. 远端 API 校验新插件条目存在且推荐位可见。
4. 使用 CLI 在隔离目录执行插件安装冒烟。

### 用户视角验收

1. 在插件市场搜索 `claude`。
2. 确认能看到官方 Claude runtime 插件。
3. 安装插件。
4. 新建会话时确认出现 `Claude`。
5. 创建 Claude 会话并发起一次对话，确认不影响默认 `native` 会话。

## 最终结论

Claude 的正确接法不是“继续补旧 engine”，而是：

- 以官方 `@anthropic-ai/claude-code` 为能力来源
- 通过独立 NCP runtime 包接入
- 通过独立插件包注册
- 通过 marketplace 完成发现、安装与启用

这与 Codex 的成功路径完全对齐，也最符合 NextClaw 当前的长期架构。
