const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { callClaude, CLAUDE_MODEL } = require('../lib/claude-api.js');

const ROOT = path.join(__dirname, '..');

function stubFetch() {
  const original = global.fetch;
  const calls = [];
  global.fetch = (url, options) => {
    calls.push({ url, options });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'ok' }] })
    });
  };
  return {
    calls,
    restore: () => { global.fetch = original; }
  };
}

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

test('callClaude sends the default model, and an explicit model overrides it', async () => {
  const fetchStub = stubFetch();
  try {
    await callClaude('hello', 'test-key', 10);
    assert.strictEqual(fetchStub.calls.length, 1);
    const defaultBody = JSON.parse(fetchStub.calls[0].options.body);
    assert.strictEqual(defaultBody.model, CLAUDE_MODEL);

    await callClaude('hello', 'test-key', 10, 'claude-haiku-test');
    assert.strictEqual(fetchStub.calls.length, 2);
    const overrideBody = JSON.parse(fetchStub.calls[1].options.body);
    assert.strictEqual(overrideBody.model, 'claude-haiku-test');
  } finally {
    fetchStub.restore();
  }
});
