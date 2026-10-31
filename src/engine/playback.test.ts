import { describe, expect, it } from 'vitest';
import {
  applyCommand, countdown, formatTime, initialState, isDone, isSlate, localTime, stateFromSearch, togglePlay,
} from './playback';

const DUR = 10000;
const started = (now = 0) => applyCommand(initialState(1), { type: 'start', scene: 1, preroll: false }, now);

describe('playback', () => {
  it('start applies pre-roll and counts down', () => {
    const s = applyCommand(initialState(), { type: 'start', scene: 5 }, 1000);
    expect(s.scene).toBe(5);
    expect(countdown(s, 1000)).toBe(3);
    expect(localTime(s, 1000, DUR)).toBe(0);
    expect(countdown(s, 4000)).toBe(0);
  });
  it('holds the first frame for the handle, then advances and clamps', () => {
    const s = started();
    expect(localTime(s, 500, DUR)).toBe(0);
    expect(localTime(s, 3000, DUR)).toBe(2000);
    expect(localTime(s, 99999, DUR)).toBe(DUR);
  });
  it('shows the slate only in the first SLATE_MS', () => {
    const s = started();
    expect(isSlate(s, 50)).toBe(true);
    expect(isSlate(s, 150)).toBe(false);
  });
  it('is done after duration plus both handles', () => {
    const s = started();
    expect(isDone(s, DUR + 1999, DUR)).toBe(false);
    expect(isDone(s, DUR + 2000, DUR)).toBe(true);
  });
  it('pause then play resumes at the same time', () => {
    let s = applyCommand(started(), { type: 'pause' }, 4000);
    expect(localTime(s, 99999, DUR)).toBe(3000);
    s = applyCommand(s, { type: 'play' }, 20000);
    expect(localTime(s, 20000, DUR)).toBe(3000);
    expect(localTime(s, 21000, DUR)).toBe(4000);
  });
  it('seek gives the same frame whether playing or paused', () => {
    const playing = applyCommand(started(), { type: 'seek', t: 6000 }, 5000);
    const paused = applyCommand(initialState(1), { type: 'seek', t: 6000 }, 5000);
    expect(localTime(playing, 5000, DUR)).toBe(6000);
    expect(localTime(paused, 5000, DUR)).toBe(6000);
  });
  it('select stops at frame 0 of the new scene', () => {
    const s = applyCommand(started(), { type: 'select', scene: 4 }, 7000);
    expect(s.scene).toBe(4);
    expect(s.playing).toBe(false);
    expect(localTime(s, 9000, DUR)).toBe(0);
  });
  it('toggle flips one flag', () => {
    const s = applyCommand(initialState(), { type: 'toggle', key: 'tc' }, 0);
    expect(s.toggles.tc).toBe(true);
    expect(s.toggles.titles).toBe(true);
  });
  it('togglePlay starts with pre-roll at frame 0, resumes mid-scene, pauses when playing', () => {
    expect(togglePlay(initialState(2))).toEqual({ type: 'start', scene: 2 });
    const mid = applyCommand(initialState(2), { type: 'seek', t: 3000 }, 0);
    expect(togglePlay(mid)).toEqual({ type: 'play' });
    expect(togglePlay(started())).toEqual({ type: 'pause' });
  });
  it('stateFromSearch holds a frame with toggles', () => {
    const s = stateFromSearch('?scene=9&t=6000&titles=0&chapter=0&tc=1', 0, 3);
    expect(s.scene).toBe(9);
    expect(s.playing).toBe(false);
    expect(localTime(s, 0, 20000)).toBe(6000);
    expect(s.toggles).toEqual({ titles: false, footer: true, cursor: true, chapter: false, tc: true });
  });
  it('stateFromSearch autoplay starts immediately without pre-roll', () => {
    const s = stateFromSearch('?scene=9&autoplay', 1000, 3);
    expect(s.playing).toBe(true);
    expect(localTime(s, 3000, 20000)).toBe(1000);
  });
  it('stateFromSearch falls back to the given scene', () => {
    expect(stateFromSearch('', 0, 3).scene).toBe(3);
  });
  it('formatTime renders mm:ss.t', () => {
    expect(formatTime(6200)).toBe('00:06.2');
    expect(formatTime(59999)).toBe('00:59.9');
    expect(formatTime(210000)).toBe('03:30.0');
  });
});
