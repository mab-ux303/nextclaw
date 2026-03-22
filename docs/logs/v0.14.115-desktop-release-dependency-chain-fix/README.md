# v0.14.115-desktop-release-dependency-chain-fix

## 迭代完成说明

- 修复桌面发布工作流的 fresh-runner 依赖链缺口：
  - `.github/workflows/desktop-release.yml`
  - `.github/workflows/desktop-validate.yml`
- 将桌面相关前置构建从手写的少量包列表，统一改为 `pnpm -r --filter @nextclaw/desktop... build`，确保 `@nextclaw/ui` 的真实工作区依赖链一起构建，覆盖 `@nextclaw/ncp`、`@nextclaw/ncp-toolkit`、`@nextclaw/ncp-react` 等间接依赖。
- 为 `desktop-validate` 的 `pull_request` / `push` 触发路径补充 `packages/ncp-packages/**`，避免 NCP 依赖链变更时桌面校验漏跑。
- 创建 GitHub beta 预发布 `v0.13.24-desktop.1` 并触发 `desktop-release`，确认旧工作流在三平台一致失败，根因是 `packages/nextclaw-ui build` 阶段缺失 `@nextclaw/ncp-toolkit` 前置构建。

## 测试/验证/验收方式

- 本地源码验证：
  - `pnpm -C apps/desktop lint`
  - `pnpm -C apps/desktop tsc`
  - `pnpm -C apps/desktop smoke`
- 本地依赖链验证：
  - `pnpm -r --filter @nextclaw/desktop... build`
- 远端 beta 失败定位：
  - Release: `v0.13.24-desktop.1`
  - Workflow run: `23398802411`
  - 失败点：`packages/nextclaw-ui build`
  - 统一报错：`Cannot find module '@nextclaw/ncp-toolkit' or its corresponding type declarations`

## 发布/部署方式

- 先提交并推送本次 workflow 修复到远端分支。
- 基于修复后的远端代码重新创建 desktop beta 预发布并触发 `desktop-release`。
- 待 beta 的 macOS / Windows / Linux 构建与冒烟全部通过后，再创建正式版 desktop release。
- 建议下一轮版号：
  - beta：`v0.13.24-desktop.2`
  - stable：`v0.13.24-desktop.3`

## 用户/产品视角的验收步骤

1. 打开新的 beta Release 页面，确认三平台产物齐全：macOS arm64/x64、Windows x64、Linux x64。
2. 在 macOS 安装 DMG 后启动应用，确认可进入主界面；若为无签名包，按发布说明执行“仍要打开”流程。
3. 在 Windows 解压并运行 `NextClaw Desktop.exe`，确认主界面可交互。
4. 在 Linux 启动 AppImage，确认健康检查通过并可进入主界面。
5. beta 全绿后切换到正式版 Release，重复检查下载链接、版本号和三平台产物是否一致。
