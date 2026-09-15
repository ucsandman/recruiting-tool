/**
 * Common Helper Functions
 */

// Generate UUID
function generateId() {
  return crypto.randomUUID();
}

// Format date for display
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Copy text to clipboard
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// Check if current tab is a LinkedIn profile page
async function isLinkedInProfile() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url?.includes('linkedin.com/in/');
}

// Get current tab info
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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

// Parse markdown-style response from Claude
function parseClaudeResponse(text) {
  const sections = {};
  const regex = /##\s+(.+?)\n([\s\S]*?)(?=##|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    sections[match[1].trim()] = match[2].trim();
  }
  return sections;
}

// Parse bullet points from text
function parseBulletPoints(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line.length > 0);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Mask API key for display (show first 7 and last 4 chars)
function maskApiKey(key) {
  if (!key || key.length < 15) return '***';
  return key.substring(0, 7) + '...' + key.substring(key.length - 4);
}

// Truncate text with ellipsis
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Parse questions from Claude response
function parseQuestions(text) {
  const questions = [];
  const lines = text.split('\n');
  let currentCategory = 'General';
  let currentQuestion = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for category headers
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      currentCategory = trimmed.replace(/^#+ /, '').replace(' Questions', '');
      continue;
    }

    // Check for question - multiple formats
    // Q: format (with or without bold markdown)
    if (trimmed.startsWith('Q:') || trimmed.startsWith('**Q:**')) {
      if (currentQuestion) questions.push(currentQuestion);
      currentQuestion = {
        question: trimmed.replace(/^\*?\*?Q:\*?\*?\s*/, '').trim(),
        category: currentCategory,
        assesses: ''
      };
      continue;
    }

    // Numbered format: 1. or 1)
    const numberedMatch = trimmed.match(/^\d+[\.\)]\s*(.+)/);
    if (numberedMatch && trimmed.endsWith('?')) {
      if (currentQuestion) questions.push(currentQuestion);
      currentQuestion = {
        question: numberedMatch[1].trim(),
        category: currentCategory,
        assesses: ''
      };
      continue;
    }

    // Bullet format with question
    if ((trimmed.startsWith('- ') || trimmed.startsWith('* ')) && trimmed.endsWith('?')) {
      if (currentQuestion) questions.push(currentQuestion);
      currentQuestion = {
        question: trimmed.replace(/^[-*]\s*/, '').trim(),
        category: currentCategory,
        assesses: ''
      };
      continue;
    }

    // Check for assessment (handles **Assesses:** format)
    if (currentQuestion && (trimmed.startsWith('Assesses:') || trimmed.startsWith('*Assesses') || trimmed.startsWith('**Assesses'))) {
      currentQuestion.assesses = trimmed.replace(/^\*?\*?Assesses:?\*?\*?\s*/, '').trim();
    }
  }

  // Don't forget the last question
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

/**
 * Ask the content script on a tab to extract the profile.
 *
 * Chrome answers "Could not establish connection. Receiving end does not
 * exist." whenever no content script is listening on that tab — which happens
 * routinely after the extension is reloaded or updated, because existing tabs
 * keep running the old (now detached) script until they are refreshed. That
 * raw message tells a recruiter nothing, so translate it into the action that
 * actually fixes it.
 *
 * A friendly version of this already existed in background/service-worker.js,
 * but nothing calls that path — every feature messages the tab directly.
 */
async function extractProfileFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'extractProfile' });
  } catch (error) {
    const message = (error && error.message) || '';
    if (/receiving end does not exist|could not establish connection|message port closed/i.test(message)) {
      throw new Error('Refresh this LinkedIn tab, then try again. The extension was reloaded and this tab is still running the old version.');
    }
    throw error;
  }
}
