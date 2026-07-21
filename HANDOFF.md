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

**2026-07-18**: Phase 4 — redesigned the landing page hero into two
columns: the input form, plus a `ReportPreviewCard` reusing the real
`VerdictGauge` component (exported from `Snapshot.tsx`) seeded with fixed
sample data and clearly tagged "Example report" — an honest product
screenshot, not an invented mockup. Added a "What you get" feature strip
(reuses `REPORT_STEPS`), a CSS-only entrance animation, and the site's
first `Footer`. `components/Footer.tsx` is new; not yet added to
`how-it-works`/`about`.

**2026-07-18**: Stage 1 of real accounts — the founder decided to move
past the "no login" v1 spec and add sign-up/login. Chose **Supabase**
(Google OAuth + email/password) over Clerk and NextAuth+Vercel Postgres.
Scoped deliberately: **this pass only ships the auth foundation**, not
persistence — `app/api/generate/route.ts` and `lib/report-context.tsx`
are untouched, so generating a report while signed out still works exactly
as before (the "No login required" badge stays true). See the new
"Accounts (Supabase)" architecture section and "Decisions worth knowing"
below for what shipped and the production gotchas found along the way.
Both this and the Phase 4 landing redesign are merged to `main` and live
on Vercel.

**2026-07-21:** Diagnosed the "Invalid login credentials" issue from
2026-07-18 by querying `auth.users`/`auth.identities` directly on the live
Supabase project. **Not a bug** — the founder's main email
(`zaeemather7@gmail.com`) was originally signed up via Google OAuth only,
so it has no password credential; `signInWithPassword` against it will
correctly fail every time. A different test account
(`zaeemather7+foundercopilot@gmail.com`) does have a password identity and
logs in fine. No code change made. Worth knowing for the future: if a
"can't log in" report comes in again, check which provider(s) an account
actually has before assuming the auth code is broken.

**2026-07-21:** Stage 2 — reports now actually persist and are browsable.
`app/api/generate/route.ts` checks `supabase.auth.getUser()` after a
successful generation and, if signed in, inserts `{ user_id, idea, report }`
into the `reports` table (RLS already restricted this to the owning user
since Stage 1). This is deliberately **best-effort**: the insert is wrapped
in its own try/catch and only `console.error`s on failure — a DB hiccup
must never turn a successful generation into a failed response. Anonymous
generation is untouched (`getUser()` returns null, insert is skipped
entirely).

New `/dashboard` (`app/dashboard/page.tsx`, server component) redirects
signed-out visitors to `/login?next=/dashboard`, otherwise lists the
signed-in user's saved reports (idea, date, score, verdict badge) via
`components/dashboard/ReportCard.tsx`. Clicking a card doesn't fetch
anything new — it calls the existing `useReport().setReportData()` and
routes to `/report/summary`, reusing the exact same `sessionStorage`-backed
context and step UI that a fresh generation uses. No new report-viewing
code path was built.

Added `next` redirect support end-to-end so a signed-out visit to a
protected route (right now just `/dashboard`) returns there after auth:
`AuthForm` takes an optional `next` prop threaded through to both the
password-login redirect and Google's `redirectTo`; `/login` and `/sign-up`
read `?next=` from `searchParams` and pass it down; `/auth/callback`
already supported `next` from Stage 1 and needed no changes.
`SiteHeader`'s signed-in state now also shows a "Dashboard" link.

**Not yet verified in a real browser session** — this pass was typechecked
and the signed-out redirect (`/dashboard` → `/login?next=/dashboard`) was
confirmed live, but the actual signed-in path (generate while logged in →
row appears in `reports` → shows on `/dashboard` → clicking it opens the
right report) needs a real login, which requires a password Claude
doesn't have and won't ask for. **Founder: please click through this once**
before treating Stage 2 as done — see "Immediate next steps" below.

**2026-07-21 (later still):** Swapped the generation API from Claude to
**Google Gemini** (`gemini-3.5-flash`), and **turned off web search
grounding entirely** — both the founder's explicit choice, purely to stop
burning paid API credits while iterating on features. Not a quality
decision: once the product is feature-complete, the founder wants to
re-compare providers (including Claude) for actual output quality before
picking one for real. `app/api/generate/route.ts` now uses the
`@google/genai` SDK (`GoogleGenAI.models.generateContent`) with
`responseMimeType: "application/json"` instead of the Anthropic SDK's
`messages.create` + a `web_search` tool + pause-turn continuation loop —
all of that Claude/search-specific machinery is gone from the route, not
just swapped. `lib/parse-report.ts` and `lib/types.ts` didn't need
structural changes — the JSON contract they validate is provider-agnostic
by design, only a couple of stale "Claude"-specific comments/error
messages were reworded. `lib/prompt.ts`'s web-search rules were replaced
with a plain "you don't have web access, use labeled estimates" rule, and
the model is now told to always return `"sources": []`.

Because grounding is off, `sources` will be an empty array on every report
until it's turned back on for some provider — this is expected, not a
regression. `components/LandingPage.tsx`'s trust badges and multi-step
loading copy previously said "Grounded with live web search" and "Powered
by Claude"; both were now **false claims** the moment the swap happened,
so they were changed to "Powered by AI" / "8-factor scoring" and the
loading steps were shortened (no more ~130s "searching" phase) —
otherwise the UI would have been actively lying about what it does, which
directly violates this project's own "stay strict on data honesty" rule.
`maxDuration` on the route dropped from 280s to 60s since there's no
multi-minute search loop to wait out anymore.

**Not run end-to-end** — no `GEMINI_API_KEY` exists yet anywhere (checked
`.env.local`: only the old `ANTHROPIC_API_KEY` and Supabase keys are
there). Typechecked clean, and the request path was verified live up to
the point of calling Gemini — submitting the form correctly surfaced
"Gemini API key is missing. Add GEMINI_API_KEY to your .env.local file and
restart the server." with no crash, confirming the wiring is right. **The
founder needs to get a free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey), add
`GEMINI_API_KEY=...` to `.env.local`, and run one real generation** before
this is considered actually working — model output quality/JSON
reliability for `gemini-3.5-flash` on this exact prompt is completely
unverified.

## Architecture

- Next.js 15 (App Router), TypeScript, Tailwind v4 (CSS-first config in
  `app/globals.css` via `@theme`, not a `tailwind.config.js`)
- One API route: `app/api/generate/route.ts` — calls the model (currently
  Gemini, see status log), rate-limits by IP, validates input length,
  returns the parsed report
- `lib/prompt.ts` — the system prompt, requests a specific JSON shape
- `lib/parse-report.ts` — defensively parses and validates the model's
  JSON, provider-agnostic by design. **Important**: it computes
  `overallScore` and `verdict` itself from the 8
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
- **Historical, currently inactive (as of 2026-07-21):** the route used to
  call Claude with a `web_search_20260318` tool (`allowed_callers:
  ["direct"]` to skip a slow dynamic-filtering path — 8 minutes vs. ~2-3
  for a single report), `max_uses: 4`, `maxDuration = 280`, and
  concatenated every `text` content block in the response (web search's
  citation mechanism could split the JSON output across several blocks —
  keeping only the first silently truncated it on some requests). All of
  this was removed, not just disabled, when the route switched to Gemini
  with search off — see the 2026-07-21 status log entry for why and what
  it was replaced with. Kept here so re-adding search grounding later
  (to Claude, Gemini, or otherwise) doesn't require rediscovering these
  gotchas from scratch.

## Accounts (Supabase) — Stage 1 & 2

- `lib/supabase/client.ts` / `lib/supabase/server.ts` / `lib/supabase/middleware.ts`
  + root `middleware.ts` — standard `@supabase/ssr` session wiring (not the
  deprecated `@supabase/auth-helpers-nextjs`). Next.js 15's `cookies()` is
  async — `createClient()` in `server.ts` is itself async because of this.
  `middleware.ts`, not `proxy.ts` — this app is on Next 15, `proxy.ts` is
  the Next 16 convention some current Supabase examples default to.
- `components/AuthForm.tsx` — shared client form for both `/login` and
  `/sign-up`, Google OAuth + email/password. `app/actions/auth.ts` holds
  the server actions (`signOut`, `confirmEmailSignup`).
- `app/auth/callback/route.ts` — OAuth `code` exchange (Google).
- `app/auth/confirm/page.tsx` — **a page, not a route handler.** Email/
  password confirmation used to auto-verify on the GET request that loaded
  it; real-world testing found Gmail's spam-link scanner (and similar
  automated scanners on other providers) silently visits links in incoming
  mail, which burned the single-use token before the actual user clicked
  it — the person saw a false "invalid or expired" error even though the
  account really was confirmed. Fixed by making the GET just render a
  "Confirm email address" button, with the actual `verifyOtp` call only
  happening on the POST (a Server Action, `confirmEmailSignup` in
  `app/actions/auth.ts`) that the button triggers. **Any future
  email-link flow in this app must follow the same rule: the GET that
  loads the page must never have a side effect.**
- `components/SiteHeader.tsx` — now reads the session server-side and
  shows signed-in state (email + sign-out) vs. Log in/Sign up links.
- `supabase/schema.sql` — a `reports` table (id, user_id, idea, report
  jsonb, created_at) with RLS restricting rows to `auth.uid() = user_id`.
  As of Stage 2, `app/api/generate/route.ts` inserts into it for signed-in
  users (best-effort, never blocks the response — see status log above).
- `app/dashboard/page.tsx` — lists a signed-in user's saved reports
  (server component, redirects to `/login?next=/dashboard` if signed out).
  `components/dashboard/ReportCard.tsx` — clicking a saved report doesn't
  re-fetch anything; it calls `useReport().setReportData()` and routes to
  `/report/summary`, reusing the same context + step UI a fresh generation
  uses. Verdict badge styling (`TONE_COLOR`/`TONE_DIM` by verdict) is
  duplicated from `Snapshot.tsx` rather than imported — those constants
  aren't exported there and it's 3 lines; revisit if a third place needs
  the same mapping.
- `next` redirect support was added to the auth flow so a signed-out visit
  to a protected route returns there after login: `AuthForm` takes an
  optional `next` prop (default `/`) used for both the password-login
  redirect and Google's `redirectTo`; `/login` and `/sign-up` read `?next=`
  from `searchParams`. `/auth/callback` already supported this from Stage 1.
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (documented in `.env.local.example`). No service-role key used anywhere —
  RLS + the user's own JWT is sufficient for everything shipped so far.
- **Production email gotchas, worth knowing before touching this again:**
  - Supabase's *default* (no custom SMTP) email templates put the confirm
    token in a URL hash fragment (`#access_token=...`), which a
    server-side route can never read (fragments never reach the server).
    Custom SMTP is required to even edit the template body — Supabase's
    dashboard locks template editing behind having custom SMTP configured.
    Ended up on **Resend** (free tier). The "Confirm signup" template body
    must use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`,
    not the default `{{ .ConfirmationURL }}` — and not `{{ .SiteURL }}`
    either, since that's a single global setting that would break either
    local dev or production depending which one it's pointed at;
    `{{ .RedirectTo }}` correctly resolves to wherever the signup actually
    happened.
  - Resend's free/onboarding sender (`onboarding@resend.dev`) will **only
    deliver to the exact email address the Resend account itself is
    registered under** — not `+alias` variants of it. Silently 403s
    (visible in Resend's own logs, not surfaced to Supabase's client
    response) for anything else. Don't burn time re-debugging this; it's
    expected until a real domain is verified in Resend.
  - Supabase's Auth API returns `200`/success to the client for
    `signUp`/`resend` calls **even when it doesn't actually send anything**
    — e.g. when the email already belongs to a confirmed user (via any
    provider, including Google) — to avoid leaking which emails are
    registered. If testing shows a "successful" response but nothing ever
    arrives and nothing shows in Resend's logs, check
    Authentication → Users for an existing confirmed account with that
    email before assuming SMTP is broken.

## Decisions worth knowing before you change them

- **Model**: `gemini-3.5-flash` via `@google/genai`, as of 2026-07-21 — a
  deliberate, temporary, cost-driven swap off Claude while iterating on
  features (see status log). Web search grounding is off. Verify the model
  name is still current/free-tier before assuming it (check
  ai.google.dev/gemini-api/docs/pricing), and don't assume this is the
  final provider choice — the founder wants to re-compare Claude/Gemini/
  others on actual output quality once the product is feature-complete.
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
  the model's own labeled estimates, not verified data (more so than ever
  now that web search is off — see status log). The prompt explicitly
  forbids fabricating false-precision numbers. Keep the "(estimate)"
  framing in the UI — don't let it drift into looking like sourced data.
- **Competitor profiles are qualitative only** — name, one-line description,
  one strength, one weakness. The prompt explicitly tells the model not to
  include funding amounts, valuations, or user counts for competitors,
  since those can't be verified here and go stale immediately. Don't add
  those fields back without re-opening the "stay strict" conversation.
- **Accounts now exist (Stage 1, 2026-07-18) — the "no login" v1 spec has
  been deliberately superseded, don't assume the old README/spec wording
  is still current.** See "Accounts (Supabase)" above. Generation itself
  is still unauthenticated and un-gated on purpose — signing in is
  additive, not a requirement. `lib/report-context.tsx`'s `sessionStorage`
  behavior is unchanged. As of Stage 2 (2026-07-21), signed-in generation
  does write to the `reports` table — see "Accounts (Supabase)" above.

## What's untested

As of 2026-07-17, the full 5-step report journey, both marketing pages, web
search grounding, and PDF export were all visually confirmed by an AI in a
real browser session (desktop width only — not yet checked at mobile
width), including a real Claude-generated report on both localhost and the
live Vercel deployment, a real PDF download, and manually opening several
of the returned `sources` URLs to confirm they're real pages (not
hallucinated). Not yet re-verified by the founder in his own browser.

As of 2026-07-18: Google OAuth sign-in verified working end-to-end in
production (a real user was created and signed in). Email/password
sign-up + the hardened click-to-confirm flow verified working end-to-end
locally. Password login itself against a real email/password account has
still not been directly re-tested in production (see 2026-07-21 diagnosis
above for why the original test looked broken but wasn't) — worth a real
click-through before considering the email/password path fully verified
in production.

As of 2026-07-21: Stage 2 (report persistence + `/dashboard`) is
typechecked and the signed-out redirect was confirmed live, but **the
signed-in path itself is unverified** — needs a real login, which requires
a password Claude doesn't have. Founder, please click through once:
log in → generate a report → confirm a row appears in Supabase's `reports`
table (Table Editor) → visit `/dashboard` → confirm it's listed → click it
→ confirm it opens the same report at `/report/summary`.

As of 2026-07-21 (Gemini swap): **completely unrun.** No `GEMINI_API_KEY`
exists in `.env.local` yet. Typechecked and the "key missing" error path
was confirmed live, but zero real Gemini output has been seen — not the
JSON reliability, not whether `gemini-3.5-flash` reliably follows the
10-section/8-score/exact-shape prompt, nothing. Treat report quality as
completely unknown until a real key is added and a real generation runs.

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

1. **Founder: get a free `GEMINI_API_KEY` and run one real generation.**
   Nothing about the Gemini swap has been verified beyond "it typechecks
   and fails cleanly without a key" — see "What's untested" above. Get a
   key at aistudio.google.com/apikey, add it to `.env.local`, run
   `npm run dev`, and try a real idea. Also add the same key to Vercel's
   env vars before deploying this branch, or production will break.
2. **Founder: verify Stage 2 signed-in path for real** (see "What's
   untested" above) — code is written and typechecked but the actual
   generate → persist → dashboard → reopen loop has not run with a real
   session.
3. The four utility ideas discussed but not started: standalone
   calculators (LTV/CAC/break-even/runway), a "recalculate with your
   numbers" override on financials, an interactive milestone checklist on
   Roadmap, and a risk-matrix visualization for the stop signals. Now that
   `/dashboard` exists, these can be built dashboard-native as originally
   planned.
4. Possibly upgrade PDF export to real selectable text.
5. Harden rate limiting before any wider traffic. Generation should be
   faster now with search off (unverified — see above); re-check whether
   8 req/hour still makes sense once real timing is known. The in-memory
   rate limiter (`lib/rate-limit.ts`) resets on every Vercel serverless
   cold start — live, not hypothetical, now that this is actually deployed.
6. Mobile-width visual check for the report journey + marketing pages —
   not yet done by an AI or the founder.
7. Fill in the real name on the MIT `LICENSE` file if it ever needs to
   change (currently "Zaeem Ather").
8. **Once the product is feature-complete, re-compare LLM providers**
   (Claude vs. Gemini vs. others) on actual output quality for this exact
   prompt/JSON contract, and decide for real — the Gemini swap was a
   cost-saving move during development, not a quality judgment. Revisit
   whether web search grounding comes back too.
9. **Strategic pivot (2026-07-18):** the founder wants to step back from
   feature-by-feature execution and think about product direction more
   holistically before continuing — where the product needs to reach,
   working backward from there, and how to use AI more deeply in the
   product itself (not just as the report-generation engine). Worth
   reading README.md's "founder operating system" long-term vision before
   that conversation, and considering whether future features (PRDs,
   landing pages, decks) bolt onto the current one-shot-report data model
   or need a more unified per-idea workspace.

## Working with the founder

Non-technical (business background, no real coding experience) — relies on
AI to write all code. Prefers direct, explicit, step-by-step terminal
instructions over conceptual explanations. Wants honest engineering
tradeoffs stated plainly (like the PDF limitation above), not glossed over.
