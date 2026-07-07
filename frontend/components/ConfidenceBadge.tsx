type Props = {
  score?: number;
};

export function ConfidenceBadge({ score }: Props) {
  if (score === undefined) return null;
  const tone =
    score > 0.75
      ? { color: "var(--success)", bg: "var(--success-soft)", label: "High" }
      : score >= 0.4
        ? { color: "var(--warning)", bg: "var(--warning-soft)", label: "Medium" }
        : { color: "var(--danger)", bg: "var(--danger-soft)", label: "Low" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: tone.bg, color: tone.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.color }} />
      {tone.label} confidence · {Math.round(score * 100)}%
    </span>
  );
}
