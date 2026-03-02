# v0.0.1-react-component-max-lines

## 迭代完成说明（改了什么）
- 调整 `packages/nextclaw-ui/.eslintrc.cjs` 的函数行数规则：
  - 全局 `max-lines-per-function` 继续保持 `150`。
  - 对 React 组件文件增加 `overrides`：`src/components/**/*.tsx` 与 `src/App.tsx` 使用 `300`。
- 目标：放宽 React 函数组件体积限制，同时不影响其它非组件函数的约束。

## 测试/验证/验收方式
- 在仓库根目录执行：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 验证点：
  - 命令全部成功退出。
  - `packages/nextclaw-ui` 中组件文件按 300 行阈值告警，其它函数仍按 150 行阈值告警。

## 发布/部署方式
- 本次为 lint 规则配置变更，无运行时代码改动。
- 按常规流程合并后，跟随下一次正常版本发布，无额外部署步骤。

## 用户/产品视角的验收步骤
- 在 UI 包中新建或编辑一个 React 组件（位于 `src/components/**/*.tsx`），将单函数体控制在 151~300 行。
- 运行 `pnpm -C packages/nextclaw-ui lint`：
  - 该组件不应触发 `max-lines-per-function` 的 150 行告警。
- 在非组件文件（如 `.ts` 或非 `src/components/**/*.tsx` 的函数）制造超过 150 行函数体：
  - 仍应触发 `max-lines-per-function` 告警。
