# v0.13.73-tool-loop-empty-final-response-fix

## 迭代完成说明（改了什么）

- 修复 `chat completions` 解析层对 `message.content` 仅按字符串处理的问题：新增内容归一化，兼容数组/对象文本块（如 `[{type:"output_text",text:"..."}]`、`{text:{value:"..."}}`），避免出现“模型已给出文本但被判定为空”的误判。
- 修复 `responses` SSE 解析优先级：当返回 event-stream 时，优先提取 `response` 正文（尤其是 `response.completed` 内的 `response`），避免把事件壳当最终 payload 导致 `output` 丢失。
- 修复工具循环兜底文案可观测性：
  - 真正打满上限时，显示真实迭代次数。
  - 提前结束但无最终文本时，改为 `tool call flow ended without a final response`，不再误报 `after 1000 iterations`。
  - 当最后一轮模型返回“无 tool call + 空文本”时，附加 `finishReason` 诊断片段，便于判断是“空终态”而非异常抛错。
- 增强原始错误可排查性：工具执行异常仍对模型返回精简错误文案，但同时输出服务端日志（含原始 Error 对象），避免仅凭前端提示无法定位根因。
- 增强“错误直出给用户”能力并加统一限长：
  - CLI/通道主循环、UI Chat API/流式错误事件，统一透出错误 message（截断为 320 字符以内）。
  - 保留用户侧可读性，同时避免超长异常文本淹没对话。
- 新增测试：
  - `chat-completions-normalizer` 增加数组/对象 content 归一化用例。
  - `openai_provider` 增加 SSE `response.completed` 解包与优先提取用例。

## 测试 / 验证 / 验收方式

- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --dir packages/nextclaw-core exec vitest run src/providers/chat-completions-normalizer.test.ts src/providers/openai_provider.test.ts`
  - 结果：2 个测试文件通过（7/7）。
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --dir packages/nextclaw-core build`
  - 结果：通过。
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --dir packages/nextclaw-core lint`
  - 结果：通过（仅历史 warning：`max-lines` / `max-lines-per-function`，无新增 error）。
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --dir packages/nextclaw-core tsc`
  - 结果：通过。
- 冒烟（非仓库目录，不写入仓库）：
  - 使用临时 `NEXTCLAW_HOME` / `NEXTCLAW_WORKSPACE` + Fake Provider 复现“首轮 tool call、次轮空内容无 tool call”路径。
  - 观察点：返回 `Sorry, tool call flow ended without a final response... Last model output was empty (finishReason: stop)`，不再出现误导性的 `after 1000 iterations`。
- 错误透出限长验证：
  - 构造超长错误 message（>320 chars）触发 `CHAT_TURN_FAILED` / `Sorry, I encountered an error` 路径。
  - 观察点：用户可见错误保留核心信息，并被截断到约 320 字符。

## 发布 / 部署方式

- 本次为核心解析与兜底文案修复，当前仅完成本地验证，未执行 npm 发布。
- 若需要发布，按项目发布流程执行：`changeset -> version -> publish`。
- 本次不涉及数据库/后端 migration，`migration` 不适用。

## 用户 / 产品视角的验收步骤

1. 在支持工具调用的模型上发起“先调工具再总结”的请求（如创建 cron 后要求给一句确认）。
2. 观察返回：
   - 正常情况下应得到自然语言确认，而不是直接兜底错误。
3. 若上游确实返回空终态：
   - 提示应为 `tool call flow ended without a final response`，不应误导为 `after 1000 iterations`（除非确实打满上限）。
