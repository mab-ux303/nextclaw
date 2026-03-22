# NextClaw Remote Instance Sharing Design

日期：2026-03-22

## 1. 结论

本方案将 NextClaw remote access 的对外模型收敛为：

- 平台只做实例入口、分享授权与访问会话签发
- relay 只做 transport 与 session 路由
- 本地 NextClaw 继续作为唯一运行时与唯一产品面

本次明确做两件事：

1. 支持同一个浏览器同时访问多个远程 NextClaw 实例
2. 支持将一个可撤销的分享 URL 发给其他人，让对方也能访问该实例

本次明确不做：

- 权限系统
- 只读/可编辑区分
- 角色体系
- 团队协作模型

当前阶段的分享语义非常直接：

- 拿到有效分享的人，等价于拿到该实例的一次完整远程访问能力
- 安全控制依赖短期分享授权、独立访问会话、可撤销、撤销后立即失效

## 2. 术语收敛

本方案统一使用 `instance`，不再使用 `device` 作为主术语。

原因：

- 用户实际访问的是一个运行中的 NextClaw 实例，而不是硬件设备本身
- 一个实例未来可以运行在本机、容器、云主机、桌面端或其它宿主环境
- `instance` 更准确，也更方便后续扩展到非物理设备形态

术语映射：

- 旧术语 `device` -> 新术语 `instance`
- 旧术语 `remote device list` -> 新术语 `remote instance list`
- 旧术语 `device open` -> 新术语 `instance open`

历史实现内部若暂时仍保留 `deviceId` 等字段，可视为实现债务；新接口与新文档默认以 `instance` 命名。

## 3. 设计目标

### 3.1 目标

- 保持现有 NextClaw UI / API / WebSocket 作为唯一产品面
- 支持同一浏览器并行打开多个远程实例
- 支持通过分享 URL 让他人打开实例
- 支持撤销分享后，已经打开的分享会话立即失效
- 保持平台、relay、本地实例三层边界清晰

### 3.2 非目标

- 不新增第二套云端业务 UI
- 不在本阶段引入实例内细粒度权限
- 不在本阶段设计复杂的审批流、组织模型或协作权限
- 不对本地 NextClaw 页面做“远程专用版”分叉

## 4. 核心判断

### 4.1 不采用实例固定域名

不推荐：

```text
https://<instance-id>.remote.nextclaw.io/
```

原因：

- 实例是长期实体，但浏览器访问应是短期、可撤销、可隔离的会话
- 如果把 URL 直接绑定到实例，会让 cookie、会话失效、撤销语义、审计边界变得模糊
- 固定实例域名天然更像“长期公开入口”，不符合当前安全预期

### 4.2 采用访问会话子域名

推荐：

```text
https://<access-session-id>.remote.nextclaw.io/
```

原因：

- 浏览器看到的是独立 origin
- 现有前端按 origin 访问 `/api/*` 和 `/ws` 的模型可以直接复用
- 同一浏览器可以同时打开多个实例，彼此 cookie、WebSocket、状态天然隔离
- 撤销时可以精确杀掉某一批会话，而不需要让整个实例长期暴露在一个稳定 host 上

### 4.3 分享 URL 不等于访问 URL

必须区分两类 URL：

- 分享 URL：用于传播与授权兑换
- 访问 URL：用于真实远程访问

推荐形式：

- 分享 URL：
  - `https://platform.nextclaw.io/share/<grant-token>`
- 访问 URL：
  - `https://<access-session-id>.remote.nextclaw.io/`

这样可以避免把已经建立的浏览器访问会话直接外泄给别人。

## 5. 核心对象模型

本方案只引入三个核心对象。

### 5.1 `instance`

表示一个被平台识别、可被远程打开的 NextClaw 运行实例。

建议字段：

- `id`
- `ownerUserId`
- `displayName`
- `installId`
- `status`
- `platformBase`
- `lastSeenAt`
- `lastConnectedAt`

### 5.2 `share-grant`

表示一个可传播、可撤销的分享授权。

它不是访问会话，只是“允许别人基于它再打开这个实例”。

建议字段：

- `id`
- `token`
- `instanceId`
- `createdByUserId`
- `status`：`active | revoked | expired`
- `expiresAt`
- `createdAt`
- `revokedAt`

### 5.3 `access-session`

表示一次真实浏览器访问会话。

所有远程访问最终都落到它上面：

- owner 自己打开实例，会生成一个 owner access session
- 通过分享链接访问实例，也会生成一个新的 shared access session

建议字段：

- `id`
- `instanceId`
- `openedByUserId` 或匿名访问标识
- `sourceType`：`owner-open | share-grant`
- `sourceGrantId`
- `status`：`active | revoked | expired | closed`
- `lastUsedAt`
- `expiresAt`
- `createdAt`
- `revokedAt`

## 6. 总体架构

```text
Browser
  |
  | 1) 打开实例 / 打开分享链接
  v
NextClaw Platform
  |
  | 2) 校验 owner 或 share-grant
  | 3) 创建 access-session
  v
Relay Gateway
  |
  | 4) 按 access-session 路由
  v
Local Connector
  |
  | 5) 桥接到本地 UI server
  v
Local NextClaw Instance
  - same UI bundle
  - same /api/*
  - same /ws
  - same local runtime
```

关键原则：

- 平台不重做业务页面
- relay 不承载业务语义
- 本地实例继续提供完整 NextClaw 能力

## 7. 用户流程

### 7.1 owner 打开实例

1. 用户在平台实例列表点击 `Open`
2. 平台校验当前用户是否拥有该实例
3. 平台创建一个 `access-session`
4. 平台返回 `openUrl`
5. 浏览器跳转到 `https://<access-session-id>.remote.nextclaw.io/`
6. relay 基于该 session 将请求转发到目标实例

### 7.2 owner 创建分享链接

1. 用户在平台实例详情点击 `Create Share Link`
2. 平台创建一个 `share-grant`
3. 平台返回分享 URL：

```text
https://platform.nextclaw.io/share/<grant-token>
```

4. 用户将该 URL 发送给其他人

### 7.3 recipient 通过分享链接访问

1. 访问者打开分享 URL
2. 平台校验该 `share-grant` 是否仍然有效
3. 若有效，平台新建一个属于该访问者的 `access-session`
4. 平台跳转到新的 session 子域名
5. 之后所有访问都通过这个独立 session 进入实例

关键点：

- 不复用 owner 当前正在使用的 session
- 每个访问者都拿到自己独立的 `access-session`

## 8. 撤销语义

本方案把“撤销后立即失效”定义为硬约束。

### 8.1 撤销 `share-grant` 的效果

一旦某个 `share-grant` 被撤销：

- 该分享 URL 不能再创建新的 `access-session`
- 所有由该 `share-grant` 派生出的活跃 `access-session` 必须立即失效
- owner 自己通过 `Open` 创建的访问会话不受影响

### 8.2 立即失效的行为定义

对于已打开的分享访问会话：

- 新的 HTTP 请求返回 `401/403/440` 等统一失效响应
- 已建立的 WebSocket 连接被服务端主动断开
- 远程页面显示“分享已被撤销，当前会话已失效”
- 浏览器不得再静默重连成一个仍然可用的会话

### 8.3 实现要求

撤销动作必须至少做三件事：

1. 将 `share-grant.status` 更新为 `revoked`
2. 将其派生的活跃 `access-session.status` 批量更新为 `revoked`
3. 通知 relay 关闭这些 session 对应的活跃连接

## 9. URL 与路由设计

### 9.1 平台入口

- 实例列表：`https://platform.nextclaw.io/instances`
- 分享链接：`https://platform.nextclaw.io/share/<grant-token>`

### 9.2 远程访问入口

- 访问会话：`https://<access-session-id>.remote.nextclaw.io/`

### 9.3 为什么必须是独立 origin

现有 NextClaw UI 默认假设：

- 页面运行在根路径
- API 路径是 `/api/*`
- WebSocket 路径是 `/ws`
- 会话 cookie 与前端资源都绑定当前 origin

因此独立子域名是最小改动、最可预测的方案。

## 10. 平台接口草案

这里只定义面向 MVP 的最小接口集合。

### 10.1 instance

```text
GET /platform/remote/instances
POST /platform/remote/instances/:instanceId/open
```

`open` 返回：

```json
{
  "ok": true,
  "data": {
    "sessionId": "ras_xxx",
    "openUrl": "https://ras_xxx.remote.nextclaw.io/",
    "expiresAt": "2026-03-22T12:00:00.000Z"
  }
}
```

### 10.2 share-grant

```text
GET /platform/remote/instances/:instanceId/shares
POST /platform/remote/instances/:instanceId/shares
POST /platform/remote/shares/:grantId/revoke
```

创建分享返回：

```json
{
  "ok": true,
  "data": {
    "grantId": "rsg_xxx",
    "shareUrl": "https://platform.nextclaw.io/share/rsgt_xxx",
    "expiresAt": "2026-03-23T12:00:00.000Z"
  }
}
```

### 10.3 share resolve

```text
GET /platform/share/:grantToken
POST /platform/share/:grantToken/open
```

说明：

- `GET` 可用于显示分享状态页
- `POST open` 用于真正兑换成 `access-session`

### 10.4 access-session

```text
POST /platform/remote/sessions/:sessionId/revoke
POST /platform/remote/sessions/:sessionId/touch
GET /platform/remote/sessions/:sessionId/status
```

其中 `touch` 是否保留取决于 relay 的最终活跃度模型；若已有更低频可预测方案，优先避免高频写库。

## 11. Relay 与本地实例职责

### 11.1 relay

relay 只负责：

- 解析访问 origin 对应的 `access-session`
- 校验 session 当前是否有效
- 定位目标 `instance`
- 将 HTTP / WebSocket 转发给目标实例 connector
- 在 session 被撤销时主动终止连接

relay 不负责：

- 业务页面逻辑
- 权限系统
- 运行时配置镜像

### 11.2 local connector

local connector 继续只负责：

- 出站连接平台
- 接收 relay 请求
- 桥接本地 UI session
- 转发到本地 NextClaw UI server

它不需要理解“这是 owner 访问还是 share 访问”，只需要消费经过平台和 relay 验证后的受控访问会话。

### 11.3 local auth bridge

本阶段不引入新的本地权限模型。

因此 local auth bridge 的要求是：

- 只接受来自合法 `access-session` 的受控桥接
- 不接受绕过平台签发的任意浏览器直连伪造
- session 被撤销后，不再为其签发新的可用本地桥接态

## 12. 数据与状态要求

### 12.1 实例状态

实例状态仍然应与连接状态解耦：

- `instance.status` 代表实例在线/离线等平台观察结果
- `access-session.status` 代表某个浏览器访问会话是否可用

不能用访问会话状态反推实例是否在线。

### 12.2 分享状态

`share-grant` 是授权真相源。

只要 grant 不再有效，所有派生 session 都必须视为不可用。

### 12.3 会话状态

`access-session` 是 relay 路由真相源。

每次请求进入 relay 时，至少要满足：

- session 存在
- session 未过期
- session 未撤销
- session 对应的 share-grant 若存在，也仍然有效

## 13. MVP 范围

### 13.1 本次必须实现

- 将对外术语统一为 `instance`
- owner 可打开实例并获得独立 session 子域名
- 同一浏览器可并行打开多个实例
- owner 可创建分享链接
- 访问者可通过分享链接打开实例
- 每个访问者获得独立 `access-session`
- 撤销分享链接后，派生的已打开会话立即失效

### 13.2 本次明确不做

- 权限角色
- 只读模式
- 协同编辑冲突处理
- 长期固定实例域名
- 公网直接暴露本地服务

## 14. 风险与约束

### 14.1 最大风险

当前最大风险不是前端页面，而是把几个不同概念混成一个：

- 把分享链接当访问会话
- 把实例当访问 origin
- 把会话活跃度当实例在线真相

这些混淆都会直接导致撤销、隔离、审计和多实例访问变得不可预测。

### 14.2 约束原则

- 分享链接必须可撤销
- 访问会话必须独立
- 撤销必须即时生效
- 平台、relay、本地实例边界必须稳定

## 15. 最终建议

当前阶段的唯一推荐方向是：

1. 用 `instance` 替换 `device` 成为对外主术语
2. 用 `share-grant` 承载分享传播
3. 用 `access-session` 承载真实远程访问
4. 用 session 子域名解决多实例并行访问
5. 用“撤销 grant -> 杀掉派生 session”保证分享可控

这条路线能在不引入权限系统的前提下，先把 remote access 的访问模型、分享模型和撤销模型做正确。
