"use client";

import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { ExternalLink, Minus, Plus } from "lucide-react";
import type { MarketSizing, ScoreCriterion, Source, Verdict } from "@/lib/types";
import { SCORE_CRITERION_ICONS, VERDICT_ICONS } from "@/lib/report-icons";

export type Tone = "go" | "refine" | "pivot";

export function tierForScore(score: number): Tone {
  if (score >= 70) return "go";
  if (score >= 45) return "refine";
  return "pivot";
}

export const TONE_COLOR: Record<Tone, string> = {
  go: "var(--color-signal-go)",
  refine: "var(--color-signal-refine)",
  pivot: "var(--color-signal-pivot)",
};

const TONE_DIM: Record<Tone, string> = {
  go: "var(--color-signal-go-dim)",
  refine: "var(--color-signal-refine-dim)",
  pivot: "var(--color-signal-pivot-dim)",
};

const VERDICT_TONE: Record<Verdict, Tone> = {
  GO: "go",
  REFINE: "refine",
  PIVOT: "pivot",
};

// `enabled: false` skips the rAF loop entirely and just shows the final
// value — used when rendering off-screen for PDF export, where html2canvas
// is reading the DOM live and a mid-capture repaint from the animation can
// corrupt its clone and crash the capture.
function useCountUp(target: number, enabled: boolean, durationMs = 900) {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    let frame: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, durationMs]);

  return value;
}

export function VerdictGauge({
  score,
  verdict,
  headline,
  animate,
}: {
  score: number;
  verdict: Verdict;
  headline: string;
  animate: boolean;
}) {
  const size = 168;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);
  const tone = VERDICT_TONE[verdict];
  const color = TONE_COLOR[tone];
  const VerdictIcon = VERDICT_ICONS[verdict];
  const displayedScore = useCountUp(score, animate);

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
      <div
        className="relative shrink-0 rounded-full"
        style={{ width: size, height: size, boxShadow: `0 0 32px -8px ${color}` }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-ink-border)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-5xl leading-none" style={{ color }}>
            {displayedScore}
          </span>
          <span className="mt-1 font-mono text-[11px] tracking-wider text-ink-muted">/ 100</span>
        </div>
      </div>

      <div className="text-center sm:text-left">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-[0.2em]"
          style={{ color, backgroundColor: TONE_DIM[tone] }}
        >
          <VerdictIcon className="h-3.5 w-3.5" />
          {verdict}
        </span>
        <p className="mt-4 max-w-xl font-display text-2xl leading-snug text-ink-text sm:text-[28px]">
          {headline}
        </p>
      </div>
    </div>
  );
}

function ScoreRadar({ scores }: { scores: ScoreCriterion[] }) {
  const data = scores.map((s) => ({ label: s.label, score: s.score }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--color-ink-border)" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "var(--color-ink-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          dataKey="score"
          stroke="var(--color-brand)"
          fill="var(--color-brand)"
          fillOpacity={0.32}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ScoreList({ scores }: { scores: ScoreCriterion[] }) {
  return (
    <ul className="space-y-4">
      {scores.map((s) => {
        const tone = tierForScore(s.score);
        const Icon = SCORE_CRITERION_ICONS[s.label];
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-text">
                <Icon className="h-3.5 w-3.5 text-ink-muted" />
                {s.label}
              </span>
              <span className="font-mono text-sm" style={{ color: TONE_COLOR[tone] }}>
                {s.score}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-ink-border">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${s.score}%`, backgroundColor: TONE_COLOR[tone] }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{s.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ConcentricRings() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r="56" fill="none" stroke="var(--color-brand)" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="var(--color-brand)" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="20" fill="var(--color-brand)" fillOpacity="0.85" />
    </svg>
  );
}

function MarketPanel({ market }: { market: MarketSizing }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6 sm:col-span-2">
        <div className="flex items-center gap-6">
          <ConcentricRings />
          <div className="flex-1 space-y-3.5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">TAM · total addressable</p>
              <p className="font-display text-lg text-ink-text">{market.tam}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">SAM · serviceable</p>
              <p className="font-display text-base text-ink-text">{market.sam}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">SOM · realistic near-term</p>
              <p className="font-display text-sm text-ink-text">{market.som}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">Growth rate</p>
        <p className="mt-2 font-display text-2xl text-ink-text">{market.cagr}</p>
      </div>
    </div>
  );
}

function SignalsPanel({ goSignals, stopSignals }: { goSignals: string[]; stopSignals: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: TONE_COLOR.go }}
        >
          Go signals
        </p>
        <ul className="mt-4 space-y-3">
          {goSignals.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-text">
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ color: TONE_COLOR.go, backgroundColor: TONE_DIM.go }}
              >
                <Plus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: TONE_COLOR.pivot }}
        >
          Watch out for
        </p>
        <ul className="mt-4 space-y-3">
          {stopSignals.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-text">
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ color: TONE_COLOR.pivot, backgroundColor: TONE_DIM.pivot }}
              >
                <Minus className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SourcesPanel({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-surface p-6">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
        Sources — grounded with live web search
      </p>
      <ul className="mt-4 space-y-2.5">
        {sources.map((source, i) => (
          <li key={i}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm leading-relaxed text-ink-text underline decoration-ink-border underline-offset-4 hover:text-brand"
            >
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" />
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Snapshot({
  overallScore,
  verdict,
  headline,
  scores,
  market,
  goSignals,
  stopSignals,
  sources,
  animate = true,
}: {
  overallScore: number;
  verdict: Verdict;
  headline: string;
  scores: ScoreCriterion[];
  market: MarketSizing;
  goSignals: string[];
  stopSignals: string[];
  sources: Source[];
  animate?: boolean;
}) {
  return (
    <div className="space-y-6 rounded-3xl border border-ink-border bg-ink p-6 sm:p-8">
      <VerdictGauge score={overallScore} verdict={verdict} headline={headline} animate={animate} />

      <div className="grid gap-6 rounded-2xl border border-ink-border bg-ink-surface p-6 lg:grid-cols-[1fr_1.1fr]">
        <ScoreRadar scores={scores} />
        <ScoreList scores={scores} />
      </div>

      <MarketPanel market={market} />
      <SignalsPanel goSignals={goSignals} stopSignals={stopSignals} />
      <SourcesPanel sources={sources} />

      <p className="font-mono text-[11px] leading-relaxed text-ink-muted">
        Overall score is the average of the 8 factors above — not a separate model judgment. Market
        figures are labeled estimates, not verified data.
      </p>
    </div>
  );
}
