# v0.14.11-codex-sdk-marketplace-closure

## 迭代完成说明

- 为 Codex SDK NCP runtime 插件补齐 marketplace 正式上架链路，新增远端 D1 seed migration：
  [`workers/marketplace-api/migrations/plugins/0003_seed_official_agent_runtime_plugins_20260319.sql`](/Users/peiwang/Projects/nextbot/workers/marketplace-api/migrations/plugins/0003_seed_official_agent_runtime_plugins_20260319.sql)
- 将 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk` 加入 marketplace `plugins-default` 推荐位，确保插件市场可发现。
- 将新的 runtime plugin 包纳入工作区根级 `build` / `lint` / `tsc` 基线：
  [`package.json`](/Users/peiwang/Projects/nextbot/package.json)
- 发布两个 npm 包：
  - `@nextclaw/nextclaw-ncp-runtime-codex-sdk@0.1.0`
  - `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk@0.1.0`
- 相关设计背景延续自：
  [`2026-03-19-codex-plugin-runtime-plan.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-codex-plugin-runtime-plan.md)
  [`2026-03-19-ncp-pluggable-agent-runtime-plan.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-ncp-pluggable-agent-runtime-plan.md)

## 测试/验证/验收方式

- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/marketplace-api lint`
- `pnpm -C workers/marketplace-api tsc`
- `pnpm -C workers/marketplace-api db:migrate:plugins:local`
- 本地 D1 查询验证 `ncp-runtime-plugin-codex-sdk` 条目和 `plugins-default` 推荐位存在
- 线上 API 验证：
  - `curl -sS 'https://marketplace-api.nextclaw.io/api/v1/plugins/items?page=1&pageSize=100' | jq '.data.items[] | select(.slug=="ncp-runtime-plugin-codex-sdk")'`
  - `curl -sS 'https://marketplace-api.nextclaw.io/api/v1/plugins/recommendations?sceneId=plugins-default&limit=20' | jq '.data.items[] | select(.slug=="ncp-runtime-plugin-codex-sdk")'`
- npm registry 验证：
  - `npm view @nextclaw/nextclaw-ncp-runtime-codex-sdk version`
  - `npm view @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk version`
- CLI 冒烟：
  - 隔离 `NEXTCLAW_HOME`
  - `node packages/nextclaw/dist/cli/index.js plugins install @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`
  - `node packages/nextclaw/dist/cli/index.js plugins list`
  - `node packages/nextclaw/dist/cli/index.js plugins info nextclaw-ncp-runtime-plugin-codex-sdk`

## 发布/部署方式

- npm 发布：
  - `cd packages/extensions/nextclaw-ncp-runtime-codex-sdk && pnpm publish --access public --no-git-checks`
  - `cd packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk && pnpm publish --access public --no-git-checks`
- marketplace 数据发布：
  - `pnpm -C workers/marketplace-api db:migrate:plugins:remote`
- 本次无 worker 代码变更，远端 D1 migration 生效后无需额外重新 deploy worker 即可对外可见。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 插件市场，搜索 `codex`。
2. 确认可以看到 `Codex SDK NCP Runtime Plugin`。
3. 点击安装，或执行：
   `nextclaw plugins install @nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`
4. 安装后进入“新建会话”类型选择，确认出现 `Codex` 会话类型。
5. 创建 Codex 会话并验证默认内置 runtime 仍保持不变，仅新增可插拔能力。
