export type Expr = (p: boolean, q: boolean) => boolean;

/** Truth-table rows in display order: TT, TF, FT, FF. */
export const TT_ROWS: [boolean, boolean][] = [[true, true], [true, false], [false, true], [false, false]];

export const equivalent = (f: Expr, g: Expr): boolean => TT_ROWS.every(([p, q]) => f(p, q) === g(p, q));

export const Q1 = {
  prompt: 'Which expression is logically equivalent to p → q?',
  options: [
    { label: 'q → p', f: ((p, q) => !q || p) as Expr },
    { label: '¬p ∨ q', f: ((p, q) => !p || q) as Expr },
    { label: 'p ∧ ¬q', f: ((p, q) => p && !q) as Expr },
    { label: '¬p → ¬q', f: ((p, q) => p || !q) as Expr },
  ],
  correct: 1,
  chosenWrong: 0,
  hint: 'Check the row p = F, q = T: p → q is true, but q → p is false. Swapping the sides (the converse) changes the meaning.',
};

export const HINT_ROW = { p: false, q: true };

export const GUIDED = {
  prompt: 'Rewrite ¬(p → q) using only ∧ and ¬.',
  start: ((p, q) => !(!p || q)) as Expr,
  steps: [
    { expr: '¬(¬p ∨ q)', why: 'Replace p → q with ¬p ∨ q', f: ((p, q) => !(!p || q)) as Expr },
    { expr: '¬¬p ∧ ¬q', why: "De Morgan's law", f: ((p, q) => !!p && !q) as Expr },
    { expr: 'p ∧ ¬q', why: 'Double negation', f: ((p, q) => p && !q) as Expr },
  ],
};

/** Sc7 timeline (scene time, ms), shared by the phone. */
export const SC9 = {
  tap: 1800,
  plan: 2400,
  practice: 6200,
  pickWrong: 8200,
  hint: 8800,
  pickRight: 11200,
  guided: 12200,
  guidedSteps: [13000, 14000, 15000],
  progress: 16200,
};

export const SC9_EVIDENCE = [
  { at: 8200, label: 'Answer q → p · incorrect (converse)' },
  { at: 8800, label: 'Hint viewed · truth-table row' },
  { at: 11200, label: 'Answer ¬p ∨ q · correct' },
  { at: 15000, label: 'Guided rewrite · 3 / 3 steps' },
  { at: 16200, label: 'Activity 3 of 4 complete' },
];

export const PROGRESS = { concept: 'Implication', from: 31, to: 52, accuracyToday: 75, done: 3, total: 4 };
