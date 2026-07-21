import { ExternalLink, Minus, Plus } from "lucide-react";
import type { Competitor, CompetitiveLandscape as CompetitiveLandscapeData, SourcedFigure } from "@/lib/types";

const SOURCED_FIGURE_LABELS: { key: "funding" | "valuation" | "userCount"; label: string }[] = [
  { key: "funding", label: "Funding" },
  { key: "valuation", label: "Valuation" },
  { key: "userCount", label: "Users" },
];

// Only rendered when the figure exists — a competitor with no sourced
// figures shows nothing extra, never a placeholder or "not available" row.
function SourcedStat({ label, figure }: { label: string; figure: SourcedFigure }) {
  return (
    <a
      href={figure.source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={figure.source.label}
      className="inline-flex items-center gap-1 rounded-full border border-ink-border bg-ink px-2.5 py-1 text-[11px] text-ink-muted transition hover:border-brand/40 hover:text-ink-text"
    >
      <span className="font-medium text-ink-text">{label}:</span> {figure.value}
      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
    </a>
  );
}

function CompetitorSourcedStats({ competitor }: { competitor: Competitor }) {
  const stats = SOURCED_FIGURE_LABELS.map(({ key, label }) => ({ label, figure: competitor[key] })).filter(
    (s): s is { label: string; figure: SourcedFigure } => Boolean(s.figure),
  );

  if (stats.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-border pt-4">
      {stats.map((s) => (
        <SourcedStat key={s.label} label={s.label} figure={s.figure} />
      ))}
    </div>
  );
}

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

            <CompetitorSourcedStats competitor={competitor} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[rgba(76,77,220,0.3)] bg-[rgba(76,77,220,0.1)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">Your edge</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-text">{competitive.yourEdge}</p>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        Competitor profiles are qualitative summaries from the model. Funding, valuation, and user-count figures are
        only shown when backed by a real, linked source found during this session&apos;s search — never guessed or
        estimated, and left out entirely when no current figure was found.
      </p>
    </div>
  );
}
