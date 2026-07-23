"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { SCORE_CRITERIA, type Verdict } from "@/lib/types";
import { VERDICT_ICONS } from "@/lib/report-icons";
import { TONE_COLOR, TONE_DIM, VERDICT_TONE } from "@/lib/verdict-tone";
import { RadarAngleTick } from "@/components/RadarAngleTick";
import type { CohortReportRow } from "@/components/orgs/CohortReportRow";

const VERDICTS: Verdict[] = ["GO", "REFINE", "PIVOT"];

export function CohortStats({ rows }: { rows: CohortReportRow[] }) {
  const counts: Record<Verdict, number> = { GO: 0, REFINE: 0, PIVOT: 0 };
  rows.forEach((row) => {
    counts[row.report.verdict] += 1;
  });

  const radarData = SCORE_CRITERIA.map((label) => {
    const scores = rows
      .map((row) => row.report.scores.find((s) => s.label === label)?.score)
      .filter((score): score is number => typeof score === "number");
    const average = scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0;
    return { label, average };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {rows.length} idea{rows.length === 1 ? "" : "s"} submitted
        </p>
        <div className="mt-4 space-y-3">
          {VERDICTS.map((verdict) => {
            const tone = VERDICT_TONE[verdict];
            const VerdictIcon = VERDICT_ICONS[verdict];
            const count = counts[verdict];
            const pct = rows.length ? Math.round((count / rows.length) * 100) : 0;
            return (
              <div key={verdict} className="flex items-center gap-3">
                <span
                  className="inline-flex w-24 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.15em]"
                  style={{ color: TONE_COLOR[tone], backgroundColor: TONE_DIM[tone] }}
                >
                  <VerdictIcon className="h-3 w-3" />
                  {verdict}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: TONE_COLOR[tone] }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm text-slate-500">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Cohort average, 8 factors
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData} outerRadius="60%" margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
            <PolarGrid stroke="var(--color-ink-border)" />
            <PolarAngleAxis dataKey="label" tick={RadarAngleTick} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Cohort average"
              dataKey="average"
              stroke="#4c4ddc"
              fill="#4c4ddc"
              fillOpacity={0.2}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
