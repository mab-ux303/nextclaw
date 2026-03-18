# v0.14.1 NCP Pluggable Agent Runtime Plan

## 迭代完成说明

本次新增了一份聚焦方案文档，用于明确 Nextclaw 在 NCP 主体系下支持多种 agent runtime 的长期结构。

新增文档：

- [NCP Pluggable Agent Runtime Plan](../../plans/2026-03-19-ncp-pluggable-agent-runtime-plan.md)

本次方案明确了以下共识：

- 默认会话仍然使用当前内建的 NCP-native runtime
- `Codex SDK`、`Claude Code` 等未来 runtime 应走可插拔扩展，而不是绑进默认主包
- 前端通过会话类型选择不同 runtime，但共享同一套 NCP 聊天 UI 与事件链路
- 当选择 NCP 链路时，除存储层外，更上的层仍应基于 NCP 体系

## 测试/验证/验收方式

本次仅新增方案文档，未触达项目代码路径。

- `build`：不适用
- `lint`：不适用
- `tsc`：不适用
- 验证方式：人工检查文档内容、命名、引用关系与方案一致性

## 发布/部署方式

本次无需发布或部署。

后续若按该方案实施，应在实际代码改动迭代中分别记录实现、验证与发布步骤。

## 用户/产品视角的验收步骤

1. 打开 [NCP Pluggable Agent Runtime Plan](../../plans/2026-03-19-ncp-pluggable-agent-runtime-plan.md)。
2. 确认文档已回答“默认 runtime 与外部 runtime 如何共存”的问题。
3. 确认文档已明确 `Codex`、`Claude Code` 等未来能力应为可插拔扩展，而非默认内建。
4. 确认文档已明确前端是通过“会话类型选择 runtime”，而不是为不同 runtime 分裂出多套 UI。
