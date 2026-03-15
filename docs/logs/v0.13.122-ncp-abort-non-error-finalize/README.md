# v0.13.122-ncp-abort-non-error-finalize

## 迭代完成说明（改了什么）
- 调整 `DefaultNcpAgentConversationStateManager` 的 abort 语义：`message.abort` 不再写入 `snapshot.error`。
- 用户手动停止时，当前流式 assistant 回复会以 `final` 状态收敛到消息列表，而不是以 `error` 状态保留。
- 增加回归测试，覆盖“abort 后不暴露 error，且保留已生成部分内容”的行为。

## 测试/验证/验收方式
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- agent-conversation-state-manager`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`

## 发布/部署方式
- 本次为 `@nextclaw/ncp-toolkit` 行为调整，按 monorepo 常规流程执行 changeset/version/publish。
- 若本轮仅本地开发验证，则发布步骤标记为“不适用（未执行发布）”。

## 用户/产品视角的验收步骤
- 在 NCP demo 前端发送一条消息，并在回复进行中点击 `abort`。
- 观察页面不再出现 `abort-error: Message aborted.` 的错误提示。
- 观察已生成的部分 assistant 内容仍保留在消息列表中，且运行态结束，可继续发送下一条消息。
