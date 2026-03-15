#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createServer as createNetServer, Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { loadNcpDemoEnv } from "./env.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const DEFAULT_BACKEND_PORT = 3297;
const DEFAULT_FRONTEND_PORT = 5281;
const PORT_SCAN_LIMIT = 20;
const backendPort = await resolveFreePort(DEFAULT_BACKEND_PORT, "127.0.0.1");
const frontendPort = await resolveFreePort(DEFAULT_FRONTEND_PORT, "127.0.0.1");
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const loadedEnv = loadNcpDemoEnv(rootDir);
const baseEnv = { ...loadedEnv, ...process.env };
const browser = await chromium.launch({ headless: true });

function shouldUseShell(command) {
  return process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isPortAvailable(portToCheck, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen(portToCheck, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

function isPortOccupied(portToCheck, host) {
  return new Promise((resolveOccupied) => {
    const socket = new Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolveOccupied(value);
    };

    socket.setTimeout(250, () => finalize(false));
    socket.once("connect", () => finalize(true));
    socket.once("error", (error) => {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
        finalize(false);
        return;
      }
      finalize(true);
    });

    socket.connect(portToCheck, host);
  });
}

async function resolveFreePort(startPort, host) {
  let current = startPort;
  for (let index = 0; index < PORT_SCAN_LIMIT; index += 1) {
    const occupied = await isPortOccupied(current, host);
    if (!occupied && (await isPortAvailable(current, host))) {
      return current;
    }
    current += 1;
  }
  throw new Error(`Unable to find a free port from ${startPort} (${host})`);
}

async function waitForUrl(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error(`Service did not become ready in time: ${url}`);
}

const nodeOptions = [baseEnv.NODE_OPTIONS, "--conditions=development"]
  .filter((value) => typeof value === "string" && value.trim().length > 0)
  .join(" ");

const backend = spawn(
  pnpmBin,
  ["-C", "backend", "exec", "tsx", "--tsconfig", "tsconfig.json", "src/index.ts"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...baseEnv,
      NODE_OPTIONS: nodeOptions,
      NCP_DEMO_PORT: String(backendPort),
      NCP_DEMO_LLM_MODE: "mock",
    },
    shell: shouldUseShell(pnpmBin),
  },
);

const frontend = spawn(
  pnpmBin,
  [
    "-C",
    "frontend",
    "exec",
    "vite",
    "--config",
    "vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(frontendPort),
    "--strictPort",
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...baseEnv,
      NODE_OPTIONS: nodeOptions,
      VITE_NCP_DEMO_API_BASE: backendBaseUrl,
    },
    shell: shouldUseShell(pnpmBin),
  },
);

async function main() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const firstPrompt = "remember-alpha";

  try {
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.error(`[browser:console] ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.error(`[browser:pageerror] ${error.message}`);
    });

    await waitForUrl(`${backendBaseUrl}/health`);
    await waitForUrl(frontendBaseUrl);

    await page.goto(frontendBaseUrl, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("Ask anything. Demo will call get_current_time tool first.").waitFor();

    await page.getByPlaceholder("Ask anything. Demo will call get_current_time tool first.").fill(firstPrompt);
    await page.getByRole("button", { name: "send" }).click();

    await page.locator(".message.user", { hasText: firstPrompt }).waitFor();
    await page.locator(".session-card.active .session-card-id").waitFor();
    const sessionId = (await page.locator(".session-card.active .session-card-id").textContent())?.trim();
    if (!sessionId) {
      throw new Error("UI smoke failed to capture the created session id.");
    }

    await page.getByRole("button", { name: "new" }).click();
    await page.getByText("Send a message to start.").waitFor();
    await page.waitForFunction((text) => !document.body.innerText.includes(text), firstPrompt);

    await page.locator(".session-card", { hasText: sessionId }).click();
    await page.locator(".message.user", { hasText: firstPrompt }).waitFor();

    console.log("[smoke-ui] ncp demo session hydration passed");
  } finally {
    await context.close();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    backend.kill("SIGTERM");
    frontend.kill("SIGTERM");
    await browser.close();
  });
