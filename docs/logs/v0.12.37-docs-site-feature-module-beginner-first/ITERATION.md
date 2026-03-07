# v0.12.37-docs-site-feature-module-beginner-first

## 1) 迭代完成说明（改了什么）

本次仅优化文档站 `apps/docs` 中侧边栏「功能」模块（中文）的 6 个页面，不改 PRD/内部文档：

- `apps/docs/zh/guide/chat.md`
  - 改为“能力 + 新手建议 + 相关文档”结构。
  - 移除命令示例，保留命令文档跳转作为进阶入口。
- `apps/docs/zh/guide/channels.md`
  - 改为“先跑通一个渠道”的新手流程。
  - 将复杂配置下沉到“进阶配置（可选）”。
- `apps/docs/zh/guide/secrets.md`
  - 从 CLI 步骤改为 UI 优先路径。
  - 仅保留一句 `nextclaw secrets` 进阶入口说明。
- `apps/docs/zh/guide/tools.md`
  - 改为“信息获取类 / 执行动作类”能力说明。
  - 移除配置代码块，保留安全建议与进阶链接。
- `apps/docs/zh/guide/cron.md`
  - 改为“自动化目标 + UI 使用顺序 + Heartbeat 说明”。
  - 不再内联 cron 命令示例。
- `apps/docs/zh/guide/sessions.md`
  - 增补新手整理建议与场景化说明。
  - 保留命令页作为进阶参考链接。

同时回退了本轮误触范围的内部文档改动，确保本次只聚焦文档站“功能”模块。

## 2) 测试/验证/验收方式

已执行：

- `pnpm -C apps/docs build`：通过（文档站点构建冒烟）
- `pnpm lint`：通过（存在仓库既有 warning，无 error）
- `pnpm tsc`：通过

## 3) 发布/部署方式

- 本次为文档站内容更新，不涉及 npm 包发布、数据库迁移或服务部署。
- 如需对外生效，按 docs 站点既有发布流程发布即可。

## 4) 用户/产品视角的验收步骤

1. 打开文档站中文侧边栏「功能」分组的 6 个页面。
2. 确认页面先讲“用户能做什么/如何操作”，不以命令清单开篇。
3. 确认页面中无大段命令示例，命令行仅作为“进阶入口”出现。
4. 确认相关页仍保留跳转到 [命令](/zh/guide/commands) 以支持进阶用户。
