# v0.12.77 desktop-windows-exe-only-validation

## 迭代完成说明（改了什么）
- 删除安装器链路代码与入口：
  - 删除工作流 `.github/workflows/installer-build.yml`。
  - 删除目录 `scripts/installer/**`（构建脚本、NSIS 模板、Docker 验证脚本）。
  - 删除根 `package.json` 中全部 `installer:*` 命令。
- Windows 桌面发布/验证统一切换为 EXE 本体链路（不再走 Setup 安装器）：
  - 新增脚本 `apps/desktop/scripts/smoke-windows-desktop.ps1`，直接启动 `NextClaw Desktop.exe` 并验证 `/api/health`。
  - 删除 `apps/desktop/scripts/smoke-windows-installer.ps1`。
  - 更新 `scripts/desktop-package-build.mjs`：Windows 构建目标从 `nsis` 改为 `dir`。
  - 更新 `scripts/desktop-package-verify.mjs`：Windows 校验从安装器改为 `win-unpacked/NextClaw Desktop.exe`。
  - 更新 `.github/workflows/desktop-validate.yml`：Windows job 改为 `desktop-windows-exe-smoke`，构建 `--win dir` 并执行 EXE 冒烟。
  - 更新 `.github/workflows/desktop-release.yml`：Windows 构建 `--win dir`，冒烟后打包 `NextClaw Desktop-win32-x64-unpacked.zip` 作为发布资产。
- 文档对齐为 EXE-only：
  - 更新 `apps/desktop/README.md` Windows 构建说明与产物说明。
  - 更新 `docs/internal/desktop-install-unsigned.md` Windows 验收步骤（解压后双击 EXE）。

## 测试/验证/验收方式
- 静态与结构校验：
  - `node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`（通过）
  - `node --check scripts/desktop-package-build.mjs && node --check scripts/desktop-package-verify.mjs`（通过）
  - `python3` 解析 workflow YAML（`desktop-validate.yml`、`desktop-release.yml`，通过）
- 受影响链路构建与类型校验：
  - `pnpm -C packages/nextclaw-ui build`（通过）
  - `pnpm -C packages/nextclaw-openclaw-compat build`（通过）
  - `pnpm -C packages/nextclaw-server build`（通过）
  - `pnpm -C packages/nextclaw build`（通过）
  - `pnpm -C apps/desktop lint`（通过）
  - `pnpm -C apps/desktop tsc`（通过）
  - `pnpm -C apps/desktop build:main`（通过）
- Windows EXE 冒烟（核心验收）：
  - `pnpm -C apps/desktop exec electron-builder --win dir --x64 --publish never`（通过，产物为 `release/win-unpacked/NextClaw Desktop.exe`）
  - 使用 `wine64` 启动 `win-unpacked/NextClaw Desktop.exe` 并轮询 `http://127.0.0.1:18791/api/health`（通过，返回 `{"ok":true,"data":{"status":"ok"}}`）
- 一键链路回归：
  - `pnpm desktop:package:verify`（通过，当前平台执行 macOS DMG 链路并通过）

## 发布/部署方式
- 桌面发布沿用 `desktop-release` 工作流。
- Windows 资产改为 EXE 本体分发包：`NextClaw Desktop-win32-x64-unpacked.zip`（不再上传 Setup 安装器）。
- 本次无数据库/后端 migration。

## 用户/产品视角的验收步骤
1. 下载 Windows 资产 `NextClaw Desktop-win32-x64-unpacked.zip`。
2. 用户在资源管理器中解压压缩包（无需命令行）。
3. 双击 `NextClaw Desktop.exe` 启动（无需命令行）。
4. 若出现 SmartScreen，点击 `More info -> Run anyway`。
5. 进入主界面后确认可交互，并确认应用运行正常（健康接口就绪）。
