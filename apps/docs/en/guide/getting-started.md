# Quick Start

## 0. Prerequisites (Read First)

NextClaw requires Node.js and npm.

1. Install Node.js (LTS recommended): [nodejs.org](https://nodejs.org/)
2. After installation, open a terminal and run:

```bash
node -v
npm -v
```

If you see versions (for example `v20.x` and `10.x`), your environment is ready.

## 1. Open a Terminal

- Windows:
  - Press `Win + R`, type `cmd`, then press Enter;
  - or open `PowerShell` from search.
- macOS: Press `Command + Space`, type `Terminal`, then press Enter.
- Linux: Usually `Ctrl + Alt + T`, or open `Terminal` from the app menu.

## 2. Install NextClaw

```bash
npm i -g nextclaw
```

## 3. Start the Service

Start the gateway + config UI in the background:

```bash
nextclaw start
```

## 4. Open the UI and Complete First-Time Setup

Open **http://127.0.0.1:18791** in your browser, then:

1. Add a provider (such as OpenRouter / OpenAI)
2. Select a default model
3. Save and send your first message

## 5. Useful Verification and Stop Commands

```bash
nextclaw --version
nextclaw status
nextclaw stop
```

## 6. Common Issues

### `npm` / `node` command not found

Node.js is not installed correctly, or the terminal session was not restarted. Reinstall Node.js and reopen the terminal.

### `EACCES` on macOS/Linux (global npm install permission)

Try reinstalling Node.js using the official installer first. If it persists, follow npm official docs to configure a user-level global directory.

### `http://127.0.0.1:18791` cannot be opened

1. Run `nextclaw status` to confirm the service is running.
2. If it is not running, start it:

```bash
nextclaw start
```

3. If it still does not open, restart:

```bash
nextclaw stop
nextclaw start
```

## What's Next?

- [Configuration](/en/guide/configuration) — Set up providers, models, and workspace
- [Secrets Management](/en/guide/secrets) — Keep keys out of config and rotate safely
- [Channels](/en/guide/channels) — Connect to Discord, Telegram, Slack, and more
- [Commands](/en/guide/commands) — Full CLI reference
