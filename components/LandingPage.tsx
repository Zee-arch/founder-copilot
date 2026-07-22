"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, ShieldCheck } from "lucide-react";
import type { ScoreCriterionLabel } from "@/lib/types";
import { SCORE_CRITERION_ICONS, REPORT_STEPS } from "@/lib/report-icons";
import { useReport } from "@/lib/report-context";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { VerdictGauge } from "@/components/report/Snapshot";
import { TONE_COLOR, tierForScore } from "@/lib/verdict-tone";
import type { ValidationReport } from "@/lib/types";

// Swapped to Groq for generation (2026-07-22, see HANDOFF.md) — no search
// grounding on this provider, and Groq's inference is fast (expect low
// single-digit seconds), so this drops the ~130s "searching" phase entirely
// rather than leaving a step that lies about what's happening. Not yet
// precisely re-measured against a real Groq call — tighten once real
// timing is known, same as the note this replaces.
const GENERATION_STEPS = [
  { label: "Reading your idea", durationMs: 2000 },
  { label: "Scoring 8 factors", durationMs: 4000 },
  { label: "Building your report", durationMs: Infinity },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "No login required" },
  { icon: Sparkles, label: "Powered by AI" },
];

// Fixed sample data for the hero preview — never generated, never claimed to
// be live. Clearly labeled "Example report" on the card itself so it can't
// be mistaken for the visitor's own output.
const PREVIEW_SCORES: { label: ScoreCriterionLabel; score: number }[] = [
  { label: "Problem Urgency", score: 82 },
  { label: "Market Size", score: 75 },
  { label: "MVP Feasibility", score: 88 },
  { label: "Revenue Clarity", score: 66 },
];

const WHAT_YOU_GET: Record<(typeof REPORT_STEPS)[number]["key"], string> = {
  summary: "Score, verdict, market snapshot, go/stop signals",
  financials: "Startup cost, break-even, CAC/LTV, revenue streams",
  roadmap: "MVP timeline, milestones, quick wins",
  competitors: "Named competitors and your edge over them",
  validate: "Interview questions, outreach drafts, and pre-sell copy",
  build: "MVP scope, tech stack, and a paste-ready AI coding prompt",
  full: "The complete prose report, exportable as a PDF",
};

function ReportPreviewCard() {
  return (
    <div className="relative animate-rise-in [animation-delay:150ms]">
      <span className="absolute -top-3 left-6 z-10 rounded-full border border-ink-border bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        Example report
      </span>
      <div className="space-y-5 rounded-3xl border border-ink-border bg-ink p-6 shadow-xl shadow-ink/10">
        <VerdictGauge
          score={78}
          verdict="GO"
          headline="Real demand signal, clear early customers."
          animate={false}
        />
        <ul className="space-y-3 border-t border-ink-border pt-5">
          {PREVIEW_SCORES.map((s) => {
            const tone = tierForScore(s.score);
            const Icon = SCORE_CRITERION_ICONS[s.label];
            return (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-medium text-ink-text">
                  <Icon className="h-3.5 w-3.5 text-ink-muted" />
                  {s.label}
                </span>
                <span className="font-mono text-xs" style={{ color: TONE_COLOR[tone] }}>
                  {s.score}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function WhatYouGetStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {REPORT_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand/30 hover:shadow-md"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-text">{step.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{WHAT_YOU_GET[step.key]}</p>
          </div>
        );
      })}
    </div>
  );
}

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

      // A platform-level failure (e.g. the function exceeding maxDuration)
      // returns a plain-text/HTML error page, not our JSON shape — parse
      // defensively so that shows a real message instead of a raw
      // "Unexpected token" crash from response.json() itself.
      let data: { report?: ValidationReport; error?: string };
      try {
        data = await response.json();
      } catch {
        throw new Error("The server took too long to respond. Please try again.");
      }

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
    <div className="flex min-h-screen flex-col bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />

        <SiteHeader />

        <section className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10">
          <div className="text-center lg:text-left">
            <h1 className="animate-rise-in font-display text-4xl tracking-tight text-slate-text sm:text-5xl">
              Validate your startup idea
            </h1>
            <p className="mx-auto mt-4 max-w-xl animate-rise-in text-lg leading-8 text-slate-500 [animation-delay:60ms] lg:mx-0">
              Describe your idea in one sentence. FounderCopilot will score it, chart it, and hand you
              a complete validation report — market, customers, competition, and more.
            </p>

            <div className="mt-8 animate-rise-in rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm [animation-delay:120ms] sm:p-8">
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

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              {TRUST_BADGES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/70 px-3.5 py-2 text-xs font-medium text-slate-500 shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-brand" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <ReportPreviewCard />
        </section>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-12 sm:pb-16">
        {error && (
          <div className="mt-10 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-4 text-sm text-signal-pivot">
            {error}
          </div>
        )}

        <section className="mt-14">
          {isGenerating && <GenerationProgress idea={idea.trim()} />}

          {!isGenerating && (
            <>
              <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-slate-400 lg:text-left">
                What you get
              </p>
              <div className="mt-4">
                <WhatYouGetStrip />
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
