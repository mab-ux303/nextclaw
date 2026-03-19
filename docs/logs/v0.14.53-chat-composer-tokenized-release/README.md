# 迭代完成说明

- 完成 chat composer tokenized surface 相关包的版本发布闭环。
- 已发布目标包：
  - `@nextclaw/agent-chat-ui@0.2.1`
  - `@nextclaw/ui@0.9.1`
  - `nextclaw@0.12.4`
- 同步更新 `nextclaw` 内置 `ui-dist` 产物，使仓库中的发布产物与线上发布版本一致。
- 发布过程中，仓库全量 `release:publish` 被历史遗留 lint 问题阻塞；改为在完成受影响包最小充分验证后，执行 `changeset publish` 完成目标包发布。过程中还碰到两个无关包的重复发布冲突：
  - `@nextclaw/mcp@0.1.1`
  - `@nextclaw/ncp-mcp@0.1.1`
  但不影响本次目标包发布成功。

# 测试/验证/验收方式

- 受影响包验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-composer-dom.utils.test.ts src/components/chat/ui/chat-input-bar/chat-composer-controller.test.ts src/components/chat/ui/chat-input-bar/chat-composer-keyboard.utils.test.ts src/components/chat/ui/chat-input-bar/chat-composer.utils.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`
- 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw dev:build --version`
  - 结果：输出 `0.12.4`
- 线上版本校验：
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/agent-chat-ui version`
  - `PATH=/opt/homebrew/bin:$PATH npm view @nextclaw/ui version`
  - `PATH=/opt/homebrew/bin:$PATH npm view nextclaw version`
  - 结果分别为：`0.2.1`、`0.9.1`、`0.12.4`
- git tag 校验：
  - `@nextclaw/agent-chat-ui@0.2.1`
  - `@nextclaw/ui@0.9.1`
  - `nextclaw@0.12.4`

# 发布/部署方式

- 本次采用发布闭环：
  1. `pnpm release:version`
  2. 提交版本 bump
  3. `pnpm changeset publish`
  4. 校验 npm 线上版本与 git tag
- 未涉及后端或数据库变更，远程 migration 不适用。
- 未涉及服务部署，远程 deploy 不适用。

# 用户/产品视角的验收步骤

1. 安装或升级 `nextclaw@0.12.4` 后打开 chat 输入框。
2. 通过 slash 选择 skill，确认 skill 以内联 token 形式出现在输入框中，而不是独立分离展示。
3. 在已有 skill token 的情况下继续输入英文、中文和删除内容，确认 token 不会丢失，中文输入法也能正常联想。
4. 确认 token 视觉密度更紧凑，更接近简约的 Cursor/Codex 风格。
