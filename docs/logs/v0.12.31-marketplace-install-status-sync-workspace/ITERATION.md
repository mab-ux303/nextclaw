# v0.12.31 marketplace install status sync workspace

## 迭代完成说明（改了什么）

- 修复“技能安装成功但 Marketplace 列表按钮不切换为卸载”的状态同步问题。
- 根因修复：
  - `runtime.skillsInstall` 在未显式传 `--workdir` 时，默认改为读取配置里的 `agents.defaults.workspace`。
  - `service` 的 marketplace 技能安装子命令显式追加 `--workdir <configured-workspace>`，确保 UI 安装与服务端已安装列表读取同一路径。
- 新增回归测试：
  - `runtime.skills-install-workdir.test.ts`
  - `service.marketplace-skill-args.test.ts`

## 测试/验证/验收方式

- 单测：
  - `pnpm -C packages/nextclaw test -- --run src/cli/runtime.skills-install-workdir.test.ts src/cli/commands/service.marketplace-skill-args.test.ts`
- 代码检查：
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`
- CLI 冒烟（隔离环境）：
  - 使用临时 `NEXTCLAW_HOME` + 自定义 workspace，执行：
    - `pnpm -C packages/nextclaw exec tsx src/cli/index.ts skills install weather --api-base https://marketplace-api.nextclaw.io`

验收点：

- 安装输出成功后，技能文件落在配置 workspace 下（非默认 workspace）。
- Marketplace 页再次拉取 installed 数据后，技能卡片显示卸载按钮。

## 发布/部署方式

- 本次为 CLI/UI 服务端行为修复，按常规流程：
  - 合并代码后执行 `pnpm release:check`
  - 视发布计划执行 `pnpm release:version` 与 `pnpm release:publish`
- 无新增数据库 migration。

## 用户/产品视角的验收步骤

1. 将 `agents.defaults.workspace` 配置为自定义目录。
2. 打开 Marketplace 技能页，点击任意可安装技能的“安装”。
3. 看到“安装成功”提示后，确认同一卡片按钮从“安装”变为“卸载”。
4. 进入“已安装”页签，确认新安装技能可见且可卸载。
