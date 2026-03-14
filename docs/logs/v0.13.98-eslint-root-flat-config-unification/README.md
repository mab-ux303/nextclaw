# v0.13.98-eslint-root-flat-config-unification

## 迭代完成说明（改了什么）

- 新增仓库根级 `eslint.config.mjs`，统一 `apps/*`、`packages/*`、`packages/extensions/*`、`workers/*` 的 ESLint 配置入口。
- 将原有分散在各包的 `.eslintrc.cjs` 与 `workers/*/eslint.config.mjs` 全部移除，避免规则漂移与多套配置并存。
- ESLint 相关依赖统一收敛到根 `package.json`（ESLint 9 + Flat Config 体系），并清理各子包重复 ESLint 依赖。
- 保留并映射少数目录差异规则：
  - `packages/nextclaw-ui` 保留 React Hooks 与 UI 组件函数行数特例。
  - `packages/nextclaw-openclaw-compat` 与 engine plugin 包保留 `no-explicit-any`/`no-unused-vars` 的历史策略。
  - `apps/platform-*` 保持不强制 `consistent-type-imports`。
- 更新 `pnpm-lock.yaml` 以反映依赖收敛结果。

## 测试/验证/验收方式

- 执行命令：`pnpm install`
- 执行命令：`pnpm lint`
- 验证结果：
  - `pnpm lint` 全链路执行完成并通过（exit code 0）。
  - 当前仓库仍有历史 warning（如 `max-lines`、`max-lines-per-function`），但无 error，不影响本次配置收敛交付。
- 不适用说明：
  - `build`/`tsc` 本次不适用，原因是本次仅触达 lint 配置链路与依赖收敛，未改动构建/运行时代码路径。
  - 冒烟测试不适用，原因是本次无新增或修改用户可见运行行为。

## 发布/部署方式

- 本次属于工程配置收敛改动，无独立部署动作。
- 按常规提交流程合入后，后续发布沿用既有发布闭环流程。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `pnpm lint`，确认所有包使用同一根配置完成 lint，且命令可跑通。
2. 随机抽查任意两个包目录（如 `packages/nextclaw-core`、`workers/marketplace-api`），确认目录内已无本地 ESLint 配置文件。
3. 新建一个子包源码文件并运行该包 `lint` 脚本，确认无需新增包级配置即可继承根规则。
