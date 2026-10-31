import { describe, expect, it } from 'vitest';
import { CONCEPTS } from './knowledgeGraph';
import { Q1 } from './practice';
import { BANK, BANK_CONCEPTS, itemsFor, sessionItems } from './practiceBank';

describe('practice bank', () => {
  it('covers all 12 concepts with at least 3 items each', () => {
    expect(BANK_CONCEPTS.sort()).toEqual(CONCEPTS.map((c) => c.id).sort());
    for (const c of CONCEPTS) expect(itemsFor(c.id).length, c.id).toBeGreaterThanOrEqual(3);
  });
  it('has unique ids and one hint per wrong option', () => {
    expect(new Set(BANK.map((i) => i.id)).size).toBe(BANK.length);
    for (const item of BANK) {
      expect(item.hints, item.id).toHaveLength(item.options.length);
      expect(item.correct >= 0 && item.correct < item.options.length, item.id).toBe(true);
      item.hints.forEach((h, i) => expect(i === item.correct ? h === '' : h.length > 10, `${item.id} hint ${i}`).toBe(true));
    }
  });
  it('reuses the video item (converse mistake) as implication-1', () => {
    const first = itemsFor('implication')[0];
    expect(first.id).toBe('implication-1');
    expect(first.prompt).toBe(Q1.prompt);
    expect(first.hints[Q1.chosenWrong]).toBe(Q1.hint);
    expect(first.guided?.steps.at(-1)?.expr).toBe('p ∧ ¬q');
  });
  it('sizes sessions: practice takes 2 items, the mastery check takes the last 3', () => {
    expect(sessionItems('equivalence', false).map((i) => i.id)).toEqual(['equivalence-1', 'equivalence-2']);
    expect(sessionItems('equivalence', true).map((i) => i.id)).toEqual(['equivalence-2', 'equivalence-3', 'equivalence-4']);
  });
});
