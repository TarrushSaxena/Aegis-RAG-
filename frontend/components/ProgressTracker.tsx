import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { DocumentRecord } from "../lib/api";

const LABELS: Record<DocumentRecord["status"], string> = {
  queued: "Queued",
  processing: "Indexing…",
  ready: "Ready",
  failed: "Failed"
};

export function ProgressTracker({ document }: { document: DocumentRecord }) {
  if (document.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  if (document.status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {LABELS[document.status]}
    </span>
  );
}
