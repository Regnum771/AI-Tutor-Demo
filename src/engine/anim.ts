/** Pure animation helpers. Every visual value in the demo is a function of scene time t (ms). */

export const clamp = (x: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const easeOut = (x: number): number => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOut = (x: number): number => {
  const c = clamp(x);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

/** Eased 0→1 progress through the window [start, start + dur]. */
export const prog = (t: number, start: number, dur = 500, ease = easeOut): number => ease((t - start) / dur);

/** Opacity: fades in from `start`; if `end` is given, has faded out completely by `end`. */
export const fade = (t: number, start: number, end = Infinity, dur = 400): number =>
  Math.min(prog(t, start, dur), 1 - prog(t, end - dur, dur));

/** Prefix of `text` revealed at `cps` characters per second from `start`. */
export const typed = (text: string, t: number, start: number, cps = 40): string =>
  text.slice(0, Math.max(0, Math.floor(((t - start) / 1000) * cps)));

export const countUp = (from: number, to: number, t: number, start: number, dur = 1200): number =>
  Math.round(lerp(from, to, prog(t, start, dur)));

/** 1 at each time in `times`, decaying linearly to 0 over `dur`. */
export const pulse = (t: number, times: number[], dur = 600): number =>
  Math.max(0, ...times.map((s) => (t >= s && t < s + dur ? 1 - (t - s) / dur : 0)));

/** Minimum on-screen time for a piece of text: words ÷ 3 seconds, at least 2 s. */
export const holdMs = (text: string): number =>
  Math.max(2000, (text.trim().split(/\s+/).filter(Boolean).length / 3) * 1000);

/** Index of the last entry in ascending `times` that has started by t, or -1. */
export const stepIndex = (t: number, times: number[]): number => {
  let i = -1;
  for (let k = 0; k < times.length; k++) if (t >= times[k]) i = k;
  return i;
};

export type Keyframe<V extends Record<string, number>> = { t: number } & V;

/** Eased interpolation between keyframes sorted by t; clamps outside the range. */
export function keyframes<V extends Record<string, number>>(keys: Keyframe<V>[], t: number): V {
  const pick = (k: Keyframe<V>): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [name, v] of Object.entries(k)) if (name !== 't') out[name] = v as number;
    return out;
  };
  if (t <= keys[0].t) return pick(keys[0]) as V;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (t <= b.t) {
      const p = easeInOut((t - a.t) / (b.t - a.t));
      const va = pick(a);
      const vb = pick(b);
      const out: Record<string, number> = {};
      for (const name of Object.keys(vb)) out[name] = lerp(va[name], vb[name], p);
      return out as V;
    }
  }
  return pick(keys[keys.length - 1]) as V;
}

export interface Point {
  x: number;
  y: number;
}

/** Point at s ∈ [0,1] on the cubic Bézier p0→p3. */
export function cubic(p0: Point, p1: Point, p2: Point, p3: Point, s: number): Point {
  const u = 1 - s;
  return {
    x: u * u * u * p0.x + 3 * u * u * s * p1.x + 3 * u * s * s * p2.x + s * s * s * p3.x,
    y: u * u * u * p0.y + 3 * u * u * s * p1.y + 3 * u * s * s * p2.y + s * s * s * p3.y,
  };
}
