import { cloOf, type Bloom } from './course';
import type { ConceptId } from './knowledgeGraph';
import type { BankItem } from './practiceBank';

const q = (
  concept: ConceptId, n: number, bloom: Bloom, prompt: string, options: string[], correct: number, hints: string[], equivTo?: string,
): BankItem => ({ id: `${concept}-x${n}`, concept, clo: cloOf(concept).id, bloom, core: false, prompt, options, correct, hints, equivTo });

/** The 35 added questions: with the 37 originals, every concept has exactly 2 per Bloom level of its CLO. */
export const EXTRA_ITEMS: BankItem[] = [
  // propositions
  q('propositions', 1, 'Remember', 'What is a proposition?',
    ['A sentence that is either true or false, but not both', 'Any sentence that ends with a full stop', 'A sentence containing a variable', 'A statement that is always true'], 0,
    ['', 'A command can end with a full stop and still not be true or false.', 'A sentence with an unassigned variable has no fixed truth value.', 'That describes a tautology: a proposition may be false.']),
  q('propositions', 2, 'Understand', 'Why is “x > 3” not a proposition until x is given a value?',
    ['Its truth value depends on x, so it is neither true nor false as written', 'It contains a number', 'It is a question', 'It is always false'], 0,
    ['', 'Many propositions contain numbers, such as “7 is prime”.', 'It is written as a statement, not a question.', 'It is true for x = 5, so it is not always false.']),
  q('propositions', 3, 'Apply', 'p: “The server is up”, q: “The backup is running”. Which sentence is ¬p ∨ q?',
    ['The server is down or the backup is running.', 'The server is down and the backup is running.', 'The server is up or the backup is not running.', 'The server is down and the backup is not running.'], 0,
    ['', '“and” is ∧; ¬p ∨ q needs only one of the two parts to hold.', 'That is p ∨ ¬q: the negations are on the wrong parts.', 'That is ¬p ∧ ¬q: both parts negated and joined by “and”.']),

  // negation
  q('negation', 1, 'Remember', 'The symbol ¬ is read as…',
    ['not', 'and', 'or', 'if … then'], 0,
    ['', '∧ is the symbol for “and”.', '∨ is the symbol for “or”.', '→ is the symbol for “if … then”.']),
  q('negation', 2, 'Understand', 'Why is ¬p true exactly when p is false?',
    ['Negation reverses the truth value of what it applies to', 'Negation makes every statement false', 'Negation makes every statement true', 'Negation only applies to true statements'], 0,
    ['', 'If p is false, ¬p is true, so it is not always false.', 'If p is true, ¬p is false, so it is not always true.', 'Negation applies to any statement, true or false.']),
  q('negation', 3, 'Apply', 'If p is false, what is ¬¬¬p?',
    ['True', 'False'], 0,
    ['', 'Two of the three negations cancel, leaving ¬p, which is true when p is false.']),

  // conjunction
  q('conjunction', 1, 'Remember', 'Which symbol means “and” in propositional logic?',
    ['∧', '∨', '¬', '→'], 0,
    ['', '∨ means “or”.', '¬ means “not”.', '→ means “if … then”.']),
  q('conjunction', 2, 'Understand', 'Why is p ∧ q false when p is false and q is true?',
    ['Both parts must be true for a conjunction to be true, and p is not', 'A conjunction is true when at least one part is true', 'A true q is enough to make it true', 'The order of p and q matters'], 0,
    ['', 'That describes ∨, not ∧.', 'q true is not enough: p must be true as well.', 'Conjunction is commutative: q ∧ p has the same value.']),
  q('conjunction', 3, 'Understand', 'Which statement about p ∧ q is correct?',
    ['It has the same value as q ∧ p', 'It is true whenever p is true', 'It is false only when both parts are false', 'It has the same value as p ∨ q'], 0,
    ['', 'If p is true and q is false, p ∧ q is false.', 'It is false whenever at least one part is false.', 'Check p = T, q = F: p ∧ q is F but p ∨ q is T.']),

  // disjunction
  q('disjunction', 1, 'Remember', 'Which connective is true when at least one of its parts is true?',
    ['Disjunction (∨)', 'Conjunction (∧)', 'Biconditional (↔)', 'Negation (¬)'], 0,
    ['', '∧ needs both parts to be true.', 'Biconditional is also true when both parts are false, with no true part.', '¬ has only one part, and it reverses the value.']),
  q('disjunction', 2, 'Understand', 'The symbol ∨ is true when both parts are true. How does this differ from an everyday “either … or”?',
    ['Everyday “either … or” is often exclusive; ∨ is inclusive', 'There is no difference', '∨ is exclusive', '∨ is false when p is true'], 0,
    ['', 'There is a difference: ∨ stays true when both parts hold, while an exclusive “either … or” does not.', '∨ allows both to be true, so it is not exclusive.', 'A true p already makes p ∨ q true.']),
  q('disjunction', 3, 'Apply', 'Which formula is equivalent to p ∨ q?',
    ['¬(¬p ∧ ¬q)', '¬p ∨ ¬q', 'p ∧ q', '¬p → ¬q'], 0,
    ['', 'Check p = T, q = T: p ∨ q is T but ¬p ∨ ¬q is F.', 'Check p = T, q = F: p ∨ q is T but p ∧ q is F.', 'Check p = F, q = T: p ∨ q is T but ¬p → ¬q is F.'], 'p ∨ q'),

  // implication
  q('implication', 1, 'Remember', 'In p → q, what is p called?',
    ['The hypothesis (antecedent)', 'The conclusion (consequent)', 'The converse', 'The contrapositive'], 0,
    ['', 'The conclusion is q, the part after the arrow.', 'The converse is a whole statement, q → p, not a part.', 'The contrapositive is a whole statement, ¬q → ¬p, not a part.']),
  q('implication', 2, 'Understand', '“If you submit on time, you get a bonus.” You did not submit on time and still got a bonus. Was the promise broken?',
    ['No: the promise says nothing when the condition fails', 'Yes: the bonus depended only on submitting', 'Yes: the implication is false when p is false', 'It cannot be decided'], 0,
    ['', 'The promise never said the bonus is given only for submitting.', 'With p false the implication is true, whatever q is.', 'It can be decided: p → q is true whenever p is false.']),
  q('implication', 3, 'Apply', 'Which formula is equivalent to ¬(p → q)?',
    ['p ∧ ¬q', '¬p ∧ q', '¬p ∨ q', '¬p → ¬q'], 0,
    ['', 'Check p = T, q = F: ¬(p → q) is T but ¬p ∧ q is F.', 'That is p → q itself, so it has the opposite value in every row.', 'Check p = T, q = T: ¬(p → q) is F but ¬p → ¬q is T.'], '¬(p → q)'),

  // biconditional
  q('biconditional', 1, 'Remember', 'How is p ↔ q read?',
    ['p if and only if q', 'p implies q', 'p or q', 'not p and not q'], 0,
    ['', 'That is only one direction, p → q.', '“or” is ∨; ↔ is a different connective.', 'That is ¬p ∧ ¬q, which is true in only one row.']),
  q('biconditional', 2, 'Understand', 'Why is p ↔ q true when p and q are both false?',
    ['The two sides agree, and ↔ only asks that they agree', '↔ needs at least one true side', '↔ is true only when both sides are true', 'A false p makes every compound false'], 0,
    ['', 'p = F, q = F has no true side, and ↔ is still true.', 'p ↔ q is also true when both are false.', 'A false p does not make every compound false: ¬p is true.']),
  q('biconditional', 3, 'Apply', 'p = T, q = F. What is (p ↔ q) ∨ (p → q)?',
    ['T', 'F'], 1,
    ['p ↔ q is F (the values differ) and p → q is F (T then F), so the ∨ is F.', '']),

  // truthTables
  q('truthTables', 1, 'Remember', 'A formula that is false in every row of its truth table is called…',
    ['a contradiction', 'a tautology', 'a contingency', 'an equivalence'], 0,
    ['', 'A tautology is true in every row.', 'A contingency is true in some rows and false in others.', 'Equivalence compares two formulas, not one.']),
  q('truthTables', 2, 'Understand', 'What does one row of a truth table represent?',
    ['One assignment of true or false to every variable', 'One connective of the formula', 'One subformula', 'One step of a proof'], 0,
    ['', 'Connectives appear as columns, not rows.', 'Subformulas appear as columns, not rows.', 'A truth table lists cases; it is not a proof with steps.']),
  q('truthTables', 3, 'Apply', 'How many rows of the truth table of p ∨ q are true?',
    ['1', '2', '3', '4'], 2,
    ['Only one row is false (p = F, q = F), not only one true.', 'Count again: only p = F, q = F is false.', '', 'The row p = F, q = F is false.']),

  // expressions
  q('expressions', 1, 'Remember', 'Which of these is a well-formed formula?',
    ['(p ∧ q) → r', 'p ∧ → q', '(p ∨ q', '¬ ∧ p'], 0,
    ['', 'Two connectives in a row, ∧ and →, with nothing between them.', 'The parenthesis is never closed.', '∧ needs a formula on its left as well.']),
  q('expressions', 2, 'Remember', 'In a translation key such as “p: it is raining”, what is p?',
    ['A propositional variable standing for a statement', 'A connective', 'A truth value', 'A tautology'], 0,
    ['', 'Connectives are symbols such as ∧ and ∨; p stands for a statement.', 'A truth value is T or F; p stands for a statement that has one.', 'A tautology is a formula that is always true; p can be false.']),
  q('expressions', 3, 'Apply', 'p = F, q = T, r = F. What is (p → q) ∧ (q → r)?',
    ['T', 'F'], 1,
    ['q → r is T then F, which is F, so the ∧ is F.', '']),

  // equivalence
  q('equivalence', 1, 'Understand', 'To show that two formulas are NOT equivalent, what is enough?',
    ['One row of the truth table where their values differ', 'Showing they use different connectives', 'Showing both are true in some row', 'Showing one of them is a tautology'], 0,
    ['', 'Different connectives do not rule out equivalence: p → q ≡ ¬p ∨ q.', 'p ∧ q and p ∨ q are both true at p = T, q = T, yet they are not equivalent.', 'Equivalent formulas need not be tautologies: p ∧ q ≡ q ∧ p.']),
  q('equivalence', 2, 'Analyze', 'A student argues: “p → q and q → p are equivalent because both use p and q.” Where does the argument fail?',
    ['Sharing variables does not make formulas agree on every row: at p = F, q = T the first is T and the second is F', 'It does not fail: they are equivalent', 'They are equivalent, but the proof needs more steps', '→ cannot appear in an equivalence'], 0,
    ['', 'They are not equivalent: the row p = F, q = T separates them.', 'No proof exists: the row p = F, q = T gives different values.', '→ can appear in equivalences, for example p → q ≡ ¬p ∨ q.']),

  // deMorgan
  q('deMorgan', 1, 'Understand', 'Which sentence best explains why ¬(p ∧ q) becomes ¬p ∨ ¬q?',
    ['To break “both”, it is enough for at least one part to fail', 'To break “both”, every part must fail', 'Negation turns ∧ into ∧', 'Negation removes the connective'], 0,
    ['', 'That would be ¬p ∧ ¬q, which is too strong: one failure is enough.', 'The connective changes: ∧ becomes ∨.', 'The connective stays, in its dual form.']),
  q('deMorgan', 2, 'Analyze', 'A student rewrites ¬(p ∨ ¬q) as ¬p ∨ q. Which is the correct rewrite?',
    ['¬p ∧ q', '¬p ∨ q', 'p ∧ ¬q', 'p ∨ ¬q'], 0,
    ['', 'Negating ∨ gives ∧: check p = F, q = F.', 'Check p = T, q = F: the original is F but p ∧ ¬q is T.', 'That is the formula inside the negation, so it has the opposite value in every row.'], '¬(p ∨ ¬q)'),
  q('deMorgan', 3, 'Analyze', 'A derivation reads: ¬(p ∧ ¬q) ≡ ¬p ∧ ¬¬q ≡ ¬p ∧ q. Which is the first incorrect step?',
    ['The first step: ∧ should have become ∨', 'The second step: ¬¬q is not q', 'None: both steps are correct'], 0,
    ['', '¬¬q ≡ q by double negation, so the second step is fine.', 'The first step is wrong: at p = T, q = T, ¬(p ∧ ¬q) is T but ¬p ∧ q is F.']),

  // equivLaws
  q('equivLaws', 1, 'Understand', 'What does the identity law p ∧ T ≡ p say in words?',
    ['Joining a statement with something always true leaves its value unchanged', 'Joining with a true statement makes the result true', 'A statement and its negation are equivalent', 'p ∧ T is always false'], 0,
    ['', 'If p is false, p ∧ T is false, so the result is not always true.', 'A statement and its negation always differ in value.', 'If p is true, p ∧ T is true, so it is not always false.']),
  q('equivLaws', 2, 'Apply', 'Which formula is equivalent to p ∨ (q ∧ r)?',
    ['(p ∨ q) ∧ (p ∨ r)', '(p ∨ q) ∧ r', '(p ∧ q) ∨ (p ∧ r)', 'p ∨ q ∨ r'], 0,
    ['', 'Check p = T, q = F, r = F: p ∨ (q ∧ r) is T but (p ∨ q) ∧ r is F.', 'That is p ∧ (q ∨ r): check p = F, q = T, r = T.', 'Check p = F, q = T, r = F: p ∨ (q ∧ r) is F but p ∨ q ∨ r is T.'], 'p ∨ (q ∧ r)'),
  q('equivLaws', 3, 'Analyze', 'A student simplifies (p ∧ q) ∨ (p ∧ ¬q) to q. Which simplification is actually correct?',
    ['p', 'q', 'p ∧ q', 'p ∨ ¬p'], 0,
    ['', 'Check p = T, q = F: the expression is T but q is F.', 'Check p = T, q = F: the expression is T but p ∧ q is F.', 'Check p = F: the expression is F but p ∨ ¬p is always T.'], '(p ∧ q) ∨ (p ∧ ¬q)'),

  // applications
  q('applications', 1, 'Analyze', 'Rule: “If the sensor reads high, the pump stops.” The pump stopped, and a technician concludes the sensor read high. What is wrong with this reasoning?',
    ['It affirms the consequent: the pump could stop for another reason', 'Nothing is wrong with it', 'It denies the antecedent', 'The rule is a biconditional'], 0,
    ['', 'The conclusion does not follow: the rule is a one-way implication.', 'Denying the antecedent would start from “the sensor did not read high”.', 'The rule says “if”, not “if and only if”.']),
  q('applications', 2, 'Evaluate', 'Rule: “Posts with links are removed.” Spam without links is also removed. Which formulation (l: has a link, r: removed) is sound?',
    ['l → r: a post can be removed without a link', 'l ↔ r: every removal must involve a link', 'Both are equally sound', 'Neither can model removals'], 0,
    ['', 'l ↔ r would forbid removing a post with no link, which the spam case shows happens.', 'They differ at l = F, r = T, which occurs here, so they are not equally sound.', 'An implication models a one-way rule well.']),
  q('applications', 3, 'Evaluate', 'Requirement: “sound the alarm if smoke or heat is detected”. Which specification is sound?',
    ['(smoke ∨ heat) → alarm: either one triggers it', '(smoke ∧ heat) → alarm: it needs both', 'Both: they agree on every case', 'Neither: an implication cannot state a requirement'], 0,
    ['', 'Requiring both is too weak: with smoke only, that specification demands no alarm.', 'Check smoke = T, heat = F: the first requires the alarm, the second does not.', '“If … then” is the usual form of a requirement.']),
];
