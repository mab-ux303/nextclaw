# 密钥管理（Secrets）

## 为什么要用 Secrets

如果把 key 直接写在配置里，常见风险是：

- 截图时误暴露
- 复制配置给同事时泄露
- 提交代码时带出敏感信息

Secrets 的思路是：配置里只放“引用关系”，真实密钥放在外部安全来源。

## 真实密钥可以放哪里

- `env`：系统环境变量
- `file`：外部 JSON 文件
- `exec`：外部命令输出（常用于对接密钥系统）

`config.json` 中只保留：

- `secrets.providers`
- `secrets.defaults`
- `secrets.refs`

## 小白可用路径（UI 优先）

1. 打开 Web UI 的 `/secrets` 页面。
2. 打开 `enabled`。
3. 配置一个默认 provider（通常先用 `env`）。
4. 把 `providers.<name>.apiKey` 这类敏感路径改为 `refs` 引用。
5. 保存后执行一次连接测试，确认业务功能正常。

## 典型收益

- 团队共享配置模板时，不再传播真实 key。
- 多环境切换时，不用反复改业务配置。
- 密钥轮换更简单，变更集中在密钥来源。

## 旧方式还能用吗

能用。直接配置 `providers.<name>.apiKey` 仍可运行。

建议：

- 个人临时调试：可直接写 key。
- 团队协作或长期环境：优先使用 secrets refs。

## 进阶入口（可选）

如果你需要自动化批量管理 secrets，可使用 `nextclaw secrets` 子命令。
详细参数与示例见：[命令](/zh/guide/commands)。
