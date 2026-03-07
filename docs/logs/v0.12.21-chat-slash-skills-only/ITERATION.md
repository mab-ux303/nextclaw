# v0.12.21-chat-slash-skills-only

## 迭代完成说明（改了什么）
- 聊天输入框 slash 面板改为仅透出 `skills`，不再展示 `commands` 分区。
- 移除前端聊天页对 `/api/chat/commands` 的查询与透传（`useChatCommands`、`fetchChatCommands`、`commandRecords/isCommandsLoading` 相关链路）。
- 保留命令执行底层能力（用户直接输入 `/xxx` 的处理链路未改）。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；存在仓库已有 lint 错误（`useChatStreamController.ts` 的 `react-hooks/refs`、`MaskedInput.tsx` 的 `no-unused-vars` 等），非本次引入。

## 发布/部署方式
- 本次为前端 UI 变更，按常规前端发布流程执行：
  - 在 monorepo 根目录完成版本与产物流程（如需要：changeset/version/publish）。
  - 或按项目既有 UI 发布脚本/命令发布 `@nextclaw/ui` 及其消费方。

## 用户/产品视角的验收步骤
- 打开聊天页输入框，输入 `/`。
- 面板左侧应仅出现 Skills 列表，不出现 Commands 分区。
- 键盘上下选择 skill，回车后应将 skill 加入已选标签，并清空输入框。
- 直接手输命令（例如 `/status`）发送，命令仍应按现有运行机制执行。
