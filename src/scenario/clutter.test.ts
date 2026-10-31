import { describe, expect, it, vi } from 'vitest';
import { VEIL_Z } from '../teacher/scenes/ProblemScene';
import { APP_HEADER, MESSY_START, POPUPS, QUESTIONS_IN } from './clutter';

const ORDERLY = POPUPS.filter((p) => p.at < MESSY_START);
const MESSY = POPUPS.filter((p) => p.at >= MESSY_START);

describe('Sc1 popups', () => {
  it('pile up: at least 24, every source app, done 3 s before the questions', () => {
    expect(POPUPS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(POPUPS.map((p) => p.kind))).toEqual(new Set(Object.keys(APP_HEADER)));
    expect(Math.max(...POPUPS.map((p) => p.at))).toBeLessThan(QUESTIONS_IN - 3000);
  });

  it('all stack below the veil and the questions', () => {
    expect(10 + POPUPS.length).toBeLessThan(VEIL_Z);
  });

  it('are written in English (no Vietnamese letters)', () => {
    for (const p of POPUPS) expect(`${p.title} ${p.lines.join(' ')}`).not.toMatch(/[À-ỹ]/);
  });

  it('start as an orderly, unrotated, non-overlapping grid', () => {
    expect(ORDERLY).toHaveLength(6);
    for (const [i, a] of ORDERLY.entries()) {
      expect(a.rot).toBe(0);
      for (const b of ORDERLY.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it('then get messy: tilted, faster, never the same app twice in a row', () => {
    expect(MESSY.some((p) => p.rot !== 0)).toBe(true);
    const gaps = MESSY.slice(1).map((p, i) => p.at - MESSY[i].at);
    for (const [i, g] of gaps.entries()) if (i > 0) expect(g).toBeLessThanOrEqual(gaps[i - 1]);
    for (const [i, p] of POPUPS.entries()) if (i > 0) expect(p.kind).not.toBe(POPUPS[i - 1].kind);
  });

  it('is deterministic: a fresh module load gives the same layout', async () => {
    vi.resetModules();
    const again = (await import('./clutter')).POPUPS;
    expect(again).not.toBe(POPUPS);
    expect(again).toEqual(POPUPS);
  });
});
