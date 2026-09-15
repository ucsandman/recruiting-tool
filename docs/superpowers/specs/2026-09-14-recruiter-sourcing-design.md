# Recruiter Sourcing & Qualification — Design

Date: 2026-09-14
Status: Approved for planning
Repo: recruiting-tool (Chrome MV3 extension)

## Problem

A recruiter with a LinkedIn Recruiter seat spends his day reading ~60 profiles to
find ~6 worth contacting. Three specific costs:

1. **Finding** — search returns a list; relevance ranking is LinkedIn's, not his.
2. **Qualifying** — he reads each profile and judges it against a role in his head.
3. **Signal capture** — open-to-work status and recent job changes are the two
   strongest movability signals, and both are easy to miss at volume.

He works mostly inside LinkedIn Recruiter (`/talent/*`), sometimes on regular
profiles (`/in/*`). He needs the Recruiter-private open-to-work signal, not just
the public green badge.

## Non-negotiable constraint: his Recruiter seat must never be at risk

A Recruiter seat is expensive and suspension ends the workflow entirely. This
outranks every feature in this document.

LinkedIn's automation detection is primarily network- and timing-based: request
rates, non-human inter-request intervals, headless signatures, and navigation
patterns no human produces. Therefore the invariant:

> **The extension reads only DOM that is already rendered on a page the recruiter
> navigated to himself. It issues zero requests to linkedin.com and performs zero
> synthetic interactions with LinkedIn's UI.**

This is enforceable as four code-level rules, checkable by grep in CI:

| Rule | Forbidden |
|---|---|
| No network to LinkedIn | `fetch`/`XMLHttpRequest` with a `linkedin.com` target in any content script |
| No synthetic interaction | `.click()`, `.submit()`, `dispatchEvent` on LinkedIn elements |
| No timers driving reads | `setInterval`/`setTimeout` that trigger extraction or navigation |
| No implicit extraction | Scoring runs on explicit user action only, never on page load |

Consequence accepted: content hidden behind "See more" is not extracted in v1,
because expanding it requires a synthetic click. The recruiter expands it himself
if he wants it read.

This constraint costs almost nothing in practice. A Recruiter results page already
has ~25 candidates rendered. Leverage comes from batching the *scoring*, which
happens against the Claude API where LinkedIn has no visibility.

## Architecture

Four layers. Existing code is reused, not replaced.

```
content/linkedin-extractor.js   (exists)  /in/*      raw profile -> ProfileData
content/recruiter-extractor.js  (new)     /talent/*  raw cards + profile -> ProfileData[]
content/overlay.js              (new)     paints rank badges onto rendered cards
        |
utils/signals.js                (new)     deterministic, no AI: tenure, bands, badge, diffs
utils/snapshots.js              (new)     stored role snapshot per candidate, change detection
        |
features/scorecard.js           (new)     JD -> rubric -> recruiter edits -> stored per role
features/candidate-scorer.js    (new)     N candidates + rubric -> ONE Claude call -> scores
features/pipeline.js            (new)     saved candidates, stages, job-change surface
        |
popup/ (exists)                           two new tabs: Scorecards, Pipeline
lib/claude-api.js (exists)                consolidated, batched call support
```

### Why the deterministic layer is separate from the AI layer

Tenure, tenure band, open-to-work presence, and job-change diffs are all computable
exactly from text already extracted. Sending them to a model would make them slower,
cost money, and introduce a failure mode where the number is wrong. `utils/signals.js`
is pure functions over strings, fully unit tested, no network. The model is used only
for the one thing it is actually better at: judging free-text experience against
free-text criteria.

## Components

### `utils/signals.js` (pure, tested, no AI)

```
parseTenure(durationText) -> {startISO, endISO|null, months, isCurrent}
```

LinkedIn renders duration as e.g. `Jan 2023 - Present · 2 yrs 3 mos`. Parser handles:
explicit `N yrs N mos`, date-range arithmetic when the summary is absent, `Present`,
month-only and year-only precision. Returns `null` on unparseable input rather than
guessing — an unknown tenure is displayed as unknown, never as zero.

```
tenureBand(months) -> 'new' | 'settling' | 'prime' | 'entrenched'
```

- `new` (0-5 mo) — just moved, usually cold, flagged as such
- `settling` (6-17 mo)
- `prime` (18-47 mo) — most movable
- `entrenched` (48+ mo)

Bands are advisory labels shown to the recruiter, not filters. He decides.

```
detectOpenToWork(profileData) -> {open, source: 'public-badge'|'recruiter-spotlight'|null, seenAt}
```

Two independent sources, both reported with provenance so he knows which he is
looking at. The public badge is the `#OpenToWork` photo frame on `/in/`. The
Recruiter spotlight is a flag rendered only inside `/talent/`.

```
diffRole(prevSnapshot, currentSnapshot) -> {changed, from, to, kind}
```

`kind` is `company-change`, `title-change`, `both`, or `none`.

### `utils/snapshots.js`

Stores, per saved candidate, the last-seen `{title, company, startISO}`. Used for
job-change detection. Never fetches anything; it only compares what a content script
just read from a page the recruiter opened.

### `features/scorecard.js`

A rubric per open role. Created by pasting the job description; Claude proposes the
rubric; the recruiter edits it before it scores anything. Auto-derived rubrics
over-weight JD boilerplate, so the edit step is mandatory, not optional — a scorecard
is not usable until he has opened and saved it once.

```
Scorecard {
  id, roleName, createdAt, editedAt,
  mustHaves:    [{id, text, weight}],
  niceToHaves:  [{id, text, weight}],
  dealbreakers: [{id, text}]
}
```

### `features/candidate-scorer.js`

Takes up to 25 extracted candidates plus one scorecard, sends **one** Claude request,
returns per candidate:

```
Score {
  candidateId, scorecardId, total, recommendation: 'strong'|'possible'|'weak',
  lines: [{criterionId, verdict: 'met'|'unmet'|'unknown', evidence: string|null}],
  dealbreakerHit: criterionId|null
}
```

Two rules that make the output trustworthy:

1. **Every `met` carries `evidence`** — a verbatim span from the candidate's own
   profile text. A claim with no quotable support is not `met`.
2. **Absence of evidence is `unknown`, never `unmet`.** A LinkedIn profile is a
   marketing document with omissions. Scoring a missing mention as a failure silently
   discards qualified people, which is the exact failure the tool exists to prevent.

`unknown` counts as neither credit nor penalty, and the UI surfaces the count so he
can see when a low score really means a thin profile.

Model: `claude-sonnet-5`. The repo currently pins `claude-sonnet-4-20250514` in two
places; both are updated as part of this work.

### `content/recruiter-extractor.js`

Parses two Recruiter views into the same `ProfileData` shape the existing `/in/`
extractor produces, so everything downstream is source-agnostic.

- **Results view** — the rendered candidate cards: name, headline, current role,
  tenure text, spotlight flags, profile link.
- **Profile view** — the fuller record, including the Recruiter-only open-to-work flag.

Selector strategy follows the pattern already proven in `linkedin-extractor.js`:
locate by visible text and structural position rather than by class names, because
LinkedIn's generated class names change and its semantic IDs are gone. Exact anchors
are derived from the captured DOM samples in `dom-samples/` (gitignored — they contain
real candidate PII and are deleted once parsers are written).

**Extraction failure is loud.** If a parser finds zero cards on a page that clearly is
a results page, the overlay shows a visible "couldn't read this page" state. Silent
empty extraction is the worst outcome, because it looks like "no good candidates."

### `content/overlay.js`

Paints a rank badge and a one-line reason onto each already-rendered card, in place,
so he never leaves Recruiter. Adds a collapsible side panel listing the page's
candidates sorted by score. Reads and writes nothing on LinkedIn's side beyond
injecting its own DOM nodes.

Recruiter is a single-page app: navigation does not re-run the content script. View
changes are detected with a `MutationObserver` on the results container plus a
`history.pushState` hook. The observer only marks state dirty; it never triggers
extraction, which stays behind an explicit click.

### Pipeline tab

Saved candidates with stage, per-role scores, open-to-work provenance, and job-change
history. Job-change detection runs when the recruiter opens a profile himself. The tab
additionally shows a **re-check list** — candidates not seen in 90 days (configurable),
as plain links he clicks at his own pace. There is no timer and no background re-visiting. That
pattern is the single feature most likely to get a seat flagged and it is deliberately
excluded.

## Data model (chrome.storage.local)

```
claudeApiKey        (exists)
savedCandidates     (exists, extended)
scorecards          (new)  Scorecard[]
scores              (new)  {[candidateId]: {[scorecardId]: Score}}
sessionCounters     (new)  {date, scoredCount}
```

`savedCandidates` entries gain: `snapshot`, `openToWork`, `stage`, `history[]`.
Existing entries without these fields are migrated lazily on read with defaults, so
nothing he has already saved is lost or needs a migration step.

`chrome.storage.local` has a 10MB quota by default. A few thousand candidates with
scores fits comfortably. If it ever becomes a limit, the fix is the `unlimitedStorage`
permission, not a schema change.

## Testing

The repo has no test infrastructure today. This work adds the minimum: Node's built-in
`node:test`, no framework, no build step, consistent with the project's no-build
philosophy.

| Unit | How it is tested |
|---|---|
| `parseTenure`, `tenureBand`, `diffRole` | Pure unit tests, table-driven, including malformed and ambiguous input |
| `detectOpenToWork` | Fixture-driven against saved DOM samples |
| Recruiter extractors | Fixture-driven against `dom-samples/*.html`, asserting field-by-field |
| Scorer prompt contract | Asserts the parsed response shape, evidence presence on `met`, and that a missing mention yields `unknown` |
| Ban-safety rules | A grep-based test that fails the build on forbidden patterns in `content/` |

The DOM captures therefore do double duty: they unblock parser development and then
become the regression fixtures that catch LinkedIn UI drift.

## Existing-code improvements included

Scoped to what this work needs, not general refactoring:

1. The Claude call is duplicated in `lib/claude-api.js` and
   `background/service-worker.js` with the model id hardcoded in both. The batched
   scorer needs one call path with a configurable model, so these are consolidated to
   a single implementation.
2. Both copies pin `claude-sonnet-4-20250514`; updated to `claude-sonnet-5`.
3. `Storage.addCandidate` pushes without checking for an existing entry, so saving the
   same person twice creates duplicates. The pipeline view makes this visible and
   wrong, so it gains an upsert keyed on profile URL.

Left alone and noted: `content/linkedin-extractor.js` is 676 lines and its experience
parser is heuristic. It works and this change does not depend on restructuring it.

## Phasing

Phases 1-3 are unblocked and deliver value without the DOM captures.

| Phase | Deliverable | Blocked by |
|---|---|---|
| 1 | `utils/signals.js` + tests; tenure band and public open-to-work badge shown on `/in/` profiles | nothing |
| 2 | Scorecards tab: paste JD, edit rubric, save | nothing |
| 3 | Batched scoring on `/in/` profiles with evidence-cited lines | Phases 1, 2 |
| 4 | Recruiter extractor + in-page overlay on `/talent/` | DOM captures |
| 5 | Pipeline tab, snapshots, job-change surface, re-check list | Phases 1, 3 |

## Risks

| Risk | Mitigation |
|---|---|
| Recruiter DOM unknown until captures arrive | Phases 1-3 do not depend on it; parsers are fixture-driven once it lands |
| LinkedIn changes Recruiter markup | Text-based anchors, loud failure state, fixtures catch drift |
| Recruiter A/B tests mean his UI differs from the capture | Captures come from his own account, so they match his UI by construction |
| Model scores look authoritative but are judgment | Every line cites evidence; `unknown` is distinct from `unmet`; score is advisory, never a filter that hides people |
| Scope creep toward automation | The four ban-safety rules are enforced by a test, not by discipline |

## Explicitly out of scope

- Any background, timed, or automatic re-visiting of profiles
- Auto-pagination or auto-expansion of collapsed sections
- Bulk export of candidate data
- LinkedIn official API integration (Talent Solutions is partner-gated and unavailable
  to an individual recruiter)
