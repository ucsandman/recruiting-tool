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
    } else {
      // Re-check for cached summary when tab is re-selected
      this.loadCachedSummary();
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

  async loadCachedSummary() {
    // In pop-out mode, use the saved source URL instead of current tab
    let currentUrl;
    if (isPoppedOut) {
      currentUrl = await Storage.get('poppedOutSourceUrl');
    } else {
      const tab = await getCurrentTab();
      currentUrl = tab.url?.split('?')[0];
    }

    const cached = await Storage.get('cachedSummary');

    if (cached && cached.profileUrl === currentUrl) {
      this.currentProfile = cached.profileData;
      this.currentSummary = cached.summary;
      try {
        await this.displaySummary();
      } catch (error) {
        showToast('Failed to load the cached summary', 'error');
      }
    }
  },

  async cacheSummary() {
    if (this.currentProfile && this.currentSummary) {
      await Storage.set('cachedSummary', {
        profileUrl: this.currentProfile.profileUrl,
        profileData: this.currentProfile,
        summary: this.currentSummary,
        cachedAt: Date.now()
      });
    }
  },

  bindEvents() {
    const summarizeBtn = document.getElementById('summarize-btn');
    summarizeBtn?.addEventListener('click', () => this.summarizeProfile());
  },

  async checkPage() {
    const statusEl = document.getElementById('summarize-status');
    const summarizeBtn = document.getElementById('summarize-btn');

    // In pop-out mode, just try to load cached summary
    if (isPoppedOut) {
      const cached = await Storage.get('cachedSummary');
      const sourceUrl = await Storage.get('poppedOutSourceUrl');

      if (cached && cached.profileUrl === sourceUrl) {
        statusEl.textContent = '';
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-muted);';
        infoDiv.textContent = 'Viewing cached summary';
        statusEl.appendChild(infoDiv);
        summarizeBtn.style.display = 'none'; // Can't summarize new profiles in pop-out
        await this.loadCachedSummary();
      } else {
        statusEl.textContent = '';
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        const h3 = document.createElement('h3');
        h3.textContent = 'No Summary Available';
        const p = document.createElement('p');
        p.textContent = 'Summarize a profile from the extension popup first';
        emptyState.appendChild(h3);
        emptyState.appendChild(p);
        statusEl.appendChild(emptyState);
        summarizeBtn.style.display = 'none';
      }
      return;
    }

    const isProfile = await isLinkedInProfile();

    if (isProfile) {
      statusEl.textContent = '';
      const successDiv = document.createElement('div');
      successDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--accent);';
      successDiv.textContent = 'LinkedIn profile detected';
      statusEl.appendChild(successDiv);
      summarizeBtn.disabled = false;

      // Check for cached summary for this profile
      await this.loadCachedSummary();
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

      // Cache the summary
      await this.cacheSummary();

      await this.displaySummary();

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

    const certifications = profile.certifications?.join(', ') || 'None listed';

    const volunteering = profile.volunteering?.map(v =>
      `${v.role} at ${v.organization || 'Unknown'}`
    ).join(', ') || 'None listed';

    const honors = profile.honors?.map(h => h.title).join(', ') || 'None listed';

    const organizations = profile.organizations?.map(o =>
      `${o.name}${o.role ? ' (' + o.role + ')' : ''}`
    ).join(', ') || 'None listed';

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

Certifications: ${certifications}

Volunteering: ${volunteering}

Honors & Awards: ${honors}

Organizations: ${organizations}

Services Offered: ${profile.services?.join(', ') || 'None listed'}

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

  async displaySummary() {
    const resultEl = document.getElementById('summary-result');
    const summary = this.currentSummary;
    const profile = this.currentProfile;

    const qualifications = parseBulletPoints(summary['Key Qualifications'] || '');
    const highlights = summary['Experience Highlights'] || '';
    const concerns = summary['Potential Concerns'] || 'None identified.';
    const bestFit = summary['Best Fit For'] || '';

    resultEl.textContent = '';

    // Profile Info Card
    const profileCard = document.createElement('div');
    profileCard.className = 'card mb-4';

    const profileHeader = document.createElement('div');
    profileHeader.className = 'card-header';
    const profileTitle = document.createElement('strong');
    profileTitle.textContent = profile.name || 'Profile';
    profileHeader.appendChild(profileTitle);

    const profileBody = document.createElement('div');
    profileBody.className = 'card-body';

    profileBody.appendChild(this.renderSignals(profile));
    profileBody.appendChild(await this.renderScoring(profile));

    // Basic Info
    if (profile.headline) {
      const headlineP = document.createElement('p');
      headlineP.style.cssText = 'font-weight: 500; margin-bottom: 4px;';
      headlineP.textContent = profile.headline;
      profileBody.appendChild(headlineP);
    }
    if (profile.location) {
      const locationP = document.createElement('p');
      locationP.className = 'text-muted text-sm';
      locationP.textContent = profile.location;
      profileBody.appendChild(locationP);
    }

    // About Section
    if (profile.about) {
      const aboutSection = this.createCollapsibleSection('About', profile.about);
      profileBody.appendChild(aboutSection);
    }

    // Experience Section
    if (profile.experience?.length > 0) {
      const expContent = profile.experience.map(e =>
        `<strong>${e.title}</strong> at ${e.company || 'Unknown'}${e.duration ? ' (' + e.duration + ')' : ''}`
      ).join('<br>');
      const expSection = this.createCollapsibleSection('Experience', expContent, true);
      profileBody.appendChild(expSection);
    }

    // Education Section
    if (profile.education?.length > 0) {
      const eduContent = profile.education.map(e =>
        `<strong>${e.school}</strong>${e.degree ? ' - ' + e.degree : ''}${e.field ? ', ' + e.field : ''}${e.years ? ' (' + e.years + ')' : ''}`
      ).join('<br>');
      const eduSection = this.createCollapsibleSection('Education', eduContent, true);
      profileBody.appendChild(eduSection);
    }

    // Skills Section
    if (profile.skills?.length > 0) {
      const skillsSection = this.createCollapsibleSection('Skills', profile.skills.join(', '));
      profileBody.appendChild(skillsSection);
    }

    // Certifications Section
    if (profile.certifications?.length > 0) {
      const certSection = this.createCollapsibleSection('Certifications', profile.certifications.join(', '));
      profileBody.appendChild(certSection);
    }

    // Services Section
    if (profile.services?.length > 0) {
      const servSection = this.createCollapsibleSection('Services', profile.services.join(', '));
      profileBody.appendChild(servSection);
    }

    // Volunteering Section
    if (profile.volunteering?.length > 0) {
      const volContent = profile.volunteering.map(v =>
        `${v.role} at ${v.organization || 'Unknown'}${v.duration ? ' (' + v.duration + ')' : ''}`
      ).join('<br>');
      const volSection = this.createCollapsibleSection('Volunteering', volContent, true);
      profileBody.appendChild(volSection);
    }

    // Honors Section
    if (profile.honors?.length > 0) {
      const honContent = profile.honors.map(h =>
        `${h.title}${h.issuer ? ' - ' + h.issuer : ''}`
      ).join('<br>');
      const honSection = this.createCollapsibleSection('Honors & Awards', honContent, true);
      profileBody.appendChild(honSection);
    }

    // Organizations Section
    if (profile.organizations?.length > 0) {
      const orgContent = profile.organizations.map(o =>
        `${o.name}${o.role ? ' (' + o.role + ')' : ''}`
      ).join('<br>');
      const orgSection = this.createCollapsibleSection('Organizations', orgContent, true);
      profileBody.appendChild(orgSection);
    }

    // Languages Section
    if (profile.languages?.length > 0) {
      const langSection = this.createCollapsibleSection('Languages', profile.languages.join(', '));
      profileBody.appendChild(langSection);
    }

    profileCard.appendChild(profileHeader);
    profileCard.appendChild(profileBody);
    resultEl.appendChild(profileCard);

    // AI Analysis Card
    const analysisCard = document.createElement('div');
    analysisCard.className = 'card';

    const analysisHeader = document.createElement('div');
    analysisHeader.className = 'card-header';
    const analysisTitle = document.createElement('strong');
    analysisTitle.textContent = 'AI Analysis';
    analysisHeader.appendChild(analysisTitle);

    const analysisBody = document.createElement('div');
    analysisBody.className = 'card-body';

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
    analysisBody.appendChild(qualSection);

    // Experience Highlights
    const expSection = document.createElement('div');
    expSection.className = 'summary-section';
    const expH3 = document.createElement('h3');
    expH3.textContent = 'Experience Highlights';
    expSection.appendChild(expH3);
    const expP = document.createElement('p');
    expP.textContent = highlights;
    expSection.appendChild(expP);
    analysisBody.appendChild(expSection);

    // Potential Concerns
    const conSection = document.createElement('div');
    conSection.className = 'summary-section';
    const conH3 = document.createElement('h3');
    conH3.textContent = 'Potential Concerns';
    conSection.appendChild(conH3);
    const conP = document.createElement('p');
    conP.textContent = concerns;
    conSection.appendChild(conP);
    analysisBody.appendChild(conSection);

    // Best Fit For
    const fitSection = document.createElement('div');
    fitSection.className = 'summary-section';
    const fitH3 = document.createElement('h3');
    fitH3.textContent = 'Best Fit For';
    fitSection.appendChild(fitH3);
    const fitP = document.createElement('p');
    fitP.textContent = bestFit;
    fitSection.appendChild(fitP);
    analysisBody.appendChild(fitSection);

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

    analysisCard.appendChild(analysisHeader);
    analysisCard.appendChild(analysisBody);
    analysisCard.appendChild(footer);
    resultEl.appendChild(analysisCard);

    resultEl.classList.remove('hidden');
  },

  /**
   * Build the deterministic signal row: tenure band and open-to-work status.
   * Computed locally, never sent to the model.
   */
  renderSignals(profile) {
    const row = document.createElement('div');
    row.className = 'signal-row';

    const tenure = Signals.parseTenure(profile.currentRole && profile.currentRole.duration);
    const band = Signals.tenureBand(tenure && tenure.months);
    const otw = Signals.detectOpenToWork(profile);

    const LABELS = {
      new: 'Just started',
      settling: 'Settling in',
      prime: 'Prime to move',
      entrenched: 'Long tenure',
      unknown: 'Tenure unknown'
    };

    const tenureChip = document.createElement('span');
    tenureChip.className = `chip chip-tenure chip-${band}`;
    tenureChip.textContent = tenure
      ? `${LABELS[band]} (${tenure.months} mo)`
      : LABELS.unknown;
    row.appendChild(tenureChip);

    if (otw.open) {
      const otwChip = document.createElement('span');
      otwChip.className = 'chip chip-open';
      otwChip.textContent = otw.source === 'recruiter-spotlight'
        ? 'Open to work (recruiter signal)'
        : 'Open to work (public badge)';
      row.appendChild(otwChip);
    }

    return row;
  },

  /**
   * Scorecard picker plus results. Only scorecards the recruiter has saved
   * are offered; a derived-but-unreviewed rubric cannot score anyone.
   */
  async renderScoring(profile) {
    const wrap = document.createElement('div');
    wrap.className = 'scoring-block';

    const all = await Storage.getScorecards();
    const usable = all.filter(sc => Scorecard.isUsable(sc));

    if (usable.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'No saved scorecards yet. Build one in the Scorecards tab to score this profile.';
      wrap.appendChild(hint);
      return wrap;
    }

    const select = document.createElement('select');
    select.className = 'form-input';
    usable.forEach(sc => {
      const opt = document.createElement('option');
      opt.value = sc.id;
      opt.textContent = sc.roleName;
      select.appendChild(opt);
    });
    wrap.appendChild(select);

    const results = document.createElement('div');

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Score against this role';
    btn.addEventListener('click', async () => {
      const scorecard = usable.find(sc => sc.id === select.value);
      btn.disabled = true;
      results.textContent = '';
      try {
        const apiKey = await Storage.getApiKey();
        const candidate = {
          id: profile.profileUrl || 'current',
          name: profile.name,
          headline: profile.headline,
          about: profile.about,
          experience: profile.experience,
          skills: profile.skills
        };
        const raw = await callClaude(
          CandidateScorer.buildPrompt([candidate], scorecard), apiKey, 4096
        );
        const [score] = CandidateScorer.parseResponse(raw, scorecard, [candidate]);
        if (!score) {
          showToast('No score came back for this candidate. Try again.', 'error');
          return;
        }
        results.appendChild(this.renderScore(score, scorecard));
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(results);
    return wrap;
  },

  renderScore(score, scorecard) {
    const box = document.createElement('div');
    box.className = 'card score-card';

    const header = document.createElement('div');
    header.className = 'score-header';
    const pct = document.createElement('strong');
    pct.textContent = score.total === null ? 'Not enough detail to score' : `${score.total}%`;
    header.appendChild(pct);

    const RECOMMENDATION_LABELS = {
      strong: 'Strong',
      possible: 'Possible',
      weak: 'Weak',
      'insufficient-data': 'Not enough detail'
    };

    const rec = document.createElement('span');
    rec.className = `chip chip-${score.recommendation}`;
    rec.textContent = RECOMMENDATION_LABELS[score.recommendation] || score.recommendation;
    header.appendChild(rec);

    if (score.unknownCount > 0) {
      const unk = document.createElement('span');
      unk.className = 'chip chip-unknown';
      unk.textContent = `${score.unknownCount} not stated on profile`;
      header.appendChild(unk);
    }
    box.appendChild(header);

    if (score.dealbreakerHit) {
      const db = document.createElement('p');
      db.className = 'dealbreaker';
      const crit = scorecard.dealbreakers.find(c => c.id === score.dealbreakerHit);
      db.textContent = `Dealbreaker: ${crit ? crit.text : score.dealbreakerHit}`;
      box.appendChild(db);
    }

    const byId = new Map(
      [...scorecard.mustHaves, ...scorecard.niceToHaves, ...scorecard.dealbreakers]
        .map(c => [c.id, c])
    );

    score.lines.forEach(line => {
      const row = document.createElement('div');
      row.className = `score-line score-${line.verdict}`;

      const label = document.createElement('div');
      const crit = byId.get(line.criterionId);
      label.textContent = `${line.verdict.toUpperCase()} — ${crit ? crit.text : line.criterionId}`;
      row.appendChild(label);

      if (line.evidence) {
        const quote = document.createElement('blockquote');
        quote.className = 'evidence';
        quote.textContent = line.evidence;
        row.appendChild(quote);
      }

      box.appendChild(row);
    });

    return box;
  },

  createCollapsibleSection(title, content, isHtml = false) {
    const section = document.createElement('div');
    section.className = 'summary-section collapsible-section';
    section.style.cssText = 'border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; cursor: pointer;';
    header.addEventListener('click', () => {
      const contentEl = section.querySelector('.section-content');
      const arrow = section.querySelector('.arrow');
      if (contentEl.style.display === 'none') {
        contentEl.style.display = 'block';
        arrow.textContent = '\u25BC';
      } else {
        contentEl.style.display = 'none';
        arrow.textContent = '\u25B6';
      }
    });

    const h3 = document.createElement('h3');
    h3.style.margin = '0';
    h3.textContent = title;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.style.cssText = 'font-size: 10px; color: var(--text-muted);';
    arrow.textContent = '\u25BC';

    header.appendChild(h3);
    header.appendChild(arrow);
    section.appendChild(header);

    const contentEl = document.createElement('div');
    contentEl.className = 'section-content';
    contentEl.style.cssText = 'margin-top: 8px; font-size: 13px; line-height: 1.6;';
    if (isHtml) {
      contentEl.innerHTML = content;
    } else {
      contentEl.textContent = content;
    }
    section.appendChild(contentEl);

    return section;
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
