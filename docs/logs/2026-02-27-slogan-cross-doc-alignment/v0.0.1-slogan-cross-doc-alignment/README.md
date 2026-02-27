# 2026-02-27 v0.0.1-slogan-cross-doc-alignment

## 迭代完成说明（改了什么）

- 以落地页主视觉最新 slogan 为基准，统一对齐 Readme 与项目文档文案。
- 已同步到：
- `README.md` / `README.zh-CN.md` 顶部口号与首段定位描述
- docs 站首页中英文 tagline：`apps/docs/en/index.md`、`apps/docs/zh/index.md`
- docs 站 introduction 中英文开场定位：`apps/docs/en/guide/introduction.md`、`apps/docs/zh/guide/introduction.md`
- npm readme 源文案：`docs/npm-readmes/nextclaw.md`
- 项目定位文档一句话描述：`docs/feature-universe.md`
- 执行 `release:sync-readmes`，同步更新 `packages/nextclaw/README.md`，避免 npm 包文案滞后。

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm release:sync-readmes`
- `PATH=/opt/homebrew/bin:$PATH pnpm docs:i18n:check`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/docs build`

## 发布 / 部署方式

- 本次为文案与文档对齐，不涉及 migration 或后端部署。
- 如需发布 npm，按项目流程执行：`changeset -> release:version -> release:publish`。
- 如需发布文档站，执行：`pnpm deploy:docs`。

## 用户 / 产品视角的验收步骤

1. 打开仓库根 README，确认顶部口号与首段定位已对齐新版 slogan。
2. 打开 docs 首页中英文版本，确认 hero tagline 已对齐新版 slogan 语义。
3. 打开 docs introduction 中英文，确认开场定位与新版 slogan 一致。
4. 打开 `packages/nextclaw/README.md`，确认 npm 包 readme 已同步最新描述。
