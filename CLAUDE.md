# Recruiter Toolkit - Project Documentation

## Overview

Chrome Extension (Manifest V3) providing AI-powered recruiting features:
- LinkedIn Profile Summarizer
- Boolean Search Builder
- Candidate Comparison Tool
- Interview Question Generator

## Current Architecture

### Frontend
- Chrome Extension popup (HTML/CSS/JS)
- Content script for LinkedIn data extraction
- Pop-out floating window support
- No build step required - vanilla JavaScript

### AI Integration
- Claude API (Anthropic) for AI features
- Model: claude-sonnet-4-20250514
- Direct browser access via `anthropic-dangerous-direct-browser-access` header

### Storage
- Chrome local storage for:
  - API key (`claudeApiKey`)
  - Saved candidates (`savedCandidates`)
  - Cached summary (`cachedSummary`)
  - Pop-out state (`poppedOutTab`, `poppedOutSourceUrl`, `poppedOutCompareState`)

## Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| Manifest | manifest.json | Extension configuration |
| Popup | popup/*.* | Main UI with tab navigation |
| Service Worker | background/service-worker.js | API calls |
| Content Script | content/linkedin-extractor.js | LinkedIn text-based extraction |
| Features | features/*.js | Feature modules |
| Utilities | utils/*.js | Shared helpers |

## Data Flow

1. User clicks extension icon → popup.html loads
2. User navigates to LinkedIn profile → content script ready
3. User clicks "Summarize" → popup sends message to content script
4. Content script extracts data via `innerText` parsing → returns to popup
5. Popup calls Claude API → receives summary
6. User can save candidate → stored in chrome.storage

## LinkedIn Extraction (2025)

**Critical:** LinkedIn no longer uses semantic IDs for sections. The extractor uses text-based section finding:

```javascript
// Sections are found by header text, not IDs
findSectionByHeader('Experience')  // finds section starting with "Experience"
findSectionByHeader('Education')   // finds section starting with "Education"
```

**Extracted Fields:**
- Basic: name, headline, location, profileUrl
- About section (full text)
- Experience (title, company, duration)
- Education (school, degree, field, years)
- Skills, Certifications, Languages
- Services, Volunteering, Courses
- Honors & Awards, Organizations

**Key Insight:** LinkedIn sections have 0 `<li>` elements but use `<div>` elements. All data must be parsed from `innerText`.

## External Dependencies

- Google Fonts (Inter) - loaded via CDN in popup.html
- Claude API - https://api.anthropic.com/v1/messages

## Configuration

User must provide Claude API key via Settings modal. Key is stored in `chrome.storage.local` under key `claudeApiKey`.

## Development

1. Load unpacked in Chrome (chrome://extensions, Developer mode)
2. Make changes to source files
3. Click refresh on extension card or reload extension

No build process required.

## Known Limitations

- **LinkedIn ToS:** Scraping violates LinkedIn's Terms of Service. Use at your own risk.
- **DOM Changes:** LinkedIn frequently changes their DOM structure. Extraction may break.
- **Collapsed Sections:** Content behind "See more" buttons may not be extracted.
- **Rate Limiting:** Excessive API calls may hit Anthropic rate limits.

## Development History

### January 2025 - Major Refactor
- Rewrote LinkedIn extractor to use text-based section finding (IDs no longer exist)
- Added pop-out floating window feature
- Added summary caching
- Added comparison state persistence in pop-out
- Expanded profile data extraction (services, volunteering, courses, honors, organizations)
- Fixed question generator count slider
- Made popup responsive to screen size
