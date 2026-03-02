# 2026-03-02 Model Help 文案国际化（`agents.defaults.model`）

## 迭代完成说明（改了什么）

- 将 Model 页面“默认模型”帮助文案改为走 UI i18n 键，避免中文环境仍显示英文。
- 新增 i18n 文案键：`modelIdentifierHelp`（中英双语）。
- Model 页面读取文案逻辑改为优先使用 `t('modelIdentifierHelp')`，并保留后端 hint 兜底。
- 变更文件：
  - [`packages/nextclaw-ui/src/lib/i18n.ts`](../../../../packages/nextclaw-ui/src/lib/i18n.ts)
  - [`packages/nextclaw-ui/src/components/config/ModelConfig.tsx`](../../../../packages/nextclaw-ui/src/components/config/ModelConfig.tsx)

## 测试 / 验证 / 验收方式

执行命令：

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：

- `pnpm build`：通过
- `pnpm lint`：通过（0 error，存在仓库既有 warnings）
- `pnpm tsc`：通过

冒烟验证（用户可见改动）：

```bash
rg -n "modelIdentifierHelp|Default model identifier used by the agent|Agent 默认模型标识" packages/nextclaw-ui/dist/assets/*.js -S
```

观察点：

- 打包产物中可检索到 `modelIdentifierHelp` 及对应中英文文案，说明文案已进入前端 i18n 运行链路。

## 用户 / 产品视角验收步骤

1. 打开 UI，切换语言到中文（`中文`）。
2. 进入 Model 页面。
3. 查看“默认模型”输入区域下方帮助文案，确认显示中文说明而非英文。
4. 切换语言到英文（`English`），确认同位置显示英文说明。

## 发布 / 部署方式

- 本次为前端文案国际化变更，无后端/数据库变更。
- 若独立发布 UI：执行 `pnpm release:frontend`。
- 若走常规包发布：按 [`docs/workflows/npm-release-process.md`](../../../../docs/workflows/npm-release-process.md) 执行版本与发布流程。
- 远程 migration：不适用（无数据库结构变更）。
