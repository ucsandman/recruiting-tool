/**
 * Background Service Worker
 * Handles API calls and message passing
 */

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callClaude') {
    handleClaudeCall(request.prompt, request.apiKey, request.maxTokens)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }

  if (request.action === 'extractProfile') {
    // Forward to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractProfile' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: 'Could not communicate with LinkedIn page. Please refresh the page and try again.'
            });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true;
  }
});

/**
 * Make a call to Claude API
 */
async function handleClaudeCall(prompt, apiKey, maxTokens = 1024) {
  if (!apiKey) {
    throw new Error('Please add your Claude API key in settings');
  }

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
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `API call failed with status ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Recruiter Toolkit installed successfully');
  }
});
