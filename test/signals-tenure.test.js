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

test('accepts the bullet separator Recruiter uses', () => {
  const r = Signals.parseTenure('Mar 2026 – Present • 7 mos', NOW);
  assert.strictEqual(r.months, 7);
  assert.strictEqual(r.isCurrent, true);
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
