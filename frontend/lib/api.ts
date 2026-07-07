export type DocumentRecord = {
  id: string;
  original_name: string;
  page_count: number;
  status: "queued" | "processing" | "ready" | "failed";
  chunk_count: number;
  doc_date?: string | null;
  is_stale?: boolean;
  language?: string | null;
  error_message?: string | null;
};

export type Source = {
  doc_id?: string;
  doc_name: string;
  page: number;
  excerpt: string;
  similarity_score: number;
};

export type StreamDone = {
  type: "done";
  session_id: string;
  message_id: string;
  sources: Source[];
  confidence: number;
  contradiction: boolean;
  contradiction_reason?: string | null;
  query_variants_used: string[];
  freshness_warnings: string[];
  latency_ms: number;
};

export type SessionSummary = {
  id: string;
  created_at: string;
  preview: string;
};

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  confidence: number | null;
  contradiction_flag: boolean;
  contradiction_reason: string | null;
  feedback: "up" | "down" | null;
};

export type AnalyticsOverview = {
  total_queries: number;
  avg_confidence: number;
  avg_latency_ms: number;
  avg_retrieval_ms: number;
  avg_generation_ms: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  contradiction_count: number;
  feedback_up: number;
  feedback_down: number;
  timeline: { index: number; confidence: number | null; latency_ms: number | null }[];
  recent: {
    id: string;
    content: string;
    confidence: number | null;
    latency_ms: number | null;
    contradiction_flag: boolean;
    feedback: "up" | "down" | null;
    created_at: string;
    prompt_tokens: number | null;
    completion_tokens: number | null;
  }[];
};

export type HighlightRect = { x0: number; y0: number; x1: number; y1: number };
export type HighlightResult = { page_width: number; page_height: number; rects: HighlightRect[] };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${API_BASE}/documents`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load documents");
  return response.json();
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/documents`, { method: "POST", body: form });
  if (!response.ok) throw new Error("Upload failed");
  return response.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Delete failed");
}

export function documentFileUrl(id: string): string {
  return `${API_BASE}/documents/${id}/file`;
}

export async function fetchHighlight(docId: string, page: number, text: string): Promise<HighlightResult> {
  const response = await fetch(
    `${API_BASE}/documents/${docId}/pages/${page}/highlight?text=${encodeURIComponent(text.slice(0, 300))}`
  );
  if (!response.ok) throw new Error("Failed to load highlight");
  return response.json();
}

export async function streamChat(
  question: string,
  docIds: string[],
  sessionId: string | null,
  onToken: (token: string) => void
): Promise<StreamDone> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, doc_ids: docIds, session_id: sessionId })
  });
  if (!response.ok || !response.body) throw new Error("Chat request failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: StreamDone | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.type === "token") onToken(payload.value);
      if (payload.type === "done") donePayload = payload;
    }
  }
  if (!donePayload) throw new Error("Stream ended without metadata");
  return donePayload;
}

export async function setMessageFeedback(messageId: string, feedback: "up" | "down" | null): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/messages/${messageId}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback })
  });
  if (!response.ok) throw new Error("Failed to save feedback");
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE}/chat/sessions`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load sessions");
  return response.json();
}

export async function fetchSessionMessages(sessionId: string): Promise<StoredMessage[]> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load session");
  return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete session");
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await fetch(`${API_BASE}/analytics/overview`, { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load analytics");
  return response.json();
}
