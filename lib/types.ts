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

export type Competitor = {
  name: string;
  description: string;
  strength: string;
  weakness: string;
};

export type CompetitiveLandscape = {
  competitors: Competitor[]; // 3-5, qualitative only — no funding/user-count figures
  yourEdge: string; // the differentiation opportunity, one short paragraph
};

export type Source = {
  label: string; // what this source supports, e.g. "Global market size"
  url: string; // must be a real URL Claude actually retrieved via web_search
};

export type ValidationReport = {
  headline: string; // one-line qualitative judgment on the idea
  scores: ScoreCriterion[]; // exactly 8, matching SCORE_CRITERIA order
  market: MarketSizing;
  goSignals: string[]; // reasons the idea has momentum
  stopSignals: string[]; // reasons to pause / what could kill it
  sections: ReportSection[]; // the full 10-section prose report
  financials: Financials;
  roadmap: Roadmap;
  competitive: CompetitiveLandscape;
  sources: Source[]; // real pages Claude retrieved via web_search — empty if it didn't search
  // Computed in code from `scores` — never trusted from the model directly,
  // so the number on screen always matches the math behind it.
  overallScore: number;
  verdict: Verdict;
};
