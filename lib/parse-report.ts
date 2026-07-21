import {
  MILESTONE_PHASES,
  REPORT_SECTION_TITLES,
  SCORE_CRITERIA,
  type Competitor,
  type CompetitiveLandscape,
  type Financials,
  type MarketSizing,
  type Milestone,
  type MilestonePhase,
  type Roadmap,
  type RevenueStream,
  type ScoreCriterion,
  type Source,
  type ValidationReport,
  type Verdict,
} from "@/lib/types";

const HTTP_URL_PATTERN = /^https?:\/\//i;

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
type RawCompetitor = { name?: unknown; description?: unknown; strength?: unknown; weakness?: unknown };
type RawJson = {
  headline?: unknown;
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
  sources?: RawSource[];
};

type RawSource = { label?: unknown; url?: unknown };

export function parseValidationReport(text: string): ValidationReport {
  const parsed = JSON.parse(extractJson(text)) as RawJson;

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

  // --- competitive landscape: qualitative only, no fabricated stats ---
  const competitors: Competitor[] = (
    Array.isArray(parsed.competitive?.competitors) ? parsed.competitive.competitors : []
  )
    .filter((c): c is RawCompetitor => typeof c?.name === "string" && c.name.trim().length > 0)
    .slice(0, 5)
    .map((c) => ({
      name: str(c.name),
      description: str(c.description, ""),
      strength: str(c.strength, ""),
      weakness: str(c.weakness, ""),
    }));

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

  // --- sources: no web search in the current generation path (see
  // HANDOFF.md), so the model is instructed to always return an empty
  // array. Still filtered defensively rather than trusted, same as
  // everything else — never the hard-throw tier — in case that changes.
  const seenSourceUrls = new Set<string>();
  const sources: Source[] = (Array.isArray(parsed.sources) ? parsed.sources : [])
    .filter(
      (s): s is RawSource =>
        typeof s?.label === "string" &&
        s.label.trim().length > 0 &&
        typeof s?.url === "string" &&
        HTTP_URL_PATTERN.test(s.url.trim()),
    )
    .map((s) => ({ label: str(s.label), url: (s.url as string).trim() }))
    .filter((s) => {
      if (seenSourceUrls.has(s.url)) return false;
      seenSourceUrls.add(s.url);
      return true;
    })
    .slice(0, 8);

  return {
    headline,
    scores,
    market,
    goSignals,
    stopSignals,
    sections,
    financials,
    roadmap,
    competitive,
    sources,
    overallScore,
    verdict,
  };
}
