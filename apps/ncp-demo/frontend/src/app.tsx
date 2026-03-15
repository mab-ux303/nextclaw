import { useEffect, useState } from "react";
import { getOrCreateSessionId, setCurrentSessionId } from "./lib/session";
import { useSessions } from "./hooks/use-sessions";
import { SessionsPanel } from "./components/sessions-panel";
import { ChatPanel } from "./components/chat-panel";

export function App() {
  const [sessionId, setSessionId] = useState(getOrCreateSessionId);
  const sessions = useSessions();

  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  return (
    <div className="demo-shell">
      <SessionsPanel
        sessionId={sessionId}
        setSessionId={setSessionId}
        sessions={sessions.sessions}
        onRefresh={sessions.refresh}
      />
      <ChatPanel
        sessionId={sessionId}
        onRefresh={sessions.refresh}
      />
    </div>
  );
}
