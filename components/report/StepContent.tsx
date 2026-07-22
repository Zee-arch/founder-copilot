import { notFound } from "next/navigation";
import type { ValidationReport } from "@/lib/types";
import type { ReportStepKey } from "@/lib/report-icons";
import { Snapshot } from "@/components/report/Snapshot";
import { Financials } from "@/components/report/Financials";
import { Roadmap } from "@/components/report/Roadmap";
import { CompetitiveLandscape } from "@/components/report/CompetitiveLandscape";
import { CustomerValidation } from "@/components/report/CustomerValidation";
import { BuildBrief } from "@/components/report/BuildBrief";
import { FullReport } from "@/components/report/FullReport";

export function ReportStepContent({
  step,
  report,
  animate = true,
}: {
  step: string;
  report: ValidationReport;
  animate?: boolean;
}) {
  switch (step as ReportStepKey) {
    case "summary":
      return (
        <Snapshot
          overallScore={report.overallScore}
          verdict={report.verdict}
          headline={report.headline}
          scores={report.scores}
          market={report.market}
          goSignals={report.goSignals}
          stopSignals={report.stopSignals}
          sources={report.sources}
          animate={animate}
        />
      );
    case "financials":
      return <Financials financials={report.financials} />;
    case "roadmap":
      return <Roadmap roadmap={report.roadmap} />;
    case "competitors":
      return <CompetitiveLandscape competitive={report.competitive} />;
    case "validate":
      return <CustomerValidation customerValidation={report.customerValidation} />;
    case "build":
      return <BuildBrief buildBrief={report.buildBrief} />;
    case "full":
      return <FullReport sections={report.sections} />;
    default:
      notFound();
  }
}
