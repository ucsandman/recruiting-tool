/**
 * Scorecard
 * A per-role rubric. Seeded from a pasted job description, then edited by the
 * recruiter before it is allowed to score anyone.
 */

const BUCKETS = ['mustHaves', 'niceToHaves', 'dealbreakers'];

let idCounter = 0;
function newId(prefix) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// Weights only ever mean 1 (nice-to-have-ish), 2, or 3 (fails without it).
// Anything else — non-numeric, missing, zero, negative, fractional, or
// above 3 — gets clamped here, at the two places a weight enters the
// system, so an invalid value never reaches the scorer.
function clampWeight(weight) {
  const n = Number(weight);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
}

const Scorecard = {
  create({ roleName }) {
    return {
      id: newId('sc'),
      roleName: roleName || 'Untitled role',
      createdAt: new Date().toISOString(),
      editedAt: null,
      mustHaves: [],
      niceToHaves: [],
      dealbreakers: []
    };
  },

  addCriterion(scorecard, bucket, text, weight = 1) {
    if (!BUCKETS.includes(bucket)) {
      throw new Error(`Unknown bucket: ${bucket}`);
    }
    const criterion = { id: newId('cr'), text, weight: clampWeight(weight) };
    return { ...scorecard, [bucket]: [...scorecard[bucket], criterion] };
  },

  /**
   * A scorecard may only score candidates after the recruiter has opened and
   * saved it, and only if it actually states what the role requires.
   */
  isUsable(scorecard) {
    if (!scorecard || typeof scorecard !== 'object') return false;
    if (!scorecard.editedAt) return false;
    return Array.isArray(scorecard.mustHaves) && scorecard.mustHaves.length > 0;
  },

  buildDerivePrompt(jobDescription) {
    return [
      'You are helping a recruiter turn a job description into a screening rubric.',
      '',
      'Extract only requirements that can actually be judged from a LinkedIn profile.',
      'Skip benefits, company boilerplate, equal-opportunity statements, and anything',
      'about the hiring process. Prefer few sharp criteria over many vague ones.',
      '',
      'Weights are 1 to 3, where 3 means the role fails without it.',
      '',
      'Respond with JSON only, no prose and no code fence, in exactly this shape:',
      '{"mustHaves":[{"text":"...","weight":3}],',
      ' "niceToHaves":[{"text":"...","weight":1}],',
      ' "dealbreakers":[{"text":"..."}]}',
      '',
      'Job description:',
      jobDescription
    ].join('\n');
  },

  parseDerivedRubric(responseText) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
      throw new Error('Could not read the rubric: the model returned nothing.');
    }

    // Models sometimes wrap JSON in a fence despite instructions.
    let text = responseText.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Could not read the rubric: the response was not valid JSON.');
    }

    if (parsed === null) {
      throw new Error('Could not read the rubric: the response was not valid JSON.');
    }

    const clean = (list, withWeight) => (Array.isArray(list) ? list : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim() !== '')
      .map(item => withWeight
        ? { text: item.text.trim(), weight: clampWeight(item.weight) }
        : { text: item.text.trim() });

    const rubric = {
      mustHaves: clean(parsed.mustHaves, true),
      niceToHaves: clean(parsed.niceToHaves, true),
      dealbreakers: clean(parsed.dealbreakers, false)
    };

    if (rubric.mustHaves.length === 0) {
      throw new Error('The rubric has no must-haves. Add at least one before scoring.');
    }

    return rubric;
  }
};

/**
 * Scorecard UI
 * Create a rubric from a pasted JD, edit it, save it. A scorecard cannot
 * score anyone until it has been saved at least once.
 */
const ScorecardUI = {
  container: null,
  initialized: false,
  current: null,

  init() {
    this.container = document.getElementById('scorecards-container');
    if (!this.container) return;
    if (!this.initialized) {
      this.initialized = true;
    }
    this.renderList();
  },

  async renderList() {
    this.container.textContent = '';
    const all = await Storage.getScorecards();

    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-primary';
    newBtn.textContent = 'New scorecard from a job description';
    newBtn.addEventListener('click', () => this.renderCreate());
    this.container.appendChild(newBtn);

    if (all.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'scorecard-empty';
      empty.textContent = 'No scorecards yet. Paste a job description to build one.';
      this.container.appendChild(empty);
      return;
    }

    all.forEach(sc => {
      const card = document.createElement('div');
      card.className = 'card scorecard-row';

      const name = document.createElement('strong');
      name.textContent = sc.roleName;
      card.appendChild(name);

      const status = document.createElement('span');
      status.className = Scorecard.isUsable(sc) ? 'chip chip-prime' : 'chip chip-unknown';
      status.textContent = Scorecard.isUsable(sc) ? 'Ready to score' : 'Needs review';
      card.appendChild(status);

      const edit = document.createElement('button');
      edit.className = 'btn';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => this.renderEdit(sc));
      card.appendChild(edit);

      this.container.appendChild(card);
    });
  },

  renderCreate() {
    this.container.textContent = '';

    const nameInput = document.createElement('input');
    nameInput.className = 'form-input';
    nameInput.placeholder = 'Role name, e.g. Senior Backend Engineer';

    const jdInput = document.createElement('textarea');
    jdInput.className = 'form-input';
    jdInput.rows = 12;
    jdInput.placeholder = 'Paste the full job description here';

    const go = document.createElement('button');
    go.className = 'btn btn-primary';
    go.textContent = 'Build rubric';
    go.addEventListener('click', async () => {
      const jd = jdInput.value.trim();
      if (jd === '') {
        showToast('Paste a job description first', 'error');
        return;
      }
      go.disabled = true;
      try {
        const apiKey = await Storage.getApiKey();
        const raw = await callClaude(Scorecard.buildDerivePrompt(jd), apiKey, 2048);
        const rubric = Scorecard.parseDerivedRubric(raw);

        let sc = Scorecard.create({ roleName: nameInput.value.trim() || 'Untitled role' });
        rubric.mustHaves.forEach(c => { sc = Scorecard.addCriterion(sc, 'mustHaves', c.text, c.weight); });
        rubric.niceToHaves.forEach(c => { sc = Scorecard.addCriterion(sc, 'niceToHaves', c.text, c.weight); });
        rubric.dealbreakers.forEach(c => { sc = Scorecard.addCriterion(sc, 'dealbreakers', c.text, 1); });

        this.renderEdit(sc);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        go.disabled = false;
      }
    });

    [nameInput, jdInput, go].forEach(el => this.container.appendChild(el));
  },

  renderEdit(scorecard) {
    this.current = scorecard;
    this.container.textContent = '';

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Claude drafted this from the job description. Correct it before scoring — auto-derived rubrics over-weight boilerplate.';
    this.container.appendChild(note);

    const buckets = [
      ['mustHaves', 'Must have'],
      ['niceToHaves', 'Nice to have'],
      ['dealbreakers', 'Dealbreakers']
    ];

    buckets.forEach(([bucket, label]) => {
      const h = document.createElement('h3');
      h.textContent = label;
      this.container.appendChild(h);

      scorecard[bucket].forEach(c => {
        const row = document.createElement('div');
        row.className = 'criterion-row';

        const input = document.createElement('input');
        input.className = 'form-input';
        input.value = c.text;
        input.addEventListener('input', () => { c.text = input.value; });
        row.appendChild(input);

        // Dealbreakers carry no weight in the scoring model - only
        // must-haves and nice-to-haves do.
        if (bucket !== 'dealbreakers') {
          const weightSelect = document.createElement('select');
          weightSelect.className = 'form-input';
          [[1, '1 - minor'], [2, '2 - important'], [3, '3 - critical']].forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = String(value);
            opt.textContent = label;
            weightSelect.appendChild(opt);
          });
          weightSelect.value = String(clampWeight(c.weight));
          weightSelect.addEventListener('change', () => { c.weight = clampWeight(weightSelect.value); });
          row.appendChild(weightSelect);
        }

        const del = document.createElement('button');
        del.className = 'btn btn-danger';
        del.textContent = 'Remove';
        del.addEventListener('click', () => {
          this.current[bucket] = this.current[bucket].filter(x => x.id !== c.id);
          this.renderEdit(this.current);
        });
        row.appendChild(del);

        this.container.appendChild(row);
      });

      const add = document.createElement('button');
      add.className = 'btn';
      add.textContent = `Add ${label.toLowerCase()}`;
      add.addEventListener('click', () => {
        // Someone hand-adding a must-have means it matters - default it to
        // the highest weight rather than the lowest.
        const defaultWeight = bucket === 'mustHaves' ? 3 : 1;
        this.current = Scorecard.addCriterion(this.current, bucket, '', defaultWeight);
        this.renderEdit(this.current);
      });
      this.container.appendChild(add);
    });

    const save = document.createElement('button');
    save.className = 'btn btn-primary';
    save.textContent = 'Save scorecard';
    save.addEventListener('click', async () => {
      const cleaned = { ...this.current, editedAt: new Date().toISOString() };
      ['mustHaves', 'niceToHaves', 'dealbreakers'].forEach(b => {
        cleaned[b] = cleaned[b].filter(c => c.text.trim() !== '');
      });
      if (cleaned.mustHaves.length === 0) {
        showToast('Add at least one must-have before saving', 'error');
        return;
      }
      await Storage.saveScorecard(cleaned);
      showToast('Scorecard saved', 'success');
      this.renderList();
    });
    this.container.appendChild(save);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorecard;
}
