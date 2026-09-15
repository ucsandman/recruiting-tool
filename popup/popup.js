/**
 * Popup Main Controller
 * Handles tab switching, settings, and feature coordination
 */

// DOM Elements
let settingsModal;
let loadingOverlay;
let loadingMessage;
let toastContainer;
let apiKeyInput;
let apiKeyStatus;

// Track if we're in a popped-out window
let isPoppedOut = false;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  // Cache DOM elements
  settingsModal = document.getElementById('settings-modal');
  loadingOverlay = document.getElementById('loading-overlay');
  loadingMessage = document.getElementById('loading-message');
  toastContainer = document.getElementById('toast-container');
  apiKeyInput = document.getElementById('api-key-input');
  apiKeyStatus = document.getElementById('api-key-status');

  // Check if we're in a popped-out window
  isPoppedOut = window.location.search.includes('popout=true');
  if (isPoppedOut) {
    document.querySelector('.container').classList.add('popped-out');
    // Hide pop-out button in popped-out window
    const popoutBtn = document.getElementById('popout-btn');
    if (popoutBtn) popoutBtn.style.display = 'none';
  }

  // Setup event listeners
  setupTabNavigation();
  setupSettingsModal();
  setupPopout();

  // Check for API key
  const hasApiKey = await checkApiKey();
  if (!hasApiKey) {
    showToast('Please add your Claude API key to use AI features', 'info');
  }

  // Restore tab state if popped out
  if (isPoppedOut) {
    const savedTab = await Storage.get('poppedOutTab');
    if (savedTab) {
      switchTab(savedTab);
    }
  }

  // Initialize the default active tab
  initializeActiveTab();
});

/**
 * Tab Navigation
 */
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // Save tab state for popped-out window
  if (isPoppedOut) {
    Storage.set('poppedOutTab', tabId);
  }

  // Initialize the tab content
  initializeTab(tabId);
}

function initializeActiveTab() {
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab) {
    initializeTab(activeTab.dataset.tab);
  }
}

function initializeTab(tabId) {
  switch (tabId) {
    case 'summarize':
      initSummarizer();
      break;
    case 'search':
      initSearchBuilder();
      break;
    case 'compare':
      initComparison();
      break;
    case 'questions':
      initQuestions();
      break;
    case 'scorecards':
      ScorecardUI.init();
      break;
  }
}

/**
 * Settings Modal
 */
function setupSettingsModal() {
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings');
  const cancelSettingsBtn = document.getElementById('cancel-settings');
  const saveSettingsBtn = document.getElementById('save-settings');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  const modalOverlay = settingsModal.querySelector('.modal-overlay');

  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  cancelSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', saveApiKey);
  modalOverlay.addEventListener('click', closeSettings);

  // Toggle password visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
      closeSettings();
    }
  });
}

async function openSettings() {
  const apiKey = await Storage.getApiKey();
  if (apiKey) {
    apiKeyInput.value = apiKey;
    apiKeyStatus.textContent = `Current: ${maskApiKey(apiKey)}`;
  } else {
    apiKeyInput.value = '';
    apiKeyStatus.textContent = 'No API key configured';
  }
  settingsModal.classList.remove('hidden');
  apiKeyInput.focus();
}

function closeSettings() {
  settingsModal.classList.add('hidden');
  apiKeyInput.value = '';
  apiKeyInput.type = 'password';
}

async function saveApiKey() {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showToast('Please enter an API key', 'error');
    return;
  }

  if (!key.startsWith('sk-ant-')) {
    showToast('Invalid API key format. Key should start with sk-ant-', 'error');
    return;
  }

  showLoading('Validating API key...');

  try {
    // Validate by making a test call
    const isValid = await validateApiKey(key);

    if (isValid) {
      await Storage.setApiKey(key);
      showToast('API key saved successfully', 'success');
      closeSettings();
    } else {
      showToast('Invalid API key. Please check and try again.', 'error');
    }
  } catch (error) {
    showToast('Error validating API key: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

async function checkApiKey() {
  const apiKey = await Storage.getApiKey();
  return !!apiKey;
}

async function getApiKey() {
  return await Storage.getApiKey();
}

/**
 * UI Helpers
 */
function showLoading(message = 'Loading...') {
  loadingMessage.textContent = message;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Pop-out Window
 */
function setupPopout() {
  const popoutBtn = document.getElementById('popout-btn');
  if (popoutBtn) {
    popoutBtn.addEventListener('click', openPopoutWindow);
  }
}

async function openPopoutWindow() {
  // Save current tab state
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab) {
    await Storage.set('poppedOutTab', activeTab.dataset.tab);
  }

  // Save the current LinkedIn tab URL for the popped-out window to use
  const currentTab = await getCurrentTab();
  if (currentTab?.url) {
    await Storage.set('poppedOutSourceUrl', currentTab.url.split('?')[0]);
  }

  // Save comparison state if on compare tab
  if (typeof CandidateCompare !== 'undefined' && CandidateCompare.selectedIds) {
    const comparisonResult = document.getElementById('comparison-result');
    const isShowingComparison = comparisonResult && !comparisonResult.classList.contains('hidden');
    await Storage.set('poppedOutCompareState', {
      selectedIds: Array.from(CandidateCompare.selectedIds),
      showComparison: isShowingComparison
    });
  }

  // Get the popup URL
  const popupUrl = chrome.runtime.getURL('popup/popup.html') + '?popout=true';

  // Create a new window
  chrome.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 450,
    height: 700,
    focused: true
  });

  // Close the extension popup
  window.close();
}

/**
 * Feature Initialization Functions
 * These are called by the respective feature modules
 */
function initSummarizer() {
  if (typeof ProfileSummarizer !== 'undefined') {
    ProfileSummarizer.init();
  }
}

function initSearchBuilder() {
  if (typeof BooleanBuilder !== 'undefined') {
    BooleanBuilder.init();
  }
}

function initComparison() {
  if (typeof CandidateCompare !== 'undefined') {
    CandidateCompare.init();
  }
}

function initQuestions() {
  if (typeof QuestionGenerator !== 'undefined') {
    QuestionGenerator.init();
  }
}
