---
name: post-edit-maintainability-guard
description: 在本仓库完成代码、脚本、测试或影响运行链路的配置改动后使用，用于自检可维护性漂移，重点发现超长文件和持续膨胀的文件。
---

# Post Edit Maintainability Guard

## 概述

在本仓库中，只要任务触达代码，就应在收尾阶段使用这个 skill。它把“记得保持可维护性”变成可重复执行的检查，并给出明确的长度预算与阻塞条件。

这个 skill 不替代 `build`、`lint`、`tsc` 或冒烟测试。它补的是“可维护性闸门”，重点关注文件膨胀、超长文件漂移，以及是否已经到达必须拆分的时点。

## 何时使用

- 修改了源码、脚本、测试，或影响运行链路的配置之后。
- 尤其适用于触达 `service`、`controller`、`manager`、`runtime`、`loop`、`router`、`Page`、`App`，以及大型表单/容器组件时。
- 任何代码改动任务在最终回复前都应执行一次。

纯文档、措辞微调或元信息小改动不适用；这类情况要明确说明“本次不适用”。

## 执行流程

1. 先判断本次任务是否触达代码路径。
2. 默认执行：

```bash
python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py
```

3. 如果只检查特定文件，执行：

```bash
python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths path/to/file.ts path/to/file.tsx
```

4. 以下情况默认视为阻塞项：
- 新文件直接超出预算。
- 文件从预算内增长到预算外。
- 文件原本已超预算，这次改动后还在继续增长。

5. 以下情况默认视为警告：
- 文件已经逼近预算线，进入预算的 80% 以上。
- 文件本次增长明显，但尚未超预算。

6. 出现阻塞项时，默认应继续拆分后再结束任务；除非用户明确接受这笔债务。若保留债务，必须说明原因、指出下一步拆分缝，并在最终回复中写明风险。

## 预算规则

- 默认源码文件：400 行。
- `service` / `controller` / `manager` / `runtime` / `loop` / `router` / `provider`：600 行。
- React 页面或 App 入口：650 行。
- UI 组件 / form / dialog / panel：500 行。
- 测试文件：900 行。
- `types` / `schema` / `constants` / 纯配置文件：900 行。

预算只是启发式边界，不代表文件低于预算就一定设计良好。即使文件没超限，只要职责明显混杂，也应指出风险。

## 输出约定

运行这个 skill 后，输出里必须包含：

- 本次检查是否适用
- 实际检查了哪些文件
- 是否存在阻塞项
- 是否存在值得跟踪的警告
- 每个风险文件的下一步拆分位点

## 资源

- `scripts/check_maintainability.py`：用于检查变更文件或指定文件的确定性可维护性自检脚本
