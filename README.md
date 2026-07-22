# FounderCopilot

**An AI co-founder that turns a one-sentence startup idea into a full validation report — market sizing, financials, a roadmap, competitive landscape, and a defensible GO/REFINE/PIVOT score.**

🔗 **Live demo:** [founder-copilot-flame.vercel.app](https://founder-copilot-flame.vercel.app/)

---

## What it does

Type a startup idea in one sentence. FounderCopilot scores it across 8 independent factors with an LLM, then generates a 7-part report:

| Step | What's in it |
|---|---|
| **Summary** | Overall score + verdict, radar chart of the 8 factors, TAM/SAM/SOM, go/stop signals |
| **Financials** | Startup cost, break-even estimate, CAC/LTV, LTV:CAC ratio, revenue streams |
| **Roadmap** | MVP timeline, phased milestones (Validate → Build → Launch → Distribute), quick wins |
| **Competitors** | Named competitors with qualitative strengths/weaknesses, plus sourced funding/valuation/user-count figures when a real citation backs them |
| **Validate** | A customer interview guide, cold outreach email drafts, and pre-sell landing copy — starting drafts for validating with real people, not just AI |
| **Build Brief** | Suggested MVP scope, a reasoned (not default) tech stack, and a paste-ready starter prompt for Claude Code/Cursor — a brief, not generated code |
| **Full Report** | 10-section prose write-up (market, ICP, SWOT, GTM, risks, and more) |

Each step has its own URL, the whole report exports to a PDF, and there's no login or account required.

## A design principle that shaped the engineering

The overall score isn't a black box: it's **computed in application code from the 8 individual factor scores**, never trusted directly from the model. Market sizing and financials are always labeled as estimates rather than dressed up to look like verified data. Competitor profiles are qualitative by default — a funding, valuation, or user-count figure only ever appears when it's cross-checked in code against a real source the model actually retrieved via web search that session; an unsourced or invented figure is structurally impossible to render, not just discouraged by a prompt. That constraint shaped several implementation decisions below.

## Notable engineering decisions

- **Defensive parsing, tiered by criticality** — the model's JSON response is parsed with different failure behavior per field: the 8 scores and 10 prose sections hard-fail if malformed (they're load-bearing), while market/financials/roadmap/competitor data degrades gracefully to labeled fallbacks instead of crashing the whole report.
- **No database, but real per-step URLs** — the report journey (`/report/summary`, `/report/financials`, …) uses real Next.js routes backed by a `sessionStorage`-persisted React context, not a database — appropriate for a no-login v1, while still being bookmarkable/shareable within a session and resilient to a hard refresh mid-report.
- **PDF export renders off-screen, not through routing** — an earlier version drove PDF capture by navigating through each report route and screenshotting it; that raced Next.js's route transitions and sometimes captured stale content. It now renders all 5 steps into an off-screen container up front and captures directly, which is both more reliable and faster.
- **`html2canvas-pro`, not `html2canvas`** — Tailwind v4's default color palette computes to `oklch()`/`oklab()`, which the unmaintained `html2canvas` can't parse. Swapped to a maintained fork with the same API.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Recharts · Google Gemini API · Supabase (auth) · jsPDF + html2canvas-pro · lucide-react

## Getting started

```bash
git clone https://github.com/zee-arch/founder-copilot.git
cd founder-copilot
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY (+ Supabase keys)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roadmap

| Phase | Status |
|---|---|
| Idea validation (score, market, financials, roadmap, competitors) | ✅ Shipped |
| PRD generation | Planned |
| Landing page generation | Planned |
| Marketing plans | Planned |
| Investor decks | Planned |

## How this was built

Built solo, with AI-assisted development (Claude Code) — I drove the product decisions, architecture, and design direction; Claude handled implementation under close review.

## License

MIT
