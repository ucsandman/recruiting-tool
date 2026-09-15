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
  },

  // Scorecard helpers
  async getScorecards() {
    return (await this.get('scorecards')) || [];
  },

  async saveScorecard(scorecard) {
    const all = await this.getScorecards();
    const index = all.findIndex(s => s.id === scorecard.id);
    if (index >= 0) all[index] = scorecard;
    else all.push(scorecard);
    return this.set('scorecards', all);
  },

  async removeScorecard(id) {
    const all = await this.getScorecards();
    return this.set('scorecards', all.filter(s => s.id !== id));
  }
};
