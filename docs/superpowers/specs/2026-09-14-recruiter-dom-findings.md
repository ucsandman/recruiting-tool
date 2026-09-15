# Recruiter DOM Findings

Date: 2026-09-14
Source: two `Webpage, Complete` captures from the recruiter's own Recruiter account,
held in `dom-samples/kirk/` (gitignored, contains real candidate PII).
Supersedes the "Recruiter DOM unknown" risk in the main design.

## Headline result

LinkedIn Recruiter is an internal Ember application carrying **300-450 unique
`data-test-*` attributes per page**. This is the opposite of the public site, where
semantic IDs are gone and the existing `/in/` extractor has to find sections by
header text. Recruiter parsing should use these attributes directly. They are
stable across renders, language-independent, and semantically named.

## Confirmed anchors

### Search results page

13 result rows rendered per page.

| Field | Anchor |
|---|---|
| Result row | `[data-test-paginated-list-item]` |
| Candidate name | `[data-test-link-to-profile-link]` (text) and the row's profile `href` |
| Headline | `[data-test-row-lockup-headline]` |
| Location | `[data-test-row-lockup-location]` |
| Spotlight container | `[data-test-row-decorations]` |
| Individual spotlight | `[data-test-decoration-item]` |

**Result rows carry no tenure or duration.** Name, headline, and location are all
that is available at list level. This is a hard limit on what a results-page triage
pass can judge.

### Spotlights (the open-to-work signal)

Spotlights expose a machine-readable type attribute:

```
data-live-test-decoration-type="openToOpportunities"
```

Types observed across both captures: `openToOpportunities`, `skillsV2`, `views`,
`connections`, `candidateSimilarity`.

Detection should key on `openToOpportunities`, **not** on the visible string
"Open to work". The attribute is language-independent and immune to copy changes.

A second independent confirmation exists on the avatar:
`[data-test-lockup-image]` carries `aria-label="<Name> is open to work"`.

Only one of the 13 rows in the capture carried `openToOpportunities`, while the
page's own metrics card reported "35 are Open to work" for the wider result set.
So the capture is a normal search, not one filtered to open-to-work candidates.
One positive sample is enough to write an attribute selector, but not enough to
observe variation — the Phase 4 parser test asserts against this single known row
and the manual verification step covers the rest.

### Candidate profile view

Structured far beyond what the public profile offers.

| Field | Anchor |
|---|---|
| Position title | `[data-test-position-entity-title]` |
| Company | `[data-test-position-entity-company-name]` |
| Employment status | `[data-test-position-entity-employment-status]` |
| Start date | `[data-test-position-entity-date-range]` e.g. `Mar 2026` |
| **Duration** | `[data-test-position-entity-duration]` e.g. `7 mos`, `2 yrs 10 mos` |
| Location | `[data-test-position-entity-location]` |
| Description | `[data-test-position-entity-description]` |
| Education school | `[data-test-education-entity-school-name]` |
| Education degree | `[data-test-education-entity-degree-name]` |
| Education field | `[data-test-education-entity-field-of-study]` |
| Education dates | `[data-test-education-entity-dates]` |
| Summary | `[data-test-summary-card-text]` |
| Skills | `[data-test-skill-entity-skill-name]` |

**Duration arrives as a clean standalone string.** The heuristic line-by-line
experience parsing that `content/linkedin-extractor.js` needs for the public site is
unnecessary here. `Signals._monthsFromSummary` already parses `2 yrs 10 mos`
directly.

### The open-candidate block — richer than a boolean

`[data-test-open-candidate]` is the private open-to-work detail panel, and it carries
the candidate's stated preferences, not just a flag:

- **Job titles wanted** — e.g. Project Engineer, Field Engineer, Assistant Project Manager
- **Job type** — Contract, Full-time
- **Locations** — On-site and Remote, separately
- **Workplace type**
- **Start date** — e.g. `Immediately, I'm actively applying`

Sub-anchors: `data-test-open-candidate-title`, `-type`, `-job-title`, `-location`,
`-workplace`, `-job-locations`, `-on-site-locations`, `-remote-locations`.

This is the single most valuable thing in either capture. It states what the
candidate wants and how urgently, in their own words. A candidate whose stated
titles overlap the role and whose start date reads "immediately" is a qualitatively
different prospect from a bare open-to-work flag, and the scorer should receive
these fields as input rather than a boolean.

### Contact details

`[data-test-contact-email]` and `[data-test-contact-phone-component]` exist on the
profile view. These are extracted only when a candidate is explicitly saved, never
as part of a bulk triage pass, and never sent to the model. Reading them is not
required for scoring and expands the PII surface for no benefit.

## Corrections to earlier assumptions

1. **Selector strategy.** The main design says Recruiter parsing will follow the
   public extractor's text-based approach. It should not. `data-test-*` attributes
   are better on every axis. Text-based finding stays the fallback for the public
   `/in/` site only.
2. **Duration separator.** The public site joins duration with a middot (`·`); the
   Recruiter profile view uses a bullet (`•`) and an en dash (`–`). `parseTenure` in
   the Phase 1-3 plan splits on `·` alone, which would silently fail on Recruiter
   strings. The summary split must accept both `·` and `•`. Fixed in the Phase 1-3
   plan, Task 2.
3. **`data-test-years-of-experience` is not a computed candidate value.** It is a
   search facet header. Checked rather than assumed; do not build on it.
4. **Recruiter keeps the results list mounted behind the profile view.** Both
   captures contain the same 13 rows and the same decoration counts, because the
   profile opens as a panel over the list. A Phase 4 parser must scope profile
   queries to the profile panel, or it will read the list rows behind it.

## Consequence for Phase 4 design

Because result rows carry only name, headline, and location, the overlay splits into
two passes rather than one:

- **Triage pass (list level)** — rank on headline, location, and the
  `openToOpportunities` spotlight. Cheap, covers 13 rows at once, and is honest
  about being shallow: it narrows, it does not qualify.
- **Qualification pass (profile level)** — full structured experience, education,
  skills, and the open-candidate preference block, scored against the rubric with
  cited evidence. Runs on the profile the recruiter opened himself.

This matches the ban-safety invariant without extra effort, since the recruiter
opens each profile panel himself as part of his normal workflow.
