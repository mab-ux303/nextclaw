# v0.14.122 Remote Instance Sharing Rollout

## 迭代完成说明

- 将远程访问的对外模型从 `device` 收敛为 `instance`，平台侧新增 `instance`、`share-grant`、`access-session` 三对象链路。
- 在 worker 中新增实例分享 migration、repository/controller 能力、`/platform/remote/instances/*` 与 `/platform/share/:grantToken` 路由，并保留旧 `device` 路由别名以避免现有链路直接断裂。
- 平台 console 增加“我的实例”面板，支持打开实例、创建分享链接、查看分享列表、复制链接、撤销分享，并在文案层统一使用 `instance`。
- `@nextclaw/remote` connector 切到实例注册新接口；远程 relay smoke 覆盖 owner open、share open、share revoke 后会话失效的端到端闭环。
- 相关设计文档：[`docs/plans/2026-03-22-nextclaw-remote-instance-sharing-design.md`](../../plans/2026-03-22-nextclaw-remote-instance-sharing-design.md)

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api lint`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `pnpm -C apps/platform-console build`
- `pnpm -C apps/platform-console lint`
- `pnpm -C apps/platform-console tsc`
- `pnpm -C packages/nextclaw-remote build`
- `pnpm -C packages/nextclaw-remote lint`
- `pnpm -C packages/nextclaw-remote tsc`
- `node scripts/remote-relay-hibernation-smoke.mjs`

## 发布/部署方式

- 平台 worker 部署前先执行远程 D1 migration：`pnpm -C workers/nextclaw-provider-gateway-api db:migrate:remote`
- 随后部署 worker：`pnpm -C workers/nextclaw-provider-gateway-api deploy`
- 平台 console 按现有前端发布流程构建并发布到对应站点。
- 若要启用 session 子域名访问，需要在运行环境配置 `REMOTE_ACCESS_BASE_DOMAIN`；未配置时仍走 `/platform/remote/open?token=...` 的兼容访问路径。

## 用户/产品视角的验收步骤

1. 在桌面端登录 NextClaw 账号并开启远程访问。
2. 打开平台 console，在“我的实例”中看到当前实例在线，并可直接“在网页中打开”。
3. 为某个实例创建分享链接，把 URL 发给另一个浏览器或他人后，能够打开同一个远程实例。
4. 在平台 console 撤销该分享链接。
5. 已经通过该分享链接打开的浏览器会话立即失效；再次打开原分享 URL 也无法继续访问。

## 红区触达与减债记录

- 本次未识别到需要专项登记的红区文件；如后续维护性闸门补充出红区命中，按同迭代 README 继续补齐。
