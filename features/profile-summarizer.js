/**
 * Profile Summarizer Feature
 * Extracts LinkedIn profile data and generates AI summaries
 */

const ProfileSummarizer = {
  container: null,
  currentProfile: null,
  currentSummary: null,
  initialized: false,

  init() {
    this.container = document.getElementById('summarize-container');
    if (!this.container) return;

    if (!this.initialized) {
      this.render();
      this.initialized = true;
    }
  },

  render() {
    this.container.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const status = document.createElement('div');
    status.id = 'summarize-status';
    status.className = 'text-center mb-4';
    status.textContent = 'Checking page...';

    const btn = document.createElement('button');
    btn.id = 'summarize-btn';
    btn.className = 'btn btn-primary btn-block';
    btn.disabled = true;
    btn.textContent = 'Summarize This Profile';

    cardBody.appendChild(status);
    cardBody.appendChild(btn);
    card.appendChild(cardBody);
    this.container.appendChild(card);

    const resultDiv = document.createElement('div');
    resultDiv.id = 'summary-result';
    resultDiv.className = 'mt-4 hidden';
    this.container.appendChild(resultDiv);

    this.bindEvents();
    this.checkPage();
  },

  bindEvents() {
    const summarizeBtn = document.getElementById('summarize-btn');
    summarizeBtn?.addEventListener('click', () => this.summarizeProfile());
  },

  async checkPage() {
    const statusEl = document.getElementById('summarize-status');
    const summarizeBtn = document.getElementById('summarize-btn');

    const isProfile = await isLinkedInProfile();

    if (isProfile) {
      statusEl.textContent = '';
      const successDiv = document.createElement('div');
      successDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--accent);';
      successDiv.textContent = 'LinkedIn profile detected';
      statusEl.appendChild(successDiv);
      summarizeBtn.disabled = false;
    } else {
      statusEl.textContent = '';
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      const h3 = document.createElement('h3');
      h3.textContent = 'Not on a LinkedIn Profile';
      const p = document.createElement('p');
      p.textContent = 'Navigate to a LinkedIn profile page to summarize it';
      emptyState.appendChild(h3);
      emptyState.appendChild(p);
      statusEl.appendChild(emptyState);
      summarizeBtn.disabled = true;
    }
  },

  async summarizeProfile() {
    const apiKey = await getApiKey();
    if (!apiKey) {
      showToast('Please add your Claude API key in settings', 'error');
      return;
    }

    showLoading('Extracting profile data...');

    try {
      const tab = await getCurrentTab();
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractProfile' });

      if (!response.success) {
        throw new Error(response.error || 'Failed to extract profile data');
      }

      this.currentProfile = response.data;
      showLoading('Generating AI summary...');

      const prompt = this.buildPrompt(this.currentProfile);
      const summaryText = await callClaude(prompt, apiKey, 1024);

      this.currentSummary = parseClaudeResponse(summaryText);
      this.currentSummary.raw = summaryText;

      this.displaySummary();

    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      hideLoading();
    }
  },

  buildPrompt(profile) {
    const experience = profile.experience?.map(e =>
      `${e.title} at ${e.company} (${e.duration || 'N/A'})`
    ).join('\n') || 'Not available';

    const education = profile.education?.map(e =>
      `${e.degree || ''} ${e.field || ''} from ${e.school} (${e.years || 'N/A'})`
    ).join('\n') || 'Not available';

    return `You are an expert recruiter assistant. Analyze this LinkedIn profile and provide a concise, actionable summary.

PROFILE DATA:
Name: ${profile.name || 'Unknown'}
Headline: ${profile.headline || 'Not available'}
Location: ${profile.location || 'Not available'}
Current Role: ${profile.currentRole?.title || 'Not available'} at ${profile.currentRole?.company || 'Unknown'}

About:
${profile.about || 'Not available'}

Experience:
${experience}

Education:
${education}

Skills: ${profile.skills?.join(', ') || 'Not available'}

Provide your analysis in this exact format:

## Key Qualifications
- [3-4 standout qualifications]

## Experience Highlights
[2-3 sentences about notable achievements and career progression]

## Potential Concerns
[Any gaps, job hopping, or unclear career paths - be honest but fair. If none, say "None identified."]

## Best Fit For
[Role types and company cultures where this person would thrive]`;
  },

  displaySummary() {
    const resultEl = document.getElementById('summary-result');
    const summary = this.currentSummary;

    const qualifications = parseBulletPoints(summary['Key Qualifications'] || '');
    const highlights = summary['Experience Highlights'] || '';
    const concerns = summary['Potential Concerns'] || 'None identified.';
    const bestFit = summary['Best Fit For'] || '';

    resultEl.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    const headerStrong = document.createElement('strong');
    headerStrong.textContent = this.currentProfile.name || 'Profile Summary';
    header.appendChild(headerStrong);

    const body = document.createElement('div');
    body.className = 'card-body';

    // Key Qualifications
    const qualSection = document.createElement('div');
    qualSection.className = 'summary-section';
    const qualH3 = document.createElement('h3');
    qualH3.textContent = 'Key Qualifications';
    qualSection.appendChild(qualH3);
    const qualUl = document.createElement('ul');
    qualifications.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      qualUl.appendChild(li);
    });
    qualSection.appendChild(qualUl);
    body.appendChild(qualSection);

    // Experience Highlights
    const expSection = document.createElement('div');
    expSection.className = 'summary-section';
    const expH3 = document.createElement('h3');
    expH3.textContent = 'Experience Highlights';
    expSection.appendChild(expH3);
    const expP = document.createElement('p');
    expP.textContent = highlights;
    expSection.appendChild(expP);
    body.appendChild(expSection);

    // Potential Concerns
    const conSection = document.createElement('div');
    conSection.className = 'summary-section';
    const conH3 = document.createElement('h3');
    conH3.textContent = 'Potential Concerns';
    conSection.appendChild(conH3);
    const conP = document.createElement('p');
    conP.textContent = concerns;
    conSection.appendChild(conP);
    body.appendChild(conSection);

    // Best Fit For
    const fitSection = document.createElement('div');
    fitSection.className = 'summary-section';
    const fitH3 = document.createElement('h3');
    fitH3.textContent = 'Best Fit For';
    fitSection.appendChild(fitH3);
    const fitP = document.createElement('p');
    fitP.textContent = bestFit;
    fitSection.appendChild(fitP);
    body.appendChild(fitSection);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'copy-summary-btn';
    copyBtn.className = 'btn btn-secondary btn-sm';
    copyBtn.textContent = 'Copy Summary';
    copyBtn.addEventListener('click', () => this.copySummary());

    const saveBtn = document.createElement('button');
    saveBtn.id = 'save-candidate-btn';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = 'Save for Comparison';
    saveBtn.addEventListener('click', () => this.saveCandidate());

    footer.appendChild(copyBtn);
    footer.appendChild(saveBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    resultEl.appendChild(card);

    resultEl.classList.remove('hidden');
  },

  async copySummary() {
    if (!this.currentSummary?.raw) {
      showToast('No summary to copy', 'error');
      return;
    }

    try {
      await copyToClipboard(this.currentSummary.raw);
      showToast('Summary copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy summary', 'error');
    }
  },

  async saveCandidate() {
    if (!this.currentProfile || !this.currentSummary) {
      showToast('No profile data to save', 'error');
      return;
    }

    try {
      const candidate = {
        id: generateId(),
        savedAt: Date.now(),
        profileUrl: this.currentProfile.profileUrl,
        profileData: this.currentProfile,
        summary: this.currentSummary
      };

      await Storage.addCandidate(candidate);
      showToast('Candidate saved for comparison', 'success');

      const saveBtn = document.getElementById('save-candidate-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saved';
      }
    } catch (error) {
      showToast('Failed to save candidate', 'error');
    }
  }
};
