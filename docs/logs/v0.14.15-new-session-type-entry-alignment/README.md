# v0.14.15-new-session-type-entry-alignment

## 迭代完成说明

- 将“会话类型选择”从聊天输入栏中移除，避免产生“已创建会话仍可切换类型”的错误暗示。
- 将左侧 `新增任务` 入口调整为“默认创建 + 非默认类型下拉菜单”模式：
  - 主按钮继续创建默认会话
  - 右侧下拉 Popover 用于创建 `Codex` 等非默认类型会话
- 新建会话时会把所选类型写入 `pendingSessionType`，确保首条消息发送时使用正确 runtime。
- 关键文件：
  - [`ChatSidebar.tsx`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx)
  - [`chat-input-bar.container.tsx`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx)
  - [`chat-session-list.manager.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts)
  - [`chat-session-list.manager.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.test.ts)

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/managers/chat-session-list.manager.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatSidebar.tsx src/components/chat/containers/chat-input-bar.container.tsx src/components/chat/managers/chat-session-list.manager.ts src/components/chat/managers/chat-session-list.manager.test.ts`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx packages/nextclaw-ui/src/components/chat/containers/chat-input-bar.container.tsx packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.test.ts`

## 发布/部署方式

- 本次变更属于 NextClaw UI 行为调整。
- 本地开发环境需要重新加载当前前端/桌面构建。
- 桌面端验收需要基于当前代码重新构建应用。

## 用户/产品视角的验收步骤

1. 打开聊天页左侧边栏。
2. 观察 `新增任务` 按钮右侧是否出现下拉箭头。
3. 点击主按钮，确认创建默认 `Native` 会话。
4. 点击下拉箭头，确认弹出会话类型菜单，并能看到 `Codex`。
5. 选择 `Codex` 后发送首条消息，确认新会话按 `Codex` 类型创建。
