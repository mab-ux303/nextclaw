# 迭代完成说明

- 新增 `scripts/chat-capability-smoke.mjs`，用于对运行中的 NextClaw 服务做真实 NCP 对话能力验证。
- 脚本支持传入不同的 `session type`、模型、端口或完整 `baseUrl`，并对 `/api/ncp/agent/send` 结果做结构化判断。
- 新增 `pnpm smoke:ncp-chat -- --session-type <type> --model <model> --port <port>` 命令入口。
- 新增功能验证 skill：[verifying-chat-capability](../../../.codex/skills/verifying-chat-capability/SKILL.md)。

# 测试/验证/验收方式

- `pnpm smoke:ncp-chat -- --help`
- `pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792`
- 按需改成其它 runtime，例如：
  - `pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --port 18792`

# 发布/部署方式

- 该迭代为仓库内脚本与本地 skill 能力补充，无需单独部署。
- 如需随正式版本发布，按常规 `changeset -> release:version -> release:publish` 流程进入发布链路。

# 用户/产品视角的验收步骤

1. 启动本地 NextClaw 服务。
2. 运行 `pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792`。
3. 观察输出是否为 `Result: PASS`，并确认 `Assistant Text` 非空。
4. 将 `--session-type` 切换为 `codex` 或其它 runtime，重复执行即可验证对应链路。
