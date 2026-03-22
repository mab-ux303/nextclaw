# v0.14.126 Remote Host Cookie Auth Boundary Fix

## 迭代完成说明

- 修复远程实例子域名授权边界漏洞：`https://r-<access-session-id>.claw.cool` 不再因为 host 中包含会话 ID 就直接放行。
- `workers/nextclaw-provider-gateway-api/src/services/remote-access-service.ts` 现在要求实例子域名访问必须同时携带 `nextclaw_remote_session` cookie，且 cookie 对应的访问会话必须与 host 中的 `access-session-id` 完全一致。
- 这样 `r-<access-session-id>.claw.cool` 被收敛为“会话承载域名”，真正授权只能来自一次性 `platform/remote/open?token=...` 设置下来的 cookie，而不是来自 host 自身。
- `scripts/remote-relay-hibernation-smoke.mjs` 新增授权边界冒烟：
  - owner open / share open 的整链路仍然可用
  - 分享撤销后共享会话仍然会失效
- 新增 `scripts/remote-host-cookie-binding-check.mjs`，直接校验“host 中的会话 ID 与 cookie 会话必须一一对应”的核心授权决策，避免被本地 `wrangler dev` 的 Host 传递差异干扰。

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api lint`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `node scripts/remote-relay-hibernation-smoke.mjs`
- `node scripts/remote-host-cookie-binding-check.mjs`
- `curl -sS -o /tmp/r-claw-health.out -w '%{http_code}\n' https://r-test.claw.cool/health`

## 发布/部署方式

- 执行 `pnpm -C workers/nextclaw-provider-gateway-api run deploy`
- 本次仅涉及 Worker 访问授权逻辑，无需 migration，无需重新部署平台前端
- 本次线上 Worker 版本：`2de51778-271c-43bc-b7ff-9f75aa3d4189`

## 用户/产品视角的验收步骤

1. 打开一个远程实例，浏览器应跳到 `https://r-<access-session-id>.claw.cool/...`。
2. 复制该 `r-...claw.cool` 地址，在未携带原浏览器会话 cookie 的环境中直接打开，应无法访问实例内容。
3. 在原浏览器中继续访问同一实例，应保持可用。
4. 再打开另一个分享/owner 会话，拿第二个会话的 cookie 去访问第一个 `r-...claw.cool`，应同样失败。
5. 撤销分享后，相关共享会话应继续按既有逻辑失效。
