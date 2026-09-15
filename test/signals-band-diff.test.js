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
