const { test } = require('node:test');
const assert = require('node:assert');
const Signals = require('../utils/signals.js');

// LinkedIn separates name from headline with a SPACED dash; a hyphen
// inside a surname is never spaced. See extractName() in
// content/linkedin-extractor.js for the live-browser bug this covers.

test('keeps a hyphenated surname intact', () => {
  assert.strictEqual(
    Signals.nameFromTitle('Saga Relander-Nyrén | LinkedIn'),
    'Saga Relander-Nyrén'
  );
});

test('keeps a hyphenated first name intact', () => {
  assert.strictEqual(
    Signals.nameFromTitle('Jean-Luc Picard | LinkedIn'),
    'Jean-Luc Picard'
  );
});

test('keeps multiple hyphenated name parts intact', () => {
  assert.strictEqual(
    Signals.nameFromTitle("Anne-Marie O'Connell-Smith | LinkedIn"),
    "Anne-Marie O'Connell-Smith"
  );
});

test('plain two-word name with no headline', () => {
  assert.strictEqual(Signals.nameFromTitle('Wes Sander | LinkedIn'), 'Wes Sander');
});

test('strips a spaced-hyphen headline', () => {
  assert.strictEqual(
    Signals.nameFromTitle('Wes Sander - Founder at Practical Systems | LinkedIn'),
    'Wes Sander'
  );
});

test('strips a spaced en-dash headline', () => {
  assert.strictEqual(
    Signals.nameFromTitle('Mary Jane Watson – Senior Engineer | LinkedIn'),
    'Mary Jane Watson'
  );
});

test('title with no pipe at all', () => {
  assert.strictEqual(Signals.nameFromTitle('Wes Sander'), 'Wes Sander');
});

test('empty title returns empty string', () => {
  assert.strictEqual(Signals.nameFromTitle(''), '');
});

test('non-string title returns empty string without throwing', () => {
  assert.strictEqual(Signals.nameFromTitle(undefined), '');
  assert.strictEqual(Signals.nameFromTitle(null), '');
});
