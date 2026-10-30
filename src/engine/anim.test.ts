import { describe, expect, it } from 'vitest';
import { clamp, countUp, cubic, fade, holdMs, keyframes, prog, pulse, stepIndex, typed } from './anim';

describe('anim', () => {
  it('clamp limits to [0,1] by default', () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-1)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('prog is 0 before the window, 1 after, eased in between', () => {
    expect(prog(0, 100, 500)).toBe(0);
    expect(prog(600, 100, 500)).toBe(1);
    expect(prog(350, 100, 500)).toBeGreaterThan(0.5);
  });
  it('fade fades in, holds, and fades out by end', () => {
    expect(fade(0, 100)).toBe(0);
    expect(fade(1000, 100)).toBe(1);
    expect(fade(1500, 100, 2000)).toBe(1);
    expect(fade(2000, 100, 2000)).toBe(0);
  });
  it('typed reveals characters at cps', () => {
    expect(typed('hello', 0, 0, 10)).toBe('');
    expect(typed('hello', 300, 0, 10)).toBe('hel');
    expect(typed('hello', 5000, 0, 10)).toBe('hello');
  });
  it('countUp interpolates and rounds', () => {
    expect(countUp(0, 55, 0, 100)).toBe(0);
    expect(countUp(0, 55, 5000, 100)).toBe(55);
  });
  it('pulse is 1 at a beat and decays to 0', () => {
    expect(pulse(1000, [1000])).toBe(1);
    expect(pulse(1300, [1000], 600)).toBeCloseTo(0.5);
    expect(pulse(2000, [1000], 600)).toBe(0);
    expect(pulse(10, [])).toBe(0);
  });
  it('holdMs is words/3 seconds, min 2 s', () => {
    expect(holdMs('one two')).toBe(2000);
    expect(holdMs('a b c d e f g h i')).toBe(3000);
  });
  it('stepIndex returns the last started step', () => {
    expect(stepIndex(50, [100, 200])).toBe(-1);
    expect(stepIndex(150, [100, 200])).toBe(0);
    expect(stepIndex(999, [100, 200])).toBe(1);
  });
  it('keyframes interpolates with easing and clamps', () => {
    const k = [{ t: 0, x: 0 }, { t: 1000, x: 100 }];
    expect(keyframes(k, -5).x).toBe(0);
    expect(keyframes(k, 500).x).toBeCloseTo(50);
    expect(keyframes(k, 2000).x).toBe(100);
  });
  it('cubic hits its endpoints', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: 10 }, c = { x: 10, y: 10 }, d = { x: 10, y: 0 };
    expect(cubic(a, b, c, d, 0)).toEqual(a);
    expect(cubic(a, b, c, d, 1)).toEqual(d);
    expect(cubic(a, b, c, d, 0.5).x).toBeCloseTo(5);
  });
});
