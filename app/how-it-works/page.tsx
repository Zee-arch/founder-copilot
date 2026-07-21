import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MessageSquareText, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { REPORT_STEPS } from "@/lib/report-icons";

export const metadata: Metadata = {
  title: "How It Works — FounderCopilot",
  description: "How FounderCopilot turns one sentence into a full startup validation report.",
};

const PROCESS_STEPS = [
  {
    icon: MessageSquareText,
    title: "Describe your idea",
    body: "One sentence is enough — no forms, no account, no wizard. Type what you're building and click Generate.",
  },
  {
    icon: Sparkles,
    title: "The AI scores it honestly",
    body: "The model scores 8 independent factors — problem urgency, market size, feasibility, and more. FounderCopilot computes the overall score and verdict from those 8 numbers in code, not from a separate model opinion, so the number on screen always matches the math behind it.",
  },
  {
    icon: ArrowRight,
    title: "Read your 5-part report",
    body: "Summary, financials, roadmap, competitors, and the full prose report — each with its own page, plus a PDF you can save or share.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-3xl px-6 pt-12 text-center sm:pt-16">
          <h1 className="font-display text-4xl tracking-tight text-slate-text sm:text-5xl">How it works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-500">
            Three steps between a one-sentence idea and a full validation report.
          </p>
        </section>
      </div>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mt-10 space-y-4">
          {PROCESS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-sm font-semibold text-brand">
                  {i + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand" />
                    <p className="font-display text-lg text-slate-text">{step.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="font-display text-lg text-slate-text">What&apos;s in the report</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {REPORT_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Icon className="h-4 w-4 text-brand" />
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="font-display text-lg text-slate-text">What this isn&apos;t</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            FounderCopilot generates estimates from a language model, not verified market research. Market
            sizing, financial figures, and timelines are clearly labeled estimates — sanity-check them yourself
            before using them anywhere official. It isn&apos;t financial, legal, or investment advice.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim"
          >
            Validate your idea
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
