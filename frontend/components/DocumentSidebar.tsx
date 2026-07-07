"use client";

import { CheckSquare2, Clock, FileStack, MessageSquarePlus, MessagesSquare, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteDocument, deleteSession } from "../lib/api";
import { useDocuments } from "../lib/hooks/useDocuments";
import { useSessions } from "../lib/hooks/useSessions";
import { ProgressTracker } from "./ProgressTracker";
import { ThemeToggle } from "./ThemeToggle";
import { UploadZone } from "./UploadZone";

type Props = {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso + "Z").getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DocumentSidebar({ selectedIds, onSelectionChange, activeSessionId, onSelectSession, onNewChat }: Props) {
  const [tab, setTab] = useState<"documents" | "history">("documents");
  const { data = [], isLoading, mutate } = useDocuments();
  const { data: sessions = [], mutate: mutateSessions } = useSessions();
  const readyDocuments = data.filter((document) => document.status === "ready");

  function toggle(id: string) {
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function selectAllReady() {
    onSelectionChange(readyDocuments.map((document) => document.id));
  }

  return (
    <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4">
        <div className="radar-ring relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)]">
          <Shield className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="brand-shimmer truncate text-[15px] font-semibold tracking-tight">Aegis RAG</h1>
          <p className="truncate text-xs text-[var(--text-muted)]">Grounded document Q&amp;A</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-3">
        <button
          type="button"
          onClick={() => setTab("documents")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
            tab === "documents"
              ? "border-b-2 border-[var(--accent)] text-[var(--text-primary)]"
              : "border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <FileStack className="h-3.5 w-3.5" />
          Documents
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
            tab === "history"
              ? "border-b-2 border-[var(--accent)] text-[var(--text-primary)]"
              : "border-b-2 border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {tab === "documents" ? (
        <>
          <div className="space-y-3 px-4 py-4">
            <UploadZone onUploaded={() => mutate()} />
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                {readyDocuments.length} of {data.length} ready
              </span>
              <button
                type="button"
                onClick={selectAllReady}
                disabled={!readyDocuments.length}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)] transition hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:text-[var(--text-muted)]"
              >
                <CheckSquare2 className="h-3.5 w-3.5" />
                Select all
              </button>
            </div>
          </div>

          <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-xl border border-[var(--border)] px-3 py-2.5">
                  <div className="skeleton h-3.5 w-3/4 rounded-full" />
                  <div className="skeleton h-3 w-1/2 rounded-full" />
                </div>
              ))}
            {!isLoading && data.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                No documents yet. Upload a PDF to get started.
              </p>
            )}
            {data.map((document) => {
              const checked = selectedIds.includes(document.id);
              const selectable = document.status === "ready";
              const processing = document.status === "processing" || document.status === "queued";
              return (
                <label
                  key={document.id}
                  className={`block cursor-pointer rounded-xl border px-3 py-2.5 transition ${
                    checked
                      ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                  } ${!selectable ? "cursor-not-allowed opacity-70" : ""} ${processing ? "animate-border-glow" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--accent)]"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => toggle(document.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {document.original_name}
                        </span>
                        {document.is_stale && (
                          <span title="This document may be outdated">
                            <Clock className="h-3 w-3 shrink-0 text-[var(--warning)]" />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {document.page_count || "–"} pages · {document.chunk_count || "–"} chunks
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ProgressTracker document={document} />
                        <button
                          type="button"
                          title="Delete document"
                          onClick={async (event) => {
                            event.preventDefault();
                            await deleteDocument(document.id);
                            onSelectionChange(selectedIds.filter((id) => id !== document.id));
                            mutate();
                          }}
                          className="rounded-md p-1 text-[var(--text-muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-4">
            <button
              type="button"
              onClick={onNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--accent-border)] hover:bg-[var(--surface-hover)]"
            >
              <MessageSquarePlus className="h-4 w-4 text-[var(--accent)]" />
              New chat
            </button>
          </div>
          <div className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
            {sessions.length === 0 && (
              <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                No conversations yet. Ask something to start one.
              </p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
                  session.id === activeSessionId
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{session.preview}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{relativeTime(session.created_at)}</p>
                </div>
                <button
                  type="button"
                  title="Delete conversation"
                  onClick={async (event) => {
                    event.stopPropagation();
                    await deleteSession(session.id);
                    if (session.id === activeSessionId) onNewChat();
                    mutateSessions();
                  }}
                  className="rounded-md p-1 text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
