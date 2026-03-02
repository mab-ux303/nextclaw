# Release

## 发布/部署方式

本次为文档内容变更，按文档站发布流程执行：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs
```

## 发布闭环说明

- 代码变更：已完成（中英文快速开始文档 + README 快速开始）。
- 构建验证：已完成（docs build 通过）。
- 部署动作：按需执行上方 `deploy:docs`。

## 不适用项

- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（本次仅文档更新）。
