"use client";

import { useState } from "react";
import { fetchSessionMessages, setMessageFeedback, Source, streamChat } from "../api";

export type ChatMessage = {
  id: string;
  backendId?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: number;
  contradiction?: boolean;
  contradictionReason?: string | null;
  queryVariants?: string[];
  freshnessWarnings?: string[];
  latencyMs?: number;
  feedback?: "up" | "down" | null;
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  async function send(question: string, docIds: string[]) {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantId = crypto.randomUUID();
    setMessages((items) => [...items, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setIsStreaming(true);
    try {
      const metadata = await streamChat(question, docIds, sessionId, (token) => {
        setMessages((items) =>
          items.map((item) => (item.id === assistantId ? { ...item, content: item.content + token } : item))
        );
      });
      setSessionId(metadata.session_id);
      setMessages((items) =>
        items.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                backendId: metadata.message_id,
                sources: metadata.sources,
                confidence: metadata.confidence,
                contradiction: metadata.contradiction,
                contradictionReason: metadata.contradiction_reason,
                queryVariants: metadata.query_variants_used,
                freshnessWarnings: metadata.freshness_warnings,
                latencyMs: metadata.latency_ms
              }
            : item
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function loadSession(id: string) {
    const stored = await fetchSessionMessages(id);
    setSessionId(id);
    setMessages(
      stored.map((message) => ({
        id: message.id,
        backendId: message.id,
        role: message.role,
        content: message.content,
        sources: message.sources,
        confidence: message.confidence ?? undefined,
        contradiction: message.contradiction_flag,
        contradictionReason: message.contradiction_reason,
        feedback: message.feedback
      }))
    );
  }

  async function rate(messageId: string, feedback: "up" | "down") {
    const next = messages.find((m) => m.backendId === messageId)?.feedback === feedback ? null : feedback;
    setMessages((items) => items.map((item) => (item.backendId === messageId ? { ...item, feedback: next } : item)));
    await setMessageFeedback(messageId, next);
  }

  function reset() {
    setMessages([]);
    setSessionId(null);
    setIsStreaming(false);
  }

  return { messages, sessionId, isStreaming, send, reset, loadSession, rate };
}
