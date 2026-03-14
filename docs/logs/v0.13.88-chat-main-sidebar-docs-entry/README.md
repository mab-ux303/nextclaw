# v0.13.88-chat-main-sidebar-docs-entry

## 迭代完成说明（改了什么）
- 在主界面侧边栏组件 `packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx` 新增“帮助文档”入口。
- 入口行为与设置侧边栏保持一致：点击后调用 `docBrowser.open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })` 打开文档中心。
- 视觉与交互风格与主侧栏现有底部操作项保持一致（图标 + 文案 + hover 状态）。

## 测试/验证/验收方式
- 代码级验证（影响到 UI 代码路径，执行最小充分验证）：
  - `pnpm -C packages/nextclaw-ui tsc`（通过）
  - `pnpm -C packages/nextclaw-ui build`（通过）
- 冒烟验证（用户可见行为改动，执行最小可运行烟测）：
  - 启动：`pnpm -C packages/nextclaw-ui dev --host 127.0.0.1 --port 4174 --strictPort`
  - 访问：`curl http://127.0.0.1:4174/` 返回 `HTTP/1.1 200 OK`，且首页包含 `#root` 挂载节点（通过）

## 发布/部署方式
- 本次为前端 UI 变更，按需执行 UI 发布链路：
  - 本地/CI 先执行：`pnpm -C packages/nextclaw-ui tsc && pnpm -C packages/nextclaw-ui build`
  - 如需正式发版，按项目既有流程执行前端发布命令（例如仓库根目录 `pnpm release:frontend`）。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库变更）。

## 用户/产品视角的验收步骤
1. 打开 NextClaw UI 主界面（聊天工作区）。
2. 查看左侧栏底部操作区，确认出现“帮助文档”入口（Book 图标 + 文案）。
3. 点击“帮助文档”，应打开文档中心页面（与设置侧边栏中的文档入口行为一致）。
4. 验证“设置 / 主题 / 语言”入口仍可正常使用，未受回归影响。
