# v0.14.117-remote-instance-sharing-design

## 迭代完成说明

- 新增远程实例分享落地方案设计文档：[NextClaw Remote Instance Sharing Design](../../plans/2026-03-22-nextclaw-remote-instance-sharing-design.md)
- 将对外主术语从 `device` 收敛为 `instance`
- 明确当前阶段只做三类核心对象：`instance`、`share-grant`、`access-session`
- 明确访问模型采用“分享 URL + 访问会话 URL”双层结构，而不是固定实例域名
- 明确分享撤销语义：撤销 `share-grant` 后，已打开的派生分享会话必须立即失效

## 测试/验证/验收方式

- 文档结构检查：确认方案文档包含目标、非目标、术语、对象模型、URL 设计、时序、接口草案、撤销语义、MVP 范围
- 规则适配检查：确认新文档对外统一使用 `instance` 作为主术语，并明确说明历史 `device` 字段仅属实现遗留
- 验证结论：
  - `build` 不适用：本次未触达代码、构建链路或运行链路
  - `lint` 不适用：本次仅新增设计文档
  - `tsc` 不适用：本次未触达 TypeScript 源码

## 发布/部署方式

- 本次为设计文档沉淀，无需发布包、部署服务或执行 migration
- 后续进入实现阶段时，应以本次设计文档为需求边界，分别落平台、relay 与本地实例侧改造

## 用户/产品视角的验收步骤

1. 打开设计文档：[NextClaw Remote Instance Sharing Design](../../plans/2026-03-22-nextclaw-remote-instance-sharing-design.md)
2. 确认产品术语已从“设备”切换为“实例”
3. 确认方案支持“同一浏览器同时访问多个远程实例”
4. 确认方案支持“通过分享 URL 让其他人访问实例”
5. 确认方案未引入权限系统、角色系统或只读/可编辑区分
6. 确认方案要求“撤销分享后，已打开的分享会话立即失效”
