"use client";

import { BookOpen, FileText } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Source } from "../lib/api";

const PdfPreviewModal = dynamic(() => import("./PdfPreviewModal").then((mod) => mod.PdfPreviewModal), {
  ssr: false
});

export function SourceCard({ source, index }: { source: Source; index: number }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <details className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent)]">
            {index + 1}
          </span>
          <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{source.doc_name}</span>
          <span className="shrink-0 text-xs text-[var(--text-muted)]">p.{source.page}</span>
        </summary>
        <div className="border-t border-[var(--border)] px-3 py-2.5">
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{source.excerpt}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono-tabular text-xs text-[var(--text-muted)]">
              Relevance score {source.similarity_score.toFixed(3)}
            </span>
            {source.doc_id && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
              >
                <BookOpen className="h-3.5 w-3.5" />
                View in PDF
              </button>
            )}
          </div>
        </div>
      </details>
      {previewOpen && source.doc_id && (
        <PdfPreviewModal
          docId={source.doc_id}
          docName={source.doc_name}
          page={source.page}
          excerpt={source.excerpt}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
