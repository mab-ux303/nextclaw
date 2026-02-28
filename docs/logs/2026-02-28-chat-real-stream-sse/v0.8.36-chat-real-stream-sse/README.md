# v0.8.36-chat-real-stream-sse

## 迭代完成说明（改了什么）

- 完成 UI 对话“真实流式”闭环（非前端模拟）：
  - Provider 层新增 `chatStream` 能力，OpenAI Chat Completions 使用 `stream: true` 实时产出 token/delta。
  - Agent Loop 新增可选 `onAssistantDelta` 回调，将真实增量从模型层透传到上层。
  - CLI runtime pool 与 UI chat runtime 打通流式回调链路。
  - UI Server 新增 `POST /api/chat/turn/stream`（SSE），输出 `ready/delta/final/error/done` 事件。
  - 前端 Chat 页面改为消费 SSE 真实流，不再使用任何“字符渐进模拟”。
- openclaw 对照结论：
  - openclaw 已有真实流式机制（通过网关事件 `delta/final` 驱动 UI），本次 nextclaw 在 UI API 侧采用 SSE 实现同等级真实流式。

关键文件：

- `packages/nextclaw-core/src/providers/base.ts`
- `packages/nextclaw-core/src/providers/openai_provider.ts`
- `packages/nextclaw-core/src/providers/litellm_provider.ts`
- `packages/nextclaw-core/src/providers/provider_manager.ts`
- `packages/nextclaw-core/src/agent/loop.ts`
- `packages/nextclaw/src/cli/commands/agent-runtime-pool.ts`
- `packages/nextclaw/src/cli/commands/service.ts`
- `packages/nextclaw-server/src/ui/router.ts`
- `packages/nextclaw-ui/src/api/config.ts`
- `packages/nextclaw-ui/src/components/chat/ChatPage.tsx`

## 测试 / 验证 / 验收方式

已执行：

- 定向类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 定向 lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- 定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server exec vitest run src/ui/router.chat.test.ts`
- 全量验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 运行态冒烟（隔离目录，避免写入仓库）：
  - `NEXTCLAW_HOME=/tmp/... node packages/nextclaw/dist/cli/index.js ui --port 18766 --no-open`
  - `GET /api/health` 返回 `{"ok":true,"data":{"status":"ok"}}`
  - `POST /api/chat/turn/stream` 返回 `event: ready`，在未配置 provider 时返回 `event: error`（预期行为，证明 SSE 链路可用）

## 发布 / 部署方式

按项目 NPM 发布流程执行：

1. `PATH=/opt/homebrew/bin:$PATH pnpm release:version`
2. `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`

实际发布结果：

- `nextclaw@0.8.36`
- `@nextclaw/core@0.6.36`
- `@nextclaw/server@0.5.19`
- `@nextclaw/ui@0.5.24`

生成标签：

- `nextclaw@0.8.36`
- `@nextclaw/core@0.6.36`
- `@nextclaw/server@0.5.19`
- `@nextclaw/ui@0.5.24`

## 用户 / 产品视角的验收步骤

1. 启动：`nextclaw start`
2. 打开 UI：`http://127.0.0.1:18791`
3. 进入 Chat，发送一条普通问题
4. 观察助手回复是否“边生成边显示”（而非等待整段结束）
5. 发送会触发工具调用的问题，确认工具卡与消息渲染仍正常
6. 切换会话后返回，确认历史消息与流式后的最终落库结果一致
