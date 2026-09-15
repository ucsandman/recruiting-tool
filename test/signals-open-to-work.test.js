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

test('spotlight fires on the exact machine token', () => {
  const r = Signals.detectOpenToWork({ recruiterSpotlights: ['openToOpportunities'] }, NOW);
  assert.strictEqual(r.open, true);
  assert.strictEqual(r.source, 'recruiter-spotlight');
});

test('spotlight machine token match is case-insensitive', () => {
  const r = Signals.detectOpenToWork({ recruiterSpotlights: ['OpenToOpportunities'] }, NOW);
  assert.strictEqual(r.open, true);
  assert.strictEqual(r.source, 'recruiter-spotlight');
});

test('spotlight fires on the human label', () => {
  const r = Signals.detectOpenToWork({ recruiterSpotlights: ['Open to work'] }, NOW);
  assert.strictEqual(r.open, true);
  assert.strictEqual(r.source, 'recruiter-spotlight');
});

test('spotlight ignores unrelated Recruiter decoration types', () => {
  const r = Signals.detectOpenToWork({
    recruiterSpotlights: ['skillsV2', 'views', 'connections']
  }, NOW);
  assert.strictEqual(r.open, false);
});

test('spotlight does not fire on a candidate who is hiring rather than looking', () => {
  const r = Signals.detectOpenToWork({
    recruiterSpotlights: ['we are open to work with partners']
  }, NOW);
  assert.strictEqual(r.open, false);
});

test('spotlight does not loosely match a token that merely contains the phrase', () => {
  const r = Signals.detectOpenToWork({ recruiterSpotlights: ['notOpenToOpportunities'] }, NOW);
  assert.strictEqual(r.open, false);
});

test('spotlight tolerates a non-string entry mixed with a valid one', () => {
  const r = Signals.detectOpenToWork({
    recruiterSpotlights: [42, 'openToOpportunities']
  }, NOW);
  assert.strictEqual(r.open, true);
  assert.strictEqual(r.source, 'recruiter-spotlight');
});
