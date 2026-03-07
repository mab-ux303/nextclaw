# v0.12.27-chat-slash-trigger-strict-session

## 迭代完成说明（改了什么）
- 收紧 slash 菜单触发条件：仅当输入从首字符开始为 `/` 且后续不含空白时，才允许进入 slash 查询态。
- 修复回删重开问题：在 `/xxxx yy` 场景触发过失效后，回删到 `/xxxx` 不会重新弹出菜单。
- 调整 dismiss 复位逻辑：只有当输入不再以 `/` 开头时，才复位 `dismissedSlashPanel`，从而保证同一条 slash 输入链路中的关闭状态持续有效。

## 测试/验证/验收方式
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui build`：通过。
- `pnpm -C packages/nextclaw-ui lint`：未通过；存在仓库既有错误（`useChatStreamController.ts`、`MaskedInput.tsx`），非本次改动引入。

## 发布/部署方式
- 本次为聊天输入交互逻辑修复，按既有前端发布流程发布即可。

## 用户/产品视角的验收步骤
- 输入 `/xxxx`，菜单弹出。
- 输入空格并继续输入（如 `/xxxx yy`），菜单关闭。
- 删除 `yy` 再删除空格回到 `/xxxx`，菜单不应再次自动弹出。
- 继续按 `Esc` 关闭后输入字符，菜单仍不应重开。
- 清空或改成非 `/` 开头后，再新输入 `/`，菜单应可正常弹出。
