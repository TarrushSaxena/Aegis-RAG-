"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  Gauge,
  MessageCircle,
  ThumbsDown,
  ThumbsUp,
  Timer
} from "lucide-react";
import Link from "next/link";
import { StatTile } from "../../components/StatTile";
import { TrendChart } from "../../components/charts/TrendChart";
import { useAnalytics } from "../../lib/hooks/useAnalytics";

function confidenceColor(value: number): string {
  if (value > 0.75) return "var(--success)";
  if (value >= 0.4) return "var(--warning)";
  return "var(--danger)";
}

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to chat
        </Link>
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Observability</h1>
          <p className="text-xs text-[var(--text-muted)]">Retrieval quality, latency, and feedback across all queries</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && data && data.total_queries === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-16 text-center">
            <Gauge className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No queries yet. Ask a question in the chat and this dashboard fills in automatically.
            </p>
          </div>
        )}

        {!isLoading && data && data.total_queries > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Total queries" value={String(data.total_queries)} icon={MessageCircle} />
              <StatTile
                label="Avg confidence"
                value={`${Math.round(data.avg_confidence * 100)}%`}
                icon={Gauge}
                tone={data.avg_confidence > 0.75 ? "success" : data.avg_confidence >= 0.4 ? "warning" : "danger"}
              />
              <StatTile label="Avg latency" value={`${(data.avg_latency_ms / 1000).toFixed(1)}s`} icon={Timer} />
              <StatTile
                label="Tokens used"
                value={(data.total_prompt_tokens + data.total_completion_tokens).toLocaleString()}
                icon={Coins}
              />
              <StatTile
                label="Contradictions flagged"
                value={String(data.contradiction_count)}
                icon={AlertTriangle}
                tone={data.contradiction_count > 0 ? "warning" : "default"}
              />
              <StatTile label="Avg retrieval time" value={`${Math.round(data.avg_retrieval_ms)}ms`} icon={Timer} />
              <StatTile label="Helpful votes" value={String(data.feedback_up)} icon={ThumbsUp} tone="success" />
              <StatTile label="Unhelpful votes" value={String(data.feedback_down)} icon={ThumbsDown} tone="danger" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TrendChart
                title="Confidence (last 20 queries)"
                points={data.timeline.map((t) => ({ index: t.index, value: t.confidence }))}
                color="var(--accent)"
                pointColor={confidenceColor}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />
              <TrendChart
                title="Latency (last 20 queries)"
                points={data.timeline.map((t) => ({ index: t.index, value: t.latency_ms ? t.latency_ms / 1000 : null }))}
                color="var(--info)"
                formatValue={(v) => `${v.toFixed(1)}s`}
              />
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent answers</h3>
              <div className="scrollbar-thin mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-[var(--text-muted)]">
                      <th className="pb-2 font-medium">Answer</th>
                      <th className="pb-2 font-medium">Confidence</th>
                      <th className="pb-2 font-medium">Latency</th>
                      <th className="pb-2 font-medium">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border)]">
                        <td className="max-w-xs truncate py-2 pr-4 text-[var(--text-secondary)]">{item.content}</td>
                        <td className="py-2 pr-4">
                          <span
                            className="font-mono-tabular text-xs font-medium"
                            style={{ color: item.confidence !== null ? confidenceColor(item.confidence) : undefined }}
                          >
                            {item.confidence !== null ? `${Math.round(item.confidence * 100)}%` : "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono-tabular text-xs text-[var(--text-secondary)]">
                          {item.latency_ms ? `${(item.latency_ms / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="py-2">
                          {item.feedback === "up" && <ThumbsUp className="h-3.5 w-3.5 text-[var(--success)]" />}
                          {item.feedback === "down" && <ThumbsDown className="h-3.5 w-3.5 text-[var(--danger)]" />}
                          {!item.feedback && <span className="text-xs text-[var(--text-muted)]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
