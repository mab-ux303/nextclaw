# 2026-02-27 v0.0.1-doc-browser-locale-sync

## 迭代完成说明（改了什么）

- 修复 UI 内嵌文档（Doc Browser）未适配文档站国际化的问题。
- 内嵌文档默认打开地址从无语言前缀路径改为按 UI 当前语言自动定位：
- 中文 UI -> `/zh/guide/getting-started`
- 英文 UI -> `/en/guide/getting-started`
- Doc Browser 的 `open` / `navigate` 行为增加 docs URL 规范化：
- docs 域名下若路径缺少语言前缀，会自动补全到当前 UI 语言
- 已带 `/en` 或 `/zh` 前缀的地址保持不变
- 非 docs 域名地址保持原样

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟：
- UI 切换到中文后，点击侧边栏「帮助文档」，确认内嵌地址为 `/zh/...`。
- UI 切换到英文后，点击侧边栏「帮助文档」，确认内嵌地址为 `/en/...`。
- 在文档地址栏输入 `/guide/channels`，确认会自动补全到当前语言前缀。

## 发布 / 部署方式

- 本次为 UI 行为修复，不涉及 migration。
- 如需发布，按 `changeset -> release:version -> release:publish` 执行。

## 用户 / 产品视角的验收步骤

1. 打开 UI，切换语言为中文并刷新。
2. 打开内嵌文档，确认进入中文文档路径（`/zh/...`）。
3. 切换语言为英文并刷新。
4. 再次打开内嵌文档，确认进入英文文档路径（`/en/...`）。
5. 在内嵌文档地址输入无语言前缀路径，确认自动使用当前语言。
