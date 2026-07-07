import { Clock } from "lucide-react";

export function FreshnessBanner({ warnings }: { warnings?: string[] | null }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-sm"
      style={{ borderColor: "var(--info)", backgroundColor: "var(--info-soft)", color: "var(--text-primary)" }}
    >
      {warnings.map((warning) => (
        <div key={warning} className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--info)" }} />
          <span className="text-[var(--text-secondary)]">{warning}</span>
        </div>
      ))}
    </div>
  );
}
