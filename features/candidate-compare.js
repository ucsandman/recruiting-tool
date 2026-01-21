/**
 * Candidate Comparison Feature
 * Side-by-side comparison of saved candidates
 */

const CandidateCompare = {
  container: null,
  candidates: [],
  selectedIds: new Set(),
  initialized: false,

  init() {
    this.container = document.getElementById('compare-container');
    if (!this.container) return;
    this.loadCandidates();
  },

  async loadCandidates() {
    this.candidates = await Storage.getSavedCandidates();

    // Restore comparison state if in pop-out mode
    if (isPoppedOut) {
      const savedState = await Storage.get('poppedOutCompareState');
      if (savedState && savedState.selectedIds) {
        this.selectedIds = new Set(savedState.selectedIds);
      }
    }

    this.render();

    // Show comparison if it was showing before pop-out
    if (isPoppedOut) {
      const savedState = await Storage.get('poppedOutCompareState');
      if (savedState && savedState.showComparison && this.selectedIds.size >= 2) {
        this.showComparison();
      }
    }
  },

  render() {
    if (this.candidates.length === 0) {
      this.renderEmptyState();
      return;
    }

    this.container.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const title = document.createElement('strong');
    title.textContent = 'Saved Candidates (' + this.candidates.length + ')';

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-all-btn';
    clearBtn.className = 'btn btn-ghost btn-sm';
    clearBtn.style.color = 'var(--danger)';
    clearBtn.textContent = 'Clear All';

    header.appendChild(title);
    header.appendChild(clearBtn);

    const body = document.createElement('div');
    body.className = 'card-body';
    if (!isPoppedOut) {
      body.style.cssText = 'max-height: 250px; overflow-y: auto;';
    }

    const listDiv = document.createElement('div');
    listDiv.id = 'candidate-list';
    body.appendChild(listDiv);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const countSpan = document.createElement('span');
    countSpan.className = 'text-sm text-muted';
    countSpan.id = 'selection-count';
    countSpan.textContent = 'Select 2-3 candidates to compare';

    const compareBtn = document.createElement('button');
    compareBtn.id = 'compare-btn';
    compareBtn.className = 'btn btn-primary btn-sm';
    compareBtn.disabled = true;
    compareBtn.textContent = 'Compare Selected';

    footer.appendChild(countSpan);
    footer.appendChild(compareBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    this.container.appendChild(card);

    const resultDiv = document.createElement('div');
    resultDiv.id = 'comparison-result';
    resultDiv.className = 'mt-4 hidden';
    this.container.appendChild(resultDiv);

    this.renderCandidateList();
    this.bindEvents();
  },

  renderEmptyState() {
    this.container.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const body = document.createElement('div');
    body.className = 'card-body';

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const h3 = document.createElement('h3');
    h3.textContent = 'No Saved Candidates';

    const p = document.createElement('p');
    p.textContent = 'Save candidates from the Summarize tab to compare them here';

    emptyState.appendChild(h3);
    emptyState.appendChild(p);
    body.appendChild(emptyState);
    card.appendChild(body);
    this.container.appendChild(card);
  },

  renderCandidateList() {
    const listEl = document.getElementById('candidate-list');
    if (!listEl) return;

    listEl.textContent = '';

    this.candidates.forEach(candidate => {
      const isSelected = this.selectedIds.has(candidate.id);
      const name = candidate.profileData?.name || 'Unknown';
      const headline = candidate.profileData?.headline || '';
      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const savedDate = formatDate(candidate.savedAt);

      const cardDiv = document.createElement('div');
      cardDiv.className = 'candidate-card' + (isSelected ? ' selected' : '');
      cardDiv.setAttribute('data-id', candidate.id);

      const checkWrapper = document.createElement('div');
      checkWrapper.className = 'checkbox-wrapper';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'check-' + candidate.id;
      checkbox.checked = isSelected;
      checkbox.addEventListener('change', () => this.toggleCandidate(candidate.id));
      checkWrapper.appendChild(checkbox);

      const avatar = document.createElement('div');
      avatar.className = 'candidate-avatar';
      avatar.textContent = initials;

      const info = document.createElement('div');
      info.className = 'candidate-info';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'candidate-name';
      nameDiv.textContent = name;

      const headlineDiv = document.createElement('div');
      headlineDiv.className = 'candidate-headline';
      headlineDiv.textContent = truncate(headline, 50);

      const dateDiv = document.createElement('div');
      dateDiv.className = 'candidate-date';
      dateDiv.textContent = 'Saved ' + savedDate;

      info.appendChild(nameDiv);
      info.appendChild(headlineDiv);
      info.appendChild(dateDiv);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn remove-candidate-btn';
      removeBtn.setAttribute('data-id', candidate.id);
      removeBtn.title = 'Remove';
      removeBtn.textContent = 'X';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeCandidate(candidate.id);
      });

      cardDiv.appendChild(checkWrapper);
      cardDiv.appendChild(avatar);
      cardDiv.appendChild(info);
      cardDiv.appendChild(removeBtn);
      listEl.appendChild(cardDiv);
    });

    this.updateSelectionUI();
  },

  bindEvents() {
    const compareBtn = document.getElementById('compare-btn');
    compareBtn?.addEventListener('click', () => this.showComparison());

    const clearAllBtn = document.getElementById('clear-all-btn');
    clearAllBtn?.addEventListener('click', () => this.clearAllCandidates());
  },

  toggleCandidate(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      if (this.selectedIds.size >= 3) {
        showToast('Maximum 3 candidates can be compared', 'info');
        const checkbox = document.getElementById('check-' + id);
        if (checkbox) checkbox.checked = false;
        return;
      }
      this.selectedIds.add(id);
    }

    const card = this.container.querySelector('.candidate-card[data-id="' + id + '"]');
    if (card) {
      card.classList.toggle('selected', this.selectedIds.has(id));
    }

    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const countEl = document.getElementById('selection-count');
    const compareBtn = document.getElementById('compare-btn');
    const count = this.selectedIds.size;

    if (countEl) {
      if (count === 0) {
        countEl.textContent = 'Select 2-3 candidates to compare';
      } else if (count === 1) {
        countEl.textContent = '1 selected - need at least 2';
      } else {
        countEl.textContent = count + ' selected';
      }
    }

    if (compareBtn) {
      compareBtn.disabled = count < 2;
    }
  },

  async removeCandidate(id) {
    try {
      await Storage.removeCandidate(id);
      this.selectedIds.delete(id);
      this.candidates = this.candidates.filter(c => c.id !== id);

      if (this.candidates.length === 0) {
        this.renderEmptyState();
      } else {
        this.renderCandidateList();
      }

      showToast('Candidate removed', 'success');
    } catch (error) {
      showToast('Failed to remove candidate', 'error');
    }
  },

  async clearAllCandidates() {
    if (!confirm('Are you sure you want to remove all saved candidates?')) {
      return;
    }

    try {
      await Storage.clearAllCandidates();
      this.candidates = [];
      this.selectedIds.clear();
      this.renderEmptyState();
      showToast('All candidates cleared', 'success');
    } catch (error) {
      showToast('Failed to clear candidates', 'error');
    }
  },

  showComparison() {
    const resultEl = document.getElementById('comparison-result');
    if (!resultEl) return;

    const selected = this.candidates.filter(c => this.selectedIds.has(c.id));

    if (selected.length < 2) {
      showToast('Please select at least 2 candidates', 'error');
      return;
    }

    resultEl.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('strong');
    title.textContent = 'Comparison';
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'card-body';
    body.style.overflowX = 'auto';
    if (!isPoppedOut) {
      body.style.maxHeight = '350px';
      body.style.overflowY = 'auto';
    }
    body.appendChild(this.buildComparisonTable(selected));

    card.appendChild(header);
    card.appendChild(body);
    resultEl.appendChild(card);

    resultEl.classList.remove('hidden');
    resultEl.scrollIntoView({ behavior: 'smooth' });
  },

  buildComparisonTable(candidates) {
    const rows = [
      { label: 'Name', getter: c => c.profileData?.name || 'Unknown' },
      { label: 'Headline', getter: c => truncate(c.profileData?.headline || '-', 80) },
      { label: 'Current Role', getter: c => c.profileData?.currentRole?.title || '-' },
      { label: 'Company', getter: c => c.profileData?.currentRole?.company || '-' },
      { label: 'Location', getter: c => c.profileData?.location || '-' },
      { label: 'About', getter: c => truncate(c.profileData?.about || '-', 150) },
      { label: 'Experience', getter: c => {
        const exp = c.profileData?.experience?.slice(0, 3) || [];
        return exp.length > 0 ? exp.map(e => `${e.title} at ${e.company || 'Unknown'}`).join('; ') : '-';
      }},
      { label: 'Education', getter: c => {
        const edu = c.profileData?.education || [];
        return edu.length > 0 ? edu.map(e => `${e.school}${e.degree ? ' (' + e.degree + ')' : ''}`).join('; ') : '-';
      }},
      { label: 'Skills', getter: c => {
        const skills = c.profileData?.skills?.slice(0, 8) || [];
        return skills.length > 0 ? skills.join(', ') : '-';
      }},
      { label: 'Certifications', getter: c => {
        const certs = c.profileData?.certifications?.slice(0, 3) || [];
        return certs.length > 0 ? certs.join(', ') : '-';
      }},
      { label: 'Languages', getter: c => {
        const langs = c.profileData?.languages || [];
        return langs.length > 0 ? langs.join(', ') : '-';
      }},
      { label: 'Volunteering', getter: c => {
        const vol = c.profileData?.volunteering?.slice(0, 2) || [];
        return vol.length > 0 ? vol.map(v => `${v.role} at ${v.organization || 'Unknown'}`).join('; ') : '-';
      }},
      { label: 'Honors & Awards', getter: c => {
        const honors = c.profileData?.honors?.slice(0, 2) || [];
        return honors.length > 0 ? honors.map(h => h.title).join(', ') : '-';
      }},
      { label: 'Organizations', getter: c => {
        const orgs = c.profileData?.organizations?.slice(0, 2) || [];
        return orgs.length > 0 ? orgs.map(o => o.name).join(', ') : '-';
      }},
      { label: 'Key Qualifications', getter: c => {
        const quals = parseBulletPoints(c.summary?.['Key Qualifications'] || '');
        return quals.length > 0 ? quals.slice(0, 3).join('; ') : '-';
      }},
      { label: 'Experience Highlights', getter: c => truncate(c.summary?.['Experience Highlights'] || '-', 150) },
      { label: 'Concerns', getter: c => truncate(c.summary?.['Potential Concerns'] || '-', 100) },
      { label: 'Best Fit For', getter: c => truncate(c.summary?.['Best Fit For'] || '-', 100) }
    ];

    const table = document.createElement('table');
    table.className = 'comparison-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const attrTh = document.createElement('th');
    attrTh.textContent = 'Attribute';
    headerRow.appendChild(attrTh);

    candidates.forEach(c => {
      const th = document.createElement('th');
      const name = c.profileData?.name || 'Unknown';
      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; align-items: center; gap: 8px;';

      const avatar = document.createElement('div');
      avatar.className = 'candidate-avatar';
      avatar.style.cssText = 'width: 28px; height: 28px; font-size: 12px;';
      avatar.textContent = initials;

      wrapper.appendChild(avatar);
      wrapper.appendChild(document.createTextNode(truncate(name, 15)));
      th.appendChild(wrapper);
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');

      const labelTh = document.createElement('th');
      labelTh.textContent = row.label;
      tr.appendChild(labelTh);

      candidates.forEach(c => {
        const td = document.createElement('td');
        td.textContent = row.getter(c);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }
};
