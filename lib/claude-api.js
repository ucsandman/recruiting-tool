/**
 * Claude API Wrapper
 * Handles communication with Claude API
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Call Claude API with a prompt
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - The Claude API key
 * @param {number} maxTokens - Maximum tokens in response (default: 1024)
 * @returns {Promise<string>} - The response text
 */
async function callClaude(prompt, apiKey, maxTokens = 1024) {
  if (!apiKey) {
    throw new Error('Please add your Claude API key in settings');
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
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

/**
 * Validate an API key by making a simple request
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - True if valid
 */
async function validateApiKey(apiKey) {
  try {
    await callClaude('Say "OK" and nothing else.', apiKey, 10);
    return true;
  } catch (error) {
    return false;
  }
}
