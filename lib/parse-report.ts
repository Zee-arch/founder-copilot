import {
  IDEA_CATEGORIES,
  MILESTONE_PHASES,
  REPORT_SECTION_TITLES,
  SCORE_CRITERIA,
  type BuildBrief,
  type Competitor,
  type CompetitiveLandscape,
  type CustomerValidation,
  type Financials,
  type IdeaCategory,
  type MarketSizing,
  type Milestone,
  type MilestonePhase,
  type OutreachEmail,
  type Roadmap,
  type RevenueStream,
  type ScoreCriterion,
  type Source,
  type SourcedFigure,
  type TechStackChoice,
  type ValidationReport,
  type Verdict,
} from "@/lib/types";

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The model did not return valid JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 50; // neutral fallback rather than crashing the whole report
  return Math.max(0, Math.min(100, Math.round(num)));
}

function scoresToVerdict(overallScore: number): Verdict {
  if (overallScore >= 70) return "GO";
  if (overallScore >= 45) return "REFINE";
  return "PIVOT";
}

// Shared fallback for any labeled-estimate string field (market sizing,
// financials, roadmap) — never fabricate a value the model didn't provide.
function str(value: unknown, fallback = "Not estimated"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

type RawScore = { label?: unknown; score?: unknown; note?: unknown };
type RawRevenueStream = { name?: unknown; description?: unknown };
type RawMilestone = { title?: unknown; phase?: unknown; timeframe?: unknown };
type RawOutreachEmail = { subject?: unknown; body?: unknown };
type RawTechStackChoice = { layer?: unknown; choice?: unknown; reason?: unknown };
type RawSourcedFigure = { value?: unknown; url?: unknown };
type RawCompetitor = {
  name?: unknown;
  description?: unknown;
  strength?: unknown;
  weakness?: unknown;
  funding?: RawSourcedFigure;
  valuation?: RawSourcedFigure;
  userCount?: RawSourcedFigure;
};
type RawJson = {
  headline?: unknown;
  category?: unknown;
  scores?: RawScore[];
  market?: { tam?: unknown; sam?: unknown; som?: unknown; cagr?: unknown };
  goSignals?: unknown[];
  stopSignals?: unknown[];
  sections?: { title?: unknown; content?: unknown }[];
  financials?: {
    startupCost?: unknown;
    breakEven?: unknown;
    cac?: unknown;
    ltv?: unknown;
    ltvToCac?: unknown;
    revenueStreams?: RawRevenueStream[];
  };
  roadmap?: { mvpTimeline?: unknown; milestones?: RawMilestone[]; quickWins?: unknown[] };
  competitive?: { competitors?: RawCompetitor[]; yourEdge?: unknown };
  customerValidation?: {
    interviewQuestions?: unknown[];
    outreachEmails?: RawOutreachEmail[];
    landingPageCopy?: unknown;
  };
  buildBrief?: {
    mvpScope?: unknown;
    techStack?: RawTechStackChoice[];
    starterPrompt?: unknown;
  };
};

// A competitor figure is only ever accepted if its claimed URL exactly
// matches one of this session's real grounding sources — the model self-
// reports which URL backs a figure (it has to; only it knows which search
// result supports which specific claim), but the URL itself is verified
// against real API data, not trusted on its word. The label shown in the
// UI always comes from the verified Source (real page title), never from
// anything the model wrote about the figure — same "never fabricate, fall
// back gracefully" tier as market sizing, not the hard-throw tier
// scores/sections use: a bad or missing figure just omits that field.
function resolveSourcedFigure(raw: RawSourcedFigure | undefined, sourceByUrl: Map<string, Source>): SourcedFigure | undefined {
  if (!raw || typeof raw.value !== "string" || !raw.value.trim()) return undefined;
  if (typeof raw.url !== "string") return undefined;

  const source = sourceByUrl.get(raw.url.trim());
  if (!source) return undefined;

  return { value: raw.value.trim(), source };
}

export function parseValidationReport(text: string, groundedSources: Source[]): ValidationReport {
  const parsed = JSON.parse(extractJson(text)) as RawJson;
  const sourceByUrl = new Map(groundedSources.map((s) => [s.url, s]));

  // --- sections (unchanged shape from v1) ---
  if (!Array.isArray(parsed.sections) || parsed.sections.length !== REPORT_SECTION_TITLES.length) {
    throw new Error("The model returned an incomplete report (missing report sections).");
  }

  const sections = REPORT_SECTION_TITLES.map((title, index) => {
    const section = parsed.sections![index];
    if (!section?.content || typeof section.content !== "string" || !section.content.trim()) {
      throw new Error(`Missing content for section: ${title}`);
    }
    return { title, content: section.content.trim() };
  });

  // --- scores: match by label where possible, fall back to positional, then neutral default ---
  const rawScores = Array.isArray(parsed.scores) ? parsed.scores : [];

  const scores: ScoreCriterion[] = SCORE_CRITERIA.map((label, index) => {
    const match =
      rawScores.find((s) => typeof s?.label === "string" && s.label.trim() === label) ??
      rawScores[index];

    return {
      label,
      score: clampScore(match?.score),
      note: typeof match?.note === "string" && match.note.trim() ? match.note.trim() : "No explanation provided.",
    };
  });

  const overallScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  const verdict = scoresToVerdict(overallScore);

  // --- market sizing: keep as labeled strings, never fabricate if missing ---
  const market: MarketSizing = {
    tam: str(parsed.market?.tam),
    sam: str(parsed.market?.sam),
    som: str(parsed.market?.som),
    cagr: str(parsed.market?.cagr),
  };

  // --- financials: labeled estimates, same honesty tier as market sizing ---
  const revenueStreams: RevenueStream[] = (
    Array.isArray(parsed.financials?.revenueStreams) ? parsed.financials.revenueStreams : []
  )
    .filter((s): s is RawRevenueStream => typeof s?.name === "string" && s.name.trim().length > 0)
    .slice(0, 4)
    .map((s) => ({ name: str(s.name), description: str(s.description, "") }));

  const financials: Financials = {
    startupCost: str(parsed.financials?.startupCost),
    breakEven: str(parsed.financials?.breakEven),
    cac: str(parsed.financials?.cac),
    ltv: str(parsed.financials?.ltv),
    ltvToCac: str(parsed.financials?.ltvToCac),
    revenueStreams,
  };

  // --- roadmap: milestone phase is clamped to the fixed enum, never trusted raw ---
  const milestonePhases = new Set<string>(MILESTONE_PHASES);

  const milestones: Milestone[] = (Array.isArray(parsed.roadmap?.milestones) ? parsed.roadmap.milestones : [])
    .filter((m): m is RawMilestone => typeof m?.title === "string" && m.title.trim().length > 0)
    .slice(0, 6)
    .map((m) => ({
      title: str(m.title),
      phase: (milestonePhases.has(m.phase as string) ? m.phase : "Build") as MilestonePhase,
      timeframe: str(m.timeframe, "Timeframe not estimated"),
    }));

  const quickWins = (Array.isArray(parsed.roadmap?.quickWins) ? parsed.roadmap.quickWins : [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 5);

  const roadmap: Roadmap = {
    mvpTimeline: str(parsed.roadmap?.mvpTimeline),
    milestones,
    quickWins,
  };

  // --- competitive landscape: qualitative fields always fall back gracefully;
  // funding/valuation/userCount are only attached when resolveSourcedFigure
  // confirms a real grounded source backs them (see helper above) ---
  const competitors: Competitor[] = (
    Array.isArray(parsed.competitive?.competitors) ? parsed.competitive.competitors : []
  )
    .filter((c): c is RawCompetitor => typeof c?.name === "string" && c.name.trim().length > 0)
    .slice(0, 5)
    .map((c) => {
      const funding = resolveSourcedFigure(c.funding, sourceByUrl);
      const valuation = resolveSourcedFigure(c.valuation, sourceByUrl);
      const userCount = resolveSourcedFigure(c.userCount, sourceByUrl);

      return {
        name: str(c.name),
        description: str(c.description, ""),
        strength: str(c.strength, ""),
        weakness: str(c.weakness, ""),
        ...(funding && { funding }),
        ...(valuation && { valuation }),
        ...(userCount && { userCount }),
      };
    });

  const competitive: CompetitiveLandscape = {
    competitors,
    yourEdge: str(parsed.competitive?.yourEdge, "Not enough information to identify a clear edge."),
  };

  // --- signals: filter to non-empty strings, cap length so the UI can't be blown out ---
  const goSignals = (Array.isArray(parsed.goSignals) ? parsed.goSignals : [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 6);

  const stopSignals = (Array.isArray(parsed.stopSignals) ? parsed.stopSignals : [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 6);

  const headline =
    typeof parsed.headline === "string" && parsed.headline.trim()
      ? parsed.headline.trim()
      : "Validation report generated.";

  // --- customer validation: same graceful, never-fabricate tier as
  // financials/roadmap — the honesty constraint here (no invented stats or
  // testimonials) is enforced in the prompt, not structurally checkable in
  // code the way sourced competitor figures are, since there's no URL to
  // cross-check a claim inside free-form email/landing copy against.
  const interviewQuestions = (
    Array.isArray(parsed.customerValidation?.interviewQuestions) ? parsed.customerValidation.interviewQuestions : []
  )
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    .slice(0, 8);

  const outreachEmails: OutreachEmail[] = (
    Array.isArray(parsed.customerValidation?.outreachEmails) ? parsed.customerValidation.outreachEmails : []
  )
    .filter(
      (e): e is RawOutreachEmail =>
        typeof e?.subject === "string" && e.subject.trim().length > 0 && typeof e?.body === "string" && e.body.trim().length > 0,
    )
    .slice(0, 3)
    .map((e) => ({ subject: str(e.subject), body: str(e.body) }));

  const customerValidation: CustomerValidation = {
    interviewQuestions,
    outreachEmails,
    landingPageCopy: str(parsed.customerValidation?.landingPageCopy, "Not enough information to draft pre-sell copy."),
  };

  // --- build brief: same graceful tier as customer validation above — a
  // brief, not a build, so nothing here is structurally verifiable the way
  // sourced competitor figures are; trust is at the prompt level. layer is
  // deliberately free text (not clamped to a fixed set like milestone
  // phase) since what an idea needs varies too much for a rigid taxonomy.
  const techStack: TechStackChoice[] = (
    Array.isArray(parsed.buildBrief?.techStack) ? parsed.buildBrief.techStack : []
  )
    .filter(
      (t): t is RawTechStackChoice =>
        typeof t?.layer === "string" && t.layer.trim().length > 0 && typeof t?.choice === "string" && t.choice.trim().length > 0,
    )
    .slice(0, 6)
    .map((t) => ({ layer: str(t.layer), choice: str(t.choice), reason: str(t.reason, "") }));

  const buildBrief: BuildBrief = {
    mvpScope: str(parsed.buildBrief?.mvpScope, "Not enough information to suggest an MVP scope."),
    techStack,
    starterPrompt: str(parsed.buildBrief?.starterPrompt, "Not enough information to draft a starter prompt."),
  };

  // --- category: informational, steers the model's own emphasis (see
  // lib/prompt.ts) — never trusted to gate or restructure anything in code,
  // so an invalid/missing value just falls back to the no-special-emphasis
  // default rather than throwing, same tier as milestone phase above.
  const ideaCategories = new Set<string>(IDEA_CATEGORIES);
  const category: IdeaCategory = (
    typeof parsed.category === "string" && ideaCategories.has(parsed.category) ? parsed.category : "General"
  ) as IdeaCategory;

  return {
    headline,
    category,
    scores,
    market,
    goSignals,
    stopSignals,
    sections,
    financials,
    roadmap,
    competitive,
    customerValidation,
    buildBrief,
    sources: groundedSources,
    overallScore,
    verdict,
  };
}
