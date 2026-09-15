/**
 * Background Service Worker
 * Handles API calls and message passing
 */

importScripts('/lib/claude-api.js');

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callClaude') {
    handleClaudeCall(request.prompt, request.apiKey, request.maxTokens, request.model)
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
 * Make a call to Claude API. The request itself lives in lib/claude-api.js
 * so there is exactly one place the model id and headers are set.
 */
async function handleClaudeCall(prompt, apiKey, maxTokens = 1024, model) {
  return callClaude(prompt, apiKey, maxTokens, model);
}

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Recruiter Toolkit installed successfully');
  }
});
