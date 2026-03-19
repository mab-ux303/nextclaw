# v0.14.63-marketplace-plugin-operation-state-fix

## 迭代完成说明

- 修复 marketplace 插件/技能卡片的操作状态管理，安装、启用、禁用、卸载改为按单条记录隔离 pending，不再因为某一个插件操作而把其它插件按钮一起锁死。
- 移除列表在后台刷新时的整页透明化“伪蒙层”效果，避免页面在无用户操作时也出现轻微加载态并干扰操作。
- 优化 marketplace 安装/卸载/启停成功后的前端缓存更新逻辑，成功提示出现后立即同步按钮状态与已安装列表，不再傻等慢速 refetch 才更新。
- 将 marketplace 页面中的筛选栏、骨架屏、分页条拆出独立展示文件，避免 `MarketplacePage.tsx` 继续膨胀。
- 新增测试覆盖：
  - 后台刷新时列表不应整体变暗
  - 单条插件 manage 操作只影响当前记录
  - 安装/管理成功后 installed 缓存即时更新

## 测试/验证/验收方式

- 定向测试：
  - `pnpm -C packages/nextclaw-ui exec vitest run src/components/marketplace/MarketplacePage.test.tsx src/components/marketplace/marketplace-installed-cache.test.ts`
- 定向 lint：
  - `pnpm -C packages/nextclaw-ui exec eslint src/components/marketplace/MarketplacePage.tsx src/components/marketplace/MarketplacePage.test.tsx src/components/marketplace/marketplace-installed-cache.ts src/components/marketplace/marketplace-installed-cache.test.ts src/components/marketplace/marketplace-page-parts.tsx src/hooks/useMarketplace.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-ui tsc`
- 构建验证：
  - `pnpm -C packages/nextclaw-ui build`
- 可维护性闸门：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/marketplace/MarketplacePage.tsx packages/nextclaw-ui/src/components/marketplace/MarketplacePage.test.tsx packages/nextclaw-ui/src/components/marketplace/marketplace-installed-cache.ts packages/nextclaw-ui/src/components/marketplace/marketplace-installed-cache.test.ts packages/nextclaw-ui/src/components/marketplace/marketplace-page-parts.tsx packages/nextclaw-ui/src/hooks/useMarketplace.ts`

## 发布/部署方式

- 本次仅触达 `@nextclaw/ui` 的 marketplace 前端交互，无后端 migration。
- 合并后按常规前端发布链路重新构建并发布包含 `@nextclaw/ui` 产物的上层应用。
- 若仅本地联调，执行 `pnpm -C packages/nextclaw-ui build` 后由依赖该 UI 包的宿主重新加载即可验证生效。

## 用户/产品视角的验收步骤

1. 进入 marketplace 的插件页。
2. 对任意一个插件点击安装、禁用、启用或卸载。
3. 确认只有当前这张卡片的按钮进入操作中状态，其他插件卡片仍可继续操作。
4. 确认页面不会在后台刷新时出现整页轻微蒙层或整体变暗。
5. 等待成功提示出现后，确认当前卡片按钮立即切换到新的状态，而不是再等数秒才变化。
6. 切到“已安装”标签，确认数量与记录也立即反映最新结果。
