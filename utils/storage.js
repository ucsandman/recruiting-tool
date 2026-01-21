/**
 * Chrome Storage Wrapper
 * Provides async/await interface for chrome.storage.local
 */
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

  // API Key helpers
  async getApiKey() {
    return this.get('claudeApiKey');
  },

  async setApiKey(key) {
    return this.set('claudeApiKey', key);
  },

  async removeApiKey() {
    return this.remove('claudeApiKey');
  },

  // Candidate storage helpers
  async getSavedCandidates() {
    return (await this.get('savedCandidates')) || [];
  },

  async saveCandidates(candidates) {
    return this.set('savedCandidates', candidates);
  },

  async addCandidate(candidate) {
    const candidates = await this.getSavedCandidates();
    candidates.push(candidate);
    return this.saveCandidates(candidates);
  },

  async removeCandidate(id) {
    const candidates = await this.getSavedCandidates();
    const filtered = candidates.filter(c => c.id !== id);
    return this.saveCandidates(filtered);
  },

  async clearAllCandidates() {
    return this.saveCandidates([]);
  }
};
