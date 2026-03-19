# NextClaw Remote Access 方案

## 1. 背景与目标

我们希望用户未来可以从另一台电脑、另一台手机或任意浏览器进入自己本地运行的 NextClaw。

这个能力必须同时满足两件事：

1. 足够轻量，不把产品做成两套平行系统。
2. 足够可扩展，未来还能自然支持多设备、分享、团队协作或更细粒度权限。

本方案的核心目标不是“把本地服务暴露到公网”，而是给 NextClaw 增加一种长期可维护的远程进入方式。

## 2. 核心判断

最优方向不是：

- 直接暴露本地 `18791`
- 在 `platform-console` 里重做一套远程版聊天/配置/marketplace
- 为 remote access 单独设计第二套业务 API

最优方向是：

**单产品面 + 薄控制面 + 哑中继**

具体来说：

1. 本地 `nextclaw` 继续是唯一运行时和唯一产品真相源。
2. 云端 `platform` 只负责账号、设备、进入入口。
3. `relay` 只负责把远程浏览器流量转到本地设备，不承载业务逻辑。

## 3. 产品原则

### 3.1 单产品面

远程访问不应该生成“第二个 NextClaw”。

进入远程设备后，用户看到的仍然是现有 `@nextclaw/ui`，不是一套新的远程控制台。

### 3.2 本地运行时不变

聊天、配置、provider、channel、workspace、marketplace、session 等逻辑全部继续在本地 `nextclaw` 中执行。

### 3.3 云端控制面要薄

云端只负责：

- 用户身份
- 设备绑定
- 设备在线状态
- 打开设备
- 远程会话授权

云端不负责：

- 复制本地配置
- 执行聊天
- 运行工具
- 托管 workspace
- 重写本地页面逻辑

### 3.4 relay 只做 transport，不做 business

relay 的职责是转发 HTTP / WebSocket，不承载业务语义。

这样才能保证 future features 仍然只需要改一套产品代码。

## 4. 推荐架构

```text
Browser
  |
  | 登录 platform.nextclaw.io
  | 选择一台设备并点击 Open
  v
NextClaw Platform
  |
  | 创建 remote session
  | 定位目标设备
  v
Relay Gateway
  |
  | 转发 HTTP / WebSocket
  v
Local Connector
  |
  | 桥接到本地 nextclaw UI server
  v
Local NextClaw
  - same UI bundle
  - same /api/*
  - same /ws
  - same local runtime
```

### 关键点

远程访问最终连接到的不是“远程专用 UI”，而是本地 NextClaw 自己的站点能力。

这意味着：

- 聊天页还是原来的聊天页
- 配置页还是原来的配置页
- marketplace 还是原来的 marketplace
- API 还是原来的 API
- WebSocket 还是原来的 WebSocket

## 5. 方案对比

### 方案 A：公网直接访问本地服务

形式：

```text
http(s)://<home-ip-or-domain>:18791
```

优点：

- 最快
- 几乎无额外研发

缺点：

- 安全边界差
- 家庭网络/动态 IP/内网穿透问题多
- 不适合作为正式产品能力
- 体验不稳定

结论：

适合个人临时自用，不适合作为 NextClaw 产品方案。

### 方案 B：平台里重做远程版 UI

形式：

- `platform-console` 里新增远程聊天页
- 新增远程配置页
- 新增远程 marketplace

优点：

- 云端产品面可完全自定义

缺点：

- 两套 UI
- 两套状态
- 两套 API 面
- 后续维护成本最高

结论：

不推荐。

### 方案 C：平台做入口，进入后复用现有 NextClaw UI

形式：

- `platform-console` 只做设备入口
- 打开设备后，通过 relay 进入远程设备自己的 NextClaw UI

优点：

- 只有一套产品面
- 只有一套业务 API
- 演进成本最低
- 最符合轻量 + 可扩展目标

缺点：

- 需要设计稳定的 relay / auth bridge

结论：

这是推荐方案。

## 6. 入口形式选择

### 选择 A：路径前缀代理

示例：

```text
https://platform.nextclaw.io/devices/:deviceId/...
```

问题：

- 现有 UI 路由默认按根路径运行
- `/api/*` 和 `/ws` 都要做前缀映射
- 静态资源与 SPA fallback 也会更绕

结论：

可行，但不够优雅。

### 选择 B：会话专属子域名

示例：

```text
https://<remote-session-id>.remote.nextclaw.io/
```

优势：

- 浏览器看到的是一个完整 origin
- 现有 `window.location.origin` 逻辑基本可以直接复用
- `/api/*` 和 `/ws` 仍然成立
- 不必先改造一整套前端路由

结论：

推荐采用会话专属子域名。

## 7. 推荐交互流程

### 7.1 设备绑定

用户在本地机器执行：

```bash
nextclaw remote login
```

或在本地 UI 点击“Connect to Cloud”。

流程：

1. 本地生成并持久化 `device_install_id`
2. 本地 connector 向平台申请配对
3. 用户在平台确认绑定
4. 平台下发绑定结果
5. connector 建立长期出站连接

### 7.2 打开设备

用户在平台设备列表点击 `Open`。

流程：

1. 平台验证当前账号是否拥有该设备
2. 创建短期 `remote session`
3. 分配一个临时远程子域名
4. 浏览器跳转到该子域名
5. 后续所有请求通过 relay 转发到目标设备

### 7.3 使用设备

用户进入后，直接使用原有 NextClaw UI。

平台端只保留一个很薄的外层能力：

- 返回设备列表
- 关闭远程会话
- 显示当前连接的是哪台设备

## 8. 认证与安全边界

### 8.1 两层认证

推荐采用两层认证：

1. 平台层认证
2. 本地 UI session 桥接

平台层负责回答：

- 这个用户能不能打开这台设备

本地层负责回答：

- 打开之后，这次请求是否被视为有效本地会话

### 8.2 auth bridge

remote session 建立后，平台不应直接绕过本地 UI 认证。

推荐做法：

1. 平台创建合法 remote session
2. connector 收到平台签名声明
3. connector 在本地签发一个受控 UI session
4. 远程浏览器通过 relay 访问时自动携带该 session

这样做的价值是：

- 复用现有 UI auth 体系
- 不额外再做第二套页面鉴权逻辑
- 本地仍保留最后一道访问控制

### 8.3 默认不做公网入站

connector 应主动连接平台，尽量不要求用户开放本地入站端口。

这会明显降低接入门槛和风险。

## 9. 模块边界

### 9.1 本地 NextClaw

继续负责：

- UI
- API
- WebSocket
- 聊天运行时
- 配置与 marketplace

### 9.2 Local Connector

只负责：

- 出站长连接
- 设备心跳
- 请求转发
- auth bridge

不负责：

- 新业务功能
- 新页面逻辑
- 二次状态管理

### 9.3 Platform

只负责：

- 登录
- 设备列表
- 设备状态
- 打开设备
- 绑定/解绑

### 9.4 Relay Gateway

只负责：

- HTTP 转发
- WebSocket 转发
- 会话路由
- 超时与断连清理

## 10. MVP 范围

首期只做这些：

1. 账号登录
2. 设备绑定
3. 设备在线状态
4. 点击打开远程设备
5. 远程访问完整现有 NextClaw UI
6. 断开/过期处理

首期明确不做：

1. 第二套远程 UI
2. 云端配置镜像
3. 云端聊天执行
4. 设备共享访问
5. 团队权限系统
6. 远程特供 API 面

## 11. 为什么这个方案同时满足“轻量”和“拓展”

### 轻量

因为它只新增访问方式，不新增产品副本。

新增的是：

- connector
- relay
- 设备入口

不新增的是：

- 第二套聊天页
- 第二套配置页
- 第二套 marketplace
- 第二套业务 API

### 拓展

未来可以在同一架构上增加：

- 多设备管理
- 最近连接历史
- 设备标签与分组
- 设备分享
- 只读模式
- 团队协作
- 审计日志

而这些扩展都不会要求重写原有 NextClaw 产品面。

## 12. 必要的最小抽象准备

为了支撑这个方案，只建议做少量、边界明确的准备：

1. `@nextclaw/ui` 增加一个很薄的 runtime context
说明当前是否 remote、当前设备名、返回平台链接等

2. `UiAuthService` 增加受控 session 签发接口
用于 auth bridge

3. 新增 connector / relay transport 层
只负责请求转发，不碰业务语义

不建议预先做大规模重构。

## 13. 最终建议

最终推荐方案：

**Platform 只做设备入口，Relay 只做通道，本地 NextClaw 继续做全部产品能力。**

这是当前最平衡的路线：

- 足够轻
- 足够稳
- 足够可扩展
- 不会演变成两套系统并行维护

## 14. 后续讨论建议

在这个大方向确定后，下一步只需要继续讨论三个实现问题：

1. connector 是内置到 `nextclaw` 还是独立进程
2. relay 如何承载 HTTP + WebSocket
3. auth bridge 的 token / cookie 生命周期怎么设计
