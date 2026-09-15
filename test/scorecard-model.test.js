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
