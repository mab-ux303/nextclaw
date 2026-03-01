# 2026-03-01 v0.0.1-installer-entry-temporary-removal

## 迭代完成说明（改了什么）

本次迭代将桌面安装包（Beta）从所有对外入口临时下线，避免用户继续通过 README 和文档站入口访问未稳定能力。

- 移除 README 英文入口与正文章节：[`README.md`](../../../../README.md)
- 移除 README 中文入口与正文章节：[`README.zh-CN.md`](../../../../README.zh-CN.md)
- 移除 docs 站点导航/侧边栏安装器入口（中英）：[`apps/docs/.vitepress/config.ts`](../../../../apps/docs/.vitepress/config.ts)
- 删除 docs 站点安装器 Beta 页面（中英）：
  - [`apps/docs/en/guide/desktop-installer-beta.md`](../../../../apps/docs/en/guide/desktop-installer-beta.md)
  - [`apps/docs/zh/guide/desktop-installer-beta.md`](../../../../apps/docs/zh/guide/desktop-installer-beta.md)
- 将主使用文档恢复为 npm 安装主路径：[`docs/USAGE.md`](../../../../docs/USAGE.md)
- 同步 CLI 初始化模板文档：[`packages/nextclaw/templates/USAGE.md`](../../../../packages/nextclaw/templates/USAGE.md)

## 测试 / 验证 / 验收方式

- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
- 静态检查与类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 入口清理校验：
  - `rg -n "desktop-installer-beta|Desktop Installer|桌面安装包（Beta）|实验性 Beta" README.md README.zh-CN.md apps/docs/.vitepress/config.ts apps/docs/en apps/docs/zh docs/USAGE.md packages/nextclaw/templates/USAGE.md`
  - 观察点：入口与页面文件不再出现上述内容

## 发布 / 部署方式

- 本次仅文档站与入口文档调整，不涉及后端/数据库变更：
  - 远程 migration：不适用
- 发布步骤：
  1. 提交并推送到 `master`
  2. 执行 docs 部署：`PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`

## 用户/产品视角验收步骤

1. 打开 `https://docs.nextclaw.io/en/`，确认导航中不再出现 `Desktop Installer (Beta)`。
2. 打开 `https://docs.nextclaw.io/zh/`，确认导航中不再出现“桌面安装包（Beta）”。
3. 打开仓库 `README.md`，确认无安装器 Beta 入口与章节。
4. 打开仓库 `README.zh-CN.md`，确认无安装器 Beta 入口与章节。
5. 直接访问历史安装器文档路径（`/en/guide/desktop-installer-beta`、`/zh/guide/desktop-installer-beta`）应不可用（404 或不存在）。
