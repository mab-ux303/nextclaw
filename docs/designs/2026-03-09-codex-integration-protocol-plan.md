# Codex 接入协议规划（NCIP v1 草案）

## 背景与目标

当前我们在讨论的是“新迭代前的规划”，不是正式迭代交付。
因此本文件放在 `docs/designs`，不进入 `docs/logs` 迭代记录。

目标：
- 先定义统一接入协议（最低标准 + 可选能力）
- 先以 Codex 做蓝本评估可行性
- 明确哪些共享值得做，哪些不值当可放弃

## NCIP v1（NextClaw Capability Integration Protocol）

### A. 最低标准（必须满足）

1. Capability Manifest
- 必须声明：`engineKind`、`version`、`supportsStreaming`、`supportsAbort`、`supportsSessionResume`
- 必须声明共享等级：`sharedLevel`（`minimal`/`partial`/`full`）

2. Session Contract
- 必须提供稳定的 `sessionKey -> externalSessionId` 映射
- 必须保证同一 `sessionKey` 连续对话

3. Turn Contract
- 必须有统一调用语义（`processDirect` / `handleInbound`）
- 必须输出统一事件：`turn.started`、`turn.delta`、`turn.completed`、`turn.failed`

4. Abort/Timeout Contract
- 必须支持超时终止
- 若 `supportsAbort=true`，必须支持显式中断并返回确定状态

5. Persistence Contract
- 必须把用户输入、助手输出、关键引擎事件写入 NextClaw 会话层

6. Error Contract
- 必须统一到：`config_error`、`auth_error`、`runtime_error`、`timeout_error`、`abort_error`

7. Security Boundary Contract
- 必须支持工作目录与权限模式配置
- 必须支持网络访问策略配置

### B. 可选能力（按价值逐步接入）

- `O1 Context Bridge`：共享 NextClaw ContextBuilder（bootstrap、预算裁剪）
- `O2 Memory Bridge`：共享 memory 注入与 memory tool 语义
- `O3 Tool Bridge`：共享 NextClaw ToolRegistry（桥接到外部能力）
- `O4 Skill Bridge`：共享 requested_skills + always skills + skills summary
- `O5 Routing/Handoff Bridge`：共享跨 agent 路由与 handoff
- `O6 Observability Bridge`：共享统一 metrics/cost/tracing

约束：
- 可选能力未实现必须标注 `not-shared`
- 禁止把 `minimal` 说成“完全共享”

## Codex 基线梳理（按 NCIP v1）

### 已满足 / 基本满足
- 会话连续性：具备（thread 复用）
- 流式事件：具备（runStreamed + 事件落会话）
- 基础持久化：具备（user/assistant/engine events 可落盘）
- 安全边界基础：具备（sandbox、approval、workingDirectory 等配置）

### 部分满足
- Skill 共享：目前主要是 `requested_skills` 注入，非完整 skill 体系共享
- 错误统一：有透传，尚未完成 NCIP 的标准错误分类

### 未满足
- 显式中断闭环（stop/abort）未形成统一能力承诺
- Tool Bridge 尚未共享 NextClaw ToolRegistry
- Memory/Context 深度共享尚未打通

### 当前判断
- Codex 当前更适合定位为“隔离能力后端（可运行）”，不是“深度共享内核”

## 推进建议（先 Codex）

### Phase 1：先达标（不强耦合）
- 把最低标准补齐，重点是 abort 与 error normalization
- 对外明确 `sharedLevel=minimal`

### Phase 2：只做值当共享
- 优先做 `O3 Tool Bridge`
- 次优先做 `O2 Memory Bridge`
- 对高成本低收益项维持 `not-shared`

## 待确认问题

1. `supportsAbort` 的验收标准是“请求被接受”还是“外部执行真实停止”？
2. `Tool Bridge` 优先走 MCP 适配还是进程内适配？
3. `Memory Bridge` 是“注入式共享”还是“检索式共享”？
4. `sharedLevel` 是否进入 UI/CLI 可见能力面板？

