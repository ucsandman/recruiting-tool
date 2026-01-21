# Recruiter Toolkit - Development Progress Log

## Current Status: Feature Complete

The extension is fully functional with all four core features plus pop-out window support.

---

## Development History

### Phase 1: Initial Build
- Created Chrome Extension structure (Manifest V3)
- Implemented popup UI with tabbed navigation (Summarize, Search, Compare, Questions)
- Built Profile Summarizer with Claude API integration
- Built Boolean Search Builder
- Built Candidate Comparison tool
- Built Interview Question Generator

### Phase 2: LinkedIn Extractor v1
- Created content script for LinkedIn profile extraction
- Used CSS selectors and IDs to find profile sections
- Initial selectors worked but were fragile

### Phase 3: Bug Fixes - Pop-out and Comparison

**Issues Fixed:**
1. Summary not persisting after clicking pop-out
   - Root cause: `loadCachedSummary()` called `getCurrentTab()` which returns the popup window in pop-out mode, not the LinkedIn tab
   - Fix: Save LinkedIn tab URL to storage before pop-out, use saved URL for cache lookup

2. Compare tool not scaling in pop-out window
   - Fix: Added CSS rules for `.container.popped-out` to remove max-width/max-height constraints

3. Compare tool missing fields
   - Fix: Expanded comparison table from 8 to 18 attributes

4. Pop-out window width not expanding
   - Root cause: Container had fixed `max-width: 400px`
   - Fix: Set `max-width: none` for `.container.popped-out`

### Phase 4: LinkedIn Extractor Rewrite (Major)

**Problem:** Compare tool showing data in wrong fields (name showing job title, location showing name, etc.)

**Investigation:**
- Ran console queries on LinkedIn profile page
- Discovered LinkedIn completely removed semantic IDs from DOM
- All section ID queries returned "NOT FOUND"
- Sections exist but use `<div>` elements instead of `<li>`

**Solution:** Complete rewrite of `linkedin-extractor.js`
- Created `findSectionByHeader()` - finds sections by `innerText` starting with header text
- Created text parsers for each section type:
  - `parseEducationFromText()` - pattern matching for schools/degrees/years
  - `parseSkillsFromText()` - extracts skill names
  - `parseSimpleListFromText()` - handles certifications, languages, organizations
- No longer relies on CSS selectors or IDs

**Result:** All profile data now extracts correctly (name, headline, location, about, 7 experience items, education, skills, etc.)

### Phase 5: Question Generator Fix

**Issue:** Question slider not respected (asked for 1, got 0; asked for 2, got 3)

**Root cause:** Prompt told Claude to split questions into 3 categories (Screening 30%, Deep Dive 50%, Red Flag 20%), impossible for small counts

**Fix:** Updated `buildPrompt()` in `question-generator.js`:
- For 1-3 questions: Use simplified prompt without categories, request exact count
- For 4+ questions: Calculate exact numbers per category, use Math.round()

### Phase 6: Documentation Update
- Updated CLAUDE.md with current architecture, LinkedIn extraction approach, storage keys, known limitations
- Updated README.md with current features (question count 1-15, pop-out window, comprehensive field extraction)
- Created this progress log

---

## Known Issues & Limitations

1. **LinkedIn DOM Instability**: LinkedIn updates their page structure frequently. Current text-based extraction is resilient but may need updates if LinkedIn changes section header text.

2. **LinkedIn ToS**: Automated extraction may violate Terms of Service. Not recommended for Chrome Web Store publication.

3. **Limited Profile Access**: Extension can only extract visible data. Hidden sections require manual expansion.

---

## Files Modified (Most Recent Session)

| File | Changes |
|------|---------|
| `content/linkedin-extractor.js` | Complete rewrite for text-based extraction |
| `popup/popup.js` | Save LinkedIn URL for pop-out state |
| `popup/popup.css` | Responsive sizing, pop-out scaling |
| `features/profile-summarizer.js` | Pop-out mode handling, summary caching |
| `features/candidate-compare.js` | Scaling fixes, expanded comparison fields |
| `features/question-generator.js` | Fixed question count prompts |
| `CLAUDE.md` | Updated architecture documentation |
| `README.md` | Updated features and limitations |

---

## Next Steps (Potential)

- Add "Show more" button click automation for hidden sections
- Add export functionality (CSV/JSON)
- Add notes field for each saved candidate
- Consider alternative extraction via LinkedIn API (if available)
