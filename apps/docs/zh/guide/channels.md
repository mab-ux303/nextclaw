# 渠道

这页面向“先连起来再优化”的使用路径。

## 一句话理解

渠道就是把同一个 NextClaw 助手接到不同消息入口（如 Telegram、Discord、Slack）。

## 先做最小可用

1. 在 UI 里选择一个渠道（建议先从你最常用的一个开始）。
2. 填入该渠道要求的基础凭证（例如 token / appId / appSecret）。
3. 保存后做一次真实收发测试。
4. 跑通后再配置白名单与群组策略。

## 通用安全项：`allowFrom`

- `allowFrom` 为空（`[]`）：允许所有发送者。
- `allowFrom` 非空：仅允许白名单中的用户 ID。

建议：上线前至少给高风险渠道设置 `allowFrom`。

## 各渠道你只需要先准备什么

### Discord

- Bot Token
- 打开 `MESSAGE CONTENT INTENT`
- 给 Bot 授予基础读写消息权限

### Telegram

- BotFather 创建的 Bot Token
- 你的用户 ID（用于白名单时）

### Slack

- Bot Token
- App-Level Token（含 `connections:write`）

### 飞书（Lark）

- 飞书开放平台应用的 `appId` / `appSecret`

### WhatsApp（whatsapp-web.js）

- 首次登录扫码

## 进阶配置（可选）

如需批量管理或版本化配置，可在 `~/.nextclaw/config.json` 的 `channels` 下维护。

完整参数说明见：
- [配置](/zh/guide/configuration)
- [命令](/zh/guide/commands)
