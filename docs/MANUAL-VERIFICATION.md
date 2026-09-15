# Manual verification — sourcing Phases 1-3

Everything below needs a human at a browser. Static review and 92 unit tests cannot
establish any of it. Roughly 20 minutes.

Branch: `feat/sourcing-phases-1-3`. Load unpacked from `chrome://extensions`
(Developer mode on), then reload the Recruiter Toolkit card after checking out.

## 1. Signals on a real profile (Task 5)

1. Open a LinkedIn profile of someone who visibly has the green `#OpenToWork` photo ring.
2. Open the extension, run Summarize.
3. Expect a tenure chip with a plausible month count, and an "Open to work (public badge)" chip.
4. Open a profile of someone **without** the ring. Expect the open-to-work chip absent,
   tenure chip still present.

If the badge chip does not appear on a profile that visibly has the ring, the anchor text
does not match what LinkedIn renders. Capture the real text with
`document.querySelector('main section').innerText` in DevTools and add it as a test case in
`test/signals-open-to-work.test.js`. **Do not loosen the matcher to a bare substring** —
that reintroduces the "we are open to work with partners" false positive that is already
covered by a test.

Also confirm across several profiles that `currentRole.duration` arrives in a shape
`parseTenure` handles: a `"X yrs Y mos"` summary present, a summary absent, a year-only
range, and a `Present` range.

## 2. The API path still works (Task 6)

The Claude request was consolidated into one place and moved to `claude-sonnet-5`.
Run Summarize on any profile and confirm a summary comes back.

Note: this exercises the direct popup call path only. `background/service-worker.js`'s
message handler is unreachable in production — every feature calls `callClaude` directly
from the popup context. That is pre-existing, predates this work, and was deliberately
left in place.

## 3. Scorecards (Task 9)

1. Open the Scorecards tab. Confirm the empty state renders sensibly.
2. "New scorecard from a job description", paste a real JD, name the role, "Build rubric".
3. Confirm the criteria read like real requirements. If boilerplate like "competitive
   salary" appears, that is a prompt defect — fix the prompt in `features/scorecard.js`,
   do not hand-delete the criterion.
4. Confirm derived weights come back in the 1-3 range from a live call, not just from the
   parser's handling of canned JSON.
5. Edit one criterion, change one weight, remove one, add one, Save.
6. Return to the list. Confirm it shows "Ready to score".
7. Close and reopen the popup. Confirm it persisted.
8. Confirm a scorecard that has never been saved is **not** offered for scoring.

## 4. Scoring with cited evidence (Task 11)

1. Open a profile of someone clearly qualified for that role. Summarize, then Score.
2. **Check two `MET` quotes against the live profile by eye.** A fabricated quote is the
   one failure no unit test can catch. Evidence is now machine-verified against the
   profile text, so a fabrication should already be impossible — this confirms it.
3. **Also check one `UNMET` verdict** against the profile.
4. Open a profile of someone clearly unqualified. Expect a low score naming real gaps.
5. Open a sparse profile (headline only, no About). Expect "not stated on profile" counts
   rather than everything scored `unmet`.
6. Confirm the tenure and open-to-work chips still render above the score block.
7. Confirm the popup does not break at its narrow width — no automated layout check exists.

## 5. The ban-safety invariant, live

Open DevTools → Network while running a full scoring pass. Confirm **zero** requests to
`linkedin.com`. The static guard in `test/ban-safety.test.js` enforces this across every
file listed in `manifest.json`'s `content_scripts`, but this is the live sanity check.

## Known limitation to watch for

A must-have the model genuinely judges `unmet` but cannot support with a verbatim quote
from the profile (a paraphrase, or a conclusion drawn across several fields) is downgraded
to `unknown` rather than counted against the candidate. That shrinks the denominator and
can show a candidate as stronger than they are. The must-have-unknown chip still fires and
flags it, but its label reads "not stated on profile", which is misleading in that case —
the model did find something, it just could not be verified word for word.

If you see a candidate scoring high with must-have unknowns flagged, read the per-criterion
lines before trusting the percentage.
