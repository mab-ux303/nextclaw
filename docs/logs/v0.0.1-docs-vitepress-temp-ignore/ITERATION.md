# v0.0.1-docs-vitepress-temp-ignore

## 迭代完成说明（改了什么）

1. 识别并确认 `apps/docs/.vitepress` 下的生成物边界：
- `config.ts` 是文档站源码配置，应保留并纳入版本控制。
- `.temp`、`cache`、`dist` 是 VitePress 开发/构建生成目录，不应提交。

2. 补充仓库忽略规则：
- 在根目录 `.gitignore` 中新增 `apps/docs/.vitepress/.temp/`。
- 使文档开发过程中产生的临时索引与页面编译文件不再污染工作区。

3. 清理当前工作区中的临时生成目录：
- 删除 `apps/docs/.vitepress/.temp/`。

## 测试/验证/验收方式

1. 忽略规则验证
- 执行 `git check-ignore -v apps/docs/.vitepress/.temp/test.js`
- 预期：输出命中 `.gitignore` 中的 `apps/docs/.vitepress/.temp/` 规则。

2. 工作区验证
- 执行 `git status --short`
- 预期：不再出现 `apps/docs/.vitepress/.temp/` 未跟踪改动。

3. 不适用项说明
- 本次仅涉及 `.gitignore` 与临时目录清理，不涉及运行时代码、构建逻辑或类型定义，因此 `build`、`lint`、`tsc` 不适用。

## 发布/部署方式

1. 本次无需发布
- 无 npm 包发布。
- 无文档站内容变更发布。
- 无后端/Worker 部署。

2. 生效方式
- 合并后仓库本地即生效；后续 VitePress 生成 `.temp` 时将自动被 Git 忽略。

## 用户/产品视角的验收步骤

1. 打开文档工程并运行文档开发或构建命令。
2. 观察 `apps/docs/.vitepress/.temp/` 会重新生成。
3. 执行 `git status`，确认工作区不再显示 `.temp` 相关未跟踪文件。
4. 确认 `apps/docs/.vitepress/config.ts` 仍可正常保留和提交。
