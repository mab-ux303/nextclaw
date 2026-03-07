# v0.12.32 marketplace api install cli entry fix

## 迭代完成说明（改了什么）

- 修复 Marketplace 技能安装接口“提示成功但实际未安装”的根因问题。
- 根因：服务端调用 CLI 子命令时，入口路径在打包后会误指向 `dist/index.js`（非 CLI 入口），导致子命令未执行但返回码为 0。
- 修复：
  - 新增 `resolveCliSubcommandEntry`，优先使用 `process.argv[1]` 作为 CLI 入口，避免打包路径偏移。
  - `ServiceCommands.runCliSubcommand` 改为使用上述入口解析。

## 测试/验证/验收方式

- 单元测试：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/service.marketplace-skill-args.test.ts src/cli/runtime.skills-install-workdir.test.ts`
- 静态检查：
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`
- 打包态 API 冒烟（关键）：
  - 使用 `node packages/nextclaw/dist/cli/index.js serve` 启动服务；
  - 调用 `/api/marketplace/skills/install` 安装 `cloudflare-deploy`；
  - 验证安装前后 installed 列表变化与技能文件落盘。

验收点：

- 安装前 `BEFORE_EXISTS=false`
- 安装后 `AFTER_EXISTS=true` 且 `AFTER_SOURCE=workspace`
- 目标文件存在：`workspace/skills/cloudflare-deploy/SKILL.md`

## 发布/部署方式

- 合并后按常规流程发布：
  - `pnpm release:check`
  - `pnpm release:version`
  - `pnpm release:publish`
- 该修复属于 CLI 行为修复，无数据库 migration。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务并打开技能市场。
2. 选择一个未安装的 Marketplace 技能，点击“安装”。
3. 看到成功提示后，确认按钮从“安装”切换为“卸载”。
4. 切到“已安装”页签，确认该技能已出现且可卸载。
