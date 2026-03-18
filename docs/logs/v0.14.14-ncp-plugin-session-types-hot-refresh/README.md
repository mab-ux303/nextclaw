# v0.14.14-ncp-plugin-session-types-hot-refresh

## 迭代完成说明

- 修复 NCP 会话类型列表只在服务启动时注册一次的问题。
- 现在 `createUiNcpAgent` 会按当前最新的 extension registry 动态构建 runtime registry，因此插件安装、启用、禁用、卸载后的 NCP session types 能立即反映。
- 前端 marketplace 安装/管理插件成功后，会主动刷新 `ncp-session-types` 查询。
- WebSocket 收到 `plugins` 相关配置更新时，也会自动失效并刷新会话类型与插件市场数据。
- 关键修改文件：
  - [`create-ui-ncp-agent.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts)
  - [`create-ui-ncp-agent.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts)
  - [`useMarketplace.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/hooks/useMarketplace.ts)
  - [`useWebSocket.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/hooks/useWebSocket.ts)

## 测试/验证/验收方式

- `pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw tsc`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts packages/nextclaw-ui/src/hooks/useMarketplace.ts packages/nextclaw-ui/src/hooks/useWebSocket.ts`

## 发布/部署方式

- 本次属于 NextClaw 本地服务端与前端热刷新逻辑修复。
- 若在开发环境中运行，需要重新加载当前服务进程以使用最新代码。
- 若在桌面端验收，需要基于当前代码重新构建桌面应用。

## 用户/产品视角的验收步骤

1. 打开插件市场并安装 `Codex SDK NCP Runtime Plugin`。
2. 安装成功后不要刷新页面，直接回到聊天页。
3. 打开“新建会话”的会话类型选择。
4. 确认可以看到 `Codex`。
5. 禁用或卸载该插件后，再次打开会话类型选择，确认 `Codex` 会随之消失。
