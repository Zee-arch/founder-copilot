import type { BaseTickContentProps } from "recharts";

// Shared by Snapshot.tsx and ReportComparison.tsx — both render an 8-factor
// radar chart, and multi-word labels ("Competitive Advantage", "Capital
// Efficiency") got clipped by their own container on a real 375px viewport.
// Wrapping each word onto its own line fixes the actual cause (label
// width) instead of shrinking the chart to chase it.
export function RadarAngleTick({ x, y, payload, textAnchor }: BaseTickContentProps) {
  const words = String(payload.value).split(" ");
  const lineHeight = 12;
  const startDy = (-(words.length - 1) * lineHeight) / 2;

  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--color-ink-muted)" fontSize={10} fontFamily="var(--font-mono)">
      {words.map((word, i) => (
        <tspan key={word} x={x} dy={i === 0 ? startDy : lineHeight}>
          {word}
        </tspan>
      ))}
    </text>
  );
}
