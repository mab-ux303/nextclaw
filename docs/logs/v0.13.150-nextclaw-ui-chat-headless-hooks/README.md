# v0.13.150-nextclaw-ui-chat-headless-hooks

## 迭代完成说明（改了什么）
- 为 `packages/nextclaw-ui/src/components/chat` 新增一组可复用的 headless hooks，用于承接非业务的展示与交互逻辑。
- 新增 hooks：
  - `use-element-width`
  - `use-active-item-scroll`
  - `use-copy-feedback`
  - `use-sticky-bottom-scroll`
- `chat-slash-menu.tsx` 改为复用宽度测量与激活项滚动 hook，不再内嵌具体 effect 细节。
- `chat-code-block.tsx` 改为复用复制反馈 hook，组件仅保留展示职责。
- `ChatConversationPanel.tsx` 改为复用 sticky bottom 滚动 hook，滚动状态与程序化滚动控制从页面壳子中抽离。
- `components/chat/index.ts` 补充导出上述 hooks，作为后续标准化拆分的稳定入口。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test`
- `pnpm -C packages/nextclaw-ui build`
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatConversationPanel.tsx src/components/chat/index.ts src/components/chat/hooks src/components/chat/ui/chat-input-bar/chat-slash-menu.tsx src/components/chat/ui/chat-message-list/chat-code-block.tsx`

## 发布/部署方式
- 本迭代仅为 `nextclaw-ui` chat 内部结构优化，不涉及协议、数据格式或部署链路变更。
- 按现有前端发布流程随主线发布即可，无需额外 migration。

## 用户/产品视角的验收步骤
1. 打开 Chat 页面并切换会话，确认消息区仍然保持原有 sticky bottom 行为。
2. 输入 `/` 打开 slash 菜单，验证面板宽度与激活项自动滚动正常。
3. 在消息里渲染代码块，点击 copy，确认复制成功与 copied 状态切换正常。
4. 连续流式输出消息，确认消息区在 sticky 状态下自动跟随到底部。
