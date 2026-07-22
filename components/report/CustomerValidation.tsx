import { Mail, MessageCircleQuestion, Sparkles } from "lucide-react";
import type { CustomerValidation as CustomerValidationData } from "@/lib/types";

export function CustomerValidation({ customerValidation }: { customerValidation: CustomerValidationData }) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <div className="rounded-2xl border border-[rgba(76,77,220,0.3)] bg-[rgba(76,77,220,0.1)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand">Starting drafts, not finished assets</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-text">
          A score is a starting point, not a finish line — the next step is real conversations with real people.
          These drafts exist to make that easy to start today: read them, customize them for your voice, and use
          them before writing your own from scratch.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="h-4 w-4 text-ink-muted" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Customer interview guide
          </p>
        </div>
        <ol className="mt-4 space-y-3">
          {customerValidation.interviewQuestions.map((question, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-ink-border bg-ink p-4 text-sm text-ink-text">
              <span className="font-mono text-xs text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="leading-relaxed">{question}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Open-ended by design — let people describe their own situation instead of reacting to yours.
        </p>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-ink-muted" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Cold outreach drafts
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {customerValidation.outreachEmails.map((email, i) => (
            <div key={i} className="rounded-xl border border-ink-border bg-ink p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted">Subject</p>
              <p className="mt-1 font-display text-sm text-ink-text">{email.subject}</p>
              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-ink-muted">{email.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ink-muted" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Landing page / pre-sell copy
          </p>
        </div>
        <p className="mt-4 rounded-xl border border-ink-border bg-ink p-4 text-sm leading-relaxed text-ink-text">
          {customerValidation.landingPageCopy}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Put this behind a real signup form (even a simple email list) — actual signups are a far stronger signal
          than anyone&apos;s opinion, including this report&apos;s.
        </p>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        These drafts contain no fabricated statistics or invented testimonials — anything that sounds like a
        real result (a percentage, a quote, a number of users) should come from people you actually talk to, not
        from this page.
      </p>
    </div>
  );
}
