# v0.14.3 NCP Codex Runtime Phase 1

## 迭代完成说明

本次迭代把 `codex` 作为一个真正可插拔的 NCP runtime 接入到现有 NCP 链路中，而不是继续往 legacy 或 bridge runtime 里塞逻辑。

本次完成内容：

- 为 NCP agent backend 增加 runtime-owned session metadata 能力，允许 runtime 在创建期与运行期回写 session metadata，并持久化到 session store。
- 新增 `UiNcpRuntimeRegistry`，把 UI NCP runtime 的选择收敛为 registry 机制，默认 `native`，可按 `session_type` 切换到其它 runtime。
- 新增可选 runtime 注册装配层 `ui-ncp-codex-runtime-registration.ts`，按配置决定是否暴露 `codex` session type。
- 新增独立包 `@nextclaw/nextclaw-ncp-runtime-codex-sdk`，封装 Codex SDK 到 NCP runtime 事件流的映射。
- 新增 `/api/ncp/session-types`，让前端 NCP 页面不再复用 legacy/chat 的 session type 来源，而是读取 NCP 自己的 runtime 能力集合。
- 前端 NCP 页面接入独立 session type 查询，并识别 `codex` 选项。
- 核心配置 schema 新增通用 `ui.ncp.runtimes` 容器，允许以通用、解耦的方式承载未来更多 runtime，而不是把 schema 写死成某一个平台。

相关方案文档：

- [NCP Phase 1 Codex SDK Runtime Integration Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)
- [NCP Pluggable Agent Runtime Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-ncp-pluggable-agent-runtime-plan.md)

## 测试 / 验证 / 验收方式

已执行：

- `pnpm install`
- `pnpm --filter @nextclaw/ncp-toolkit exec vitest run src/agent/in-memory-agent-backend.test.ts`
- `pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- `pnpm --filter @nextclaw/server exec vitest run src/ui/router.ncp-agent.test.ts src/ui/router.session-type.test.ts`
- `pnpm --filter @nextclaw/ui exec vitest run src/components/chat/ncp/ncp-session-adapter.test.ts src/components/chat/chat-chain.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw-core build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- `pnpm -C packages/nextclaw build`
- `pnpm exec eslint packages/nextclaw-core/src/config/schema.ts packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-types.ts packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-live-session-registry.ts packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/in-memory-agent-backend.test.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts packages/nextclaw/src/cli/commands/ncp/ui-ncp-runtime-registry.ts packages/nextclaw/src/cli/commands/ncp/ui-ncp-codex-runtime-registration.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/src/index.ts packages/nextclaw-server/src/ui/router.ts packages/nextclaw-server/src/ui/router/ncp-session.controller.ts packages/nextclaw-server/src/ui/router.ncp-agent.test.ts packages/nextclaw-server/src/ui/types.ts packages/nextclaw-ui/src/api/config.ts packages/nextclaw-ui/src/hooks/useConfig.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts packages/nextclaw-ui/src/components/chat/useChatSessionTypeState.ts`

说明：

- `packages/nextclaw-ui` 全量 `lint` 仍存在仓库内历史错误，与本次改动无直接关系；本次触达文件已做定向 eslint，结果为 0 error。

## 发布 / 部署方式

本次迭代未执行正式发布。

后续如需启用 `codex` runtime，可在配置中加入：

```json
{
  "ui": {
    "ncp": {
      "runtimes": {
        "codex": {
          "enabled": true,
          "apiKey": "YOUR_CODEX_API_KEY"
        }
      }
    }
  }
}
```

若以 workspace 方式开发，需先执行一次 `pnpm install`，保证新扩展包依赖链被正确链接。

## 用户 / 产品视角的验收步骤

1. 启动当前 UI/NCP 开发链路。
2. 确认 `GET /api/ncp/session-types` 返回至少 `native`，在开启 `ui.ncp.runtimes.codex.enabled=true` 时返回 `codex`。
3. 打开 NCP 聊天页面，确认新建会话时可选择 `Codex`。
4. 发送第一条消息后，确认该会话的 `session_type` 被固定为 `codex`，刷新页面后仍保留。
5. 继续同一会话，再次发送消息，确认仍走同一 runtime，而不是退回 `native`。
