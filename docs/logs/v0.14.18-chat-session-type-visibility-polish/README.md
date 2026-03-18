# v0.14.18-chat-session-type-visibility-polish

## 迭代完成说明

- 优化新增非默认会话类型时的交互闭环。
- 修复左侧 `新增任务` 下拉菜单在点击 `Codex` 这类出口动作后不会自动关闭的问题。
- 在聊天主区域顶部补充当前会话类型标识，草稿新会话也会显示，便于用户立即确认自己进入的是 `Native` 还是 `Codex` 会话。
- 保持“会话类型在创建时决定”的产品约束，没有把类型切换入口重新塞回输入区。
- 新增前端测试，覆盖下拉关闭行为和草稿会话类型展示。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/ChatSidebar.test.tsx src/components/chat/ChatConversationPanel.test.tsx src/components/chat/managers/chat-session-list.manager.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatSidebar.tsx src/components/chat/ChatConversationPanel.tsx src/components/chat/legacy/LegacyChatPage.tsx src/components/chat/ncp/NcpChatPage.tsx src/components/chat/stores/chat-thread.store.ts src/components/chat/ChatSidebar.test.tsx src/components/chat/ChatConversationPanel.test.tsx`

## 发布/部署方式

- 本次未发布。
- 合并后按常规前端发布流程即可，无需额外 migration 或后端部署步骤。

## 用户/产品视角的验收步骤

- 打开聊天页，点击左侧 `新增任务` 右侧下拉箭头。
- 在弹出菜单中点击 `Codex`。
- 确认弹出菜单会立即关闭。
- 确认新会话界面顶部会显示当前会话类型标识 `Codex`。
- 再创建默认 `Native` 会话，确认顶部类型标识随之切换为 `Native`。
