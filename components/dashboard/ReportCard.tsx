"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { ValidationReport } from "@/lib/types";
import { VERDICT_ICONS } from "@/lib/report-icons";
import { useReport } from "@/lib/report-context";
import { TONE_COLOR, TONE_DIM, VERDICT_TONE } from "@/lib/verdict-tone";

export function ReportCard({
  idea,
  report,
  createdAt,
  isTeamReport,
}: {
  idea: string;
  report: ValidationReport;
  createdAt: string;
  isTeamReport?: boolean;
}) {
  const router = useRouter();
  const { setReportData } = useReport();
  const tone = VERDICT_TONE[report.verdict];
  const VerdictIcon = VERDICT_ICONS[report.verdict];

  function handleOpen() {
    setReportData(idea, report);
    router.push("/report/summary");
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-brand/40 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-base text-slate-text">{idea}</p>
          {isTeamReport && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Team
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {new Date(createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
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
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>
    </button>
  );
}
