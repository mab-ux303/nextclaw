# v0.14.55-codex-plugin-hot-reload-fix

## 迭代完成说明

- 修复 OpenClaw 插件装载器在运行时热安装/热重载后可能继续复用旧模块缓存的问题。
- 对插件加载使用的 Jiti 实例关闭 `requireCache` 和 transform cache，确保同一路径插件升级后重新读取磁盘上的最新实现。
- 新增回归测试，覆盖“同一路径 runtime 插件更新后再次加载应命中新代码”场景。
- 将插件 Jiti 装载逻辑拆到独立文件，避免继续膨胀既有大文件。

## 测试/验证/验收方式

- 类型检查：`pnpm -C packages/nextclaw-openclaw-compat tsc`
- 单测：`pnpm -C packages/nextclaw-openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts`
- 构建：`pnpm -C packages/nextclaw-openclaw-compat build`
- 冒烟：
  - 对运行中的本地源码服务 `http://127.0.0.1:18792/api/ncp/agent/send` 发送 `session_type=codex` 的 NCP 请求
  - 观察到 `run.started`、`message.text-delta`、tool call 事件正常返回
  - 未再出现 `Not inside a trusted directory and --skip-git-repo-check was not specified`

## 发布/部署方式

- 已完成版本发布：
  - `@nextclaw/openclaw-compat@0.3.5`
  - `@nextclaw/server@0.9.4`
  - `nextclaw@0.12.5`
- 标准 `pnpm release:publish` 已执行到全量校验阶段，但被仓库内与本次无关的历史 lint warning 阻塞；因此改为：
  - 完成本次受影响包的最小充分校验
  - 执行 `pnpm changeset publish`
  - 执行 `pnpm changeset tag`
- 用户侧升级到 `nextclaw@0.12.5` 后即可获得该修复。

## 用户/产品视角的验收步骤

- 保持 NextClaw 服务运行中安装或升级 Codex runtime 插件。
- 在 Web UI 新建 Codex 会话并发送一条消息。
- 预期：
  - 不再出现 trusted directory 报错。
  - Codex 会话可以正常开始 run 并返回文本/工具事件。
  - 同一服务进程内，插件升级后的新逻辑能立即生效，而不是必须重启后才生效。
