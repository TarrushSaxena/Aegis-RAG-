"use client";

import { BarChart3, CornerDownLeft, Loader2, Shield, Sparkles, Trash2 } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useChat } from "../lib/hooks/useChat";
import { MessageBubble } from "./MessageBubble";

function AnalyticsLinkIcon() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />;
}

const SUGGESTIONS = [
  "Summarize the key points of this document",
  "What are the main obligations or requirements?",
  "Are there any dates or deadlines mentioned?"
];

export function ChatWindow({
  selectedDocIds,
  onClearSelection,
  chat,
}: {
  selectedDocIds: string[];
  onClearSelection?: () => void;
  chat: ReturnType<typeof useChat>;
}) {
  const [question, setQuestion] = useState("");
  const { messages, isStreaming, send, rate } = chat;
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [question]);

  async function submit(value: string) {
    if (!value.trim() || selectedDocIds.length === 0 || isStreaming) return;
    setQuestion("");
    await send(value.trim(), selectedDocIds);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await submit(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(question);
    }
  }

  const disabled = selectedDocIds.length === 0;

  return (
    <main className="flex min-h-0 flex-col bg-[var(--bg)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-3.5">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Aegis</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {selectedDocIds.length
              ? `${selectedDocIds.length} document${selectedDocIds.length > 1 ? "s" : ""} selected`
              : "Select at least one ready document"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/analytics"
            title="Analytics"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <AnalyticsLinkIcon />
            Analytics
          </Link>
          <button
            type="button"
            onClick={() => onClearSelection?.()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[760px] flex-col justify-end px-6 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <div
                className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
                style={{
                  backgroundImage: "radial-gradient(circle at 50% 30%, var(--accent-soft), transparent 70%)"
                }}
              >
                <Shield className="h-6 w-6 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Ask across your PDFs</h1>
                <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
                  Upload documents on the left, select the ones you want, then ask for citations, comparisons, or
                  policy details.
                </p>
              </div>
              {!disabled && (
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                    >
                      <Sparkles className="h-3 w-3 text-[var(--accent)]" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={isStreaming && index === messages.length - 1 && message.role === "assistant"}
                  onRate={rate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-4">
        <form onSubmit={onSubmit} className="mx-auto max-w-[760px]">
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-sm)] transition focus-within:border-[var(--accent-border)]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder={disabled ? "Select at least one ready document" : "Ask a grounded question…"}
            />
            <button
              type="submit"
              title="Send"
              disabled={disabled || isStreaming || !question.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-[var(--accent-ink)] transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CornerDownLeft className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">
            Press <span className="font-medium text-[var(--text-secondary)]">Enter</span> to send,{" "}
            <span className="font-medium text-[var(--text-secondary)]">Shift + Enter</span> for a new line.
          </p>
        </form>
      </div>
    </main>
  );
}
