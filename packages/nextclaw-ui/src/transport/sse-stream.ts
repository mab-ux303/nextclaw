import type { StreamEvent } from './transport.types';

type SseErrorPayload = { message?: string } | string | undefined;

function parseSseFrame(frame: string): StreamEvent | null {
  const lines = frame.split('\n');
  let name = '';
  const dataLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      name = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!name) {
    return null;
  }

  let payload: unknown = undefined;
  const data = dataLines.join('\n');
  if (data) {
    try {
      payload = JSON.parse(data);
    } catch {
      payload = data;
    }
  }

  return { name, payload };
}

function readSseErrorMessage(payload: SseErrorPayload, fallback: string): string {
  return typeof payload === 'string'
    ? payload
    : payload?.message ?? fallback;
}

function processSseFrame(
  rawFrame: string,
  onEvent: (event: StreamEvent) => void,
  setFinalResult: (value: unknown) => void
): void {
  const frame = parseSseFrame(rawFrame);
  if (!frame) {
    return;
  }
  if (frame.name === 'final') {
    setFinalResult(frame.payload);
    return;
  }
  if (frame.name === 'error') {
    throw new Error(readSseErrorMessage(frame.payload as SseErrorPayload, 'chat stream failed'));
  }
  onEvent(frame);
}

function flushBufferedFrames(
  bufferState: { value: string },
  onEvent: (event: StreamEvent) => void,
  setFinalResult: (value: unknown) => void
): void {
  let boundary = bufferState.value.indexOf('\n\n');
  while (boundary !== -1) {
    processSseFrame(bufferState.value.slice(0, boundary), onEvent, setFinalResult);
    bufferState.value = bufferState.value.slice(boundary + 2);
    boundary = bufferState.value.indexOf('\n\n');
  }
}

export async function readSseStreamResult<TFinal>(
  response: Response,
  onEvent: (event: StreamEvent) => void
): Promise<TFinal> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('SSE response body unavailable');
  }

  const decoder = new TextDecoder();
  const bufferState = { value: '' };
  let finalResult: unknown = undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      bufferState.value += decoder.decode(value, { stream: true });
      flushBufferedFrames(bufferState, onEvent, (nextValue) => {
        finalResult = nextValue;
      });
    }
    if (bufferState.value.trim()) {
      processSseFrame(bufferState.value, onEvent, (nextValue) => {
        finalResult = nextValue;
      });
    }
  } finally {
    reader.releaseLock();
  }

  if (finalResult === undefined) {
    throw new Error('stream ended without final event');
  }
  return finalResult as TFinal;
}
