# Recruiter Toolkit - Chrome Extension

AI-powered recruiting assistant Chrome extension with LinkedIn profile summaries, boolean search builder, candidate comparison, and interview question generation.

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

### 5. Pop-out Window
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

3. Enter your Claude API key (obtain from [Anthropic Console](https://console.anthropic.com/))

4. Click Save

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
- **AI Model:** Claude Sonnet 4 via Anthropic API
- **Storage:** Chrome local storage (no external database)
- **Permissions:** activeTab, storage, tabs
- **Host Permissions:** linkedin.com, api.anthropic.com

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
│   └── claude-api.js      # Claude API wrapper
├── features/
│   ├── profile-summarizer.js
│   ├── boolean-builder.js
│   ├── candidate-compare.js
│   └── question-generator.js
├── utils/
│   ├── storage.js         # Chrome storage wrapper
│   └── helpers.js         # Utility functions
├── icons/                 # Extension icons
└── scripts/
    └── generate-icons.js  # Icon generator
```

## Privacy & Security

- API keys are stored locally in Chrome storage
- No data is sent to external servers except Anthropic's API
- LinkedIn profile data is only extracted when you click "Summarize"
- Saved candidates are stored locally on your device

## Requirements

- Google Chrome browser
- Claude API key from Anthropic

## Known Limitations

- **LinkedIn DOM Changes**: LinkedIn frequently updates their page structure. The extension uses text-based section finding (parsing `innerText`) rather than relying on CSS selectors or IDs, which provides resilience but may occasionally miss data if LinkedIn significantly changes section headers.
- **LinkedIn Terms of Service**: Automated data extraction may violate LinkedIn's ToS. Use responsibly and at your own risk.
- **Profile Visibility**: The extension can only extract data visible on the page. Limited profiles or sections hidden behind "Show more" buttons may not be fully captured.

## License

MIT License

## Support

If my tools save you time, you can support my work here:

[![Sponsor on GitHub](https://img.shields.io/badge/GitHub%20Sponsors-%E2%9D%A4-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/ucsandman)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%E2%98%95-ffdd00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wes_sander)
