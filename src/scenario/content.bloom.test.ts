import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { CLOS, cloOf } from './course';
import { CONCEPTS } from './knowledgeGraph';
import { evalFormula, sameTruth } from './logic';
import { BANK, sessionItems } from './practiceBank';

describe('formula checker', () => {
  it('evaluates and compares formulas', () => {
    expect(evalFormula('p → q', { p: true, q: false })).toBe(false);
    expect(sameTruth('p → q', '¬p ∨ q')).toBe(true);
    expect(sameTruth('p → q', 'q → p')).toBe(false);
    expect(sameTruth('¬(p ∧ q)', '¬p ∨ ¬q')).toBe(true);
    expect(() => evalFormula('Yes', { p: true })).toThrow();
  });
});

describe('question bank', () => {
  it('has exactly 2 questions per Bloom level of each concept’s CLO', () => {
    for (const concept of CONCEPTS) {
      for (const level of cloOf(concept.id).levels) {
        const n = BANK.filter((i) => i.concept === concept.id && i.bloom === level).length;
        expect(n, `${concept.id} ${level}`).toBe(2);
      }
    }
    expect(BANK).toHaveLength(72);
  });
  it('tags every question with its concept’s CLO, and only its levels', () => {
    for (const i of BANK) {
      expect(i.clo, i.id).toBe(cloOf(i.concept).id);
      expect(cloOf(i.concept).levels, i.id).toContain(i.bloom);
    }
  });
  it('has unique ids and one hint per wrong option', () => {
    expect(new Set(BANK.map((i) => i.id)).size).toBe(BANK.length);
    for (const i of BANK) {
      expect(i.hints, i.id).toHaveLength(i.options.length);
      i.hints.forEach((h, n) => expect(n === i.correct ? h === '' : h.length > 10, `${i.id} hint ${n}`).toBe(true));
    }
  });
  it('checks every stated equivalence by truth table', () => {
    const checked = BANK.filter((i) => i.equivTo);
    expect(checked.length).toBeGreaterThanOrEqual(12);
    for (const i of checked) {
      i.options.forEach((o, n) => expect(sameTruth(i.equivTo!, o), `${i.id} option ${n}: ${o}`).toBe(n === i.correct));
    }
  });
  it('keeps teacher plans on the original 37 questions', () => {
    expect(BANK.filter((i) => i.core)).toHaveLength(37);
    for (const c of CONCEPTS) for (const check of [true, false]) expect(sessionItems(c.id, check).every((i) => i.core), c.id).toBe(true);
  });
});

describe('cards', () => {
  it('has 4 cards per concept at the CLO’s lower two levels', () => {
    for (const concept of CONCEPTS) {
      const cards = CARDS.filter((c) => c.concept === concept.id);
      expect(cards, concept.id).toHaveLength(4);
      for (const c of cards) {
        expect(c.clo).toBe(cloOf(concept.id).id);
        expect(cloOf(concept.id).levels.slice(0, 2), c.id).toContain(c.bloom);
      }
    }
    expect(CARDS).toHaveLength(48);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(48);
  });
  it('every card has a real front and back', () => {
    for (const c of CARDS) {
      expect(c.front.length, c.id).toBeGreaterThan(10);
      expect(c.back.length, c.id).toBeGreaterThan(5);
    }
  });
  it('covers each CLO', () => {
    for (const clo of CLOS) expect(CARDS.some((c) => c.clo === clo.id)).toBe(true);
  });
});
