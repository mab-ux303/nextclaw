# v0.14.7 Codex SDK NCP Runtime Plugin

## 迭代完成说明

- 把 `Codex SDK` 从主包内的私有可选 runtime，重构为真正通过插件系统接入的 NCP runtime。
- 新增插件包 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`，它组合纯 runtime 库 `@nextclaw/nextclaw-ncp-runtime-codex-sdk`，并通过 OpenClaw/NextClaw 插件注册链暴露 `codex` session type。
- 在 `@nextclaw/openclaw-compat` 中新增通用 `registerNcpAgentRuntime` 能力，打通 `PluginRegistry -> ExtensionRegistry -> createUiNcpAgent -> /api/ncp/session-types` 全链路。
- 删除主包里的 `ui-ncp-codex-runtime-registration.ts` 私有硬编码装配，避免继续在 `nextclaw` 主包里写 `if codex`。
- 修复 `@nextclaw/nextclaw-ncp-runtime-codex-sdk` 的构建产物缺失问题，确保 runtime 包本身可作为完整积木被插件包复用。
- 顺手补齐 `@nextclaw/ncp-agent-runtime` 当前分支里的一个类型构建问题，避免全量 `nextclaw` 构建被无关的 DTS 问题卡住。

相关方案文档：

- [Codex Plugin Runtime Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-codex-plugin-runtime-plan.md)
- [NCP Pluggable Agent Runtime Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-ncp-pluggable-agent-runtime-plan.md)
- [NCP Phase 1: Codex SDK Runtime Integration Plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)

## 测试/验证/验收方式

- `pnpm install`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-codex-sdk build`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk tsc`
- `pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk build`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-openclaw-compat build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp build`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-agent-runtime build`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw build`
- `pnpm --filter @nextclaw/openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts`
- `pnpm --filter nextclaw exec vitest run src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- `pnpm --filter @nextclaw/server exec vitest run src/ui/router.session-type.test.ts`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw-openclaw-compat/src/plugins/types.ts packages/nextclaw-openclaw-compat/src/plugins/registry.ts packages/nextclaw-openclaw-compat/src/plugins/loader.ts packages/nextclaw-openclaw-compat/src/plugins/status.ts packages/nextclaw-openclaw-compat/src/plugins/plugin-capability-registration.ts packages/nextclaw-openclaw-compat/src/plugins/plugin-loader-utils.ts packages/nextclaw-openclaw-compat/src/plugins/loader.ncp-agent-runtime.test.ts packages/nextclaw/src/cli/commands/plugins.ts packages/nextclaw/src/cli/commands/plugin-command-utils.ts packages/nextclaw/src/cli/commands/service.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts packages/extensions/nextclaw-ncp-runtime-codex-sdk/tsup.config.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts packages/ncp-packages/nextclaw-ncp-agent-runtime/src/stream-encoder.ts`

结果：

- 插件发现与 NCP runtime 注册链路测试通过。
- `createUiNcpAgent` 可以在加载插件后暴露 `codex` session type。
- `nextclaw` 主包构建通过。
- maintainability guard 无阻塞项，仅保留既有超长文件警告。

## 发布/部署方式

- 先发布纯 runtime 包 `@nextclaw/nextclaw-ncp-runtime-codex-sdk`。
- 再发布插件包 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`。
- 再发布消费这条插件注册链的主包：`@nextclaw/openclaw-compat`、`nextclaw`。
- 发布后，用户通过现有插件安装入口安装 `Codex` 插件，并在配置层写入该插件自己的 `plugins.entries.<pluginId>.config`。
- 如果后续产品层补上插件配置 UI，这条链路不需要改 runtime 机制，只需要把插件 schema/hints 映射成更友好的设置界面。

## 用户/产品视角的验收步骤

1. 启动包含这批代码的 `nextclaw` 服务。
2. 让配置中的插件加载路径包含 `nextclaw-ncp-runtime-plugin-codex-sdk`，并给插件配置好 `apiKey`。
3. 打开前端 NCP 聊天页面，新建会话时确认会话类型里除了 `Native` 之外，还能看到 `Codex`。
4. 选择 `Codex` 创建会话，确认该会话被保存为 `codex` session type。
5. 刷新页面后再次进入该会话，确认仍能正常识别为 `Codex` 会话类型。
6. 卸载或禁用该插件后，确认新建会话不再显示 `Codex`，但历史已存在的 `codex` 会话仍能被识别为不可变的既有类型。
