# v0.14.12-marketplace-agent-runtime-plugin-visibility-fix

## 迭代完成说明

- 修复插件市场 UI 后端错误过滤逻辑，不再把 marketplace plugin 限定为 channel plugin。
- `agent-runtime plugin` 现在会和 channel plugin 一样正常出现在插件市场列表、详情和内容接口中。
- 修复文件：
  [`spec.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/router/marketplace/spec.ts)
- 回归测试已补齐：
  [`router.marketplace-content.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-server/src/ui/router.marketplace-content.test.ts)

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/server exec vitest run src/ui/router.marketplace-content.test.ts src/ui/router.marketplace-manage.test.ts`
- `pnpm -C packages/nextclaw-server tsc`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw-server/src/ui/router/marketplace/spec.ts packages/nextclaw-server/src/ui/router.marketplace-content.test.ts`

## 发布/部署方式

- 本次变更属于 NextClaw 本地 UI 服务端逻辑修复，需要把包含该修复的应用构建发布出去。
- 若是本地开发环境，重启使用新代码的 `nextclaw-server` / `nextclaw` 进程即可生效。
- 若是桌面端验收，需要基于这次修复后的代码重新构建桌面应用。

## 用户/产品视角的验收步骤

1. 打开“插件市场”页面。
2. 搜索 `codex`。
3. 确认可以看到 `Codex SDK NCP Runtime Plugin`。
4. 点击插件详情，确认安装规格为 `@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk`。
5. 安装后进入新建会话，确认可选择 `Codex` 会话类型。
