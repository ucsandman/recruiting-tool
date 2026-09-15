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
    const criterion = { id: newId('cr'), text, weight };
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

    const clean = (list, withWeight) => (Array.isArray(list) ? list : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim() !== '')
      .map(item => withWeight
        ? { text: item.text.trim(), weight: Number.isFinite(item.weight) ? item.weight : 1 }
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorecard;
}
