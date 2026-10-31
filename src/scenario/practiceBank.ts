import type { ConceptId } from './knowledgeGraph';
import { GUIDED, Q1 } from './practice';

export interface GuidedStep { expr: string; why: string }

export interface BankItem {
  id: string;
  concept: ConceptId;
  prompt: string;
  options: string[];
  correct: number;
  /** One hint per option; the correct option's entry is ''. */
  hints: string[];
  /** Shown after a correct answer: a worked rewrite the student steps through. */
  guided?: { start: string; steps: GuidedStep[] };
}

let counts: Partial<Record<ConceptId, number>> = {};
function item(concept: ConceptId, prompt: string, options: string[], correct: number, hints: string[], guided?: BankItem['guided']): BankItem {
  counts[concept] = (counts[concept] ?? 0) + 1;
  return { id: `${concept}-${counts[concept]}`, concept, prompt, options, correct, hints, guided };
}

export const BANK: BankItem[] = [
  item('propositions', 'Which of these is a proposition?', ['x + 2 = 5', 'Close the door.', '7 is a prime number.', 'Is it raining?'], 2, [
    'It has a variable, so it is not true or false on its own.', 'A command is not true or false.', '', 'A question is not true or false.']),
  item('propositions', 'p: “It is raining”, q: “I take an umbrella”. Which sentence is p ∧ q?', ['It is raining or I take an umbrella.', 'It is raining and I take an umbrella.', 'If it is raining, I take an umbrella.', 'It is not raining.'], 1, [
    '“or” is ∨, not ∧.', '', '“If … then” is implication (→).', 'That is ¬p.']),
  item('propositions', 'How many rows does the truth table for p, q, r have?', ['3', '6', '8', '9'], 2, [
    'Each variable doubles the rows: 2 × 2 × 2.', 'Each variable doubles the rows; it does not add 2.', '', 'Each variable is T or F, so the rows are 2 × 2 × 2, not 3 × 3.']),

  item('negation', 'What is the negation of “All students passed”?', ['No student passed.', 'Some student did not pass.', 'All students failed.', 'Some students passed.'], 1, [
    '“None passed” is stronger than the negation: one failure is enough.', '', 'Negating “all” does not flip every case: one counterexample is enough.', 'That can be true together with the original, so it is not its negation.']),
  item('negation', 'If p is true, what is ¬¬p?', ['True', 'False', 'Undefined', 'Depends on q'], 0, [
    '', 'Two negations cancel: ¬¬p has the same value as p.', 'Every compound of p has a value once p is known.', 'q does not appear in ¬¬p.']),
  item('negation', 'Which is equivalent to ¬(p ∧ q)?', ['¬p ∧ ¬q', '¬p ∨ ¬q', 'p ∨ q', '¬p → q'], 1, [
    'Negating ∧ turns it into ∨ (De Morgan): check p = T, q = F.', '', 'Check p = T, q = T: ¬(p ∧ q) is F but p ∨ q is T.', 'Check p = F, q = F: ¬(p ∧ q) is T but ¬p → q is F.'],
    { start: '¬(p ∧ q)', steps: [{ expr: '¬p ∨ ¬q', why: "De Morgan's law: negate each part, swap ∧ for ∨" }] }),

  item('conjunction', 'p ∧ q is true exactly when…', ['p is true', 'at least one of p, q is true', 'both p and q are true', 'p and q have the same value'], 2, [
    'q must be true as well.', 'That describes p ∨ q.', '', 'That describes p ↔ q (both false also counts).']),
  item('conjunction', 'p = T, q = F. What is p ∧ q?', ['T', 'F'], 1, ['∧ needs both sides true; q is false.', '']),
  item('conjunction', 'Which is equivalent to p ∧ (p ∨ q)?', ['p', 'q', 'p ∧ q', 'p ∨ q'], 0, [
    '', 'Check p = F, q = T: the expression is F but q is T.', 'Check p = T, q = F: the expression is T but p ∧ q is F.', 'Check p = F, q = T: the expression is F but p ∨ q is T.'],
    { start: 'p ∧ (p ∨ q)', steps: [
      { expr: '(p ∧ p) ∨ (p ∧ q)', why: 'Distribute ∧ over ∨' },
      { expr: 'p ∨ (p ∧ q)', why: 'Idempotence: p ∧ p ≡ p' },
      { expr: 'p', why: 'Absorption' },
    ] }),

  item('disjunction', 'p ∨ q is false exactly when…', ['p is false', 'both p and q are false', 'exactly one is false', 'both are true'], 1, [
    'q could still be true.', '', 'One true side is enough to make ∨ true.', 'Both true makes ∨ true.']),
  item('disjunction', '“I will have tea or coffee” (inclusive or). Which case makes it false?', ['Tea, no coffee', 'Coffee, no tea', 'Both', 'Neither'], 3, [
    'One true side makes it true.', 'One true side makes it true.', 'Inclusive or is true when both hold.', '']),
  item('disjunction', 'Which is equivalent to ¬(p ∨ q)?', ['¬p ∨ ¬q', '¬p ∧ ¬q', 'p ∧ q', '¬p ∨ q'], 1, [
    'Negating ∨ turns it into ∧: check p = T, q = F.', '', 'Each part must be negated.', 'Check p = F, q = T: ¬(p ∨ q) is F but ¬p ∨ q is T.']),

  item('implication', Q1.prompt, Q1.options.map((o) => o.label), Q1.correct, [
    Q1.hint, '', 'p ∧ ¬q is the negation of p → q: it is true exactly when the implication fails.', '¬p → ¬q is the inverse; it has the same truth table as the converse, not the original.'],
    { start: '¬(p → q)', steps: GUIDED.steps.map(({ expr, why }) => ({ expr, why })) }),
  item('implication', 'When is p → q false?', ['p = T, q = T', 'p = T, q = F', 'p = F, q = T', 'p = F, q = F'], 1, [
    'A promise kept: the implication holds.', '', 'With p false the implication is vacuously true.', 'With p false the implication is vacuously true.']),
  item('implication', 'Which statement is the contrapositive of p → q?', ['q → p', '¬p → ¬q', '¬q → ¬p', 'p → ¬q'], 2, [
    'That is the converse: it swaps the sides without negating.', 'That is the inverse: it negates without swapping.', '', 'That contradicts the original when p and q are both true.']),

  item('biconditional', 'p ↔ q is true exactly when…', ['p and q have the same value', 'p is true', 'p → q is true', 'at least one is true'], 0, [
    '', 'Both false also makes ↔ true.', 'q → p must hold too.', 'p = T, q = F has one true side, but ↔ is false.']),
  item('biconditional', 'Which is equivalent to p ↔ q?', ['(p → q) ∧ (q → p)', '(p → q) ∨ (q → p)', 'p ∧ q', '¬p ∨ q'], 0, [
    '', 'Check p = T, q = F: one implication fails, so ↔ is F, but the ∨ is T.', 'Check p = F, q = F: ↔ is T but p ∧ q is F.', 'That is p → q only.']),
  item('biconditional', 'p = F, q = F. What is p ↔ q?', ['T', 'F'], 0, ['', 'Same value on both sides makes ↔ true.']),

  item('truthTables', 'In the truth table of p → q, how many rows are true?', ['1', '2', '3', '4'], 2, [
    'Only one row is false: p = T, q = F.', 'Only one row is false: p = T, q = F.', '', 'The row p = T, q = F is false.']),
  item('truthTables', 'A formula is true in every row of its truth table. It is a…', ['contradiction', 'tautology', 'contingency', 'proposition variable'], 1, [
    'A contradiction is false in every row.', '', 'A contingency is true in some rows and false in others.', 'A variable takes both values.']),
  item('truthTables', 'Which formula is a tautology?', ['p ∧ ¬p', 'p ∨ ¬p', 'p → ¬p', 'p ↔ ¬p'], 1, [
    'p and ¬p are never both true: always false.', '', 'False when p is true.', 'p and ¬p never have the same value: always false.']),

  item('expressions', 'Translate “If it rains, the match is cancelled” with r: rains, c: cancelled.', ['c → r', 'r → c', 'r ∧ c', 'r ↔ c'], 1, [
    'That is the converse: “if cancelled, it rained”.', '', 'That claims both happen.', 'That also claims “if cancelled, then it rained”.']),
  item('expressions', 'p = T, q = F, r = T. What is (p ∨ q) ∧ ¬r?', ['T', 'F'], 1, ['¬r is F, and anything ∧ F is F.', '']),
  item('expressions', 'Which expression means “neither p nor q”?', ['¬p ∨ ¬q', '¬(p ∧ q)', '¬p ∧ ¬q', '¬p → q'], 2, [
    'That allows one of them to be true.', 'That only rules out both being true.', '', 'That means p ∨ q.']),

  item('equivalence', 'Two formulas are logically equivalent when…', ['they have the same variables', 'they have the same value in every row of the truth table', 'one implies the other', 'they are both true in some row'], 1, [
    'Same variables is not enough: p ∧ q and p ∨ q share variables.', '', 'Equivalence needs both directions, in every row.', 'Agreeing on one row is not enough.']),
  item('equivalence', 'Which is equivalent to p → q?', ['¬q → ¬p', 'q → p', '¬p → ¬q', 'p ∧ q'], 0, [
    '', 'The converse: check p = F, q = T.', 'The inverse: check p = F, q = T.', 'Check p = F, q = F: p → q is T but p ∧ q is F.'],
    { start: 'p → q', steps: [
      { expr: '¬p ∨ q', why: 'Implication as disjunction' },
      { expr: 'q ∨ ¬p', why: 'Commutativity' },
      { expr: '¬q → ¬p', why: 'Disjunction back to implication' },
    ] }),
  item('equivalence', 'Is p → q equivalent to ¬p ∨ q?', ['Yes', 'No'], 0, ['', 'Compare the rows: both are false only when p = T and q = F.']),
  item('equivalence', 'Which pair is NOT equivalent?', ['p ∨ q and q ∨ p', '¬¬p and p', 'p → q and q → p', '¬(p ∨ q) and ¬p ∧ ¬q'], 2, [
    '∨ is commutative.', 'Double negation cancels.', '', "That is De Morgan's law."]),

  item('deMorgan', '¬(p ∧ q) ≡ ?', ['¬p ∧ ¬q', '¬p ∨ ¬q', 'p ∨ q', '¬p ∧ q'], 1, [
    'Swap ∧ for ∨ when the negation moves inside.', '', 'Each part needs its own negation.', 'Both parts need the negation.']),
  item('deMorgan', 'Negate “The code compiles and the tests pass”.', ['The code does not compile and the tests fail.', 'The code does not compile or the tests fail.', 'The code compiles or the tests pass.', 'The code compiles and the tests fail.'], 1, [
    'Too strong: one failure is enough to negate “and”.', '', 'That is not a negation: it is true when both hold.', 'That is only one of the two ways the original can fail.']),
  item('deMorgan', '¬(¬p ∨ q) ≡ ?', ['p ∧ ¬q', '¬p ∧ q', 'p ∨ ¬q', '¬p ∨ ¬q'], 0, [
    '', 'Negate each part: ¬¬p is p, and q becomes ¬q.', 'Negating ∨ gives ∧.', 'Negating ∨ gives ∧, and ¬¬p is p.'],
    { start: '¬(¬p ∨ q)', steps: [{ expr: '¬¬p ∧ ¬q', why: "De Morgan's law" }, { expr: 'p ∧ ¬q', why: 'Double negation' }] }),

  item('equivLaws', 'Which law gives p ∨ (p ∧ q) ≡ p?', ['Distributive', 'Absorption', 'Idempotent', 'Identity'], 1, [
    'Distribution would expand it, not shrink it.', '', 'Idempotence is p ∨ p ≡ p.', 'Identity is p ∨ F ≡ p.']),
  item('equivLaws', 'p ∧ (q ∨ r) ≡ ?', ['(p ∧ q) ∨ (p ∧ r)', '(p ∨ q) ∧ (p ∨ r)', 'p ∧ q ∧ r', '(p ∧ q) ∨ r'], 0, [
    '', 'That distributes ∨ over ∧, the other law.', 'Check p = T, q = T, r = F.', 'Check p = F, q = F, r = T.']),
  item('equivLaws', 'Simplify ¬(p → q) ∨ q.', ['p ∨ q', 'q', 'p ∧ q', '¬p'], 0, [
    '', 'Check p = T, q = F: the expression is T but q is F.', 'Check p = T, q = F: the expression is T but p ∧ q is F.', 'Check p = T, q = F: the expression is T but ¬p is F.'],
    { start: '¬(p → q) ∨ q', steps: [
      { expr: '(p ∧ ¬q) ∨ q', why: 'Negated implication' },
      { expr: '(p ∨ q) ∧ (¬q ∨ q)', why: 'Distribute ∨ over ∧' },
      { expr: 'p ∨ q', why: '¬q ∨ q ≡ T, and x ∧ T ≡ x' },
    ] }),

  item('applications', 'A door opens if you have a badge or a code, and the alarm is off. Which formula?', ['(b ∨ c) ∧ ¬a', 'b ∨ (c ∧ ¬a)', '(b ∧ c) ∨ ¬a', 'b ∨ c ∨ ¬a'], 0, [
    '', 'The alarm must be off for the badge too.', 'This opens the door with no badge or code whenever the alarm is off, and demands both otherwise.', 'The alarm condition must always hold.']),
  item('applications', 'Rule: “if a student misses 3 tutorials, the teacher is alerted”. The teacher was not alerted. What follows?', ['The student missed 3 tutorials.', 'The student missed fewer than 3 tutorials.', 'Nothing follows.', 'The rule was broken.'], 1, [
    'That would make the rule fail.', '', 'The contrapositive applies: ¬q → ¬p.', 'The rule still holds; reason from it.']),
  item('applications', 'Each student is in at most one tutorial group. Which query finds students who are in neither G1 nor G2?', ['¬(G1 ∨ G2)', '¬G1 ∨ ¬G2', '¬(G1 ∧ G2)', 'G1 ∨ G2'], 0, [
    '', 'That includes every student in G1 (they are not in G2).', 'Nobody is in both groups, so that matches everyone.', 'That finds the students in G1 or G2.']),
];
counts = {};

export const BANK_CONCEPTS: ConceptId[] = [...new Set(BANK.map((i) => i.concept))];

export const itemsFor = (c: ConceptId): BankItem[] => BANK.filter((i) => i.concept === c);

/** Practice sessions take a concept's first 2 items; the mastery check takes its last 3. */
export function sessionItems(concept: ConceptId, isMasteryCheck: boolean): BankItem[] {
  const all = itemsFor(concept);
  return isMasteryCheck ? all.slice(-3) : all.slice(0, 2);
}
