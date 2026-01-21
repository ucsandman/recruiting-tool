/**
 * Boolean Search Builder Feature
 * Visual query builder with real-time preview
 */

const BooleanBuilder = {
  container: null,
  initialized: false,
  debouncedUpdate: null,

  init() {
    this.container = document.getElementById('search-container');
    if (!this.container) return;

    if (!this.initialized) {
      this.render();
      this.debouncedUpdate = debounce(() => this.updatePreview(), 150);
      this.initialized = true;
    }
  },

  render() {
    this.container.textContent = '';

    // Form card
    const card = document.createElement('div');
    card.className = 'card';
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';

    const fields = [
      { id: 'job-title', label: 'Job Titles', hint: '(comma-separated, OR logic)', placeholder: 'e.g., Software Engineer, Developer, Programmer' },
      { id: 'company', label: 'Companies', hint: '(comma-separated, OR logic)', placeholder: 'e.g., Google, Meta, Amazon' },
      { id: 'must-have-skills', label: 'Must Have Skills', hint: '(comma-separated, AND logic)', placeholder: 'e.g., Python, JavaScript' },
      { id: 'nice-to-have-skills', label: 'Nice to Have Skills', hint: '(comma-separated, OR logic)', placeholder: 'e.g., React, Vue, Angular' },
      { id: 'location', label: 'Locations', hint: '(comma-separated, OR logic)', placeholder: 'e.g., San Francisco, New York, Remote' },
      { id: 'exclude', label: 'Exclude Terms', hint: '(comma-separated, NOT logic)', placeholder: 'e.g., Manager, Director, Intern' }
    ];

    fields.forEach(field => {
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.setAttribute('for', field.id);
      label.textContent = field.label + ' ';

      const hint = document.createElement('span');
      hint.className = 'text-muted text-sm';
      hint.textContent = field.hint;
      label.appendChild(hint);

      const input = document.createElement('input');
      input.type = 'text';
      input.id = field.id;
      input.placeholder = field.placeholder;

      group.appendChild(label);
      group.appendChild(input);
      cardBody.appendChild(group);
    });

    card.appendChild(cardBody);
    this.container.appendChild(card);

    // Preview card
    const previewCard = document.createElement('div');
    previewCard.className = 'card mt-4';

    const previewHeader = document.createElement('div');
    previewHeader.className = 'card-header';
    const previewTitle = document.createElement('strong');
    previewTitle.textContent = 'Generated Boolean Query';
    previewHeader.appendChild(previewTitle);

    const previewBody = document.createElement('div');
    previewBody.className = 'card-body';

    const previewDiv = document.createElement('div');
    previewDiv.id = 'query-preview';
    previewDiv.className = 'query-preview';
    const previewPlaceholder = document.createElement('span');
    previewPlaceholder.className = 'text-muted';
    previewPlaceholder.textContent = 'Enter search criteria above to generate a boolean query...';
    previewDiv.appendChild(previewPlaceholder);
    previewBody.appendChild(previewDiv);

    const previewFooter = document.createElement('div');
    previewFooter.className = 'card-footer';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'copy-query-btn';
    copyBtn.className = 'btn btn-primary btn-sm';
    copyBtn.disabled = true;
    copyBtn.textContent = 'Copy to Clipboard';
    previewFooter.appendChild(copyBtn);

    previewCard.appendChild(previewHeader);
    previewCard.appendChild(previewBody);
    previewCard.appendChild(previewFooter);
    this.container.appendChild(previewCard);

    // Help card
    const helpCard = document.createElement('div');
    helpCard.className = 'card mt-4';
    const helpBody = document.createElement('div');
    helpBody.className = 'card-body';

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.style.cssText = 'cursor: pointer; font-weight: 500; color: var(--primary);';
    summary.textContent = 'Boolean Search Syntax Help';

    const helpContent = document.createElement('div');
    helpContent.className = 'mt-2 text-sm';

    const helpItems = [
      { term: 'AND', desc: '- Both terms must appear' },
      { term: 'OR', desc: '- Either term can appear' },
      { term: 'NOT', desc: '- Excludes results with this term' },
      { term: '"quotes"', desc: '- Exact phrase match' },
      { term: '(parentheses)', desc: '- Groups terms together' }
    ];

    helpItems.forEach(item => {
      const p = document.createElement('p');
      p.className = 'mb-2';
      const strong = document.createElement('strong');
      strong.textContent = item.term;
      p.appendChild(strong);
      p.appendChild(document.createTextNode(' ' + item.desc));
      helpContent.appendChild(p);
    });

    const tip = document.createElement('p');
    tip.className = 'mt-4 text-muted';
    tip.textContent = 'Tip: Copy the generated query and paste it into LinkedIn Recruiter, Google, or any job board that supports boolean search.';
    helpContent.appendChild(tip);

    details.appendChild(summary);
    details.appendChild(helpContent);
    helpBody.appendChild(details);
    helpCard.appendChild(helpBody);
    this.container.appendChild(helpCard);

    this.bindEvents();
  },

  bindEvents() {
    const inputs = ['job-title', 'company', 'must-have-skills', 'nice-to-have-skills', 'location', 'exclude'];
    inputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.debouncedUpdate());
      }
    });

    const copyBtn = document.getElementById('copy-query-btn');
    copyBtn?.addEventListener('click', () => this.copyQuery());
  },

  getInputValues() {
    return {
      jobTitle: document.getElementById('job-title')?.value?.trim() || '',
      company: document.getElementById('company')?.value?.trim() || '',
      mustHaveSkills: document.getElementById('must-have-skills')?.value?.trim() || '',
      niceToHaveSkills: document.getElementById('nice-to-have-skills')?.value?.trim() || '',
      location: document.getElementById('location')?.value?.trim() || '',
      exclude: document.getElementById('exclude')?.value?.trim() || ''
    };
  },

  buildBooleanQuery(inputs) {
    const parts = [];

    if (inputs.jobTitle) {
      const titles = inputs.jobTitle.split(',').map(t => t.trim()).filter(t => t).map(t => '"' + t + '"');
      if (titles.length > 0) {
        parts.push(titles.length > 1 ? '(' + titles.join(' OR ') + ')' : titles[0]);
      }
    }

    if (inputs.company) {
      const companies = inputs.company.split(',').map(c => c.trim()).filter(c => c).map(c => '"' + c + '"');
      if (companies.length > 0) {
        parts.push(companies.length > 1 ? '(' + companies.join(' OR ') + ')' : companies[0]);
      }
    }

    if (inputs.mustHaveSkills) {
      const skills = inputs.mustHaveSkills.split(',').map(s => s.trim()).filter(s => s).map(s => '"' + s + '"');
      if (skills.length > 0) {
        parts.push(skills.length > 1 ? '(' + skills.join(' AND ') + ')' : skills[0]);
      }
    }

    if (inputs.niceToHaveSkills) {
      const skills = inputs.niceToHaveSkills.split(',').map(s => s.trim()).filter(s => s).map(s => '"' + s + '"');
      if (skills.length > 0) {
        parts.push(skills.length > 1 ? '(' + skills.join(' OR ') + ')' : skills[0]);
      }
    }

    if (inputs.location) {
      const locations = inputs.location.split(',').map(l => l.trim()).filter(l => l).map(l => '"' + l + '"');
      if (locations.length > 0) {
        parts.push(locations.length > 1 ? '(' + locations.join(' OR ') + ')' : locations[0]);
      }
    }

    let query = parts.join(' AND ');

    if (inputs.exclude) {
      const excludes = inputs.exclude.split(',').map(e => e.trim()).filter(e => e).map(e => 'NOT "' + e + '"');
      if (excludes.length > 0) {
        query = query ? query + ' ' + excludes.join(' ') : excludes.join(' ');
      }
    }

    return query;
  },

  updatePreview() {
    const inputs = this.getInputValues();
    const query = this.buildBooleanQuery(inputs);
    const previewEl = document.getElementById('query-preview');
    const copyBtn = document.getElementById('copy-query-btn');

    previewEl.textContent = '';

    if (query) {
      // Highlight operators by creating spans
      const parts = query.split(/(\bAND\b|\bOR\b|\bNOT\b)/g);
      parts.forEach(part => {
        if (part === 'AND' || part === 'OR' || part === 'NOT') {
          const span = document.createElement('span');
          span.className = 'operator';
          span.textContent = part;
          previewEl.appendChild(span);
        } else {
          previewEl.appendChild(document.createTextNode(part));
        }
      });
      copyBtn.disabled = false;
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'text-muted';
      placeholder.textContent = 'Enter search criteria above to generate a boolean query...';
      previewEl.appendChild(placeholder);
      copyBtn.disabled = true;
    }
  },

  async copyQuery() {
    const inputs = this.getInputValues();
    const query = this.buildBooleanQuery(inputs);

    if (!query) {
      showToast('No query to copy', 'error');
      return;
    }

    try {
      await copyToClipboard(query);
      showToast('Query copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy query', 'error');
    }
  }
};
