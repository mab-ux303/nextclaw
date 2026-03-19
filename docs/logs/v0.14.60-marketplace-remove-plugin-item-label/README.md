# v0.14.60-marketplace-remove-plugin-item-label

## 迭代完成说明

- 移除插件市场列表卡片中的类型标签“插件 / Plugin”，避免在仅展示插件的页面里出现冗余文案。
- 保留 npm spec 与摘要信息，避免因标签换行导致列表卡片视觉不整洁。
- 补充插件市场页面测试，确保插件卡片继续展示 spec，但不再渲染冗余类型标签。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- MarketplacePage.test.tsx`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/marketplace/MarketplacePage.tsx src/components/marketplace/MarketplacePage.test.tsx`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/marketplace/MarketplacePage.tsx packages/nextclaw-ui/src/components/marketplace/MarketplacePage.test.tsx`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - 当前失败，原因是仓库内既有 chat 相关类型错误，与本次 marketplace 改动无关。

## 发布/部署方式

- 本次仅为前端 UI 微调，无需单独发布。
- 随下一次前端常规发布进入产线；若需单独验证，可在前端发布流程中包含 `@nextclaw/ui` 的构建与分发。

## 用户/产品视角的验收步骤

1. 打开插件市场页面。
2. 观察任一插件卡片标题下方信息行。
3. 确认不再显示“插件 / Plugin”类型标签。
4. 确认 npm 包名仍可见，且长包名不会再被前置的“插件”二字挤到异常换行。
