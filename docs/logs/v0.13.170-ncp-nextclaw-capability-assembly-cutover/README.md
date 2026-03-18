# 迭代完成说明

本次迭代完成了 NCP 聊天链路的 Nextclaw 能力装配，并将默认聊天链路重新切换为 NCP。

本次改动包括：

- 新增 `NextclawUiNcpRuntime`，不再让 UI NCP backend 走空的 `DefaultNcpToolRegistry + bare LLM` 路径，而是直接桥接到真实 `GatewayAgentRuntimePool.processDirect()`。
- 将 Nextclaw runtime 的 `assistant delta` 与 `session event` 转换为 NCP `text / reasoning / tool-call / run` 事件流。
- 将 `NextclawAgentSessionStore` 增加 `runtime-owned` 写入模式，避免 NCP backend state 与 legacy runtime 同时双写共享 `SessionManager`。
- 将 `createUiNcpAgent` 重构为“共享 NCP backend/session API + 真实 Nextclaw runtime 执行”的装配方式。
- 将前端默认链路切回 `ncp`，同时保留 `?chatChain=legacy` 显式回滚入口。

# 测试/验证/验收方式

已执行：

- `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/nextclaw-ui-ncp-runtime.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw build`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server exec vitest run src/ui/router.ncp-agent.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server build`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui test -- src/components/chat/chat-chain.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui build`

结果：

- `nextclaw` NCP runtime adapter 定向测试通过。
- `nextclaw` 类型检查通过。
- `nextclaw` 构建通过。
- `@nextclaw/server` NCP 路由测试通过。
- `@nextclaw/server` 构建通过。
- `@nextclaw/ui` 默认链路切换测试通过。
- `@nextclaw/ui` 构建通过。

# 发布/部署方式

本次涉及前后端聊天链路切换，但不涉及数据库或 migration。

如需本地集成验证：

- 重启 nextclaw gateway / UI dev server
- 直接打开聊天页，默认应进入 NCP 链路
- 如需回滚对照，追加 `?chatChain=legacy`

# 用户/产品视角的验收步骤

1. 不带任何 `chatChain` 参数直接进入聊天页，确认默认走 NCP。
2. 发送消息，确认可以完成真实 Nextclaw agent 回复，而不是裸 LLM 回复。
3. 触发需要工具的场景，确认消息流中可看到工具调用结果。
4. 验证停止、切换会话、删除会话。
5. 对页面追加 `?chatChain=legacy`，确认仍可临时回滚到旧链路。
