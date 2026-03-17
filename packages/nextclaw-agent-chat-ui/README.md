# @nextclaw/agent-chat-ui

Reusable Nextclaw agent chat UI package.

This package contains the reusable chat presentation layer extracted from `@nextclaw/ui`:

- chat input bar components
- chat message list components
- chat view-model types
- chat-local hooks and utilities
- default skin primitives used by the chat package itself

It intentionally does not include Nextclaw host wiring such as presenter/store access, runtime adapters, page shells, or product-specific business logic.

## Install

```bash
npm i @nextclaw/agent-chat-ui
```

## Development

```bash
pnpm -C packages/nextclaw-agent-chat-ui tsc
pnpm -C packages/nextclaw-agent-chat-ui test
pnpm -C packages/nextclaw-agent-chat-ui build
```

## Public API

```ts
import {
  ChatInputBar,
  ChatMessageList,
  useStickyBottomScroll,
  useCopyFeedback,
  copyText,
  type ChatInputBarProps,
  type ChatMessageListProps
} from '@nextclaw/agent-chat-ui';
```

## Scope

- Reusable: presentation, local interaction hooks, UI-owned utils, view-model contracts
- Not included: Nextclaw containers, adapters to runtime/store types, presenter wiring, page-level chat panels

## Links

- Repository: https://github.com/Peiiii/nextclaw
- Package source: https://github.com/Peiiii/nextclaw/tree/master/packages/nextclaw-agent-chat-ui
- Product docs: https://docs.nextclaw.io
