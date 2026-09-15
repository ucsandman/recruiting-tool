# Decisions

Durable architecture and product decisions, newest first.

## 2026-09-15 — The extension never automates LinkedIn

**Decision:** content scripts read only DOM already rendered on a page the user
navigated to themselves. Zero requests to linkedin.com, zero synthetic interaction
(no `.click()`, no `setInterval` polling, no auto-pagination), enforced by
`test/ban-safety.test.js` which scans every file listed in `manifest.json`'s
`content_scripts`.

**Why:** LinkedIn's automation detection is largely network- and timing-based, and a
Recruiter seat is expensive to lose. A passive reader that issues no requests has the
same LinkedIn-visible fingerprint as a person reading the page.

**Cost:** content behind a "See more" button is not extracted, because expanding it
requires a synthetic click. Accepted.

**Rejected alternative:** background re-visiting of saved profiles on a timer to detect
job changes. That is the single feature most likely to flag a seat. Job-change detection
runs only when the user opens a profile themselves.

## 2026-09-15 — Absence of evidence is `unknown`, never `unmet`

**Decision:** in `features/candidate-scorer.js`, a criterion the profile does not mention
scores `unknown`. `unknown` is excluded from the score denominator entirely, and when
nothing is decidable `total` is `null`, never `0`.

**Why:** a LinkedIn profile is a marketing document full of omissions. Scoring an
omission as a failure silently discards qualified people, which is the exact failure the
tool exists to prevent. `0%` and "couldn't tell" mean opposite things to a recruiter.

## 2026-09-15 — Cited evidence is verified against the profile, not trusted

**Decision:** `parseResponse(responseText, scorecard, candidates)` takes the candidates
and checks that each cited quote actually occurs in that candidate's profile text. A
quote that does not occur, or that fails a substantiveness floor (a single character, or
punctuation only), downgrades the verdict to `unknown`. Applied to both `met` and `unmet`.

**Why:** without it, any non-empty string counted as a citation, fabricated or not. The
prompt asks the model to quote; the parser is what makes that binding.

**Cost:** a legitimate paraphrase, or a conclusion synthesised across several fields
rather than one span, is downgraded to `unknown`. This biases toward not counting
something rather than counting it wrongly, which is the safe direction for `met` — but on
the `unmet` side it can make an unqualified candidate look stronger. Flagged in the README
and `docs/MANUAL-VERIFICATION.md`.

## 2026-09-15 — A drafted rubric cannot score anyone until a human saves it

**Decision:** `Scorecard.isUsable` requires both `editedAt` set and at least one
must-have. `editedAt` is assigned in exactly one place: the Save button handler.

**Why:** a rubric Claude drafts from a job description reliably over-weights boilerplate
("competitive salary", "team player"). Human review is what makes the rubric trustworthy,
so it is a gate rather than a suggestion. Auto-stamping `editedAt` after deriving would
defeat the whole feature.

## 2026-09-15 — Recruiter parsing keys on `data-test-*` attributes, not text

**Decision:** for the future `/talent/` (LinkedIn Recruiter) work, parse by
`data-test-*` attributes. The public `/in/` extractor keeps its text-based section
finding.

**Why:** measured against real captured Recruiter HTML: Recruiter is an Ember app
carrying 300-450 `data-test-*` attributes per page, including a machine-readable
`data-live-test-decoration-type="openToOpportunities"` for the open-to-work spotlight.
That is stable across renders and language-independent. The public site has no such
attributes, which is why the `/in/` extractor parses `innerText`.

See `docs/superpowers/specs/2026-09-14-recruiter-dom-findings.md`.

## 2026-09-15 — No official LinkedIn API is available

**Context:** LinkedIn's Talent Solutions APIs (Recruiter System Connect, Apply Connect,
Job Posting) are gated behind an approved-partner program requiring a signed agreement,
and the customer's Recruiter contract must have it enabled. Not available to an
individual recruiter, and not self-serve.

**Consequence:** everything reads the rendered page. This is not a shortcut taken over an
available API; the API does not exist for this use case.
