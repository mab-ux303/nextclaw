# Validation

## 自动验证

```bash
PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build
```

结果：

- Docs build 通过（VitePress build complete）。

## 不适用项说明

- `lint`：本次仅文档内容与 README 文案调整，未改动运行时代码。
- `tsc`：本次未改动 TypeScript 业务逻辑或类型定义。

## 冒烟测试

执行命令：

```bash
rg -n "前置准备|打开终端|EACCES|nextclaw stop" apps/docs/zh/guide/getting-started.md README.zh-CN.md
rg -n "Prerequisites|Open a Terminal|EACCES|nextclaw stop" apps/docs/en/guide/getting-started.md README.md
```

验证点与结果：

1. 中文 `/zh/guide/getting-started` 页面可见“前置准备/打开终端/常见问题”完整结构。
2. 英文 `/en/guide/getting-started` 页面结构与中文一致。
3. README 中快速开始包含 Node.js 前置提示与文档链接。
4. 文档中示例命令可直接复制执行（`npm i -g nextclaw`、`nextclaw start`、`nextclaw stop`）。
