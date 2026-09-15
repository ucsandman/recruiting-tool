# Errors and lessons

Things that broke or were gotten wrong, so the next session does not pay for them again.
Newest first.

## 2026-09-15 — A rule implemented in only one direction

**Symptom:** review found that `parseResponse` downgraded a `met` verdict carrying no
evidence to `unknown`, but relayed an `unmet` with no evidence straight through, lowering
a candidate's score for an omission.

**Root cause:** the rule was written into the implementation plan as "a `met` with no
quotable support is not `met`" and implemented literally. `unmet` is defined as "the
profile CONTRADICTS this", so the same reasoning always applied to it — nobody stated it.

**Fix:** symmetric handling — an `unmet` with no usable evidence also becomes `unknown`.

**It then happened again in the other half.** A later review found that the
*substantiveness floor* and the *source-text check* were also gated on `verdict === 'met'`,
so a hallucinated `unmet` with fabricated evidence still passed. Two separate reviews, two
halves of one rule.

**Lesson:** when a rule is written for one enum value, check every other value of that enum
before shipping it. Write the rule as a property of the data ("a verdict must be supported
by verifiable evidence"), not as a branch condition on one case.

## 2026-09-15 — A test that passed for the wrong reason

**Symptom:** a test named "a verified met plus a verified unmet still collapses to unknown"
began failing once `unmet` evidence started being verified.

**Root cause:** the test's `unmet` evidence (`'Explicitly says junior level only'`) never
occurred in the fixture's profile text, so that line was never "verified" at all. The test
had been passing for a reason unrelated to its name since it was written.

**Fix:** rewrote it with evidence genuinely present in the fixture and renamed it to state
the real condition. The implementer correctly flagged it as a decision rather than editing
it green — a fix loop that edits tests can make anything pass.

**Lesson:** a test whose name asserts a precondition ("verified") should construct that
precondition from the fixture, not from a plausible-looking string.

## 2026-09-15 — `node --test <dir>` is not test discovery

**Symptom:** `npm test` failed with `MODULE_NOT_FOUND` even with a correct `package.json`,
and failed identically whether the test would pass or fail.

**Root cause:** on Node v24, `node --test test/` treats the directory as an ordinary script
entry point, not a discovery root. A test command that cannot distinguish pass from fail is
worse than no test command.

**Fix:** `node --test "test/**/*.test.js"`. Verified in both bash and cmd.exe, since npm
runs scripts through cmd on Windows.

**How it was caught:** the task's own design required deliberately breaking the guard to
observe it fail. That step is what surfaced the broken command, on the first task rather
than the ninth.

## 2026-09-15 — A safety guard that did not cover everything it guarded

**Symptom:** `test/ban-safety.test.js` scanned `content/*.js`, but `utils/signals.js` had
been added to `manifest.json`'s `content_scripts` and so was executing on LinkedIn pages
unscanned.

**Root cause:** the guard hardcoded a directory instead of reading the list of files that
actually ship as content scripts.

**Fix:** the guard now reads `content_scripts[].js` from `manifest.json`. Proven by
injecting a `fetch` into `utils/signals.js` and confirming the guard names that file.

**Lesson:** a guard should derive its scope from the same source of truth as the thing it
guards. A hardcoded path drifts silently.

## 2026-09-15 — Unvalidated weights corrupted scoring arithmetic

**Symptom:** criterion weights flowed from model output into scoring with no validation.
Measured: weights `[0,0]` scored 50% because `c.weight || 1` treats `0` as falsy; weights
`[-3,3]` cancelled the denominator to zero and made the candidate unscoreable; `1e20` made
every other criterion invisible.

**Fix:** clamp to an integer 1..3 at both entry points where a weight enters
(`parseDerivedRubric` and `addCriterion`), plus a defensive guard inside `scoreTotal`
because scorecards already in `chrome.storage` predate the clamp.

**Lesson:** validate at the boundary where untrusted values enter, not at each site that
consumes them. And `|| 1` is wrong whenever `0` is a value the domain can produce.

## Pre-existing, documented, not fixed

- `background/service-worker.js`'s `callClaude` message handler is unreachable in
  production. Every feature calls `callClaude` directly from the popup script context.
  Predates this work; left in place deliberately.
- `.claude/settings.local.json` is tracked in git. It contains only a permission
  allowlist, no secrets, but local settings generally should not be committed.
