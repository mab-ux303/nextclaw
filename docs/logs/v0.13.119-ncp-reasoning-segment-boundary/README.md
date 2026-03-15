# v0.13.119-ncp-reasoning-segment-boundary

## 迭代完成说明（改了什么）
- 修复 NCP 会话状态聚合中 `reasoning` 分段边界错误：当消息中出现 `think -> tool call -> think` 时，第二段 `think` 不再错误并入第一段。
- 调整 `DefaultNcpAgentConversationStateManager` 的 `handleMessageReasoningDelta` 逻辑，仅在最后一个 part 本身是 `reasoning` 时拼接；否则新增一个新的 `reasoning` part。
- 增加针对回归场景的测试，覆盖“工具调用后新的 reasoning 段应独立追加”的行为。

## 测试/验证/验收方式
- 单测：`pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- agent-conversation-state-manager.test.ts`
- 代码质量：`pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- 类型检查：`pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`

## 发布/部署方式
- 本次为内部修复，按常规包发布流程处理：
  - 若需要发布：按 changeset 流程进行 version/publish。
  - 若仅本地验证：无需额外部署步骤。

## 用户/产品视角的验收步骤
1. 启动 NCP demo 并触发一个包含工具调用的多阶段回答（例如 `think -> tool -> think -> text`）。
2. 观察前端消息分段，确认工具调用前后的 `thinking` 以两个独立段展示，而不是合并为一段。
3. 多次重复触发，确认不再出现“第二段 think 并入第一段”的现象。
