# v0.12.66-telegram-streaming-mechanism-align

## 迭代完成说明（改了什么）

- 一次性对齐 Telegram 流式机制，不再走两阶段：
  - 新增通用控制消息：`assistant_stream/reset` 与 `assistant_stream/delta`，用于把模型增量从 runtime 投递到 channel。
  - `ChannelManager` 控制消息路由从仅 typing 扩展为统一 `nextclaw control`，避免后续再加分支判断。
  - `AgentLoop` inbound 路径支持 `onAssistantDelta`，让非 direct 场景也可接收 provider stream delta。
  - `GatewayAgentRuntimePool` 在每次 inbound 处理前发送 `reset`，流式过程中发送 `delta`，把增量链路打通到消息总线。
  - Telegram channel 新增预览流式控制器：
    - 支持 `partial/block/off` 三种模式（`progress` 映射为 `partial`）。
    - 以“先发送草稿消息，再持续编辑”的方式输出；最终消息优先收敛到已有预览消息（编辑而非重发）。
    - 内置最小首发阈值、节流与 block 模式最小增量控制。
  - 配置层新增 `channels.telegram.streaming`，并同步 help/label 文案。
- 新增/更新测试：
  - `bus/control` 新增 assistant stream control 用例。
  - `ChannelManager` 新增 assistant stream control 路由用例。
  - `AgentLoop` 新增 inbound streaming delta 转发用例。

## 测试 / 验证 / 验收方式

- 单测：
  - `pnpm -C packages/nextclaw-core exec vitest run src/bus/control.test.ts src/channels/manager.typing-control.test.ts src/agent/loop.inbound-stream.test.ts`
  - 结果：通过（8/8）。
- 类型检查：
  - `pnpm tsc`
  - 结果：通过。
- 构建：
  - `pnpm build`
  - 结果：通过。
- Lint：
  - `pnpm lint`
  - 结果：失败，失败原因为仓库既有 warning gate（例如 `apps/platform-console` 的 `--max-warnings=0` 与多个历史 `max-lines` warning），非本次改动引入的新 lint error。
- 冒烟（非仓库目录执行）：
  - 命令：
    - `pnpm -C /Users/tongwenwen/Projects/Peiiii/nextclaw/packages/extensions/nextclaw-channel-runtime exec tsx /tmp/nextclaw-telegram-stream-smoke.ts`
  - 观察点：同一会话先 `send` 预览，再对同一消息 `edit` 到最终文本。
  - 结果：通过（`sends: 1`, `edits: 1`，最终编辑文本与最终答案一致）。

## 发布 / 部署方式

- 本次为机制对齐与运行时行为改动，未执行发布。
- 如需发布，按项目既定流程：
  - `pnpm changeset`
  - `pnpm release:version`
  - `pnpm release:publish`

## 用户 / 产品视角的验收步骤

1. 在配置中启用 Telegram，并设置 `channels.telegram.streaming` 为 `partial`（或 `block`）。
2. 发送一条能触发较长回复的问题。
3. 观察机器人先出现预览消息，随后在同一条消息上持续更新。
4. 观察回复结束时最终内容落在该预览消息上（编辑收敛，不重复新增最终消息）。
5. 将 `channels.telegram.streaming` 设为 `off`，再次发送同类请求，确认恢复为一次性发送。
