# v0.0.1-nextclaw-2026-03-05-progress-social-post

## 迭代完成说明（改了什么）

### 统计口径（本次改为严格 24 小时）
- 时间窗口：`2026-03-04 23:13:36 +0800` 到 `2026-03-05 23:13:36 +0800`。
- 数据来源：`git log --since='24 hours ago'` + 工作区未提交变更（`git status --short`）+ 当日 `docs/logs/2026-03-05-*` 迭代文档。
- 结论：此前版本是“亮点摘要”，本次已补齐为“24 小时全量整理”。

### 24 小时内已提交进展（15 commits）
1. 聊天与会话主链路：
- `feat(chat): improve model/skill UX and stabilize stop flow`
- `refactor main workspace routing and stabilize chat session navigation`
- `Remove chat history loading placeholder in conversation panel`
- `feat: backend-manage chat runs with reconnect and recovery`

2. Provider / 网关 / 启动稳定性：
- `feat: add built-in nextclaw llm gateway provider and one-click worker deploy`
- `fix(start): extend service readiness wait for slow startup`

3. 发布与版本推进：
- `chore(release): publish unified minor npm release`
- `chore(release): publish nextclaw 0.9.1 and ui 0.6.1`
- `chore(release): bump nextclaw to 0.9.3`
- `chore(release): publish nextclaw 0.9.7`
- `release: publish nextclaw 0.9.7 and ui 0.6.5`
- `release: publish markdown list marker parity`

4. 文档与规则：
- 架构文档与 ChatPage 拆分维护性改进（commit `9dc94e9`）
- `meta: clarify logs iteration directory naming`
- `chore(metrics): update code volume snapshot [skip ci]`

### 24 小时内未提交但已落地在工作区的迭代进展（按文档）
1. Chat UX 连续优化：
- 首屏阻塞配置卡片改为非阻塞提示（`chat-provider-setup-nonblocking`）。
- 右侧主区域 skeleton（`chat-right-panel-skeleton`）。
- 输入区 loading/empty 状态分离后又进一步收敛为 skeleton（`chat-input-loading-vs-empty` + `chat-input-loading-skeleton`）。
- Markdown 渲染升级与列表 marker 修复（`chat-markdown-world-class` v0.0.1/v0.0.2）。
- 会话运行态从“文字徽标”升级到“轻量指示器”，并固定槽位防抖动（`session-list-run-status` + `session-status-indicator-lightweight`）。

2. Provider Gateway 路线推进（`nextclaw-builtin-provider-gateway`）：
- v0.0.1 方案定稿；
- v0.0.2 内置 provider MVP；
- v0.0.3 一键部署 worker；
- v0.0.4 自定义域名迁移；
- v0.0.5 数据驱动 + 插件化基础方案收敛。

3. 文档与品牌：
- 新手优先文档 IA 重排（`docs-beginner-first-advanced-split`）。
- 配置后路径与资源页建设及后续收敛（`post-setup-resource-hub`、`skills-resource-hub`、`skills-resource-hub-update`、`openclaw-link-prune`、`after-setup-openclaw-community`）。
- 中文品牌语气调整（`brand-copy-tone-adjust`）。

4. 工程流程与传播：
- 产品截图一键自动化 + CI 自动刷新 PR（`product-screenshot-automation`）。
- 发布传播素材沉淀（`release-communication`）。
- 启动链路降级模式与可观测性增强（`start-service-readiness-timeout`、`start-degraded-mode`）。

### 中文推特/X 帖子（可直接发）
NextClaw 过去 24 小时进展（截至 2026-03-05 23:13 +0800）：

1）聊天运行态已切到后端真源，支持断线重连与会话恢复。  
2）会话状态提示升级为轻量指示器，列表布局更稳定。  
3）内置 Provider Gateway 连续推进：MVP、一键部署、自定义域名、插件化/数据驱动方案收敛。  
4）文档与引导改为“新手优先”路径，配置后学习路径更清晰。  
5）产品截图流程已一键自动化并接入 CI 定时刷新。  
6）版本与对外发布节奏持续推进（含 nextclaw / @nextclaw/ui 多次发布）。  

持续高频交付中。  
#NextClaw #AIInfra #开源 #开发者工具

## 测试/验证/验收方式
1. 24 小时提交校验：
- `git log --since='24 hours ago' --pretty=format:'%h|%ad|%an|%s' --date=iso`

2. 工作区进展校验：
- `git status --short`
- `find docs/logs/2026-03-05-* -type f -name 'ITERATION.md'`

3. 文档结构校验：
- 目录命名符合 `v<semver>-<slug>`，本记录位于 `docs/logs/v0.0.1-nextclaw-2026-03-05-progress-social-post/ITERATION.md`。

## 发布/部署方式
- 本次文件用于“进展整理 + 对外文案”，自身无需部署。
- 对外发布时直接复用本文件“中文推特/X 帖子（可直接发）”段落。

## 用户/产品视角的验收步骤
1. 用上面的 `git log` 与 `git status` 命令核对 24 小时窗口数据。
2. 对照本文件“已提交/未提交”两部分确认无遗漏主题。
3. 复制“中文推特/X 帖子”并发布。
4. 发布后如需“精简版（140-180 字）”，基于同一要点做长度压缩，不改事实。
