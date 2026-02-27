# 2026-02-27 v0.0.1-marketplace-bird-su-skill

## 迭代完成说明（改了什么）

- 在 Marketplace Worker 数据源新增 1 个 Skills 条目：`bird-su`。
- 条目来源：`openclaw/skills` 仓库的 `skills/iqbalnaveliano/bird-su/SKILL.md`。
- 安装方式采用现有 Git Skill 机制：
  - `install.kind = git`
  - `install.spec = openclaw/skills/skills/iqbalnaveliano/bird-su`
  - `install.command = npx skild install openclaw/skills/skills/iqbalnaveliano/bird-su --target agents --local --skill bird-su`
- 同步更新 `catalog.generatedAt`。

## 测试 / 验证 / 验收方式

- 数据校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api validate:catalog`
- 构建校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api build`
- Lint 校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api lint`
- TypeScript 校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api tsc`
- 冒烟（隔离目录 `/tmp`，只读检查 catalog）：
  - `cd /tmp && PATH=/opt/homebrew/bin:$PATH node -e "..."`
  - 观察点：`bird-su` 条目存在且 `type=skill`、`install.kind=git`。

## 发布 / 部署方式

1. 合并变更到 `main/master`。
2. 触发 Marketplace Worker 发布流程（按 [marketplace-worker-deploy](docs/workflows/marketplace-worker-deploy.md)）。
3. 发布后验证线上 Skills 列表可检索到 `bird-su`。

## 用户 / 产品视角的验收步骤

1. 打开 Skills Marketplace 页面。
2. 搜索 `bird-su` 或 `bird`。
3. 确认可看到条目 `Bird SU`。
4. 点击安装，确认安装成功提示。
5. 在已安装技能中确认该条目出现，并可执行卸载。
