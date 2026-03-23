# v0.14.131 Remote App Transport Multiplex Rollout

## 迭代完成说明

- 将 NextClaw UI 的传输层升级为 `appClient + local/remote transport` 双模式。
- 新增 remote runtime 探测与浏览器侧 remote websocket 多路复用，覆盖普通请求、实时事件和聊天流式响应。
- connector 侧新增 `RemoteAppAdapter`，把本地 HTTP、SSE、UI 事件桥接到 remote relay。
- worker 新增 `/_remote/runtime` 与 `/_remote/ws`，并扩展 Durable Object 支持 browser client 与 connector 间的多路复用帧。
- 补齐 `remote-app-transport-smoke`，并把既有 `remote-relay-hibernation-smoke` 的本地 mock 升级到当前协议面。
- 相关设计来源：[`2026-03-23-nextclaw-remote-app-transport-multiplex-design.md`](../../plans/2026-03-23-nextclaw-remote-app-transport-multiplex-design.md)

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-remote tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-remote lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/nextclaw-provider-gateway-api lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- `PATH=/opt/homebrew/bin:$PATH pnpm smoke:remote-relay`
- `PATH=/opt/homebrew/bin:$PATH node scripts/remote-app-transport-smoke.mjs`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`

## 发布 / 部署方式

- NPM versioning: `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:version`
- NPM publish: `PATH=/opt/homebrew/bin:$PATH NPM_CONFIG_USERCONFIG=/Users/peiwang/Projects/nextbot/.npmrc pnpm release:publish`
- 本次实际发布版本：
  - `@nextclaw/ui@0.9.10`
  - `@nextclaw/remote@0.1.19`
  - `@nextclaw/mcp@0.1.23`
  - `@nextclaw/ncp-mcp@0.1.23`
  - `@nextclaw/server@0.10.23`
  - `nextclaw@0.13.27`
- Worker deploy: `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/nextclaw-provider-gateway-api run deploy`
- 线上 worker 版本：`d8fabcc7-d864-4c7c-a2dc-928c5f255b98`

## 用户 / 产品视角的验收步骤

1. 在一台已登录 NextClaw 账号并开启 remote connect 的设备上启动本地 UI。
2. 在平台侧打开该 remote instance，确认页面能够进入远端 UI，而不是只停留在旧版 HTTP 代理。
3. 在远端 UI 中触发一个普通配置请求，确认数据能正常返回。
4. 在远端 UI 中打开聊天并发起一次对话，确认能收到流式事件与最终回复。
5. 观察远端 UI 的实时状态刷新，确认会话更新类事件能够正常同步。
