# NextClaw Platform Console

用户前端 + 管理后台统一控制台。

技术栈：
- React + TypeScript
- TanStack Query
- Zustand
- Tailwind（shadcn 风格组件组织）

## 本地运行

```bash
pnpm -C apps/platform-console install
pnpm -C apps/platform-console dev
```

默认通过 Vite 代理到 `http://127.0.0.1:8787`：
- `/platform/*`
- `/v1/*`
- `/health`

可通过环境变量覆盖：

```bash
VITE_PLATFORM_API_BASE=http://127.0.0.1:8790 pnpm -C apps/platform-console dev
```

## 构建与检查

```bash
pnpm -C apps/platform-console build
pnpm -C apps/platform-console lint
pnpm -C apps/platform-console tsc
```
