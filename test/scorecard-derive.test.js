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

test('parseDerivedRubric("null") throws a descriptive Error, not a raw TypeError', () => {
  assert.throws(
    () => Scorecard.parseDerivedRubric('null'),
    /could not read/i
  );
});

test('clamps a zero weight to 1 rather than letting it survive as falsy', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go","weight":0}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 1);
});

test('clamps a negative weight to 1', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go","weight":-3}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 1);
});

test('clamps a weight above 3 down to 3', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go","weight":1e20}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 3);
});

test('rounds a fractional weight into range', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go","weight":2.6}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 3);
});

test('defaults a string weight to 1', () => {
  const r = Scorecard.parseDerivedRubric('{"mustHaves":[{"text":"Go","weight":"high"}],"niceToHaves":[],"dealbreakers":[]}');
  assert.strictEqual(r.mustHaves[0].weight, 1);
});
