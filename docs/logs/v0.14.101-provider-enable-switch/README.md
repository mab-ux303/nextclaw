# v0.14.101-provider-enable-switch

## 迭代完成说明

- 为 LLM 提供商新增 `providers.<name>.enabled` 开关，默认值为 `true`。
- 服务端配置视图与更新接口已暴露并持久化该字段，UI 提供商配置页增加开关控件，左侧列表会把禁用提供商显示为 `Disabled`。
- Provider 路由与模型目录会忽略 `enabled: false` 的提供商，禁用后不再参与模型选择与运行时路由。
- 增加后端路由测试、核心路由测试，以及临时目录下的集成冒烟验证。

## 红区触达与减债记录

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：是，局部减债。
- 说明：将默认 provider 配置对象提取到 [`provider-config.factory.ts`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-server/src/ui/provider-config.factory.ts)，本文件行数从 1496 降到 1490；但 provider/search/session 仍耦合在同一配置入口。
- 下一步拆分缝：先按 provider/search/session 三个域拆出独立 config mutation 模块。

### packages/nextclaw-ui/src/components/config/ProviderForm.tsx

- 本次是否减债：是，但未完全覆盖新增需求。
- 说明：已把 provider 开关 UI 与状态 badge 下沉到 [`provider-enabled-field.tsx`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx) 和 [`provider-status-badge.tsx`](/Users/tongwenwen/Projects/Peiiii/nextclaw/packages/nextclaw-ui/src/components/config/provider-status-badge.tsx)，但 `ProviderForm` 仍因历史包袱保持超长，新增功能后仍较基线增加 17 行。
- 下一步拆分缝：继续拆 form state hook、auth flow hook、field sections、submit adapter。

### packages/nextclaw/src/cli/commands/diagnostics.ts

- 本次是否减债：否。
- 说明：本次只补了 provider disabled 的诊断状态，不再继续往文件中塞新的采集流程；该文件仍是热点，需要后续专门拆分。
- 下一步拆分缝：先拆 diagnostics collector、runtime status mapper、user-facing renderer。

## 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw-core test -- --run src/config/schema.provider-routing.test.ts src/config/provider-runtime-resolution.test.ts`
  - `pnpm -C packages/nextclaw-server test -- --run src/ui/router.provider-test.test.ts src/ui/router.provider-enabled.test.ts`
- 类型检查：
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw tsc`
- Lint：
  - `pnpm -C packages/nextclaw-core lint`
  - `pnpm -C packages/nextclaw-server lint`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C packages/nextclaw lint`
- 冒烟：
  - 在 `/tmp` 临时目录创建配置，先配置 `nextclaw` 与 `deepseek` API key，再通过 `updateProvider(..., { enabled: false })` 禁用 `deepseek`。
  - 观察结果：
    - `buildConfigView(config).providers.deepseek.enabled === false`
    - `buildConfigView(config).providers.deepseek.apiKeySet === true`
    - `getProviderName(config, "deepseek-chat") === "nextclaw"`
- Maintainability guard：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果仍提示历史热点文件预算超限，但本次已补齐 hotspot 日志，并将新增增量拆出到独立文件。

## 发布/部署方式

- 本次为本地代码与 UI/API 行为改动，无额外 migration。
- 按常规 linked workspace 发布流程执行即可；若后续发包，确保 `@nextclaw/core`、`@nextclaw/server`、`@nextclaw/ui`、`nextclaw` 按受影响范围联动发布。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI 的 Providers 页面。
2. 任选一个已配置 API key 的提供商，关闭 `Enabled` 开关并保存。
3. 返回提供商列表，确认该提供商显示为 `Disabled`。
4. 打开默认模型配置或聊天模型选择，确认被禁用提供商不再出现在可选列表中。
5. 重新开启该提供商并保存，确认它重新回到模型选择与运行时路由中。
