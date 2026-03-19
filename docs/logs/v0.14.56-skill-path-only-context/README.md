# v0.14.56-skill-path-only-context

## 迭代完成说明

- 将技能上下文注入统一收敛为“只提供 skill 名称和 `SKILL.md` 路径”，不再把 `SKILL.md` 正文直接拼入模型上下文。
- 修改了公共技能装配层 [`packages/nextclaw-core/src/agent/skills.ts`](../../../packages/nextclaw-core/src/agent/skills.ts) 与 [`packages/nextclaw-core/src/agent/skill-context.ts`](../../../packages/nextclaw-core/src/agent/skill-context.ts)，统一输出 skill manifest。
- 修改了 [`packages/nextclaw-core/src/agent/context.ts`](../../../packages/nextclaw-core/src/agent/context.ts)，使 Requested Skills、Active Skills、Skills Summary 全部切换为名称+路径协议。
- 修改了 Codex / Claude / NCP Codex 三条运行时链路：
  - [`packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts)
  - [`packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`](../../../packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts)
  - [`packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts`](../../../packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts)
- 更新了回归测试 [`packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts`](../../../packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts)，验证 prompt 中包含 skill 名称与路径，且不再包含 skill 正文。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run create-ui-ncp-agent.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec tsc -p tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-codex-sdk exec tsc -p tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/extensions/nextclaw-engine-plugin-claude-agent-sdk exec tsc -p tsconfig.json --noEmit`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/agent/skills.ts packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/agent/skill-context.ts packages/nextclaw-core/src/index.ts packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts packages/extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.ts packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.test.ts`
- maintainability guard 结果：无阻塞项；存在历史超长文件存量警告，但本次未继续恶化。

## 发布/部署方式

- 本次未执行发布或部署。
- 如需随版本发布，按常规发布流程带上本次代码改动即可；本次不涉及数据库 migration、服务部署脚本变更或额外环境变量。

## 用户/产品视角的验收步骤

1. 在聊天或 NCP 场景中为本轮请求选择一个已安装 skill。
2. 发送消息后，确认模型上下文不再直接包含该 skill 的正文说明，而是只包含 skill 名称和 `SKILL.md` 路径。
3. 在支持文件读取的 runtime 中，确认 agent 如需使用 skill，会基于提供的路径自行读取对应 `SKILL.md`。
4. 再次选择多个 skill，确认上下文仍然只列出多个 skill 的名称与路径，不会把多个 skill 正文直接拼进 prompt。
