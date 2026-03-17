# 迭代完成说明

- 统一 `packages/nextclaw-ui` chat 模块第一阶段重构后的主命名语言，输入区收口为 `InputBar`，消息区收口为 `MessageList`。
- 将输入区相关文件与组件统一迁移到 `ui/chat-input-bar/` 与 `containers/chat-input-bar.container.tsx`。
- 将消息区相关文件与组件统一迁移到 `ui/chat-message-list/` 与 `containers/chat-message-list.container.tsx`。
- 删除过渡兼容壳 `chat-input/chat-input-bar-view.tsx`，页面层直接消费新的容器命名。
- 统一关键类型与字段命名，使公共接口更贴近常见直觉命名：
  - `ChatInputBarProps`
  - `ChatInputBarToolbarProps`
  - `ChatInputBarActionsProps`
  - `ChatMessageTexts`
  - `ChatSelectedItem`
  - `roleLabel`
  - `toolName`
  - `summary`
  - `output`
  - `selectedItems`
  - `selectedLabel`
  - `startContent`
  - `endContent`
- 同步修正了受影响测试、导入路径与局部实现命名，保证重命名后编译链路与组件测试通过。

# 测试/验证/验收方式

- 类型检查：`pnpm -C packages/nextclaw-ui tsc`
- 组件与适配器测试：`pnpm -C packages/nextclaw-ui test`
- 构建验证：`pnpm -C packages/nextclaw-ui build`
- 定向 ESLint：`pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatConversationPanel.tsx src/components/chat/adapters src/components/chat/containers src/components/chat/managers/chat-thread.manager.ts src/components/chat/presenter/chat.presenter.ts src/components/chat/ui/chat-input-bar src/components/chat/ui/chat-message-list src/components/chat/view-models/chat-ui.types.ts`

# 发布/部署方式

- 本次为 `@nextclaw/ui` 内部命名与结构收口，不涉及独立发布流程变更。
- 若后续需要随版本发布，继续按仓库既有前端包流程执行版本管理、构建与发布。
- 本次不涉及后端、数据库或 migration。

# 用户/产品视角的验收步骤

1. 打开 Nextclaw UI chat 页面。
2. 确认欢迎态、空态、provider hint 仍正常显示。
3. 在输入区确认输入、slash 菜单、已选 skill、模型/会话类型/思考档位工具栏均可正常工作。
4. 发送一条消息，确认 send/stop 交互不回归。
5. 确认消息区 markdown、代码块复制、tool card、reasoning block 渲染正常。
6. 确认滚动吸底与消息列表展示未因重命名造成页面行为回归。
