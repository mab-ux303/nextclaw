# v0.0.1-marketplace-anthropic-doc-skills

## 迭代完成说明

- 在 Marketplace Skills 数据源中新增 4 个文档处理类 Git 技能（Anthropic skills）：
  - `pdf`（`anthropics/skills/skills/pdf`）
  - `docx`（`anthropics/skills/skills/docx`）
  - `pptx`（`anthropics/skills/skills/pptx`）
  - `xlsx`（`anthropics/skills/skills/xlsx`）
- 新增推荐场景 `documents`，聚合以上 4 个文档处理技能。
- 更新 catalog 版本与生成时间。

## 测试/验证/验收方式

- 数据与构建校验：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api validate:catalog`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api tsc`
- 安装冒烟（隔离目录 `/tmp`）：
  - 通过 `ServiceCommands.installMarketplaceSkill({ kind: 'git' })` 实际安装：`pdf/docx/pptx`
  - 观察点：`workspace/skills/<name>-market-smoke/SKILL.md` 均存在。

## 发布/部署方式

1. 合并到 `main/master`。
2. 触发 `Marketplace Catalog Sync` workflow 自动校验与部署 worker。
3. 完成后在 Skills Marketplace 验证新增条目与安装行为。

## 用户/产品视角的验收步骤

1. 打开 Skills Marketplace。
2. 在列表或搜索中找到 `PDF Toolkit` / `DOCX Toolkit` / `PPTX Toolkit` / `XLSX Toolkit`。
3. 点击安装并等待成功提示。
4. 在已安装技能中确认状态更新。
5. 在 workspace 的 `skills/<slug>` 目录中确认 `SKILL.md` 存在。
