# v0.8.51-desktop-installer-beta-docs-entry

## 迭代完成说明（改了什么）

本次迭代聚焦“桌面安装包（Beta）”文档可发现性，完成了文档站入口与 README 入口联动，且在文档开头明确标注实验性 Beta 风险。

- 文档站导航与侧边栏新增安装器入口（中英）  
  - 文件：[`apps/docs/.vitepress/config.ts`](../../../apps/docs/.vitepress/config.ts)
- 新增英文安装器文档，开头增加 experimental beta 警示  
  - 文件：[`apps/docs/en/guide/desktop-installer-beta.md`](../../../apps/docs/en/guide/desktop-installer-beta.md)
- 新增中文安装器文档，开头增加 实验性 Beta 警示  
  - 文件：[`apps/docs/zh/guide/desktop-installer-beta.md`](../../../apps/docs/zh/guide/desktop-installer-beta.md)
- `README.md` 新增“Desktop Installer (Beta)”入口与独立章节链接
  - 文件：[`README.md`](../../../README.md)
- `README.zh-CN.md` 新增“桌面安装包（实验性 Beta）”入口与独立章节链接
  - 文件：[`README.zh-CN.md`](../../../README.zh-CN.md)

## 测试 / 验证 / 验收方式

- 文档构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- 仓库级校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 文档页面构建产物冒烟：
  - `ls -l apps/docs/.vitepress/dist/en/guide/desktop-installer-beta.html apps/docs/.vitepress/dist/zh/guide/desktop-installer-beta.html`
  - 观察点：中英文安装器页面 HTML 均存在

## 发布 / 部署方式

- 本次为文档与 README 入口改动，不涉及后端/数据库变更：
  - 远程 migration：不适用
  - 服务端部署：按 docs 站点既有流程发布静态文档
- 若需发布 npm 包，遵循项目发布流程：
  1. `pnpm changeset`
  2. `pnpm release:version`
  3. `pnpm release:publish`

## 用户/产品视角验收步骤

1. 打开英文文档首页与导航，确认可看到 `Desktop Installer (Beta)` 入口。
2. 点击进入安装器文档，确认开头出现“experimental beta”警示。
3. 打开中文文档首页与导航，确认可看到“桌面安装包（Beta）”入口。
4. 点击进入中文安装器文档，确认开头出现“实验性 Beta 阶段”警示。
5. 打开 `README.md`，确认顶部与正文都可跳转到英文安装器文档。
6. 打开 `README.zh-CN.md`，确认顶部与正文都可跳转到中文安装器文档。
