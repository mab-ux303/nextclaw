# Codex Plugin Runtime Plan

## 这份文档回答什么

这份文档专门回答一个问题：

如何把当前已经接入的 `Codex SDK runtime`，从“可选 runtime 能力”，演进成真正面向用户的“可安装插件能力”。

同时，这份文档也要回答另一个必须提前设计好的问题：

如何让这套方案不仅适用于 `Codex`，还能够承接未来其它类似的自定义 agent runtime，并继续通过插件形式接入。

目标不是让用户去理解 `config.json`、`runtime registry`、`session metadata` 这些内部结构，而是把用户体验收敛成一条自然路径：

1. 安装 `Codex` 插件
2. 在 UI 中完成必要设置
3. 新建会话时直接选择 `Codex`
4. 之后该会话就走 `Codex SDK`

## 与已有方案的关系

这份文档是在以下方案基础上的进一步产品化收束：

- [NCP 定位与愿景](../designs/2026-03-17-ncp-positioning-and-vision.md)
- [NCP Native Runtime Refactor Plan](./2026-03-18-ncp-native-runtime-refactor-plan.md)
- [NCP Pluggable Agent Runtime Plan](./2026-03-19-ncp-pluggable-agent-runtime-plan.md)
- [NCP Phase 1: Codex SDK Runtime Integration Plan](./2026-03-19-ncp-phase1-codex-sdk-runtime-integration-plan.md)

关系可以理解为：

- 前面几份文档回答“结构上如何成立”
- 本文回答“如何让它以插件形式真正对用户成立，并且让同一套机制可以承接未来更多 runtime”

## 核心判断

`Codex` 不应该只是一个藏在配置文件中的 runtime 开关。

如果最终用户要使用 `Codex`，最理想的体验应该是：

- 先在产品里看到一个可安装的 `Codex` 插件
- 安装后自动获得对应能力
- 在新建会话时自然看到 `Codex` 选项
- 没装插件时，默认主路径依然干净、简单、不分散注意力

因此，长期正确形态不是：

- 用户去手改 `ui.ncp.runtimes.codex.enabled`
- 用户自己理解 `runtime kind`
- 用户通过配置文件开启隐藏能力

而是：

- 插件安装即能力接入
- UI 自动感知可用能力
- 用户只面对“会话类型”和必要设置

这里还要明确一个长期判断：

- `Codex` 不是唯一特例，而是第一种外部 agent runtime 样板
- 我们现在设计的不是“Codex 特判逻辑”，而是“外部 agent runtime 插件接入框架”

## 产品原则

围绕这件事，我们要坚持两个产品判断：

### 1. 用户面默认不暴露配置文件

这是一个明确原则，而不是临时体验优化。

对于大多数用户：

- 不应该要求他们知道 `~/.nextclaw/config.json`
- 不应该要求他们手工打开配置文件去启用插件
- 不应该要求他们理解 runtime 装配边界

配置文件可以继续作为：

- 开发调试入口
- 高级用户兜底入口
- 自动持久化后的底层存储

但不应作为主要用户入口。

### 2. 插件安装后，能力应自然出现在用户路径里

用户不应该经历“我安装了插件，但还得自己再找一个隐藏开关”的流程。

更合理的产品心智是：

- 安装插件 = 获得新能力
- 新能力会自然出现在合适的地方
- 当前场景里，这个地方就是“新建会话类型”

## 目标用户路径

最终希望做到的用户路径是：

```text
Marketplace / Plugins
  -> 安装 Codex 插件
  -> UI 出现 Codex 设置入口
  -> 完成 API Key / 运行参数配置
  -> 新建会话时出现 Codex
  -> 选中后创建 Codex 会话
  -> 后续该会话持续走 Codex runtime
```

这里最关键的是：

- 用户看到的是插件与会话类型
- 系统内部才去处理 runtime registration、metadata、thread persistence

## 目标结构

落地后结构应当接近：

```text
Agent Runtime Plugin
  -> runtime registration(s)
  -> plugin metadata
  -> plugin config schema
  -> plugin settings UI
  -> platform-specific dependency

Examples
  -> Codex Plugin
  -> Claude Code Plugin
  -> custom internal runtime plugin

Nextclaw UI / NCP backend
  -> discover installed plugins
  -> collect runtime registrations
  -> build runtime registry
  -> expose session types to frontend
  -> persist selected session_type
```

也就是说：

- 主包负责承载机制
- 插件负责提供 Codex 能力
- 前端负责消费“当前有哪些能力”

但更准确地说：

- 主包面对的不是 `Codex Plugin` 这个具体名字
- 主包面对的是“某个插件提供了一个或多个 agent runtime”
- `Codex Plugin` 只是这个通用结构下的第一个实例

## 职责边界

### 主包负责什么

主包需要负责这些通用能力：

- 插件发现与加载
- `NcpAgentRuntime` registration 汇总
- runtime registry 组装
- `/api/ncp/session-types` 暴露
- 前端新建会话时的 session type 展示与选择
- 会话 metadata 持久化与恢复

这些属于通用机制，不应写死为 `Codex` 特例。

还要继续明确两件事：

- 主包不应该内建某个特定 runtime 的产品逻辑
- 主包应该只承认统一的 `runtime plugin contract`

### Codex 插件负责什么

`Codex` 插件应负责：

- 注册一个 `codex` runtime kind
- 提供 `Codex` 的展示名与插件元信息
- 实现 `CodexSdkNcpAgentRuntime`
- 管理 `@openai/codex-sdk` 依赖
- 提供自己的配置 schema
- 提供自己的设置入口或设置面板

换句话说，`Codex` 插件不是一个“功能脚本”，而是一个完整 runtime provider。

这一定义也意味着：

- 未来 `Claude Code` 插件、企业私有 runtime 插件、自定义 agent runtime 插件，都应该承担同一类职责
- 不应为每一个新平台再发明一套新的接入方式

### 前端负责什么

前端不应该硬编码 `Codex`。

前端要做的是：

- 请求后端当前可用的 session types
- 在新建会话时展示这些选项
- 对缺失插件或未配置完成的插件做友好提示
- 不为 `Codex` 单独再写一整套聊天 UI

## 为什么插件方案比配置开关方案更好

### 1. 更符合用户直觉

“安装插件 -> 出现能力”是自然的。

“安装后还要去配配置文件”是不自然的。

### 2. 更符合包边界

`Codex SDK` 属于重依赖、外部平台依赖，不应长期绑在默认主包中。

插件化后可以保证：

- 默认安装更轻
- 没有 Codex 需求的用户不承担额外复杂度
- 未来 `Claude Code` 等能力也能沿用同一模式

### 3. 更符合 NCP 纯粹性

NCP 主体系只需要提供：

- runtime 契约
- registry
- state / event / session 机制

不需要把某个特定平台硬编码为主产品内建部分。

### 4. 更利于未来扩展

未来如果我们支持：

- `Claude Code`
- 更多 agent 平台
- 企业内部 agent runtime

它们都应该走同一个“插件提供 runtime registration”的模式。

所以，这份方案必须从一开始就允许：

- 一个插件提供一个 runtime
- 一个插件提供多个 runtime
- 不同插件提供不同配置面板与可用性判断
- 前端统一消费这些 runtime，而不是为每个插件单独写分支

## 推荐落地方案

### Phase A：保留当前 runtime 接入成果，但把入口定位为开发态

当前已经做出来的 `Codex runtime` 接入不需要推翻。

它仍然可以保留为：

- runtime registration 样板
- event mapping 样板
- backend registry 样板

但它的用户入口应被重新定义为：

- 当前是开发期能力
- 最终用户入口将迁移到插件安装流程

### Phase B：把 Codex runtime 从主包装配迁移到插件装配

这一阶段要完成：

- `Codex runtime registration` 不再由主包直接内建
- 改为由 `Codex` 插件在加载时提供
- 主包只负责发现并注册

这一步完成后，主包对 `Codex` 的认知只剩：

- “有一个插件可能会注册一个叫 `codex` 的 runtime”

而不是继续持有 Codex 私有装配细节。

### Phase C：补上插件级设置入口

用户安装插件后，需要有一个明确的人性化入口完成设置。

这里建议：

- 插件可以声明自己需要的配置项
- UI 自动为插件展示设置入口
- 至少支持：
  - API Key
  - model
  - workspace
  - approval / sandbox 类关键参数

用户视角应该是：

- 插件详情页或插件设置页里完成配置

而不是：

- 去手写 JSON

### Phase D：把会话类型展示完全绑定到可用插件

当前 `Codex` 逻辑虽然已经能出现在 session types 中，但最终应进一步明确：

- 没有安装插件，不展示 `Codex`
- 插件安装但未完成设置，可以展示但应提示“未完成配置”
- 插件安装并配置完成，正常可选

这一步会让用户感知更稳定，不会出现“看到了一个类型，但点进去不能用”的割裂体验。

## 会话语义要求

不管入口怎么插件化，会话语义都要稳定：

- 新建会话时选择 `Codex`
- 第一条消息发出后，`session_type=codex` 固定到会话 metadata
- 刷新、恢复、继续对话时，仍走 `Codex`
- 删除插件后，历史会话应被识别为“缺少对应 runtime”，而不是 silently 回退到 `native`

这一点非常关键。

插件化不能破坏会话语义一致性。

## UI 行为要求

为了达到“最佳易用性”，前端需要满足这些行为：

### 1. 新建会话时自然出现

`Codex` 应该出现在会话类型选择中，而不是藏在某个高级设置角落。

### 2. 缺少插件时不污染默认路径

默认用户不需要看到一堆自己无法使用的 runtime 选项。

### 3. 缺少配置时给明确提示

如果插件已安装，但配置不完整，应明确提示：

- 还缺什么
- 去哪里完成设置

而不是只在发送时抛 backend error。

### 4. 会话内保持共享 UI 一致性

不为 `Codex` 再造一套独立聊天 UI。

它应继续使用共享的：

- 消息列表
- part 渲染
- 输入框
- 会话列表

## 技术方案收敛

技术上建议把这件事收敛成三层：

### 1. `runtime plugin contract`

定义插件如何向主系统注册 runtime。

至少包括：

- runtime kind
- label
- runtime factory
- 插件是否已配置完成

但为了真正承接未来更多 runtime，建议 contract 再补足到下面这一级别：

- `pluginId`
- `runtime kind`
- `label`
- `createRuntime`
- `isConfigured`
- `isVisible`
- `settingsEntry` 或可跳转的配置入口标识
- 可选能力描述，例如：
  - 是否支持 reasoning
  - 是否支持 tool call
  - 是否支持 sandbox / approval

这样做的意义是：

- 后端可以统一判断“哪些 runtime 可以暴露给前端”
- 前端可以统一判断“这个 runtime 是未安装、未配置还是可直接使用”
- 新插件不需要改主包逻辑，只要实现 contract 即可

这里最关键的设计原则是：

- contract 必须足够通用，但不能把产品交互写死在主包
- 它要提供的是 runtime 声明能力，而不是预组合套餐

### 1.5 `plugin-owned runtime settings`

如果未来要允许任意自定义 runtime 插件接入，仅有 runtime factory 还不够。

还需要明确：

- 配置项属于插件，而不是属于主包
- 插件要能声明自己的最小配置需求
- 主包只负责承载和展示，不负责编码各插件私有字段

也就是说，未来不应该出现：

- 主包专门知道 `Codex` 有 `apiKey`
- 主包专门知道另一个 runtime 有另一组字段

而应该是：

- 插件声明自己的 settings schema
- UI 通过通用插件设置容器承载它
- runtime registration 根据插件当前配置状态决定是否可用

### 2. `plugin-aware runtime discovery`

主包启动时：

- 发现已安装插件
- 读取插件的 runtime registration
- 汇总进 runtime registry

这里还要补一个关键约束：

- runtime discovery 必须天然支持“未来新增插件而不改主包”

也就是说：

- 新增一个自定义 agent runtime 插件时，理想状态下只需要安装插件
- 主包不需要为这个新 runtime 再写一段专属注册代码

如果未来每接一个 runtime 都要回到主包加 `if runtime === xxx`，那这套方案就不算设计完成。

### 3. `plugin-aware session type view`

`/api/ncp/session-types` 返回的不是“主包硬编码值”，而是：

- 当前内建 runtime
- 当前插件贡献 runtime
- 当前可见性与可用性状态

建议再明确返回语义至少包括：

- `value`
- `label`
- `source`：builtin 或 plugin
- `pluginId`
- `available`
- `configured`
- `message`：不可用时给前端展示的简短原因

这样前端才能在不硬编码具体平台的前提下，统一做这些事情：

- 正常展示可选 runtime
- 对未配置完成的 runtime 给出人性化提示
- 对缺少插件或已失效 runtime 做只读展示

### 4. `plugin-aware session semantics`

除了 discovery 和展示，真正容易出问题的是历史会话语义。

未来当越来越多 runtime 插件存在时，必须保持：

- 会话创建时记录的 `session_type` 是稳定语义
- 插件存在时，恢复到原 runtime
- 插件缺失时，不静默回退到 `native`
- UI 应明确告诉用户：这个会话依赖的 runtime 当前不可用

这条规则是为了避免未来插件生态变复杂后，会话行为变得不可预测。

## 非目标

这份方案当前不做：

- 同时把 `Claude Code` 一起落地
- 重新设计 Marketplace 全部交互
- 重写整个插件系统
- 为 `Codex` 会话做独立消息协议

我们要的是：

- 用最小长期正确结构，把 Codex 真正变成插件能力
- 同时把“未来任意自定义 runtime 都可通过插件接入”的通用方向预埋进去

## 成功标准

这件事完成后，成功标准应该是：

1. 用户无需手改配置文件即可启用 Codex。
2. 安装插件后，UI 自然出现 `Codex` 会话类型。
3. 没有安装插件时，默认体验不受影响。
4. `Codex` 会话创建、恢复、继续对话都稳定走同一 runtime。
5. 主包仍然保持通用、轻量、可扩展，不被 `Codex` 私有逻辑绑死。
6. 未来新增其它自定义 agent runtime 时，应优先通过复用同一套插件 contract 接入，而不是再为某个平台另开专用通道。

## 最终判断

所以，这件事的最佳方案不是“继续把 Codex 做成一个隐藏配置项”，而是：

把 `Codex` 正式升级为一个插件提供的 runtime 能力。

但更本质地说，我们真正要完成的不是一个 `Codex` 功能点，而是一套长期成立的能力：

- 允许任意外部或自定义 agent runtime 通过插件形式继承进来
- 允许它们自然出现在产品中
- 又不破坏主包的纯粹性、轻量性和可维护性

对于用户来说，它应该表现为：

- 一个可以安装的插件
- 一个可以配置的能力
- 一个可以在新建会话时直接选择的会话类型

这才符合我们“最佳易用性、尽量不向用户暴露配置文件”的产品原则。
