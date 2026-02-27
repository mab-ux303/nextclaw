# 2026-02-27 v0.0.1-backend-marketplace-hard-decouple

## 迭代完成说明（改了什么）

- 后端 Marketplace 路由从“单一 typed 循环 + type 分发”改为“两套独立注册”：
  - `plugins` 路由独立注册与独立处理。
  - `skills` 路由独立注册与独立处理。
- 安装链路彻底拆分：
  - 删除共享 `installMarketplaceItem`。
  - 新增 `installMarketplacePlugin` 与 `installMarketplaceSkill` 两套独立执行函数。
- 管理链路彻底拆分：
  - 删除共享 `manageMarketplaceItem`。
  - 新增 `manageMarketplacePlugin` 与 `manageMarketplaceSkill` 两套独立执行函数。
- 类型层彻底拆分：
  - 删除共享 `MarketplaceInstallRequest/Result`、`MarketplaceManageRequest/Result`、`MarketplaceManageAction`。
  - 新增插件/技能专用请求与响应类型：
    - `MarketplacePluginInstallRequest/Result`
    - `MarketplaceSkillInstallRequest/Result`
    - `MarketplacePluginManageRequest/Result`
    - `MarketplaceSkillManageRequest/Result`
- 兼容性与行为保持：
  - typed 路由仍严格校验 `body.type` 与路径类型一致性（不一致返回 `400`）。
  - `/api/marketplace/recommendations` 共享路由仍不存在（保持 `404`）。

## 测试 / 验证 / 验收方式

- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server build`
- 代码检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server lint`
- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server tsc`
- 冒烟（路由行为）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- run src/ui/router.marketplace-manage.test.ts`
  - 观察点：
    - typed route 对 `body.type` 错配返回 `400`。
    - `/api/marketplace/recommendations` 返回 `404`。
    - `/api/marketplace/plugins/recommendations` 代理到 `/api/v1/plugins/recommendations`。

## 发布 / 部署方式

- 本次仅后端路由与类型结构重构，不涉及数据库 schema 与 migration。
- 发布方式：按常规 npm/服务发布流程发布包含该变更的版本并重启 gateway/ui 进程。
- 远程 migration：不适用。

## 用户 / 产品视角的验收步骤

1. 打开 Marketplace 插件页，执行安装/启用/禁用/卸载，确认行为正常。
2. 打开 Marketplace 技能页，执行安装/卸载，确认行为正常。
3. 分别调用：
   - `POST /api/marketplace/plugins/manage`（`type=skill`）
   - `POST /api/marketplace/skills/manage`（`type=plugin`）
   确认均返回 `400`。
4. 调用 `GET /api/marketplace/recommendations`，确认 `404`。
5. 调用 `GET /api/marketplace/plugins/recommendations` 与 `GET /api/marketplace/skills/recommendations`，确认各自独立可用。
