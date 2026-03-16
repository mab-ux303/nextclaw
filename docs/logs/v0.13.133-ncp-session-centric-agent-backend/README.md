# v0.13.133-ncp-session-centric-agent-backend

## 迭代完成说明

- 将 `DefaultNcpAgentBackend` 从 run-centric 改为 session-centric：移除 `AgentRunStore`、`RunControllerRegistry`、持久化 `activeRunId`，改为在内存中的 `LiveSessionState.activeExecution` 上管理单 session 的唯一活跃执行。
- 将协议与传输层同步到 session 语义：`stream` / `abort` 均改为基于 `sessionId`，manifest 能力位改为 `supportsLiveSessionStream`。
- 同步更新 demo、React hooks、HTTP agent client/server、toolkit tests 与库文档，去掉 run replay / stored stream 的旧表述。
- 补充回归测试，覆盖“session live stream 不重复广播”和“无活跃 session 时 `/stream` 立即结束”。
- 相关方案文档：[NCP Session-Centric Agent Backend Design](../../plans/2026-03-17-ncp-session-centric-agent-backend-design.md)

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-http-agent-client test`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-http-agent-server test`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/frontend build`

## 发布/部署方式

- 本次未执行正式发布。
- 如需发布相关包，按仓库既有 NPM 发布流程执行受影响包的 `build`、版本变更与 publish，并优先发布 `@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、HTTP transport、React bindings，再处理 demo 部署。
- 如需部署 demo，先构建 backend/frontend，再按 demo 现有启动方式重启服务。

## 用户/产品视角的验收步骤

1. 启动 `ncp-demo` 前后端并进入任一 session。
2. 发送一条消息，确认后端能正常流式返回 assistant 内容。
3. 在响应进行中刷新页面或重新进入该 session，确认前端基于 `sessionId` 重新 attach live stream，且不会依赖 `runId`。
4. 在响应进行中触发停止，确认 `abort` 能基于 `sessionId` 中断当前活跃执行。
5. 响应结束后查看 session 列表与历史消息，确认只保留会话消息历史，不再暴露 run 存储/回放语义。
