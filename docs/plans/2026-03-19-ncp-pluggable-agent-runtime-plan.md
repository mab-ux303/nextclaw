# NCP Pluggable Agent Runtime Plan

## 这份文档回答什么

这份文档专门回答一个问题：

在保持 NCP 主链路纯粹、默认体验稳定的前提下，如何让 Nextclaw 未来对接多种 agent 平台，例如 `Codex SDK`、`Claude Code`，以及未来更多外部 agent runtime。

目标不是再做一套新的 bridge，而是建立一套长期成立的 runtime 扩展结构：

- 默认聊天链路仍然使用当前内建的 NCP-native runtime
- 前端可以新建不同类型的会话
- 外部 agent runtime 以可插拔方式接入
- 默认安装包保持轻量，不强绑所有第三方 SDK
- 当选择 `ncp` 链路时，除存储层外，更上的层仍然基于 NCP 体系

## 与已有方案的关系

这份文档是对现有 NCP 规划的继续收束，不替代之前文档。

- [NCP 定位与愿景](../designs/2026-03-17-ncp-positioning-and-vision.md)
  - 明确 NCP 必须面向通用场景、可扩展、可维护、解耦业务
- [NCP Native Runtime Refactor Plan](./2026-03-18-ncp-native-runtime-refactor-plan.md)
  - 明确当选择 NCP 链路时，存储层以上都应基于 NCP
- 本文
  - 明确在 NCP-native runtime 成立之后，如何进一步支持多种 agent runtime，并保持默认主链路简单清晰

换句话说：

- 前一份文档回答“如何从 bridge runtime 走向 fully NCP-native”
- 本文回答“当 NCP-native 已经是主体系后，如何让它继续容纳更多 agent 平台”

## 核心判断

我们的未来目标不是只有一种 runtime。

Nextclaw 应该允许前端创建不同类型的会话，例如：

- 默认 NCP native chat
- Codex 会话
- Claude Code 会话
- 未来更多 agent 平台会话

但这里有一个非常重要的边界：

- 默认会话必须始终存在，并且内建、稳定、轻量
- 其它 runtime 默认应当是可插拔、可选启用、可单独安装的
- NCP 不负责把所有平台硬编码进主包，而是负责提供统一承载它们的 runtime 契约与事件语义

但在交付节奏上，我们不应该一开始就同时推进多个外部 runtime。

首期目标要明确收敛为：

- 先把 `Codex SDK` 接入 NCP
- 先把 `Codex` 作为第一种外部 agent runtime 跑通
- 先验证“默认内建 + 可插拔外部 runtime”这套结构是否真实成立

也就是说：

- 长期方向：支持多种 agent 平台
- 首期范围：只做 `Codex SDK`

因此，长期正确结构不是“把 Codex SDK 塞进默认 runtime”，而是：

```text
NCP Frontend
  -> session type switch
  -> NCP backend
  -> runtime registry
  -> selected NcpAgentRuntime implementation
     - built-in default runtime
     - optional Codex runtime plugin
     - optional Claude runtime plugin
     - future plugins
  -> session store adapter
  -> existing storage
```

## 总体原则

### 1. 默认主链路保持内建

当前默认 runtime 仍然是产品的基础盘。

它必须：

- 内建随包可用
- 不依赖额外第三方 agent SDK
- 保持最完整的控制力与最小外部依赖
- 继续作为 NCP 的默认会话类型

默认链路不能因为支持更多平台而变重、变脆、变混乱。

### 2. 外部 agent runtime 必须可插拔

像 `Codex SDK`、`Claude Code` 这类 runtime，不应直接绑进主包。

原因很明确：

- 安装包会变重
- 运行依赖会变多
- 不同平台的配置、权限、沙箱与能力模型差异很大
- 很多用户根本不需要这些 runtime

因此这类能力应该以插件方式存在：

- 不默认安装，或默认不启用
- 安装后向 NCP runtime registry 注册一种新的 session type / runtime kind
- 前端只有在能力存在时才展示对应会话类型

### 3. 前端按会话类型选择，不按 UI 套娃

前端不应该为 `Codex`、`Claude`、`Native` 各写一套独立聊天 UI。

正确边界是：

- 共享展示层继续统一
- 前端通过会话类型或 runtime type 选择后端 runtime
- 会话历史、消息渲染、part 渲染、流式事件消费仍然统一走 NCP

也就是说，前端看到的是“不同会话类型”，而不是“不同产品页面”。

### 4. NCP 保持纯粹，只提供积木与契约

我们之前已经明确过，NCP 不应该提供一堆预组合好的业务方案，而要提供纯粹积木。

这条原则在多 runtime 方案里同样成立：

- NCP 应该提供 runtime 抽象、registry、事件模型、状态管理、session store 接缝
- 不应该把 `Codex`、`Claude` 等平台实现写死成框架默认内建套餐

消费方按需组装，插件按需注册。

## 推荐架构

### 1. Runtime Registry

需要有一个统一的 runtime registry 概念，由 UI NCP backend 在启动时组装。

它负责：

- 注册一个或多个 `NcpAgentRuntime` 提供者
- 暴露可用的 `session type` / `runtime kind`
- 根据会话类型为某个 session 创建对应 runtime
- 控制哪些 runtime 默认启用、哪些是扩展提供

这里最关键的是：

- `native` 是内建 runtime kind
- `codex`、`claude-code` 等是扩展 runtime kind
- 前端看到的会话类型，本质上来自这个 registry，而不是硬编码在页面里

### 2. Runtime Adapter Plugin

每一个外部 agent 平台，都应该以“一个独立的 NCP runtime 插件”形式接入。

例如：

- `@nextclaw/nextclaw-ncp-runtime-codex-sdk`
- `@nextclaw/nextclaw-ncp-runtime-claude-code`

这些插件的职责是：

- 负责初始化对应第三方 SDK
- 把第三方 runtime 的 thread / turn / event 模型映射成 NCP event
- 实现 `NcpAgentRuntime`
- 暴露插件元信息与 runtime kind

这意味着外部平台进入 Nextclaw 的方式，是“实现 NCP runtime”，而不是“绕开 NCP 直接接 UI”。

### 3. Session Type 与 Runtime Kind 对齐

前端会话类型不再只是文案，而应明确对应一个 runtime kind。

例如：

- `native`
- `codex`
- `claude-code`

会话一旦创建，其 runtime kind 就成为会话语义的一部分，并保存在会话 metadata 中。

这样可以保证：

- 刷新页面时仍能按原 runtime 继续恢复
- 同一个会话不会在不同 runtime 之间意外漂移
- 历史会话列表可以正确展示其类型

### 4. 存储层继续保持一致

这个方案不要求迁移底层存储结构。

仍然允许：

- session store adapter 保持与当前存储一致
- 历史消息、会话列表、删除等行为继续沿用现有存储

但要明确：

- 存储一致性不等于 runtime 继续混用 legacy
- runtime 语义必须在存储层之上明确收敛到 NCP

## Codex SDK 的具体接法

`Codex SDK` 不适合被塞进当前 `NcpLLMApi` 这一层。

原因是它不是普通 chat-completion provider，而是一个更接近 agent runtime 的线程式执行器。它有自己的：

- thread 生命周期
- streamed event 模型
- tool / approval / sandbox / workspace 语义
- turn 级别失败与完成事件

因此正确接法应是：

- 新增 `CodexSdkNcpAgentRuntime implements NcpAgentRuntime`
- 它直接消费 Codex SDK 事件
- 它把 Codex 事件映射成 NCP 事件与 NCP message parts
- 它注册为一个可选 runtime kind，例如 `codex`

而不应采用下面这种错误接法：

- 把 Codex SDK 假装成普通 `NcpLLMApi`
- 继续套用默认 text/tool loop
- 在 `DefaultNcpAgentRuntime` 里强行模拟 Codex 的 thread / turn 语义

那样会重新制造一个新的 bridge runtime，破坏 NCP 边界。

## 首期目标收敛

虽然整体架构是面向多 runtime 的，但首期交付必须足够聚焦。

当前首期目标定义为：

1. 前端可以新建 `codex` 类型会话。
2. `codex` 会话走独立的 `CodexSdkNcpAgentRuntime`。
3. 前端仍复用现有 NCP 聊天 UI，不新增独立页面。
4. 默认 `native` 会话保持不变，继续作为默认类型。
5. 未安装或未启用 `Codex` runtime 时，默认主包体验不受影响。

这意味着首期不是“把多 runtime 框架一次性做满”，而是：

- 先做对 `Codex SDK` 足够、但不把未来路堵死的最小长期结构
- 先完成一个可真实使用的外部 runtime 接入样板
- 再根据这次接入结果，把 runtime registry 和插件能力继续泛化

## 前端产品形态

前端的产品形态应该很简单：

- 默认仍然创建 `native` 会话
- 当检测到某个 runtime 插件可用时，前端可额外提供对应会话类型入口
- 没有安装或没有启用时，就不展示对应会话类型

这样做的好处是：

- 主路径不受影响
- 默认体验不被稀释
- 高级用户可以按需开启扩展 runtime
- 安装包与认知负担都保持可控

## 插件启用原则

对于 `Codex`、`Claude Code` 这类 runtime，建议遵循下面口径：

- 主仓库可以提供官方插件包
- 默认安装包不必须内置全部插件
- 即使插件被安装，也不一定默认启用
- 启用需要显式配置

这样能同时满足：

- 官方支持
- 安装轻量
- 可插拔扩展
- 演进空间清晰

## 分阶段落地建议

### Phase 1：Codex SDK 首期接入

第一阶段不追求一次性支持多个平台，而是只服务于 `Codex SDK` 接入。

需要完成：

- 为 UI NCP backend 引入 runtime registry
- 让 `native` 成为 registry 中的默认内建 runtime
- 新增 `codex` runtime kind，并允许通过插件注册
- 新增 `CodexSdkNcpAgentRuntime`
- 让前端可创建 `codex` 类型会话
- 让 session metadata 正式记录 runtime kind
- 确保现有共享 NCP UI 可以直接消费 `codex` 事件流

这一阶段的目标不是泛化所有平台，而是：

- 先把 `Codex SDK` 真正接进 NCP
- 先验证 runtime registry、runtime kind、可插拔注册、共享 UI 这些关键边界
- 先拿到一条可完整验收的外部 runtime 链路

### Phase 2：抽象收敛与结构泛化

当 `Codex` 跑通后，再回头判断哪些部分值得进一步抽象成更通用的能力。

重点包括：

- runtime registry 的接口是否已经足够稳定
- runtime metadata / session type 建模是否还需要收敛
- 插件发现、启用、配置是否需要更明确的契约
- NCP event / part 模型是否需要为 agent runtime 再补积木

这一阶段的目标是：

- 把“为 Codex 而做”的结构，收敛成“对未来 runtime 也成立”的结构
- 避免为了首期交付做出只适用于 Codex 的临时设计

### Phase 3：推广到更多 runtime

当 `Codex` 接法被验证成立后，再用同一模式扩展到：

- `Claude Code`
- 其它未来 agent 平台

到这一步，NCP 才真正成为“能承载多种 agent runtime 的通用 building blocks”。

## 非目标

这份方案当前不追求：

- 让所有 runtime 在能力细节上完全一致
- 让所有 runtime 都内建进默认安装包
- 为每一种 runtime 定制独立 UI 页面
- 为了兼容旧 engine/plugin 体系而长期保留双重抽象

## 验收标准

这套方案成立，至少要满足下面这些标准：

1. 默认 `native` 会话继续可用，而且不依赖外部 agent SDK。
2. `codex` / `claude-code` 这类会话可以通过插件方式新增，而不是侵入默认 runtime。
3. 前端聊天 UI 不需要按 runtime 重写，只通过会话类型切换后端 runtime。
4. 存储层仍保持一致，但 runtime 层之上统一归于 NCP。
5. 未安装扩展插件时，默认安装包仍保持轻量。
6. 新增一个 agent 平台时，主要工作是“实现一个新的 NCP runtime 插件”，而不是复制整条聊天链路。

## 最终结论

长期最优结构不是“只有一种 NCP runtime”，也不是“把各种 agent 平台继续挂在 legacy 世界里”。

长期最优结构是：

- NCP 作为统一前后端链路与 runtime 容器
- `native` 作为内建默认 runtime
- `codex`、`claude-code`、未来更多平台作为可插拔 runtime
- 前端通过会话类型选择 runtime
- 默认安装保持轻量，扩展能力按需启用

这既符合 Nextclaw 的产品方向，也符合 NCP 面向通用、可扩展、可维护、解耦业务的定位。
