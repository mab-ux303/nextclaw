type RemoteStreamEvent = {
  event: string;
  payload?: unknown;
};

function parseRemoteSseFrame(frame: string): RemoteStreamEvent | null {
  const lines = frame.split("\n");
  let event = "";
  const dataLines: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!event) {
    return null;
  }
  const data = dataLines.join("\n");
  if (!data) {
    return { event };
  }
  try {
    return { event, payload: JSON.parse(data) };
  } catch {
    return { event, payload: data };
  }
}

function readRemoteStreamError(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload && "error" in payload) {
    const typed = payload as { error?: { message?: string } };
    if (typed.error?.message) {
      return typed.error.message;
    }
  }
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  return fallback;
}

function processRemoteStreamFrame(params: {
  rawFrame: string;
  onEvent: (frame: RemoteStreamEvent) => void;
  setFinalResult: (value: unknown) => void;
}): void {
  const frame = parseRemoteSseFrame(params.rawFrame);
  if (!frame) {
    return;
  }
  if (frame.event === "final") {
    params.setFinalResult(frame.payload);
    return;
  }
  if (frame.event === "error") {
    throw new Error(readRemoteStreamError(frame.payload, "stream failed"));
  }
  params.onEvent(frame);
}

function flushRemoteStreamFrames(params: {
  bufferState: { value: string };
  onEvent: (frame: RemoteStreamEvent) => void;
  setFinalResult: (value: unknown) => void;
}): void {
  let boundary = params.bufferState.value.indexOf("\n\n");
  while (boundary !== -1) {
    processRemoteStreamFrame({
      rawFrame: params.bufferState.value.slice(0, boundary),
      onEvent: params.onEvent,
      setFinalResult: params.setFinalResult
    });
    params.bufferState.value = params.bufferState.value.slice(boundary + 2);
    boundary = params.bufferState.value.indexOf("\n\n");
  }
}

export async function readRemoteAppStreamResult(params: {
  response: Response;
  onEvent: (frame: RemoteStreamEvent) => void;
}): Promise<unknown> {
  const reader = params.response.body?.getReader();
  if (!reader) {
    throw new Error("SSE response body unavailable.");
  }

  const decoder = new TextDecoder();
  const bufferState = { value: "" };
  let finalResult: unknown = undefined;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      bufferState.value += decoder.decode(value, { stream: true });
      flushRemoteStreamFrames({
        bufferState,
        onEvent: params.onEvent,
        setFinalResult: (nextValue) => {
          finalResult = nextValue;
        }
      });
    }

    if (bufferState.value.trim()) {
      processRemoteStreamFrame({
        rawFrame: bufferState.value,
        onEvent: params.onEvent,
        setFinalResult: (nextValue) => {
          finalResult = nextValue;
        }
      });
    }
  } finally {
    reader.releaseLock();
  }

  if (finalResult === undefined) {
    throw new Error("stream ended without final event");
  }
  return finalResult;
}
