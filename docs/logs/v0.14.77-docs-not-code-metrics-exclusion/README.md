# v0.14.77-docs-not-code-metrics-exclusion

## 迭代完成说明（改了什么）

- 将文档站 `apps/docs` 从 code metrics 中统一排除。
- 现在默认源码 LOC 与 `repo-volume` 两种 profile 都不会再把 `apps/docs` 计入代码指标。
- 同步升级 delta 的“可比基线”判断：不仅比较 profile 名，还比较完整 scope 配置；当统计范围变化时，不再把口径切换误报成代码涨跌。
- 已重新生成 `docs/metrics/code-volume/latest.json`、`history.jsonl`、`comparison.json`，新快照中不再出现 `apps/docs` scope。

## 测试/验证/验收方式

- 默认源码 LOC 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`
  - 结果：通过；输出不再出现 `apps/docs`。
- 仓库体积口径冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm metrics:repo:local`
  - 结果：通过；输出同样不再出现 `apps/docs`。
- 静态检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm exec eslint scripts/code-volume-metrics.mjs scripts/code-volume-metrics-profile.mjs scripts/code-volume-metrics-snapshot.mjs`
  - 结果：通过。
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/code-volume-metrics.mjs scripts/code-volume-metrics-profile.mjs scripts/code-volume-metrics-snapshot.mjs`
  - 结果：通过，无告警。
- 快照回写验证：
  - `PATH=/opt/homebrew/bin:$PATH node scripts/code-volume-metrics.mjs --append-history --benchmark-name openclaw --benchmark-root ../openclaw --benchmark-include-dirs src,extensions --benchmark-output docs/metrics/code-volume/comparison.json`
  - 结果：通过；`latest.json` 中 `byScope` 已无 `apps/docs`。

## 发布/部署方式

- 本次无需额外部署。
- 合入后 GitHub workflow 与本地 `pnpm metrics:*` 会统一采用“docs 不算代码”的指标口径。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行 `PATH=/opt/homebrew/bin:$PATH pnpm metrics:local`。
2. 确认 `Top scopes by LOC` 中不再出现 `apps/docs`。
3. 执行 `PATH=/opt/homebrew/bin:$PATH pnpm metrics:repo:local`。
4. 再次确认 `apps/docs` 不会出现在 repo-volume 结果中。
5. 打开 `docs/metrics/code-volume/latest.json`，确认 `byScope` 中不存在 `apps/docs`。
