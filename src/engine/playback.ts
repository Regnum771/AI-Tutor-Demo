import { clamp } from './anim';

export const HANDLE_MS = 1000;
export const PREROLL_MS = 3000;
export const SLATE_MS = 100;

export interface Toggles {
  titles: boolean;
  footer: boolean;
  cursor: boolean;
  chapter: boolean;
  tc: boolean;
}

export const DEFAULT_TOGGLES: Toggles = { titles: true, footer: true, cursor: true, chapter: true, tc: false };

/**
 * Raw time runs from the start of the leading handle: raw 0..HANDLE_MS holds frame 0,
 * then scene time advances for durationMs, then the last frame holds for HANDLE_MS.
 */
export interface PlaybackState {
  scene: number;
  playing: boolean;
  /** Epoch ms at which raw time is 0 (only meaningful while playing). */
  startedAt: number;
  /** Raw time held while paused. */
  pausedAt: number;
  toggles: Toggles;
}

export type Command =
  | { type: 'start'; scene: number; preroll?: boolean }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; t: number }
  | { type: 'select'; scene: number }
  | { type: 'toggle'; key: keyof Toggles };

export const initialState = (scene = 3): PlaybackState => ({
  scene,
  playing: false,
  startedAt: 0,
  pausedAt: HANDLE_MS,
  toggles: { ...DEFAULT_TOGGLES },
});

export const rawTime = (s: PlaybackState, now: number): number => (s.playing ? now - s.startedAt : s.pausedAt);

export const localTime = (s: PlaybackState, now: number, durationMs: number): number =>
  clamp(rawTime(s, now) - HANDLE_MS, 0, durationMs);

export const isSlate = (s: PlaybackState, now: number): boolean => {
  const r = rawTime(s, now);
  return s.playing && r >= 0 && r < SLATE_MS;
};

/** Seconds left in the pre-roll (0 when not counting down). */
export const countdown = (s: PlaybackState, now: number): number => {
  const r = rawTime(s, now);
  return s.playing && r < 0 ? Math.ceil(-r / 1000) : 0;
};

export const isDone = (s: PlaybackState, now: number, durationMs: number): boolean =>
  rawTime(s, now) >= durationMs + 2 * HANDLE_MS;

export function applyCommand(s: PlaybackState, cmd: Command, now: number): PlaybackState {
  switch (cmd.type) {
    case 'start':
      return { ...s, scene: cmd.scene, playing: true, pausedAt: 0, startedAt: now + (cmd.preroll === false ? 0 : PREROLL_MS) };
    case 'play':
      return s.playing ? s : { ...s, playing: true, startedAt: now - s.pausedAt };
    case 'pause':
      return s.playing ? { ...s, playing: false, pausedAt: Math.max(0, now - s.startedAt) } : s;
    case 'seek': {
      const raw = cmd.t + HANDLE_MS;
      return s.playing ? { ...s, startedAt: now - raw } : { ...s, pausedAt: raw };
    }
    case 'select':
      return { ...s, scene: cmd.scene, playing: false, pausedAt: HANDLE_MS };
    case 'toggle':
      return { ...s, toggles: { ...s.toggles, [cmd.key]: !s.toggles[cmd.key] } };
  }
}

/** Space-bar behaviour: pause if playing; start with pre-roll from frame 0; otherwise resume. */
export function togglePlay(s: PlaybackState): Command {
  if (s.playing) return { type: 'pause' };
  return s.pausedAt <= HANDLE_MS ? { type: 'start', scene: s.scene } : { type: 'play' };
}

/** Standalone mode: ?scene=9&t=6000 holds a frame; &autoplay plays; titles=0 footer=0 cursor=0 chapter=0 tc=1. */
export function stateFromSearch(search: string, now: number, fallbackScene: number): PlaybackState {
  const q = new URLSearchParams(search);
  const scene = Number(q.get('scene') ?? fallbackScene);
  const t = Number(q.get('t') ?? 0);
  const toggles: Toggles = {
    titles: q.get('titles') !== '0',
    footer: q.get('footer') !== '0',
    cursor: q.get('cursor') !== '0',
    chapter: q.get('chapter') !== '0',
    tc: q.get('tc') === '1',
  };
  const base: PlaybackState = { ...initialState(scene), toggles };
  return q.has('autoplay')
    ? applyCommand(base, { type: 'start', scene, preroll: false }, now)
    : applyCommand(base, { type: 'seek', t }, now);
}

export function formatTime(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
