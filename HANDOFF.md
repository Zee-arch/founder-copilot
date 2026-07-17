# FounderCopilot — Handoff Notes

Read this before making changes. It covers the decisions and context that
aren't visible just from reading the code.

## What this is

An AI co-founder tool for non-technical founders. v1 scope (current):
founder types a startup idea, clicks Generate, gets a full validation report.
See `README.md` for the long-term roadmap (PRD generation, landing pages,
marketing plans, investor decks — all later phases, not started).

## Current status

v1 works end-to-end and has been tested with a real Anthropic API key by the
founder (not just mocked). Runs locally via `npm run dev`.

**2026-07-17 (later same day):** Git set up, pushed to GitHub at
`github.com/Zee-arch/founder-copilot` (public — the founder wants to
showcase this as his own project for job applications), and deployed to
Vercel at `founder-copilot-flame.vercel.app`. Live deploy end-to-end tested
in a real browser (generate → full 5-step report) with the real
`ANTHROPIC_API_KEY` set in Vercel's dashboard by the founder himself (never
entered by AI, per policy). README rewritten for a technical/recruiter
audience — includes an honest one-line disclosure that development was
AI-assisted (Claude Code).

**2026-07-14**: Did a visual-polish pass (Phase 1 of closing the design gap
with ideaproof.io — see "Competitive benchmark" below). Added `lucide-react`
icons throughout, a hero background treatment + trust badges + multi-step
loading indicator on the landing page, an animated verdict gauge and icon
chips on Snapshot, and a sticky jump-nav + per-section icons on FullReport.
Visually verified end-to-end in a real browser session (not just typecheck),
including a real Claude-generated report and a PDF export. Decision made
with the founder before starting: **stay strict on data honesty** — no
ideaproof-style "live-looking" panels dressing up AI output as real-time
verified data; only genuine, clearly-labeled content.

**2026-07-17**: Phase 2 — added the three new report sections (financials,
roadmap, competitive landscape) as genuinely new structured AI-generated
data, turned the report into a 5-step journey with a real URL per step
(`/report/summary`, `/report/financials`, `/report/roadmap`,
`/report/competitors`, `/report/full`), and added two marketing pages
(`/how-it-works`, `/about`) with a shared nav. Same "stay strict" rule
applied to the new content: competitor cards are qualitative only (name,
description, strength, weakness) — no invented funding/valuation/user-count
figures, since those can't be verified and go stale immediately. No pricing
page — monetization is still an open decision, not assumed.

**2026-07-17 (later still)**: Phase 3 — gave Claude the API's server-side
`web_search` tool (`web_search_20260318`) so market sizing, competitors,
and financial benchmarks are grounded in real, current pages instead of
pure trained-knowledge guesses. Claude self-reports the real URLs it used
in a new `sources` field, rendered as a clickable Sources panel on the
Summary step. Deliberately did **not** wire up the API's native per-span
`citations` mechanism (built for annotating prose, not structured JSON) —
simpler and just as honest to have Claude self-report a flat sources list,
same trust tier as everything else (never hard-throws, filtered on the way
in). Verified for real — not just "the code compiles" — by opening several
of the returned URLs and confirming the page titles match the claimed
labels. See "Decisions worth knowing" for the `allowed_callers: ["direct"]`
latency fix that came out of this.

## Architecture

- Next.js 15 (App Router), TypeScript, Tailwind v4 (CSS-first config in
  `app/globals.css` via `@theme`, not a `tailwind.config.js`)
- One API route: `app/api/generate/route.ts` — calls Claude, rate-limits by
  IP, validates input length, returns the parsed report
- `lib/prompt.ts` — the system prompt, requests a specific JSON shape
- `lib/parse-report.ts` — defensively parses and validates Claude's JSON.
  **Important**: it computes `overallScore` and `verdict` itself from the 8
  factor scores — it does NOT trust a score/verdict from the model directly.
  Don't change this without a good reason; it's what makes the score
  defensible ("the math is checkable") rather than a black box. The
  financials/roadmap/competitive fields follow the same "never fabricate,
  fall back gracefully" tier as market sizing, not the hard-throw tier that
  scores/sections use.
- `lib/types.ts` — schema + the single source of truth for section titles
  and score criteria (`REPORT_SECTION_TITLES`, `SCORE_CRITERIA`), plus the
  `Financials` / `Roadmap` / `CompetitiveLandscape` types added in Phase 2.
- `lib/report-context.tsx` — `ReportProvider` / `useReport()`. Holds the
  current `{ idea, report }` in React state, persisted to `sessionStorage`
  so a hard refresh on a `/report/*` URL doesn't lose it (no accounts, no
  database — this is intentionally client-only, per the v1 "no login"
  spec). `report` and `isHydrated` are combined into **one** state object,
  not two separate `useState` calls — that was a real race: a redirect
  effect elsewhere could see `isHydrated: true, report: null` for one
  frame if hydration landed as two renders. Don't split them back apart.
- `components/LandingPage.tsx` (rendered by `app/page.tsx`) — input form +
  fetch orchestration. On success, stores the report in `ReportProvider`
  and routes to `/report/summary`; no longer renders the report inline.
- `app/report/layout.tsx` — the report shell: idea-analyzed banner, 5-step
  nav (real `<Link>`s to `/report/{step}`), Download PDF button. Redirects
  to `/` if `useReport()` has no report once hydrated.
- `app/report/[step]/page.tsx` + `components/report/StepContent.tsx` — the
  dynamic step route renders `<ReportStepContent step={step} report={...} />`,
  a single switch shared between the visible route and the PDF export path
  below, so the step→component mapping only lives in one place.
- `components/report/Snapshot.tsx` — verdict gauge (hand-rolled SVG, animated
  count-up), radar chart (recharts), market sizing panel, go/stop signals.
  Takes an `animate?: boolean` prop (default `true`) — set to `false` when
  rendered off-screen for PDF export; see the PDF note below for why.
- `components/report/Financials.tsx`, `Roadmap.tsx`, `CompetitiveLandscape.tsx`
  — the three new Phase 2 sections, same dark "instrument panel" styling as
  Snapshot (data/card-driven, as opposed to FullReport's light prose style).
- `components/report/FullReport.tsx` — the 10 prose sections, light
  background (deliberately different from Snapshot's dark panel — long
  prose is more readable on light, short data readouts work on dark). Has
  a sticky jump-nav (anchor links to each section) and a per-section icon.
- `lib/report-icons.tsx` — the single shared icon lookup (lucide-react) for
  score criteria, report sections, verdicts, milestone phases, and the
  5-step `REPORT_STEPS` list (key/label/icon) that both the step nav and
  the PDF export loop iterate over.
- `lib/pdf.ts` — client-side PDF export via **html2canvas-pro** (not plain
  `html2canvas` — see below) + jsPDF. Exports `createReportPdf` /
  `addElementAsPages` / `saveReportPdf` as separate steps so the caller can
  capture each panel immediately after it's actually rendered, not after
  something else has already replaced it in the DOM.
- **PDF export does not drive real route navigation.** `app/report/layout.tsx`
  renders all 5 steps into an off-screen container (`position: fixed;
  left: -9999px`) via the same `ReportStepContent` used by the visible
  route, and captures those refs directly. This was a deliberate fix, not
  the original design — driving capture through `router.push()` per step
  raced Next.js's route transition (a first-visit segment fetch can take
  longer than a couple of animation frames), so html2canvas sometimes
  captured stale/mid-transition DOM and threw. Rendering everything
  off-screen up front sidesteps the race entirely.
- **`app/api/generate/route.ts` uses `web_search_20260318` with
  `allowed_callers: ["direct"]`, not the tool's default.** The default for
  this tool version routes every search through dynamic filtering (code
  execution under the hood) — measured over **8 minutes** for a single
  report with the default before switching. `["direct"]` skips that and
  brought it to ~2-3 minutes. We don't need dynamic filtering's
  context-trimming benefit since the final output is compact structured
  JSON, not long prose quoting search results. `max_uses: 4`,
  `export const maxDuration = 280` on the route (Vercel would otherwise
  kill the function before a search-heavy generation finishes — verified
  live on the actual Vercel deployment, not just locally, since dev mode
  doesn't enforce that timeout at all).
- **Text-block concatenation in the API route is load-bearing, not
  defensive.** Web search's citation mechanism can split Claude's single
  JSON response across multiple sequential `text` content blocks (confirmed
  against Anthropic's live docs). The route concatenates every `text` block
  in `response.content`, not just the first — taking only the first would
  silently truncate the JSON on some requests.

## Decisions worth knowing before you change them

- **Model**: `claude-sonnet-4-6` (current stable Sonnet as of July 2026 —
  verify this is still current before assuming it, models change).
- **Rate limiting** (`lib/rate-limit.ts`): in-memory, per-IP, 8 req/hour.
  Deliberately basic — fine for friends testing, NOT durable on serverless
  (resets on cold start) or across multiple instances. If this gets real
  traffic, swap for a shared store (e.g. Upstash Redis) before relying on it.
- **PDF export is screenshot-based**, not a true text PDF. It photographs
  the rendered report (html2canvas-pro) and places that image into a PDF
  (jsPDF). Looks right, but text inside isn't selectable/searchable. A real
  text PDF would mean generating it from the data directly (e.g.
  `@react-pdf/renderer`) instead of screenshotting — bigger rework, not done.
- **Uses `html2canvas-pro`, not `html2canvas`.** Tailwind v4's entire
  default color palette (and any `color-mix()`-based opacity utility, e.g.
  `bg-brand/10`) computes to `oklch()`/`oklab()` in the browser. Plain
  `html2canvas` predates the CSS Color 4 spec and throws
  `Attempting to parse an unsupported color function` on those — this is a
  real, reproducible Tailwind v4 + html2canvas incompatibility, not
  specific to this app. `html2canvas-pro` is a maintained fork with the
  same API that added support for it. Don't swap back to `html2canvas`
  without re-testing PDF export.
- **Market sizing (TAM/SAM/SOM), financials, and roadmap figures** are
  Claude's own labeled estimates, not verified data. The prompt explicitly
  forbids fabricating false-precision numbers. Keep the "(estimate)"
  framing in the UI — don't let it drift into looking like sourced data.
- **Competitor profiles are qualitative only** — name, one-line description,
  one strength, one weakness. The prompt explicitly tells Claude not to
  include funding amounts, valuations, or user counts for competitors,
  since those can't be verified here and go stale immediately. Don't add
  those fields back without re-opening the "stay strict" conversation.
- **No user accounts / no login** — this is intentional per the original
  v1 spec (`V1_SPEC.md`), not an oversight. Report state lives in
  `sessionStorage` via `lib/report-context.tsx`, not a database.

## What's untested

As of 2026-07-17, the full 5-step report journey, both marketing pages, web
search grounding, and PDF export were all visually confirmed by an AI in a
real browser session (desktop width only — not yet checked at mobile
width), including a real Claude-generated report on both localhost and the
live Vercel deployment, a real PDF download, and manually opening several
of the returned `sources` URLs to confirm they're real pages (not
hallucinated). Not yet re-verified by the founder in his own browser.

## Competitive benchmark

The founder is comparing this against **ideaproof.io**, a competing idea
validation SaaS. IdeaProof has: a credits/paywall model, a multi-stage
"journey" (Idea Validation → Market Analysis → Business Plan → Brand
Strategy → Visual Identity), and dedicated Financials/Unit-Economics and
Roadmap/Action-Plan pages. As of Phase 2, FounderCopilot now has its own
5-step journey (Summary → Financials → Roadmap → Competitors → Full Report)
plus marketing pages, closing most of the structural gap. Still missing
vs. ideaproof: Brand Strategy/Visual Identity generation, and any
monetization gating. Whether to add a paywall at all still hasn't been
decided — weigh it against the "no login" v1 spec above before assuming
it's wanted.

## Immediate next steps (discussed, not yet done)

1. Possibly upgrade PDF export to real selectable text.
2. Harden rate limiting before any wider traffic — generation now takes
   ~2-3 minutes (search-heavy, up from ~90s), worth re-checking the
   8 req/hour window still makes sense. The in-memory rate limiter
   (`lib/rate-limit.ts`) resets on every Vercel serverless cold start —
   live, not hypothetical, now that this is actually deployed.
3. Mobile-width visual check for the report journey + marketing pages —
   not yet done by an AI or the founder.
4. Fill in the real name on the MIT `LICENSE` file if it ever needs to
   change (currently "Zaeem Ather").
5. The four other utility ideas discussed but not started: standalone
   calculators (LTV/CAC/break-even/runway), a "recalculate with your
   numbers" override on financials, an interactive milestone checklist on
   Roadmap, and a risk-matrix visualization for the stop signals.

## Working with the founder

Non-technical (business background, no real coding experience) — relies on
AI to write all code. Prefers direct, explicit, step-by-step terminal
instructions over conceptual explanations. Wants honest engineering
tradeoffs stated plainly (like the PDF limitation above), not glossed over.
