# Weixin Channel Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 NextClaw 中新增一个微信渠道，并以单独插件包的形式交付，支持扫码登录、长轮询收发消息，以及 agent 主动向指定微信用户发送文本消息。

**Architecture:** 本方案明确采用“单独插件包，包内分层”的结构，而不是双层发布物。插件自身负责微信协议接入、账号状态、媒体能力和消息归一化；宿主只补齐最小通用 contract，让 `nextclaw` CLI、gateway、message tool、cron 能以统一方式调用该插件。

**Tech Stack:** TypeScript, Node.js 22, NextClaw plugin loader, OpenClaw-compatible manifest, `fetch`, `crypto`, `qrcode-terminal`, `zod`

---

## 背景

这次目标不再是“设计一套通用的未来插件平台”，而是把范围收敛到一件事：

- 参考 `@tencent-weixin/openclaw-weixin`
- 吸收 `weixin-agent-sdk` / `weclaw` 已验证的实现思路
- 在本仓库里落一个真正独立、边界干净的微信插件

这份方案同时明确两个结论：

1. **本次不拆两层发布包**
   - 不额外拆 `sdk` 包和 `plugin` 包
   - 只交付一个独立插件包：`packages/extensions/nextclaw-channel-plugin-weixin`
   - 但包内必须分层，避免再次演变成 runtime 大杂烩

2. **本次必须支持 agent 主动发消息**
   - 首版必须支持主动发文本
   - 主动发消息的最小 contract 为：`channel=weixin` + `accountId` + `to=<user_id@im.wechat>`
   - 媒体主动发送在实现上预留，但不要求成为首版阻塞项

## 目标

本次方案要同时满足以下目标：

- 新增 `weixin` 渠道能力
- 代码以单独插件包交付，而不是继续塞回统一 `channel-runtime`
- 插件自身职责清晰，宿主不再写微信特判业务逻辑
- 支持扫码登录、长轮询接收、文本回复、媒体上传下载
- 支持 agent / cron / CLI 主动向指定微信用户发送文本消息

## 非目标

以下内容不属于本次首版范围：

- 不做“第三方 OpenClaw 插件零改动即装即跑”
- 不把现有所有 channel 一次性重构成同样结构
- 不在首版强推群聊复杂语义、企业通讯录、联系人目录能力
- 不把宿主改造成一个全新的大插件平台
- 不把“主动媒体发送”作为首版上线阻塞条件

## 核心决策

### 1. 交付形态：单独插件包，不拆双层发布物

本次微信接入的最终交付物固定为：

```text
packages/extensions/nextclaw-channel-plugin-weixin
```

插件包内部自己分层，但外部只暴露一个插件。

这样做的原因很简单：

- 符合你当前目标，避免架构过重
- 仍然可以保持代码边界清晰
- 不会引入第二个需要长期维护的公共包

### 2. 插件边界：协议逻辑在插件内，宿主只保留通用 contract

微信相关的以下能力全部放在插件包内部：

- 二维码登录
- token / account 存储
- `getupdates`
- `sendmessage`
- `getuploadurl`
- `getconfig`
- `sendtyping`
- 长轮询重连与 session 失效处理
- inbound 消息归一化
- outbound 主动发送与回复发送

宿主只负责：

- 发现插件
- 调用插件 channel contract
- 提供统一 message tool / cron / gateway 生命周期入口

### 3. 主动发消息：首版支持主动文本

当前代码库已经有通用 outbound contract：

- [types.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/extensions/types.ts#L40)

并且 agent 的 `message` tool 也已经支持跨 channel 指定 `channel` 和 `to`：

- [message.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/message.ts#L1)

因此本次方案的明确结论是：

- **支持 agent 主动发消息**
- **首版定义为主动发文本消息**
- 插件实现 `outbound.sendText`
- agent 可通过 `message` tool 触发
- cron 可通过既有 `deliver` 机制触发

媒体主动发送不作为首版硬门槛，因为当前 `message` tool 主要面向文本；但插件内部 outbound 设计必须预留 `sendPayload` 演进空间。

## 包结构

目标目录如下：

```text
packages/extensions/nextclaw-channel-plugin-weixin/
  package.json
  tsconfig.json
  eslint.config.mjs
  README.md
  openclaw.plugin.json
  index.ts
  src/
    channel.ts
    config/
      config-schema.ts
    auth/
      accounts.ts
      login-qr.ts
      session-guard.ts
    api/
      api.ts
      types.ts
      config-cache.ts
    gateway/
      monitor.ts
    inbound/
      normalize-message.ts
      process-message.ts
    outbound/
      send-text.ts
      send-media.ts
      send-proactive.ts
    media/
      media-download.ts
      media-upload.ts
      aes-ecb.ts
      mime.ts
    storage/
      state-dir.ts
      sync-buf.ts
    util/
      logger.ts
      redact.ts
      random.ts
```

原则：

- `channel.ts` 只做插件 contract 组装
- `gateway/monitor.ts` 只负责轮询和生命周期
- `inbound/*` / `outbound/*` 分离
- `auth/*` 与 `storage/*` 不依赖宿主业务逻辑

## 宿主接入点

本次并不要求大重构宿主，但需要补齐 4 个最小通用接入点。

### 1. bundled plugin 列表

把微信插件加入 bundled channel packages：

- 修改 [loader.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/loader.ts)

新增：

- `@nextclaw/channel-plugin-weixin`

### 2. channels 状态与标签

在 CLI 的 channel 状态中显示 `Weixin`：

- 修改 [channels.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/channels.ts)

### 3. plugin channel auth contract

当前 plugin channel 类型只有 `gateway.startAccount`，不够覆盖扫码登录。

需要在 compat types 中新增最小 auth contract，例如：

```ts
auth?: {
  login?: (ctx: { cfg: Config; accountId?: string | null; verbose?: boolean; runtime?: ... }) => Promise<void>;
}
```

对应修改：

- [types.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/types.ts)
- [registry.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-openclaw-compat/src/plugins/registry.ts)

要求：

- 宿主只知道“某插件 channel 支持 login”
- 宿主不写微信专属扫码逻辑

### 4. plugin-aware `channels login`

当前 `nextclaw channels login` 还是旧 bridge 路径，不适合插件化微信。

需要把该命令改为：

- 先根据 `--channel` 找到 plugin channel binding
- 如果 plugin channel 提供 `auth.login`，直接调用
- 否则保持原有 bridge 路径或返回“不支持登录”

关键文件：

- [channels.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/channels.ts#L59)

## 微信主动发消息设计

### 1. 回复当前会话

这是默认路径：

- inbound 消息进入插件
- 插件记录 `accountId + peer + contextToken`
- agent 回答时，插件通过当前上下文回复

这条路径要求：

- context token 被插件自己维护
- 同一用户的最新可回复上下文可被安全读取

### 2. 主动发给指定用户

这条路径是本次必须支持的新增能力。

contract：

```text
channel = weixin
accountId = <which logged-in bot account>
to = <target_user_id@im.wechat>
```

行为：

- 若存在可复用 `contextToken`，优先带上
- 若不存在可复用 `contextToken`，仍允许发送主动文本
- 不因为缺少历史上下文而禁止主动发送

这里直接参考了 `weclaw` 的已验证行为：主动发送可以走明确 `to_user_id` 路径，不必把“reply 语义”误当成全部发送语义。

### 3. 首版边界

首版主动消息的产品承诺：

- 支持 agent 主动发文本
- 支持 cron 发文本
- 支持 CLI 或后续 API 发文本

首版不承诺：

- agent 主动发媒体作为默认主路径

但插件内部应保留：

- `outbound/send-proactive.ts`
- `outbound/send-media.ts`
- `sendPayload` 扩展点

## 依赖参考

外部项目给我们的结论不是“直接拿来跑”，而是“参考它们已经验证的边界”：

- `@tencent-weixin/openclaw-weixin`
  - 作为微信协议接入与媒体能力的第一参考
- `weixin-agent-sdk`
  - 作为“去宿主化后的单包实现”参考
- `weclaw`
  - 作为主动发送、ACP/CLI/HTTP agent 路由和产品裁剪参考

本次实现不追求对腾讯插件零改动兼容，而是吸收其实现要点，落成更适合 NextClaw 当前宿主 contract 的独立插件。

## 任务拆分

### Task 1: 补齐 plugin channel 最小宿主 contract

**Files:**
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/types.ts`
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/registry.ts`
- Modify: `packages/nextclaw/src/cli/commands/channels.ts`

**Step 1: 为 plugin channel 增加 auth contract**

- 新增 `channel.auth.login`
- 不新增微信特判字段

**Step 2: 让 `channels login --channel <id>` 优先调用 plugin auth**

- 只按通用 binding 分发
- 无 auth 的 channel 才走旧路径或报错

**Step 3: 验证 CLI 行为**

Run:

```bash
pnpm -C packages/nextclaw build
pnpm -C packages/nextclaw lint
pnpm -C packages/nextclaw tsc
```

Expected:

- build/lint/tsc 通过
- `nextclaw channels login --channel weixin` 能命中插件登录入口

### Task 2: 新建微信独立插件包骨架

**Files:**
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/package.json`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/tsconfig.json`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/eslint.config.mjs`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/openclaw.plugin.json`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/index.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/channel.ts`
- Modify: `packages/nextclaw-openclaw-compat/src/plugins/loader.ts`
- Modify: root `package.json`

**Step 1: 建立独立包**

- 包名使用 `@nextclaw/channel-plugin-weixin`
- 内部依赖统一使用 `workspace:*`

**Step 2: 插件注册**

- `index.ts` 只负责 `registerChannel`
- `channel.ts` 只负责 contract 组装

**Step 3: 加入 bundled plugin 列表**

- 宿主启动后自动发现插件

**Step 4: 验证包可被加载**

Run:

```bash
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin build
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin lint
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin tsc
```

Expected:

- 插件包单独构建通过
- 宿主可发现 `weixin` channel

### Task 3: 实现微信协议与登录层

**Files:**
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/auth/accounts.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/auth/login-qr.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/auth/session-guard.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/api/api.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/api/types.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/storage/state-dir.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/storage/sync-buf.ts`

**Step 1: 完成账号与 token 存储**

- 每账号单独存储
- sync buf 单独存储

**Step 2: 完成二维码登录**

- 终端打印二维码
- 登录成功后持久化账号

**Step 3: 完成五个核心 API**

- `getupdates`
- `sendmessage`
- `getuploadurl`
- `getconfig`
- `sendtyping`

**Step 4: 验证登录链路**

Smoke:

```bash
NEXTCLAW_HOME=/tmp/nextclaw-weixin-smoke nextclaw channels login --channel weixin
```

Expected:

- 终端能显示二维码
- 扫码后本地写入账号信息

### Task 4: 实现 gateway、inbound、reply 与 proactive outbound

**Files:**
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/gateway/monitor.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/inbound/normalize-message.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/inbound/process-message.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/outbound/send-text.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/outbound/send-proactive.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/media/*`

**Step 1: 长轮询监听**

- 处理 timeout
- 处理 session expired
- 处理重试和 backoff

**Step 2: inbound 归一化**

- 文本
- 引用消息
- 图片/语音/视频/文件

**Step 3: reply 发送**

- 使用当前上下文回复
- 支持 typing

**Step 4: proactive text 发送**

- 实现 `outbound.sendText`
- 支持 `accountId + to`
- 缺少历史 `contextToken` 也允许主动文本发送

**Step 5: 冒烟验证**

Run:

```bash
NEXTCLAW_HOME=/tmp/nextclaw-weixin-smoke nextclaw start
```

观察点：

- 微信来消息能进入 agent
- agent 回复能回到微信
- message tool 指定 `channel=weixin`、`to=<user_id@im.wechat>` 时能主动发文本

### Task 5: 文档、可观测性与收尾

**Files:**
- Modify: `packages/nextclaw/templates/USAGE.md`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/README.md`
- Add tests under:
  - `packages/extensions/nextclaw-channel-plugin-weixin/src/**/*.test.ts`

**Step 1: 文档补齐**

- 安装方式
- 登录方式
- 主动发消息方式
- 已知边界

**Step 2: 加入日志与状态**

- 账号维度日志
- gateway 启停状态
- 最近一次 inbound/outbound 时间

**Step 3: 验证与自检**

Run:

```bash
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin build
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin lint
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin tsc
node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-channel-plugin-weixin
```

Expected:

- build/lint/tsc 通过
- maintainability guard 无新增阻塞告警

## 验证清单

实现阶段至少覆盖以下验证：

1. 包级 `build`
2. 包级 `lint`
3. 包级 `tsc`
4. 扫码登录冒烟
5. 长轮询收消息冒烟
6. agent 回复冒烟
7. 主动文本发送冒烟

## 发布策略

本次若进入实现阶段，发布范围默认包含：

- `@nextclaw/channel-plugin-weixin`
- `@nextclaw/openclaw-compat`
- `nextclaw`
- `apps/desktop`（如果桌面内置包清单直接依赖该插件）

只有真正触发依赖链时，才联动发布其它包。

## 验收标准

本方案实施完成后，必须满足：

1. `weixin` 作为独立插件包存在，不再依赖统一 `channel-runtime` 内置实现。
2. 用户可以通过 `nextclaw channels login --channel weixin` 扫码登录。
3. 微信消息可以进入 NextClaw agent，并得到正常回复。
4. agent 可以主动向指定微信用户发送文本消息。
5. 插件内部目录按职责拆分，没有单文件大杂烩。
6. 宿主新增的是通用 contract，不是微信专属硬编码。
