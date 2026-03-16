#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer as createNetServer, Socket } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNcpDemoEnv } from './env.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const DEFAULT_PORT = 3297;
const PORT_SCAN_LIMIT = 20;
const port = await resolveFreePort(DEFAULT_PORT, '127.0.0.1');
const baseUrl = `http://127.0.0.1:${port}`;
const loadedEnv = loadNcpDemoEnv(rootDir);
const baseEnv = { ...loadedEnv, ...process.env };
assertRequiredLlmEnv(baseEnv);

function isPortAvailable(portToCheck, host) {
  return new Promise((resolveAvailable) => {
    const server = createNetServer();
    server.unref();
    server.once('error', () => resolveAvailable(false));
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
    socket.once('connect', () => finalize(true));
    socket.once('error', (error) => {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
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

const server = spawn(pnpmBin, ['-C', 'backend', 'exec', 'tsx', '--tsconfig', 'tsconfig.json', 'src/index.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...baseEnv,
    NODE_OPTIONS: [baseEnv.NODE_OPTIONS, '--conditions=development'].filter(Boolean).join(' '),
    NCP_DEMO_PORT: String(port)
  },
  shell: process.platform === 'win32'
});

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error('Demo server did not become healthy in time.');
}

function parseSseFrames(rawText) {
  const frames = [];
  const chunks = rawText.split('\n\n');
  for (const chunk of chunks) {
    const eventMatch = chunk.match(/^event:\s*(.+)$/m);
    const dataMatch = chunk.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) {
      continue;
    }
    frames.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
  }
  return frames;
}

async function main() {
  try {
    await waitForHealth();

    const sessionId = 'smoke-session';
    const requestBody = {
      sessionId,
      message: {
        id: 'user-smoke',
        sessionId,
        role: 'user',
        status: 'final',
        parts: [{ type: 'text', text: 'Use the get_current_time tool for Asia/Shanghai, then tell me the current time.' }],
        timestamp: new Date().toISOString()
      }
    };

    const response = await fetch(`${baseUrl}/ncp/agent/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(requestBody)
    });
    const sendFrames = parseSseFrames(await response.text());
    const events = sendFrames.filter((frame) => frame.event === 'ncp-event').map((frame) => frame.data);
    const runStarted = events.find((event) => event.type === 'run.started');
    const toolResult = events.find((event) => event.type === 'message.tool-call-result');
    const finished = events.find((event) => event.type === 'run.finished');

    if (!runStarted?.payload?.runId || !toolResult || !finished) {
      throw new Error('Smoke send flow did not produce run.started/tool result/run.finished.');
    }

    const sessions = await fetch(`${baseUrl}/demo/sessions`).then((res) => res.json());
    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new Error('Smoke sessions endpoint returned no sessions.');
    }

    const seed = await fetch(`${baseUrl}/demo/sessions/${sessionId}/seed`).then((res) => res.json());
    if (seed?.status !== 'idle' || !Array.isArray(seed?.messages) || seed.messages.length === 0) {
      throw new Error('Smoke seed endpoint did not return persisted session history.');
    }

    console.log('[smoke] ncp demo passed');
  } finally {
    server.kill('SIGTERM');
  }
}

function assertRequiredLlmEnv(env) {
  const apiKey = typeof env.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  const baseUrl =
    typeof env.OPENAI_BASE_URL === 'string' && env.OPENAI_BASE_URL.trim()
      ? env.OPENAI_BASE_URL.trim()
      : typeof env.base_url === 'string'
        ? env.base_url.trim()
        : '';

  if (!apiKey || !baseUrl) {
    throw new Error(
      'ncp-demo smoke requires OPENAI_API_KEY and OPENAI_BASE_URL (or base_url). Mock mode has been removed.',
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  server.kill('SIGTERM');
  process.exit(1);
});
