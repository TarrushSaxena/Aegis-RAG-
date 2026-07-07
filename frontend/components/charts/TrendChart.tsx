"use client";

import { useMemo, useState } from "react";

type Point = { index: number; value: number | null };

type Props = {
  title: string;
  points: Point[];
  color: string;
  formatValue: (value: number) => string;
  pointColor?: (value: number) => string;
};

const WIDTH = 560;
const HEIGHT = 160;
const PAD_X = 12;
const PAD_Y = 16;

export function TrendChart({ title, points, color, formatValue, pointColor }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const clean = points.filter((p): p is { index: number; value: number } => p.value !== null && p.value !== undefined);

  const { path, area, dots, yTicks, xScale, yScale } = useMemo(() => {
    if (clean.length === 0) {
      return { path: "", area: "", dots: [], yTicks: [], xScale: () => 0, yScale: () => 0 };
    }
    const values = clean.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const yPad = span * 0.15;
    const yMin = min - yPad;
    const yMax = max + yPad;

    const innerW = WIDTH - PAD_X * 2;
    const innerH = HEIGHT - PAD_Y * 2;
    const xs = (i: number) => PAD_X + (clean.length === 1 ? innerW / 2 : (i / (clean.length - 1)) * innerW);
    const ys = (v: number) => PAD_Y + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

    const linePath = clean.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(p.value)}`).join(" ");
    const areaPath = `${linePath} L ${xs(clean.length - 1)} ${PAD_Y + innerH} L ${xs(0)} ${PAD_Y + innerH} Z`;

    return {
      path: linePath,
      area: areaPath,
      dots: clean.map((p, i) => ({ x: xs(i), y: ys(p.value), value: p.value, index: p.index })),
      yTicks: [yMin + span * 0.15, (yMin + yMax) / 2, yMax - span * 0.15],
      xScale: xs,
      yScale: ys,
    };
  }, [clean]);

  if (clean.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <div className="mt-6 grid h-32 place-items-center text-xs text-[var(--text-muted)]">
          Not enough data yet — ask a few questions to see a trend.
        </div>
      </div>
    );
  }

  const gradientId = `grad-${title.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const active = hover !== null ? dots[hover] : null;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {active && (
          <span className="font-mono-tabular text-xs text-[var(--text-secondary)]">
            #{active.index} · {formatValue(active.value)}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-2 w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
          let nearest = 0;
          let bestDist = Infinity;
          dots.forEach((dot, i) => {
            const dist = Math.abs(dot.x - relativeX);
            if (dist < bestDist) {
              bestDist = dist;
              nearest = i;
            }
          });
          setHover(nearest);
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="var(--border)"
            strokeWidth={1}
          />
        ))}
        <path d={area} fill={`url(#${gradientId})`} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {active && (
          <line x1={active.x} x2={active.x} y1={PAD_Y} y2={HEIGHT - PAD_Y} stroke="var(--border-strong)" strokeWidth={1} />
        )}
        {dots.map((dot, i) => (
          <g key={i}>
            <circle
              cx={dot.x}
              cy={dot.y}
              r={hover === i ? 5 : 3}
              fill={pointColor ? pointColor(dot.value) : color}
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
            <circle cx={dot.x} cy={dot.y} r={10} fill="transparent" />
          </g>
        ))}
      </svg>
    </div>
  );
}
