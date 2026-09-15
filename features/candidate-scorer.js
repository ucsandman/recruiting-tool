/**
 * Candidate Scorer
 * Scores many candidates against one scorecard in a single Claude request.
 *
 * Two rules make the output trustworthy:
 *  - every "met" carries verbatim evidence from the candidate's own profile
 *  - absence of evidence is "unknown", never "unmet"
 * A LinkedIn profile omits things. Treating an omission as a failure silently
 * buries qualified people, which is the failure this tool exists to prevent.
 */

const CandidateScorer = {
  buildPrompt(candidates, scorecard) {
    const criteria = [
      ...scorecard.mustHaves.map(c => ({ ...c, bucket: 'must-have' })),
      ...scorecard.niceToHaves.map(c => ({ ...c, bucket: 'nice-to-have' })),
      ...scorecard.dealbreakers.map(c => ({ ...c, bucket: 'dealbreaker' }))
    ];

    return [
      `You are screening candidates for: ${scorecard.roleName}.`,
      '',
      'Judge each candidate against each criterion using ONLY the profile text given.',
      '',
      'Verdicts:',
      '  "met"     - the profile contains text that supports this. You MUST quote it.',
      '  "unmet"   - the profile contains text that contradicts this.',
      '  "unknown" - the profile simply does not say. This is the correct verdict for',
      '              anything absent. Do NOT use "unmet" for a missing mention.',
      '',
      'A LinkedIn profile is a marketing document with omissions. Silence is not',
      'evidence of absence. When in doubt, answer "unknown".',
      '',
      'Criteria:',
      ...criteria.map(c => `  ${c.id} [${c.bucket}] ${c.text}`),
      '',
      'Candidates:',
      ...candidates.map(c => [
        `  --- candidate ${c.id} ---`,
        `  Name: ${c.name || ''}`,
        `  Headline: ${c.headline || ''}`,
        `  About: ${c.about || ''}`,
        `  Experience: ${JSON.stringify(c.experience || [])}`,
        `  Skills: ${(c.skills || []).join(', ')}`
      ].join('\n')),
      '',
      'Respond with JSON only, no prose and no code fence:',
      '[{"candidateId":"...","lines":[{"criterionId":"...","verdict":"met|unmet|unknown","evidence":"verbatim quote or null"}]}]'
    ].join('\n');
  },

  /**
   * Percentage of DECIDABLE weight that was met. Unknown criteria are excluded
   * from the denominator entirely so a thin profile scores low-confidence,
   * not low-quality. Dealbreakers are reported separately, never scored.
   */
  scoreTotal(lines, scorecard) {
    const weights = new Map();
    [...scorecard.mustHaves, ...scorecard.niceToHaves]
      .forEach(c => weights.set(c.id, c.weight || 1));

    let met = 0;
    let decidable = 0;
    let unknownCount = 0;

    lines.forEach(line => {
      if (!weights.has(line.criterionId)) return; // dealbreaker or unknown id
      const weight = weights.get(line.criterionId);
      if (line.verdict === 'unknown') { unknownCount += 1; return; }
      decidable += weight;
      if (line.verdict === 'met') met += weight;
    });

    const total = decidable === 0 ? null : Math.round((met / decidable) * 100);
    return { total, unknownCount };
  },

  parseResponse(responseText, scorecard) {
    if (typeof responseText !== 'string' || responseText.trim() === '') {
      throw new Error('Could not read the scores: the model returned nothing.');
    }

    let text = responseText.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Could not read the scores: the response was not valid JSON.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Could not read the scores: expected a list of candidates.');
    }

    const validIds = new Set([
      ...scorecard.mustHaves, ...scorecard.niceToHaves, ...scorecard.dealbreakers
    ].map(c => c.id));
    const dealbreakerIds = new Set(scorecard.dealbreakers.map(c => c.id));

    return parsed.map(entry => {
      const lines = (Array.isArray(entry.lines) ? entry.lines : [])
        // Discard hallucinated criterion ids rather than scoring them.
        .filter(l => l && validIds.has(l.criterionId))
        .map(l => {
          const evidence = typeof l.evidence === 'string' && l.evidence.trim() !== ''
            ? l.evidence.trim()
            : null;
          // A claim with no quotable support is not "met".
          const verdict = (l.verdict === 'met' && !evidence) ? 'unknown' : l.verdict;
          return { criterionId: l.criterionId, verdict, evidence };
        });

      const hit = lines.find(l => dealbreakerIds.has(l.criterionId) && l.verdict === 'met');
      const { total, unknownCount } = this.scoreTotal(lines, scorecard);

      let recommendation = 'weak';
      if (hit) recommendation = 'weak';
      else if (total !== null && total >= 75) recommendation = 'strong';
      else if (total !== null && total >= 45) recommendation = 'possible';

      return {
        candidateId: entry.candidateId,
        scorecardId: scorecard.id,
        total,
        recommendation,
        lines,
        dealbreakerHit: hit ? hit.criterionId : null,
        unknownCount
      };
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CandidateScorer;
}
