/** Valid finish-tool inputs as the model would send them (tests only). */
export const reportInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Minh Anh · implication gap',
  blocks: [
    { kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] },
    { kind: 'li', text: 'She picked the converse on 6 implication items.', cites: ['s17-quiz2-q4'] },
  ],
  focus_kind: 'student',
  focus_student_id: 's17',
  gaps: ['implication', 'nonsense'],
  needs_plan: true,
  revise_plan: false,
  follow_ups: ['What gap is the class facing this week?', 'Show her attendance', 'Who else picked the converse?', 'One too many'],
  ...over,
});

export const pathwaySessions = (first = '15:30') => [
  { time: first, title: 'Review implication', minutes: 8, concept: 'implication', is_mastery_check: false, student_id: '' },
  { time: '20:00', title: 'Mastery check', minutes: 10, concept: 'equivalence', is_mastery_check: true, student_id: '' },
];

export const planInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: 'pathway',
  title: 'Rebuild implication, then equivalence',
  student_ids: ['s17'],
  day: 'Today',
  sessions: pathwaySessions(),
  rationale: 'Implication is the root gap.',
  outcome: 'Logical equivalence mastery ≥ 0.75 within 3 sessions',
  ...over,
});

const followUpSessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    time: `${String(9 + i * 3).padStart(2, '0')}:00`, title: i === n - 1 ? 'Mastery check' : 'Equivalence laws practice',
    minutes: 8, concept: 'equivLaws', is_mastery_check: i === n - 1, student_id: '',
  }));

export const adaptInput = (sessions: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  blocks: [{ kind: 'p', text: 'Minh Anh passed tonight’s mastery check: logical equivalence **0.35 → 0.71**.', cites: [] }],
  follow_up_needed: sessions > 0,
  follow_up: { title: 'Equivalence laws in practice', day: 'Tomorrow', sessions: followUpSessions(sessions), rationale: 'One gap remains.', outcome: 'Equivalence laws ≥ 0.60' },
  ...over,
});
