import { REPORT_SECTION_TITLES, SCORE_CRITERIA } from "@/lib/types";
import type { ReportSection, ScoreCriterion, ValidationReport, Verdict } from "@/lib/types";
import { SCORE_FIELD_BY_LABEL, type CompetitiveDraft, type ExecutionDraft, type MarketDraft, type Synthesis } from "@/lib/report-schemas";

// Structural validation (types, ranges, enums, required-vs-optional) is
// now enforced by Zod at the generateObject boundary — see
// lib/report-schemas.ts — so this file no longer needs to hand-roll
// defensive coercion the way the old single-call pipeline did. What's left
// is real business logic: merging the 3 wave-1 drafts' structured fields
// with wave 3's revised sections/scores, and computing overallScore/
// verdict, which are never trusted from the model directly so the number
// on screen always matches the math behind it.

function scoresToVerdict(overallScore: number): Verdict {
  if (overallScore >= 70) return "GO";
  if (overallScore >= 45) return "REFINE";
  return "PIVOT";
}

export function finalizeReport(
  market: MarketDraft,
  competitive: CompetitiveDraft,
  execution: ExecutionDraft,
  synthesis: Synthesis,
): ValidationReport {
  const sectionContentByTitle: Record<(typeof REPORT_SECTION_TITLES)[number], string> = {
    "Market Analysis": synthesis.marketAnalysisSection,
    "Problem Statement": synthesis.problemStatementSection,
    ICP: synthesis.icpSection,
    TAM: synthesis.tamSection,
    Competitors: synthesis.competitorsSection,
    SWOT: synthesis.swotSection,
    "Revenue Model": synthesis.revenueModelSection,
    MVP: synthesis.mvpSection,
    "Go-To-Market": synthesis.goToMarketSection,
    Risks: synthesis.risksSection,
  };

  const sections: ReportSection[] = REPORT_SECTION_TITLES.map((title) => ({
    title,
    content: sectionContentByTitle[title],
  }));

  const scores: ScoreCriterion[] = SCORE_CRITERIA.map((label) => {
    const detail = synthesis.scores[SCORE_FIELD_BY_LABEL[label]];
    return { label, score: detail.score, note: detail.note };
  });

  const overallScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  const verdict = scoresToVerdict(overallScore);

  return {
    headline: synthesis.headline,
    category: market.category,
    scores,
    market: market.market,
    goSignals: market.goSignals,
    stopSignals: market.stopSignals,
    sections,
    financials: competitive.financials,
    roadmap: execution.roadmap,
    competitive: competitive.competitive,
    customerValidation: execution.customerValidation,
    buildBrief: execution.buildBrief,
    sources: [], // Groq has no search grounding on this provider
    overallScore,
    verdict,
  };
}
