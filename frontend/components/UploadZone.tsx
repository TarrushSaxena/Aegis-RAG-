"use client";

import { FileUp, Loader2, UploadCloud } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { uploadDocument } from "../lib/api";

export function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function onChange(file?: File) {
    if (!file) return;
    setBusy(true);
    setLabel(file.name);
    try {
      await uploadDocument(file);
      onUploaded();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      setLabel(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onChange(file);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      className={`group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-6 text-center transition ${
        dragging
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
      ) : (
        <UploadCloud className="h-5 w-5 text-[var(--text-muted)] transition group-hover:text-[var(--accent)]" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {busy ? `Uploading ${label ?? ""}…` : "Drop a PDF or click to upload"}
        </p>
        <p className="flex items-center justify-center gap-1 text-xs text-[var(--text-muted)]">
          <FileUp className="h-3 w-3" />
          PDF only, indexed automatically
        </p>
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="application/pdf"
        onChange={(event) => onChange(event.target.files?.[0])}
      />
    </div>
  );
}
