# v0.13.126-ncp-demo-session-hydration

## 迭代完成说明
- 为 `DefaultNcpAgentConversationStateManager` 增加 `reset()` 与 `hydrate(...)`，并补快照缓存，支持稳定的会话基线重建与 `useSyncExternalStore` 订阅。
- 重构 `@nextclaw/ncp-react` 的 `useNcpAgent` 内部运行时，新增 `useHydratedNcpAgent`、`NcpConversationSeed`、`NcpConversationSeedLoader`，让切会话时可以按最小依赖加载 seed，而不耦合完整 `sessionApi`。
- 为 `ncp-demo` 后端新增 `GET /demo/sessions/:sessionId/seed`，前端改为切会话时走 `reset -> load seed -> hydrate -> auto resume running stream`。
- 移除 `ChatPanel` 对 `key={sessionId}` 重挂的依赖，补会话切换 loading/error 展示，并新增基于 Playwright 的 UI smoke 脚本验证会话切换历史回显。

## 测试/验证/验收方式
- `pnpm -C packages/ncp-packages/nextclaw-ncp build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-react tsc`
- `pnpm -C apps/ncp-demo build`
- `pnpm -C apps/ncp-demo lint`
- `pnpm -C apps/ncp-demo tsc`
- `pnpm -C apps/ncp-demo smoke`
- `pnpm -C apps/ncp-demo smoke:ui`

## 发布/部署方式
- 本次变更未执行发布。
- 若后续需要发布，按受影响包顺序执行常规 workspace 构建校验后，再走项目既有 release 流程。
- `ncp-demo` 仅为本地 demo/验证链路，无单独部署动作；开发时使用 `pnpm -C apps/ncp-demo dev`。

## 用户/产品视角的验收步骤
1. 启动 `ncp-demo`。
2. 在会话 A 发送一条消息，确认消息与会话卡片生成。
3. 点击 `new` 切到新会话，确认旧会话消息立即消失，新会话显示空态或 loading 后空态。
4. 点击左侧会话 A，确认历史消息立即回显，不需要刷新页面。
5. 若切回的是 running 会话，确认页面自动恢复流式输出，而不是停留在过期快照。
