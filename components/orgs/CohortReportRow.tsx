"use client";

import type { ReportRow } from "@/components/dashboard/DashboardReports";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { SelectableReportRow } from "@/components/dashboard/SelectableReportRow";

export type CohortReportRow = ReportRow & {
  submitterName: string;
};

// A thin wrapper around the existing ReportCard/SelectableReportRow, not a
// fork of them — both already only need {id, idea, report, created_at}, so
// the personal-dashboard open/select behavior (and its regression surface)
// stays exactly as-is; this just adds a "submitted by" label above it.
export function CohortReportCard({
  row,
  compareMode,
  selected,
  disabled,
  onToggle,
}: {
  row: CohortReportRow;
  compareMode: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <p className="mb-1.5 px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {row.submitterName}
      </p>
      {compareMode ? (
        <SelectableReportRow row={row} selected={selected} disabled={disabled} onToggle={onToggle} />
      ) : (
        <ReportCard idea={row.idea} report={row.report} createdAt={row.created_at} />
      )}
    </div>
  );
}
