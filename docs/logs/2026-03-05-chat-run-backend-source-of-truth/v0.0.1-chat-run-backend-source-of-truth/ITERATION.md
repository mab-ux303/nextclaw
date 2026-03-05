# v0.0.1 Chat Run Backend Source Of Truth

## 迭代完成说明（改了什么）

- 后端新增 `run` 真源能力（状态机：`queued/running/completed/failed/aborted`），并持久化到 `NEXTCLAW_HOME/runs`：
  - 新增 `UiChatRunCoordinator`，统一管理 run 生命周期、事件缓存、停止控制、会话 metadata 同步。
  - 会话在 run 创建时立即落盘并标记运行态，保证“发起即可见”。
- UI API 扩展 run 能力：
  - 新增 `GET /api/chat/runs`、`GET /api/chat/runs/:runId`、`GET /api/chat/runs/:runId/stream`。
  - `POST /api/chat/turn/stream` 优先走 managed run（start + stream），保留旧 runtime 兼容路径。
- WebSocket 事件新增 `run.updated`，前端据此失效查询缓存（sessions/history/runs），不再把进行态真相放在前端内存。
- 前端会话页接入 run 恢复：
  - 新增 runs 查询 API 与 hooks。
  - `useChatStreamController` 支持按 `runId` 重连流（`streamChatRun`）。
  - ChatPage 重进会话后自动发现 active run 并恢复流式展示。
  - 消息合并逻辑按 `seq` 去重，避免恢复时与 history 重复渲染。
- 路由测试补充 managed run 查询与 runId 重连流场景。

## 测试/验证/验收方式

### 执行命令

- `pnpm tsc`
- `pnpm build`
- `pnpm lint`
- `pnpm -C packages/nextclaw-server exec vitest run src/ui/router.chat.test.ts`

### 结果

- `tsc`：通过。
- `build`：通过。
- `lint`：通过（有仓库既有 `max-lines` warning，无 error）。
- `router.chat.test.ts`：9/9 通过（包含新增 run 查询与 runId 流恢复场景）。

## 发布/部署方式

1. 按现有流程发布包含改动的包：
   - `@nextclaw/server`
   - `@nextclaw/ui`
   - `nextclaw`
2. 部署后重启服务实例，确认 `/api/chat/runs*` 与 `/ws` 可用。
3. 前端清缓存刷新后验证会话恢复流程。

## 用户/产品视角的验收步骤

1. 进入 Chat 页面，发起一个耗时任务（确保任务有可见流式输出）。
2. 在任务进行中离开页面，再返回同一会话。
3. 预期：
   - 会话不会消失；
   - 页面自动恢复到该 run 的进行态；
   - 可继续看到流式增量或最终结果；
   - `Stop` 行为正常可用（支持的引擎下）。
4. 任务完成后刷新页面，历史与最终状态一致。
