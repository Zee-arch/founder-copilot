import type { Financials as FinancialsData } from "@/lib/types";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-xl text-ink-text">{value}</p>
    </div>
  );
}

export function Financials({ financials }: { financials: FinancialsData }) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Startup cost" value={financials.startupCost} />
        <StatTile label="Break-even" value={financials.breakEven} />
        <StatTile label="CAC" value={financials.cac} />
        <StatTile label="LTV" value={financials.ltv} />
      </div>

      <div className="rounded-2xl border border-[rgba(76,77,220,0.3)] bg-[rgba(76,77,220,0.1)] p-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">LTV : CAC ratio</p>
        <p className="mt-2 font-display text-3xl text-ink-text">{financials.ltvToCac}</p>
        <p className="mt-1 text-xs text-ink-muted">Healthy is generally considered 3:1 or higher.</p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
          Revenue streams
        </p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {financials.revenueStreams.map((stream) => (
            <li key={stream.name} className="rounded-xl border border-ink-border bg-ink p-4">
              <p className="font-display text-base text-ink-text">{stream.name}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{stream.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        All figures above are labeled estimates from the model, not verified financial data — sanity-check them
        against your own numbers before using them anywhere official.
      </p>
    </div>
  );
}
