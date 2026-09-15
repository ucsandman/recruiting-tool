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
