# v0.12.24-chat-slash-space-close-immediately

## 迭代完成说明（改了什么）
- 修复 slash skills 面板交互：在 `"/"` 打开面板后，用户按空格会在 `keydown` 阶段立即关闭 popover。
- 新增输入法保护：仅在 `!nativeEvent.isComposing` 时触发关闭，避免中文输入法组合态误触。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；仓库已有错误（`useChatStreamController.ts`、`MaskedInput.tsx`），非本次改动引入。

## 发布/部署方式
- 本次属于前端 UI 交互修复，按既有前端发布流程发布即可。

## 用户/产品视角的验收步骤
- 在聊天输入框输入 `/`，确认 skills popover 打开。
- 紧接着输入空格，popover 应立即关闭，不应先出现空格搜索结果。
- 再次输入 `/` 应可正常打开面板。
