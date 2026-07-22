"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { useReport } from "@/lib/report-context";
import { REPORT_STEPS, type ReportStepKey } from "@/lib/report-icons";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportStepContent } from "@/components/report/StepContent";

export default function ReportLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { idea, report, isHydrated } = useReport();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // PDF export renders every step into this off-screen container (instead
  // of driving it through real route navigation) so capture never races a
  // route transition — html2canvas needs the DOM to already be settled,
  // and a first-visit route change can take longer than a couple of
  // animation frames while Next.js fetches/compiles that segment.
  const exportRefs = useRef<Partial<Record<ReportStepKey, HTMLDivElement>>>({});

  useEffect(() => {
    if (isHydrated && !report) router.replace("/");
  }, [isHydrated, report, router]);

  async function handleDownloadPdf() {
    if (!report || isExporting) return;

    setIsExporting(true);
    setExportError("");

    try {
      const { createReportPdf, addElementAsPages, saveReportPdf } = await import("@/lib/pdf");
      const pdf = await createReportPdf();

      for (let i = 0; i < REPORT_STEPS.length; i++) {
        const el = exportRefs.current[REPORT_STEPS[i].key];
        if (!el) continue;
        await addElementAsPages(pdf, el, i === 0);
      }

      saveReportPdf(pdf, idea);
    } catch (error) {
      console.error("PDF export failed:", error);
      setExportError("Couldn't generate the PDF. Try again, or use your browser's Print > Save as PDF instead.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-paper">
        <SiteHeader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 px-6 py-4">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Idea analyzed</p>
          <p className="mt-1 font-display text-base text-slate-text">{idea}</p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Scrolls to reveal steps past the visible width (confirmed on a
              real 375px viewport — Competitors/Validate/Build Brief/Full
              Report all sit off-screen there) but had zero visual hint that
              it scrolls at all. The fade is that hint. */}
          <div className="relative w-fit max-w-full">
            <div className="flex w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REPORT_STEPS.map((step) => {
                const href = `/report/${step.key}` as const;
                const isActive = pathname === href;
                const Icon = step.icon;
                return (
                  <Link
                    key={step.key}
                    href={href}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive ? "bg-ink text-ink-text" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {step.label}
                  </Link>
                );
              })}
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full bg-gradient-to-l from-white to-transparent"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Preparing PDF…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </>
            )}
          </button>
        </div>

        {exportError && (
          <div className="mb-6 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-3 text-sm text-signal-pivot">
            {exportError}
          </div>
        )}

        {children}
      </main>

      <div aria-hidden className="pointer-events-none fixed left-[-9999px] top-0" style={{ width: "1024px" }}>
        {REPORT_STEPS.map((step) => (
          <div
            key={step.key}
            ref={(el) => {
              if (el) exportRefs.current[step.key] = el;
            }}
            className="px-6 py-8"
          >
            <ReportStepContent step={step.key} report={report} animate={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
