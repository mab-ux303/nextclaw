# v0.12.73-start-readiness-diagnostics

## 迭代完成说明（改了什么）

- 改造 `packages/nextclaw/src/cli/commands/service.ts`，在后台启动探测阶段落地 3 项最小高价值改进：
  - 启动阶段日志写入失败不再静默吞掉；会输出明确告警（包含日志路径和错误信息）。
  - 启动失败（子进程提前退出）时，自动输出简版 `Startup diagnostics`（UI/API/health URL、state 路径、log 路径、最后探测详情）。
  - 健康探测命中非 2xx 响应时，错误详情新增上下文：`status + server + content-type + 截断 body`，提升 `http 404` 可诊断性。
- 保持改动最小化：未新增新日志子系统、未引入额外依赖、未改变启动状态机语义（ready/degraded/fail）。

## 测试/验证/验收方式

- 代码编译验证：
  - `pnpm -C packages/nextclaw build`（通过）
  - `pnpm tsc`（通过）
- 全仓必跑校验（按规则执行）：
  - `pnpm build`（失败，阻塞点为既有问题：`apps/platform-admin/src/pages/AdminDashboardPage.tsx` TS2345，与本次改动无关）
  - `pnpm lint`（失败，阻塞点为既有 `max-warnings=0` 下的历史 warning，与本次改动文件无关）
- 冒烟验证（在非仓库目录写入，使用临时 `NEXTCLAW_HOME`）：
  - 场景 A：占用目标端口并返回 404，执行 `start` 后确认输出包含 `Last probe error` 且附带 `server/content-type/body`。
  - 场景 B：构造非法端口触发启动失败，确认输出包含 `Startup diagnostics` 且含 `Service state path` 与 `Startup log path`。

## 发布/部署方式

- 本次仅为 CLI 启动可观测性增强；未执行发布。
- 如需发布，按既有流程执行：`changeset -> version -> publish`，并在发布后复跑 `nextclaw start` 失败场景冒烟，确认诊断输出在线上包一致。

## 用户/产品视角的验收步骤

1. 在一台干净环境执行：`nextclaw start`。
2. 如出现启动失败，观察终端是否自动输出 `Startup diagnostics`，并看到 health URL、state 路径、log 路径。
3. 若提示 `Last probe error: http 404`，确认错误中含响应上下文（至少 `content-type`，可选 `server`、`body` 片段），无需先翻日志即可定位是否“端口命中错误服务”。
4. 若日志目录不可写，确认终端可见明确告警，而不是无声失败。
