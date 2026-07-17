import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "About — FounderCopilot",
  description: "What FounderCopilot is, who it's for, and how it thinks about honesty in AI-generated reports.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-3xl px-6 pt-12 text-center sm:pt-16">
          <h1 className="font-display text-4xl tracking-tight text-slate-text sm:text-5xl">About FounderCopilot</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-500">
            An AI co-founder for non-technical founders — built to give a straight answer before you spend
            months building something nobody wants.
          </p>
        </section>
      </div>

      <main className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mt-10 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-display text-lg text-slate-text">Who it&apos;s for</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              People with a startup idea and no technical or market-research background — you shouldn&apos;t need
              to hire a consultant or learn TAM/SAM/SOM math just to get a first honest read on whether an
              idea is worth your time.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-display text-lg text-slate-text">Why it&apos;s built the way it is</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The overall score and GO / REFINE / PIVOT verdict are computed in code from 8 independently
              scored factors — never a separate, unexplained judgment from the model. That&apos;s a deliberate
              choice: the math behind the number is always checkable, not a black box.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-display text-lg text-slate-text">Where the line is</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Market sizing, financial figures, and competitor profiles are AI-generated estimates, always
              labeled as such. We&apos;d rather show a clearly-marked estimate than a number dressed up to look
              like verified, real-time data.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-display text-lg text-slate-text">What&apos;s next</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Idea validation is the first step. The long-term goal is a full founder operating system —
              PRDs, landing pages, marketing plans, and investor decks — that grows with a startup as it
              matures.
            </p>
          </div>
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
