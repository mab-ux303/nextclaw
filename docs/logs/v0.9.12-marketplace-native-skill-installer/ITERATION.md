# 迭代完成说明

- 将 `nextclaw` marketplace 的 `git` skill 安装从 `skild/@skild/core` 彻底迁移为 NextClaw 原生实现。
- 新实现不再依赖 `skild` 生态，不再写入 `.agents/skills`，只安装到 NextClaw 自己的工作区 `skills/<skill>` 目录。
- 安装方式改为：解析 marketplace 提供的 GitHub skill 源 → 使用 `git clone --depth 1 --filter=blob:none --sparse` 拉取仓库 → `git sparse-checkout set <skill-path>` 只物化目标 skill 子目录 → 校验 `SKILL.md` → 复制到工作区 `skills/<skill>`。
- 卸载逻辑同步收敛：仅删除工作区 `skills/<skill>`，不再处理 `.agents/skills`。
- 新增回归测试，覆盖：
  - 已安装时跳过二次物化
  - 物化后的 git skill 正确复制到 `skills/`
  - 卸载仅移除 `skills/`
- 移除 `packages/nextclaw` 对 `@skild/core` 的依赖。

# 测试/验证/验收方式

- 单测：`pnpm -C packages/nextclaw test -- --run src/cli/commands/service.marketplace-skill.test.ts`
- 构建：`pnpm -C packages/nextclaw build`
- Lint：`pnpm -C packages/nextclaw lint`
  - 结果：无 error；保留既有 `max-lines` / `max-lines-per-function` warning，仅来自历史长文件。
- 类型检查：`pnpm -C packages/nextclaw tsc`
- 冒烟（隔离目录，未写仓库）：
  - 使用 `/tmp/nextclaw-ui-skill-smoke-*` 作为 `NEXTCLAW_HOME` 与 workspace
  - 通过 UI router 的 `POST /api/marketplace/skills/install` 安装 `anthropics/skills/skills/pdf`
  - 观察点：
    - HTTP 状态为 `200`
    - 返回 `ok: true`
    - 返回消息为 `Installed skill: pdf`
    - `/tmp/.../workspace/skills/pdf/SKILL.md` 存在
    - `/tmp/.../workspace/.agents/skills/pdf/SKILL.md` 不存在

# 发布/部署方式

- 本次仅完成本地代码修复与验证，未执行发布。
- 如需发布，按项目既有发布流程对 `packages/nextclaw` 做版本变更与发布。
- 远程 migration：不适用（无后端/数据库变更）。
- 线上 API 冒烟：不适用（本次未发布线上服务）。

# 用户/产品视角的验收步骤

- 启动本地 `nextclaw` UI。
- 打开 marketplace 的 Skills 页面。
- 找到 `pdf`、`docx`、`pptx`、`xlsx`、`bird` 等 `git` 来源 skill，点击“安装”。
- 预期结果：
  - 不再出现 `path argument ... Received undefined` 报错。
  - 安装成功提示正常出现。
  - 对应 skill 出现在已安装列表。
  - 工作区仅生成 `skills/<skill>`，不生成 `.agents/skills/<skill>`。
