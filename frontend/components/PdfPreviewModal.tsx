"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { documentFileUrl, fetchHighlight, HighlightRect } from "../lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const RENDER_WIDTH = 620;

type Props = {
  docId: string;
  docName: string;
  page: number;
  excerpt: string;
  onClose: () => void;
};

export function PdfPreviewModal({ docId, docName, page, excerpt, onClose }: Props) {
  const [rects, setRects] = useState<HighlightRect[]>([]);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHighlight(docId, page, excerpt)
      .then((result) => {
        if (cancelled) return;
        setPageSize({ width: result.page_width, height: result.page_height });
        setRects(result.rects);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [docId, page, excerpt]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scale = pageSize ? RENDER_WIDTH / pageSize.width : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{docName}</p>
            <p className="text-xs text-[var(--text-muted)]">Page {page}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-center bg-[var(--bg-elevated)] p-4">
          <div className="relative" style={{ width: RENDER_WIDTH }}>
            <Document
              file={documentFileUrl(docId)}
              loading={<div className="skeleton h-[800px] w-full rounded-lg" />}
              error={
                <div className="grid h-40 place-items-center text-sm text-[var(--text-muted)]">
                  Couldn&apos;t load this PDF.
                </div>
              }
            >
              <Page pageNumber={page} width={RENDER_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
            {pageSize &&
              rects.map((rect, index) => (
                <div
                  key={index}
                  className="absolute rounded-sm"
                  style={{
                    left: rect.x0 * scale,
                    top: rect.y0 * scale,
                    width: (rect.x1 - rect.x0) * scale,
                    height: (rect.y1 - rect.y0) * scale,
                    backgroundColor: "rgba(240, 180, 41, 0.35)",
                    boxShadow: "0 0 0 2px rgba(240, 180, 41, 0.65)"
                  }}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
