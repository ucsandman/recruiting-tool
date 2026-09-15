const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The extension must never issue requests to LinkedIn or synthesize
// interaction with LinkedIn's UI. See the spec's ban-safety invariant.
const FORBIDDEN = [
  { name: 'network call', pattern: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'synthetic click', pattern: /\.click\s*\(/ },
  { name: 'synthetic submit', pattern: /\.submit\s*\(/ },
  { name: 'synthetic event', pattern: /\bdispatchEvent\s*\(/ },
  { name: 'polling timer', pattern: /\bsetInterval\s*\(/ }
];

const CONTENT_DIR = path.join(__dirname, '..', 'content');

test('content scripts contain no forbidden automation patterns', () => {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 0, 'expected at least one content script to scan');

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    source.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(line)) {
          violations.push(`${file}:${i + 1} ${rule.name} -> ${line.trim()}`);
        }
      }
    });
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Ban-safety violations found (${files.length} files scanned):\n${violations.join('\n')}`
  );
});
