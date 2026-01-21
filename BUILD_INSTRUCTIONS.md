# Recruiter Toolkit - Chrome Extension Build Instructions

> **For Claude Code:** Build this Chrome extension in its entirety following these specifications. This is a complete, production-ready Chrome extension with four AI-powered features for recruiters.

---

## Project Overview

**Recruiter Toolkit** is a Chrome Extension (Manifest V3) that provides AI-assisted recruiting features:

1. **LinkedIn Profile Summarizer** - One-click profile analysis
2. **Boolean Search Builder** - Visual query builder with real-time preview
3. **Candidate Comparison Tool** - Side-by-side candidate comparison
4. **Interview Question Generator** - Role-specific question generation

**Key Technical Decisions:**
- Manifest V3 (modern Chrome extension format)
- Claude API for AI features (user provides their own API key)
- Local Chrome Storage for saved candidates
- No backend required - fully client-side
- Content script for LinkedIn data extraction

---

## Project Structure

```
recruiting-tool/
├── manifest.json                 # Extension manifest (V3)
├── popup/
│   ├── popup.html               # Main popup UI
│   ├── popup.css                # Popup styles
│   └── popup.js                 # Popup logic and tab management
├── content/
│   └── linkedin-extractor.js    # Content script for LinkedIn profiles
├── background/
│   └── service-worker.js        # Background service worker
├── lib/
│   └── claude-api.js            # Claude API wrapper
├── features/
│   ├── profile-summarizer.js    # Feature 1: Profile summaries
│   ├── boolean-builder.js       # Feature 2: Boolean search builder
│   ├── candidate-compare.js     # Feature 3: Comparison tool
│   └── question-generator.js    # Feature 4: Interview questions
├── utils/
│   ├── storage.js               # Chrome storage utilities
│   └── helpers.js               # Common helper functions
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

---

## File Specifications

### 1. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Recruiter Toolkit",
  "version": "1.0.0",
  "description": "AI-powered recruiting assistant with LinkedIn profile summaries, boolean search builder, candidate comparison, and interview question generation.",
  "permissions": [
    "activeTab",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://api.anthropic.com/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/in/*"],
      "js": ["content/linkedin-extractor.js"]
    }
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

---

### 2. popup/popup.html

Build a clean, modern popup UI with:

**Layout Structure:**
- Fixed width: 400px
- Min height: 500px, max height: 600px (scrollable)
- Tab navigation at top (4 tabs with icons)
- Content area below tabs
- Settings gear icon in header for API key configuration

**Tab Navigation:**
1. **Summarize** (icon: person/profile) - Default active tab
2. **Search** (icon: search/magnifier)
3. **Compare** (icon: compare/columns)
4. **Questions** (icon: question mark/chat)

**Settings Modal:**
- Triggered by gear icon in header
- Contains API key input field (password type with show/hide toggle)
- Save and Cancel buttons
- Shows masked key if already saved (e.g., "sk-ant-...xxxxx")

**Design Requirements:**
- Clean, professional appearance
- Use a blue color scheme (#1E40AF primary, #3B82F6 secondary)
- White background, subtle shadows
- Inter font family (load via Google Fonts)
- Smooth transitions between tabs
- Loading states for AI operations

---

### 3. popup/popup.css

**Color Palette:**
```css
:root {
  --primary: #1E40AF;
  --primary-hover: #1D4ED8;
  --primary-light: #EFF6FF;
  --secondary: #3B82F6;
  --accent: #10B981;
  --danger: #EF4444;
  --warning: #F59E0B;
  --text: #1E293B;
  --text-muted: #64748B;
  --border: #E2E8F0;
  --background: #FFFFFF;
  --background-alt: #F8FAFC;
}
```

**Required Styles:**
- Tab buttons (active state with underline/highlight)
- Primary button (gradient: primary to primary-hover)
- Secondary/ghost buttons
- Input fields with focus states
- Card containers with subtle shadows
- Loading spinner animation
- Toast notifications (success/error)
- Comparison table styles
- Candidate cards
- Scrollable content areas
- Modal overlay and dialog

---

### 4. popup/popup.js

**Responsibilities:**
- Tab switching logic
- Settings modal management
- API key storage/retrieval
- Coordinate between features and UI
- Handle loading states
- Display toast notifications

**Event Flow:**
1. On popup open: Check if API key exists, show setup prompt if not
2. Tab clicks: Show/hide content sections, call feature initialization
3. Settings save: Validate and store API key
4. Feature buttons: Trigger respective feature modules

**Key Functions:**
```javascript
// Tab management
function switchTab(tabId)
function initializeActiveTab()

// Settings
function openSettings()
function closeSettings()
function saveApiKey()
function getApiKey()

// UI helpers
function showLoading(message)
function hideLoading()
function showToast(message, type) // type: 'success' | 'error' | 'info'

// Feature coordination
function initSummarizer()
function initSearchBuilder()
function initComparison()
function initQuestions()
```

---

### 5. content/linkedin-extractor.js

**Purpose:** Extract profile data from LinkedIn profile pages

**Data to Extract:**
```javascript
{
  name: string,
  headline: string,
  location: string,
  profileUrl: string,
  profileImageUrl: string,
  about: string,
  currentRole: {
    title: string,
    company: string,
    duration: string
  },
  experience: [
    {
      title: string,
      company: string,
      duration: string,
      description: string
    }
  ],
  education: [
    {
      school: string,
      degree: string,
      field: string,
      years: string
    }
  ],
  skills: string[],
  certifications: string[],
  languages: string[]
}
```

**Implementation Notes:**
- Listen for messages from popup asking for profile data
- Use DOM selectors to extract data (LinkedIn's structure changes, use data-* attributes where possible)
- Handle missing data gracefully (return null for unavailable fields)
- Return extracted data via message passing

**Key Selectors to Target:**
- Name: `h1` in the intro section
- Headline: The text under the name
- Experience section: Look for "Experience" section container
- Education section: Look for "Education" section container
- Skills: Look for "Skills" section

**Message Protocol:**
```javascript
// Popup sends:
{ action: 'extractProfile' }

// Content script responds:
{ success: true, data: profileData }
// or
{ success: false, error: 'Not on a LinkedIn profile page' }
```

---

### 6. background/service-worker.js

**Responsibilities:**
- Handle Claude API calls (to avoid CORS issues)
- Message passing between popup and content scripts
- Manage extension lifecycle

**API Call Pattern:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callClaude') {
    callClaudeAPI(request.prompt, request.apiKey)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});
```

---

### 7. lib/claude-api.js

**Claude API Integration:**
- Endpoint: `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-20250514` (good balance of speed/quality for this use case)
- Max tokens: 1024 for summaries, 512 for questions

**API Call Function:**
```javascript
async function callClaude(prompt, apiKey, maxTokens = 1024) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API call failed');
  }
  
  const data = await response.json();
  return data.content[0].text;
}
```

---

### 8. features/profile-summarizer.js

**UI Elements:**
- "Summarize This Profile" button (only active on LinkedIn profile pages)
- Results display area with sections:
  - Key Qualifications (bulleted list, 3-4 items)
  - Experience Highlights (paragraph)
  - Potential Concerns (if any, displayed sensitively)
  - Best Fit For (role types and cultures)
- "Save for Comparison" button (appears after summary)
- "Copy Summary" button

**Workflow:**
1. User clicks "Summarize This Profile"
2. Check if on LinkedIn profile page
3. Send message to content script to extract profile
4. Build prompt with extracted data
5. Call Claude API via background script
6. Parse and display results
7. Show "Save for Comparison" button

**Prompt Template:**
```
You are an expert recruiter assistant. Analyze this LinkedIn profile and provide a concise, actionable summary.

PROFILE DATA:
Name: {name}
Headline: {headline}
Location: {location}
Current Role: {currentRole}
Experience: {experience}
Education: {education}
Skills: {skills}

Provide your analysis in this exact format:

## Key Qualifications
- [3-4 standout qualifications]

## Experience Highlights
[2-3 sentences about notable achievements and career progression]

## Potential Concerns
[Any gaps, job hopping, or unclear career paths - be honest but fair. If none, say "None identified."]

## Best Fit For
[Role types and company cultures where this person would thrive]
```

---

### 9. features/boolean-builder.js

**UI Elements:**
- Form fields:
  - Job Title (text input with OR helper, e.g., "Software Engineer" OR "Developer")
  - Company (text input)
  - Must Have Skills (text input, AND logic)
  - Nice to Have Skills (text input, OR logic)
  - Location (text input)
  - Exclude Terms (text input, NOT logic)
- Real-time query preview box
- "Copy to Clipboard" button
- Syntax help tooltip

**Query Building Logic:**
```javascript
function buildBooleanQuery(inputs) {
  const parts = [];
  
  // Job titles - wrap in quotes, join with OR
  if (inputs.jobTitle) {
    const titles = inputs.jobTitle.split(',').map(t => `"${t.trim()}"`);
    parts.push(`(${titles.join(' OR ')})`);
  }
  
  // Company - wrap in quotes, join with OR
  if (inputs.company) {
    const companies = inputs.company.split(',').map(c => `"${c.trim()}"`);
    parts.push(`(${companies.join(' OR ')})`);
  }
  
  // Must have skills - join with AND
  if (inputs.mustHaveSkills) {
    const skills = inputs.mustHaveSkills.split(',').map(s => `"${s.trim()}"`);
    parts.push(`(${skills.join(' AND ')})`);
  }
  
  // Nice to have skills - join with OR
  if (inputs.niceToHaveSkills) {
    const skills = inputs.niceToHaveSkills.split(',').map(s => `"${s.trim()}"`);
    parts.push(`(${skills.join(' OR ')})`);
  }
  
  // Location
  if (inputs.location) {
    const locations = inputs.location.split(',').map(l => `"${l.trim()}"`);
    parts.push(`(${locations.join(' OR ')})`);
  }
  
  // Exclusions - NOT
  if (inputs.exclude) {
    const excludes = inputs.exclude.split(',').map(e => `NOT "${e.trim()}"`);
    parts.push(excludes.join(' '));
  }
  
  return parts.join(' AND ');
}
```

**Real-time Updates:**
- Add input event listeners to all fields
- Rebuild and display query on every change
- Highlight syntax in the preview (optional but nice)

---

### 10. features/candidate-compare.js

**UI Elements:**
- Saved candidates list (cards showing name, headline, save date)
- Checkboxes to select candidates for comparison (max 3)
- "Compare Selected" button
- Comparison table view
- "Remove" button on each candidate card
- "Clear All" button

**Comparison Table Columns:**
| Attribute | Candidate 1 | Candidate 2 | Candidate 3 |
|-----------|-------------|-------------|-------------|
| Name | | | |
| Current Role | | | |
| Company | | | |
| Location | | | |
| Total Experience | | | |
| Education | | | |
| Top Skills | | | |
| Key Qualifications | | | |
| Concerns | | | |
| Best Fit For | | | |

**Storage Schema:**
```javascript
{
  savedCandidates: [
    {
      id: string,          // UUID
      savedAt: timestamp,
      profileUrl: string,
      profileData: {...},  // Raw extracted data
      summary: {...}       // Parsed summary from Claude
    }
  ]
}
```

**Key Functions:**
```javascript
async function saveCandidate(profileData, summary)
async function getSavedCandidates()
async function removeCandidate(id)
async function clearAllCandidates()
function renderCandidateList(candidates)
function renderComparisonTable(selectedCandidates)
```

---

### 11. features/question-generator.js

**UI Elements:**
- Job Title input (required)
- Key Requirements textarea (what the role needs)
- Question Type selector (radio buttons or pills):
  - Behavioral
  - Technical
  - Mixed (default)
- Number of questions slider (5-15, default 10)
- "Generate Questions" button
- Results area with question cards
- Each question shows:
  - The question text
  - Category badge (Screening / Deep Dive / Red Flag)
  - "What this assesses" note
- "Copy All Questions" button

**Prompt Template:**
```
You are an expert interviewer. Generate interview questions for this role.

ROLE: {jobTitle}
KEY REQUIREMENTS: {requirements}
QUESTION TYPE: {type}
NUMBER OF QUESTIONS: {count}

Generate questions in three categories:

## Screening Questions
[Quick questions to assess basic fit - about 30% of total]

## Deep Dive Questions  
[Detailed questions to assess capabilities - about 50% of total]

## Red Flag Questions
[Questions designed to uncover potential concerns - about 20% of total]

For each question, use this format:
Q: [The question]
Assesses: [What this question is designed to evaluate]

Make questions specific to the role and requirements provided. Avoid generic questions.
```

**Response Parsing:**
Parse the Claude response to extract questions and their assessments into structured data for display.

---

### 12. utils/storage.js

**Chrome Storage Wrapper:**
```javascript
const Storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  },
  
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },
  
  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  },
  
  // Specific helpers
  async getApiKey() {
    return this.get('claudeApiKey');
  },
  
  async setApiKey(key) {
    return this.set('claudeApiKey', key);
  },
  
  async getSavedCandidates() {
    return (await this.get('savedCandidates')) || [];
  },
  
  async saveCandidates(candidates) {
    return this.set('savedCandidates', candidates);
  }
};
```

---

### 13. utils/helpers.js

**Common Utilities:**
```javascript
// Generate UUID
function generateId() {
  return crypto.randomUUID();
}

// Format date
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Copy to clipboard
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// Check if on LinkedIn profile page
async function isLinkedInProfile() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url?.includes('linkedin.com/in/');
}

// Debounce function for real-time updates
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Parse markdown-ish response from Claude
function parseClaudeResponse(text) {
  // Split by ## headers
  const sections = {};
  const regex = /##\s+(.+?)\n([\s\S]*?)(?=##|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    sections[match[1].trim()] = match[2].trim();
  }
  return sections;
}
```

---

### 14. Icons

Create simple, clean icons in the blue color scheme (#1E40AF):
- 16x16, 32x32, 48x48, 128x128 PNG files
- Design: Stylized "R" or briefcase or person-search icon
- Flat design, no gradients

**Alternative:** Use a placeholder icon generator or simple shape for MVP, recommend proper icons later.

---

## Implementation Order

Build in this order for logical dependencies:

1. **manifest.json** - Extension foundation
2. **utils/storage.js** - Storage utilities needed by everything
3. **utils/helpers.js** - Common helpers
4. **popup/popup.html** - Basic structure
5. **popup/popup.css** - Styling
6. **popup/popup.js** - Tab management, settings
7. **lib/claude-api.js** - API wrapper
8. **background/service-worker.js** - API proxy
9. **content/linkedin-extractor.js** - LinkedIn scraping
10. **features/profile-summarizer.js** - Feature 1
11. **features/boolean-builder.js** - Feature 2
12. **features/candidate-compare.js** - Feature 3
13. **features/question-generator.js** - Feature 4
14. **Icons** - Extension icons

---

## Testing Checklist

### Setup
- [ ] Extension loads in Chrome (chrome://extensions, Developer mode, Load unpacked)
- [ ] Popup opens when clicking extension icon
- [ ] Settings modal opens and saves API key

### Feature 1: Profile Summarizer
- [ ] Shows message when not on LinkedIn profile
- [ ] Extracts data from LinkedIn profile
- [ ] Generates summary via Claude API
- [ ] Displays formatted summary
- [ ] Save for Comparison works
- [ ] Copy Summary works

### Feature 2: Boolean Search Builder
- [ ] All input fields work
- [ ] Query updates in real-time
- [ ] Copy to Clipboard works
- [ ] Generated query is valid boolean syntax

### Feature 3: Candidate Comparison
- [ ] Saved candidates appear in list
- [ ] Can select up to 3 candidates
- [ ] Comparison table displays correctly
- [ ] Remove candidate works
- [ ] Clear all works

### Feature 4: Question Generator
- [ ] Form validates required fields
- [ ] Generates questions via Claude API
- [ ] Questions display with categories
- [ ] Copy All Questions works

### Edge Cases
- [ ] No API key: Shows setup prompt
- [ ] Invalid API key: Shows error message
- [ ] API error: Shows error toast
- [ ] No candidates saved: Shows empty state
- [ ] LinkedIn page not fully loaded: Handles gracefully

---

## Error Handling

Implement consistent error handling:

```javascript
// Wrap API calls
try {
  showLoading('Generating summary...');
  const result = await callClaude(prompt, apiKey);
  displayResult(result);
} catch (error) {
  showToast(error.message, 'error');
} finally {
  hideLoading();
}
```

**Common Error Messages:**
- "Please add your Claude API key in settings"
- "Please navigate to a LinkedIn profile to use this feature"
- "Could not extract profile data. Please refresh the page and try again."
- "API error: {message}"
- "Please select 2-3 candidates to compare"

---

## Polish Items

After core functionality works:

1. **Empty States**
   - No candidates saved: "Save candidates from the Summarize tab to compare them here"
   - Not on LinkedIn: "Navigate to a LinkedIn profile to summarize it"

2. **Loading States**
   - Skeleton loaders or spinners
   - Disabled buttons during loading
   - Progress indication for multi-step operations

3. **Keyboard Shortcuts**
   - Enter to submit forms
   - Escape to close modals
   - Tab navigation

4. **Animations**
   - Fade in results
   - Slide transitions between tabs
   - Button hover effects

---

## Notes for the Builder

- **LinkedIn Scraping:** LinkedIn's DOM structure changes frequently. Build the extractor to fail gracefully and return partial data if some elements aren't found.

- **API Key Security:** Store in chrome.storage.local, which is reasonably secure for this use case. Never log or transmit the key except to Anthropic's API.

- **Rate Limiting:** Claude API has rate limits. Consider adding a simple cooldown or queue if users spam the summarize button.

- **Manifest V3 Constraints:** Service workers can be unloaded. Don't store state there; use chrome.storage instead.

- **Content Security Policy:** Manifest V3 has strict CSP. No inline scripts in HTML; all JS must be in separate files.

---

## Success Criteria

The extension is complete when:
1. All four features work end-to-end
2. UI is clean and professional
3. Error states are handled gracefully
4. Extension can be loaded and used without errors in Chrome
5. A recruiter can realistically use it in their daily workflow

---

*Built with appreciation for the work recruiters do.*
