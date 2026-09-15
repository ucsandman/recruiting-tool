const { test } = require('node:test');
const assert = require('node:assert');
const CandidateScorer = require('../features/candidate-scorer.js');

const SCORECARD = {
  id: 'sc_1',
  roleName: 'Backend Engineer',
  mustHaves: [
    { id: 'cr_1', text: '5+ years backend', weight: 3 },
    { id: 'cr_2', text: 'Go experience', weight: 2 }
  ],
  niceToHaves: [{ id: 'cr_3', text: 'Kubernetes', weight: 1 }],
  dealbreakers: [{ id: 'cr_4', text: 'Needs visa sponsorship' }],
  editedAt: '2026-09-14T00:00:00Z'
};

test('the prompt lists every candidate and every criterion id', () => {
  const p = CandidateScorer.buildPrompt(
    [{ id: 'c1', name: 'Dana Reyes', headline: 'Engineer' }],
    SCORECARD
  );
  assert.ok(p.includes('c1'));
  assert.ok(p.includes('Dana Reyes'));
  assert.ok(p.includes('cr_1'));
  assert.ok(p.includes('cr_4'));
  assert.ok(/unknown/i.test(p), 'prompt must define the unknown verdict');
});

test('unknown is excluded from the denominator, so a thin profile is not penalised', () => {
  // cr_1 met (weight 3), cr_2 unknown (weight 2 -> excluded), cr_3 met (weight 1).
  const lines = [
    { criterionId: 'cr_1', verdict: 'met', evidence: 'Senior Backend Engineer, 6 yrs' },
    { criterionId: 'cr_2', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_3', verdict: 'met', evidence: 'Kubernetes' }
  ];
  const { total, unknownCount } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, 100);
  assert.strictEqual(unknownCount, 1);
});

test('an unmet criterion lowers the total', () => {
  const lines = [
    { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
    { criterionId: 'cr_2', verdict: 'unmet', evidence: null },
    { criterionId: 'cr_3', verdict: 'met', evidence: 'y' }
  ];
  const { total } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, 67); // (3 + 1) of (3 + 2 + 1)
});

test('a total of zero decidable criteria reports null rather than zero percent', () => {
  const lines = [
    { criterionId: 'cr_1', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_2', verdict: 'unknown', evidence: null },
    { criterionId: 'cr_3', verdict: 'unknown', evidence: null }
  ];
  const { total } = CandidateScorer.scoreTotal(lines, SCORECARD);
  assert.strictEqual(total, null);
});

test('a met verdict with no evidence is downgraded to unknown', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'Backend Engineer since 2018' },
      { criterionId: 'cr_2', verdict: 'met', evidence: '' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  const cr2 = score.lines.find(l => l.criterionId === 'cr_2');
  assert.strictEqual(cr2.verdict, 'unknown');
});

test('a dealbreaker hit is surfaced separately from the total', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
      { criterionId: 'cr_4', verdict: 'met', evidence: 'Requires H-1B sponsorship' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  assert.strictEqual(score.dealbreakerHit, 'cr_4');
});

test('lines referring to unknown criterion ids are discarded', () => {
  const raw = JSON.stringify([{
    candidateId: 'c1',
    lines: [
      { criterionId: 'cr_1', verdict: 'met', evidence: 'x' },
      { criterionId: 'cr_999', verdict: 'met', evidence: 'hallucinated' }
    ]
  }]);
  const [score] = CandidateScorer.parseResponse(raw, SCORECARD);
  assert.strictEqual(score.lines.length, 1);
});

test('throws a descriptive error on unparseable output', () => {
  assert.throws(() => CandidateScorer.parseResponse('not json', SCORECARD), /could not read/i);
});
