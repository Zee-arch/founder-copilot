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
**2026-07-21 (verified live once the founder added a real key):** Ran a
real generation end-to-end for the first time — "A subscription box that
ships pre-portioned spices for home cooks" scored 61/100 (REFINE), with a
coherent headline, all 8 factor scores/notes, a populated radar chart, all
10 full-report prose sections, financials, roadmap, and competitors all
rendering correctly on their respective step pages. `responseMimeType:
"application/json"` produced clean JSON on the first try — no parsing
failures seen. Confirmed the sources panel correctly stays hidden (empty
array, as instructed) rather than rendering empty.

**But this surfaced a real, current problem**: Gemini's free tier is
genuinely overloaded right now — three consecutive attempts before the
successful one all failed with a `503 UNAVAILABLE` ("This model is
currently experiencing high demand"), and even individual failed attempts
were taking **60-80 seconds** before erroring out (confirmed with a
standalone test script hitting the API directly, isolating it from any of
this app's own code). This is Google's server load, not a bug on our
side. Two fixes went in:
- `app/api/generate/route.ts` now retries once on a `503` specifically
  (checking the SDK's `ApiError.status`, not string-matching the message)
  with a short backoff, since Gemini's own error text says these spikes
  are "usually temporary." Anything else (bad key, quota exhausted,
  malformed request) still fails immediately — no blind retry-everything.
- **`maxDuration` was bumped from 60 back up to 150**, not left at the
  "no search, so it should be fast" assumption from earlier in this same
  session. A single overloaded attempt can itself take ~80s; with one
  retry plus backoff, the real successful request in testing took
  **124 seconds end to end**. 60s would have had Vercel kill the function
  mid-request. Also added a `friendlyErrorMessage()` helper so a 503/429
  shows the founder a plain-English message instead of the SDK's raw JSON
  error body (which is what the UI showed before this fix — genuinely
  ugly, confirmed via screenshot before fixing it).

**Still not fully known**: whether Gemini's free tier stays this
overloaded, or whether this was a temporary spike specific to when this
was tested. Don't be surprised if generation is slow/retries often for
now — that's expected given the above, not a regression. If it's
consistently this bad, worth reconsidering `MAX_MODEL_RETRIES` (currently
1) or the model choice before relying on this for anything real. Also
untested: report persistence to Supabase during this same real run (the
Stage 2 signed-in path is a separate, still-open verification item — see
below) — this test was run signed out.

**2026-07-21/22 (deploy + live verification):** All of the above had only
ever been committed **locally** — never pushed, never merged. This is why
the live Vercel site still showed "Powered by Claude" after the swap: the
code that changed it had never left the laptop. Fixed by actually pushing
and merging (PR #3, `https://github.com/Zee-arch/founder-copilot/pull/3`).

That merge surfaced a real conflict: the local `auth-foundation` branch
had been branched *before* the Phase 4 landing redesign (PR #1) was
merged into `main`, so it never had `Footer.tsx`, the two-column hero, or
`ReportPreviewCard` — and had been edited this whole session on a stale
copy of `LandingPage.tsx`. Resolved by merging `main` in and keeping this
branch's honest copy on top of Phase 4's layout (not by discarding either
side). That same merge surfaced **two more stale claims that existed only
on `main`**, invisible to the earlier Gemini-swap work because it never
had these files: How It Works' "Claude scores it honestly" step, and the
Footer's "grounded in live web search" line. Both rewritten the same way
as the LandingPage badges.

**Second production bug, found only by actually testing generation live**:
`maxDuration = 150` (set earlier this session based on one local
timing) was too low — a real request on Vercel got killed mid-retry,
and the frontend crashed with a raw "Unexpected token 'A'..." error
trying to `JSON.parse()` Vercel's own non-JSON timeout page. Fixed in
PR #4 (`https://github.com/Zee-arch/founder-copilot/pull/4`): `maxDuration`
back to **280** (the value already proven safe on this Vercel plan from
the old Claude+search era — reused instead of guessing a third number),
and `LandingPage.tsx`'s fetch handling now catches a non-JSON response
body and shows a real message instead of crashing on the parse.

**Confirmed live end-to-end on the actual production domain**
(`founder-copilot-flame.vercel.app`) after both fixes: "A marketplace
connecting local farmers directly with restaurants" scored 69/100
(REFINE), full report rendered correctly. Getting there took **5 attempts
on production** — 3× `503` high-demand, 1× the `maxDuration` timeout above,
then a success — consistent with local testing. **Gemini's free tier
overload is not a one-off blip; treat it as the current normal** until
proven otherwise. If report generation feels unreliable for users right
now, this is why — not a regression to chase.

**2026-07-22: Web search grounding restored — deliberately staying on
Gemini, not reverting to Claude.** Grounding was only ever turned off to
cut costs while iterating (2026-07-21 entry above), never a quality call,
and the founder flagged it as the single biggest gap versus every serious
competitor in this market. Researched both options before deciding:

- **Google Search grounding on Gemini** (chosen): 5,000 free grounded
  prompts/month, then $14/1,000
  ([source](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration)).
  At this app's actual volume (single digits to low tens of generations/day
  under the 8 req/hour/IP limit), 5,000/month is effectively unlimited —
  stays genuinely free during the iteration phase, which was the whole
  point of last week's swap.
- **Reverting to Claude's `web_search`** (rejected, for now): no free
  tier — $10 per 1,000 searches
  ([source](https://www.finout.io/blog/anthropic-api-pricing)) plus Sonnet
  4.6 tokens at $3/$15 per million
  ([source](https://www.cloudzero.com/blog/claude-api-pricing/)). Reverting
  would directly undo the cost problem the founder explicitly asked to
  solve one message earlier — he asked to close the grounding gap, not to
  resume spending. Revisit this choice once the product is
  feature-complete, per the founder's own stated plan (see "Immediate next
  steps").

**Real implementation cost of staying on Gemini, found via Google's own
docs, not guessed**: the `googleSearch` tool **cannot be combined with
`responseMimeType: "application/json"`** — confirmed against Google's
API docs and a GitHub issue on `googleapis/python-genai` (tool use and
native JSON mode are mutually exclusive on this API, full stop, not a
config quirk to work around). `app/api/generate/route.ts` now omits
`responseMimeType` when `tools` is present, falling back to the prompt's
own "return ONLY valid JSON" instruction plus `lib/parse-report.ts`'s
existing `extractJson()` fence/brace-matching — the exact mechanism the
original Claude+search version always used, so this isn't a new risk
class, just giving up the JSON-mode reliability boost gained during the
few days grounding was off.

**Sources are now built from Gemini's own `groundingMetadata`, not from
asking the model to self-report a `sources` field** — a deliberate
improvement over how the original Claude version worked. Claude's version
had the model write its own `sources: [{label, url}]` inside its JSON
response, trusted only as far as "the model claims this is a real URL."
Gemini's `response.candidates[0].groundingMetadata.groundingChunks[].web`
is structured data the API itself returns for pages it actually
retrieved — a stronger guarantee. `extractGroundingSources()` in
`route.ts` builds `Source[]` from that directly; the model is now told
**not** to output a `sources` field in its JSON at all
(`lib/prompt.ts`). `lib/parse-report.ts` and `lib/types.ts` needed no
structural changes — `Source`/`sources` were never removed from the
schema even while grounding was off, only the comments were reworded (see
2026-07-21 entry); this restoration just rewords them back and route.ts
now populates the field a different way than before.

Restored the landing page's honest badges/copy that were correctly
toned down when grounding went off: "Grounded with live web search" badge
back (`components/LandingPage.tsx`), Footer's "grounded in live web
search" line back (`components/Footer.tsx`), and the multi-step loading
indicator's "Searching the web for real data" step back with its ~130s
weight — reused from the last time this app had Claude+search rather than
invented, but **not yet re-measured for Gemini+grounding specifically**
(see below for why).

**Not yet live-verified — this is the real gap, be upfront about it.**
Implementation is typechecked, and the request path was confirmed live up
to the point of calling Gemini (submitting the form with the new
`tools: [{googleSearch: {}}]` config correctly reached the API and
surfaced a real `429` quota error cleanly, no crash) — but **no
successful grounded generation has been seen**, because today's
Gemini free-tier quota was already exhausted by the earlier testing in
this same session (confirmed via a standalone script:
`429 RESOURCE_EXHAUSTED`). That means none of the following are verified
yet: whether the model reliably still returns valid JSON without native
JSON mode, whether `groundingChunks` actually populates the way Google's
docs describe, whether the Sources panel renders correctly with real
data, and — the founder's own requested check — whether the returned
source URLs are real pages, not hallucinated. **Founder: once your quota
resets (check `ai.dev/rate-limit`), run one real generation and open a
couple of the Sources panel links yourself** before treating this as
done, the same way the original Claude+search grounding was verified
before being trusted.

**2026-07-22 (same day): competitor funding/valuation/user-count figures
allowed back in, but only when sourced.** The "Competitor profiles are
qualitative only" policy (see "Decisions worth knowing") was a direct
consequence of not having grounding — now that grounding is back, the
founder asked to allow these fields again, strictly gated on a real
source from this session's search, never training knowledge.

Implemented so a fabricated figure structurally can't reach the UI, not
just "the prompt asks nicely": `lib/types.ts` adds `SourcedFigure = {
value, source: Source }` — there is no type shape for "a figure without a
source." `Competitor` gets three optional fields (`funding`, `valuation`,
`userCount`), each a `SourcedFigure` or simply absent. The model reports
`{ value, url }` for a figure in its JSON (it has to — only the model
knows contextually which search result backs which specific competitor's
claim), but `lib/parse-report.ts`'s new `resolveSourcedFigure()`
**cross-checks that `url` against this session's real grounding
sources** (the same `Source[]` built from `groundingMetadata` for the
top-level Sources panel) before accepting it — an unmatched or missing
URL means the field is silently omitted, never included with a
best-guess. The label shown in the UI is always the verified source's
real title, never anything the model wrote. Same "never fabricate, fall
back gracefully" tier as market sizing — not the hard-throw tier
scores/sections use, so a bad figure never breaks report generation.

`parseValidationReport()`'s signature changed to
`(text, groundedSources: Source[])` — it now takes the grounding sources
as a parameter instead of (the already-removed) trying to parse a
`sources` field from the model's own JSON, and sets `report.sources`
directly from that parameter. `app/api/generate/route.ts` simplified to
match: `parseValidationReport(text, sources)` instead of the previous
`{ ...parseValidationReport(text), sources }` override-after-the-fact.

UI: `components/report/CompetitiveLandscape.tsx` renders a row of small
pill-shaped linked stats (`CompetitorSourcedStats`) below a competitor's
strength/weakness — only for whichever of funding/valuation/userCount are
actually present, nothing rendered for a competitor with none. Each pill
links to the real source URL (`target="_blank"`, verified `source.label`
as the tooltip). The footer disclaimer was reworded from "deliberately
left out" to describe the new conditional-sourcing policy accurately.

**Not yet live-verified — same blocker as the grounding restoration
above, not a new one.** Typechecked, linted, and the request path
confirmed reaching Gemini correctly (a real generation attempt just now
still hit the same exhausted quota from earlier testing — `429`, no
crash, handled cleanly). Zero real competitor figures have been seen
rendered. Once quota resets and a real generation runs, specifically
check: does at least one competitor show a sourced figure (not every
report will have one — some ideas' competitors just won't have a public
figure Gemini's search turns up, which is correct behavior, not a bug),
does its link actually open a real page, and does the value look sane.

**2026-07-22 (same day): idea-category classification added to steer
report emphasis, not the schema.** The founder pointed out a real gap:
every idea got the same fixed 8-factor/10-section template regardless of
what it actually was — a lab-grown-organs idea and a spice subscription
box read like the same shape with different words filled in.

`lib/types.ts` adds `IDEA_CATEGORIES` (`Consumer/Wellness`, `B2B SaaS`,
`Marketplace`, `Hyperlocal/Local Service`, `Hardware`, `Regulated
(Health/Finance)`, `General` as the safe fallback) and a `category` field
on `ValidationReport`. This is computed by the **same single generation
call**, not a second API call — `lib/prompt.ts` now instructs the model
to silently classify the idea first, put its choice in a `category`
field, then let that classification adjust **emphasis within the fixed
backbone**: a regulatory caution for Regulated ideas, single-metro
framing instead of national TAM for Hyperlocal ideas, a network-effects/
chicken-and-egg note for Marketplaces, sales-cycle/contract-value framing
for B2B SaaS, CAC/retention framing for Consumer, manufacturing lead-time
framing for Hardware. The 8 scores and 10 section titles never change —
only what the model chooses to say within them does. `category` itself is
clamped in `lib/parse-report.ts` against the fixed list (same
non-throwing, graceful-fallback tier as milestone phase) — an
invalid/missing value silently becomes `"General"` (no special emphasis)
rather than breaking generation.

**Regulation-naming is a prompt-level rule, not code-enforced — and
that's a deliberate, considered choice, not an oversight.** The founder
asked that a named specific regulation/statute only appear when grounding
backs it, generic cautions being fine either way. Unlike competitor
figures (which have a concrete URL to cross-check structurally), a named
regulation appears inside free-flowing prose (Risks, Regulatory Ease's
note) with no clean anchor to validate against in code — detecting "did
the model name a specific law" would mean regex/keyword-matching a list
of known regulation names, which is fragile and incomplete (misses
anything not on the list, false-positives on generic mentions). This is
the same trust tier the "don't fabricate precise market stats" rule has
always used in this app — prompt instruction + trust, not a structural
guarantee. Flagging this explicitly rather than overselling it as
equally rock-solid as the competitor-figure enforcement, which genuinely
is structural.

**Not yet live-verified — same persistent quota blocker as the last two
entries, now confirmed to be a real daily quota, not a transient spike.**
Multiple attempts across this session and the next, hours apart, all hit
the identical `429 RESOURCE_EXHAUSTED` on the same API key. Confirmed
(again) that the request path is solid — reaches Gemini with the now-
larger prompt (classification + emphasis rules + regulation constraint
added on top of everything already there) and fails cleanly, no crash,
no schema validation error. Typechecked and linted clean. **Completely
unverified: whether the model actually classifies correctly, whether the
emphasis differences are real and noticeable (not just present in the
prompt), and whether the regulation-naming constraint holds** — none of
this can be confirmed without a real generation. Founder: once quota
resets, this is worth testing with at least two very different ideas
(e.g. one obviously Regulated, one obviously Hyperlocal) side by side to
see whether the reports actually read differently, not just whether
`category` comes back populated.

**2026-07-22 (same day): added a 6th report step, "Validate" — a
customer-validation starting kit.** Grounded in a real, consistent market
critique the founder raised: AI validation alone isn't the finish line,
and tools that stop at a score get criticized as incomplete. The fix
isn't a bigger score — it's giving the founder a concrete first step
toward talking to real people, generated in the same single call as
everything else.

Followed the existing `REPORT_STEPS` pattern exactly, per the founder's
own instruction to read it first: `lib/report-icons.tsx`'s `REPORT_STEPS`
array is the single source of truth for the step nav, the off-screen PDF
render loop, and `LandingPage.tsx`'s "What you get" strip — all three are
already written as generic `.map()`/`.length` loops over that array (not
hardcoded to 5), so adding one entry (`key: "validate"`) was enough to
extend all three automatically. The only places that needed a manual
touch were `components/report/StepContent.tsx`'s switch (added a
`"validate"` case) and `LandingPage.tsx`'s `WHAT_YOU_GET` record (TypeScript
caught this immediately — it's typed against `REPORT_STEPS`' keys, so a
missing entry is a compile error, not a silent gap).

New `CustomerValidation` type (`lib/types.ts`): `interviewQuestions:
string[]` (5-8, open-ended), `outreachEmails: OutreachEmail[]` (2-3,
`{subject, body}`), `landingPageCopy: string` (one paragraph). Added to
`ValidationReport` as `customerValidation`. `lib/prompt.ts` instructs the
model to write these for the SAME idea in the SAME generation call — no
second API request — with an explicit, repeated constraint: zero
fabricated statistics, zero invented testimonials or "X% of users"
claims, since these are supposed to be starting points for *getting* real
data, not a place to invent it. `lib/parse-report.ts` parses it at the
same graceful, non-throwing tier as financials/roadmap — missing or
malformed just yields fewer items, never breaks generation.

**Worth being precise about the honesty guarantee here, since it differs
from this session's other work today.** Unlike sourced competitor figures
(structurally enforced — a fabricated figure literally cannot have a
`Source` attached), the "no fabricated stats" rule for interview
questions/emails/landing copy is prompt-level trust only, same tier as
market sizing. There's no structural anchor to check a claim inside free
email/landing prose against, the way a competitor's funding figure has a
URL to cross-check. Said plainly in the new step's own UI copy
(`components/report/CustomerValidation.tsx`), not just buried in
`HANDOFF.md` — a visible banner at the top of the step frames these as
starting drafts to customize, and a footer line makes the "no invented
numbers" expectation explicit to whoever's about to copy-paste these
into a real email.

Also fixed two now-stale "5-part report" mentions this change would have
otherwise left behind: `app/how-it-works/page.tsx` now derives the count
from `REPORT_STEPS.length` instead of a hardcoded number (so it can't go
stale again next time a step is added), and `README.md`'s feature table
got a new row plus a correction to its now-outdated "qualitative-only, no
funding/valuation/user-count figures" competitor claim (superseded by
today's sourced-figures change, missed when that shipped since it wasn't
touched at the time).

**Not yet live-verified — the same persistent quota block, now confirmed
across attempts spread over hours in this same extended session, well
past what a transient spike would explain.** Typechecked and linted
clean (`npx eslint app components lib` — the only lint noise is
pre-existing `.next/` build output, unrelated to any of today's source
changes). Confirmed the request path handles the now-larger prompt
(category classification + regulation rule + full customer-validation
spec, on top of everything already there) and fails cleanly on the same
`429`. **Completely unseen**: any real interview questions, email drafts,
or landing copy: whether they're genuinely non-leading and non-generic,
whether the "no fabricated stats" instruction actually holds under real
generation, and whether the new step renders correctly end-to-end
(including in the PDF export, which was never tested with 6 steps).
Founder: this is the third and most novel of today's three unverified
features stacked on PR #6 — worth being the first one you check once
quota resets, precisely because it's new UI, not modified UI.

**2026-07-22 (same day, right after Validate): added a 7th report step,
"Build Brief."** Deliberately framed by the founder as mirroring how this
exact project came to exist — see README's "How this was built": the
founder briefed Claude Code with an idea and direction, Claude implemented
it. This step generates that same kind of starting brief for the
founder's *validated* idea, to hand to an AI coding tool. Same pattern as
Validate: one field addition to `REPORT_STEPS`, everything else that
consumes it (nav, PDF loop, "what you get" strip) picked it up for free.

New `BuildBrief` type (`lib/types.ts`): `mvpScope: string`, `techStack:
TechStackChoice[]` (`{layer, choice, reason}` — `layer` is free text, not
a fixed enum, since what an idea needs varies too much to force into a
rigid taxonomy: a hardware idea has no "Auth" layer, a marketplace has no
"Firmware" layer), `starterPrompt: string`. Explicitly out of scope per
the founder's own instruction: no actual code or repo generation — this
is text output rendered in the UI, exactly like every other section and
nothing more.

Three things `lib/prompt.ts` had to get right, all directly from the
founder's own numbered spec:
1. `mvpScope` must be **consistent with**, not a second opinion from, the
   model's own "MVP Feasibility" score/note written earlier in the same
   response — both come from the same single generation call, so this is
   just a prompt instruction to stay internally consistent, not a
   plumbing problem.
2. `techStack` explicitly forbids defaulting to "Next.js + Supabase" (or
   any other single stack) regardless of idea — called out by name in the
   prompt as the exact generic-template failure this feature exists to
   avoid. Slightly on-the-nose that "Next.js + Supabase" is also this
   app's own stack; worth someone actually checking a hardware or
   regulated-finance idea doesn't come back with it anyway out of model
   training bias, once quota allows real testing.
3. `starterPrompt` is instructed to read "the way a technical co-founder
   would brief an engineer, not 'build me an app for X'" — the founder's
   own phrase, kept close to verbatim in the prompt rather than
   paraphrased, since it's a precise enough bar to aim for on its own.

UI (`components/report/BuildBrief.tsx`): MVP scope panel, a tech-stack
card grid, and a monospace starter-prompt block with a working
copy-to-clipboard button — the only interactive control added to any
report component this session, justified because the field's entire
purpose is being pasted somewhere else. `"use client"` + local `useState`;
every sibling report component relies on already being nested inside the
page-level client boundary instead.

Same honesty-tier caveat as Validate: `techStack`/`mvpScope`/
`starterPrompt` are prompt-level trust, not structurally checkable —
there's no URL or API metadata to cross-check a technology recommendation
against, unlike sourced competitor figures. Not oversold as more
rock-solid than it is.

**Not yet live-verified — the same persistent quota block, now spanning
this entire multi-hour session.** Typechecked, linted clean. Fixed the
"N-part report" copy this pushed stale a second time in one session
(`README.md`'s table and lead sentence; `app/how-it-works/page.tsx`
already self-corrects via `REPORT_STEPS.length` from the Validate change,
needed no further edit). **Completely unseen**: whether tech stack
suggestions are actually reasoned per-idea (the one thing most worth
checking, given the explicit anti-genericness ask), whether the starter
prompt reads like a real technical brief or a vague one-liner, whether
the copy button works, and whether a 7-step PDF export still holds up.
Four features deep on PR #6 now, all sharing one blocker — worth
resetting quota and checking all four in one pass rather than one at a
time.

**2026-07-22 (same day): dashboard comparison mode + sort/filter — the
first of today's five features that needed zero Gemini calls to verify,
and actually got fully verified.** Framed by the founder as the feature
that makes "companies use this instead of a consultant" real: one founder
validating one idea doesn't need comparison, a team evaluating several
proposals does. Pulls entirely from data already in the `reports` table —
`overallScore`/`verdict`/`scores`/`headline` are all already on the stored
`ValidationReport`, so this needed zero backend, schema, or Supabase query
changes. Purely new dashboard UI over existing data.

**The founder's constraint — "don't change how a single report is
opened" — was treated as load-bearing, not a suggestion.**
`components/dashboard/ReportCard.tsx` (the component whose `onClick`
calls `setReportData()` + routes to `/report/summary`) was **not
touched** beyond a pure color-constant import consolidation (see below) —
confirmed by literally diffing it against the prior commit before
considering this done. Compare-mode selection is a **separate** component
(`SelectableReportRow.tsx`), not a variant/prop-branch of `ReportCard`,
specifically so the single-open path has zero surface area for this
change to regress. `app/dashboard/page.tsx`'s auth check, Supabase query,
and empty/error states are also untouched — the only edit there swaps
which component renders the non-empty list (`ReportCard` mapping →
`<DashboardReports rows={rows} />`).

New: `components/dashboard/DashboardReports.tsx` (client component, owns
sort/filter/compare-mode state — `page.tsx` stays a server component that
only fetches), `SelectableReportRow.tsx` (compare-mode checkbox row),
`ReportComparison.tsx` (the side-by-side view: cards row with per-report
color identity, a shared multi-series radar chart, and a numeric
factor-by-factor table underneath — the table wasn't explicitly asked
for, added because a radar chart alone is hard to read exact numbers off
of and "a team evaluating several proposals" implies wanting precision,
not just a vibe). Sort (Newest/Highest/Lowest score) and a verdict filter
(All/GO/REFINE/PIVOT) both work client-side over the already-fetched
rows — no new query. Compare selection capped at 4 (shown in the UI as
"N selected (max 4)", not a silent refusal) so the shared chart/table
stay legible.

**Comparison colors are deliberately NOT the go/refine/pivot signal
colors** — two compared reports can share a verdict and still need to be
told apart on the same chart, so `ReportComparison.tsx` uses its own
small fixed categorical palette (purple/blue/pink/gold) instead, applied
consistently across the card top-borders, the radar chart legend, and the
table headers so the same color always means the same report throughout
the view.

**Paid down documented debt while here**: `TONE_COLOR`/`TONE_DIM`/
`VERDICT_TONE`/`tierForScore` were duplicated in `Snapshot.tsx` and
`ReportCard.tsx`, with a note on the `ReportCard.tsx` entry above saying
"revisit if a third place needs the same mapping." `ReportComparison.tsx`
became that third place, so this pass actually did the consolidation
instead of duplicating a third time: new `lib/verdict-tone.ts`, both
existing files now import from it, and `LandingPage.tsx`'s import of
`TONE_COLOR`/`tierForScore` (previously re-exported through
`Snapshot.tsx`) now points at the canonical source directly.

**Verified for real, not just typechecked** — this feature needed no
Gemini call, so the usual quota block didn't apply. Since there's no
real authenticated session available to test against live Supabase data,
built a temporary local route (`app/devtest-dashboard/page.tsx`) rendering
`<DashboardReports>` with 4 hand-written mock reports covering different
scores/verdicts, clicked through sort, filter, compare-mode selection,
the comparison view (cards + radar chart + table all confirmed rendering
correctly with real interaction, not just "it compiles"), and the
back/exit controls — then **deleted the route** before committing; it
was never part of the feature, purely a verification aid, same spirit as
the standalone test scripts used earlier this session to verify the
Gemini SDK directly. **Still not verified**: the real end-to-end path
with actual signed-in Supabase data (mock data proved the component
logic works, not that the Supabase query/RLS/real report shape lines up
perfectly) — worth a real click-through once the founder's signed-in
session is available, same as the still-open Stage 2 verification item
above.

**2026-07-22 (same day): mobile-width audit — the founder's explicit
instruction was "mobile width has never been checked, by an AI or the
founder, on any route," and to look before fixing, not do a blind
"add responsive classes" pass.** Opened every route in a real browser
session at a real 375px viewport (not a resized desktop window) and
screenshotted each one before touching any code. Six real issues found,
all fixed:

1. **`SiteHeader`** — "Home / How It Works / About" plus "Log in / Sign
   up" wrapped onto their own row below `sm`, eating over a third of a
   375px screen before any page content. Fixed with a real hamburger
   menu: split into `AuthSection` (compact mode below `sm`, showing only
   the single primary action) and a new `MobileAuthLinks` dropdown that
   holds what compact mode drops, so nothing is actually lost, just
   relocated. Needed a `useSessionUser()` hook lifted to the top of the
   file so the compact row and the dropdown agree on signed-in state
   without duplicating the Supabase session fetch.
2. **Report step nav (`app/report/layout.tsx`) and Full Report jump-nav
   (`components/report/FullReport.tsx`)** — both are `overflow-x-auto`
   pill rows that already scrolled to reveal items past the visible
   width (Competitors/Validate/Build Brief/Full Report sit off-screen at
   375px), but had zero visual hint that they scroll at all — looked
   like a cut-off, static row. Fixed with a right-edge gradient-fade
   overlay plus scrollbar-hiding (`[scrollbar-width:none]
   [&::-webkit-scrollbar]:hidden`, since Tailwind v4 has no built-in
   `scrollbar-none` utility). Same pattern applied to both, independently
   — no shared component, since one is inside a client layout and the
   other a plain function component.
3. **Radar charts (`Snapshot.tsx`, `ReportComparison.tsx`)** — multi-word
   factor labels ("Competitive Advantage," "Capital Efficiency,"
   "Regulatory Ease") got clipped by their own container at 375px.
   Shrinking `outerRadius` alone wasn't the real fix — even at 55-58%,
   long labels still overflowed. The actual fix was a shared word-wrapping
   tick renderer, new `components/RadarAngleTick.tsx` (typed against
   recharts' `BaseTickContentProps`), which puts each word of a label on
   its own `<tspan>` line. `outerRadius`/margin were then tightened
   (Snapshot: 58%, ReportComparison: 55%) after re-verifying visually —
   fixing the real cause (label width) instead of chasing it by shrinking
   the chart indefinitely.
4. **`BuildBrief.tsx`** — the starter-prompt panel's header row
   (label + copy button) used a plain `justify-between`, pushing the copy
   button hard against the right edge with the label text touching it at
   375px. Changed to stack (`flex-col items-start gap-3`) below `sm`,
   row above; copy button got `shrink-0 whitespace-nowrap` so its label
   never wraps mid-word.
5. **`ReportCard.tsx` / `SelectableReportRow.tsx` (dashboard rows)** — the
   most severe issue found: `items-center justify-between` with no wrap
   meant the idea text, score, and verdict badge all fought for space on
   one row, actually overflowing the card's right edge at 375px (visually
   confirmed, not just suspected). Fixed the same way for both: stack
   (`flex-col gap-3`) below `sm`, row above (`sm:flex-row sm:items-center
   sm:justify-between sm:gap-4`). `ReportCard.tsx`'s `onClick`/`handleOpen`
   logic was left byte-identical — confirmed via `git diff` — per the
   still-standing "don't change how a single report is opened" constraint
   from the comparison-mode work above; this was a pure layout/CSS fix.
6. Confirmed the sticky "Idea analyzed" banner, Snapshot's verdict gauge
   (already had `flex-col sm:flex-row` from the Phase-1 polish pass), and
   the landing page hero needed no changes — already correct at 375px.

**Verified, not assumed**: every fix was visually re-checked at 375px
after the change (not just "the classes look right"), then a desktop
(1280x800) regression pass confirmed none of the six broke non-mobile
layouts — re-seeded a full mock `ValidationReport` into
`sessionStorage` (the same key/shape `lib/report-context.tsx` reads,
`{idea, report}`) to drive the report journey without spending Gemini
quota, screenshotted Summary/Full Report/Build Brief at desktop width,
and confirmed via `git diff` that every mobile fix is a pure additive
`sm:`-prefixed variant — the pre-existing desktop-width classes are
unchanged, so there was no real regression risk to begin with, only
confirmation. Typechecked and linted clean
(`npx tsc --noEmit`, `npx eslint`). One unrelated hiccup along the way:
an `rm -rf .next` run out of habit while the dev server was still live
corrupted its running module cache (`MODULE_NOT_FOUND`,
`ENOENT: routes-manifest.json`) — not a code regression, fixed by
restarting the dev server.

**2026-07-22 (same day, later still): swapped generation from Gemini to
Groq — a testing-reliability decision, not a quality one.** Gemini's free
tier had become genuinely unusable for iterating on this product: the
2026-07-21/22 status entries above already documented persistent `503`
"high demand" errors and 60-80s+ stalls, and current published Gemini
free-tier limits (10-15 requests/minute, 250-1,000 requests/day depending
on model) make that worse, not better, for a founder who just wants to
click Generate repeatedly while testing. The founder now has a Groq API
key; Groq's free tier is far more generous (14,400 requests/day, 30
requests/minute, no billing card) and Groq's LPU inference is fast enough
that report generation is expected to take low single-digit seconds
instead of a minute-plus. **Explicit decision, not yet final**: the
founder still wants to compare providers (Claude included) on actual
output quality once the product is feature-complete — this is a
"get testing unblocked" swap, same spirit as the earlier Claude→Gemini
swap, not a launch decision.

`app/api/generate/route.ts` now uses the `openai` SDK pointed at Groq's
OpenAI-compatible endpoint (`baseURL: "https://api.groq.com/openai/v1"`)
instead of `@google/genai` — swapped the dependency outright (`npm
uninstall @google/genai && npm install openai`), not layered alongside
it. Model is `openai/gpt-oss-120b` (Groq's own current recommendation for
structured-output tasks; `llama-3.3-70b-versatile` is being deprecated).
JSON is requested via `response_format: { type: "json_object" }` — plain
JSON-object mode, not a hand-authored JSON Schema — consistent with how
Gemini's `responseMimeType: "application/json"` was used before: rely on
the prompt's detailed shape instructions plus `lib/parse-report.ts`'s
existing defensive parsing, which was already written to never trust the
raw shape regardless of provider. Retry logic carried over the same
shape (one retry with backoff on a retryable status) but now covers both
`429` and `503` — Groq's daily cap is generous enough that a `429` here
more plausibly means "hit the 30 req/min ceiling momentarily" than
"quota exhausted for the day," unlike Gemini's stricter free tier.
`maxDuration` dropped from 280 to 60, sized for Groq's expected speed
rather than reusing Gemini's proven-safe-but-much-higher ceiling.

**No search grounding on this provider — an open-weight model behind
Groq has no live web access, so this isn't a config flag, it's a real
capability gap.** Handled the same way this project always handles a
capability it doesn't actually have: honestly, not silently.
`lib/prompt.ts` now tells the model plainly it has no web access and
must label every figure as an estimate; the rule barring a specific
regulation/statute citation is now unconditional instead of
grounding-gated; the instruction to attach a sourced `funding`/
`valuation`/`userCount` figure to a competitor was removed entirely
(a model with no web access has no way to back one with a real URL, and
the JSON shape's example that showed a sample sourced figure was removed
too, so nothing in the prompt models a pattern the app can't honor
anymore). `route.ts` always calls `parseValidationReport(text, [])` — an
empty sources array — rather than asking the model to self-report
sources, since a self-reported URL from a model with no web access is a
plausible-looking fabrication, not a citation; the existing
`resolveSourcedFigure` check in `lib/parse-report.ts` already requires a
competitor figure's URL to match a real entry in the sources array, so
this is structurally consistent with, not a new exception to, that
existing safety net.

Every UI claim that depended on grounding being on was updated to match,
same "stay strict on data honesty" rule this project has enforced at
every provider swap so far: `components/LandingPage.tsx`'s "Grounded
with live web search" trust badge removed (`Globe2` import removed too,
now unused), and its `GENERATION_STEPS` multi-step loader dropped the
~130s "Searching the web for real data" phase entirely rather than leave
a step describing something that no longer happens.
`components/Footer.tsx`'s honesty disclaimer no longer says "grounded in
live web search." `README.md`'s tech stack line, setup instructions, and
the "data honesty" section's competitor-sourcing claim were all updated
to reflect Groq + no grounding (the sourced-figure structural-safety
claim is now phrased as "this app has run with grounding before, and
when it's on again, this is how sourced figures are structurally
verified" rather than describing something currently active).
`app/how-it-works/page.tsx` needed no change — it already described
estimates generically, never claimed grounding by name.

New env var: `GROQ_API_KEY` replaces `GEMINI_API_KEY` — updated in
`.env.local.example`, **not** written into the founder's real
`.env.local` by Claude (API keys are never entered by AI, per this
project's own established policy — see the earlier Vercel-key note
above). The founder still needs to add the real key locally (and later
to Vercel, once/if this becomes the launch provider) before generation
will actually succeed.

**Verified without spending the founder's real Groq quota on this
specific check**: typechecked and linted clean after the swap. Started
the dev server with no `GROQ_API_KEY` set (deliberately, to check the
failure path rather than skip it) and confirmed the homepage renders
correctly with the grounding badge gone, then submitted a real idea
through the UI and confirmed the friendly, provider-correct error
surfaced end-to-end: "Groq API key is missing. Add GROQ_API_KEY to your
`.env.local` file and restart the server." **Not yet verified**: an
actual successful Groq generation — blocked on the founder adding their
real key locally, which is the very next step. Once that's done, worth
a real click-through the same way every other provider swap in this
project has been (real idea in, full report out, not just "the request
didn't error").

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
- `app/report/layout.tsx` — the report shell: idea-analyzed banner, step
  nav (real `<Link>`s to `/report/{step}`, driven by `REPORT_STEPS` — see
  below, so its count isn't hardcoded here), Download PDF button. Redirects
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
- `components/report/CustomerValidation.tsx` (2026-07-22) — `REPORT_STEPS`
  key `"validate"`, same dark instrument-panel style as the above three.
  Renders `report.customerValidation` (interview questions, outreach email
  drafts, landing-page copy) with a prominent "starting draft, not a
  finished asset" banner up top, not just a small footer disclaimer like
  the other sections — deliberate, since this is content people might
  actually copy-paste and send.
- `components/report/BuildBrief.tsx` (2026-07-22, same day) —
  `REPORT_STEPS` key `"build"`, added right after `CustomerValidation.tsx`
  in the same session. Renders `report.buildBrief` (suggested MVP scope,
  a per-idea-reasoned tech stack, a literal starter prompt for an AI
  coding tool). The only report component with client interactivity
  beyond what its parent tree already provides — a copy-to-clipboard
  button on the starter prompt (`"use client"`, local `useState`), since
  the entire point of that field is pasting it elsewhere. Every other
  `components/report/*` file relies on already being nested inside the
  page-level client boundary rather than declaring its own.
- `components/report/FullReport.tsx` — the 10 prose sections, light
  background (deliberately different from Snapshot's dark panel — long
  prose is more readable on light, short data readouts work on dark). Has
  a sticky jump-nav (anchor links to each section) and a per-section icon.
- `lib/report-icons.tsx` — the single shared icon lookup (lucide-react) for
  score criteria, report sections, verdicts, milestone phases, and the
  `REPORT_STEPS` list (key/label/icon) that the step nav, the PDF export
  loop, and `LandingPage.tsx`'s "What you get" strip all iterate over
  generically — the step nav/PDF loop need zero changes to add a step,
  only `StepContent.tsx`'s switch and `LandingPage.tsx`'s `WHAT_YOU_GET`
  record (TypeScript enforces the latter, since it's typed against
  `REPORT_STEPS`' keys). Confirmed twice in one session (Validate, then
  Build Brief) — see the two 2026-07-22 status log entries.
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
- **Historical — Claude's web_search implementation, not currently in use
  but kept for reference.** Before the 2026-07-21 Gemini swap, the route
  called Claude with a `web_search_20260318` tool (`allowed_callers:
  ["direct"]` to skip a slow dynamic-filtering path — 8 minutes vs. ~2-3
  for a single report), `max_uses: 4`, `maxDuration = 280`, and
  concatenated every `text` content block in the response (web search's
  citation mechanism could split the JSON output across several blocks —
  keeping only the first silently truncated it on some requests). All of
  it was removed, not disabled, when the route switched to Gemini. As of
  2026-07-22 grounding is back on **Gemini's own `googleSearch` tool
  instead** (see status log) — a different mechanism with different
  gotchas (no `responseMimeType` + tools, sources from `groundingMetadata`
  not model self-report), not a restoration of this exact Claude code.
  Kept here in case Claude's web_search is ever revisited for real (the
  founder's own plan is to re-compare providers once the product is
  feature-complete) — don't rediscover `allowed_callers`/`max_uses`/the
  multi-block truncation bug from scratch if that happens.

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
  (server component, redirects to `/login?next=/dashboard` if signed out;
  still owns the Supabase query, auth check, and empty/error states).
  `components/dashboard/ReportCard.tsx` — clicking a saved report doesn't
  re-fetch anything; it calls `useReport().setReportData()` and routes to
  `/report/summary`, reusing the same context + step UI a fresh generation
  uses. **This exact click-to-open behavior is treated as a hard
  constraint, not just current behavior** — see the 2026-07-22 comparison
  mode entry below for why it stayed untouched even while the rest of the
  dashboard changed around it.
  `components/dashboard/DashboardReports.tsx` (2026-07-22, client
  component) now owns everything interactive: sort (newest/score),
  verdict filter, and compare mode — which renders
  `SelectableReportRow.tsx` instead of `ReportCard.tsx` for selection, and
  `ReportComparison.tsx` for the side-by-side view (shared radar chart +
  numeric table). Verdict badge styling (`TONE_COLOR`/`TONE_DIM`/
  `VERDICT_TONE`/`tierForScore`) used to be duplicated in `Snapshot.tsx`
  and `ReportCard.tsx` — consolidated into `lib/verdict-tone.ts` once
  `ReportComparison.tsx` became the third place needing it (this was
  flagged as the trigger to do so back when the duplication was still
  only two places).
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
  features (see status log). **Web search grounding is back on as of
  2026-07-22** via Gemini's own `googleSearch` tool (5,000 free grounded
  prompts/month — see that status log entry for the full pricing
  comparison against reverting to Claude). Verify the model name is still
  current/free-tier before assuming it (check
  ai.google.dev/gemini-api/docs/pricing), and don't assume this is the
  final provider choice — the founder wants to re-compare Claude/Gemini/
  others on actual output quality once the product is feature-complete.
  Because `googleSearch` and `responseMimeType: "application/json"` can't
  be combined, the route no longer uses native JSON mode — it relies on
  the prompt instruction + `parse-report.ts`'s defensive parser, same as
  the original Claude version always did.
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
  the model's own labeled estimates, not verified data — even with web
  search grounding back on (2026-07-22), these are still framed as
  estimates, not sourced facts; grounding informs the number, it doesn't
  certify it. The prompt explicitly
  forbids fabricating false-precision numbers. Keep the "(estimate)"
  framing in the UI — don't let it drift into looking like sourced data.
- **Competitor profiles are qualitative by default; quantitative fields
  (funding/valuation/userCount) are allowed as of 2026-07-22, but ONLY
  when cross-checked against a real grounding source** — see the
  2026-07-22 status log entry. This was a direct policy change tied to
  grounding being back on; if grounding ever goes off again, these fields
  will silently stop appearing (no source to match against) rather than
  needing a prompt change, but don't assume the underlying "never
  fabricate" policy itself has loosened — it's enforced at the type level
  in `lib/types.ts` (`SourcedFigure` requires a `Source`), not just by
  asking the model nicely.
- **Idea category (2026-07-22) is emphasis-only, never structural.** The 8
  score criteria and 10 section titles are fixed regardless of
  `category` — don't add category-conditional fields to the schema
  itself (a "Regulated" idea does NOT get an 11th section, a "Hardware"
  idea does NOT get a 9th score). If category-specific structure is ever
  wanted, that's a deliberate future decision, not something to slide in
  under "emphasis." `category` falls back to `"General"` (no special
  emphasis) on anything invalid/missing — never throws.
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

As of 2026-07-21 (Gemini swap): **now verified live in production**, not
just locally — two different ideas, both signed-out, both eventually
succeeded (61/100 and 69/100) after several 503/timeout retries each. See
the "deploy + live verification" status log entry for the full story,
including two bugs (`maxDuration` too low, a merge conflict that hid two
more stale Claude/web-search claims) that only surfaced once this was
actually pushed and tested for real — this is exactly why "typechecks
and works locally" was never treated as "done" earlier in this session.
What's still genuinely unknown: whether `gemini-3.5-flash` is reliable
across a *wide variety* of ideas (only two have been tried), and whether
persistence-while-signed-in still works with the real Gemini response
shape (untested — both real runs were signed out; see the Stage 2 item
just above, which is still open).

As of 2026-07-22 (grounding restored): **entirely unverified** — typechecked
and the request path confirmed live up to a real `429` (today's free-tier
quota was already exhausted by earlier testing this same session), but no
successful grounded generation has been seen. Unknown: whether JSON
parsing still works reliably without native JSON mode, whether
`groundingChunks` populates as documented, whether the Sources panel
renders correctly, and whether the source URLs are real (not
hallucinated) — the founder's own requested check. See the 2026-07-22
status log entry for exactly what to verify once quota resets.

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

1. **Founder: verify search grounding for real, once Gemini quota resets**
   — this is the most important open item. Run a real generation, confirm
   it still produces valid JSON reliably (no more native JSON mode — see
   the 2026-07-22 status log entry), open a few Sources panel links
   yourself to confirm they're real pages, and push/merge/deploy once
   satisfied (this hasn't been pushed yet — still local, same mistake as
   last time is avoidable this time: push and merge before considering it
   done, don't just commit locally).
2. ~~Add `GEMINI_API_KEY` to Vercel's env vars~~ **Done — deployed and
   verified live on production as of 2026-07-21/22** (before grounding was
   restored). Everything through the Gemini swap + both bugfixes is
   merged to `main` and confirmed working on
   `founder-copilot-flame.vercel.app`. Grounding itself (item 1 above) is
   not deployed yet.
3. **Founder: verify Stage 2 signed-in path for real** (see "What's
   untested" above) — code is written and typechecked, one real
   generation has been verified signed-out, but the persist → dashboard →
   reopen loop while signed in has not run with a real session.
4. The four utility ideas discussed but not started: standalone
   calculators (LTV/CAC/break-even/runway), a "recalculate with your
   numbers" override on financials, an interactive milestone checklist on
   Roadmap, and a risk-matrix visualization for the stop signals. Now that
   `/dashboard` exists, these can be built dashboard-native as originally
   planned.
5. Possibly upgrade PDF export to real selectable text.
6. Harden rate limiting before any wider traffic. A real successful
   generation took **124 seconds** without grounding (Gemini free tier is
   currently overloaded — see status log) — likely longer now that
   grounding adds its own round trip; re-check whether 8 req/hour still
   makes sense given that once real timing is known. The in-memory rate
   limiter (`lib/rate-limit.ts`) resets on every Vercel serverless cold
   start — live, not hypothetical, now that this is actually deployed.
7. Mobile-width visual check for the report journey + marketing pages —
   not yet done by an AI or the founder.
8. Fill in the real name on the MIT `LICENSE` file if it ever needs to
   change (currently "Zaeem Ather").
9. **Once the product is feature-complete, re-compare LLM providers**
   (Claude vs. Gemini vs. others) on actual output quality for this exact
   prompt/JSON contract, and decide for real — the Gemini swap was a
   cost-saving move during development, not a quality judgment. Grounding
   is back (2026-07-22) on Gemini's own tool, not Claude's — factor real
   quality/reliability comparisons of both grounding mechanisms into that
   future decision, not just base model quality.
10. **Strategic pivot (2026-07-18):** the founder wants to step back from
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
