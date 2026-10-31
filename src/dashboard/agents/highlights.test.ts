import { describe, expect, it } from 'vitest';
import { TOKEN_MS, activeHighlights, latestReceived, revealedMastery } from './highlights';
import { EXCHANGES } from '../../scenario/agents';
import { MASTERY_INITIAL } from '../../scenario/minhAnh';

const T = [1500, 6500, 11500, 16000];

describe('agent highlights', () => {
  it('lights the refs of the card currently in play', () => {
    expect(activeHighlights(EXCHANGES, T, 1000)).toEqual({ kg: [], twin: [] });
    const h = activeHighlights(EXCHANGES, T, 2500);
    expect(h.kg).toEqual(['implication']);
    expect(h.twin).toEqual(['mastery.implication']);
    expect(activeHighlights(EXCHANGES, T, 12500).kg).toEqual(['conjunction', 'disjunction']);
  });
  it('accumulates revealed mastery from kg and twin.mastery refs', () => {
    expect(revealedMastery(EXCHANGES, T, 1000, MASTERY_INITIAL)).toEqual({});
    expect(revealedMastery(EXCHANGES, T, 12500, MASTERY_INITIAL)).toEqual({ implication: 0.31, conjunction: 0.8, disjunction: 0.78 });
    expect(revealedMastery(EXCHANGES, T, 20000, MASTERY_INITIAL).equivalence).toBe(0.35);
  });
  it('returns the latest card that has arrived at an agent', () => {
    expect(latestReceived(EXCHANGES, T, 'TAS', 1500 + TOKEN_MS - 1)).toBeNull();
    expect(latestReceived(EXCHANGES, T, 'TAS', 1500 + TOKEN_MS)?.card.id).toBe('x1');
    expect(latestReceived(EXCHANGES, T, 'TAS', 13000)?.card.id).toBe('x3');
    expect(latestReceived(EXCHANGES, T, 'SAS', 18000)?.card.id).toBe('x4');
  });
});
