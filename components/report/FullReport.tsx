import type { ReportSection } from "@/lib/types";
import { REPORT_SECTION_ICONS } from "@/lib/report-icons";

function sectionId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function FullReport({ sections }: { sections: ReportSection[] }) {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-paper p-6 sm:p-8">
      <nav className="sticky top-2 z-10 mb-2 flex gap-1.5 overflow-x-auto rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
        {sections.map((section) => {
          const Icon = REPORT_SECTION_ICONS[section.title];
          return (
            <a
              key={section.title}
              href={`#${sectionId(section.title)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon className="h-3 w-3" />
              {section.title}
            </a>
          );
        })}
      </nav>

      {sections.map((section, index) => {
        const Icon = REPORT_SECTION_ICONS[section.title];
        return (
          <article
            key={section.title}
            id={sectionId(section.title)}
            style={{ scrollMarginTop: "4.5rem" }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(76,77,220,0.1)] font-mono text-xs font-semibold text-brand">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className="h-4 w-4 text-brand" />
              <h3 className="font-display text-lg text-slate-text">{section.title}</h3>
            </div>
            <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {section.content}
            </p>
          </article>
        );
      })}
    </div>
  );
}
