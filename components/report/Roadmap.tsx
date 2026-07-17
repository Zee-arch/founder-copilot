import { CheckCircle2 } from "lucide-react";
import type { Roadmap as RoadmapData } from "@/lib/types";
import { MILESTONE_PHASE_ICONS } from "@/lib/report-icons";

export function Roadmap({ roadmap }: { roadmap: RoadmapData }) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">MVP timeline</p>
        <p className="mt-2 font-display text-2xl text-ink-text">{roadmap.mvpTimeline}</p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Milestones
        </p>
        <ol className="mt-4 space-y-4">
          {roadmap.milestones.map((milestone, i) => {
            const PhaseIcon = MILESTONE_PHASE_ICONS[milestone.phase];
            return (
              <li key={i} className="flex items-start gap-4 rounded-xl border border-ink-border bg-ink p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(76,77,220,0.15)] text-brand">
                  <PhaseIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
                      {milestone.phase}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">{milestone.timeframe}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-text">{milestone.title}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Quick wins — this week
        </p>
        <ul className="mt-4 space-y-3">
          {roadmap.quickWins.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-text">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal-go" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
