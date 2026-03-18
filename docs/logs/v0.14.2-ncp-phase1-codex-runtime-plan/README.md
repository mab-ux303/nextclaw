# v0.14.2 NCP Phase 1 Codex Runtime Plan

## 迭代完成说明

本次新增了一份 `Phase 1` 专项方案文档，专门回答首期如何把 `Codex SDK` 接入 NCP。

新增文档：

- [NCP Phase 1: Codex SDK Runtime Integration Plan](../../plans/2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)

本次文档明确了：

- 首期范围只做 `Codex SDK`
- `Codex` 应以独立 `NcpAgentRuntime` 方式接入
- 默认 `native` 会话继续保持默认且不受影响
- 前端通过 session type 选择 runtime，但继续复用同一套 NCP 聊天 UI

## 测试/验证/验收方式

本次仅新增方案文档，未触达项目代码路径。

- `build`：不适用
- `lint`：不适用
- `tsc`：不适用
- 验证方式：人工检查文档内容、结构、命名与引用关系

## 发布/部署方式

本次无需发布或部署。

后续按该方案实施代码改动时，再在对应迭代中记录构建、验证与发布闭环。

## 用户/产品视角的验收步骤

1. 打开 [NCP Phase 1: Codex SDK Runtime Integration Plan](../../plans/2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)。
2. 确认文档已明确首期只聚焦 `Codex SDK`。
3. 确认文档已明确 `Codex` 不应伪装成 `NcpLLMApi`，而应作为独立 runtime。
4. 确认文档已明确默认 `native` 链路保持不变，前端继续复用共享 NCP UI。
