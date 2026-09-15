# Recruiter Toolkit - Chrome Extension

AI-powered recruiting assistant Chrome extension with LinkedIn profile summaries, role scorecards, evidence-cited candidate scoring, boolean search builder, candidate comparison, and interview question generation. Runs on either Anthropic or OpenAI.

## Features

### 1. LinkedIn Profile Summarizer
- One-click profile analysis on LinkedIn profile pages
- AI-generated summaries with key qualifications, experience highlights, concerns, and best fit recommendations
- Extracts comprehensive profile data: name, headline, location, about, experience, education, skills, certifications, languages, volunteering, honors, and organizations
- Summary caching - revisit the same profile without re-generating
- Save profiles for comparison
- Copy summaries to clipboard

### 2. Boolean Search Builder
- Visual query builder for recruiter searches
- Support for job titles, companies, skills, locations, and exclusions
- Real-time query preview with syntax highlighting
- Copy generated boolean queries to clipboard

### 3. Candidate Comparison
- Save multiple candidate profiles
- Side-by-side comparison table (up to 3 candidates)
- Compare 18 attributes: name, headline, current role, company, location, about, experience, education, skills, certifications, languages, volunteering, honors, organizations, key qualifications, experience highlights, concerns, and best fit

### 4. Interview Question Generator
- Generate role-specific interview questions
- Choose question types: Behavioral, Technical, or Mixed
- Adjustable question count (1-15)
- Questions categorized as Screening, Deep Dive, or Red Flag (for 4+ questions)
- Copy all questions to clipboard

### 5. Role Scorecards
- Paste a job description and Claude drafts a screening rubric from it
- Must-haves, nice-to-haves and dealbreakers, each with an adjustable weight (1-3)
- You must review and save a rubric before it can score anyone - auto-drafted rubrics
  over-weight job-description boilerplate, so the edit step is required, not optional
- Scorecards persist locally and are reusable across candidates

### 6. Candidate Scoring
- Score the profile you are viewing against any saved scorecard
- Per-criterion verdicts: met, unmet, or unknown
- **Every `met` cites verbatim profile text, and that quote is verified to actually
  appear in the profile** - a fabricated citation is rejected, not displayed
- A missing mention scores `unknown`, never `unmet`. LinkedIn profiles omit things, and
  treating an omission as a failure silently buries qualified people
- `unknown` is excluded from the score denominator, so a sparse profile reads as
  low-confidence rather than low-quality
- If no must-have could be decided, the result says "Not enough detail to score" rather
  than reporting a percentage
- Dealbreakers are reported separately and never folded into the percentage

### 7. Movability Signals
- Tenure band computed locally from the profile (just started / settling in / prime to
  move / long tenure), with no AI call
- Open-to-work detection with provenance, so you know whether it came from the public
  badge or a recruiter-only signal

### 8. Pop-out Window
- Expand the extension into a full browser window
- Larger workspace for reviewing candidates and comparisons
- State persists between popup and pop-out modes

## Installation

### Development Installation

1. Clone or download this repository

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (toggle in top-right corner)

4. Click **Load unpacked**

5. Select the `recruiting-tool` folder

6. The extension icon will appear in your Chrome toolbar

### Configuration

1. Click the extension icon to open the popup
2. Click the gear icon in the top-right corner
3. Choose a provider — **Anthropic** or **OpenAI**. Anthropic is the default.
4. Paste the matching API key:
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
5. On OpenAI, click **Load models** and pick one from the dropdown
6. Click Save

**No OpenAI model id is hardcoded anywhere in this repo.** The dropdown is populated from
`GET /v1/models` using your own key, so it always reflects what your account can actually
run and never goes stale. If no model has been chosen, the AI features refuse with a clear
message rather than falling back to a guessed name.

## Usage

### Profile Summarizer
1. Navigate to a LinkedIn profile page
2. Click the extension icon
3. Click "Summarize This Profile"
4. View the AI-generated summary
5. Optionally save for comparison or copy the summary

### Boolean Search Builder
1. Click the extension icon
2. Navigate to the "Search" tab
3. Fill in search criteria (job titles, skills, etc.)
4. Copy the generated boolean query
5. Paste into LinkedIn Recruiter, Google, or any job board

### Candidate Comparison
1. Save candidates from the Summarize tab
2. Navigate to the "Compare" tab
3. Select 2-3 candidates using checkboxes
4. Click "Compare Selected"
5. Review the side-by-side comparison table

### Interview Questions
1. Click the extension icon
2. Navigate to the "Questions" tab
3. Enter the job title (required)
4. Optionally add key requirements
5. Select question type and count
6. Click "Generate Questions"
7. Copy individual questions or all at once

## Technical Details

- **Manifest Version:** 3 (modern Chrome extension format)
- **AI Providers:** Anthropic (default, `claude-sonnet-5`) or OpenAI (model chosen by the user from their own account's model list)
- **Storage:** Chrome local storage (no external database)
- **Permissions:** activeTab, storage, tabs
- **Tests:** 92 unit tests, `npm test` (Node's built-in `node:test`, no dependencies)
- **Build step:** none
- **Host Permissions:** linkedin.com, api.anthropic.com, api.openai.com

## Project Structure

```
recruiting-tool/
├── manifest.json           # Extension manifest
├── popup/
│   ├── popup.html         # Main popup UI
│   ├── popup.css          # Styles
│   └── popup.js           # Main controller
├── content/
│   └── linkedin-extractor.js  # LinkedIn scraper
├── background/
│   └── service-worker.js  # Background worker
├── lib/
│   ├── claude-api.js      # Anthropic request builder
│   └── ai-provider.js     # Provider dispatch: Anthropic or OpenAI
├── features/
│   ├── profile-summarizer.js
│   ├── scorecard.js       # Role rubrics + Scorecards tab UI
│   ├── candidate-scorer.js # Prompt building + defensive response parsing
│   ├── boolean-builder.js
│   ├── candidate-compare.js
│   └── question-generator.js
├── utils/
│   ├── storage.js         # Chrome storage wrapper
│   ├── signals.js         # Tenure, bands, open-to-work, role diffs (pure, tested)
│   └── helpers.js         # Utility functions
├── test/                  # 92 unit tests, run with `npm test`
├── icons/                 # Extension icons
└── scripts/
    └── generate-icons.js  # Icon generator
```

## Testing

```bash
npm test
```

92 unit tests using Node's built-in test runner. No dependencies, no build step.

One test is a safety guard rather than a feature test: `test/ban-safety.test.js` scans
every file listed in `manifest.json`'s `content_scripts` and fails the build if any of
them contains `fetch(`, `XMLHttpRequest`, `.click(`, `.submit(`, `dispatchEvent` or
`setInterval` - including multi-line and bracket-access forms. See the design rule below.

## Design rule: the extension never automates LinkedIn

The extension reads only DOM that is already rendered on a page you navigated to
yourself. It issues zero requests to linkedin.com and performs zero synthetic
interaction with LinkedIn's UI - no background fetching, no auto-pagination, no
scripted clicks, no polling timers.

This is deliberate. LinkedIn's automation detection is largely network- and
timing-based, and a Recruiter seat is expensive to lose. The rule costs almost nothing,
because the page you are looking at already contains the data.

The trade-off: content hidden behind a "See more" button is not extracted, because
expanding it would require a synthetic click. Expand it yourself if you want it read.

## Privacy & Security

- API keys are stored locally in Chrome storage
- No data is sent to external servers except the AI provider you selected
- LinkedIn profile data is only extracted when you click "Summarize"
- Saved candidates are stored locally on your device

## Requirements

- A Chromium browser — Chrome, Brave or Edge
- An API key from **either** Anthropic or OpenAI (not both)

## Known Limitations

- **LinkedIn DOM Changes**: LinkedIn frequently updates their page structure. The extension uses text-based section finding (parsing `innerText`) rather than relying on CSS selectors or IDs, which provides resilience but may occasionally miss data if LinkedIn significantly changes section headers.
- **LinkedIn Terms of Service**: Automated data extraction may violate LinkedIn's ToS. Use responsibly and at your own risk.
- **Profile Visibility**: The extension can only extract data visible on the page. Limited profiles or sections hidden behind "Show more" buttons may not be fully captured - by design, see the design rule above.
- **Unverifiable rejections**: a must-have the model judges `unmet` but cannot support with a verbatim quote is downgraded to `unknown` rather than counted against the candidate. That can make someone look stronger than they are. The score panel flags must-have unknowns, so read the per-criterion lines before trusting a percentage.
- **No official LinkedIn API**: LinkedIn's Talent Solutions APIs are gated behind an approved-partner program and are not available to individual recruiters. Everything here reads the rendered page.

## License

MIT License

## Support

If my tools save you time, you can support my work here:

[![Sponsor on GitHub](https://img.shields.io/badge/GitHub%20Sponsors-%E2%9D%A4-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/ucsandman)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wes_sander)
