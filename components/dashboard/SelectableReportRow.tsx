"use client";

import { Check } from "lucide-react";
import { VERDICT_ICONS } from "@/lib/report-icons";
import { TONE_COLOR, TONE_DIM, VERDICT_TONE } from "@/lib/verdict-tone";
import type { ReportRow } from "@/components/dashboard/DashboardReports";

// Deliberately a separate component from ReportCard.tsx, not a variant of
// it — this toggles selection instead of opening the report, a genuinely
// different interaction. Keeps ReportCard.tsx (and how opening a single
// report works) completely untouched.
export function SelectableReportRow({
  row,
  selected,
  disabled,
  onToggle,
}: {
  row: ReportRow;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { idea, report, created_at } = row;
  const tone = VERDICT_TONE[report.verdict];
  const VerdictIcon = VERDICT_ICONS[report.verdict];

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition ${
        selected ? "border-brand bg-brand/5" : "border-slate-200 bg-white"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand/40"}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
            selected ? "border-brand bg-brand text-white" : "border-slate-300"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base text-slate-text">{idea}</p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <span className="font-display text-lg text-slate-text">{report.overallScore}</span>
          <span className="text-xs text-slate-400"> / 100</span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-[0.15em]"
          style={{ color: TONE_COLOR[tone], backgroundColor: TONE_DIM[tone] }}
        >
          <VerdictIcon className="h-3.5 w-3.5" />
          {report.verdict}
        </span>
      </div>
    </button>
  );
}
