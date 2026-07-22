"use client";

import { useState } from "react";
import { Check, Copy, Layers, ListChecks, Terminal } from "lucide-react";
import type { BuildBrief as BuildBriefData } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // prompt is still fully selectable/copyable by hand either way.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-border bg-ink-surface px-3 py-1.5 text-xs font-medium text-ink-text transition hover:border-brand/40"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-signal-go" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy prompt"}
    </button>
  );
}

export function BuildBrief({ buildBrief }: { buildBrief: BuildBriefData }) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <div className="rounded-2xl border border-[rgba(76,77,220,0.3)] bg-[rgba(76,77,220,0.1)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">A brief, not a build</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-text">
          This is a starting point for briefing an AI coding tool (Claude Code, Cursor, or similar) — no code is
          generated here. Read it, adjust anything that doesn&apos;t match how you actually want to build this,
          then paste the prompt below to get started.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-ink-muted" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Suggested MVP scope
          </p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-text">{buildBrief.mvpScope}</p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ink-muted" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Suggested tech stack
          </p>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {buildBrief.techStack.map((item, i) => (
            <li key={i} className="rounded-xl border border-ink-border bg-ink p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand">{item.layer}</p>
              <p className="mt-1 font-display text-sm text-ink-text">{item.choice}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{item.reason}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-ink-muted" />
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
              Starter prompt
            </p>
          </div>
          <CopyButton text={buildBrief.starterPrompt} />
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-ink-border bg-ink p-4 font-mono text-xs leading-relaxed text-ink-text">
          {buildBrief.starterPrompt}
        </pre>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        Scope and stack are the model&apos;s reasoned suggestions for this specific idea, not a guarantee of fit —
        review both against your own constraints (budget, timeline, what you already know) before starting.
      </p>
    </div>
  );
}
