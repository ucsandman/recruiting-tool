/**
 * Interview Question Generator Feature
 * AI-powered interview question generation
 */

const QuestionGenerator = {
  container: null,
  currentQuestions: [],
  initialized: false,

  init() {
    this.container = document.getElementById('questions-container');
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

    // Job Title field
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';
    const titleLabel = document.createElement('label');
    titleLabel.setAttribute('for', 'q-job-title');
    titleLabel.textContent = 'Job Title ';
    const titleRequired = document.createElement('span');
    titleRequired.style.color = 'var(--danger)';
    titleRequired.textContent = '*';
    titleLabel.appendChild(titleRequired);
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'q-job-title';
    titleInput.placeholder = 'e.g., Senior Software Engineer';
    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(titleInput);
    cardBody.appendChild(titleGroup);

    // Requirements field
    const reqGroup = document.createElement('div');
    reqGroup.className = 'form-group';
    const reqLabel = document.createElement('label');
    reqLabel.setAttribute('for', 'q-requirements');
    reqLabel.textContent = 'Key Requirements';
    const reqTextarea = document.createElement('textarea');
    reqTextarea.id = 'q-requirements';
    reqTextarea.placeholder = 'Describe the key skills, experience, and qualities needed for this role...';
    reqGroup.appendChild(reqLabel);
    reqGroup.appendChild(reqTextarea);
    cardBody.appendChild(reqGroup);

    // Question Type field
    const typeGroup = document.createElement('div');
    typeGroup.className = 'form-group';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Question Type';
    typeGroup.appendChild(typeLabel);

    const pillsDiv = document.createElement('div');
    pillsDiv.className = 'radio-pills';

    const types = [
      { id: 'q-type-mixed', value: 'mixed', label: 'Mixed', checked: true },
      { id: 'q-type-behavioral', value: 'behavioral', label: 'Behavioral', checked: false },
      { id: 'q-type-technical', value: 'technical', label: 'Technical', checked: false }
    ];

    types.forEach(type => {
      const pill = document.createElement('div');
      pill.className = 'radio-pill';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q-type';
      input.id = type.id;
      input.value = type.value;
      if (type.checked) input.checked = true;

      const label = document.createElement('label');
      label.setAttribute('for', type.id);
      label.textContent = type.label;

      pill.appendChild(input);
      pill.appendChild(label);
      pillsDiv.appendChild(pill);
    });

    typeGroup.appendChild(pillsDiv);
    cardBody.appendChild(typeGroup);

    // Count slider
    const countGroup = document.createElement('div');
    countGroup.className = 'form-group';
    const countLabel = document.createElement('label');
    countLabel.setAttribute('for', 'q-count');
    countLabel.textContent = 'Number of Questions: ';
    const countDisplay = document.createElement('span');
    countDisplay.id = 'q-count-display';
    countDisplay.textContent = '10';
    countLabel.appendChild(countDisplay);
    const countSlider = document.createElement('input');
    countSlider.type = 'range';
    countSlider.id = 'q-count';
    countSlider.min = '1';
    countSlider.max = '15';
    countSlider.value = '10';
    countGroup.appendChild(countLabel);
    countGroup.appendChild(countSlider);
    cardBody.appendChild(countGroup);

    // Generate button
    const generateBtn = document.createElement('button');
    generateBtn.id = 'generate-btn';
    generateBtn.className = 'btn btn-primary btn-block';
    generateBtn.textContent = 'Generate Questions';
    cardBody.appendChild(generateBtn);

    card.appendChild(cardBody);
    this.container.appendChild(card);

    // Results area
    const resultDiv = document.createElement('div');
    resultDiv.id = 'questions-result';
    resultDiv.className = 'mt-4 hidden';
    this.container.appendChild(resultDiv);

    this.bindEvents();
  },

  bindEvents() {
    const countSlider = document.getElementById('q-count');
    const countDisplay = document.getElementById('q-count-display');

    countSlider?.addEventListener('input', () => {
      countDisplay.textContent = countSlider.value;
    });

    const generateBtn = document.getElementById('generate-btn');
    generateBtn?.addEventListener('click', () => this.generateQuestions());
  },

  getFormValues() {
    return {
      jobTitle: document.getElementById('q-job-title')?.value?.trim() || '',
      requirements: document.getElementById('q-requirements')?.value?.trim() || '',
      type: document.querySelector('input[name="q-type"]:checked')?.value || 'mixed',
      count: parseInt(document.getElementById('q-count')?.value || '10', 10)
    };
  },

  async generateQuestions() {
    const values = this.getFormValues();

    if (!values.jobTitle) {
      showToast('Please enter a job title', 'error');
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      showToast('Please add your Claude API key in settings', 'error');
      return;
    }

    showLoading('Generating interview questions...');

    try {
      const prompt = this.buildPrompt(values);
      const response = await callClaude(prompt, apiKey, 2048);

      this.currentQuestions = parseQuestions(response);
      this.displayQuestions();

    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      hideLoading();
    }
  },

  buildPrompt(values) {
    const typeDesc = values.type === 'behavioral' ? 'behavioral/situational questions using the STAR method' :
                     values.type === 'technical' ? 'technical skills and problem-solving abilities' :
                     'a mix of behavioral and technical questions';

    // For small counts, don't use categories
    if (values.count <= 3) {
      return `You are an expert interviewer. Generate EXACTLY ${values.count} interview question${values.count === 1 ? '' : 's'} for this role.

ROLE: ${values.jobTitle}
KEY REQUIREMENTS: ${values.requirements || 'Not specified - use general best practices for this role'}
QUESTION TYPE: ${values.type}

Generate EXACTLY ${values.count} question${values.count === 1 ? '' : 's'}. No more, no less.

For each question, use this exact format:
Q: [The question]
Assesses: [What this question is designed to evaluate]

Make questions specific to the role and requirements provided. Avoid generic questions.
Focus on ${typeDesc}.`;
    }

    // For larger counts, use categories
    const screening = Math.round(values.count * 0.3);
    const deepDive = Math.round(values.count * 0.5);
    const redFlag = values.count - screening - deepDive;

    return `You are an expert interviewer. Generate EXACTLY ${values.count} interview questions for this role.

ROLE: ${values.jobTitle}
KEY REQUIREMENTS: ${values.requirements || 'Not specified - use general best practices for this role'}
QUESTION TYPE: ${values.type}

Generate EXACTLY ${values.count} questions total, distributed as follows:

## Screening Questions
Generate exactly ${screening} quick questions to assess basic fit.

## Deep Dive Questions
Generate exactly ${deepDive} detailed questions to assess capabilities.

## Red Flag Questions
Generate exactly ${redFlag} questions designed to uncover potential concerns.

For each question, use this exact format:
Q: [The question]
Assesses: [What this question is designed to evaluate]

Make questions specific to the role and requirements provided. Avoid generic questions.
Focus on ${typeDesc}.`;
  },

  displayQuestions() {
    const resultEl = document.getElementById('questions-result');
    if (!resultEl || this.currentQuestions.length === 0) {
      showToast('No questions were generated', 'error');
      return;
    }

    resultEl.textContent = '';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const title = document.createElement('strong');
    title.textContent = 'Generated Questions (' + this.currentQuestions.length + ')';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'copy-questions-btn';
    copyBtn.className = 'btn btn-secondary btn-sm';
    copyBtn.textContent = 'Copy All';
    copyBtn.addEventListener('click', () => this.copyAllQuestions());

    header.appendChild(title);
    header.appendChild(copyBtn);

    const body = document.createElement('div');
    body.className = 'card-body';
    body.style.cssText = 'max-height: 400px; overflow-y: auto;';

    this.currentQuestions.forEach(q => {
      const qCard = document.createElement('div');
      qCard.className = 'question-card';

      const badge = document.createElement('span');
      const category = q.category.toLowerCase();
      const badgeClass = category.includes('screening') ? 'screening' :
                         category.includes('deep') ? 'deep-dive' :
                         category.includes('red') ? 'red-flag' : 'screening';
      badge.className = 'category-badge ' + badgeClass;
      badge.textContent = q.category;

      const questionText = document.createElement('div');
      questionText.className = 'question-text';
      questionText.textContent = q.question;

      qCard.appendChild(badge);
      qCard.appendChild(questionText);

      if (q.assesses) {
        const assesses = document.createElement('div');
        assesses.className = 'question-assesses';
        assesses.textContent = 'Assesses: ' + q.assesses;
        qCard.appendChild(assesses);
      }

      body.appendChild(qCard);
    });

    card.appendChild(header);
    card.appendChild(body);
    resultEl.appendChild(card);

    resultEl.classList.remove('hidden');
  },

  async copyAllQuestions() {
    if (this.currentQuestions.length === 0) {
      showToast('No questions to copy', 'error');
      return;
    }

    const text = this.currentQuestions.map((q, i) => {
      let line = (i + 1) + '. ' + q.question;
      if (q.assesses) {
        line += '\n   Assesses: ' + q.assesses;
      }
      return line;
    }).join('\n\n');

    try {
      await copyToClipboard(text);
      showToast('Questions copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy questions', 'error');
    }
  }
};
