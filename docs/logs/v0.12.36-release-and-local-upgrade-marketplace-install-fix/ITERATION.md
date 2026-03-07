# v0.12.36 release and local upgrade marketplace install fix

## 迭代完成说明（改了什么）

- 修复 marketplace 技能安装在服务 API 路径下“提示成功但未真实安装”的问题并准备发布。
- 新增 `nextclaw` patch changeset，发布该修复版本。
- 在本机升级到新发布版本，并做真实服务接口安装链路验证。

## 测试/验证/验收方式

- 发布前/发布中标准校验：
  - `pnpm release:check`
  - `pnpm release:version`
  - `pnpm release:publish`
- 本机升级验证：
  - `npm i -g nextclaw@<new-version>`
  - `nextclaw --version`
  - `nextclaw restart`
- 真实服务 API 冒烟：
  - 调用 `/api/marketplace/skills/install`
  - 再调用 `/api/marketplace/skills/installed` 对比安装前后
  - 校验对应 skill 目录与 `SKILL.md` 落盘

## 发布/部署方式

- 按项目 npm 发布流程执行 changeset version/publish。
- 本次无需数据库 migration 与后端部署步骤。

## 用户/产品视角的验收步骤

1. 升级到新版本 `nextclaw`。
2. 重启服务并打开技能市场。
3. 选择一个未安装 marketplace 技能点击“安装”。
4. 安装后同一卡片按钮应从“安装”变为“卸载”，且“已安装”页签可见该技能。
