import { z } from "zod";
import { IDEA_CATEGORIES, MILESTONE_PHASES, SCORE_CRITERIA } from "@/lib/types";

// No `.catch()` anywhere in this file: Groq's structured-output mode
// requires every property to be listed in the JSON schema's `required`
// array, and the AI SDK's zod-to-json-schema conversion treats a
// `.catch()`-wrapped field as optional (its `isOptional()` returns true),
// which Groq's strict mode then rejects outright — confirmed live
// ("`required` is required to be supplied and to be an array including
// every key in properties"). So every field here is plain-required;
// Groq's own schema enforcement is the guarantee now, not a client-side
// soft-default. If a call still comes back malformed despite that,
// generateObject throws and the report generation fails cleanly (same
// hard-fail-and-surface-a-friendly-error behavior this app has always
// used for its truly load-bearing fields, just extended to all of them).
const estimate = z.string();

const revenueStreamSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const competitorSchema = z.object({
  name: z.string(),
  description: z.string(),
  strength: z.string(),
  weakness: z.string(),
});

const milestoneSchema = z.object({
  title: z.string(),
  phase: z.enum(MILESTONE_PHASES),
  timeframe: z.string(),
});

const outreachEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

const techStackChoiceSchema = z.object({
  layer: z.string(),
  choice: z.string(),
  reason: z.string(),
});

// Keyed by field, not an array matched by label — avoids the "match by
// label, fall back positional" ambiguity the old array-based scores
// parsing had to handle. The synthesis agent (the only one that assigns
// scores) fills in exactly these 8 fields; lib/parse-report.ts reads them
// back out in SCORE_CRITERIA order to build the final ScoreCriterion[].
const scoreDetailSchema = z.object({
  score: z.number().min(0).max(100),
  note: z.string(),
});

export const scoresSchema = z.object({
  problemUrgency: scoreDetailSchema,
  marketSize: scoreDetailSchema,
  marketTiming: scoreDetailSchema,
  competitiveAdvantage: scoreDetailSchema,
  mvpFeasibility: scoreDetailSchema,
  capitalEfficiency: scoreDetailSchema,
  regulatoryEase: scoreDetailSchema,
  revenueClarity: scoreDetailSchema,
});

// SCORE_CRITERIA is the canonical order (see lib/types.ts) — this maps
// each label to the scoresSchema key an agent fills in.
export const SCORE_FIELD_BY_LABEL: Record<(typeof SCORE_CRITERIA)[number], keyof z.infer<typeof scoresSchema>> = {
  "Problem Urgency": "problemUrgency",
  "Market Size": "marketSize",
  "Market Timing": "marketTiming",
  "Competitive Advantage": "competitiveAdvantage",
  "MVP Feasibility": "mvpFeasibility",
  "Capital Efficiency": "capitalEfficiency",
  "Regulatory Ease": "regulatoryEase",
  "Revenue Clarity": "revenueClarity",
};

// --- Wave 1: three parallel specialist drafts ---
// Each owns a disjoint slice of the final report. Section content is a
// flat field per section (not an array matched against an enum title) —
// far more reliable for structured generation than asking the model to
// also get exact title/position/count right; lib/parse-report.ts
// reconstructs the titled ReportSection[] from these fixed field names.

export const marketDraftSchema = z.object({
  category: z.enum(IDEA_CATEGORIES),
  headline: z.string(),
  market: z.object({
    tam: estimate,
    sam: estimate,
    som: estimate,
    cagr: estimate,
  }),
  goSignals: z.array(z.string()).min(3).max(6),
  stopSignals: z.array(z.string()).min(3).max(6),
  marketAnalysisSection: z.string(),
  problemStatementSection: z.string(),
  icpSection: z.string(),
  tamSection: z.string(),
});
export type MarketDraft = z.infer<typeof marketDraftSchema>;

export const competitiveDraftSchema = z.object({
  competitive: z.object({
    competitors: z.array(competitorSchema).min(3).max(5),
    yourEdge: z.string(),
  }),
  financials: z.object({
    startupCost: estimate,
    breakEven: estimate,
    cac: estimate,
    ltv: estimate,
    ltvToCac: estimate,
    revenueStreams: z.array(revenueStreamSchema).min(2).max(4),
  }),
  competitorsSection: z.string(),
  swotSection: z.string(),
  revenueModelSection: z.string(),
});
export type CompetitiveDraft = z.infer<typeof competitiveDraftSchema>;

export const executionDraftSchema = z.object({
  roadmap: z.object({
    mvpTimeline: estimate,
    milestones: z.array(milestoneSchema).min(4).max(6),
    quickWins: z.array(z.string()).min(3).max(5),
  }),
  customerValidation: z.object({
    interviewQuestions: z.array(z.string()).min(5).max(8),
    outreachEmails: z.array(outreachEmailSchema).min(2).max(3),
    landingPageCopy: z.string(),
  }),
  buildBrief: z.object({
    mvpScope: z.string(),
    techStack: z.array(techStackChoiceSchema).min(3).max(6),
    starterPrompt: z.string(),
  }),
  mvpSection: z.string(),
  goToMarketSection: z.string(),
  risksSection: z.string(),
});
export type ExecutionDraft = z.infer<typeof executionDraftSchema>;

// --- Wave 2: critic ---
// Notes only, never rewrites content itself — see lib/prompt.ts.

export const critiqueSchema = z.object({
  concerns: z.array(z.string()).min(1).max(8),
  revisionInstructions: z.string(),
});
export type Critique = z.infer<typeof critiqueSchema>;

// --- Wave 3: synthesis ---
// Scoped as an editor, not a rewriter — the structured fields from the 3
// wave-1 drafts are merged verbatim in code (lib/parse-report.ts), no LLM
// involvement. This call only assigns scores and lightly revises the 10
// section drafts for a consistent voice + the critic's fixes.

export const synthesisSchema = z.object({
  headline: z.string(),
  scores: scoresSchema,
  marketAnalysisSection: z.string(),
  problemStatementSection: z.string(),
  icpSection: z.string(),
  tamSection: z.string(),
  competitorsSection: z.string(),
  swotSection: z.string(),
  revenueModelSection: z.string(),
  mvpSection: z.string(),
  goToMarketSection: z.string(),
  risksSection: z.string(),
});
export type Synthesis = z.infer<typeof synthesisSchema>;
