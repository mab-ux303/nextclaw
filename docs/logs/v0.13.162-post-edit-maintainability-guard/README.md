# v0.13.162 post-edit-maintainability-guard

## 迭代完成说明

- 新增项目内 skill `post-edit-maintainability-guard`，用于在代码改动收尾前执行可维护性自检。
- 新增可执行脚本 `.codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py`，默认检查 git working tree 中变更的代码文件，也支持通过 `--paths` 定向检查。
- 在 `AGENTS.md` 的 Project Rulebook 中新增 `post-edit-maintainability-guard-required` 规则，把该自检纳入代码任务的默认收尾动作。

## 测试/验证/验收方式

- 语法校验：`python3 -m py_compile .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py`
- 定向验证：`python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --json --no-fail --paths .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py packages/nextclaw/src/cli/commands/service.ts`
- 工作区验证：`python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --json --no-fail`

## 发布/部署方式

- 不适用。本次为仓库内治理能力与规则增强，无独立发布或部署动作。

## 用户/产品视角的验收步骤

1. 完成任意一次代码改动任务。
2. 在仓库根目录运行 `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py`。
3. 确认输出中能看到 `Inspected files`、`Errors`、`Warnings` 与每个风险文件的 `seam` 建议。
4. 当输出出现 `error` 时，确认助手会继续拆分或在最终结果中明确说明债务、原因与下一步拆分位点。
