# 2026-02-23 v0.8.9-skills-loader-import-hardening

## 背景 / 问题

- 用户执行 `nextclaw update && nextclaw restart` 时出现致命崩溃：
  - `SyntaxError: The requested module '@nextclaw/core' does not provide an export named 'SkillsLoader'`
- 崩溃发生在模块加载阶段，导致命令无法继续执行，属于高优先级可用性故障。

## 迭代完成说明（改了什么）

- `packages/nextclaw-server/src/ui/router.ts`
  - 移除对 `SkillsLoader` 的静态命名导入，改为通过 `@nextclaw/core` 命名空间按需读取。
  - 增加 `createSkillsLoader` 安全构造逻辑：当运行时不存在 `SkillsLoader` 导出时返回 `null`，避免 ESM 在加载阶段直接崩溃。
  - 相关技能列表读取逻辑改为 `loader?.listSkills(...) ?? []`，保证 UI 路由可用性。
- `packages/nextclaw/src/cli/commands/service.ts`
  - 同样移除对 `SkillsLoader` 的静态命名导入，统一采用运行时安全读取。
  - 内置技能安装路径改为在缺失导出时走安全空结果，不触发进程级崩溃。
- `packages/nextclaw-core/src/index.ts`
  - 将 `skills` 导出改为显式命名导出：`SkillsLoader` + `SkillInfo`，降低后续构建/发布漏导出的风险。

## 测试 / 验证 / 验收方式

执行命令：

```bash
pnpm build
pnpm lint
pnpm tsc

TMP_HOME=$(mktemp -d /tmp/nextclaw-smoke.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js update --help
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js restart --help
rm -rf "$TMP_HOME"
```

结果：

- `build` 通过。
- `lint` 通过（存在项目内既有 warning，无新增 error）。
- `tsc` 通过。
- `update --help` 与 `restart --help` 均正常输出帮助信息并以 0 退出，未再出现 `SkillsLoader` 导出缺失导致的启动崩溃。

## 发布 / 部署方式

- 本次已按标准流程完成 NPM 发布：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 发布结果：
  - `nextclaw@0.8.4`
  - `@nextclaw/core@0.6.28`
  - `@nextclaw/server@0.5.2`
- 上架校验：`npm view` 可查询到上述版本。
- 线上冒烟：在干净临时目录执行 `npx nextclaw@0.8.4 -v` 返回 `0.8.4`。
- 详细流程参考：[NPM Package Release Process](docs/workflows/npm-release-process.md)
- 本次变更不涉及后端数据库结构，不需要 migration。

## 用户 / 产品视角的验收步骤

1. 在任意机器执行 `nextclaw update`。
2. 紧接执行 `nextclaw restart`。
3. 预期：命令不再报 `SkillsLoader` 导出缺失的 SyntaxError。
4. 扩展验收：执行 `nextclaw update --help`、`nextclaw restart --help`，均能正常输出帮助。

## 影响范围 / 风险

- 影响范围：`@nextclaw/server`、`nextclaw`、`@nextclaw/core`。
- Breaking change：否。
- 回滚方式：回退上述三个文件改动并重新构建发布上一可用版本。
