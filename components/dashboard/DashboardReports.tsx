"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Columns3, X } from "lucide-react";
import type { ValidationReport, Verdict } from "@/lib/types";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { SelectableReportRow } from "@/components/dashboard/SelectableReportRow";
import { ReportComparison } from "@/components/dashboard/ReportComparison";

export type ReportRow = {
  id: string;
  idea: string;
  report: ValidationReport;
  created_at: string;
  org_id: string | null;
};

type SortOption = "newest" | "score-desc" | "score-asc";
type VerdictFilter = "all" | Verdict;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "score-desc", label: "Highest score" },
  { value: "score-asc", label: "Lowest score" },
];

const VERDICT_FILTERS: { value: VerdictFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "GO", label: "GO" },
  { value: "REFINE", label: "REFINE" },
  { value: "PIVOT", label: "PIVOT" },
];

// Caps how many reports can be compared at once — mainly so the shared
// radar chart and comparison table stay legible. Not hidden: the toolbar
// shows "N selected (max MAX_COMPARE)" rather than silently refusing
// further clicks with no explanation.
const MAX_COMPARE = 4;

export function DashboardReports({ rows }: { rows: ReportRow[] }) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const visibleRows = useMemo(() => {
    const filtered = verdictFilter === "all" ? rows : rows.filter((r) => r.report.verdict === verdictFilter);
    if (sort === "newest") return filtered; // already the fetch order (created_at desc)
    const sorted = [...filtered];
    sorted.sort((a, b) =>
      sort === "score-desc" ? b.report.overallScore - a.report.overallScore : a.report.overallScore - b.report.overallScore,
    );
    return sorted;
  }, [rows, sort, verdictFilter]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((c) => c !== id);
      if (current.length >= MAX_COMPARE) return current;
      return [...current, id];
    });
  }

  function exitCompareMode() {
    setCompareMode(false);
    setSelectedIds([]);
    setComparing(false);
  }

  if (comparing) {
    const selectedRows = rows.filter((r) => selectedIds.includes(r.id));
    return <ReportComparison rows={selectedRows} onBack={() => setComparing(false)} onExit={exitCompareMode} />;
  }

  return (
    <div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="bg-transparent outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="inline-flex gap-1 rounded-full border border-slate-200 bg-white p-1">
            {VERDICT_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setVerdictFilter(filter.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  verdictFilter === filter.value ? "bg-ink text-ink-text" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length >= 2 &&
          (compareMode ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {selectedIds.length} selected (max {MAX_COMPARE})
              </span>
              <button
                type="button"
                disabled={selectedIds.length < 2}
                onClick={() => setComparing(true)}
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={exitCompareMode}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-700"
                aria-label="Cancel comparison"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCompareMode(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand/40 hover:text-slate-900"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Compare
            </button>
          ))}
      </div>

      {visibleRows.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No reports match this filter.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {visibleRows.map((row) =>
            compareMode ? (
              <SelectableReportRow
                key={row.id}
                row={row}
                selected={selectedIds.includes(row.id)}
                disabled={!selectedIds.includes(row.id) && selectedIds.length >= MAX_COMPARE}
                onToggle={() => toggleSelected(row.id)}
              />
            ) : (
              <ReportCard
                key={row.id}
                idea={row.idea}
                report={row.report}
                createdAt={row.created_at}
                isTeamReport={Boolean(row.org_id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
