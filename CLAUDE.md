# Recruiter Toolkit - Project Documentation

## Overview

Chrome Extension (Manifest V3) providing AI-powered recruiting features:
- LinkedIn Profile Summarizer
- Boolean Search Builder
- Candidate Comparison Tool
- Interview Question Generator

## Architecture

### Frontend
- Chrome Extension popup (HTML/CSS/JS)
- Content script for LinkedIn data extraction
- No build step required - vanilla JavaScript

### AI Integration
- Claude API (Anthropic) for AI features
- Model: claude-sonnet-4-20250514
- Direct browser access via `anthropic-dangerous-direct-browser-access` header

### Storage
- Chrome local storage for:
  - API key
  - Saved candidates

## Key Components

| Component | Path | Purpose |
|-----------|------|---------|
| Manifest | manifest.json | Extension configuration |
| Popup | popup/*.* | Main UI |
| Service Worker | background/service-worker.js | API calls |
| Content Script | content/linkedin-extractor.js | LinkedIn DOM scraping |
| Features | features/*.js | Feature modules |
| Utilities | utils/*.js | Shared helpers |

## Data Flow

1. User clicks extension icon → popup.html loads
2. User navigates to LinkedIn profile → content script ready
3. User clicks "Summarize" → popup sends message to content script
4. Content script extracts DOM data → returns to popup
5. Popup calls Claude API → receives summary
6. User can save candidate → stored in chrome.storage

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

## Notes

- LinkedIn DOM selectors may break when LinkedIn updates their UI
- Content script uses multiple fallback selectors for resilience
- Service worker handles API calls to avoid CORS issues in popup
