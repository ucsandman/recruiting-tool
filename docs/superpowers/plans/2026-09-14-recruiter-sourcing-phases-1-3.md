# Recruiter Sourcing — Phases 1-3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the recruiter tenure bands, open-to-work detection, and evidence-cited candidate scoring against a role rubric, on regular LinkedIn profiles (`/in/*`), without depending on the not-yet-captured Recruiter DOM.

**Architecture:** A new pure-JS signal layer (`utils/signals.js`) computes tenure, tenure band, open-to-work presence, and role diffs deterministically with no AI and no network. A new scorecard feature stores a per-role rubric seeded from a pasted job description and edited by the recruiter. A new scorer sends candidates plus one rubric to Claude in a single request and returns per-criterion verdicts that each cite verbatim profile text.

**Tech Stack:** Vanilla JavaScript, Chrome Manifest V3, no build step. Tests use Node's built-in `node:test` runner (Node v24.15.0 present). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-14-recruiter-sourcing-design.md`

## Global Constraints

- **Ban-safety invariant (outranks every feature):** the extension reads only DOM already rendered on a page the recruiter navigated to himself. Content scripts must contain zero of: `fetch(`, `XMLHttpRequest`, `.click(`, `.submit(`, `dispatchEvent`, `setInterval`. Enforced by an automated test in Task 1.
- **No build step.** Files load via plain `<script>` tags in `popup/popup.html` and via `content_scripts` in `manifest.json`. No bundler, no transpiler, no `import`/`export` in shipped files.
- **Shared modules use the dual-global pattern** so the same file works as a browser global and as a Node test import. Exact pattern given in Task 2.
- **Module style follows the repo:** a `const Name = { init(), render(), ... }` object literal, matching `features/boolean-builder.js`.
- **DOM built with `document.createElement`, never `innerHTML`.** The repo already does this everywhere; candidate names and profile text are untrusted input.
- **Model id is `claude-sonnet-5`.** Never reintroduce `claude-sonnet-4-20250514`.
- **Absence of evidence is `unknown`, never `unmet`.** A criterion with no quotable supporting text scores `unknown` and affects the total neither way.
- **Every `met` verdict carries verbatim `evidence`** copied from the candidate's own profile text.
- **Tests are run and their output read before any task is marked done.** A test that has never been observed failing has not been verified.

---

### Task 1: Test harness and the ban-safety guard

Sets up `npm test` with zero dependencies and locks in the constraint that outranks every feature. Done first so every later task is guarded.

**Files:**
- Create: `package.json`
- Create: `test/ban-safety.test.js`
- Modify: `.gitignore` (add `node_modules/` — already present, verify only)

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs every `test/*.test.js`. Later tasks add files to `test/` and need no config change.

- [ ] **Step 1: Write the failing test**

Create `test/ban-safety.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The extension must never issue requests to LinkedIn or synthesize
// interaction with LinkedIn's UI. See the spec's ban-safety invariant.
const FORBIDDEN = [
  { name: 'network call', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'synthetic click', pattern: /\.click\s*\(/ },
  { name: 'synthetic submit', pattern: /\.submit\s*\(/ },
  { name: 'synthetic event', pattern: /\bdispatchEvent\s*\(/ },
  { name: 'polling timer', pattern: /\bsetInterval\s*\(/ }
];

const CONTENT_DIR = path.join(__dirname, '..', 'content');

test('content scripts contain no forbidden automation patterns', () => {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 0, 'expected at least one content script to scan');

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    source.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(line)) {
          violations.push(`${file}:${i + 1} ${rule.name} -> ${line.trim()}`);
        }
      }
    });
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Ban-safety violations found (${files.length} files scanned):\n${violations.join('\n')}`
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/`
Expected: FAIL with `Cannot find module` or no test script configured, because `package.json` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `package.json`:

```json
{
  "name": "recruiter-toolkit",
  "version": "1.0.0",
  "private": true,
  "description": "Chrome extension: AI-powered recruiting assistant",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 1 test. The output must include the scanned-file count in the assertion message path only on failure; on success confirm `# pass 1`.

- [ ] **Step 5: Prove the guard actually fails**

Temporarily append `// eslint-disable-next-line` free line to `content/linkedin-extractor.js`:

```javascript
function __banSafetyProbe() { return fetch('https://example.com'); }
```

Run: `npm test`
Expected: FAIL naming `linkedin-extractor.js` and `network call`.

Then delete those two lines and re-run `npm test`. Expected: PASS.

A guard never observed failing has not been verified. Do not skip this step.

- [ ] **Step 6: Commit**

```bash
git add package.json test/ban-safety.test.js
git commit -m "test: add node:test harness and ban-safety guard for content scripts"
```

---

### Task 2: parseTenure

Turns LinkedIn's duration strings into a month count. Pure function, no DOM, no network.

**Files:**
- Create: `utils/signals.js`
- Create: `test/signals-tenure.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - Global `Signals` in browser contexts, `module.exports = Signals` in Node.
  - `Signals.parseTenure(durationText, now = new Date())` returns
    `{ start: {year, month|null}, end: {year, month|null}|null, months: number, isCurrent: boolean }`
    or `null` when the input carries no usable date information.
  - Note: this refines the spec's `{startISO, endISO, months, isCurrent}` shape. LinkedIn
    frequently gives year-only precision, and a fabricated `-01-01` would read as a real
    date downstream. The `{year, month|null}` shape keeps the missing precision visible.

- [ ] **Step 1: Write the failing test**

Create `test/signals-tenure.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Signals = require('../utils/signals.js');

// Fixed clock so "Present" durations are deterministic.
const NOW = new Date('2026-09-14T00:00:00Z');

test('uses the explicit yr/mo summary when LinkedIn provides one', () => {
  const r = Signals.parseTenure('Jan 2023 - Present · 2 yrs 3 mos', NOW);
  assert.strictEqual(r.months, 27);
  assert.strictEqual(r.isCurrent, true);
  assert.deepStrictEqual(r.start, { year: 2023, month: 1 });
  assert.strictEqual(r.end, null);
});

test('handles a months-only summary', () => {
  const r = Signals.parseTenure('Mar 2026 - Present · 5 mos', NOW);
  assert.strictEqual(r.months, 5);
  assert.strictEqual(r.isCurrent, true);
});

test('handles a years-only summary on a closed range', () => {
  const r = Signals.parseTenure('2019 - 2022 · 3 yrs', NOW);
  assert.strictEqual(r.months, 36);
  assert.strictEqual(r.isCurrent, false);
  assert.deepStrictEqual(r.start, { year: 2019, month: null });
  assert.deepStrictEqual(r.end, { year: 2022, month: null });
});

test('computes months from the date range when no summary is present', () => {
  // Jun 2020 through Aug 2021 inclusive is 15 months, matching LinkedIn.
  const r = Signals.parseTenure('Jun 2020 - Aug 2021', NOW);
  assert.strictEqual(r.months, 15);
  assert.strictEqual(r.isCurrent, false);
});

test('computes months to the current date for an open range with no summary', () => {
  const r = Signals.parseTenure('Jul 2026 - Present', NOW);
  assert.strictEqual(r.months, 3); // Jul, Aug, Sep 2026
  assert.strictEqual(r.isCurrent, true);
});

test('returns null rather than guessing on unparseable input', () => {
  assert.strictEqual(Signals.parseTenure('', NOW), null);
  assert.strictEqual(Signals.parseTenure('Full-time', NOW), null);
  assert.strictEqual(Signals.parseTenure('Present', NOW), null);
  assert.strictEqual(Signals.parseTenure(null, NOW), null);
  assert.strictEqual(Signals.parseTenure(undefined, NOW), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../utils/signals.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `utils/signals.js`:

```javascript
/**
 * Signals
 * Deterministic candidate signals derived from already-extracted profile text.
 * Pure functions: no DOM, no network, no AI. See the ban-safety invariant.
 */

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

const Signals = {
  /**
   * Parse a LinkedIn duration string into a month count.
   * @param {string} durationText e.g. "Jan 2023 - Present · 2 yrs 3 mos"
   * @param {Date} now injected for deterministic tests
   * @returns {{start, end, months, isCurrent}|null} null if unparseable
   */
  parseTenure(durationText, now = new Date()) {
    if (typeof durationText !== 'string' || durationText.trim() === '') return null;

    const text = durationText.trim();
    const isCurrent = /\bpresent\b/i.test(text);

    // Split off the "· 2 yrs 3 mos" summary, if any.
    const parts = text.split('·');
    const rangePart = parts[0].trim();
    const summaryPart = parts.length > 1 ? parts.slice(1).join('·').trim() : '';

    const endpoints = rangePart.split(/\s+[-–]\s+/).map(s => s.trim());
    const start = this._parsePoint(endpoints[0]);
    if (!start) return null;

    const rawEnd = endpoints.length > 1 ? endpoints[1] : '';
    const end = isCurrent ? null : this._parsePoint(rawEnd);
    if (!isCurrent && !end) return null;

    let months = this._monthsFromSummary(summaryPart);
    if (months === null) {
      const endPoint = isCurrent
        ? { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
        : end;
      months = this._monthsBetween(start, endPoint);
    }
    if (months === null) return null;

    return { start, end, months, isCurrent };
  },

  /** "Jan 2023" -> {year:2023, month:1}; "2019" -> {year:2019, month:null} */
  _parsePoint(text) {
    if (typeof text !== 'string') return null;
    const withMonth = text.trim().match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
    if (withMonth) {
      const month = MONTHS[withMonth[1].toLowerCase()];
      if (!month) return null;
      return { year: parseInt(withMonth[2], 10), month };
    }
    const yearOnly = text.trim().match(/^(\d{4})$/);
    if (yearOnly) return { year: parseInt(yearOnly[1], 10), month: null };
    return null;
  },

  /** "2 yrs 3 mos" -> 27; "3 yrs" -> 36; "5 mos" -> 5; no match -> null */
  _monthsFromSummary(text) {
    if (!text) return null;
    const years = text.match(/(\d+)\s*(?:yr|yrs|year|years)\b/i);
    const months = text.match(/(\d+)\s*(?:mo|mos|month|months)\b/i);
    if (!years && !months) return null;
    return (years ? parseInt(years[1], 10) * 12 : 0)
         + (months ? parseInt(months[1], 10) : 0);
  },

  /** Inclusive month span, matching how LinkedIn counts. */
  _monthsBetween(start, end) {
    if (!start || !end) return null;
    const startMonth = start.month || 1;
    const endMonth = end.month || 12;
    const span = (end.year - start.year) * 12 + (endMonth - startMonth) + 1;
    return span > 0 ? span : null;
  }
};

// Dual export: a browser global for content scripts and the popup,
// a CommonJS module for the Node test runner. No build step.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Signals;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. 7 tests total (1 ban-safety + 6 tenure). Read the output and confirm no test was skipped.

- [ ] **Step 5: Commit**

```bash
git add utils/signals.js test/signals-tenure.test.js
git commit -m "feat: add parseTenure for LinkedIn duration strings"
```

---

### Task 3: tenureBand and diffRole

Turns a month count into an advisory movability label, and detects that a saved candidate changed roles.

**Files:**
- Modify: `utils/signals.js`
- Create: `test/signals-band-diff.test.js`

**Interfaces:**
- Consumes: `Signals.parseTenure` from Task 2.
- Produces:
  - `Signals.tenureBand(months)` returns `'new' | 'settling' | 'prime' | 'entrenched' | 'unknown'`.
  - `Signals.diffRole(prev, next)` returns `{changed, from, to, kind}` where `kind` is
    `'company-change' | 'title-change' | 'both' | 'none'`. Snapshots are
    `{title, company}` objects; either side may be `null`.

- [ ] **Step 1: Write the failing test**

Create `test/signals-band-diff.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Signals = require('../utils/signals.js');

test('tenureBand labels each movability range', () => {
  assert.strictEqual(Signals.tenureBand(0), 'new');
  assert.strictEqual(Signals.tenureBand(5), 'new');
  assert.strictEqual(Signals.tenureBand(6), 'settling');
  assert.strictEqual(Signals.tenureBand(17), 'settling');
  assert.strictEqual(Signals.tenureBand(18), 'prime');
  assert.strictEqual(Signals.tenureBand(47), 'prime');
  assert.strictEqual(Signals.tenureBand(48), 'entrenched');
  assert.strictEqual(Signals.tenureBand(300), 'entrenched');
});

test('tenureBand reports unknown rather than defaulting to new', () => {
  assert.strictEqual(Signals.tenureBand(null), 'unknown');
  assert.strictEqual(Signals.tenureBand(undefined), 'unknown');
  assert.strictEqual(Signals.tenureBand(-1), 'unknown');
  assert.strictEqual(Signals.tenureBand('12'), 'unknown');
});

test('diffRole detects a company change', () => {
  const r = Signals.diffRole(
    { title: 'Senior Engineer', company: 'Acme' },
    { title: 'Senior Engineer', company: 'Globex' }
  );
  assert.strictEqual(r.changed, true);
  assert.strictEqual(r.kind, 'company-change');
  assert.strictEqual(r.from.company, 'Acme');
  assert.strictEqual(r.to.company, 'Globex');
});

test('diffRole detects a title change', () => {
  const r = Signals.diffRole(
    { title: 'Engineer', company: 'Acme' },
    { title: 'Staff Engineer', company: 'Acme' }
  );
  assert.strictEqual(r.kind, 'title-change');
});

test('diffRole detects both changing at once', () => {
  const r = Signals.diffRole(
    { title: 'Engineer', company: 'Acme' },
    { title: 'Director', company: 'Globex' }
  );
  assert.strictEqual(r.kind, 'both');
});

test('diffRole ignores whitespace and case noise', () => {
  const r = Signals.diffRole(
    { title: 'Engineer', company: 'Acme' },
    { title: '  engineer ', company: 'ACME' }
  );
  assert.strictEqual(r.changed, false);
  assert.strictEqual(r.kind, 'none');
});

test('diffRole treats a missing snapshot as no detectable change', () => {
  const r = Signals.diffRole(null, { title: 'Engineer', company: 'Acme' });
  assert.strictEqual(r.changed, false);
  assert.strictEqual(r.kind, 'none');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Signals.tenureBand is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `utils/signals.js`, add these methods to the `Signals` object, after `parseTenure`:

```javascript
  /**
   * Advisory movability label. Not a filter: the recruiter decides.
   * @param {number} months from parseTenure
   */
  tenureBand(months) {
    if (typeof months !== 'number' || !Number.isFinite(months) || months < 0) {
      return 'unknown';
    }
    if (months < 6) return 'new';
    if (months < 18) return 'settling';
    if (months < 48) return 'prime';
    return 'entrenched';
  },

  /**
   * Compare a stored role snapshot against what a page just showed.
   * @param {{title,company}|null} prev
   * @param {{title,company}|null} next
   */
  diffRole(prev, next) {
    const none = { changed: false, from: prev || null, to: next || null, kind: 'none' };
    if (!prev || !next) return none;

    const norm = v => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const titleChanged = norm(prev.title) !== norm(next.title);
    const companyChanged = norm(prev.company) !== norm(next.company);

    if (!titleChanged && !companyChanged) return none;

    let kind = 'none';
    if (titleChanged && companyChanged) kind = 'both';
    else if (companyChanged) kind = 'company-change';
    else kind = 'title-change';

    return { changed: true, from: prev, to: next, kind };
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 14 tests total. Read the output.

- [ ] **Step 5: Commit**

```bash
git add utils/signals.js test/signals-band-diff.test.js
git commit -m "feat: add tenureBand and diffRole signals"
```

---

### Task 4: detectOpenToWork

Detects the public `#OpenToWork` signal from already-extracted profile text, and reports which source it came from.

**Files:**
- Modify: `utils/signals.js`
- Create: `test/signals-open-to-work.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Signals.detectOpenToWork(profileData, now = new Date())` returns
  `{ open: boolean, source: 'public-badge' | 'recruiter-spotlight' | null, seenAt: string|null }`.
  `profileData` is the object returned by `content/linkedin-extractor.js`, extended in
  Task 5 with a `topCardText` field and optionally a `recruiterSpotlights` array (populated
  in Phase 4, read here so the function needs no change later).
  `seenAt` is an ISO timestamp when `open` is true, otherwise `null`.

- [ ] **Step 1: Write the failing test**

Create `test/signals-open-to-work.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Signals = require('../utils/signals.js');

const NOW = new Date('2026-09-14T00:00:00Z');

test('detects the public badge from top card text', () => {
  const r = Signals.detectOpenToWork({
    topCardText: 'Dana Reyes\nSenior Engineer at Acme\nOpen to work\nSoftware Engineer roles\nSee all details'
  }, NOW);
  assert.strictEqual(r.open, true);
  assert.strictEqual(r.source, 'public-badge');
  assert.strictEqual(r.seenAt, NOW.toISOString());
});

test('detects the badge regardless of casing', () => {
  const r = Signals.detectOpenToWork({ topCardText: 'OPEN TO WORK' }, NOW);
  assert.strictEqual(r.open, true);
});

test('prefers the recruiter spotlight when both are present', () => {
  const r = Signals.detectOpenToWork({
    topCardText: 'Open to work',
    recruiterSpotlights: ['Open to work', 'Past applicant']
  }, NOW);
  assert.strictEqual(r.source, 'recruiter-spotlight');
  assert.strictEqual(r.open, true);
});

test('reports not-open when no signal is present', () => {
  const r = Signals.detectOpenToWork({ topCardText: 'Dana Reyes\nSenior Engineer' }, NOW);
  assert.deepStrictEqual(r, { open: false, source: null, seenAt: null });
});

test('does not fire on a candidate who is hiring rather than looking', () => {
  const r = Signals.detectOpenToWork({ topCardText: 'Hiring\nWe are open to work with partners' }, NOW);
  assert.strictEqual(r.open, false);
});

test('tolerates a missing or malformed profile object', () => {
  assert.strictEqual(Signals.detectOpenToWork(null, NOW).open, false);
  assert.strictEqual(Signals.detectOpenToWork({}, NOW).open, false);
  assert.strictEqual(Signals.detectOpenToWork({ topCardText: 123 }, NOW).open, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Signals.detectOpenToWork is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `utils/signals.js`, add to the `Signals` object:

```javascript
  /**
   * Open-to-work detection with provenance.
   * Two independent sources; the recruiter sees which one fired.
   * @param {object} profileData from the extractors
   * @param {Date} now injected for deterministic tests
   */
  detectOpenToWork(profileData, now = new Date()) {
    const closed = { open: false, source: null, seenAt: null };
    if (!profileData || typeof profileData !== 'object') return closed;

    // Recruiter spotlight wins: it is the stronger, intent-declared signal.
    const spotlights = Array.isArray(profileData.recruiterSpotlights)
      ? profileData.recruiterSpotlights
      : [];
    if (spotlights.some(s => typeof s === 'string' && /open to work/i.test(s))) {
      return { open: true, source: 'recruiter-spotlight', seenAt: now.toISOString() };
    }

    const topCard = typeof profileData.topCardText === 'string' ? profileData.topCardText : '';
    // Match the badge phrase as its own line. A profile that merely contains the
    // words ("open to work with partners") must not fire.
    const badge = topCard.split('\n').some(line => /^\s*#?open\s+to\s+work\s*$/i.test(line));
    if (badge) {
      return { open: true, source: 'public-badge', seenAt: now.toISOString() };
    }

    return closed;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 20 tests total.

- [ ] **Step 5: Commit**

```bash
git add utils/signals.js test/signals-open-to-work.test.js
git commit -m "feat: add detectOpenToWork with source provenance"
```

---

### Task 5: Extract topCardText and surface signals on the profile

Feeds the extractor's top-card text into `detectOpenToWork`, and shows tenure band plus open-to-work status in the summarizer UI.

**Files:**
- Modify: `content/linkedin-extractor.js` (add `topCardText` to the extracted object)
- Modify: `manifest.json` (load `utils/signals.js` into the content script)
- Modify: `popup/popup.html:134-141` (add the `utils/signals.js` script tag)
- Modify: `features/profile-summarizer.js` (render the signal row)
- Create: `test/extractor-topcard.test.js`

**Interfaces:**
- Consumes: `Signals.parseTenure`, `Signals.tenureBand`, `Signals.detectOpenToWork`.
- Produces: extracted profile objects gain `topCardText: string`. Nothing else changes shape.

- [ ] **Step 1: Write the failing test**

Create `test/extractor-topcard.test.js`. This tests the pure helper, not the DOM:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Signals = require('../utils/signals.js');

// End-to-end over the signal layer using the shape the extractor produces.
test('a profile with a badge and recent start reads as new and open', () => {
  const profile = {
    topCardText: 'Dana Reyes\nOpen to work\nSoftware Engineer roles',
    currentRole: { title: 'Engineer', company: 'Acme', duration: 'Jul 2026 - Present · 3 mos' }
  };
  const now = new Date('2026-09-14T00:00:00Z');

  const otw = Signals.detectOpenToWork(profile, now);
  const tenure = Signals.parseTenure(profile.currentRole.duration, now);
  const band = Signals.tenureBand(tenure.months);

  assert.strictEqual(otw.open, true);
  assert.strictEqual(otw.source, 'public-badge');
  assert.strictEqual(band, 'new');
});

test('an unparseable duration surfaces as unknown, not as a zero-month tenure', () => {
  const tenure = Signals.parseTenure('Full-time', new Date());
  assert.strictEqual(tenure, null);
  assert.strictEqual(Signals.tenureBand(tenure && tenure.months), 'unknown');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: PASS actually — this test exercises only Tasks 2-4. Run it to confirm the
signal layer composes correctly before wiring the DOM. If it fails, the bug is in
Tasks 2-4 and must be fixed there, not papered over here.

- [ ] **Step 3: Add topCardText to the extractor**

In `content/linkedin-extractor.js`, inside `extractProfileData()`, add a `topCardText`
field to the returned object. The top card is the first `<section>` on the page; the
existing `findSectionByHeader` helper does not apply because the top card has no header.

```javascript
/**
 * Raw text of the profile top card, used for badge detection.
 * The top card is the first section and carries no header, so it is
 * located positionally rather than by header text.
 */
function extractTopCardText() {
  const main = document.querySelector('main');
  if (!main) return '';
  const firstSection = main.querySelector('section');
  if (!firstSection) return '';
  return (firstSection.innerText || '').trim();
}
```

Then add `topCardText: extractTopCardText(),` to the object returned by `extractProfileData()`.

- [ ] **Step 4: Load signals.js everywhere it is needed**

In `manifest.json`, change the content script entry so `signals.js` loads first:

```json
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/in/*"],
      "js": ["utils/signals.js", "content/linkedin-extractor.js"]
    }
  ],
```

In `popup/popup.html`, add one line immediately after the `storage.js` tag (line 134):

```html
  <script src="../utils/signals.js"></script>
```

- [ ] **Step 5: Render the signal row in the summarizer**

In `features/profile-summarizer.js`, add this method to the module object and call it
where the profile result is rendered, passing the extracted profile:

```javascript
  /**
   * Build the deterministic signal row: tenure band and open-to-work status.
   * Computed locally, never sent to the model.
   */
  renderSignals(profile) {
    const row = document.createElement('div');
    row.className = 'signal-row';

    const tenure = Signals.parseTenure(profile.currentRole && profile.currentRole.duration);
    const band = Signals.tenureBand(tenure && tenure.months);
    const otw = Signals.detectOpenToWork(profile);

    const LABELS = {
      new: 'Just started',
      settling: 'Settling in',
      prime: 'Prime to move',
      entrenched: 'Long tenure',
      unknown: 'Tenure unknown'
    };

    const tenureChip = document.createElement('span');
    tenureChip.className = `chip chip-tenure chip-${band}`;
    tenureChip.textContent = tenure
      ? `${LABELS[band]} (${tenure.months} mo)`
      : LABELS.unknown;
    row.appendChild(tenureChip);

    if (otw.open) {
      const otwChip = document.createElement('span');
      otwChip.className = 'chip chip-open';
      otwChip.textContent = otw.source === 'recruiter-spotlight'
        ? 'Open to work (recruiter signal)'
        : 'Open to work (public badge)';
      row.appendChild(otwChip);
    }

    return row;
  },
```

Add matching styles to `popup/popup.css`:

```css
.signal-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chip { font-size: 11px; padding: 3px 8px; border-radius: 10px; background: #eef1f5; color: #333; }
.chip-new { background: #fdecea; color: #8a2a22; }
.chip-settling { background: #fff5e0; color: #7a5a10; }
.chip-prime { background: #e6f5ea; color: #1d6b33; }
.chip-entrenched { background: #eef1f5; color: #444; }
.chip-unknown { background: #f1f1f1; color: #666; }
.chip-open { background: #e3f0ff; color: #14508a; }
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS, 22 tests. The ban-safety guard must still pass with the modified
extractor — confirm it scanned the file by checking no violation is reported.

- [ ] **Step 7: Verify in the real extension**

This is the first change with a visible surface, so it gets looked at, not assumed.

1. Open `chrome://extensions`, Developer mode on, reload the Recruiter Toolkit card.
2. Open a real LinkedIn profile of someone with the green `#OpenToWork` photo ring.
3. Open the extension, run Summarize.
4. Confirm: a tenure chip appears with a plausible month count, and an
   "Open to work (public badge)" chip appears.
5. Open a profile of someone **without** the ring. Confirm the open-to-work chip
   is absent and the tenure chip still renders.

If the badge chip does not appear on a profile that visibly has the ring, the
anchor text in `detectOpenToWork` does not match what LinkedIn renders. Capture the
actual top card text (`document.querySelector('main section').innerText` in DevTools),
add it as a test case in `test/signals-open-to-work.test.js`, and fix the matcher.
Do not loosen the matcher to a bare substring — that reintroduces the
"hiring / open to work with partners" false positive the test already covers.

- [ ] **Step 8: Commit**

```bash
git add content/linkedin-extractor.js manifest.json popup/popup.html popup/popup.css features/profile-summarizer.js test/extractor-topcard.test.js
git commit -m "feat: surface tenure band and open-to-work signals on profiles"
```

---

### Task 6: Consolidate the Claude API call and move to claude-sonnet-5

The scorer needs one call path with a configurable model and larger token budget. Today the call is duplicated in two files, both pinning a stale model id.

**Files:**
- Modify: `lib/claude-api.js`
- Modify: `background/service-worker.js:41-77`
- Create: `test/claude-api-config.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CLAUDE_MODEL` constant equal to `'claude-sonnet-5'`, exported for tests.
  - `callClaude(prompt, apiKey, maxTokens = 1024, model = CLAUDE_MODEL)`.
  - The service worker delegates to the same request builder rather than duplicating it.

- [ ] **Step 1: Write the failing test**

Create `test/claude-api-config.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('no file pins the superseded model id', () => {
  const files = ['lib/claude-api.js', 'background/service-worker.js'];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(
      !src.includes('claude-sonnet-4-20250514'),
      `${rel} still pins the superseded model id`
    );
  }
});

test('the request builder is defined once, not duplicated', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'background/service-worker.js'), 'utf8');
  const apiUrlOccurrences = (sw.match(/api\.anthropic\.com/g) || []).length;
  assert.strictEqual(
    apiUrlOccurrences, 0,
    'service-worker.js should delegate to the shared builder, not rebuild the request'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on both tests — the stale model id is present in both files, and
`service-worker.js` contains its own `api.anthropic.com` request.

- [ ] **Step 3: Write the implementation**

In `lib/claude-api.js`, change the model constant and the signature:

```javascript
const CLAUDE_MODEL = 'claude-sonnet-5';
```

```javascript
async function callClaude(prompt, apiKey, maxTokens = 1024, model = CLAUDE_MODEL) {
```

and inside the request body, replace `model: CLAUDE_MODEL,` with `model,`.

At the end of `lib/claude-api.js`, add the dual export so the service worker and tests
can both reach it:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { callClaude, validateApiKey, CLAUDE_MODEL };
}
```

In `background/service-worker.js`, delete the entire duplicated `handleClaudeCall`
function body (lines 41-77) and replace it by importing the shared file at the top of
the service worker:

```javascript
importScripts('../lib/claude-api.js');
```

and reducing the handler to:

```javascript
/**
 * Make a call to Claude API. The request itself lives in lib/claude-api.js
 * so there is exactly one place the model id and headers are set.
 */
async function handleClaudeCall(prompt, apiKey, maxTokens = 1024, model) {
  return callClaude(prompt, apiKey, maxTokens, model);
}
```

Also forward the model through the message handler, changing the `callClaude` branch:

```javascript
  if (request.action === 'callClaude') {
    handleClaudeCall(request.prompt, request.apiKey, request.maxTokens, request.model)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 24 tests.

- [ ] **Step 5: Verify the extension still calls the API**

Reload the extension, open a LinkedIn profile, run Summarize. Expected: a summary
returns as before. If it fails with a service worker error, check
`chrome://extensions` for the service worker's error log — `importScripts` paths are
relative to the service worker file.

- [ ] **Step 6: Commit**

```bash
git add lib/claude-api.js background/service-worker.js test/claude-api-config.test.js
git commit -m "refactor: single Claude request builder, move to claude-sonnet-5"
```

---

### Task 7: Scorecard data model and storage

Stores one rubric per open role. Pure logic plus storage helpers, no UI yet.

**Files:**
- Create: `features/scorecard.js` (data layer only in this task)
- Modify: `utils/storage.js`
- Create: `test/scorecard-model.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Scorecard.create({roleName})` returns a new scorecard with `id`, empty criterion
    arrays, `createdAt`, and `editedAt: null`.
  - `Scorecard.isUsable(scorecard)` returns `true` only when `editedAt` is set and at
    least one `mustHaves` entry exists.
  - `Scorecard.addCriterion(scorecard, bucket, text, weight)` returns a new scorecard
    with the criterion appended. `bucket` is `'mustHaves' | 'niceToHaves' | 'dealbreakers'`.
  - `Storage.getScorecards()`, `Storage.saveScorecard(scorecard)` (upsert by id),
    `Storage.removeScorecard(id)`.

- [ ] **Step 1: Write the failing test**

Create `test/scorecard-model.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Scorecard = require('../features/scorecard.js');

test('a new scorecard starts empty and unusable', () => {
  const sc = Scorecard.create({ roleName: 'Senior Backend Engineer' });
  assert.strictEqual(sc.roleName, 'Senior Backend Engineer');
  assert.deepStrictEqual(sc.mustHaves, []);
  assert.deepStrictEqual(sc.niceToHaves, []);
  assert.deepStrictEqual(sc.dealbreakers, []);
  assert.strictEqual(sc.editedAt, null);
  assert.ok(sc.id, 'expected a generated id');
  assert.strictEqual(Scorecard.isUsable(sc), false);
});

test('a scorecard with criteria is still unusable until the recruiter edits it', () => {
  // Auto-derived rubrics over-weight JD boilerplate. The edit gate is the
  // whole reason the derived rubric is trustworthy.
  let sc = Scorecard.create({ roleName: 'Role' });
  sc = Scorecard.addCriterion(sc, 'mustHaves', '5+ years Python', 3);
  assert.strictEqual(Scorecard.isUsable(sc), false);

  sc = { ...sc, editedAt: new Date().toISOString() };
  assert.strictEqual(Scorecard.isUsable(sc), true);
});

test('an edited scorecard with no must-haves is unusable', () => {
  let sc = Scorecard.create({ roleName: 'Role' });
  sc = { ...sc, editedAt: new Date().toISOString() };
  assert.strictEqual(Scorecard.isUsable(sc), false);
});

test('addCriterion does not mutate the original', () => {
  const sc = Scorecard.create({ roleName: 'Role' });
  const next = Scorecard.addCriterion(sc, 'mustHaves', 'Kubernetes', 2);
  assert.strictEqual(sc.mustHaves.length, 0);
  assert.strictEqual(next.mustHaves.length, 1);
  assert.strictEqual(next.mustHaves[0].text, 'Kubernetes');
  assert.strictEqual(next.mustHaves[0].weight, 2);
  assert.ok(next.mustHaves[0].id);
});

test('addCriterion rejects an unknown bucket', () => {
  const sc = Scorecard.create({ roleName: 'Role' });
  assert.throws(() => Scorecard.addCriterion(sc, 'maybes', 'x', 1), /unknown bucket/i);
});

test('criterion ids are unique within a scorecard', () => {
  let sc = Scorecard.create({ roleName: 'Role' });
  for (let i = 0; i < 20; i++) sc = Scorecard.addCriterion(sc, 'mustHaves', `c${i}`, 1);
  const ids = new Set(sc.mustHaves.map(c => c.id));
  assert.strictEqual(ids.size, 20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../features/scorecard.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `features/scorecard.js`:

```javascript
/**
 * Scorecard
 * A per-role rubric. Seeded from a pasted job description, then edited by the
 * recruiter before it is allowed to score anyone.
 */

const BUCKETS = ['mustHaves', 'niceToHaves', 'dealbreakers'];

let idCounter = 0;
function newId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

const Scorecard = {
  create({ roleName }) {
    return {
      id: newId('sc'),
      roleName: roleName || 'Untitled role',
      createdAt: new Date().toISOString(),
      editedAt: null,
      mustHaves: [],
      niceToHaves: [],
      dealbreakers: []
    };
  },

  addCriterion(scorecard, bucket, text, weight = 1) {
    if (!BUCKETS.includes(bucket)) {
      throw new Error(`Unknown bucket: ${bucket}`);
    }
    const criterion = { id: newId('cr'), text, weight };
    return { ...scorecard, [bucket]: [...scorecard[bucket], criterion] };
  },

  /**
   * A scorecard may only score candidates after the recruiter has opened and
   * saved it, and only if it actually states what the role requires.
   */
  isUsable(scorecard) {
    if (!scorecard || typeof scorecard !== 'object') return false;
    if (!scorecard.editedAt) return false;
    return Array.isArray(scorecard.mustHaves) && scorecard.mustHaves.length > 0;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorecard;
}
```

In `utils/storage.js`, add these helpers to the `Storage` object, after the candidate helpers:

```javascript
  // Scorecard helpers
  async getScorecards() {
    return (await this.get('scorecards')) || [];
  },

  async saveScorecard(scorecard) {
    const all = await this.getScorecards();
    const index = all.findIndex(s => s.id === scorecard.id);
    if (index >= 0) all[index] = scorecard;
    else all.push(scorecard);
    return this.set('scorecards', all);
  },

  async removeScorecard(id) {
    const all = await this.getScorecards();
    return this.set('scorecards', all.filter(s => s.id !== id));
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 30 tests.

- [ ] **Step 5: Commit**

```bash
git add features/scorecard.js utils/storage.js test/scorecard-model.test.js
git commit -m "feat: add scorecard model and storage with an edit gate"
```

---

### Task 8: Derive a rubric from a pasted job description

Turns a JD into proposed criteria via one Claude call, and parses the response defensively.

**Files:**
- Modify: `features/scorecard.js`
- Create: `test/scorecard-derive.test.js`

**Interfaces:**
- Consumes: `Scorecard.create`, `Scorecard.addCriterion` from Task 7.
- Produces:
  - `Scorecard.buildDerivePrompt(jobDescription)` returns a string prompt.
  - `Scorecard.parseDerivedRubric(responseText)` returns
    `{mustHaves: [{text, weight}], niceToHaves: [...], dealbreakers: [{text}]}`
    or throws a descriptive `Error` on unusable output.

- [ ] **Step 1: Write the failing test**

Create `test/scorecard-derive.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const Scorecard = require('../features/scorecard.js');

test('the prompt includes the job description and demands strict JSON', () => {
  const p = Scorecard.buildDerivePrompt('We need a backend engineer with Go experience.');
  assert.ok(p.includes('We need a backend engineer with Go experience.'));
  assert.ok(/json/i.test(p));
});

test('parses a well-formed response', () => {
  const r = Scorecard.parseDerivedRubric(JSON.stringify({
    mustHaves: [{ text: '5+ years backend', weight: 3 }],
    niceToHaves: [{ text: 'Kubernetes', weight: 1 }],
    dealbreakers: [{ text: 'Requires visa sponsorship' }]
  }));
  assert.strictEqual(r.mustHaves[0].text, '5+ years backend');
  assert.strictEqual(r.mustHaves[0].weight, 3);
  assert.strictEqual(r.dealbreakers[0].text, 'Requires visa sponsorship');
});

test('tolerates a response wrapped in a markdown code fence', () => {
  const r = Scorecard.parseDerivedRubric(
    '```json\n{"mustHaves":[{"text":"Go","weight":2}],"niceToHaves":[],"dealbreakers":[]}\n```'
  );
  assert.strictEqual(r.mustHaves[0].text, 'Go');
});

test('defaults a missing weight to 1 rather than dropping the criterion', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go"}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 1);
});

test('drops entries with no usable text instead of creating blank criteria', () => {
  const r = Scorecard.parseDerivedRubric(
    '{"mustHaves":[{"text":"Go"},{"text":"   "},{"weight":2}],"niceToHaves":[],"dealbreakers":[]}'
  );
  assert.strictEqual(r.mustHaves.length, 1);
});

test('throws a descriptive error on non-JSON output', () => {
  assert.throws(
    () => Scorecard.parseDerivedRubric('Sure! Here is a rubric for you.'),
    /could not read/i
  );
});

test('throws when the model returns no must-haves at all', () => {
  assert.throws(
    () => Scorecard.parseDerivedRubric('{"mustHaves":[],"niceToHaves":[],"dealbreakers":[]}'),
    /no must-haves/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Scorecard.buildDerivePrompt is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `features/scorecard.js`, inside the `Scorecard` object:

```javascript
  buildDerivePrompt(jobDescription) {
    return [
      'You are helping a recruiter turn a job description into a screening rubric.',
      '',
      'Extract only requirements that can actually be judged from a LinkedIn profile.',
      'Skip benefits, company boilerplate, equal-opportunity statements, and anything',
      'about the hiring process. Prefer few sharp criteria over many vague ones.',
      '',
      'Weights are 1 to 3, where 3 means the role fails without it.',
      '',
      'Respond with JSON only, no prose and no code fence, in exactly this shape:',
      '{"mustHaves":[{"text":"...","weight":3}],',
      ' "niceToHaves":[{"text":"...","weight":1}],',
      ' "dealbreakers":[{"text":"..."}]}',
      '',
      'Job description:',
      jobDescription
    ].join('\n');
  },

  parseDerivedRubric(responseText) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
      throw new Error('Could not read the rubric: the model returned nothing.');
    }

    // Models sometimes wrap JSON in a fence despite instructions.
    let text = responseText.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Could not read the rubric: the response was not valid JSON.');
    }

    const clean = (list, withWeight) => (Array.isArray(list) ? list : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim() !== '')
      .map(item => withWeight
        ? { text: item.text.trim(), weight: Number.isFinite(item.weight) ? item.weight : 1 }
        : { text: item.text.trim() });

    const rubric = {
      mustHaves: clean(parsed.mustHaves, true),
      niceToHaves: clean(parsed.niceToHaves, true),
      dealbreakers: clean(parsed.dealbreakers, false)
    };

    if (rubric.mustHaves.length === 0) {
      throw new Error('The rubric has no must-haves. Add at least one before scoring.');
    }

    return rubric;
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 37 tests.

- [ ] **Step 5: Commit**

```bash
git add features/scorecard.js test/scorecard-derive.test.js
git commit -m "feat: derive a screening rubric from a pasted job description"
```

---

### Task 9: Scorecards tab UI

The recruiter's surface for creating, editing, and saving a rubric. Nothing scores until he saves.

**Files:**
- Modify: `popup/popup.html` (tab button, section, script tag)
- Modify: `popup/popup.js` (`initializeTab` case)
- Modify: `features/scorecard.js` (add the UI module)
- Modify: `popup/popup.css`

**Interfaces:**
- Consumes: `Scorecard.create`, `addCriterion`, `isUsable`, `buildDerivePrompt`,
  `parseDerivedRubric`, `Storage.getScorecards/saveScorecard/removeScorecard`,
  `callClaude`.
- Produces: `ScorecardUI.init()` following the `BooleanBuilder.init()` convention.

- [ ] **Step 1: Add the tab shell**

In `popup/popup.html`, add a tab button after the questions button (line 55 area),
matching the existing markup exactly:

```html
      <button class="tab-btn" data-tab="scorecards" title="Scorecards">
        Scorecards
      </button>
```

Add the section after `tab-questions` (line 83 area):

```html
      <section id="tab-scorecards" class="tab-content">
        <div id="scorecards-container"></div>
      </section>
```

Add the script tag after `question-generator.js` (line 140):

```html
  <script src="../features/scorecard.js"></script>
```

- [ ] **Step 2: Wire the tab**

In `popup/popup.js`, in `initializeTab`'s `switch` statement, add:

```javascript
    case 'scorecards':
      ScorecardUI.init();
      break;
```

- [ ] **Step 3: Implement the UI module**

Append to `features/scorecard.js`, after the `Scorecard` object and before the export block:

```javascript
/**
 * Scorecard UI
 * Create a rubric from a pasted JD, edit it, save it. A scorecard cannot
 * score anyone until it has been saved at least once.
 */
const ScorecardUI = {
  container: null,
  initialized: false,
  current: null,

  init() {
    this.container = document.getElementById('scorecards-container');
    if (!this.container) return;
    if (!this.initialized) {
      this.initialized = true;
    }
    this.renderList();
  },

  async renderList() {
    this.container.textContent = '';
    const all = await Storage.getScorecards();

    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-primary';
    newBtn.textContent = 'New scorecard from a job description';
    newBtn.addEventListener('click', () => this.renderCreate());
    this.container.appendChild(newBtn);

    if (all.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No scorecards yet. Paste a job description to build one.';
      this.container.appendChild(empty);
      return;
    }

    all.forEach(sc => {
      const card = document.createElement('div');
      card.className = 'card scorecard-row';

      const name = document.createElement('strong');
      name.textContent = sc.roleName;
      card.appendChild(name);

      const status = document.createElement('span');
      status.className = Scorecard.isUsable(sc) ? 'chip chip-prime' : 'chip chip-unknown';
      status.textContent = Scorecard.isUsable(sc) ? 'Ready to score' : 'Needs review';
      card.appendChild(status);

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => this.renderEdit(sc));
      card.appendChild(edit);

      this.container.appendChild(card);
    });
  },

  renderCreate() {
    this.container.textContent = '';

    const nameInput = document.createElement('input');
    nameInput.className = 'form-input';
    nameInput.placeholder = 'Role name, e.g. Senior Backend Engineer';

    const jdInput = document.createElement('textarea');
    jdInput.className = 'form-input';
    jdInput.rows = 12;
    jdInput.placeholder = 'Paste the full job description here';

    const go = document.createElement('button');
    go.className = 'btn btn-primary';
    go.textContent = 'Build rubric';
    go.addEventListener('click', async () => {
      const jd = jdInput.value.trim();
      if (jd === '') {
        showToast('Paste a job description first', 'error');
        return;
      }
      go.disabled = true;
      try {
        const apiKey = await Storage.getApiKey();
        const raw = await callClaude(Scorecard.buildDerivePrompt(jd), apiKey, 2048);
        const rubric = Scorecard.parseDerivedRubric(raw);

        let sc = Scorecard.create({ roleName: nameInput.value.trim() || 'Untitled role' });
        rubric.mustHaves.forEach(c => { sc = Scorecard.addCriterion(sc, 'mustHaves', c.text, c.weight); });
        rubric.niceToHaves.forEach(c => { sc = Scorecard.addCriterion(sc, 'niceToHaves', c.text, c.weight); });
        rubric.dealbreakers.forEach(c => { sc = Scorecard.addCriterion(sc, 'dealbreakers', c.text, 1); });

        this.renderEdit(sc);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        go.disabled = false;
      }
    });

    [nameInput, jdInput, go].forEach(el => this.container.appendChild(el));
  },

  renderEdit(scorecard) {
    this.current = scorecard;
    this.container.textContent = '';

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Claude drafted this from the job description. Correct it before scoring — auto-derived rubrics over-weight boilerplate.';
    this.container.appendChild(note);

    const buckets = [
      ['mustHaves', 'Must have'],
      ['niceToHaves', 'Nice to have'],
      ['dealbreakers', 'Dealbreakers']
    ];

    buckets.forEach(([bucket, label]) => {
      const h = document.createElement('h3');
      h.textContent = label;
      this.container.appendChild(h);

      scorecard[bucket].forEach(c => {
        const row = document.createElement('div');
        row.className = 'criterion-row';

        const input = document.createElement('input');
        input.className = 'form-input';
        input.value = c.text;
        input.addEventListener('input', () => { c.text = input.value; });
        row.appendChild(input);

        const del = document.createElement('button');
        del.className = 'btn btn-danger';
        del.textContent = 'Remove';
        del.addEventListener('click', () => {
          this.current[bucket] = this.current[bucket].filter(x => x.id !== c.id);
          this.renderEdit(this.current);
        });
        row.appendChild(del);

        this.container.appendChild(row);
      });

      const add = document.createElement('button');
      add.className = 'btn';
      add.textContent = `Add ${label.toLowerCase()}`;
      add.addEventListener('click', () => {
        this.current = Scorecard.addCriterion(this.current, bucket, '', 1);
        this.renderEdit(this.current);
      });
      this.container.appendChild(add);
    });

    const save = document.createElement('button');
    save.className = 'btn btn-primary';
    save.textContent = 'Save scorecard';
    save.addEventListener('click', async () => {
      const cleaned = { ...this.current, editedAt: new Date().toISOString() };
      ['mustHaves', 'niceToHaves', 'dealbreakers'].forEach(b => {
        cleaned[b] = cleaned[b].filter(c => c.text.trim() !== '');
      });
      if (cleaned.mustHaves.length === 0) {
        showToast('Add at least one must-have before saving', 'error');
        return;
      }
      await Storage.saveScorecard(cleaned);
      showToast('Scorecard saved', 'success');
      this.renderList();
    });
    this.container.appendChild(save);
  }
};
```

Update the export block at the bottom of the file:

```javascript
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorecard;
}
```

(`ScorecardUI` is browser-only and intentionally not exported.)

Add styles to `popup/popup.css`:

```css
.scorecard-row { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
.criterion-row { display: flex; gap: 6px; margin-bottom: 6px; }
.criterion-row .form-input { flex: 1; }
.hint { font-size: 12px; color: #666; margin: 4px 0 12px; }
.empty-state { font-size: 13px; color: #777; margin-top: 12px; }
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, 37 tests. No new unit tests here — this task is UI wiring over
already-tested logic.

- [ ] **Step 5: Verify in the real extension**

1. Reload the extension.
2. Open the Scorecards tab. Confirm the empty state renders.
3. Click "New scorecard from a job description", paste a real JD, name the role,
   click "Build rubric".
4. Confirm criteria appear across the three buckets and read like real requirements,
   not JD boilerplate ("competitive salary" appearing is a prompt bug — fix the
   prompt in Task 8, do not hand-delete it).
5. Edit one criterion, remove one, add one, click Save.
6. Return to the list. Confirm the scorecard shows "Ready to score".
7. Close and reopen the popup. Confirm the scorecard persisted.

- [ ] **Step 6: Commit**

```bash
git add popup/popup.html popup/popup.js popup/popup.css features/scorecard.js
git commit -m "feat: add scorecards tab for building and editing role rubrics"
```

---

### Task 10: Candidate scorer prompt and response parsing

The scoring contract: one call for many candidates, every `met` cites evidence, absent evidence is `unknown`.

**Files:**
- Create: `features/candidate-scorer.js`
- Create: `test/candidate-scorer.test.js`

**Interfaces:**
- Consumes: the `Scorecard` shape from Task 7.
- Produces:
  - `CandidateScorer.buildPrompt(candidates, scorecard)` where `candidates` is an array of
    `{id, name, headline, about, experience, skills}`.
  - `CandidateScorer.parseResponse(responseText, scorecard)` returns an array of
    `{candidateId, scorecardId, total, recommendation, lines, dealbreakerHit, unknownCount}`.
  - `CandidateScorer.scoreTotal(lines, scorecard)` returns `{total, unknownCount}` where
    `total` is the percentage of *decidable* weight that was met.

- [ ] **Step 1: Write the failing test**

Create `test/candidate-scorer.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const CandidateScorer = require('../features/candidate-scorer.js');

const SCORECARD = {
  id: 'sc_1',
  roleName: 'Backend Engineer',
  mustHaves: [
    { id: 'cr_1', text: '5+ years backend', weight: 3 },
    { id: 'cr_2', text: 'Go experience', weight: 2 }
  ],
  niceToHaves: [{ id: 'cr_3', text: 'Kubernetes', weight: 1 }],
  dealbreakers: [{ id: 'cr_4', text: 'Needs visa sponsorship' }],
  editedAt: '2026-09-14T00:00:00Z'
};

test('the prompt lists every candidate and every criterion id', () => {
  const p = CandidateScorer.buildPrompt(
    [{ id: 'c1', name: 'Dana Reyes', headline: 'Engineer' }],
    SCORECARD
  );
  assert.ok(p.includes('c1'));
  assert.ok(p.includes('Dana Reyes'));
  assert.ok(p.includes('cr_1'));
  assert.ok(p.includes('cr_4'));
  assert.ok(/unknown/i.test(p), 'prompt must define the unknown verdict');
});

test('unknown is excluded from the denominator, so a thin profile is not penalised', () => {
  // cr_1 met (weight 3), cr_2 unknown (weight 2 -> excluded), cr_3 met (weight 1).
  const lines = [
    { criterionId: 'cr_1', verdict: 'met', evidence: 'Senior Backend Engineer, 6 yrs' },
    { criterionId: 'cr_2', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_3', verdict: 'met', evidence: 'Kubernetes' }
  ];
  const { total, unknownCount } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, 100);
  assert.strictEqual(unknownCount, 1);
});

test('an unmet criterion lowers the total', () => {
  const lines = [
    { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
    { criterionId: 'cr_2', verdict: 'unmet', evidence: null },
    { criterionId: 'cr_3', verdict: 'met', evidence: 'y' }
  ];
  const { total } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, 67); // (3 + 1) of (3 + 2 + 1)
});

test('a total of zero decidable criteria reports null rather than zero percent', () => {
  const lines = [
    { criterionId: 'cr_1', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_2', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_3', verdict: 'unknown', evidence: null }
  ];
  const { total } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, null);
});

test('a met verdict with no evidence is downgraded to unknown', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'Backend Engineer since 2018' },
      { criterionId: 'cr_2', verdict: 'met', evidence: '' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  const cr2 = score.lines.find(l => l.criterionId === 'cr_2');
  assert.strictEqual(cr2.verdict, 'unknown');
});

test('a dealbreaker hit is surfaced separately from the total', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
      { criterionId: 'cr_4', verdict: 'met', evidence: 'Requires H-1B sponsorship' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  assert.strictEqual(score.dealbreakerHit, 'cr_4');
});

test('lines referring to unknown criterion ids are discarded', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
      { criterionId: 'cr_999', verdict: 'met', evidence: 'hallucinated' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  assert.strictEqual(score.lines.length, 1);
});

test('throws a descriptive error on unparseable output', () => {
  assert.throws(() => CandidateScorer.parseResponse('not json', SCORECARD), /could not read/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../features/candidate-scorer.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `features/candidate-scorer.js`:

```javascript
/**
 * Candidate Scorer
 * Scores many candidates against one scorecard in a single Claude request.
 *
 * Two rules make the output trustworthy:
 *  - every "met" carries verbatim evidence from the candidate's own profile
 *  - absence of evidence is "unknown", never "unmet"
 * A LinkedIn profile omits things. Treating an omission as a failure silently
 * buries qualified people, which is the failure this tool exists to prevent.
 */

const CandidateScorer = {
  buildPrompt(candidates, scorecard) {
    const criteria = [
      ...scorecard.mustHaves.map(c => ({ ...c, bucket: 'must-have' })),
      ...scorecard.niceToHaves.map(c => ({ ...c, bucket: 'nice-to-have' })),
      ...scorecard.dealbreakers.map(c => ({ ...c, bucket: 'dealbreaker' }))
    ];

    return [
      `You are screening candidates for: ${scorecard.roleName}.`,
      '',
      'Judge each candidate against each criterion using ONLY the profile text given.',
      '',
      'Verdicts:',
      '  "met"     - the profile contains text that supports this. You MUST quote it.',
      '  "unmet"   - the profile contains text that contradicts this.',
      '  "unknown" - the profile simply does not say. This is the correct verdict for',
      '              anything absent. Do NOT use "unmet" for a missing mention.',
      '',
      'A LinkedIn profile is a marketing document with omissions. Silence is not',
      'evidence of absence. When in doubt, answer "unknown".',
      '',
      'Criteria:',
      ...criteria.map(c => `  ${c.id} [${c.bucket}] ${c.text}`),
      '',
      'Candidates:',
      ...candidates.map(c => [
        `  --- candidate ${c.id} ---`,
        `  Name: ${c.name || ''}`,
        `  Headline: ${c.headline || ''}`,
        `  About: ${c.about || ''}`,
        `  Experience: ${JSON.stringify(c.experience || [])}`,
        `  Skills: ${(c.skills || []).join(', ')}`
      ].join('\n')),
      '',
      'Respond with JSON only, no prose and no code fence:',
      '[{"candidateId":"...","lines":[{"criterionId":"...","verdict":"met|unmet|unknown","evidence":"verbatim quote or null"}]}]'
    ].join('\n');
  },

  /**
   * Percentage of DECIDABLE weight that was met. Unknown criteria are excluded
   * from the denominator entirely so a thin profile scores low-confidence,
   * not low-quality. Dealbreakers are reported separately, never scored.
   */
  scoreTotal(lines, scorecard) {
    const weights = new Map();
    [...scorecard.mustHaves, ...scorecard.niceToHaves]
      .forEach(c => weights.set(c.id, c.weight || 1));

    let met = 0;
    let decidable = 0;
    let unknownCount = 0;

    lines.forEach(line => {
      if (!weights.has(line.criterionId)) return; // dealbreaker or unknown id
      const weight = weights.get(line.criterionId);
      if (line.verdict === 'unknown') { unknownCount += 1; return; }
      decidable += weight;
      if (line.verdict === 'met') met += weight;
    });

    const total = decidable === 0 ? null : Math.round((met / decidable) * 100);
    return { total, unknownCount };
  },

  parseResponse(responseText, scorecard) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
      throw new Error('Could not read the scores: the model returned nothing.');
    }

    let text = responseText.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Could not read the scores: the response was not valid JSON.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Could not read the scores: expected a list of candidates.');
    }

    const validIds = new Set([
      ...scorecard.mustHaves, ...scorecard.niceToHaves, ...scorecard.dealbreakers
    ].map(c => c.id));
    const dealbreakerIds = new Set(scorecard.dealbreakers.map(c => c.id));

    return parsed.map(entry => {
      const lines = (Array.isArray(entry.lines) ? entry.lines : [])
        // Discard hallucinated criterion ids rather than scoring them.
        .filter(l => l && validIds.has(l.criterionId))
        .map(l => {
          const evidence = typeof l.evidence === 'string' && l.evidence.trim() !== ''
            ? l.evidence.trim()
            : null;
          // A claim with no quotable support is not "met".
          const verdict = (l.verdict === 'met' && !evidence) ? 'unknown' : l.verdict;
          return { criterionId: l.criterionId, verdict, evidence };
        });

      const hit = lines.find(l => dealbreakerIds.has(l.criterionId) && l.verdict === 'met');
      const { total, unknownCount } = this.scoreTotal(lines, scorecard);

      let recommendation = 'weak';
      if (hit) recommendation = 'weak';
      else if (total !== null && total >= 75) recommendation = 'strong';
      else if (total !== null && total >= 45) recommendation = 'possible';

      return {
        candidateId: entry.candidateId,
        scorecardId: scorecard.id,
        total,
        recommendation,
        lines,
        dealbreakerHit: hit ? hit.criterionId : null,
        unknownCount
      };
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CandidateScorer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 45 tests.

- [ ] **Step 5: Commit**

```bash
git add features/candidate-scorer.js test/candidate-scorer.test.js
git commit -m "feat: add candidate scorer with evidence-cited verdicts"
```

---

### Task 11: Score the current profile and show the evidence

Wires the scorer into the summarizer tab so the recruiter picks a scorecard and sees per-criterion verdicts with quotes.

**Files:**
- Modify: `features/profile-summarizer.js`
- Modify: `popup/popup.html` (script tag for the scorer)
- Modify: `popup/popup.css`

**Interfaces:**
- Consumes: `CandidateScorer.buildPrompt/parseResponse`, `Storage.getScorecards`,
  `Scorecard.isUsable`, `callClaude`.
- Produces: no new exports. This is the end of Phase 3.

- [ ] **Step 1: Add the script tag**

In `popup/popup.html`, after the `scorecard.js` tag:

```html
  <script src="../features/candidate-scorer.js"></script>
```

- [ ] **Step 2: Add the scoring UI to the summarizer**

Add to the `ProfileSummarizer` object in `features/profile-summarizer.js`:

```javascript
  /**
   * Scorecard picker plus results. Only scorecards the recruiter has saved
   * are offered; a derived-but-unreviewed rubric cannot score anyone.
   */
  async renderScoring(profile) {
    const wrap = document.createElement('div');
    wrap.className = 'scoring-block';

    const all = await Storage.getScorecards();
    const usable = all.filter(sc => Scorecard.isUsable(sc));

    if (usable.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'No saved scorecards yet. Build one in the Scorecards tab to score this profile.';
      wrap.appendChild(hint);
      return wrap;
    }

    const select = document.createElement('select');
    select.className = 'form-input';
    usable.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.id;
      opt.textContent = sc.roleName;
      select.appendChild(opt);
    });
    wrap.appendChild(select);

    const results = document.createElement('div');

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Score against this role';
    btn.addEventListener('click', async () => {
      const scorecard = usable.find(sc => sc.id === select.value);
      btn.disabled = true;
      results.textContent = '';
      try {
        const apiKey = await Storage.getApiKey();
        const candidate = {
          id: profile.profileUrl || 'current',
          name: profile.name,
          headline: profile.headline,
          about: profile.about,
          experience: profile.experience,
          skills: profile.skills
        };
        const raw = await callClaude(
          CandidateScorer.buildPrompt([candidate], scorecard), apiKey, 4096
        );
        const [score] = CandidateScorer.parseResponse(raw, scorecard);
        results.appendChild(this.renderScore(score, scorecard));
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(results);
    return wrap;
  },

  renderScore(score, scorecard) {
    const box = document.createElement('div');
    box.className = 'card score-card';

    const header = document.createElement('div');
    header.className = 'score-header';
    const pct = document.createElement('strong');
    pct.textContent = score.total === null ? 'Not enough detail to score' : `${score.total}%`;
    header.appendChild(pct);

    const rec = document.createElement('span');
    rec.className = `chip chip-${score.recommendation}`;
    rec.textContent = score.recommendation;
    header.appendChild(rec);

    if (score.unknownCount > 0) {
      const unk = document.createElement('span');
      unk.className = 'chip chip-unknown';
      unk.textContent = `${score.unknownCount} not stated on profile`;
      header.appendChild(unk);
    }
    box.appendChild(header);

    if (score.dealbreakerHit) {
      const db = document.createElement('p');
      db.className = 'dealbreaker';
      const crit = scorecard.dealbreakers.find(c => c.id === score.dealbreakerHit);
      db.textContent = `Dealbreaker: ${crit ? crit.text : score.dealbreakerHit}`;
      box.appendChild(db);
    }

    const byId = new Map(
      [...scorecard.mustHaves, ...scorecard.niceToHaves, ...scorecard.dealbreakers]
        .map(c => [c.id, c])
    );

    score.lines.forEach(line => {
      const row = document.createElement('div');
      row.className = `score-line score-${line.verdict}`;

      const label = document.createElement('div');
      const crit = byId.get(line.criterionId);
      label.textContent = `${line.verdict.toUpperCase()} — ${crit ? crit.text : line.criterionId}`;
      row.appendChild(label);

      if (line.evidence) {
        const quote = document.createElement('blockquote');
        quote.className = 'evidence';
        quote.textContent = line.evidence;
        row.appendChild(quote);
      }

      box.appendChild(row);
    });

    return box;
  },
```

Call `renderScoring(profile)` where the summary result is rendered, appending the
returned element beneath the signal row added in Task 5. `renderScoring` is async, so
await it.

Add styles to `popup/popup.css`:

```css
.scoring-block { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.score-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.score-line { padding: 6px 0; border-top: 1px solid #eee; font-size: 12px; }
.score-met { color: #1d6b33; }
.score-unmet { color: #8a2a22; }
.score-unknown { color: #777; }
.evidence { margin: 4px 0 0 0; padding-left: 8px; border-left: 2px solid #ddd; color: #555; font-style: italic; }
.dealbreaker { color: #8a2a22; font-weight: 600; margin: 6px 0; }
.chip-strong { background: #e6f5ea; color: #1d6b33; }
.chip-possible { background: #fff5e0; color: #7a5a10; }
.chip-weak { background: #f1f1f1; color: #666; }
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS, 45 tests.

- [ ] **Step 4: Verify the whole Phase 1-3 flow end to end**

1. Reload the extension.
2. Build and save a scorecard from a real JD in the Scorecards tab.
3. Open a real LinkedIn profile of someone clearly qualified for that role.
   Summarize, then score. Confirm: a percentage renders, most criteria read `MET`,
   and **every MET line shows a quote that actually appears on that profile**. Open
   the profile and check two quotes by eye. A fabricated quote is a blocking bug.
4. Open a profile of someone clearly unqualified. Confirm the score is low and
   the reasons name real gaps.
5. Open a sparse profile (headline only, no About). Confirm it reports
   "not stated on profile" counts rather than scoring everything `unmet`.
6. Confirm the tenure and open-to-work chips from Task 5 still render above the score.

- [ ] **Step 5: Commit**

```bash
git add features/profile-summarizer.js popup/popup.html popup/popup.css
git commit -m "feat: score the current profile against a scorecard with cited evidence"
```

---

## What Phases 1-3 deliver

The recruiter can build a rubric from a job description, correct it, and then, on any
regular LinkedIn profile, see tenure band, open-to-work status, and a scored breakdown
where every positive verdict quotes the profile text that justified it.

Phases 4 and 5 (the Recruiter `/talent/` overlay carrying the private open-to-work
signal, and the pipeline view with job-change detection) are planned separately and
depend on the DOM captures landing in `dom-samples/`.

## Self-review notes

- **Spec coverage:** `utils/signals.js` (Tasks 2-4), scorecards (Tasks 7-9), scorer
  with the evidence and unknown rules (Task 10), ban-safety enforcement (Task 1),
  existing-code improvements 1 and 2 (Task 6). Improvement 3 (`addCandidate` upsert)
  and `utils/snapshots.js` belong to Phase 5 and are deliberately not in this plan.
- **Deviation from spec:** `parseTenure` returns `{start, end}` as `{year, month|null}`
  objects rather than the spec's ISO strings, because LinkedIn frequently gives
  year-only precision and a synthesised `-01-01` would read downstream as a real date.
- **Deviation from spec:** the spec describes batching up to 25 candidates. Task 11
  scores one profile at a time, because `/in/*` shows one profile. The batch path
  (`buildPrompt` already accepts an array) is exercised in Phase 4 against Recruiter
  results pages.
