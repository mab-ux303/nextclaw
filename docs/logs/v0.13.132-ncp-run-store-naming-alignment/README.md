# v0.13.132-ncp-run-store-naming-alignment

## 迭代完成说明（改了什么）

- 将 `AgentRunStore` 的方法命名收紧为更贴合职责边界的语义，去掉含糊或夸大能力的命名：
  - `createRunRecord` -> `createRun`
  - `getRunRecord` -> `getRun`
  - `resolveRunRecord` -> `findRunForAbort`
  - `appendEvents` -> `appendRunEvents`
  - `streamEvents` -> `readRunEvents`
  - `deleteSessionRuns` -> `deleteRunsForSession`
- 同步更新 `@nextclaw/ncp-toolkit` 内部调用点与 in-memory 实现。
- 同步更新 `apps/ncp-demo/backend` 中的文件版 run store 实现。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend build`

## 发布/部署方式

- 本次为无行为变化的接口命名调整。
- 若对外发布 `@nextclaw/ncp-toolkit`，需要在 release notes 明确说明 `AgentRunStore` 方法名有 breaking change，上层自定义 store 实现需同步重命名。
- `apps/ncp-demo/backend` 无额外部署动作，按现有方式启动即可。

## 用户/产品视角的验收步骤

1. 使用现有 backend 发送消息，确认会话消息仍正常生成。
2. 执行 stop/abort 路径，确认运行中消息仍可正常终止。
3. 触发 run stream 读取路径，确认仍能读取对应 run 的已存储事件。
4. 删除 session，确认关联 run 数据仍会一并清理。
