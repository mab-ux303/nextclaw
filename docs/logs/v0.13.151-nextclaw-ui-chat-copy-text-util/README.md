# v0.13.151-nextclaw-ui-chat-copy-text-util

## 迭代完成说明（改了什么）
- 在 `packages/nextclaw-ui/src/components/chat/utils` 下新增 `copy-text.ts`，作为 chat 模块通用复制工具函数。
- `copy-text.ts` 采用“优先尝试 `navigator.clipboard.writeText`，失败后自动降级到 `textarea + execCommand('copy')`”的兼容策略。
- `use-copy-feedback.ts` 改为调用该工具函数，hook 仅负责 copied 状态与重置时序，不再承担浏览器兼容逻辑。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/index.ts src/components/chat/hooks/use-copy-feedback.ts src/components/chat/utils`

## 发布/部署方式
- 本迭代仅为 `nextclaw-ui` chat 内部工具函数整理，不涉及协议、部署或 migration。
- 按现有前端发布流程随主线发布即可。

## 用户/产品视角的验收步骤
1. 在 Chat 页面渲染代码块，点击 copy 按钮。
2. 在支持 Clipboard API 的环境确认复制正常。
3. 在 Clipboard API 不可用或被拒绝的环境确认仍能通过 fallback 完成复制。
