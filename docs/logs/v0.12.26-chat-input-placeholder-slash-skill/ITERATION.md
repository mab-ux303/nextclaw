# v0.12.26-chat-input-placeholder-slash-skill

## 迭代完成说明（改了什么）
- 更新聊天输入框 placeholder 文案，明确提示用户可输入 `/` 选择技能。
- 中英文文案同步更新，保持多语言一致。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；存在仓库已有错误（`useChatStreamController.ts`、`MaskedInput.tsx`），非本次引入。

## 发布/部署方式
- 本次为前端文案更新，按既有前端发布流程发布即可。

## 用户/产品视角的验收步骤
- 打开聊天页面输入框。
- placeholder 应显示包含“输入 / 选择技能”的提示。
- 切换英文场景时，应显示对应英文提示“type / to select skills”。
