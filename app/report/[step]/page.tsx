"use client";

import { use } from "react";
import { useReport } from "@/lib/report-context";
import { ReportStepContent } from "@/components/report/StepContent";

export default function ReportStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = use(params);
  const { report } = useReport();

  if (!report) return null; // ReportLayout redirects to "/" once hydration confirms there's nothing here

  return <ReportStepContent step={step} report={report} />;
}
