# 2026-03-01 Remove Config Provider Links (ZH/EN)

## 背景 / 问题

- 用户要求移除 README 中中英文文档列表里的配置外链入口。

## 决策

- 仅删除指定链接条目，保留其余文档入口不变。

## 变更内容（迭代完成说明）

- 文件：`README.zh-CN.md`
- 变更：删除 `- [配置与 Provider](https://docs.nextclaw.io/zh/guide/configuration)`。
- 文件：`README.md`
- 变更：删除 `- [Configuration & Providers](https://docs.nextclaw.io/en/guide/configuration)`。

## 测试 / 验证 / 验收方式

```bash
sed -n '68,88p' README.zh-CN.md
sed -n '72,92p' README.md
rg -n "\[配置与 Provider\]\(https://docs.nextclaw.io/zh/guide/configuration\)" README.zh-CN.md
rg -n "\[Configuration & Providers\]\(https://docs.nextclaw.io/en/guide/configuration\)" README.md
```

验收点：

- 中英文文档列表中均不再出现对应配置链接。
- 其余链接保持原样。

## 用户 / 产品视角验收步骤

1. 打开 `README.zh-CN.md` 与 `README.md` 的“文档”章节。
2. 确认“配置与 Provider / Configuration & Providers”链接都已不存在。
3. 确认其它文档入口仍可见。

## 发布 / 部署方式

- 文档变更，无需单独发布流程；随常规代码发布即可。

## 影响范围 / 风险

- Breaking change：否。
- 风险：低，仅文档入口删减。
