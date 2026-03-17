import { useEffect, useRef, useState } from "react";
import { NcpHttpAgentClientEndpoint } from "@nextclaw/ncp-http-agent-client";
import { useHydratedNcpAgent } from "@nextclaw/ncp-react";
import { ChatHeader, ChatInput, ErrorBox, MessageList } from "@nextclaw/ncp-react-ui";
import { loadConversationSeed } from "../lib/session";

type ChatPanelProps = {
  sessionId: string;
  onRefresh: () => void;
};

export function ChatPanel({ sessionId, onRefresh }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const ncpClientRef = useRef<NcpHttpAgentClientEndpoint>();
  if (!ncpClientRef.current) {
    ncpClientRef.current = new NcpHttpAgentClientEndpoint({
      baseUrl: window.location.origin,
    });
  }
  const agent = useHydratedNcpAgent({
    sessionId,
    client: ncpClientRef.current,
    loadSeed: loadConversationSeed,
  });

  useEffect(() => {
    setDraft("");
  }, [sessionId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || agent.isSending || agent.isRunning) return;
    setDraft("");
    await agent.send(content);
    onRefresh();
  };

  const handleAbort = async () => {
    await agent.abort();
    onRefresh();
  };

  return (
    <main className="panel chat-panel">
      <ChatHeader
        title="NCP Agent Demo"
        streamRunDisabled={!agent.isRunning}
        abortDisabled={!agent.isRunning}
        onStreamRun={agent.streamRun}
        onAbort={handleAbort}
      />
      <MessageList
        messages={agent.visibleMessages}
        emptyMessage={agent.isHydrating ? "Loading session..." : "Send a message to start."}
      />
      <ErrorBox
        error={
          agent.hydrateError
            ? {
                code: "runtime-error",
                message: agent.hydrateError.message,
              }
            : (agent.snapshot.error ?? null)
        }
      />
      <ChatInput
        value={draft}
        placeholder="Ask for the time, or ask the agent to sleep for 2 seconds."
        isSending={agent.isSending}
        sendDisabled={agent.isSending || agent.isRunning || agent.isHydrating}
        isRunning={agent.isRunning}
        onChange={setDraft}
        onSend={handleSend}
        onAbort={handleAbort}
      />
    </main>
  );
}
