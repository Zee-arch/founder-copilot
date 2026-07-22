"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { ArrowLeft, X } from "lucide-react";
import { SCORE_CRITERIA } from "@/lib/types";
import { VERDICT_ICONS } from "@/lib/report-icons";
import { TONE_COLOR, TONE_DIM, VERDICT_TONE } from "@/lib/verdict-tone";
import { RadarAngleTick } from "@/components/RadarAngleTick";
import type { ReportRow } from "@/components/dashboard/DashboardReports";

// Distinct per-report identity colors — deliberately NOT the go/refine/pivot
// signal colors, since two compared reports can share a verdict and still
// need to be told apart on the same shared chart/table.
const COMPARE_COLORS = ["#4c4ddc", "#38bdf8", "#ec4899", "#eab308"];

function colorFor(index: number) {
  return COMPARE_COLORS[index % COMPARE_COLORS.length];
}

export function ReportComparison({
  rows,
  onBack,
  onExit,
}: {
  rows: ReportRow[];
  onBack: () => void;
  onExit: () => void;
}) {
  const radarData = SCORE_CRITERIA.map((label) => {
    const point: Record<string, string | number> = { label };
    rows.forEach((row, i) => {
      point[`report-${i}`] = row.report.scores.find((s) => s.label === label)?.score ?? 0;
    });
    return point;
  });

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to selection
        </button>
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
          Exit comparison
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((row, i) => {
          const tone = VERDICT_TONE[row.report.verdict];
          const VerdictIcon = VERDICT_ICONS[row.report.verdict];
          return (
            <div
              key={row.id}
              className="rounded-2xl border border-ink-border bg-ink p-5"
              style={{ borderTopWidth: 3, borderTopColor: colorFor(i) }}
            >
              <p className="truncate font-display text-sm text-ink-text">{row.idea}</p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-muted">{row.report.headline}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-display text-2xl" style={{ color: TONE_COLOR[tone] }}>
                  {row.report.overallScore}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.15em]"
                  style={{ color: TONE_COLOR[tone], backgroundColor: TONE_DIM[tone] }}
                >
                  <VerdictIcon className="h-3 w-3" />
                  {row.report.verdict}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          8 factors, side by side
        </p>

        <ResponsiveContainer width="100%" height={360}>
          <RadarChart data={radarData} outerRadius="55%" margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
            <PolarGrid stroke="var(--color-ink-border)" />
            <PolarAngleAxis dataKey="label" tick={RadarAngleTick} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {rows.map((row, i) => (
              <Radar
                key={row.id}
                name={row.idea}
                dataKey={`report-${i}`}
                stroke={colorFor(i)}
                fill={colorFor(i)}
                fillOpacity={0.15}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
          </RadarChart>
        </ResponsiveContainer>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-ink-border text-ink-muted">
                <th className="py-2 pr-4 font-mono font-semibold uppercase tracking-[0.1em]">Factor</th>
                {rows.map((row, i) => (
                  <th key={row.id} className="py-2 pr-4 font-mono font-semibold" style={{ color: colorFor(i) }}>
                    {row.idea.length > 22 ? `${row.idea.slice(0, 22)}…` : row.idea}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCORE_CRITERIA.map((label) => (
                <tr key={label} className="border-b border-ink-border/60">
                  <td className="py-2 pr-4 text-ink-text">{label}</td>
                  {rows.map((row) => (
                    <td key={row.id} className="py-2 pr-4 text-ink-text">
                      {row.report.scores.find((s) => s.label === label)?.score ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
