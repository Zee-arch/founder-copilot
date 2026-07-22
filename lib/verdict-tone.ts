import type { Verdict } from "@/lib/types";

// Shared verdict/score color mapping — was duplicated in Snapshot.tsx and
// ReportCard.tsx (a "third place needs it" was already flagged as the
// trigger to consolidate; ReportComparison.tsx became that third place).
export type Tone = "go" | "refine" | "pivot";

export function tierForScore(score: number): Tone {
  if (score >= 70) return "go";
  if (score >= 45) return "refine";
  return "pivot";
}

export const VERDICT_TONE: Record<Verdict, Tone> = {
  GO: "go",
  REFINE: "refine",
  PIVOT: "pivot",
};

export const TONE_COLOR: Record<Tone, string> = {
  go: "var(--color-signal-go)",
  refine: "var(--color-signal-refine)",
  pivot: "var(--color-signal-pivot)",
};

export const TONE_DIM: Record<Tone, string> = {
  go: "var(--color-signal-go-dim)",
  refine: "var(--color-signal-refine-dim)",
  pivot: "var(--color-signal-pivot-dim)",
};
