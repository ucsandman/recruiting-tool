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
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Scorecard;
}
