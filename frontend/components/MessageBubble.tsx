import { Check, Copy, Shield, ThumbsDown, ThumbsUp, Timer, User } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChatMessage } from "../lib/hooks/useChat";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ContradictionBanner } from "./ContradictionBanner";
import { FreshnessBanner } from "./FreshnessBanner";
import { SourceCard } from "./SourceCard";

type Props = {
  message: ChatMessage;
  streaming?: boolean;
  onRate?: (messageId: string, feedback: "up" | "down") => void;
};

export function MessageBubble({ message, streaming, onRate }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function copyAnswer() {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (isUser) {
    return (
      <article className="animate-fade-up flex items-start justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-ink)] shadow-[var(--shadow-sm)]">
          <p className="whitespace-pre-wrap text-[15px] leading-6">{message.content}</p>
        </div>
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]">
          <User className="h-4 w-4" />
        </div>
      </article>
    );
  }

  return (
    <article className="animate-fade-up flex items-start gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Shield className="h-4 w-4" />
      </div>
      <div className="min-w-0 max-w-[86%] flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="prose prose-sm max-w-none text-[15px] leading-6 text-[var(--text-primary)] prose-headings:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-p:my-1.5 prose-headings:my-2 prose-a:text-[var(--accent)]">
            {streaming && !message.content ? (
              <div className="flex items-center gap-1 py-1" aria-label="Aegis is thinking">
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              </div>
            ) : (
              <>
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {streaming && <span className="caret-blink" aria-hidden />}
              </>
            )}
          </div>
          {!streaming && message.content && (
            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                onClick={copyAnswer}
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy answer"}
              </button>
              {message.backendId && onRate && (
                <>
                  <button
                    type="button"
                    title="Good answer"
                    onClick={() => onRate(message.backendId!, "up")}
                    className={`rounded-md p-1.5 transition ${
                      message.feedback === "up"
                        ? "text-[var(--success)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Bad answer"
                    onClick={() => onRate(message.backendId!, "down")}
                    className={`rounded-md p-1.5 transition ${
                      message.feedback === "down"
                        ? "text-[var(--danger)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!streaming && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge score={message.confidence} />
              {message.latencyMs !== undefined && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                  <Timer className="h-3 w-3" />
                  {(message.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
              {message.queryVariants && message.queryVariants.length > 1 && (
                <details className="text-xs text-[var(--text-muted)]">
                  <summary className="cursor-pointer select-none rounded-full border border-[var(--border)] px-2.5 py-1 hover:border-[var(--border-strong)]">
                    Query variants
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {message.queryVariants.map((variant, index) => (
                      <li key={index}>{variant}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            {message.contradiction && <ContradictionBanner reason={message.contradictionReason} />}
            <FreshnessBanner warnings={message.freshnessWarnings} />
            {message.sources && message.sources.length > 0 && (
              <div className="space-y-1.5">
                {message.sources.map((source, index) => (
                  <SourceCard key={`${source.doc_name}-${source.page}-${index}`} source={source} index={index} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
