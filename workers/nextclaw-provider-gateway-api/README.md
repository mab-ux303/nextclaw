# NextClaw Provider Gateway API (Serious Platform MVP)

Cloudflare Worker + Hono + D1。

核心能力：
- 用户登录后才能调用 `/v1/chat/completions`
- 双额度模型：
  - 用户个人免费额度（`free_limit_usd`）
  - 全平台总免费额度池（`global_free_limit_usd`）
- 支持充值（USD 直充，不引入 points/credits）
- 管理后台 API（用户、额度、充值审核、平台设置）

## 1. 初始化

```bash
pnpm -C workers/nextclaw-provider-gateway-api install
pnpm -C workers/nextclaw-provider-gateway-api db:migrate:local
```

远程环境：

```bash
pnpm -C workers/nextclaw-provider-gateway-api db:migrate:remote
```

## 2. 本地开发

```bash
pnpm -C workers/nextclaw-provider-gateway-api dev
```

## 3. 环境变量（`wrangler.toml`）

- `DASHSCOPE_API_KEY`：上游模型 API Key（secret）
- `AUTH_TOKEN_SECRET`：登录 token 签名密钥
- `GLOBAL_FREE_USD_LIMIT`：总免费额度池（USD）
- `DEFAULT_USER_FREE_USD_LIMIT`：新用户默认免费额度（USD）
- `REQUEST_FLAT_USD_PER_REQUEST`：每次请求固定费用（USD，可选）
- `ALLOW_SELF_SIGNUP`：是否允许自助注册（`true/false`）

## 4. 主要接口

### 用户认证
- `POST /platform/auth/register`
- `POST /platform/auth/login`
- `GET /platform/auth/me`

### 用户账单
- `GET /platform/billing/overview`
- `GET /platform/billing/ledger`
- `GET /platform/billing/recharge-intents`
- `POST /platform/billing/recharge-intents`

### 管理后台
- `GET /platform/admin/overview`
- `GET /platform/admin/users`
- `PATCH /platform/admin/users/:userId`
- `GET /platform/admin/recharge-intents`
- `POST /platform/admin/recharge-intents/:intentId/confirm`
- `POST /platform/admin/recharge-intents/:intentId/reject`
- `PATCH /platform/admin/settings`

### OpenAI 兼容
- `GET /v1/models`
- `GET /v1/usage`
- `POST /v1/chat/completions`

> 注意：`/v1/*` 的 `Authorization: Bearer <token>` 必须是登录 token，不再支持匿名体验 key。

## 5. 质量检查

```bash
pnpm -C workers/nextclaw-provider-gateway-api build
pnpm -C workers/nextclaw-provider-gateway-api lint
pnpm -C workers/nextclaw-provider-gateway-api tsc
```

## 6. 部署

```bash
pnpm -C workers/nextclaw-provider-gateway-api deploy
```
