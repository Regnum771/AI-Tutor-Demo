import { cloOf, type Bloom, type CloId } from './course';
import type { ConceptId } from './knowledgeGraph';

export interface Card {
  id: string;
  concept: ConceptId;
  clo: CloId;
  bloom: Bloom;
  front: string;
  back: string;
}

const card = (concept: ConceptId, n: number, bloom: Bloom, front: string, back: string): Card => ({
  id: `card-${concept}-${n}`, concept, clo: cloOf(concept).id, bloom, front, back,
});

export const CARDS: Card[] = [
  card('propositions', 1, 'Remember', 'What is a proposition?', 'A sentence that is either true or false, but not both. “7 is prime” is one; “Close the door” is not.'),
  card('propositions', 2, 'Remember', 'How many rows does a truth table with n variables have?', '2ⁿ rows: each variable doubles the count. Three variables give 8 rows.'),
  card('propositions', 3, 'Understand', 'Why is “x + 2 = 5” not a proposition?', 'Its truth depends on the value of x, so as written it is neither true nor false.'),
  card('propositions', 4, 'Understand', 'Why does logic use symbols such as p instead of whole sentences?', 'The truth of a compound statement depends only on the truth values of its parts, so symbols let us study its form apart from its wording.'),

  card('negation', 1, 'Remember', 'What does ¬p mean, and when is it true?', '“Not p”. It is true exactly when p is false.'),
  card('negation', 2, 'Remember', 'What is ¬¬p equivalent to?', 'p. Two negations cancel (double negation).'),
  card('negation', 3, 'Understand', 'What is the negation of “All students passed”?', '“Some student did not pass”. One counterexample is enough; “No student passed” is too strong.'),
  card('negation', 4, 'Understand', 'Why is ¬p ∧ q different from ¬(p ∧ q)?', 'In ¬p ∧ q the negation applies to p only. In ¬(p ∧ q) it applies to the whole conjunction.'),

  card('conjunction', 1, 'Remember', 'When is p ∧ q true?', 'Only when both p and q are true.'),
  card('conjunction', 2, 'Remember', 'Which symbol is “and”, and which is “or”?', '∧ is “and” (conjunction). ∨ is “or” (disjunction).'),
  card('conjunction', 3, 'Understand', 'Why is p ∧ q false when one part is false?', 'A conjunction claims both parts hold. One false part is enough to break the claim.'),
  card('conjunction', 4, 'Understand', 'Does the order of a conjunction matter?', 'No. p ∧ q ≡ q ∧ p (commutativity): both are true in exactly the row where p and q are both true.'),

  card('disjunction', 1, 'Remember', 'When is p ∨ q false?', 'Only when both p and q are false.'),
  card('disjunction', 2, 'Remember', 'Is the logical ∨ inclusive or exclusive?', 'Inclusive: p ∨ q is still true when both p and q are true.'),
  card('disjunction', 3, 'Understand', '“Tea or coffee” can be read two ways. Which one is ∨?', 'The inclusive reading, where having both also makes it true. The exclusive reading (exactly one) is a different connective.'),
  card('disjunction', 4, 'Understand', 'Why does one true part make p ∨ q true?', 'A disjunction only claims that at least one part holds, so a single true part already satisfies it.'),

  card('implication', 1, 'Remember', 'When is p → q false?', 'Only when p is true and q is false. Every other row is true.'),
  card('implication', 2, 'Remember', 'What is the contrapositive of p → q?', '¬q → ¬p. It always has the same truth table as p → q.'),
  card('implication', 3, 'Understand', 'Why is p → q true when p is false?', 'The promise “if p then q” is only broken when p happens and q does not. With p false, nothing is broken (vacuously true).'),
  card('implication', 4, 'Understand', 'Why is the inverse ¬p → ¬q not equivalent to p → q?', 'It negates both parts without swapping them. At p = F, q = T, p → q is true but ¬p → ¬q is false.'),

  card('biconditional', 1, 'Remember', 'When is p ↔ q true?', 'When p and q have the same truth value: both true or both false.'),
  card('biconditional', 2, 'Remember', 'How is p ↔ q read?', '“p if and only if q”.'),
  card('biconditional', 3, 'Understand', 'Which two implications make up p ↔ q?', '(p → q) ∧ (q → p). Both directions must hold.'),
  card('biconditional', 4, 'Understand', 'p ↔ q is true when both are false. Why?', 'The sides agree, and ↔ only asks for agreement, not for truth.'),

  card('truthTables', 1, 'Remember', 'What are a tautology and a contradiction?', 'A tautology is true in every row (p ∨ ¬p). A contradiction is false in every row (p ∧ ¬p).'),
  card('truthTables', 2, 'Remember', 'What is a contingency?', 'A formula that is true in some rows and false in others, such as p ∧ q.'),
  card('truthTables', 3, 'Understand', 'What does one row of a truth table stand for?', 'One assignment of true or false to every variable. The row’s output is the formula’s value in that case.'),
  card('truthTables', 4, 'Understand', 'How do you use a truth table to compare two formulas?', 'Build both columns over the same rows. If they match in every row, the formulas are equivalent.'),

  card('expressions', 1, 'Remember', 'Which connective is evaluated first in ¬p ∧ q?', '¬ binds tightest, so it is (¬p) ∧ q. Use parentheses when in doubt.'),
  card('expressions', 2, 'Remember', 'What is a well-formed formula?', 'One built from variables with ¬, ∧, ∨, →, ↔ and balanced parentheses, where each connective joins complete formulas, such as (p ∧ q) → r. “p ∧ → q” is not one: ∧ has no formula on its right.'),
  card('expressions', 3, 'Understand', 'How is “If it rains, the match is cancelled” written?', 'r → c, with r: it rains and c: the match is cancelled. The reverse, c → r, is the converse.'),
  card('expressions', 4, 'Understand', 'What does “neither p nor q” mean in symbols?', '¬p ∧ ¬q, which is equivalent to ¬(p ∨ q).'),

  card('equivalence', 1, 'Understand', 'What does p ≡ q mean?', 'p and q have the same truth value in every row of the truth table.'),
  card('equivalence', 2, 'Understand', 'How do you show two formulas are not equivalent?', 'Find one row where their values differ. One such row is enough.'),
  card('equivalence', 3, 'Apply', 'Rewrite p → q using only ¬ and ∨.', '¬p ∨ q. Both are false only when p is true and q is false.'),
  card('equivalence', 4, 'Apply', 'Write the converse and the inverse of p → q, and say whether either is equivalent to it.', 'Converse q → p, inverse ¬p → ¬q. Neither is equivalent: at p = F, q = T the original is true but the converse is false.'),

  card('deMorgan', 1, 'Understand', 'State De Morgan’s laws.', '¬(p ∧ q) ≡ ¬p ∨ ¬q, and ¬(p ∨ q) ≡ ¬p ∧ ¬q. Negate each part and swap ∧ with ∨.'),
  card('deMorgan', 2, 'Understand', 'Why does ¬(p ∧ q) turn into an “or”?', 'To break “both”, it is enough for at least one part to fail.'),
  card('deMorgan', 3, 'Apply', 'Simplify ¬(¬p ∨ q).', 'p ∧ ¬q. De Morgan gives ¬¬p ∧ ¬q, then double negation removes ¬¬.'),
  card('deMorgan', 4, 'Apply', 'Negate “The code compiles and the tests pass”.', '“The code does not compile or the tests fail.” One failure is enough.'),

  card('equivLaws', 1, 'Understand', 'What does the absorption law say?', 'p ∨ (p ∧ q) ≡ p and p ∧ (p ∨ q) ≡ p. The longer part adds nothing.'),
  card('equivLaws', 2, 'Understand', 'What do the identity and idempotent laws say?', 'Identity: p ∧ T ≡ p and p ∨ F ≡ p. Idempotent: p ∧ p ≡ p and p ∨ p ≡ p.'),
  card('equivLaws', 3, 'Apply', 'Expand p ∧ (q ∨ r) with the distributive law.', '(p ∧ q) ∨ (p ∧ r). The other law is p ∨ (q ∧ r) ≡ (p ∨ q) ∧ (p ∨ r).'),
  card('equivLaws', 4, 'Apply', 'Simplify (p ∧ q) ∨ (p ∧ ¬q).', 'p. Factor out p to get p ∧ (q ∨ ¬q), and q ∨ ¬q is always true.'),

  card('applications', 1, 'Apply', 'The rule “if a student misses 3 tutorials, the teacher is alerted” holds and no alert was sent. What follows?', 'The student missed fewer than 3 tutorials. This is the contrapositive: ¬q → ¬p.'),
  card('applications', 2, 'Apply', 'How do you write “you need a badge or a code, and the alarm must be off”?', '(b ∨ c) ∧ ¬a, with b: has a badge, c: has a code, a: the alarm is on. The parentheses make the alarm condition apply in both cases.'),
  card('applications', 3, 'Analyze', 'The rule “if p then q” holds and q is true. Can you conclude p?', 'No. That is affirming the consequent. q could be true for another reason.'),
  card('applications', 4, 'Analyze', 'How do you check whether a plain-English argument is valid?', 'Translate it into symbols, then look for a row where all the premises are true and the conclusion is false. If there is one, it is invalid.'),
];
