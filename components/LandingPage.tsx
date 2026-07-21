"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, Target, ShieldCheck } from "lucide-react";
import type { ValidationReport } from "@/lib/types";
import { SCORE_CRITERIA } from "@/lib/types";
import { SCORE_CRITERION_ICONS } from "@/lib/report-icons";
import { useReport } from "@/lib/report-context";
import { SiteHeader } from "@/components/SiteHeader";

// No web search in the current generation path (see HANDOFF.md) — a single
// model call, so these steps are shorter and more evenly weighted than the
// old search-heavy timing.
const GENERATION_STEPS = [
  { label: "Reading your idea", durationMs: 2000 },
  { label: "Scoring 8 factors", durationMs: 8000 },
  { label: "Building your report", durationMs: Infinity },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "No login required" },
  { icon: Sparkles, label: "Powered by AI" },
  { icon: Target, label: "8-factor scoring" },
];

function GenerationProgress({ idea }: { idea: string }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    for (let i = 1; i < GENERATION_STEPS.length; i++) {
      elapsed += GENERATION_STEPS[i - 1].durationMs;
      timeouts.push(setTimeout(() => setStepIndex(i), elapsed));
    }

    return () => timeouts.forEach(clearTimeout);
  }, [idea]);

  return (
    <div className="rounded-3xl border border-brand/20 bg-white p-10 shadow-sm">
      <div className="mx-auto max-w-sm space-y-4">
        {GENERATION_STEPS.map((step, i) => {
          const isDone = i < stepIndex;
          const isCurrent = i === stepIndex;
          return (
            <div key={step.label} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isDone
                    ? "border-brand bg-brand text-white"
                    : isCurrent
                      ? "border-brand text-brand"
                      : "border-slate-200 text-slate-300"
                }`}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <span className="h-2 w-2 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`text-sm ${isCurrent ? "font-medium text-slate-text" : isDone ? "text-slate-500" : "text-slate-400"}`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Scoring &ldquo;{idea}&rdquo; across market, feasibility, and risk…
      </p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { setReportData } = useReport();
  const [idea, setIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!idea.trim() || isGenerating) return;

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });

      const data = (await response.json()) as { report?: ValidationReport; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate report.");
      }

      if (!data.report?.sections?.length) {
        throw new Error("The model returned an empty report.");
      }

      setReportData(idea.trim(), data.report);
      router.push("/report/summary");
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Something went wrong while generating your report.";
      setError(message);
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />

        <SiteHeader />

        <section className="relative mx-auto max-w-5xl px-6 pt-12 text-center sm:pt-16">
          <h1 className="font-display text-4xl tracking-tight text-slate-text sm:text-5xl">
            Validate your startup idea
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-500">
            Describe your idea in one sentence. FounderCopilot will score it, chart it, and hand you
            a complete validation report — market, customers, competition, and more.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm sm:p-8">
            <label htmlFor="idea" className="block text-sm font-medium text-slate-700">
              Your startup idea
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="AI-powered gym for remote workers."
              rows={3}
              maxLength={500}
              disabled={isGenerating}
              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">One sentence is enough. We&apos;ll handle the analysis.</p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!idea.trim() || isGenerating}
                className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating…
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500"
              >
                <Icon className="h-3.5 w-3.5 text-brand" />
                {label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <main className="mx-auto max-w-5xl px-6 pb-12 sm:pb-16">
        {error && (
          <div className="mt-10 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-4 text-sm text-signal-pivot">
            {error}
          </div>
        )}

        <section className="mt-10">
          {isGenerating && <GenerationProgress idea={idea.trim()} />}

          {!isGenerating && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
              <p className="text-sm font-medium text-slate-500">
                Your score, charts, and full report will appear here.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {SCORE_CRITERIA.map((label) => {
                  const Icon = SCORE_CRITERION_ICONS[label];
                  return (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center"
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      <span className="font-mono text-xs text-slate-400">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
