import { AlertTriangle } from "lucide-react";

export function ContradictionBanner({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <div
      className="flex gap-2 rounded-xl border px-3 py-2.5 text-sm"
      style={{ borderColor: "var(--danger)", backgroundColor: "var(--danger-soft)", color: "var(--text-primary)" }}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--danger)" }} />
      <div>
        <p className="font-medium" style={{ color: "var(--danger)" }}>
          Possible contradiction across sources
        </p>
        <p className="mt-0.5 text-[var(--text-secondary)]">{reason}</p>
      </div>
    </div>
  );
}
