# v0.12.23-chat-skill-search-ranking

## 迭代完成说明（改了什么）
- 优化聊天 slash skills 面板搜索逻辑：从单一 `includes` 过滤升级为分层评分检索。
- 新增可解释的匹配优先级：`精确匹配 > 前缀匹配 > 词前缀匹配 > 包含匹配 > 弱模糊(子序列)`。
- 新增稳定排序策略：按分数降序，再按名称自然排序（`Intl.Collator`），最后按原始顺序兜底，避免抖动。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；存在仓库已有错误（`useChatStreamController.ts`、`MaskedInput.tsx`），非本次引入。

## 发布/部署方式
- 本次为 UI 逻辑优化，按既有前端发布流程执行（changeset/version/publish 或项目内统一发布流程）。

## 用户/产品视角的验收步骤
- 在聊天输入框输入 `/` 并继续输入关键字（如 skill spec 前缀、label 关键词、描述关键词）。
- 观察列表排序：更精确匹配项应稳定排在前面。
- 输入有轻微拼写偏差时（子序列仍可命中），仍应出现合理候选。
- 上下键选择并回车，行为应与优化前一致（可正常添加 skill）。
