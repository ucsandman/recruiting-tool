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

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');

// The set of files that actually execute on LinkedIn pages is whatever
// manifest.json lists under content_scripts[].js - not a hardcoded
// directory. A file can ship as a content script from anywhere in the
// tree (e.g. utils/signals.js), and if it isn't in this list it never
// runs on the page and doesn't need scanning; if it is in this list it
// must be scanned no matter where it lives.
function getContentScriptFiles() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const scripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  const relPaths = scripts.flatMap(entry => Array.isArray(entry.js) ? entry.js : []);
  return [...new Set(relPaths)].map(relPath => path.join(ROOT, relPath));
}

test('content scripts contain no forbidden automation patterns', () => {
  const files = getContentScriptFiles();
  assert.ok(files.length > 0, 'expected at least one content script to scan');

  const violations = [];
  for (const filePath of files) {
    const relLabel = path.relative(ROOT, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    const lines = source.split('\n');
    for (const rule of FORBIDDEN) {
      const globalPattern = new RegExp(rule.pattern.source, 'g');
      let match;
      while ((match = globalPattern.exec(source)) !== null) {
        const lineNumber = source.slice(0, match.index).split('\n').length;
        const lineText = lines[lineNumber - 1];
        if (lineText.trim().startsWith('//')) continue;
        violations.push(`${relLabel}:${lineNumber} ${rule.name} -> ${lineText.trim()}`);
      }
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Ban-safety violations found (${files.length} files scanned):\n${violations.join('\n')}`
  );
});
