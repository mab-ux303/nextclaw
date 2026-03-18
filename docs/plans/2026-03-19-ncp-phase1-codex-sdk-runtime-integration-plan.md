# NCP Phase 1: Codex SDK Runtime Integration Plan

## 这份文档回答什么

这份文档专门回答：

在不破坏当前默认 `native` NCP 聊天链路的前提下，如何完成首期 `Codex SDK` 接入。

这里的 `Phase 1` 是一个明确收敛的首期目标，不讨论所有未来 runtime，只聚焦一件事：

- 让 `Codex SDK` 成为 NCP 体系中的第一种外部 agent runtime

## 与上层方案的关系

这份文档是以下方案的首期落地子集：

- [NCP Pluggable Agent Runtime Plan](./2026-03-19-ncp-pluggable-agent-runtime-plan.md)
- [NCP Native Runtime Refactor Plan](./2026-03-18-ncp-native-runtime-refactor-plan.md)

关系可以理解为：

- 上层方案回答长期结构
- 本文回答首期怎么真正做出来

## 首期目标

本阶段必须一次性达成下面五个结果：

1. 前端可以新建 `codex` 类型会话。
2. `codex` 会话走独立的 `CodexSdkNcpAgentRuntime`。
3. 前端继续复用现有 NCP 聊天 UI，不新增一套专门给 Codex 的页面。
4. 默认 `native` 会话保持不变，继续作为默认类型。
5. 未安装或未启用 Codex 能力时，默认安装包与默认体验不受影响。

## 非目标

本阶段不做：

- 同时接入 `Claude Code`
- 一次性设计完所有未来 runtime 的全部细节
- 改造默认 `native` runtime 的核心执行逻辑
- 为 Codex 重新设计一套独立前端
- 迁移底层存储层

## 核心判断

`Codex SDK` 不应该被塞进当前 `NcpLLMApi` 这一层。

原因很明确：

- 它不是普通的 chat-completion provider
- 它有自己的 thread 生命周期
- 它有自己的 streamed event 模型
- 它具备 agent runtime 级别的配置与行为语义

因此首期的正确做法不是：

- 用 `Codex SDK` 伪装成 LLM provider
- 再硬套 `DefaultNcpAgentRuntime` 的 text/tool round loop

而是：

- 让 `Codex SDK` 以独立 `NcpAgentRuntime` 的方式接入
- 直接把 Codex event 映射成 NCP event 与 NCP message parts

## 目标结构

首期落地后的结构应当接近：

```text
NCP Chat UI
  -> session type = native | codex
  -> UI NCP backend
  -> runtime registry
      - native -> DefaultNcpAgentRuntime
      - codex -> CodexSdkNcpAgentRuntime
  -> selected runtime
  -> NCP session store adapter
  -> existing storage
```

关键点：

- `native` 仍是默认 runtime
- `codex` 是首个外部 runtime kind
- 前端只认 session type / runtime kind，不关心底层 SDK

## 核心设计

### 1. 引入 runtime registry

UI NCP backend 不能继续只写死创建一个 runtime。

需要新增一个 registry 概念，负责：

- 注册当前可用 runtime kind
- 提供默认 runtime kind
- 根据 session type / runtime kind 创建对应 runtime
- 向前端暴露“当前可新建哪些会话类型”

首期 registry 不需要过度复杂，只要足够支撑：

- `native`
- `codex`

即可。

### 2. `native` 继续作为默认内建 runtime

当前默认链路不应被改成可选插件。

它继续保留为：

- 内建
- 默认
- 随包可用

也就是说，这次接入 Codex 的目标不是替换 `native`，而是在 NCP 体系里新增第二种 runtime。

### 3. 新增 `CodexSdkNcpAgentRuntime`

需要新增一个独立 runtime 实现：

- `CodexSdkNcpAgentRuntime implements NcpAgentRuntime`

它负责：

- 初始化 Codex client
- 按 session 维护 Codex thread
- 发起 run
- 消费 Codex streamed events
- 转换成标准 NCP event

这个 runtime 不应直接写前端状态，不应直接写 legacy session event，不应再回到旧 engine/plugin 接口。

### 4. 复用旧 Codex 插件里的局部能力，但不复用旧抽象

仓库里已经有旧的 `codex-sdk` engine plugin，可以作为能力来源，但不能原封不动搬进来。

可复用的主要是：

- Codex client 初始化逻辑
- config 解析逻辑
- thread 复用逻辑
- assistant delta 增量提取逻辑

不应继续复用的部分包括：

- 旧 engine 接口
- 旧 sessionManager 写法
- 直接写 legacy session event
- 直接把 runtime 结果拼接回老链路

换句话说，复用“实现经验”，不复用“旧世界边界”。

### 5. 前端按 session type 创建会话

前端不需要新增新的聊天页面。

需要做的是：

- 会话类型列表里新增 `codex`
- 创建会话时可选择 `codex`
- 选中会话后，后续消息发送自动带上该 runtime kind
- 刷新页面后，仍按该会话类型恢复

共享的消息列表、输入框、流式渲染、part 渲染都继续沿用现有 NCP UI。

### 6. session metadata 正式记录 runtime kind

`codex` 会话一旦创建，runtime kind 应成为该会话的一部分。

需要明确保存在 session metadata 中，保证：

- 会话恢复时不漂移
- 历史会话列表能识别类型
- 后端创建 runtime 时能稳定选择正确实现

## Codex 事件到 NCP 事件的映射

首期至少要打通下面这些事件语义：

- assistant 文本输出
  - 映射到 `message.text-start / delta / end`
- reasoning / thinking 输出
  - 如果 Codex 提供对应事件，则映射到 `message.reasoning-start / delta / end`
- tool invocation
  - 映射到 `message.tool-call-start / args-delta / end / result`
- turn failed
  - 映射到 `run.error`
- turn finished
  - 映射到 `run.finished`

原则只有一个：

- 前端看到的永远是 NCP event，而不是 Codex 原始 event

## 插件化边界

首期虽然只做 Codex，但仍然要保住长期插件化边界。

因此建议的包边界是：

- 主包里只保留 runtime registry 与内建 runtime 装配能力
- `Codex SDK` 相关实现放在独立 runtime 插件包中
- 主包仅在检测到该插件存在且启用时才注册 `codex`

这样能满足两个目标：

- 现在先把 Codex 跑通
- 将来不把默认安装包拖重

## 最小实施拆分

### Step 1：Backend runtime registry

先把 UI NCP backend 从“固定 runtime”改成“按 runtime kind 创建 runtime”。

这一步完成后，即使暂时只有 `native`，结构也已经成立。

### Step 2：Codex runtime plugin

新增 `CodexSdkNcpAgentRuntime`，并让它可向 registry 注册 `codex` runtime kind。

### Step 3：Session type integration

让前端可看到 `codex` 会话类型，并在创建/切换/恢复时带上对应 runtime kind。

### Step 4：Event mapping verification

验证 `codex` 会话下的：

- 发送消息
- 流式回复
- 停止生成
- 历史恢复
- 会话切换

全部继续通过 NCP UI 工作。

## 风险点

### 1. Codex event 语义与 NCP event 不完全对齐

这会是首期最大风险。

解决原则是：

- 先映射核心用户可见语义
- 不为了完全对齐而破坏 NCP 主模型

### 2. 插件包与默认包的依赖边界可能混乱

如果直接把 `@openai/codex-sdk` 拉进默认主包，会破坏首期目标。

因此首期实现时必须优先守住依赖边界。

### 3. session type 与 runtime kind 命名不一致

首期最好直接统一：

- session type = runtime kind = `codex`

避免出现：

- 前端叫 `codex`
- 后端叫 `codex-sdk`
- metadata 又写第三种名字

### 4. 默认链路被误伤

这次改造必须保证：

- `native` 仍是默认
- 未启用 Codex 时，不影响默认流程

## 验收标准

本阶段完成的标准是：

1. UI 会话类型列表中可出现 `codex`。
2. 新建 `codex` 会话后，消息走 `CodexSdkNcpAgentRuntime`。
3. `codex` 会话使用现有 NCP 聊天 UI，无额外专属页面。
4. `native` 会话继续保持默认并可正常工作。
5. 未启用 Codex 插件时，系统仍只暴露 `native`，且行为与现在一致。

## 最终结论

`Phase 1` 的本质不是“把 Codex 接进来就行”，而是：

- 用 `Codex SDK` 验证 NCP 是否真的能承载外部 agent runtime
- 在不伤害默认链路的前提下，建立“默认内建 + 可插拔外部 runtime”的第一条真实样板链路

如果这一步做好了，后面的 `Claude Code` 和更多 runtime 扩展，才会变成相同模式的复制，而不是重新设计一遍系统。
