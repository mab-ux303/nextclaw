# v0.12.30 24h x promo steady

## 迭代完成说明（改了什么）

- 基于最近 24 小时真实提交（2026-03-07 11:04 +08:00 至 2026-03-08 00:50 +08:00）整理对外宣发要点。
- 新增可直接发布的稳重风格 X（Twitter）宣传贴文件：
  - [24h X 宣传文案](../../marketing/2026-03-08-x-24h-progress-steady.md)
- 文案聚焦三条核心进展：Marketplace-first + D1 迁移、CLI 技能上传/更新/安装闭环、Slash 技能面板交互优化，并明确当前发布版本 `nextclaw@0.9.15`。

## 测试/验证/验收方式

- 数据来源校验（提交窗口）：
  - `git log --since='24 hours ago' --pretty=format:'%h|%ad|%s' --date=iso-strict-local`
- 版本号校验（发布信息）：
  - `node -p "require('./packages/nextclaw/package.json').version"`
  - `node -p "require('./packages/nextclaw-core/package.json').version"`
  - `node -p "require('./packages/nextclaw-server/package.json').version"`
  - `node -p "require('./packages/nextclaw-ui/package.json').version"`
- 本次仅新增文档文案，无源码逻辑改动，`build/lint/tsc` 对本次改动不适用。

## 发布/部署方式

- 本次为文档内容新增，无需 NPM 发布、服务部署或数据库迁移。
- 按需将文案文件内容复制到 X（Twitter）发布即可。

## 用户/产品视角的验收步骤

1. 打开 [24h X 宣传文案](../../marketing/2026-03-08-x-24h-progress-steady.md)，确认“推荐发布文案（中文）”可直接使用。
2. 核对文案中版本号是否为 `nextclaw@0.9.15`、`@nextclaw/core@0.7.2`、`@nextclaw/server@0.6.5`、`@nextclaw/ui@0.6.9`。
3. 将“推荐发布文案（中文）”发布到 X；若需更短内容，使用“备选精简版（中文）”。
