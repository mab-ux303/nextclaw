# v0.14.17-dev-plugin-loader-host-alias-fix

## 迭代完成说明

- 修复 `pnpm dev start` 场景下外部 NCP runtime 插件的加载问题。
- 根因是 dev 启动链路带有 `--conditions=development`，已安装插件在 `~/.nextclaw/extensions/...` 中解析 `@nextclaw/*` 依赖时，会错误命中未随包发布的 `src/*` 入口。
- 在插件 loader 中新增宿主 `@nextclaw/*` 包别名映射，外部插件在 dev 模式下会优先复用当前宿主可解析的入口。
- 新增回归测试，覆盖“插件本地依赖副本不可运行时，仍可通过宿主别名成功注册 NCP runtime”的场景。
- 实机验证了 `session-types` 的热更新链路：install / disable / enable / uninstall 都会在运行中的服务中反映到 `/api/ncp/session-types`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/openclaw-compat exec vitest run src/plugins/loader.ncp-agent-runtime.test.ts`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C packages/nextclaw-openclaw-compat exec eslint src/plugins/loader.ts src/plugins/loader.ncp-agent-runtime.test.ts`
- 实机验证 1：
  - 使用 `NODE_OPTIONS='--conditions=development' ./node_modules/.bin/tsx watch --tsconfig tsconfig.json src/cli/index.ts serve --ui-port 19094`
  - 请求 `http://127.0.0.1:19094/api/ncp/session-types`
  - 返回 `native + codex`
- 实机验证 2：
  - 使用隔离 `NEXTCLAW_HOME` 启动服务
  - 现场验证 `native -> codex -> native -> codex -> native` 的热安装/禁用/启用/卸载切换结果

## 发布/部署方式

- 本次未发布。
- 合并后重新执行正常的版本发布流程即可，无需额外 migration。

## 用户/产品视角的验收步骤

- 运行 `pnpm dev start`
- 安装并启用 `codex sdk` 插件
- 请求 `/api/ncp/session-types`，确认返回中包含 `codex`
- 打开聊天页，确认左侧 `新增任务` 右侧出现下拉箭头
- 点击下拉菜单，确认可以创建 `Codex` 类型会话
- 在插件管理页中禁用、重新启用、卸载该插件，确认会话类型列表能在运行时同步变化
