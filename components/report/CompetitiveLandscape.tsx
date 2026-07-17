import { Minus, Plus } from "lucide-react";
import type { CompetitiveLandscape as CompetitiveLandscapeData } from "@/lib/types";

export function CompetitiveLandscape({ competitive }: { competitive: CompetitiveLandscapeData }) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {competitive.competitors.map((competitor) => (
          <div key={competitor.name} className="rounded-2xl border border-ink-border bg-ink-surface p-6">
            <p className="font-display text-lg text-ink-text">{competitor.name}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{competitor.description}</p>

            <div className="mt-4 space-y-2.5">
              <div className="flex gap-2.5 text-sm leading-relaxed text-ink-text">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ color: "var(--color-signal-go)", backgroundColor: "var(--color-signal-go-dim)" }}
                >
                  <Plus className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                {competitor.strength}
              </div>
              <div className="flex gap-2.5 text-sm leading-relaxed text-ink-text">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{ color: "var(--color-signal-pivot)", backgroundColor: "var(--color-signal-pivot-dim)" }}
                >
                  <Minus className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
                {competitor.weakness}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[rgba(76,77,220,0.3)] bg-[rgba(76,77,220,0.1)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">Your edge</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-text">{competitive.yourEdge}</p>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        Competitor profiles are qualitative summaries from the model — funding, valuation, and user-count figures
        are deliberately left out since those go stale immediately and can&apos;t be verified here.
      </p>
    </div>
  );
}
