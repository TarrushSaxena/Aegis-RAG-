import { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
};

const TONE_COLOR: Record<NonNullable<Props["tone"]>, string> = {
  default: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)"
};

export function StatTile({ label, value, icon: Icon, tone = "default" }: Props) {
  const color = TONE_COLOR[tone];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        {label}
      </div>
      <p className="mt-2 font-mono-tabular text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
