# v0.12.71 desktop runtime init version lock

## 迭代完成说明（改了什么）
- 修复桌面端 DMG 安装后首次启动报错：`Unable to start local NextClaw runtime`，根因是打包产物内部依赖版本混装（`@nextclaw/core` 被错误收敛到 `0.7.1`，与当前 CLI 导出不兼容）。
- 将 desktop 运行链路上的内部包依赖统一为 `workspace:*`，强制打包使用当前仓库内一致版本，避免 electron-builder 在依赖收集阶段引入旧版本。
- 覆盖范围包含：
  - `packages/nextclaw`
  - `packages/nextclaw-server`
  - `packages/nextclaw-runtime`
  - `packages/nextclaw-openclaw-compat`
  - `packages/extensions/nextclaw-channel-runtime`
  - `packages/extensions/nextclaw-channel-plugin-*`（10 个 channel plugin）
- 更新 `pnpm-lock.yaml`，确保工作区依赖解析与上述策略一致。

## 测试/验证/验收方式
- 依赖安装与锁更新：`pnpm install`
- Build/Lint/TSC（核心受影响包 + desktop）：
  - `pnpm -r --filter @nextclaw/channel-runtime --filter @nextclaw/openclaw-compat --filter @nextclaw/runtime --filter @nextclaw/server --filter nextclaw --filter @nextclaw/desktop build`
  - `pnpm -r --filter @nextclaw/channel-runtime --filter @nextclaw/openclaw-compat --filter @nextclaw/runtime --filter @nextclaw/server --filter nextclaw --filter @nextclaw/desktop lint`
  - `pnpm -r --filter @nextclaw/channel-runtime --filter @nextclaw/openclaw-compat --filter @nextclaw/runtime --filter @nextclaw/server --filter nextclaw --filter @nextclaw/desktop tsc`
- 打包与安装冒烟：
  - `pnpm desktop:package`
  - `pnpm desktop:package:verify`
- 关键断言：
  - 打包产物中 `@nextclaw/core` 版本为 `0.7.3`（不再是 `0.7.1`）
  - 打包产物内执行 `init` 成功：
    - `ELECTRON_RUN_AS_NODE=1 <AppBinary> <runtime-script> init` 退出码为 0
  - DMG 安装后 health check 通过：`/api/health` 返回 ok

## 发布/部署方式
- 本次为桌面打包链路修复，无需后端 migration。
- 使用根目录命令产出可验证安装包：
  - macOS: `pnpm desktop:package`（输出 `apps/desktop/release/*.dmg`）
  - 验证: `pnpm desktop:package:verify`
- CI 建议继续沿用 `desktop-validate`/`desktop-release` 工作流做跨平台构建与验证。

## 用户/产品视角的验收步骤
- 在 macOS 执行 `pnpm desktop:package` 产出最新 DMG。
- 双击挂载 DMG，拖入应用目录并启动 `NextClaw Desktop.app`。
- 验收标准：
  - 不出现 “Unable to start local NextClaw runtime” 弹窗。
  - 应用正常打开主界面。
  - 可进入基础页面并正常加载运行状态。
