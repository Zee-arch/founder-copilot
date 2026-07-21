export const REPORT_SECTION_TITLES = [
  "Market Analysis",
  "Problem Statement",
  "ICP",
  "TAM",
  "Competitors",
  "SWOT",
  "Revenue Model",
  "MVP",
  "Go-To-Market",
  "Risks",
] as const;

export type ReportSectionTitle = (typeof REPORT_SECTION_TITLES)[number];

export type ReportSection = {
  title: ReportSectionTitle;
  content: string;
};

// Classified by the model as part of the same generation call (see
// lib/prompt.ts) — used to steer emphasis within the fixed 8-factor/
// 10-section backbone (different framing, not different fields), never to
// change the schema per category. "General" is the safe fallback for an
// idea that doesn't cleanly fit one of the more specific buckets, and what
// lib/parse-report.ts falls back to if the model's value doesn't match.
export const IDEA_CATEGORIES = [
  "Consumer/Wellness",
  "B2B SaaS",
  "Marketplace",
  "Hyperlocal/Local Service",
  "Hardware",
  "Regulated (Health/Finance)",
  "General",
] as const;

export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

// The 8 factors scored for every idea, in this exact order. Each is framed so
// "higher is always better" — makes the radar chart intuitive at a glance
// (a lopsided shape pointing outward = strength, pulled inward = weakness).
export const SCORE_CRITERIA = [
  "Problem Urgency",
  "Market Size",
  "Market Timing",
  "Competitive Advantage",
  "MVP Feasibility",
  "Capital Efficiency",
  "Regulatory Ease",
  "Revenue Clarity",
] as const;

export type ScoreCriterionLabel = (typeof SCORE_CRITERIA)[number];

export type ScoreCriterion = {
  label: ScoreCriterionLabel;
  score: number; // 0-100, always oriented so higher = more favorable
  note: string; // one-line reason for the score
};

export type MarketSizing = {
  tam: string; // e.g. "~$300-400B by early 2030s (estimate)"
  sam: string;
  som: string;
  cagr: string; // e.g. "~12% CAGR (estimate)"
};

export type Verdict = "GO" | "REFINE" | "PIVOT";

export type RevenueStream = {
  name: string;
  description: string;
};

export type Financials = {
  startupCost: string; // labeled estimate, e.g. "~$15-30k (estimate)"
  breakEven: string; // labeled estimate, e.g. "~Month 14-18 (estimate)"
  cac: string; // labeled estimate
  ltv: string; // labeled estimate
  ltvToCac: string; // labeled estimate, e.g. "~3:1 (estimate)"
  revenueStreams: RevenueStream[]; // 2-4
};

export const MILESTONE_PHASES = ["Validate", "Build", "Launch", "Distribute"] as const;
export type MilestonePhase = (typeof MILESTONE_PHASES)[number];

export type Milestone = {
  title: string;
  phase: MilestonePhase;
  timeframe: string; // relative, e.g. "Month 2-3" — never a specific date
};

export type Roadmap = {
  mvpTimeline: string; // labeled estimate
  milestones: Milestone[]; // 4-6, roughly chronological
  quickWins: string[]; // 3-5 actions doable within a week
};

export type Source = {
  label: string; // what this source supports, e.g. "Global market size"
  url: string; // must be a real URL the model actually retrieved via web search
};

// A quantitative competitor claim (funding, valuation, user count) is only
// ever constructed by lib/parse-report.ts after cross-checking the model's
// claimed URL against this session's real grounding sources — the type
// itself has no "figure without a source" shape, so a fabricated number
// can't reach the UI even if the model tries to report one ungrounded.
export type SourcedFigure = {
  value: string; // e.g. "$50M Series B (2025)", "~2M users"
  source: Source;
};

export type Competitor = {
  name: string;
  description: string;
  strength: string;
  weakness: string;
  // Present only when backed by a real source from this session's search —
  // never inferred from training knowledge. Omitted (not fabricated with a
  // placeholder) when no grounded figure was found.
  funding?: SourcedFigure;
  valuation?: SourcedFigure;
  userCount?: SourcedFigure;
};

export type CompetitiveLandscape = {
  competitors: Competitor[]; // 3-5, qualitative required, quantitative fields only when sourced
  yourEdge: string; // the differentiation opportunity, one short paragraph
};

export type OutreachEmail = {
  subject: string;
  body: string;
};

// Starting drafts for validating the idea with real people, not just AI —
// deliberately never asked to include fabricated social proof or stats
// (no invented "X% of users said..."). Same "never fabricate, fall back
// gracefully" tier as financials/roadmap/competitive, not the hard-throw
// tier scores/sections use.
export type CustomerValidation = {
  interviewQuestions: string[]; // 5-8, open-ended, non-leading
  outreachEmails: OutreachEmail[]; // 2-3 short cold drafts
  landingPageCopy: string; // one paragraph of pre-sell copy
};

export type ValidationReport = {
  headline: string; // one-line qualitative judgment on the idea
  category: IdeaCategory; // classified by the model, steers emphasis only — see lib/prompt.ts
  scores: ScoreCriterion[]; // exactly 8, matching SCORE_CRITERIA order
  market: MarketSizing;
  goSignals: string[]; // reasons the idea has momentum
  stopSignals: string[]; // reasons to pause / what could kill it
  sections: ReportSection[]; // the full 10-section prose report
  financials: Financials;
  roadmap: Roadmap;
  competitive: CompetitiveLandscape;
  customerValidation: CustomerValidation;
  sources: Source[]; // real pages retrieved via Gemini's Google Search grounding (see route.ts)
  // Computed in code from `scores` — never trusted from the model directly,
  // so the number on screen always matches the math behind it.
  overallScore: number;
  verdict: Verdict;
};
