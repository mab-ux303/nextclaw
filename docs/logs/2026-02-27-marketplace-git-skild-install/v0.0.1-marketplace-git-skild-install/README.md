# v0.0.1-marketplace-git-skild-install

## 迭代完成说明

- Marketplace 安装链路新增 `git` 类型技能支持：当 `kind=git` 时，服务端安装器改为执行 `npx skild install ...`。
- 安装请求新增可选字段：
  - `skill`：指定要安装的具体 skill 名称（用于 `--skill`）。
  - `installPath`：指定安装到 workspace 内的目标路径（默认 `skills/<skill>`）。
- UI 发起技能安装请求时，会附带：
  - `skill = item.slug`
  - `installPath = skills/<slug>`
- Marketplace 服务端展示过滤放宽：`skill` 条目支持 `install.kind=git` 展示与安装（不再仅限 builtin）。

## 测试/验证/验收方式

- 代码静态验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 隔离冒烟（`/tmp`）：
  - 通过 `tsx` 直接调用 `ServiceCommands.installMarketplaceSkill({ kind: 'git', ... })`，
    观察到执行 `npx skild install` 后：
    - 中间目录：`workspace/.agents/skills/<skill>`
    - 最终目标：`workspace/skills/<installPath>`
    - 最终目录存在 `SKILL.md`
- 关键行为验证点：
  - `git` 技能安装会走 `npx skild install`。
  - 命令中包含具体 skill（`--skill`）并在 workspace 下安装到指定路径。
  - 非 `git` 技能安装逻辑保持原行为（builtin/clawhub 分支不回归）。

## 发布/部署方式

1. 合并代码到主分支。
2. 按常规发布流程执行版本发布。
3. 若 marketplace 数据存在 `kind=git` 技能条目，发布后可在 UI 直接安装。

## 用户/产品视角的验收步骤

1. 进入 Skills Marketplace。
2. 选择一个 `git` 来源技能并点击安装。
3. 安装成功后，在已安装技能列表可见该技能。
4. 在 workspace 的 `skills/<slug>` 下可见 `SKILL.md`。
5. 重启/刷新后技能仍可被加载与使用。
