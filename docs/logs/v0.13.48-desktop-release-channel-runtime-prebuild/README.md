# v0.13.48 desktop release channel-runtime prebuild

## 迭代完成说明（改了什么）
- 基于 `desktop-release` run `22919510588` 的失败日志，补齐 `@nextclaw/channel-runtime` 预构建。
- 修复范围：
  - `.github/workflows/desktop-release.yml`
  - `.github/workflows/desktop-validate.yml`
  - `scripts/desktop-package-build.mjs`
  - `scripts/desktop-package-verify.mjs`
- 目标是避免 CI 干净环境下 `@nextclaw/openclaw-compat` 引用 `@nextclaw/channel-runtime/dist/index.js` 时出现 `ERR_MODULE_NOT_FOUND`。

## 测试/验证/验收方式
- 本地执行：`PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`。
- 远程执行：重新触发 `desktop-release`（新 tag），验证 macOS/Windows smoke 均通过。
- 观察点：smoke 日志中不再出现 `@nextclaw/channel-runtime/dist/index.js` 缺失。

## 发布/部署方式
- 推送本次修复到 `master`。
- 使用新 tag 触发 `desktop-release`，等待构建与 smoke 通过后自动上传资产。
- 成功后创建/更新 GitHub Release，使用双语双区块说明。

## 用户/产品视角的验收步骤
- 从 Release 下载 macOS 与 Windows 附件。
- 启动桌面端并观察服务健康状态可达。
- 验证初始化流程可用，不出现模块缺失导致的启动失败。
