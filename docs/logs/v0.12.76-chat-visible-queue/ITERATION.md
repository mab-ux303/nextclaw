# v0.12.76-chat-visible-queue

## 迭代完成说明（改了什么）
- 聊天输入区新增“待发送队列”可视面板：当当前轮正在发送时，用户连续回车产生的后续消息会立即展示在输入框上方，而不是仅显示计数。
- 队列面板支持三类操作：
  - 编辑：将该队列项取回到输入框并从队列移除。
  - 置顶：将该队列项提升为下一条发送。
  - 删除：移除该队列项。
- 发送交互对齐 Codex 风格：
  - 当当前轮正在运行时，用户再次点击发送/按回车会触发“抢占发送”：将新消息插到队列头部并自动停止当前 run，随后立即发送新消息（不再被动等待当前 run 正常结束）。
  - 输入区在运行中不再隐藏发送按钮，同时保留停止按钮，支持“发送新消息即中断当前生成”的行为。
- 流控层 `useChatStreamController` 新增队列数据与操作能力对外暴露：
  - `queuedMessages`
  - `removeQueuedMessage`
  - `promoteQueuedMessage`
- 将 `useChatStreamController.ts` 做结构化拆分（提取 stream handler、成功/失败收敛、发送策略函数），修复该文件函数长度超限问题，确保满足项目 `max-lines-per-function` 约束。
- 会话页面与输入栏完成队列状态透传，保持发送主流程不变（仍为串行发送，队列按序消费）。
- i18n 新增 `chatQueueMoveFirst` 文案键用于“置顶到下一条”操作提示。

## 测试/验证/验收方式
- 影响面判定：本次改动触达前端可运行链路（UI 组件 + 状态流控），需要执行 `lint/tsc/build` 的 UI 子集验证。
- 已执行：
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc:ui`（通过）
  - `PATH=/opt/homebrew/bin:$PATH pnpm build:ui`（通过）
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/useChatStreamController.ts`（通过，无 warning）
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatInputBar.tsx src/components/chat/ChatPage.tsx src/components/chat/ChatConversationPanel.tsx src/components/chat/useChatStreamController.ts src/lib/i18n.ts`（通过，无 error，仅 max-lines 类 warning）
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:ui`（未通过）
- `lint:ui` 结果说明：失败由仓库既有问题导致（`src/components/common/MaskedInput.tsx` 的未使用变量 error + 若干历史 max-lines warning）；本次改动文件未新增 lint error。
- 冒烟验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm preview --host 127.0.0.1 --port 4175` + `curl http://127.0.0.1:4175/`（返回页面包含 `<div id=\"root\"></div>`，通过）。

## 发布/部署方式
- 本次为前端 UI 交互改动，按项目约定走前端发布流程：
  - `pnpm release:frontend`
- 若仅在本地验证，不执行发布时可不触发版本与 npm 发布链路。

## 用户/产品视角的验收步骤
1. 打开聊天页面，发送一条消息让助手进入“发送中/思考中”状态。
2. 在助手尚未完成时，连续输入并回车 2~3 条后续消息。
3. 确认输入框上方出现“待发送队列”区域，且每条后续消息均立即可见。
4. 对队列项分别点击：
   - 编辑：消息回填到输入框并从队列消失。
   - 置顶：该消息移动到队列首位。
   - 删除：该消息被移除。
5. 等待当前轮结束后，确认队列按顺序继续发送，UI 队列数量实时减少。
6. 在助手运行中输入新消息并回车（或点击发送），确认当前 run 被停止，新消息优先开始发送。
