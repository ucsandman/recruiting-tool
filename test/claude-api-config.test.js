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
