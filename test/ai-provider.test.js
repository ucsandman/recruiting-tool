const { test } = require('node:test');
const assert = require('node:assert');
const AIProvider = require('../lib/ai-provider.js');

test('buildOpenAIRequest produces the exact body shape', () => {
  const body = AIProvider.buildOpenAIRequest('gpt-5', 'Summarize this profile');

  assert.strictEqual(body.model, 'gpt-5');
  assert.deepStrictEqual(body.messages, [
    { role: 'user', content: 'Summarize this profile' }
  ]);
  assert.strictEqual('max_tokens' in body, false);
  assert.strictEqual('max_completion_tokens' in body, false);
});

test('parseOpenAIResponse returns the text for a well-formed response', () => {
  const json = {
    choices: [
      { message: { role: 'assistant', content: 'the summary text' } }
    ]
  };
  assert.strictEqual(AIProvider.parseOpenAIResponse(json), 'the summary text');
});

test('parseOpenAIResponse throws a descriptive Error for missing choices', () => {
  assert.throws(() => AIProvider.parseOpenAIResponse({}), /choices/i);
});

test('parseOpenAIResponse throws a descriptive Error for an empty choices array', () => {
  assert.throws(() => AIProvider.parseOpenAIResponse({ choices: [] }), /choices/i);
});

test('parseOpenAIResponse throws a descriptive Error for a choice with no message', () => {
  assert.throws(() => AIProvider.parseOpenAIResponse({ choices: [{}] }), /message/i);
});

test('parseOpenAIResponse throws a descriptive Error for a non-object argument', () => {
  assert.throws(() => AIProvider.parseOpenAIResponse(null), /valid JSON/i);
  assert.throws(() => AIProvider.parseOpenAIResponse('not an object'), /valid JSON/i);
  assert.throws(() => AIProvider.parseOpenAIResponse(undefined), /valid JSON/i);
});

test('sortModelIds maps a model list response to sorted ids', () => {
  const data = [
    { id: 'gpt-5-mini' },
    { id: 'gpt-4o' },
    { id: 'gpt-5' },
    { notAnId: 'ignored' }
  ];
  assert.deepStrictEqual(AIProvider.sortModelIds(data), ['gpt-4o', 'gpt-5', 'gpt-5-mini']);
});

test('sortModelIds returns an empty array for non-array input', () => {
  assert.deepStrictEqual(AIProvider.sortModelIds(undefined), []);
  assert.deepStrictEqual(AIProvider.sortModelIds(null), []);
});
