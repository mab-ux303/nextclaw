# v0.13.125-ui-router-refactor-npm-release

## 迭代完成说明（改了什么）
- 完成 UI Router 重构相关代码提交与版本发布闭环。
- 生成并消费 changeset，完成以下包版本提升：
  - `@nextclaw/server` `0.6.12` -> `0.6.13`
  - `nextclaw` `0.9.25` -> `0.9.26`
- 发布过程中修复一处阻断：
  - 为 `chat.controller.ts` 中流式方法补充显式返回类型，解决 `dts` 构建 `TS2742`。
- 发布结果（npm）：
  - `@nextclaw/server@0.6.13`
  - `nextclaw@0.9.26`
  - `@nextclaw/ncp-react@0.1.0`（流程中识别为本地版本未发布并一并发布）

## 测试/验证/验收方式
- 发布前/中执行：
  - `pnpm -C packages/nextclaw-server build`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm release:publish`（内含 `release:check` = build + lint + tsc）
- 关键观察点：
  - `changeset publish` 输出 `packages published successfully`
  - 创建 tag：
    - `@nextclaw/server@0.6.13`
    - `nextclaw@0.9.26`
    - `@nextclaw/ncp-react@0.1.0`

## 发布/部署方式
- 按项目标准 NPM 流程执行：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 本次已完成以上步骤并成功发布。

## 用户/产品视角的验收步骤
1. 在 npm 查询 `@nextclaw/server@0.6.13`、`nextclaw@0.9.26` 是否可见。
2. 全局安装并检查版本：
   - `npm i -g nextclaw@0.9.26`
   - `nextclaw --version`
3. 启动 UI 并验证核心路径：配置、聊天、会话、marketplace 路由可正常访问。
