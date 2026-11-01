import { cloOf, type Bloom } from './course';
import type { ConceptId } from './knowledgeGraph';
import type { BankItem } from './practiceBank';

const q = (
  concept: ConceptId, n: number, bloom: Bloom, prompt: string, options: string[], correct: number, hints: string[], equivTo?: string,
): BankItem => ({ id: `${concept}-x${n}`, concept, clo: cloOf(concept).id, bloom, core: false, prompt, options, correct, hints, equivTo });

/**
 * The 35 added questions: with the 37 originals, every concept has exactly 2 per Bloom level of its CLO.
 * Answer positions are spread on purpose, and a hint points to the check rather than stating its result.
 */
export const EXTRA_ITEMS: BankItem[] = [
  // propositions
  q('propositions', 1, 'Remember', 'What is a proposition?',
    ['Any sentence that ends with a full stop or a question mark', 'A sentence that is either true or false, but not both', 'A sentence containing at least one variable symbol', 'A statement that is true in every possible case'], 1,
    ['A question or a command can end that way and still not be true or false.', '', 'A sentence with an unassigned variable has no fixed truth value.', 'That describes a tautology: a proposition may be false.']),
  q('propositions', 2, 'Understand', 'Why is “x > 3” not a proposition until x is given a value?',
    ['It contains a number, and propositions cannot involve numbers', 'It is phrased as a question rather than as a statement', 'Its truth depends on x, so as written it is not true or false', 'It is false for every value that x could take'], 2,
    ['Many propositions contain numbers, such as “7 is prime”.', 'It is written as a statement, not a question.', '', 'It is true for x = 5, so it is not false for every value.']),
  q('propositions', 3, 'Apply', 'p: “The server is up”, q: “The backup is running”. Which sentence is ¬p ∨ q?',
    ['The server is up or the backup is not running.', 'The server is down and the backup is running.', 'The server is down and the backup is not running.', 'The server is down or the backup is running.'], 3,
    ['That is p ∨ ¬q: the negations are on the wrong parts.', '“and” is ∧; ¬p ∨ q needs only one of the two parts to hold.', 'That is ¬p ∧ ¬q: both parts negated and joined by “and”.', '']),

  // negation
  q('negation', 1, 'Remember', 'The symbol ¬ is read as…',
    ['and', 'or', 'not', 'if … then'], 2,
    ['∧ is the symbol for “and”.', '∨ is the symbol for “or”.', '', '→ is the symbol for “if … then”.']),
  q('negation', 2, 'Understand', 'Why is ¬p true exactly when p is false?',
    ['Negation makes every statement it touches false, whatever its value', 'Negation makes every statement it touches true, whatever its value', 'Negation can only be applied to statements that are true', 'Negation reverses the truth value of what it applies to'], 3,
    ['If p is false, ¬p is true, so it is not always false.', 'If p is true, ¬p is false, so it is not always true.', 'Negation applies to any statement, true or false.', '']),
  q('negation', 3, 'Remember', 'What is the name of the law ¬¬p ≡ p?',
    ['Double negation', 'De Morgan’s law', 'The absorption law', 'The idempotent law'], 0,
    ['', 'De Morgan’s laws describe negating ∧ and ∨, not a repeated ¬.', 'Absorption is p ∨ (p ∧ q) ≡ p, which has no negation.', 'Idempotence is p ∧ p ≡ p, which has no negation.']),

  // conjunction
  q('conjunction', 1, 'Remember', 'Which symbol means “and” in propositional logic?',
    ['∨', '∧', '¬', '→'], 1,
    ['∨ means “or”.', '', '¬ means “not”.', '→ means “if … then”.']),
  q('conjunction', 2, 'Understand', 'Why is p ∧ q false when p is false and q is true?',
    ['A conjunction is true as soon as one of its parts is true', 'A true q is enough to make the whole conjunction true', 'The order of p and q matters, and here q comes second', 'A conjunction needs both parts true, and p is not'], 3,
    ['That describes ∨, not ∧.', 'Test q = T together with p = F in the definition of ∧.', 'Conjunction is commutative: q ∧ p has the same value.', '']),
  q('conjunction', 3, 'Understand', 'Which statement about p ∧ q is correct?',
    ['It is true whenever p is true', 'It is false only when both parts are false', 'It has the same value as q ∧ p', 'It has the same value as p ∨ q'], 2,
    ['If p is true and q is false, p ∧ q is false.', 'It is false whenever at least one part is false.', '', 'Check p = T, q = F: p ∧ q is F but p ∨ q is T.']),

  // disjunction
  q('disjunction', 1, 'Remember', 'Which connective is true when at least one of its parts is true?',
    ['Disjunction (∨)', 'Conjunction (∧)', 'Biconditional (↔)', 'Negation (¬)'], 0,
    ['', '∧ needs both parts to be true.', 'Check p = T, q = F: one part is true, yet p ↔ q is false.', '¬ has only one part, and it reverses the value.']),
  q('disjunction', 2, 'Understand', 'p ∨ q is true when both parts are true. How does this differ from an everyday “either … or”?',
    ['There is no difference between the two readings', 'Everyday “either … or” often excludes both; ∨ does not', '∨ is the exclusive kind: exactly one part must be true', '∨ is false whenever p is true'], 1,
    ['Compare the row p = T, q = T under each reading.', '', 'The stem says p ∨ q is true when both parts are true: does an exclusive reading allow that?', 'Check p = T, q = F: is p ∨ q true there?']),
  q('disjunction', 3, 'Apply', 'Which formula is equivalent to p ∨ q?',
    ['¬p ∨ ¬q', '¬(¬p ∨ ¬q)', '¬(¬p ∧ ¬q)', '¬p → ¬q'], 2,
    ['Check p = T, q = T: p ∨ q is T but ¬p ∨ ¬q is F.', 'Check p = T, q = F: p ∨ q is T but this formula is F.', '', 'Check p = F, q = T: p ∨ q is T but ¬p → ¬q is F.'], 'p ∨ q'),

  // implication
  q('implication', 1, 'Understand', 'How does the converse q → p differ from p → q?',
    ['It negates both parts instead of swapping them', 'It is true exactly in the rows where p → q is false', 'It swaps the parts, so the claim runs the other way', 'It replaces the arrow with a conjunction of the parts'], 2,
    ['That describes the inverse ¬p → ¬q, not the converse.', 'Check p = F, q = F: both p → q and q → p are true.', '', 'The converse still uses →; only the sides are exchanged.']),
  q('implication', 2, 'Understand', '“If you submit on time, you get a bonus.” You did not submit on time and still got a bonus. Was the promise broken?',
    ['No: the promise says nothing when the condition fails', 'Yes: the bonus was meant to depend only on submitting', 'Yes: an implication is false whenever its condition is false', 'It cannot be decided from the information given'], 0,
    ['', 'The promise never said the bonus is given only for submitting.', 'Test the row where p is false in the truth table of p → q.', 'Every row of p → q has a definite value: look at the row p = F, q = T.']),
  q('implication', 3, 'Apply', 'Which formula is equivalent to ¬(p → q)?',
    ['¬p ∧ q', 'p ∧ ¬q', '¬p ∨ q', '¬p → ¬q'], 1,
    ['Check p = T, q = F: ¬(p → q) is T but ¬p ∧ q is F.', '', 'That is p → q itself, so it has the opposite value in every row.', 'Check p = T, q = T: ¬(p → q) is F but ¬p → ¬q is T.'], '¬(p → q)'),

  // biconditional
  q('biconditional', 1, 'Remember', 'How is p ↔ q read?',
    ['p implies q in one direction only', 'p or q, or both of them', 'p if and only if q', 'not p and not q together'], 2,
    ['That is only one direction, p → q.', '“or” is ∨; ↔ is a different connective.', '', 'That is ¬p ∧ ¬q, which is true in only one row.']),
  q('biconditional', 2, 'Understand', 'Why is p ↔ q true when p and q are both false?',
    ['↔ is only true when at least one of its sides is true', '↔ is only true when both of its sides are true', 'A false p makes every compound formula false', 'The two sides agree, and agreement is all ↔ asks for'], 3,
    ['The row p = F, q = F has no true side, and the stem says ↔ is still true.', 'The stem says ↔ is true with both sides false, so both cannot be required true.', 'A false p does not make every compound false: ¬p is true.', '']),
  q('biconditional', 3, 'Apply', 'p = T, q = F. What is (p ↔ q) ∨ (p → q)?',
    ['T', 'F'], 1,
    ['Evaluate each bracket separately at p = T, q = F, then combine the two with ∨.', '']),

  // truthTables
  q('truthTables', 1, 'Remember', 'A formula that is false in every row of its truth table is called…',
    ['a contradiction', 'a tautology', 'a contingency', 'a logical equivalence'], 0,
    ['', 'A tautology is true in every row.', 'A contingency is true in some rows and false in others.', 'Equivalence compares two formulas, not one.']),
  q('truthTables', 2, 'Understand', 'What does one row of a truth table represent?',
    ['One connective of the formula, such as ∧ or ∨', 'One assignment of true or false to each variable', 'One subformula of the formula, with its own value', 'One step of a proof that the formula holds'], 1,
    ['Connectives are symbols in the formula; a row lists truth values.', '', 'Subformulas appear as columns, not rows.', 'A truth table lists cases; it is not a proof with steps.']),
  q('truthTables', 3, 'Understand', 'Why does the truth table of p ∨ q have exactly one false row?',
    ['It is false whenever p is false, and p is false in only one row', 'It is false whenever one part is false, and that is only one row', 'It is false only if both parts are false: one assignment', 'It is false only when both parts are true, which is one assignment'], 2,
    ['Count the rows in which p is false: p is paired with each value of q.', 'Check p = T, q = F: one part is false, so what does ∨ give there?', '', 'Check p = T, q = T: what does ∨ give there?']),

  // expressions
  q('expressions', 1, 'Remember', 'Which of these is a well-formed formula?',
    ['p ∧ → (q ∨ r)', '((p ∨ q) ∧ r', '¬ ∧ (p → q)', '(p ∧ q) → r'], 3,
    ['Two connectives in a row, ∧ and →, with nothing between them.', 'Count the opening and closing parentheses: they do not match.', 'The ¬ has nothing to negate before the ∧, and the ∧ has nothing on its left.', '']),
  q('expressions', 2, 'Remember', 'In a translation key such as “p: it is raining”, what is p?',
    ['A propositional variable standing for a statement', 'A connective, a symbol such as ∧ that joins formulas', 'A truth value, which is T or F and nothing else', 'A tautology, a formula that is true in every row'], 0,
    ['', 'Connectives are symbols such as ∧ and ∨; p stands for a statement.', 'A truth value is T or F; p stands for a statement that has one.', 'A tautology is a formula that is always true; p can be false.']),
  q('expressions', 3, 'Apply', 'p = F, q = T, r = F. What is (p → q) ∧ (q → r)?',
    ['T', 'F'], 1,
    ['Evaluate each bracket at the given row first, then combine them with ∧.', '']),

  // equivalence
  q('equivalence', 1, 'Understand', 'To show that two formulas are NOT equivalent, what is enough?',
    ['Showing they are written with different connectives', 'Showing both are true in at least one row of the table', 'One row of the truth table where their values differ', 'Showing that one of them is a tautology on its own'], 2,
    ['Different connectives do not rule out equivalence: p → q ≡ ¬p ∨ q.', 'p ∧ q and q ∧ p are both true at p = T, q = T, yet they are equivalent.', '', 'p ∨ ¬p and q ∨ ¬q are both tautologies, yet they are equivalent.']),
  q('equivalence', 2, 'Analyze', 'A student argues: “p → q and q → p are equivalent because both use p and q.” Where does the argument fail?',
    ['It does not fail: the two formulas really are equivalent', 'Sharing variables is not enough: at p = F, q = T they differ', 'They are equivalent, but the argument needs more steps to show it', '→ cannot appear in a pair of equivalent formulas'], 1,
    ['Compare the two formulas on the rows where p and q have different values.', '', 'Evaluate both formulas on each row: do they ever disagree?', '→ can appear in equivalences, for example p → q ≡ ¬p ∨ q.']),

  // deMorgan
  q('deMorgan', 1, 'Understand', 'Which sentence best explains why ¬(p ∧ q) becomes ¬p ∨ ¬q?',
    ['To break “both”, every single part must fail', 'Negation turns ∧ into ∧ again', 'Negation removes the connective entirely', 'To break “both”, it is enough for one part to fail'], 3,
    ['Check p = T, q = F: is ¬(p ∧ q) true there, and is ¬p ∧ ¬q?', 'The result ¬p ∨ ¬q has a different connective from the original ∧.', 'The result ¬p ∨ ¬q still has a connective.', '']),
  q('deMorgan', 2, 'Analyze', 'A student rewrites ¬(p ∨ ¬q) as ¬p ∨ q. In which rows of the truth table do the two formulas have different values?',
    ['p = T, q = T and p = F, q = F', 'p = T, q = F and p = F, q = T', 'Only p = T, q = T', 'None: the rewrite is correct'], 0,
    ['', 'Evaluate both formulas at p = T, q = F: do they differ there?', 'Only checking one row is not enough: evaluate all four rows.', 'Evaluate both formulas at p = T, q = T.']),
  q('deMorgan', 3, 'Analyze', 'A derivation reads: ¬(p ∧ ¬q) ≡ ¬p ∧ ¬¬q ≡ ¬p ∧ q. Which is the first incorrect step?',
    ['The second step: ¬¬q is not equivalent to q', 'The first step: ∧ should have become ∨', 'None: both steps are correct'], 1,
    ['Test ¬¬q against q on their own, at q = T and at q = F.', '', 'Test the first step at p = T, q = T.']),

  // equivLaws
  q('equivLaws', 1, 'Understand', 'What does the identity law p ∧ T ≡ p say in words?',
    ['Joining with a true statement always makes the whole result true', 'Joining p with something always true leaves p unchanged', 'A statement and its negation are equivalent to each other', 'p ∧ T is false whatever the value of p happens to be'], 1,
    ['If p is false, p ∧ T is false, so the result is not always true.', '', 'A statement and its negation always differ in value.', 'If p is true, p ∧ T is true, so it is not always false.']),
  q('equivLaws', 2, 'Analyze', 'A student claims p ∨ (q ∧ r) ≡ (p ∨ q) ∧ r. Which row shows that the two formulas are NOT equivalent?',
    ['p = T, q = T, r = T', 'p = F, q = T, r = T', 'p = T, q = F, r = F', 'p = F, q = T, r = F'], 2,
    ['Both formulas are true at p = T, q = T, r = T, so it cannot separate them.', 'Both formulas are true at p = F, q = T, r = T, so it cannot separate them.', '', 'Both formulas are false at p = F, q = T, r = F, so it cannot separate them.']),
  q('equivLaws', 3, 'Analyze', 'A student simplifies (p ∧ q) ∨ (p ∧ ¬q) to q. Which row shows that this is wrong?',
    ['p = T, q = T', 'p = F, q = F', 'None: the simplification is correct', 'p = T, q = F'], 3,
    ['The expression and q are both true at p = T, q = T.', 'The expression and q are both false at p = F, q = F.', 'Test the remaining rows of the table before concluding that nothing is wrong.', '']),

  // applications
  q('applications', 1, 'Analyze', 'Rule: “If the sensor reads high, the pump stops.” The pump stopped, and a technician concludes the sensor read high. What is wrong with this reasoning?',
    ['It affirms the consequent: other causes can stop the pump', 'Nothing is wrong: the rule makes the sensor reading certain', 'It denies the antecedent: the sensor did not read high', 'The rule is a biconditional, so the reasoning is valid'], 0,
    ['', 'The conclusion does not follow: the rule is a one-way implication.', 'Denying the antecedent would start from “the sensor did not read high”.', 'The rule says “if”, not “if and only if”.']),
  q('applications', 2, 'Evaluate', 'Rule: “Posts with links are removed.” Spam without links is also removed. Which formulation (l: has a link, r: removed) is sound?',
    ['l ↔ r: every removal must involve a link', 'Both are equally sound', 'l → r: a post can be removed without a link', 'Neither can model removals'], 2,
    ['l ↔ r would forbid removing a post with no link, which the spam case shows happens.', 'They differ at l = F, r = T, which occurs here, so they are not equally sound.', '', 'An implication models a one-way rule well.']),
  q('applications', 3, 'Evaluate', 'Requirement: “sound the alarm if smoke or heat is detected”. Which specification is sound?',
    ['(smoke ∧ heat) → alarm: it needs both', 'Both: they agree on every case', 'Neither: an implication cannot state a requirement', '(smoke ∨ heat) → alarm: either one triggers it'], 3,
    ['With smoke only, that specification demands no alarm, but the requirement does.', 'Check smoke = T, heat = F: the first requires the alarm, the second does not.', '“If … then” is the usual form of a requirement.', '']),
];
