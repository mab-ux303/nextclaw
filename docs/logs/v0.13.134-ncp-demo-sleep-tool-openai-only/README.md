# v0.13.134-ncp-demo-sleep-tool-openai-only

## 迭代完成说明

- 为 `apps/ncp-demo/backend` 新增 `sleep` 工具，支持通过 `durationMs` 让 agent 在工具调用阶段暂停一小段时间。
- `ncp-demo` backend 改为 openai-only：删除 mock LLM 实现与 `NCP_DEMO_LLM_MODE` 分支，启动时强制要求 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`（或 `base_url`）。
- demo backend 现在同时注册 `get_current_time` 与 `sleep` 两个工具。
- 更新前端输入框文案与 demo smoke 脚本，去掉“会先调用 get_current_time/mock 模式”的旧表述。
- 更新 `apps/ncp-demo/backend/.env.example`，使示例配置与 openai-only 现状保持一致。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/frontend build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/backend exec tsx --tsconfig tsconfig.json` 直接执行 `sleep` 工具，验证其会按给定毫秒数返回结果。
- 未执行 `apps/ncp-demo` 的完整 E2E smoke：当前 smoke 已改为 real-LLM 前提，执行会真实调用外部模型服务。

## 发布/部署方式

- 本次未执行正式发布。
- 若要本地运行 `ncp-demo`，先在 `apps/ncp-demo/backend/.env` 中配置 `OPENAI_API_KEY` 与 `OPENAI_BASE_URL`（或 `base_url`），再执行现有 `pnpm dev:ncp-demo` 或 `pnpm -C apps/ncp-demo dev`。
- 若仅启动 backend，沿用现有 `pnpm -C apps/ncp-demo/backend dev` 或 `start` 命令即可。

## 用户/产品视角的验收步骤

1. 在 `apps/ncp-demo/backend/.env` 中配置真实 OpenAI-compatible 模型环境变量。
2. 启动 `ncp-demo` 前后端。
3. 在聊天框输入“先 sleep 2000ms，再告诉我你醒了”之类的提示，确认消息中出现 `sleep` 工具调用，并在等待后返回结果。
4. 再输入“告诉我 Asia/Shanghai 当前时间”，确认 `get_current_time` 工具仍可正常调用。
5. 清空环境变量后重启 backend，确认进程会直接报缺少 `OPENAI_API_KEY` / `OPENAI_BASE_URL`，不再悄悄回退 mock。
