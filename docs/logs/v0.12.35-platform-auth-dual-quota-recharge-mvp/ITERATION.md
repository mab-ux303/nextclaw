# v0.12.35-platform-auth-dual-quota-recharge-mvp

## 1) 迭代完成说明（改了什么）

本次将 `nextclaw-provider-gateway-api` 从“匿名体验额度”升级为“登录平台 + 双额度 + 充值 + 管理端”的严肃平台 MVP，并补齐独立控制台前端。

- 后端（Worker）
  - 登录体系：新增 `register/login/me`，登录后签发 Bearer token，`/v1/*` 调用必须携带登录 token。
  - 双额度模型：
    - 用户个人免费额度（`users.free_limit_usd/free_used_usd`）
    - 全平台总免费额度池（`platform_settings.global_free_limit_usd/global_free_used_usd`）
  - 计费逻辑：一次请求成本可由“免费额度 + 付费余额”混合承担；任一不足返回 `insufficient_quota`。
  - 充值闭环：新增充值申请（用户侧）+ 审核通过/拒绝（管理侧）+ 入账流水。
  - 管理 API：平台总览、用户列表与手动调账、充值审核、全局免费池上限配置。
  - 数据存储：新增 D1 表（`users/platform_settings/usage_ledger/recharge_intents`）并提供 migration。
- 前端（新增独立应用）
  - 新增 `apps/platform-console`（React + TypeScript + Tailwind + TanStack Query + Zustand，shadcn 风格组件组织）
  - 用户前端：登录、账单总览、消费流水、充值申请记录。
  - 管理后台：平台总览、全局免费池调整、用户调账、充值审核。
- 工程集成
  - 根脚本 `build/lint/tsc` 已纳入 `apps/platform-console`。
  - CLI 新增 `nextclaw login`（支持 `--register`），可将登录 token 自动写入 `providers.nextclaw.apiKey`，实现“登录后才能调用平台网关”。

## 2) 测试/验证/验收方式

- 构建/静态检查
  - `pnpm -C workers/nextclaw-provider-gateway-api build`
  - `pnpm -C workers/nextclaw-provider-gateway-api lint`
  - `pnpm -C workers/nextclaw-provider-gateway-api tsc`
  - `pnpm -C apps/platform-console build`
  - `pnpm -C apps/platform-console lint`
  - `pnpm -C apps/platform-console tsc`
  - `pnpm -C packages/nextclaw build`
  - `pnpm -C packages/nextclaw lint`
  - `pnpm -C packages/nextclaw tsc`

- 冒烟（隔离目录，不写仓库）
  - 在 `/tmp` 目录执行：
    - `wrangler d1 migrations apply NEXTCLAW_PLATFORM_DB --local --config <repo>/workers/nextclaw-provider-gateway-api/wrangler.toml`
    - `wrangler dev --local --port 8790 --config <repo>/workers/nextclaw-provider-gateway-api/wrangler.toml`
  - 验证链路：
    - 注册：`POST /platform/auth/register` -> `ok: true`，首个用户为 `admin`
    - 账单：`GET /platform/billing/overview` -> 返回个人与全局免费额度
    - 充值申请：`POST /platform/billing/recharge-intents` -> `status: pending`
    - 聊天接口：`POST /v1/chat/completions`（无上游 key）-> `503`（登录门禁已通过，进入业务层）
    - CLI 登录：`nextclaw login --api-base http://127.0.0.1:8791 --register ...` 后，`NEXTCLAW_HOME/config.json` 的 `providers.nextclaw.apiKey` 为 `nca.` 前缀 token。

## 3) 发布/部署方式

1. 配置 Worker 绑定与变量
   - D1：`NEXTCLAW_PLATFORM_DB`
   - 必需变量：`AUTH_TOKEN_SECRET`、`DASHSCOPE_API_KEY`
   - 额度变量：`GLOBAL_FREE_USD_LIMIT`、`DEFAULT_USER_FREE_USD_LIMIT`、`REQUEST_FLAT_USD_PER_REQUEST`
2. 执行 D1 migration
   - `pnpm -C workers/nextclaw-provider-gateway-api db:migrate:remote`
3. 部署 Worker
   - `pnpm -C workers/nextclaw-provider-gateway-api deploy`
4. 部署前端
   - 构建：`pnpm -C apps/platform-console build`
   - 按你现有静态站/CDN流程发布 `apps/platform-console/dist`

## 4) 用户/产品视角的验收步骤

1. 打开平台控制台，注册并登录。
2. 登录后查看“用户前端”页：确认显示个人免费额度、全局免费池剩余、付费余额。
3. 提交一条充值申请，确认状态为 `pending`。
4. 用管理员账号进入“管理后台”页，在充值审核中通过该申请，回到用户页确认余额增加（USD 直充）。
5. 用登录 token 调用 `/v1/chat/completions`：
   - 未携带 token 时应拒绝。
   - 携带 token 时应进入网关计费流程（额度不足返回 `429`，上游未配置返回 `503`）。
