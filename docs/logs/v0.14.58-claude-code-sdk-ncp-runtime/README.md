# v0.14.58-claude-code-sdk-ncp-runtime

## 迭代完成说明

- 新增 Claude Code SDK 接入方案文档：[Claude Code SDK Runtime Plan](../../plans/2026-03-19-claude-code-sdk-runtime-plan.md)
- 新增纯 runtime 包 `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk`，采用与 Codex SDK 一致的 NCP runtime 架构，支持 `claude` session type、Claude session 持久化、skills prompt 注入，以及 provider/apiKey 回退
- 新增插件包 `@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`，通过标准 plugin 系统注册 Claude NCP runtime
- 接入 marketplace plugins 数据迁移，远端上架 `ncp-runtime-plugin-claude-code-sdk` 并加入 `plugins-default` 推荐位
- 新增/更新覆盖验证：
  - `create-ui-ncp-agent` session type 暴露测试
  - marketplace content 路由测试
- 发布过程中发现并修复两个真实问题：
  - runtime 首发产物未把本地模块一并打入发布包，导致 npm 安装后插件加载失败，已通过 bundling 修复并发布 runtime `0.1.1`
  - plugin manifest 版本与 npm 包版本不一致，导致 `nextclaw plugins info` 展示错误，已修复并发布 plugin `0.1.2`

## 测试/验证/验收方式

- 构建与类型检查
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-claude-code-sdk tsc`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk lint`
  - `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk tsc`
- 自动化测试
  - `pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
  - `pnpm --filter @nextclaw/server exec vitest run src/ui/router.marketplace-content.test.ts`
- marketplace / 数据验证
  - `pnpm -C workers/marketplace-api db:migrate:plugins:local`
  - `pnpm -C workers/marketplace-api db:migrate:plugins:remote`
  - `curl -sS 'https://marketplace-api.nextclaw.io/api/v1/plugins/items?page=1&pageSize=200' | jq '.data.items[] | select(.slug=="ncp-runtime-plugin-claude-code-sdk")'`
  - `pnpm -C workers/marketplace-api exec wrangler d1 execute MARKETPLACE_PLUGINS_DB --remote --command "SELECT slug, install_spec, updated_at FROM marketplace_plugin_items WHERE slug='''ncp-runtime-plugin-claude-code-sdk'''; SELECT scene_id, item_id, sort_order FROM marketplace_plugin_recommendation_items WHERE item_id='''plugin-ncp-runtime-claude-code-sdk''';"`
- 冒烟测试
  - 在 `/tmp` 隔离目录设置 `NEXTCLAW_HOME`
  - 执行 `node packages/nextclaw/dist/cli/index.js plugins install @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
  - 再执行 `node packages/nextclaw/dist/cli/index.js plugins info nextclaw-ncp-runtime-plugin-claude-code-sdk`
  - 预期结果：插件状态为 `loaded`，`NCP runtimes: claude`，`Version` 与 `Recorded version` 均为 `0.1.2`
- 可维护性自检
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-sdk-types.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/src/claude-code-runtime-utils.ts packages/extensions/nextclaw-ncp-runtime-claude-code-sdk/tsup.config.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
  - 结果：无阻塞项；`src/index.ts` 接近预算上限（350/400），后续若继续扩展需再拆分

## 发布/部署方式

- marketplace 数据发布
  - 执行 `pnpm -C workers/marketplace-api db:migrate:plugins:remote`
- npm 发布
  - 先通过 changeset 生成版本
  - runtime 包发布为 `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk@0.1.1`
  - plugin 包先发布 `0.1.1` 修复安装链路，再发布 `0.1.2` 修复 plugin manifest 版本显示
- 备注
  - 标准 `pnpm release:publish` 仍被仓库内无关历史 lint/check 问题阻塞，因此本次采用包目录定向发布的最小闭环路径

## 用户/产品视角的验收步骤

1. 打开 NextClaw marketplace，确认能看到 `Claude NCP Runtime Plugin`
2. 在 CLI 中执行 `nextclaw plugins install @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk`
3. 执行 `nextclaw plugins info nextclaw-ncp-runtime-plugin-claude-code-sdk`
4. 确认插件状态为 `loaded`，版本显示为 `0.1.2`
5. 进入标准聊天入口，确认可选 session type 中出现 `Claude`
6. 选择 Claude session type 发起对话，确认 runtime 可以正常创建并运行
