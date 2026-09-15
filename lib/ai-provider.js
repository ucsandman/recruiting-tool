/**
 * AI Provider
 * Dispatches AI calls to either Anthropic (via the existing Claude API
 * wrapper) or OpenAI, chosen by the caller. Response text is returned as a
 * plain string in both cases.
 */

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Build the OpenAI chat completions request body.
 * No max_tokens / max_completion_tokens is sent: newer OpenAI models reject
 * max_tokens in favour of max_completion_tokens, and sending neither avoids
 * the incompatibility.
 * @param {string} model
 * @param {string} prompt
 * @returns {object}
 */
function buildOpenAIRequest(model, prompt) {
  return {
    model,
    messages: [
      { role: 'user', content: prompt }
    ]
  };
}

/**
 * Pull the response text out of an OpenAI chat completions response.
 * @param {object} json
 * @returns {string}
 */
function parseOpenAIResponse(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('OpenAI response was not valid JSON.');
  }
  if (!Array.isArray(json.choices) || json.choices.length === 0) {
    throw new Error('OpenAI response had no choices.');
  }
  const message = json.choices[0] && json.choices[0].message;
  if (!message || typeof message.content !== 'string') {
    throw new Error('OpenAI response choice had no message content.');
  }
  return message.content;
}

/**
 * Map a /v1/models response's data array to a sorted list of model ids.
 * @param {Array} data
 * @returns {string[]}
 */
function sortModelIds(data) {
  const list = Array.isArray(data) ? data : [];
  return list
    .map(item => item && item.id)
    .filter(id => typeof id === 'string')
    .sort();
}

/**
 * List OpenAI models available to this key, sorted by id.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function listOpenAIModels(apiKey) {
  if (!apiKey) {
    throw new Error('Please add your OpenAI API key in settings');
  }

  const response = await fetch(OPENAI_MODELS_URL, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.error?.message || `OpenAI API call failed with status ${response.status}`;
    throw new Error(message);
  }

  const json = await response.json();
  return sortModelIds(json.data);
}

/**
 * Call the chosen AI provider with a prompt.
 * @param {string} prompt
 * @param {{provider: string, apiKey: string, model?: string, maxTokens?: number}} options
 * @returns {Promise<string>} the response text
 */
async function callModel(prompt, { provider, apiKey, model, maxTokens } = {}) {
  if (provider === 'openai') {
    if (!apiKey) {
      throw new Error('Please add your OpenAI API key in settings');
    }
    if (!model) {
      throw new Error('Pick an OpenAI model in Settings (use Load models) before using AI features.');
    }

    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildOpenAIRequest(model, prompt))
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error?.message || `OpenAI API call failed with status ${response.status}`;
      throw new Error(message);
    }

    const json = await response.json();
    return parseOpenAIResponse(json);
  }

  // Anthropic: reuse the existing request builder rather than duplicating it.
  return callClaude(prompt, apiKey, maxTokens, model);
}

const AIProvider = {
  callModel,
  listOpenAIModels,
  buildOpenAIRequest,
  parseOpenAIResponse,
  sortModelIds
};

// Dual export: a browser global for the popup, a CommonJS module for the
// Node test runner. No build step.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIProvider;
}
