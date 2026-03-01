# Desktop Installer (Beta)

> [!WARNING]
> This feature is currently in **experimental beta** and may contain known or unknown issues.

## Overview

The macOS desktop installer is designed for non-technical users:

- Download installer package
- Install with default options
- Start NextClaw and open the UI directly

You do not need to preinstall Node.js/npm manually. NextClaw will bootstrap runtime dependencies during install/startup.

## Download

- Release page: [v0.8.50-installer-beta.2](https://github.com/Peiiii/nextclaw/releases/tag/v0.8.50-installer-beta.2)
- Apple Silicon (arm64): [NextClaw-0.8.50-beta-macos-arm64-installer.pkg](https://github.com/Peiiii/nextclaw/releases/download/v0.8.50-installer-beta.2/NextClaw-0.8.50-beta-macos-arm64-installer.pkg)
- Intel (x64): [NextClaw-0.8.50-beta-macos-x64-installer.pkg](https://github.com/Peiiii/nextclaw/releases/download/v0.8.50-installer-beta.2/NextClaw-0.8.50-beta-macos-x64-installer.pkg)

## Install

1. Download the `.pkg` that matches your Mac chip.
2. Double-click the installer and complete installation.
3. Launch NextClaw from `/Applications/NextClaw`.

## Validate

After install:

1. Run `pnpm installer:verify:ui`.
2. Open the printed `UI_URL=http://127.0.0.1:<port>`.
3. Verify basic flows (provider setup, channel setup, chat, plugin/skill install).
4. Stop with `pnpm installer:verify:ui:stop`.

The command auto-selects a free port to avoid conflicts with your local dev services.

## Notes

- Runtime bootstrap uses mirror fallback (`npmmirror` first, then official `nodejs.org`).
- This beta currently prioritizes macOS installer release quality.
