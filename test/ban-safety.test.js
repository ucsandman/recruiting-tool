const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The extension must never issue requests to LinkedIn or synthesize
// interaction with LinkedIn's UI. See the spec's ban-safety invariant.
const FORBIDDEN = [
  { name: 'network call', pattern: /\bfetch\s*\(|(?:window|globalThis)\s*\[\s*["']fetch["']\s*\]/ },
  { name: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { name: 'synthetic click', pattern: /\.click\s*\(|\[\s*["']click["']\s*\]/ },
  { name: 'synthetic submit', pattern: /\.submit\s*\(|\[\s*["']submit["']\s*\]/ },
  { name: 'synthetic event', pattern: /\bdispatchEvent\s*\(|\[\s*["']dispatchEvent["']\s*\]/ },
  { name: 'polling timer', pattern: /\bsetInterval\s*\(/ }
];

const CONTENT_DIR = path.join(__dirname, '..', 'content');

test('content scripts contain no forbidden automation patterns', () => {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 0, 'expected at least one content script to scan');

  const violations = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const lines = source.split('\n');
    for (const rule of FORBIDDEN) {
      const globalPattern = new RegExp(rule.pattern.source, 'g');
      let match;
      while ((match = globalPattern.exec(source)) !== null) {
        const lineNumber = source.slice(0, match.index).split('\n').length;
        const lineText = lines[lineNumber - 1];
        if (lineText.trim().startsWith('//')) continue;
        violations.push(`${file}:${lineNumber} ${rule.name} -> ${lineText.trim()}`);
      }
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Ban-safety violations found (${files.length} files scanned):\n${violations.join('\n')}`
  );
});
