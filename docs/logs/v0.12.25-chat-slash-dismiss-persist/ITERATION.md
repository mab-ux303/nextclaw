# v0.12.25-chat-slash-dismiss-persist

## 迭代完成说明（改了什么）
- 修复 slash popover 关闭后重开问题：用户在 `/xxx` 场景按 `Esc` 关闭菜单后，继续输入时不再自动重新弹出。
- 调整状态机：移除 `onChange` 中的“每次输入都清除 dismiss”逻辑。
- 新增复位策略：仅在退出 slash 模式（`slashQuery === null`）后自动复位 `dismissedSlashPanel`，确保下一次重新触发 `/` 时可正常打开。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；仓库已有错误（`useChatStreamController.ts`、`MaskedInput.tsx`），非本次改动引入。

## 发布/部署方式
- 本次为 UI 交互状态机修复，按既有前端发布流程发布即可。

## 用户/产品视角的验收步骤
- 输入 `/xxx`，确认 popover 已打开。
- 按 `Esc` 关闭 popover。
- 继续输入字符（仍在同一 `/xxx...` 语境），popover 不应自动重开。
- 删除或输入空格退出 slash 语境后，再输入 `/`，popover 应可正常再次打开。
