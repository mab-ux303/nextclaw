# 桌面安装包（Beta）

> [!WARNING]
> 该功能目前处于**实验性 Beta 阶段**，可能存在已知或未知问题。

## 说明

macOS 桌面安装包面向小白用户，目标是：

- 下载安装包
- 默认安装即可完成
- 启动后直接打开 UI 使用

无需手动预装 Node.js/npm。NextClaw 会在安装/启动时自动补齐运行时依赖。

## 下载

- Release 页面：[v0.8.50-installer-beta.2](https://github.com/Peiiii/nextclaw/releases/tag/v0.8.50-installer-beta.2)
- Apple Silicon（arm64）：[NextClaw-0.8.50-beta-macos-arm64-installer.pkg](https://github.com/Peiiii/nextclaw/releases/download/v0.8.50-installer-beta.2/NextClaw-0.8.50-beta-macos-arm64-installer.pkg)
- Intel（x64）：[NextClaw-0.8.50-beta-macos-x64-installer.pkg](https://github.com/Peiiii/nextclaw/releases/download/v0.8.50-installer-beta.2/NextClaw-0.8.50-beta-macos-x64-installer.pkg)

## 安装

1. 下载与你的 Mac 芯片匹配的 `.pkg`。
2. 双击安装并按默认流程完成安装。
3. 从 `/Applications/NextClaw` 启动。

## 验证

安装后建议执行：

1. 运行 `pnpm installer:verify:ui`。
2. 打开输出中的 `UI_URL=http://127.0.0.1:<port>`。
3. 验证关键流程（Provider 配置、渠道配置、对话、插件/技能安装）。
4. 用 `pnpm installer:verify:ui:stop` 停止。

该命令会自动选择空闲端口，避免与你本地开发端口冲突。

## 备注

- 运行时下载策略：优先 `npmmirror`，失败后回退 `nodejs.org`。
- 当前 Beta 阶段优先保证 macOS 安装发布链路可用。
