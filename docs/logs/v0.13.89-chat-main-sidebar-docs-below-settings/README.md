# v0.13.89-chat-main-sidebar-docs-below-settings

## 迭代完成说明（改了什么）
- 调整主界面侧边栏底部操作区顺序：将“帮助文档”入口移动到“设置”入口正下方。
- 文档入口行为保持不变：点击后仍通过 `docBrowser.open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })` 打开文档中心。
- 本次仅调整入口位置，不改动其文案、图标与交互逻辑。

## 测试/验证/验收方式
- 代码级验证（受影响包最小充分验证）：
  - `pnpm -C packages/nextclaw-ui tsc`（通过）
  - `pnpm -C packages/nextclaw-ui build`（通过）
- 说明：`pnpm -C packages/nextclaw-ui lint` 在仓库当前基线下存在历史错误（与本次改动无关），因此未作为本次是否可交付的阻断项。

## 发布/部署方式
- 本次为前端 UI 调整，按需执行 UI 发布链路：
  - `pnpm -C packages/nextclaw-ui tsc && pnpm -C packages/nextclaw-ui build`
  - 如需正式发版，执行项目既有前端发布流程（如 `pnpm release:frontend`）。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库）。

## 用户/产品视角的验收步骤
1. 打开主界面聊天工作区，查看左侧边栏底部操作区。
2. 确认“帮助文档”位于“设置”正下方。
3. 点击“帮助文档”，确认可正常打开文档中心。
4. 点击“设置”，确认仍可正常进入设置页面。
