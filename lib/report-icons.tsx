import {
  AlertTriangle,
  BarChart3,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Clock,
  Coins,
  Compass,
  FlaskConical,
  Flame,
  Gauge,
  Gavel,
  Globe2,
  Hammer,
  LayoutGrid,
  Map,
  Megaphone,
  MessagesSquare,
  Rocket,
  ScrollText,
  Share2,
  ShieldAlert,
  Swords,
  Target,
  Terminal,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { MilestonePhase, ReportSectionTitle, ScoreCriterionLabel, Verdict } from "@/lib/types";

export const BRAND_ICON = Compass;

export const SCORE_CRITERION_ICONS: Record<ScoreCriterionLabel, LucideIcon> = {
  "Problem Urgency": Flame,
  "Market Size": Globe2,
  "Market Timing": Clock,
  "Competitive Advantage": Swords,
  "MVP Feasibility": Wrench,
  "Capital Efficiency": Coins,
  "Regulatory Ease": Gavel,
  "Revenue Clarity": Wallet,
};

export const REPORT_SECTION_ICONS: Record<ReportSectionTitle, LucideIcon> = {
  "Market Analysis": BarChart3,
  "Problem Statement": AlertTriangle,
  ICP: Users,
  TAM: Globe2,
  Competitors: Swords,
  SWOT: LayoutGrid,
  "Revenue Model": Wallet,
  MVP: Rocket,
  "Go-To-Market": Megaphone,
  Risks: ShieldAlert,
};

export const VERDICT_ICONS: Record<Verdict, LucideIcon> = {
  GO: CircleCheck,
  REFINE: CircleAlert,
  PIVOT: CircleX,
};

export const MILESTONE_PHASE_ICONS: Record<MilestonePhase, LucideIcon> = {
  Validate: FlaskConical,
  Build: Hammer,
  Launch: Rocket,
  Distribute: Share2,
};

export const REPORT_STEPS = [
  { key: "summary", label: "Summary", icon: Gauge },
  { key: "financials", label: "Financials", icon: CircleDollarSign },
  { key: "roadmap", label: "Roadmap", icon: Map },
  { key: "competitors", label: "Competitors", icon: Target },
  { key: "validate", label: "Validate", icon: MessagesSquare },
  { key: "build", label: "Build Brief", icon: Terminal },
  { key: "full", label: "Full Report", icon: ScrollText },
] as const;

export type ReportStepKey = (typeof REPORT_STEPS)[number]["key"];
