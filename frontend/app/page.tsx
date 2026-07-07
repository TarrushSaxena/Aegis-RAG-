"use client";

import { useState } from "react";
import { ChatWindow } from "../components/ChatWindow";
import { DocumentSidebar } from "../components/DocumentSidebar";
import { useChat } from "../lib/hooks/useChat";

export default function Home() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const chat = useChat();

  function startNewChat() {
    chat.reset();
    setSelectedIds([]);
  }

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden bg-[var(--bg)] md:grid-cols-[300px_minmax(0,1fr)]">
      <DocumentSidebar
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        activeSessionId={chat.sessionId}
        onSelectSession={chat.loadSession}
        onNewChat={startNewChat}
      />
      <ChatWindow selectedDocIds={selectedIds} onClearSelection={startNewChat} chat={chat} />
    </div>
  );
}
