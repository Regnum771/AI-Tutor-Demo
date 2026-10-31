# Beyond AI Tutoring Demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scripted, deterministic surface layer for the 3:30 "Beyond AI Tutoring" video: a 1920×1080 teacher dashboard, a 390×844 student app, and a controller that syncs both through 12 scenes.

**Architecture:** One Vite multi-page project with three entry pages (`dashboard.html`, `student.html`, `controller.html`). The controller owns a pure `PlaybackState` and broadcasts it over `BroadcastChannel`. Each app derives scene time `t` from that state and renders every visual as a pure function of `t`. All demo data lives in `src/scenario/` and is shared by both apps.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Tailwind CSS 3, Vitest 2, Playwright (contact sheet only), `@fontsource` fonts (Manrope, Inter, JetBrains Mono).

**Spec:** `docs/superpowers/specs/2026-10-31-beyond-ai-tutoring-demo-design.md`

## Global Constraints

- All times are **milliseconds of scene time `t`**. Every animated value is a pure function of `t`. Render code must contain **no `Math.random`, no `Date.now()`, and no CSS transitions or animations**. Wall-clock time is read only in `engine/useNow.ts`, `engine/PlaybackProvider.tsx` and the controller.
- **Deviation from the spec:** the spec lists Motion (Framer Motion). It is **not used**, because seek and replay must be frame-identical, and that requires every value to be a function of `t`. The helpers in `engine/anim.ts` replace it.
- Canvases are fixed: dashboard **1920×1080**, student **390×844**. Layout uses absolute canvas coordinates. There are no responsive layouts.
- Scene durations (s): 12, 13, 15, 15, 15, 25, 25, 15, 20, 30, 15, 10, for a total of **210 s**.
- Handles: each scene holds its first and last frame for **1000 ms** (`HANDLE_MS`). The pre-roll is **3000 ms**. The sync slate shows for **100 ms**.
- **Colour tokens (exact):**

  | Token | Hex |
  |---|---|
  | deep / panel / surface / line | `#070E1F` / `#0D1A33` / `#13244A` / `#22355E` |
  | ink / dim | `#F4F7FF` / `#9AA8C7` |
  | cyan | `#22D3EE` |
  | royal | `#3B6CF6` |
  | twin | `#A78BFA` |
  | sas | `#60A5FA` |
  | tas | `#34D399` |
  | gold | `#F5B942` |
  | gap / mastered | `#F87171` / `#4ADE80` |
  | engine | `#FFFFFF` |

  Each colour stands for one component: cyan for the multimodal layer, royal for the knowledge graph, twin for the digital twin, sas and tas for the two agents, gold for teacher governance, white for the orchestration engine.
- **Type:**
  - Manrope (`font-display`) for headlines and KPIs, Inter (`font-sans`) for the UI, JetBrains Mono (`font-mono`) for structured fields.
  - **Vietnamese text and student names must use `font-sans` (Inter)**, since Manrope's Vietnamese coverage is not guaranteed.
  - Minimum sizes on the dashboard: body 18 px (dense labels 16–17 px), card title 24 px, KPI 64 px, scene title 56 px.
- Footer label, exact text: `Illustrative demo data · fictional students`. Simulation tag, exact text: `Simulated projection · illustrative`.
- The UI language is English. The Zalo, WhatsApp and email snippets are Vietnamese, each paired with English extracted evidence.
- `aitutor_demo/` is its own git repository (branch `main`). Run git commands from `aitutor_demo/` and stage with `git add -A .`. Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The stock footage files (`*.mp4`) in `aitutor_demo/` are never committed.

## File Structure

```
aitutor_demo/
├─ package.json, tsconfig.json, vite.config.ts, tailwind.config.js, postcss.config.js, .gitignore
├─ dashboard.html, student.html, controller.html
├─ README.md
├─ scripts/contact-sheet.ts            Playwright frame renderer + determinism check
└─ src/
   ├─ fonts.ts, styles.css            font imports + Tailwind entry
   ├─ engine/
   │   ├─ anim.ts                      pure easing/progress/keyframe helpers
   │   ├─ playback.ts                  PlaybackState, commands, time derivation, URL parsing
   │   ├─ sync.ts                      BroadcastChannel wrapper + message types
   │   ├─ useNow.ts                    rAF wall clock hook
   │   ├─ PlaybackProvider.tsx         per-app clock context (useSceneClock)
   │   └─ Stage.tsx                    fixed canvas scaled to window
   ├─ scenario/                        all fictional demo data (no React)
   │   ├─ scenes.ts                    12 SceneDefs, CUES
   │   ├─ knowledgeGraph.ts            12 concepts, prerequisite edges, pathEdges
   │   ├─ minhAnh.ts                   twin states, deltas
   │   ├─ classroom.ts                 55 students, KPIs, portfolio, heatmap, A–E, policy
   │   ├─ sources.ts                   Sc1 windows, messages, evidence items, teacher questions
   │   ├─ agents.ts                    SAS/TAS cards, refs, plans, joint decisions
   │   ├─ orchestration.ts             engine inputs, operations, statuses, pathways
   │   ├─ simulation.ts                pathway A/B curves
   │   └─ practice.ts                  questions, truth tables, Sc9 timeline
   ├─ ui/                              shared presentational components
   │   ├─ tokens.ts, Panel.tsx, Kpi.tsx, FullSvg.tsx, Conduit.tsx, Camera.tsx, FakeCursor.tsx
   │   ├─ AgentNode.tsx, AgentPair.tsx, MessageCard.tsx, ParticleStream.tsx
   │   ├─ GraphView.tsx, TwinPanel.tsx, StudentGrid.tsx, PipelineStatus.tsx, Overlays.tsx
   ├─ controller/  main.tsx, ControllerApp.tsx
   ├─ student/     main.tsx, StudentApp.tsx, frame.ts, screens/*.tsx
   └─ dashboard/
       ├─ main.tsx, DashboardApp.tsx
       ├─ scenes/  types.ts, index.ts, Sc01…Sc12
       ├─ architecture/ArchitectureView.tsx   (Sc2, Sc12)
       ├─ command/CommandFrame.tsx            (Sc3, Sc8, Sc11)
       ├─ agents/AgentStage.tsx, JointDecision.tsx, highlights.ts   (Sc5, Sc6, Sc10)
       └─ adapt/SimChart.tsx                  (Sc10)
```

---

### Task 1: Project scaffold and animation helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`
- Create: `src/engine/anim.ts`
- Test: `src/engine/anim.test.ts`

**Interfaces:**
- Produces: `clamp, lerp, easeOut, easeInOut, prog, fade, typed, countUp, pulse, holdMs, stepIndex, keyframes, cubic` and types `Keyframe<V>`, `Point` from `src/engine/anim.ts`.

- [ ] **Step 1: Create the project files**

`package.json`:
```json
{
  "name": "beyond-ai-tutoring-demo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --open /controller.html",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "contact-sheet": "tsx scripts/contact-sheet.ts"
  },
  "dependencies": {
    "@fontsource/inter": "^5.1.0",
    "@fontsource/jetbrains-mono": "^5.1.0",
    "@fontsource/manrope": "^5.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "playwright": "^1.48.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.3"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (name: string) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { dashboard: page('dashboard'), student: page('student'), controller: page('controller') },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
```

`.gitignore` (already exists; leave it as is):
```
node_modules/
dist/
contact-sheet/
.superpowers/
*.mp4
*.mov
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: it completes without errors and `node_modules/` exists.

- [ ] **Step 3: Write the failing test** in `src/engine/anim.test.ts`

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/engine/anim.test.ts`
Expected: FAIL with `Failed to resolve import "./anim"`.

- [ ] **Step 5: Implement** `src/engine/anim.ts`

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/engine/anim.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add -A .
git commit -m "chore: scaffold demo project and pure animation helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Playback model

**Files:**
- Create: `src/engine/playback.ts`
- Test: `src/engine/playback.test.ts`

**Interfaces:**
- Consumes: `clamp` from `engine/anim.ts`.
- Produces:
  - Constants: `HANDLE_MS = 1000`, `PREROLL_MS = 3000`, `SLATE_MS = 100`.
  - Types: `Toggles {titles, footer, cursor, tc}`, `DEFAULT_TOGGLES`, `PlaybackState {scene, playing, startedAt, pausedAt, toggles}`, `Command` (union of `start | play | pause | seek | select | toggle`).
  - Functions:
    - `initialState(scene?: number): PlaybackState`
    - `rawTime(s, now): number`
    - `localTime(s, now, durationMs): number`
    - `isSlate(s, now): boolean`
    - `countdown(s, now): number`
    - `isDone(s, now, durationMs): boolean`
    - `applyCommand(s, cmd, now): PlaybackState`
    - `togglePlay(s): Command`
    - `stateFromSearch(search, now, fallbackScene): PlaybackState`
    - `formatTime(ms): string`

- [ ] **Step 1: Write the failing test** in `src/engine/playback.test.ts`

```ts
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
    const s = stateFromSearch('?scene=9&t=6000&titles=0&tc=1', 0, 3);
    expect(s.scene).toBe(9);
    expect(s.playing).toBe(false);
    expect(localTime(s, 0, 20000)).toBe(6000);
    expect(s.toggles).toEqual({ titles: false, footer: true, cursor: true, tc: true });
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/playback.test.ts`
Expected: FAIL with `Failed to resolve import "./playback"`.

- [ ] **Step 3: Implement** `src/engine/playback.ts`

```ts
import { clamp } from './anim';

export const HANDLE_MS = 1000;
export const PREROLL_MS = 3000;
export const SLATE_MS = 100;

export interface Toggles {
  titles: boolean;
  footer: boolean;
  cursor: boolean;
  tc: boolean;
}

export const DEFAULT_TOGGLES: Toggles = { titles: true, footer: true, cursor: true, tc: false };

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

/** Standalone mode: ?scene=9&t=6000 holds a frame; &autoplay plays; titles=0 footer=0 cursor=0 tc=1. */
export function stateFromSearch(search: string, now: number, fallbackScene: number): PlaybackState {
  const q = new URLSearchParams(search);
  const scene = Number(q.get('scene') ?? fallbackScene);
  const t = Number(q.get('t') ?? 0);
  const toggles: Toggles = {
    titles: q.get('titles') !== '0',
    footer: q.get('footer') !== '0',
    cursor: q.get('cursor') !== '0',
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/engine/playback.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add -A .
git commit -m "feat: deterministic playback model with handles, pre-roll and slate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scenario core: scenes, knowledge graph, Minh Anh, classroom

**Files:**
- Create: `src/scenario/scenes.ts`, `src/scenario/knowledgeGraph.ts`, `src/scenario/minhAnh.ts`, `src/scenario/classroom.ts`
- Test: `src/scenario/core.test.ts`

**Interfaces:**
- Produces:
  - `scenes.ts`: `SceneDef {id, label, title, subtitle, durationMs, shots}`, `SCENES`, `TOTAL_MS`, `CUES {sc7Delivered, sc7Notify, sc10Update}`, `sceneById(id)`.
  - `knowledgeGraph.ts`: `ConceptId`, `Concept {id, label, symbol, x, y}`, `Edge = [ConceptId, ConceptId]`, `CONCEPTS`, `EDGES`, `conceptById(id)`, `conceptIndex(id)`, `pathEdges(from, to): Edge[]`.
  - `minhAnh.ts`:
    - `Mastery = Record<ConceptId, number>`, `MINH_ANH`
    - `MASTERY_PRIOR`, `MASTERY_INITIAL`, `MASTERY_MID`, `MASTERY_POST`, `ERRORS_INITIAL`
    - `TWIN_FOCUS`, `TWIN_HISTORY`, `TWIN_ACTIVITY`, `TWIN_PAST_INTERVENTIONS`, `DELTAS`, `REMAINING_GAP`
    - `lerpMastery(a, b, p)`, `gaps(m, threshold?)`
  - `classroom.ts`:
    - Types: `Status`, `Track`, `Student {index, id, name, status, mastery, track}`
    - Index lists: `HIGH_RISK`, `SUPPORT`, `COMPLEX`
    - Data: `STUDENTS`, `KPIS_AFTER`, `PORTFOLIO_AFTER`, `OUTCOMES_AFTER`, `EFFECTIVENESS`, `TOPICS`, `GROUPS`, `HEATMAP`, `SCALE_STUDENTS`, `POLICY_RULES`
    - Functions: `kpis()`, `portfolio()`, `initials(name)`

- [ ] **Step 1: Write the failing test** in `src/scenario/core.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CUES, SCENES, TOTAL_MS, sceneById } from './scenes';
import { CONCEPTS, EDGES, pathEdges, type ConceptId } from './knowledgeGraph';
import { DELTAS, MASTERY_INITIAL, MASTERY_MID, MASTERY_POST, MINH_ANH, gaps, lerpMastery } from './minhAnh';
import {
  KPIS_AFTER, OUTCOMES_AFTER, PORTFOLIO_AFTER, SCALE_STUDENTS, STUDENTS, initials, kpis, portfolio,
} from './classroom';

describe('scenes', () => {
  it('has 12 scenes totalling 3:30', () => {
    expect(SCENES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(TOTAL_MS).toBe(210000);
  });
  it('shots are ascending and inside each scene', () => {
    for (const s of SCENES) {
      expect(s.shots.length).toBeGreaterThan(0);
      s.shots.forEach((t, i) => {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(s.durationMs);
        if (i) expect(t).toBeGreaterThan(s.shots[i - 1]);
      });
    }
  });
  it('cues fit their scenes and delivery precedes the phone notification', () => {
    expect(CUES.sc7Notify).toBeLessThan(sceneById(7).durationMs);
    expect(CUES.sc7Delivered).toBeLessThanOrEqual(CUES.sc7Notify);
    expect(CUES.sc10Update).toBeLessThan(sceneById(10).durationMs);
  });
  it('sceneById throws on unknown ids', () => {
    expect(() => sceneById(99)).toThrow();
  });
});

describe('knowledge graph', () => {
  it('has 12 unique concepts inside the 1100×560 viewBox', () => {
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(12);
    for (const c of CONCEPTS) {
      expect(c.x).toBeGreaterThan(30);
      expect(c.x).toBeLessThan(1070);
      expect(c.y + 58).toBeLessThan(560);
    }
  });
  it('edges reference known concepts and form a DAG', () => {
    const ids = new Set<ConceptId>(CONCEPTS.map((c) => c.id));
    for (const [a, b] of EDGES) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
    const indeg = new Map<ConceptId, number>([...ids].map((id) => [id, 0]));
    for (const [, b] of EDGES) indeg.set(b, (indeg.get(b) ?? 0) + 1);
    const queue = [...ids].filter((id) => indeg.get(id) === 0);
    let visited = 0;
    while (queue.length) {
      const n = queue.shift()!;
      visited++;
      for (const [a, b] of EDGES) if (a === n) {
        indeg.set(b, indeg.get(b)! - 1);
        if (indeg.get(b) === 0) queue.push(b);
      }
    }
    expect(visited).toBe(ids.size);
  });
  it('pathEdges finds every edge from implication to equivalence', () => {
    const p = pathEdges('implication', 'equivalence').map(([a, b]) => `${a}>${b}`).sort();
    expect(p).toEqual([
      'biconditional>equivalence', 'implication>biconditional', 'implication>truthTables', 'truthTables>equivalence',
    ]);
  });
});

describe('Minh Anh', () => {
  it('matches the spec figures', () => {
    expect(MINH_ANH.scorePrev).toBe(75);
    expect(MINH_ANH.scoreNow).toBe(42);
    expect(MINH_ANH.scoreAfter).toBe(78);
    expect(MASTERY_INITIAL.conjunction).toBe(0.8);
    expect(MASTERY_INITIAL.disjunction).toBe(0.78);
    expect(MASTERY_INITIAL.negation).toBe(0.7);
    expect(MASTERY_INITIAL.implication).toBe(0.31);
    expect(MASTERY_INITIAL.biconditional).toBe(0.35);
    expect(MASTERY_INITIAL.equivalence).toBe(0.35);
    expect(MASTERY_POST.equivalence).toBe(0.72);
  });
  it('mastery only improves from initial → mid → post', () => {
    for (const c of CONCEPTS) {
      expect(MASTERY_MID[c.id]).toBeGreaterThanOrEqual(MASTERY_INITIAL[c.id]);
      expect(MASTERY_POST[c.id]).toBeGreaterThanOrEqual(MASTERY_MID[c.id]);
    }
  });
  it('deltas agree with the twin and scores', () => {
    const acc = DELTAS.find((d) => d.label === 'Exercise accuracy')!;
    expect(acc.before).toBe(`${MINH_ANH.scoreNow}%`);
    expect(acc.after).toBe(`${MINH_ANH.scoreAfter}%`);
    const eq = DELTAS.find((d) => d.label === 'Logical equivalence mastery')!;
    expect(eq.before).toBe(MASTERY_INITIAL.equivalence.toFixed(2));
    expect(eq.after).toBe(MASTERY_POST.equivalence.toFixed(2));
  });
  it('lerpMastery and gaps', () => {
    expect(lerpMastery(MASTERY_INITIAL, MASTERY_POST, 1).equivalence).toBeCloseTo(0.72);
    expect(gaps(MASTERY_INITIAL)).toEqual(['implication', 'biconditional', 'equivalence']);
  });
});

describe('classroom', () => {
  it('has 55 unique students with Minh Anh at s17', () => {
    expect(STUDENTS).toHaveLength(55);
    expect(new Set(STUDENTS.map((s) => s.name)).size).toBe(55);
    expect(STUDENTS[MINH_ANH.index].name).toBe(MINH_ANH.name);
    expect(STUDENTS[MINH_ANH.index].id).toBe('s17');
    expect(STUDENTS[MINH_ANH.index].status).toBe('highRisk');
    expect(STUDENTS[MINH_ANH.index].track).toBe('adaptive');
  });
  it('KPIs are 55 / 12 / 5 and improve after', () => {
    expect(kpis()).toEqual({ total: 55, needSupport: 12, highRisk: 5 });
    expect(KPIS_AFTER.needSupport).toBeLessThan(12);
    expect(KPIS_AFTER.highRisk).toBeLessThan(5);
  });
  it('portfolio is Routine 31 · Adaptive 9 · Complex 3', () => {
    expect(portfolio()).toEqual({ routine: 31, adaptive: 9, complex: 3 });
    const after = PORTFOLIO_AFTER.routine + PORTFOLIO_AFTER.adaptive + PORTFOLIO_AFTER.complex;
    expect(after).toBeLessThanOrEqual(55);
    expect(OUTCOMES_AFTER).toEqual({ improved: 14, adjust: 3, teacherAttention: 2 });
  });
  it('scale students A–E map to fitting learners', () => {
    expect(SCALE_STUDENTS.map((s) => s.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const d = SCALE_STUDENTS.find((s) => s.letter === 'D')!;
    expect(STUDENTS[d.index].track).toBe('complex');
    const e = SCALE_STUDENTS.find((s) => s.letter === 'E')!;
    expect(STUDENTS[e.index].mastery).toBeGreaterThanOrEqual(0.85);
  });
  it('initials uses the last two name parts', () => {
    expect(initials('Nguyễn Minh Anh')).toBe('MA');
    expect(initials('Trần Bảo')).toBe('TB');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scenario/core.test.ts`
Expected: FAIL with `Failed to resolve import "./scenes"`.

- [ ] **Step 3: Implement** `src/scenario/scenes.ts`

```ts
export interface SceneDef {
  id: number;
  /** Short name shown in the controller. */
  label: string;
  /** Lower-third title on the dashboard; empty = no title overlay. */
  title: string;
  subtitle: string;
  durationMs: number;
  /** Key timestamps rendered by the contact sheet. */
  shots: number[];
}

export const SCENES: SceneDef[] = [
  { id: 1, label: 'Fragmented', title: 'Fragmented Data', subtitle: 'Heterogeneous Information. Limited Learning Intelligence.', durationMs: 12000, shots: [1500, 5000, 9500] },
  { id: 2, label: 'Architecture', title: '', subtitle: '', durationMs: 13000, shots: [2500, 6500, 9500, 12500] },
  { id: 3, label: 'Perceive', title: 'Multimodal Foundation Models', subtitle: 'Interpret. Extract. Connect.', durationMs: 15000, shots: [2000, 6500, 11500, 14000] },
  { id: 4, label: 'Represent', title: 'Knowledge Graphs → Grounded Inference', subtitle: 'Learning Digital Twins → Dynamic Student Representation', durationMs: 15000, shots: [2500, 5500, 10500, 13500] },
  { id: 5, label: 'Reason', title: 'Specialized Agent Intelligence', subtitle: 'Student Analysis Agent · Teaching Assistance Agent', durationMs: 15000, shots: [2500, 6500, 11000, 14000] },
  { id: 6, label: 'Collaborate', title: 'Collaborative Agent Intelligence', subtitle: 'Multimodal Evidence. Knowledge-Grounded Reasoning.', durationMs: 25000, shots: [4000, 9500, 13500, 18000, 22000] },
  { id: 7, label: 'Orchestrate', title: 'Agentic AI', subtitle: 'Adaptive Decisions → Service Coordination → Autonomous Execution', durationMs: 25000, shots: [3000, 7500, 10500, 14000, 17000, 21000] },
  { id: 8, label: 'Govern', title: 'AI Coordinates. Digital Twins Monitor. Teachers Govern.', subtitle: '', durationMs: 15000, shots: [2500, 6000, 10500, 13500] },
  { id: 9, label: 'Experience', title: 'Personalized Learning', subtitle: 'Adaptive Support. Continuous Evidence.', durationMs: 20000, shots: [5000, 10000, 15000, 18000] },
  { id: 10, label: 'Simulate & Adapt', title: 'Simulate. Intervene. Monitor. Adapt.', subtitle: 'The closed-loop learning digital twin', durationMs: 30000, shots: [3500, 10000, 13500, 19500, 23000, 28500] },
  { id: 11, label: 'Scale', title: 'One Integrated AI Architecture', subtitle: 'Multiple Learning Digital Twins. Personalized Interventions at Classroom Scale.', durationMs: 15000, shots: [500, 5500, 9500, 13500] },
  { id: 12, label: 'Closing', title: '', subtitle: '', durationMs: 10000, shots: [2000, 8000] },
];

export const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.durationMs, 0);

/** Cross-app moments that both windows must agree on (scene time, ms). */
export const CUES = {
  /** Sc7: pipeline reaches DELIVERED on the dashboard. */
  sc7Delivered: 20500,
  /** Sc7: notification lands on the phone lock screen. */
  sc7Notify: 21000,
  /** Sc10: updated pathway delivered and shown on the phone. */
  sc10Update: 27000,
} as const;

export function sceneById(id: number): SceneDef {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
}
```

- [ ] **Step 4: Implement** `src/scenario/knowledgeGraph.ts`

```ts
export type ConceptId =
  | 'propositions' | 'negation' | 'conjunction' | 'disjunction' | 'implication' | 'biconditional'
  | 'truthTables' | 'expressions' | 'equivalence' | 'deMorgan' | 'equivLaws' | 'applications';

export interface Concept {
  id: ConceptId;
  label: string;
  symbol: string;
  /** Position in the 1100×560 graph viewBox (fixed, never computed). */
  x: number;
  y: number;
}

/** [prerequisite, concept] */
export type Edge = [ConceptId, ConceptId];

export const CONCEPTS: Concept[] = [
  { id: 'propositions', label: 'Propositions', symbol: 'p', x: 80, y: 280 },
  { id: 'negation', label: 'Negation', symbol: '¬', x: 270, y: 110 },
  { id: 'conjunction', label: 'Conjunction', symbol: '∧', x: 270, y: 220 },
  { id: 'disjunction', label: 'Disjunction', symbol: '∨', x: 270, y: 330 },
  { id: 'implication', label: 'Implication', symbol: '→', x: 270, y: 440 },
  { id: 'truthTables', label: 'Truth tables', symbol: 'T/F', x: 480, y: 180 },
  { id: 'expressions', label: 'Logical expressions', symbol: 'φ', x: 480, y: 300 },
  { id: 'biconditional', label: 'Biconditional', symbol: '↔', x: 480, y: 440 },
  { id: 'equivalence', label: 'Logical equivalence', symbol: '≡', x: 690, y: 300 },
  { id: 'deMorgan', label: "De Morgan's laws", symbol: 'DM', x: 870, y: 190 },
  { id: 'equivLaws', label: 'Equivalence laws', symbol: '≡L', x: 870, y: 410 },
  { id: 'applications', label: 'Applications', symbol: 'A', x: 1020, y: 300 },
];

export const EDGES: Edge[] = [
  ['propositions', 'negation'], ['propositions', 'conjunction'], ['propositions', 'disjunction'], ['propositions', 'implication'],
  ['negation', 'truthTables'], ['conjunction', 'truthTables'], ['disjunction', 'truthTables'], ['implication', 'truthTables'],
  ['negation', 'expressions'], ['conjunction', 'expressions'], ['disjunction', 'expressions'],
  ['implication', 'biconditional'],
  ['truthTables', 'equivalence'], ['expressions', 'equivalence'], ['biconditional', 'equivalence'],
  ['equivalence', 'deMorgan'], ['equivalence', 'equivLaws'],
  ['deMorgan', 'applications'], ['equivLaws', 'applications'],
];

export function conceptById(id: ConceptId): Concept {
  const c = CONCEPTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept ${id}`);
  return c;
}

export const conceptIndex = (id: ConceptId): number => CONCEPTS.findIndex((c) => c.id === id);

function reachable(from: ConceptId): Set<ConceptId> {
  const seen = new Set<ConceptId>([from]);
  const stack: ConceptId[] = [from];
  while (stack.length) {
    const n = stack.pop()!;
    for (const [a, b] of EDGES) if (a === n && !seen.has(b)) { seen.add(b); stack.push(b); }
  }
  return seen;
}

/** Every edge that lies on some path from `from` to `to`. */
export function pathEdges(from: ConceptId, to: ConceptId): Edge[] {
  const down = reachable(from);
  return EDGES.filter(([a, b]) => down.has(a) && reachable(b).has(to));
}
```

- [ ] **Step 5: Implement** `src/scenario/minhAnh.ts`

```ts
import type { ConceptId } from './knowledgeGraph';

export type Mastery = Record<ConceptId, number>;

export const MINH_ANH = {
  index: 16,
  id: 's17',
  name: 'Nguyễn Minh Anh',
  short: 'Minh Anh',
  course: 'Discrete Mathematics',
  topic: 'Logical Equivalence',
  scorePrev: 75,
  scoreNow: 42,
  scoreAfter: 78,
  incompleteActivities: 2,
} as const;

export const MASTERY_INITIAL: Mastery = {
  propositions: 0.85, negation: 0.7, conjunction: 0.8, disjunction: 0.78, implication: 0.31, biconditional: 0.35,
  truthTables: 0.6, expressions: 0.55, equivalence: 0.35, deMorgan: 0.4, equivLaws: 0.38, applications: 0.3,
};

/** Twin estimate before Week 6 evidence arrived (Sc4 shows it update to MASTERY_INITIAL). */
export const MASTERY_PRIOR: Mastery = { ...MASTERY_INITIAL, implication: 0.38, equivalence: 0.4 };

/** After Sc9 practice (guided activity done, mastery check still pending). */
export const MASTERY_MID: Mastery = { ...MASTERY_INITIAL, implication: 0.52, biconditional: 0.45, truthTables: 0.72, equivalence: 0.48 };

/** After the mastery assessment (Sc10). */
export const MASTERY_POST: Mastery = {
  ...MASTERY_INITIAL, implication: 0.74, biconditional: 0.66, truthTables: 0.8, expressions: 0.68,
  equivalence: 0.72, deMorgan: 0.64, equivLaws: 0.52, applications: 0.45,
};

export const ERRORS_INITIAL: Partial<Record<ConceptId, number>> = { implication: 6, biconditional: 2, equivalence: 3 };

export const TWIN_FOCUS: ConceptId[] = ['negation', 'conjunction', 'disjunction', 'implication', 'biconditional', 'equivalence'];

export const TWIN_HISTORY = [
  { when: 'Prev. term', text: 'Intro to Logic · C+ (68%)' },
  { when: 'Week 2', text: 'Quiz 1 · 75%' },
  { when: 'Week 4', text: 'Missed truth-table lab' },
  { when: 'Week 5', text: 'Missed implication worksheet' },
  { when: 'Week 6', text: 'Quiz 2 · 42%' },
];

export const TWIN_ACTIVITY = [
  '1.5 sessions / week (class avg 3.2)',
  'Avg response 74 s on implication items',
  '62% of activity after 22:00',
];

export const TWIN_PAST_INTERVENTIONS = [{ what: 'Generic practice set · Week 3', outcome: 'no measurable gain' }];

export const DELTAS = [
  { label: 'Exercise accuracy', before: '42%', after: '78%' },
  { label: 'Incorrect answers (per set)', before: '6', after: '2' },
  { label: 'Hints requested (per item)', before: '1.8', after: '0.6' },
  { label: 'Avg response time', before: '74 s', after: '41 s' },
  { label: 'Logical equivalence mastery', before: '0.35', after: '0.72' },
];

export const REMAINING_GAP = 'Applying equivalence laws';

export function lerpMastery(a: Mastery, b: Mastery, p: number): Mastery {
  const out = { ...a };
  for (const k of Object.keys(a) as ConceptId[]) out[k] = a[k] + (b[k] - a[k]) * p;
  return out;
}

/** Focus concepts below `threshold`, in TWIN_FOCUS order. */
export const gaps = (m: Mastery, threshold = 0.5): ConceptId[] => TWIN_FOCUS.filter((id) => m[id] < threshold);
```

- [ ] **Step 6: Implement** `src/scenario/classroom.ts`

```ts
import { MINH_ANH } from './minhAnh';

export type Status = 'onTrack' | 'support' | 'highRisk';
export type Track = 'routine' | 'adaptive' | 'complex' | 'none';

export interface Student {
  index: number;
  id: string;
  name: string;
  status: Status;
  mastery: number;
  track: Track;
}

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
const GIVEN = [
  'An', 'Bảo', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoa', 'Huy', 'Khánh', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai',
  'Nam', 'Ngọc', 'Phúc', 'Phương', 'Quân', 'Quang', 'Sơn', 'Tâm', 'Thảo', 'Thành', 'Trang', 'Trung', 'Tú', 'Tuấn', 'Uyên',
  'Việt', 'Vy', 'Yến', 'Duy', 'Đức', 'Hạnh', 'Kiên', 'Loan', 'Nhi', 'Oanh', 'Phong', 'Quỳnh', 'Tài', 'Thư', 'Toàn', 'Trâm',
  'Vân', 'Xuân', 'Hùng', 'Lộc', 'My', 'Nga', 'Thắng', 'Hiền',
];

export const HIGH_RISK = [3, 16, 28, 41, 50];
export const SUPPORT = [7, 12, 22, 33, 37, 45, 53];
export const COMPLEX = [28, 41, 50];

const statusOf = (i: number): Status => (HIGH_RISK.includes(i) ? 'highRisk' : SUPPORT.includes(i) ? 'support' : 'onTrack');

function masteryOf(i: number, status: Status): number {
  if (i === MINH_ANH.index) return 0.35;
  if (status === 'highRisk') return 0.3 + (i % 7) / 100;
  if (status === 'support') return 0.48 + (i % 5) / 100;
  return 0.62 + ((i * 37) % 30) / 100;
}

export const STUDENTS: Student[] = (() => {
  let routineLeft = 31;
  return Array.from({ length: 55 }, (_, i) => {
    const status = statusOf(i);
    const name = i === MINH_ANH.index ? MINH_ANH.name : `${FAMILY[i % FAMILY.length]} ${GIVEN[i]}`;
    let track: Track = 'none';
    if (COMPLEX.includes(i)) track = 'complex';
    else if (status !== 'onTrack') track = 'adaptive';
    else if (routineLeft > 0) { track = 'routine'; routineLeft--; }
    return { index: i, id: `s${i + 1}`, name, status, mastery: masteryOf(i, status), track };
  });
})();

export function kpis(students: Student[] = STUDENTS) {
  const highRisk = students.filter((s) => s.status === 'highRisk').length;
  const support = students.filter((s) => s.status === 'support').length;
  return { total: students.length, needSupport: support + highRisk, highRisk };
}

export function portfolio(students: Student[] = STUDENTS) {
  const count = (t: Track) => students.filter((s) => s.track === t).length;
  return { routine: count('routine'), adaptive: count('adaptive'), complex: count('complex') };
}

export const KPIS_AFTER = { needSupport: 9, highRisk: 3 };
export const PORTFOLIO_AFTER = { routine: 33, adaptive: 7, complex: 2 };
export const OUTCOMES_AFTER = { improved: 14, adjust: 3, teacherAttention: 2 };

export const EFFECTIVENESS = [
  { label: 'Guided conceptual practice', value: 82 },
  { label: 'Spaced retrieval', value: 74 },
  { label: 'Independent practice', value: 58 },
];

export const TOPICS = ['Propositions', 'Logical operators', 'Implication', 'Logical equivalence', 'Predicates', 'Proof methods'];
export const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5'];
/** HEATMAP[topic][group] = average mastery. */
export const HEATMAP: number[][] = [
  [0.88, 0.85, 0.82, 0.86, 0.8],
  [0.8, 0.74, 0.77, 0.72, 0.78],
  [0.58, 0.49, 0.55, 0.46, 0.52],
  [0.52, 0.44, 0.5, 0.41, 0.49],
  [0.66, 0.6, 0.63, 0.58, 0.61],
  [0.61, 0.55, 0.59, 0.52, 0.57],
];

export const SCALE_STUDENTS = [
  { letter: 'A', index: 3, need: 'Conceptual gap', intervention: 'Visual scaffolding' },
  { letter: 'B', index: 12, need: 'Weak application', intervention: 'Worked examples' },
  { letter: 'C', index: 22, need: 'Knowledge retention', intervention: 'Spaced retrieval' },
  { letter: 'D', index: 28, need: 'Persistent difficulty', intervention: 'Teacher-supported intervention' },
  { letter: 'E', index: 17, need: 'Advanced mastery', intervention: 'Challenging application tasks' },
];

export const POLICY_RULES = [
  { id: 'auto', label: 'Auto-deliver routine & adaptive interventions', before: 'On', after: 'On' },
  { id: 'escalate', label: 'Escalate if no mastery gain after', before: '3 sessions', after: '2 sessions' },
  { id: 'notify', label: 'Notify me on new high-risk flags', before: 'Immediately', after: 'Immediately' },
];

export const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(-2).map((p) => p[0]).join('').toUpperCase();
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/scenario/core.test.ts`
Expected: PASS (all tests).

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: scenario core (scenes, knowledge graph, twin, classroom)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Scenario content: sources, agents, orchestration, simulation, practice

**Files:**
- Create: `src/scenario/sources.ts`, `src/scenario/agents.ts`, `src/scenario/orchestration.ts`, `src/scenario/simulation.ts`, `src/scenario/practice.ts`
- Test: `src/scenario/content.test.ts`

**Interfaces:**
- Consumes: `ConceptId`, `CONCEPTS` (knowledgeGraph); `MASTERY_INITIAL`, `MASTERY_MID`, `ERRORS_INITIAL` (minhAnh).
- Produces:
  - `sources.ts`:
    - Types: `EvidenceKind = 'structured'|'text'|'interaction'|'document'`, `SourceKind`, `SourceWindow {kind, short, title, lines, x, y, w, h, particle}`, `RawMessage`
    - Data: `SOURCE_WINDOWS`, `MESSAGES`, `EVIDENCE_ITEMS {kind, source, raw, evidence}[]`, `TEACHER_QUESTIONS`
  - `agents.ts`:
    - Types: `AgentId = 'SAS'|'TAS'`, `CardType`, `AgentCard {id, from, to, type, text, refs}`, `RefKind`
    - Lookups: `COURSE_OBJECTIVES`, `RESOURCES`
    - Cards and agent content: `EXCHANGES` (4), `REASSESSMENT` (2), `SAS_READS`, `SAS_DIAGNOSIS`, `TAS_ANALYSIS`, `SAS_CHECKS`
    - Plans and decisions: `PLAN_DRAFT`, `PLAN_ADDED`, `JOINT_DECISION`, `JOINT_DECISION_2`
    - `refTarget(ref): {kind, id} | null`
  - `orchestration.ts`:
    - Engine: `ENGINE_INPUTS`, `OPERATIONS {id, title, detail}[]`, `STATUSES`
    - Content: `RETRIEVED`, `ACTIVITIES`, `PATHWAY_INITIAL`, `PATHWAY_UPDATED` (`{title, mins, when}[]`)
    - Copy: `PLAN_OBJECTIVES`, `PLAN_OBJECTIVES_UPDATED`, `EXPECTED_OUTCOME`, `MONITORING_CRITERIA`
  - `simulation.ts`: `SIM_LABEL`, `TARGET`, `PATHWAY_A`, `PATHWAY_B` (`{id, label, curve}`), `SELECTED`, `sessionsToTarget(curve, target?)`.
  - `practice.ts`:
    - Types and helpers: `Expr`, `TT_ROWS`, `equivalent(f, g)`
    - Content: `Q1 {prompt, options {label, f}[], correct, chosenWrong, hint}`, `HINT_ROW`, `GUIDED {prompt, start, steps {expr, why, f}[]}`
    - Sc9 timing: `SC9 {tap, plan, practice, pickWrong, hint, pickRight, guided, guidedSteps, progress}`, `SC9_EVIDENCE {at, label}[]`, `PROGRESS {concept, from, to, accuracyToday, done, total}`

- [ ] **Step 1: Write the failing test** in `src/scenario/content.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { EVIDENCE_ITEMS, MESSAGES, SOURCE_WINDOWS, TEACHER_QUESTIONS } from './sources';
import { EXCHANGES, REASSESSMENT, refTarget } from './agents';
import { ACTIVITIES, OPERATIONS, PATHWAY_INITIAL, RETRIEVED, STATUSES } from './orchestration';
import { RESOURCES } from './agents';
import { PATHWAY_A, PATHWAY_B, sessionsToTarget } from './simulation';
import { GUIDED, HINT_ROW, PROGRESS, Q1, SC9, SC9_EVIDENCE, equivalent } from './practice';
import { MASTERY_INITIAL, MASTERY_MID } from './minhAnh';
import { sceneById } from './scenes';

describe('sources', () => {
  it('has 8 distinct windows inside the canvas', () => {
    expect(new Set(SOURCE_WINDOWS.map((w) => w.kind)).size).toBe(8);
    for (const w of SOURCE_WINDOWS) {
      expect(w.x + w.w).toBeLessThanOrEqual(1920);
      expect(w.y + w.h).toBeLessThanOrEqual(1080);
    }
  });
  it('messages cover Zalo, WhatsApp and email in Vietnamese with English evidence', () => {
    expect(new Set(MESSAGES.map((m) => m.channel))).toEqual(new Set(['zalo', 'whatsapp', 'email']));
    for (const m of MESSAGES) {
      expect(m.vi).toMatch(/[^\x00-\x7F]/);
      expect(m.evidence.length).toBeGreaterThan(5);
    }
  });
  it('has 5 teacher questions and 5 evidence items', () => {
    expect(TEACHER_QUESTIONS).toHaveLength(5);
    expect(EVIDENCE_ITEMS).toHaveLength(5);
  });
});

describe('agents', () => {
  it('exchanges alternate SAS→TAS→SAS→TAS with the spec card types', () => {
    expect(EXCHANGES.map((c) => `${c.from}>${c.to}:${c.type}`)).toEqual([
      'SAS>TAS:DIAGNOSIS', 'TAS>SAS:PROPOSAL', 'SAS>TAS:CHALLENGE', 'TAS>SAS:REFINEMENT',
    ]);
  });
  it('every evidence ref resolves to a real twin field, KG node, objective or resource', () => {
    for (const card of [...EXCHANGES, ...REASSESSMENT]) {
      for (const r of card.refs) expect(refTarget(r), r).not.toBeNull();
    }
  });
  it('refTarget rejects unknown refs', () => {
    expect(refTarget('kg:nope')).toBeNull();
    expect(refTarget('twin.mastery.nope')).toBeNull();
    expect(refTarget('resources.nope')).toBeNull();
  });
});

describe('orchestration', () => {
  it('has one status per operation and consistent content', () => {
    expect(OPERATIONS).toHaveLength(6);
    expect(STATUSES).toHaveLength(6);
    expect(ACTIVITIES).toHaveLength(5);
    expect(PATHWAY_INITIAL).toHaveLength(4);
    for (const r of RETRIEVED) expect(RESOURCES[r]).toBeTruthy();
  });
});

describe('simulation', () => {
  it('B reaches 0.75 in 3 sessions, A in 6', () => {
    expect(sessionsToTarget(PATHWAY_A.curve)).toBe(6);
    expect(sessionsToTarget(PATHWAY_B.curve)).toBe(3);
    expect(PATHWAY_A.curve[0]).toBe(MASTERY_INITIAL.equivalence);
    expect(PATHWAY_B.curve[0]).toBe(MASTERY_INITIAL.equivalence);
  });
});

describe('practice', () => {
  it('exactly one option is equivalent to p → q', () => {
    const eq = Q1.options.filter((o) => equivalent(o.f, (p, q) => !p || q));
    expect(eq).toHaveLength(1);
    expect(Q1.options[Q1.correct].label).toBe('¬p ∨ q');
  });
  it('the chosen wrong answer is the converse and the hint row separates it', () => {
    const wrong = Q1.options[Q1.chosenWrong];
    expect(wrong.label).toBe('q → p');
    expect(wrong.f(HINT_ROW.p, HINT_ROW.q)).not.toBe(!HINT_ROW.p || HINT_ROW.q);
  });
  it('every guided step is equivalent to ¬(p → q)', () => {
    for (const s of GUIDED.steps) expect(equivalent(s.f, GUIDED.start), s.expr).toBe(true);
    expect(GUIDED.steps.at(-1)!.expr).toBe('p ∧ ¬q');
  });
  it('Sc9 timeline is ascending and inside the scene', () => {
    const order = [SC9.tap, SC9.plan, SC9.practice, SC9.pickWrong, SC9.hint, SC9.pickRight, SC9.guided, ...SC9.guidedSteps, SC9.progress];
    order.forEach((t, i) => i && expect(t).toBeGreaterThan(order[i - 1]));
    expect(SC9.progress).toBeLessThan(sceneById(9).durationMs);
    SC9_EVIDENCE.forEach((e, i) => i && expect(e.at).toBeGreaterThan(SC9_EVIDENCE[i - 1].at));
  });
  it('phone progress matches the twin', () => {
    expect(PROGRESS.from).toBe(Math.round(MASTERY_INITIAL.implication * 100));
    expect(PROGRESS.to).toBe(Math.round(MASTERY_MID.implication * 100));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/scenario/content.test.ts`
Expected: FAIL with `Failed to resolve import "./sources"`.

- [ ] **Step 3: Implement** `src/scenario/sources.ts`

```ts
import type { ConceptId } from './knowledgeGraph';

export type EvidenceKind = 'structured' | 'text' | 'interaction' | 'document';
export type SourceKind = 'lms' | 'zalo' | 'whatsapp' | 'email' | 'records' | 'assessment' | 'attendance' | 'materials';

export interface RawMessage {
  id: string;
  channel: 'zalo' | 'whatsapp' | 'email';
  from: string;
  vi: string;
  evidence: string;
  concept?: ConceptId;
}

export const MESSAGES: RawMessage[] = [
  { id: 'm1', channel: 'zalo', from: 'Minh Anh', vi: 'Em vẫn chưa hiểu vì sao p → q lại khác q → p ạ.', evidence: 'Confused why p → q ≠ q → p', concept: 'implication' },
  { id: 'm2', channel: 'whatsapp', from: 'Quang Huy', vi: 'Em nộp bài tập 3 muộn một ngày được không ạ? Tuần này em bị ốm.', evidence: 'Requests extension on Assignment 3 (illness)' },
  { id: 'm3', channel: 'email', from: 'Thu Trang', vi: 'Em muốn hỏi thêm về luật De Morgan trong bài kiểm tra vừa rồi.', evidence: "Asks about De Morgan's laws from Quiz 2", concept: 'deMorgan' },
  { id: 'm4', channel: 'zalo', from: 'Minh Anh', vi: 'Em xin lỗi, tuần này em chưa kịp làm bài thực hành bảng chân trị.', evidence: 'Truth-table lab not completed', concept: 'truthTables' },
];

const msg = (id: string) => MESSAGES.find((m) => m.id === id)!;

export interface SourceWindow {
  kind: SourceKind;
  short: string;
  title: string;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  particle: EvidenceKind;
}

export const SOURCE_WINDOWS: SourceWindow[] = [
  { kind: 'lms', short: 'LMS', title: 'LMS · Gradebook · DM-2026', lines: ['Assignment 3 · 41 / 55 submitted', 'Quiz 2 · class average 61%', 'Nguyễn Minh Anh · Quiz 2: 42%'], x: 60, y: 70, w: 560, h: 260, particle: 'structured' },
  { kind: 'zalo', short: 'Zalo', title: 'Zalo · Lớp Toán rời rạc', lines: [`Minh Anh: ${msg('m1').vi}`, `Minh Anh: ${msg('m4').vi}`], x: 680, y: 40, w: 520, h: 300, particle: 'text' },
  { kind: 'whatsapp', short: 'WhatsApp', title: 'WhatsApp · DM study group', lines: [`Quang Huy: ${msg('m2').vi}`, '+ 14 unread messages'], x: 1260, y: 90, w: 560, h: 280, particle: 'text' },
  { kind: 'email', short: 'Email', title: 'Inbox · 23 unread', lines: [`Thu Trang: ${msg('m3').vi}`, 'Faculty office: Week 7 room change'], x: 1300, y: 420, w: 520, h: 260, particle: 'text' },
  { kind: 'records', short: 'Academic records', title: 'Academic Records · prior subjects', lines: ['Intro to Logic · Minh Anh: C+ (68%)', 'Calculus I · Minh Anh: B (74%)'], x: 90, y: 400, w: 520, h: 240, particle: 'structured' },
  { kind: 'assessment', short: 'Assessments', title: 'Assessment System · Quiz 2 responses', lines: ['Q4  p → q ≡ ?  · 58% incorrect', "Q7  De Morgan's law · 44% incorrect"], x: 640, y: 380, w: 560, h: 250, particle: 'structured' },
  { kind: 'attendance', short: 'Attendance', title: 'Attendance · Week 6', lines: ['Present 47 / 55', 'Minh Anh · absent from tutorial 5'], x: 180, y: 700, w: 500, h: 220, particle: 'interaction' },
  { kind: 'materials', short: 'Learning materials', title: 'Learning Materials', lines: ['Lecture 5 · Implication.pdf', 'Worksheet · Truth tables.docx'], x: 1240, y: 720, w: 520, h: 230, particle: 'document' },
];

export const EVIDENCE_ITEMS: { kind: EvidenceKind; source: string; raw: string; evidence: string }[] = [
  { kind: 'structured', source: 'Assessment · Quiz 2', raw: 'score = 0.42 (prev 0.75)', evidence: 'Assessment performance 75% → 42%' },
  { kind: 'text', source: 'Zalo', raw: msg('m1').vi, evidence: msg('m1').evidence },
  { kind: 'interaction', source: 'LMS activity log', raw: '2 activities overdue · last login 6 days ago', evidence: '2 incomplete learning activities' },
  { kind: 'structured', source: 'Quiz 2 responses', raw: 'Q4: chose q → p (6 attempts across quizzes)', evidence: 'Repeated conceptual error: converse' },
  { kind: 'document', source: 'Academic records', raw: 'Intro to Logic: C+ (68%)', evidence: 'Weak prerequisite mastery' },
];

export const TEACHER_QUESTIONS = [
  'Which students are falling behind?',
  'What are their actual knowledge gaps?',
  'Is it the current topic or prerequisite knowledge?',
  'Who needs individual attention versus group support?',
  'What intervention should happen next, and when?',
];
```

- [ ] **Step 4: Implement** `src/scenario/agents.ts`

```ts
import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { ERRORS_INITIAL, MASTERY_INITIAL } from './minhAnh';

export type AgentId = 'SAS' | 'TAS';
export type CardType = 'DIAGNOSIS' | 'PROPOSAL' | 'CHALLENGE' | 'REFINEMENT' | 'REASSESSMENT';

export interface AgentCard {
  id: string;
  from: AgentId;
  to: AgentId;
  type: CardType;
  text: string;
  /** Evidence refs: kg:<concept>, twin.mastery.<concept>, twin.errors.<concept>, course.<CLO>, resources.<id> */
  refs: string[];
}

export const COURSE_OBJECTIVES: Record<string, string> = {
  'CLO-2': 'Determine logical equivalence of compound propositions',
  'CLO-3': 'Apply equivalence laws to simplify expressions',
};

export const RESOURCES: Record<string, string> = {
  'prereq-pack': 'Prerequisite pack: logical operators',
  'implication-visual': 'Visual explainer: implication truth table',
  'worked-examples': 'Worked examples: p → q ≡ ¬p ∨ q',
  'guided-set': 'Guided exercise set (6 items)',
  'application-set': 'Application problems: equivalence laws',
  'mastery-check': 'Adaptive mastery check (8 items)',
};

export const EXCHANGES: AgentCard[] = [
  { id: 'x1', from: 'SAS', to: 'TAS', type: 'DIAGNOSIS', text: 'Student demonstrates incomplete understanding of logical operators. Evidence indicates that implication is the primary area requiring reinforcement.', refs: ['twin.errors.implication', 'kg:implication'] },
  { id: 'x2', from: 'TAS', to: 'SAS', type: 'PROPOSAL', text: 'Introduce prerequisite reinforcement followed by guided logical equivalence exercises.', refs: ['course.CLO-2', 'resources.prereq-pack'] },
  { id: 'x3', from: 'SAS', to: 'TAS', type: 'CHALLENGE', text: 'Student already demonstrates partial mastery of conjunction and disjunction. Repeating all prerequisite content may be unnecessary.', refs: ['twin.mastery.conjunction', 'twin.mastery.disjunction', 'kg:conjunction', 'kg:disjunction'] },
  { id: 'x4', from: 'TAS', to: 'SAS', type: 'REFINEMENT', text: 'Agreed. Focus reinforcement on implication and equivalence, followed by targeted application exercises.', refs: ['kg:implication', 'kg:equivalence', 'resources.worked-examples'] },
];

export const REASSESSMENT: AgentCard[] = [
  { id: 'r1', from: 'SAS', to: 'TAS', type: 'REASSESSMENT', text: 'Prerequisite understanding improved. Remaining difficulty identified in applying logical equivalence.', refs: ['twin.mastery.implication', 'kg:equivLaws'] },
  { id: 'r2', from: 'TAS', to: 'SAS', type: 'REFINEMENT', text: 'Reduce prerequisite scaffolding and introduce more challenging application exercises.', refs: ['course.CLO-3', 'resources.application-set'] },
];

/** Twin blocks SAS reads in Sc5, in order (keys match TwinPanel's TwinKey). */
export const SAS_READS = ['history', 'assessment', 'mastery', 'errors', 'activity', 'interventions'] as const;

export const SAS_DIAGNOSIS = {
  gap: 'Incomplete understanding of logical operators',
  evidence: ['Repeated errors involving implication', 'Weak prerequisite mastery', 'Inconsistent application of logical expressions'],
  state: 'Requires targeted prerequisite reinforcement',
};

export const TAS_ANALYSIS = {
  reads: ['Course learning objectives', 'Teaching materials', 'Domain knowledge', 'Learning resources', 'Instructional strategies', 'Teaching progress'],
  recommendation: 'Targeted prerequisite reinforcement before progressing to logical equivalence',
  approach: ['Visual explanations', 'Guided examples', 'Progressive exercises', 'Mastery assessment'],
};

export const SAS_CHECKS: { concept: ConceptId; label: string }[] = [
  { concept: 'conjunction', label: '∧ conjunction' },
  { concept: 'disjunction', label: '∨ disjunction' },
  { concept: 'implication', label: '→ implication' },
];

export const PLAN_DRAFT = [
  { text: 'Review ¬, ∧, ∨ (all prerequisites)', drop: true },
  { text: 'Reinforce → and ↔', drop: false },
  { text: 'Guided equivalence exercises', drop: false },
];
export const PLAN_ADDED = 'Targeted application exercises';

export const JOINT_DECISION = ['Targeted Prerequisite Reinforcement', 'Guided Application', 'Mastery Assessment'];
export const JOINT_DECISION_2 = ['Targeted Application Practice', 'Advanced Exercises', 'Mastery Assessment'];

export type RefKind = 'kg' | 'twin' | 'course' | 'resources';

/** Resolve an evidence ref to what it points at; null if it points at nothing real. */
export function refTarget(ref: string): { kind: RefKind; id: string } | null {
  if (ref.startsWith('kg:')) {
    const id = ref.slice(3);
    return CONCEPTS.some((c) => c.id === id) ? { kind: 'kg', id } : null;
  }
  const [head, sub, id] = ref.split('.');
  if (head === 'twin' && sub === 'mastery' && id !== undefined && id in MASTERY_INITIAL) return { kind: 'twin', id: `mastery.${id}` };
  if (head === 'twin' && sub === 'errors' && id !== undefined && id in ERRORS_INITIAL) return { kind: 'twin', id: `errors.${id}` };
  if (head === 'course' && sub in COURSE_OBJECTIVES) return { kind: 'course', id: sub };
  if (head === 'resources' && sub in RESOURCES) return { kind: 'resources', id: sub };
  return null;
}
```

- [ ] **Step 5: Implement** `src/scenario/orchestration.ts`

```ts
export const ENGINE_INPUTS = [
  'SAS student diagnosis', 'TAS instructional strategy', 'Digital twin context',
  'Knowledge graph relations', 'Available learning resources', 'Teacher-defined policies',
];

export const OPERATIONS = [
  { id: 'coordinate', title: 'Adaptive decision coordination', detail: 'Joint decision within teacher policy · adaptive track · auto-execute' },
  { id: 'retrieve', title: 'Resource retrieval', detail: '4 resources retrieved from the course knowledge base' },
  { id: 'assemble', title: 'Activity generation & assembly', detail: '5 activities assembled for the selected strategy' },
  { id: 'pathway', title: 'Pathway construction', detail: 'Ordered by prerequisite dependencies' },
  { id: 'deliver', title: 'Service coordination', detail: 'Scheduled and delivered to the student app' },
  { id: 'monitor', title: 'Execution monitoring', detail: 'Tracking against mastery criteria' },
];

export const STATUSES = ['DECISION READY', 'RESOURCES RETRIEVED', 'PATHWAY CREATED', 'SCHEDULED', 'DELIVERED', 'MONITORING'] as const;

export const RETRIEVED = ['implication-visual', 'worked-examples', 'guided-set', 'mastery-check'];

export const ACTIVITIES = [
  'Visual explanation of logical operators', 'Worked examples', 'Guided exercises', 'Application problems', 'Mastery assessment',
];

export const PATHWAY_INITIAL = [
  { title: 'Review logical operators', mins: 5, when: 'Today 09:00' },
  { title: 'Explore visual explanations', mins: 8, when: 'Today 12:30' },
  { title: 'Practice guided examples', mins: 10, when: 'Today 15:00' },
  { title: 'Complete a mastery assessment', mins: 10, when: 'Today 19:00' },
];

export const PATHWAY_UPDATED = [
  { title: 'Targeted application practice', mins: 10, when: 'Tomorrow 09:00' },
  { title: 'Advanced exercises', mins: 12, when: 'Tomorrow 15:00' },
  { title: 'Mastery assessment', mins: 10, when: 'Tomorrow 19:00' },
];

export const PLAN_OBJECTIVES = ['Implication', 'Logical equivalence'];
export const PLAN_OBJECTIVES_UPDATED = ['Equivalence laws', 'Application'];

export const EXPECTED_OUTCOME = 'Logical equivalence mastery ≥ 0.70 within 4 sessions';
export const MONITORING_CRITERIA = ['Mastery check score', 'Hint usage per item', 'Activity completion', 'Response time on implication items'];
```

- [ ] **Step 6: Implement** `src/scenario/simulation.ts`

```ts
export const SIM_LABEL = 'Simulated projection · illustrative';
export const TARGET = 0.75;

/** curve[i] = projected logical-equivalence mastery after i sessions. */
export const PATHWAY_A = { id: 'A', label: 'Repeat all prerequisite content', curve: [0.35, 0.42, 0.49, 0.56, 0.63, 0.69, 0.75] };
export const PATHWAY_B = { id: 'B', label: 'Target implication & equivalence, then application', curve: [0.35, 0.52, 0.66, 0.75] };
export const SELECTED = 'B';

export const sessionsToTarget = (curve: number[], target = TARGET): number => curve.findIndex((v) => v >= target);
```

- [ ] **Step 7: Implement** `src/scenario/practice.ts`

```ts
export type Expr = (p: boolean, q: boolean) => boolean;

/** Truth-table rows in display order: TT, TF, FT, FF. */
export const TT_ROWS: [boolean, boolean][] = [[true, true], [true, false], [false, true], [false, false]];

export const equivalent = (f: Expr, g: Expr): boolean => TT_ROWS.every(([p, q]) => f(p, q) === g(p, q));

export const Q1 = {
  prompt: 'Which expression is logically equivalent to p → q?',
  options: [
    { label: 'q → p', f: ((p, q) => !q || p) as Expr },
    { label: '¬p ∨ q', f: ((p, q) => !p || q) as Expr },
    { label: 'p ∧ ¬q', f: ((p, q) => p && !q) as Expr },
    { label: '¬p → ¬q', f: ((p, q) => p || !q) as Expr },
  ],
  correct: 1,
  chosenWrong: 0,
  hint: 'Check the row p = F, q = T: p → q is true, but q → p is false. Swapping the sides (the converse) changes the meaning.',
};

export const HINT_ROW = { p: false, q: true };

export const GUIDED = {
  prompt: 'Rewrite ¬(p → q) using only ∧ and ¬.',
  start: ((p, q) => !(!p || q)) as Expr,
  steps: [
    { expr: '¬(¬p ∨ q)', why: 'Replace p → q with ¬p ∨ q', f: ((p, q) => !(!p || q)) as Expr },
    { expr: '¬¬p ∧ ¬q', why: "De Morgan's law", f: ((p, q) => !!p && !q) as Expr },
    { expr: 'p ∧ ¬q', why: 'Double negation', f: ((p, q) => p && !q) as Expr },
  ],
};

/** Sc9 timeline (scene time, ms), shared by the phone and the dashboard companion view. */
export const SC9 = {
  tap: 1800,
  plan: 2400,
  practice: 6200,
  pickWrong: 8200,
  hint: 8800,
  pickRight: 11200,
  guided: 12200,
  guidedSteps: [13000, 14000, 15000],
  progress: 16200,
};

export const SC9_EVIDENCE = [
  { at: 8200, label: 'Answer q → p · incorrect (converse)' },
  { at: 8800, label: 'Hint viewed · truth-table row' },
  { at: 11200, label: 'Answer ¬p ∨ q · correct' },
  { at: 15000, label: 'Guided rewrite · 3 / 3 steps' },
  { at: 16200, label: 'Activity 3 of 4 complete' },
];

export const PROGRESS = { concept: 'Implication', from: 31, to: 52, accuracyToday: 75, done: 3, total: 4 };
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/scenario`
Expected: PASS (both scenario test files).

- [ ] **Step 9: Commit**

```bash
git add -A .
git commit -m "feat: scenario content for sources, agents, orchestration, simulation, practice" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Engine runtime: sync, clock provider, stage, overlays, styles

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`, `src/styles.css`, `src/fonts.ts`
- Create: `src/engine/sync.ts`, `src/engine/useNow.ts`, `src/engine/PlaybackProvider.tsx`, `src/engine/Stage.tsx`
- Create: `src/ui/tokens.ts`, `src/ui/Overlays.tsx`
- Test: `src/ui/overlays.test.tsx`

**Interfaces:**
- Consumes: `playback.ts` (all), `sceneById`/`SceneDef` (scenes), `fade`/`holdMs` (anim).
- Produces:
  - `sync.ts`: `AppName = 'dashboard'|'student'`, `SyncMessage = {kind:'state',state} | {kind:'hello',app} | {kind:'heartbeat',app,at}`, `CHANNEL_NAME`, `Channel {post, subscribe, close}`, `openChannel()`.
  - Clock and stage:
    - `useNow(): number` (epoch ms, updated every animation frame)
    - `PlaybackProvider({app, fallbackScene, children})`
    - `useSceneClock(): Clock {scene: SceneDef, t, slate, toggles}`
    - `Stage({width, height, background, children})`
  - `tokens.ts`: `C` (colour map), `masteryColor(m)`.
  - `Overlays.tsx`: `Overlays({scene, t, slate, toggles, variant: 'dashboard'|'phone'})`, `FOOTER_LABEL`.

- [ ] **Step 1: Create the style configuration**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
// Keep these hex values identical to src/ui/tokens.ts.
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#070E1F', panel: '#0D1A33', surface: '#13244A', line: '#22355E',
        ink: '#F4F7FF', dim: '#9AA8C7',
        cyan: '#22D3EE', royal: '#3B6CF6', twin: '#A78BFA', sas: '#60A5FA', tas: '#34D399',
        gold: '#F5B942', gap: '#F87171', mastered: '#4ADE80',
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`src/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { margin: 0; height: 100%; }
body { background: #000; overflow: hidden; font-family: Inter, sans-serif; }
```

`src/fonts.ts`:
```ts
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './styles.css';
```

`src/ui/tokens.ts`:
```ts
/** Colour tokens. Each colour stands for one architectural component across every scene. */
export const C = {
  deep: '#070E1F',
  panel: '#0D1A33',
  surface: '#13244A',
  line: '#22355E',
  ink: '#F4F7FF',
  dim: '#9AA8C7',
  cyan: '#22D3EE', // multimodal layer
  royal: '#3B6CF6', // knowledge graph
  twin: '#A78BFA', // digital twin
  sas: '#60A5FA', // Student Analysis Agent
  tas: '#34D399', // Teaching Assistance Agent
  gold: '#F5B942', // teacher governance & policy
  engine: '#FFFFFF', // orchestration engine
  gap: '#F87171',
  mastered: '#4ADE80',
} as const;

export const masteryColor = (m: number): string => (m >= 0.7 ? C.mastered : m >= 0.5 ? C.gold : C.gap);
```

- [ ] **Step 2: Write the failing test** in `src/ui/overlays.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Overlays, FOOTER_LABEL } from './Overlays';
import { sceneById } from '../scenario/scenes';
import { DEFAULT_TOGGLES } from '../engine/playback';

const render = (t: number, over: Partial<typeof DEFAULT_TOGGLES> = {}, slate = false, variant: 'dashboard' | 'phone' = 'dashboard') =>
  renderToStaticMarkup(<Overlays scene={sceneById(3)} t={t} slate={slate} toggles={{ ...DEFAULT_TOGGLES, ...over }} variant={variant} />);

describe('Overlays', () => {
  it('shows the lower-third title shortly after scene start, then hides it', () => {
    expect(render(1500)).toContain('Multimodal Foundation Models');
    expect(render(0)).not.toContain('Multimodal Foundation Models');
    expect(render(14000)).not.toContain('Multimodal Foundation Models');
  });
  it('never shows titles on the phone or when toggled off', () => {
    expect(render(1500, {}, false, 'phone')).not.toContain('Multimodal Foundation Models');
    expect(render(1500, { titles: false })).not.toContain('Multimodal Foundation Models');
  });
  it('shows the footer label unless toggled off', () => {
    expect(render(0)).toContain(FOOTER_LABEL);
    expect(render(0, { footer: false })).not.toContain(FOOTER_LABEL);
  });
  it('burns in timecode when tc is on', () => {
    expect(render(6200, { tc: true })).toContain('Sc03 00:06.2');
  });
  it('renders the slate marker only when slate is true', () => {
    expect(render(0, {}, true)).toContain('data-slate');
    expect(render(0)).not.toContain('data-slate');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/ui/overlays.test.tsx`
Expected: FAIL with `Failed to resolve import "./Overlays"`.

- [ ] **Step 4: Implement** `src/ui/Overlays.tsx`

```tsx
import { fade, holdMs } from '../engine/anim';
import { formatTime, type Toggles } from '../engine/playback';
import type { SceneDef } from '../scenario/scenes';
import { C } from './tokens';

export const FOOTER_LABEL = 'Illustrative demo data · fictional students';
const TITLE_IN = 600;

export interface OverlaysProps {
  scene: SceneDef;
  t: number;
  slate: boolean;
  toggles: Toggles;
  variant: 'dashboard' | 'phone';
}

export function Overlays({ scene, t, slate, toggles, variant }: OverlaysProps) {
  const dash = variant === 'dashboard';
  const titleEnd = TITLE_IN + holdMs(`${scene.title} ${scene.subtitle}`) + 1500;
  const titleOpacity = dash && toggles.titles && scene.title ? fade(t, TITLE_IN, titleEnd) : 0;
  return (
    <>
      {titleOpacity > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, bottom: 48, padding: '24px 120px 24px 64px', zIndex: 60, maxWidth: 1300,
            opacity: titleOpacity, transform: `translateY(${(1 - titleOpacity) * 16}px)`,
            background: 'linear-gradient(90deg, rgba(7,14,31,0.94) 60%, rgba(7,14,31,0))',
          }}
        >
          <div style={{ width: 64, height: 4, background: C.cyan, marginBottom: 14 }} />
          <div className="font-display font-extrabold" style={{ fontSize: 56, lineHeight: 1.05, color: C.ink }}>{scene.title}</div>
          {scene.subtitle && (
            <div className="font-display font-semibold" style={{ fontSize: 28, marginTop: 10, color: C.dim }}>{scene.subtitle}</div>
          )}
        </div>
      )}
      {toggles.footer && (
        <div
          className="font-sans"
          style={{ position: 'absolute', right: dash ? 32 : 10, bottom: dash ? 16 : 6, fontSize: dash ? 15 : 10, color: dash ? C.dim : '#94A3B8', zIndex: 60 }}
        >
          {FOOTER_LABEL}
        </div>
      )}
      {toggles.tc && (
        <div
          className="font-mono"
          style={{ position: 'absolute', right: 12, top: 12, fontSize: dash ? 20 : 12, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', zIndex: 70 }}
        >
          {`Sc${String(scene.id).padStart(2, '0')} ${formatTime(t)}`}
        </div>
      )}
      {slate && <div data-slate style={{ position: 'absolute', left: 0, top: 0, width: dash ? 64 : 24, height: dash ? 64 : 24, background: '#fff', zIndex: 80 }} />}
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/ui/overlays.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Implement the runtime glue.** It is browser-only and gets verified in the browser in Tasks 7–9.

`src/engine/sync.ts`:
```ts
import type { PlaybackState } from './playback';

export type AppName = 'dashboard' | 'student';

export type SyncMessage =
  | { kind: 'state'; state: PlaybackState }
  | { kind: 'hello'; app: AppName }
  | { kind: 'heartbeat'; app: AppName; at: number };

/** All windows must share one browser profile and origin for BroadcastChannel to connect them. */
export const CHANNEL_NAME = 'beyond-demo';

export interface Channel {
  post(msg: SyncMessage): void;
  subscribe(fn: (msg: SyncMessage) => void): () => void;
  close(): void;
}

export function openChannel(): Channel {
  const bc = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (msg) => bc.postMessage(msg),
    subscribe: (fn) => {
      const handler = (e: MessageEvent<SyncMessage>) => fn(e.data);
      bc.addEventListener('message', handler);
      return () => bc.removeEventListener('message', handler);
    },
    close: () => bc.close(),
  };
}
```

`src/engine/useNow.ts`:
```ts
import { useEffect, useState } from 'react';

/** Wall-clock epoch ms, refreshed every animation frame. The only render-time clock in the apps. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(Date.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return now;
}
```

`src/engine/PlaybackProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSlate, localTime, stateFromSearch, type PlaybackState, type Toggles } from './playback';
import { openChannel, type AppName } from './sync';
import { useNow } from './useNow';
import { sceneById, type SceneDef } from '../scenario/scenes';

export interface Clock {
  scene: SceneDef;
  t: number;
  slate: boolean;
  toggles: Toggles;
}

const ClockContext = createContext<Clock | null>(null);

/** Starts from the URL (standalone mode); any controller state broadcast overrides it. */
export function PlaybackProvider({ app, fallbackScene, children }: { app: AppName; fallbackScene: number; children: ReactNode }) {
  const [state, setState] = useState<PlaybackState>(() => stateFromSearch(window.location.search, Date.now(), fallbackScene));

  useEffect(() => {
    const ch = openChannel();
    const off = ch.subscribe((m) => {
      if (m.kind === 'state') setState(m.state);
    });
    ch.post({ kind: 'hello', app });
    const hb = window.setInterval(() => ch.post({ kind: 'heartbeat', app, at: Date.now() }), 1000);
    return () => {
      off();
      window.clearInterval(hb);
      ch.close();
    };
  }, [app]);

  const now = useNow();
  const scene = sceneById(state.scene);
  const clock: Clock = { scene, t: localTime(state, now, scene.durationMs), slate: isSlate(state, now), toggles: state.toggles };
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useSceneClock(): Clock {
  const c = useContext(ClockContext);
  if (!c) throw new Error('useSceneClock must be used inside PlaybackProvider');
  return c;
}
```

`src/engine/Stage.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';

function fitScale(w: number, h: number): number {
  const forced = Number(new URLSearchParams(window.location.search).get('scale'));
  return forced > 0 ? forced : Math.min(window.innerWidth / w, window.innerHeight / h);
}

/** A fixed-size logical canvas, letterboxed and scaled to the window (or to ?scale=N). */
export function Stage({ width, height, background, children }: { width: number; height: number; background: string; children: ReactNode }) {
  const [scale, setScale] = useState(() => fitScale(width, height));
  useEffect(() => {
    const onResize = () => setScale(fitScale(width, height));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width, height]);
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: width * scale, height: height * scale, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, background, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Type-check and run all tests**

Run: `npm run typecheck && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: sync channel, scene clock provider, stage and overlays" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Shared UI primitives

**Files:**
- Create: `src/ui/Panel.tsx`, `src/ui/Kpi.tsx`, `src/ui/FullSvg.tsx`, `src/ui/Conduit.tsx`, `src/ui/Camera.tsx`, `src/ui/FakeCursor.tsx`
- Create: `src/ui/AgentNode.tsx`, `src/ui/AgentPair.tsx`, `src/ui/MessageCard.tsx`, `src/ui/ParticleStream.tsx`
- Create: `src/ui/GraphView.tsx`, `src/ui/TwinPanel.tsx`, `src/ui/StudentGrid.tsx`, `src/ui/PipelineStatus.tsx`
- Test: `src/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: `anim.ts`, `tokens.ts`, `scenario/*`.
- Produces (props in the signatures):
  - Layout and SVG basics:
    - `Panel({title?, accent?, className?, style?, children})`
    - `Kpi({label, value, color?})`
    - `FullSvg({children, width?, height?})`
    - `Conduit({d, color, t, direction?, width?, opacity?})`
    - `Camera({t, keys: CamKey[], children})`, with `CamKey {t, x, y, zoom}`
    - `FakeCursor({t, keys: CursorKey[], visible?})`, with `CursorKey {t, x, y, click?}`
  - Agents:
    - `AgentNode({agent, x, y, status, pulse?, size?})`
    - `AgentPair({t, x, y, gap?, r?})`
    - `MessageCard({card, style?})`
  - Particles:
    - `ParticleStream({t, from, to, via?, start, count?, gap?, travel?, kinds?, color?})`, which returns an SVG `<g>`
    - `ParticleShape({kind, x, y, color, opacity?})`, with `ParticleKind = EvidenceKind`
  - Graph and twin:
    - `GraphView({t, width?, mastery?, masteryOpacity?, highlightNodes?, highlightEdges?, appear?, showLabels?})`, with `GRAPH_W = 1100`, `GRAPH_H = 560`
    - `TwinKey` (the union of keys in `SAS_READS`, plus `'gaps'` and `` `mastery.${ConceptId}` ``)
    - `TwinPanel({mastery, stateLabel, highlight?, glow?, width?, assessment?})`, `TwinMini({mastery, highlight?, width?})`, `MasteryBar({id, value, active})`
  - Classroom and pipeline:
    - `StudentGrid({t, highlight?, mode?: 'status'|'track'|'twin', reveal?, labels?})`, with `GRID`, `tilePos(i)`, `tileCenter(i)`
    - `PipelineStatus({statuses, reached, compact?})`

- [ ] **Step 1: Write the failing test** in `src/ui/primitives.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { Kpi } from './Kpi';
import { MessageCard } from './MessageCard';
import { AgentNode } from './AgentNode';
import { GraphView } from './GraphView';
import { TwinPanel, TwinMini } from './TwinPanel';
import { StudentGrid, tileCenter } from './StudentGrid';
import { PipelineStatus } from './PipelineStatus';
import { FakeCursor } from './FakeCursor';
import { ParticleStream } from './ParticleStream';
import { Camera } from './Camera';
import { EXCHANGES } from '../scenario/agents';
import { CONCEPTS } from '../scenario/knowledgeGraph';
import { MASTERY_INITIAL } from '../scenario/minhAnh';
import { STATUSES } from '../scenario/orchestration';

describe('ui primitives', () => {
  it('Kpi shows value and label', () => {
    const s = html(<Kpi label="Students" value={55} />);
    expect(s).toContain('55');
    expect(s).toContain('Students');
  });
  it('MessageCard shows type, route and refs', () => {
    const s = html(<MessageCard card={EXCHANGES[0]} />);
    expect(s).toContain('DIAGNOSIS');
    expect(s).toContain('kg:implication');
    expect(s).toContain('SAS');
  });
  it('AgentNode names the agent', () => {
    expect(html(<AgentNode agent="TAS" x={0} y={0} status="idle" />)).toContain('Teaching Assistance Agent');
  });
  it('GraphView renders every concept label', () => {
    const s = html(<GraphView t={0} mastery={MASTERY_INITIAL} />);
    for (const c of CONCEPTS) expect(s).toContain(c.label.replace("'", '&#x27;'));
  });
  it('TwinPanel and TwinMini show Minh Anh and mastery values', () => {
    const s = html(<TwinPanel mastery={MASTERY_INITIAL} stateLabel="Synced" />);
    expect(s).toContain('Learning Digital Twin');
    expect(s).toContain('Nguyễn Minh Anh');
    expect(s).toContain('0.31');
    expect(html(<TwinMini mastery={MASTERY_INITIAL} />)).toContain('0.80');
  });
  it('StudentGrid renders 55 tiles including MA', () => {
    const s = html(<StudentGrid t={0} />);
    expect(s.match(/data-tile/g)).toHaveLength(55);
    expect(s).toContain('MA');
    expect(tileCenter(16)).toEqual({ x: 586, y: 488 });
  });
  it('PipelineStatus renders all statuses', () => {
    const s = html(<PipelineStatus statuses={STATUSES} reached={2} />);
    for (const st of STATUSES) expect(s).toContain(st);
  });
  it('FakeCursor renders nothing when hidden', () => {
    expect(html(<FakeCursor t={0} keys={[{ t: 0, x: 0, y: 0 }]} visible={false} />)).toBe('');
  });
  it('ParticleStream has no particles before start and some during travel', () => {
    const props = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, start: 1000, count: 3 };
    expect(html(<svg><ParticleStream t={0} {...props} /></svg>)).not.toMatch(/<(rect|circle)/);
    expect(html(<svg><ParticleStream t={1500} {...props} /></svg>)).toMatch(/<(rect|circle)/);
  });
  it('Camera at identity keeps content untransformed', () => {
    expect(html(<Camera t={0} keys={[{ t: 0, x: 960, y: 540, zoom: 1 }]}><i /></Camera>)).toContain('translate(0px, 0px) scale(1)');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/primitives.test.tsx`
Expected: FAIL with `Failed to resolve import "./Kpi"`.

- [ ] **Step 3: Implement the layout primitives**

`src/ui/Panel.tsx`:
```tsx
import type { CSSProperties, ReactNode } from 'react';
import { C } from './tokens';

export function Panel({ title, accent = C.line, className = '', style, children }: { title?: string; accent?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${className}`} style={{ background: C.panel, borderColor: accent, ...style }}>
      {title && (
        <div className="mb-3 font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: accent === C.line ? C.dim : accent }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
```

`src/ui/Kpi.tsx`:
```tsx
import { C } from './tokens';

export function Kpi({ label, value, color = C.ink }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div className="font-display text-[64px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="mt-2 text-[18px] text-dim">{label}</div>
    </div>
  );
}
```

`src/ui/FullSvg.tsx`:
```tsx
import type { ReactNode } from 'react';

/** Canvas-sized, click-through SVG layer for conduits and particles (coordinates = canvas px). */
export function FullSvg({ children, width = 1920, height = 1080 }: { children: ReactNode; width?: number; height?: number }) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={height} style={{ overflow: 'visible' }}>
      {children}
    </svg>
  );
}
```

`src/ui/Conduit.tsx`:
```tsx
/** A path with a faint base stroke and dashes that flow along it as a function of t. */
export function Conduit({ d, color, t, direction = 1, width = 3, opacity = 1 }: { d: string; color: string; t: number; direction?: 1 | -1; width?: number; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <path d={d} stroke={color} strokeOpacity={0.25} strokeWidth={width} fill="none" />
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray="10 14" strokeDashoffset={-direction * t * 0.06} strokeLinecap="round" />
    </g>
  );
}
```

`src/ui/Camera.tsx`:
```tsx
import type { ReactNode } from 'react';
import { keyframes } from '../engine/anim';

export interface CamKey { t: number; x: number; y: number; zoom: number }

/** Virtual camera: (x, y) is the canvas point placed at the centre of the 1920×1080 frame. */
export function Camera({ t, keys, children }: { t: number; keys: CamKey[]; children: ReactNode }) {
  const { x, y, zoom } = keyframes(keys, t);
  return (
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${960 - x * zoom}px, ${540 - y * zoom}px) scale(${zoom})` }}>
      {children}
    </div>
  );
}
```

`src/ui/FakeCursor.tsx`:
```tsx
import { keyframes } from '../engine/anim';
import { C } from './tokens';

export interface CursorKey { t: number; x: number; y: number; click?: boolean }

const RIPPLE_MS = 500;

/** Scripted pointer: glides between keyframes; a gold ripple plays at each click key. */
export function FakeCursor({ t, keys, visible = true }: { t: number; keys: CursorKey[]; visible?: boolean }) {
  if (!visible) return null;
  const { x, y } = keyframes(keys.map(({ t: kt, x: kx, y: ky }) => ({ t: kt, x: kx, y: ky })), t);
  const click = keys.find((k) => k.click && t >= k.t && t < k.t + RIPPLE_MS);
  const rp = click ? (t - click.t) / RIPPLE_MS : 0;
  const size = 12 + 56 * rp;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${x}px, ${y}px)`, pointerEvents: 'none', zIndex: 50 }}>
      {click && (
        <div style={{ position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%', border: `3px solid ${C.gold}`, opacity: 1 - rp }} />
      )}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ position: 'absolute', left: -3, top: -2 }}>
        <path d="M3 2l7 19 2.6-7.4L20 11z" fill="#FFFFFF" stroke={C.gold} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Implement the agent primitives**

`src/ui/AgentNode.tsx`:
```tsx
import type { AgentId } from '../scenario/agents';
import { C } from './tokens';

export const agentColor = (a: AgentId): string => (a === 'SAS' ? C.sas : C.tas);
export const agentName = (a: AgentId): string => (a === 'SAS' ? 'Student Analysis Agent' : 'Teaching Assistance Agent');

/** Agent ring centred on (x, y) with its name and a live status line underneath. */
export function AgentNode({ agent, x, y, status, pulse = 0, size = 150 }: { agent: AgentId; x: number; y: number; status: string; pulse?: number; size?: number }) {
  const color = agentColor(agent);
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - 200, top: y - size / 2, width: 400 }}>
      <div
        className="flex items-center justify-center rounded-full font-display font-extrabold"
        style={{ width: size, height: size, border: `4px solid ${color}`, background: C.panel, color, fontSize: size * 0.27, boxShadow: `0 0 ${16 + 44 * pulse}px ${color}` }}
      >
        {agent}
      </div>
      <div className="mt-3 whitespace-nowrap font-display text-[22px] font-bold" style={{ color }}>{agentName(agent)}</div>
      <div className="mt-1 whitespace-nowrap font-mono text-[16px] text-dim">{status}</div>
    </div>
  );
}
```

`src/ui/AgentPair.tsx`:
```tsx
import { Conduit } from './Conduit';
import { FullSvg } from './FullSvg';
import { C } from './tokens';

/** Compact SAS+TAS pair joined by two opposite-flowing conduits. (x, y) is the SAS ring centre. */
export function AgentPair({ t, x, y, gap = 180, r = 32 }: { t: number; x: number; y: number; gap?: number; r?: number }) {
  const x2 = x + gap;
  const mid = (x + x2) / 2;
  return (
    <>
      <FullSvg>
        <Conduit d={`M${x + r} ${y - 8} Q ${mid} ${y - 44} ${x2 - r} ${y - 8}`} color={C.sas} t={t} />
        <Conduit d={`M${x2 - r} ${y + 8} Q ${mid} ${y + 44} ${x + r} ${y + 8}`} color={C.tas} t={t} />
      </FullSvg>
      {(['SAS', 'TAS'] as const).map((a, i) => (
        <div
          key={a}
          className="absolute flex items-center justify-center rounded-full font-display font-extrabold"
          style={{ left: (i ? x2 : x) - r, top: y - r, width: 2 * r, height: 2 * r, border: `3px solid ${a === 'SAS' ? C.sas : C.tas}`, color: a === 'SAS' ? C.sas : C.tas, background: C.panel, fontSize: r * 0.6 }}
        >
          {a}
        </div>
      ))}
    </>
  );
}
```

`src/ui/MessageCard.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { refTarget, type AgentCard } from '../scenario/agents';
import { agentColor } from './AgentNode';
import { C } from './tokens';

const refColor = (ref: string): string => {
  const kind = refTarget(ref)?.kind;
  return kind === 'kg' ? C.royal : kind === 'twin' ? C.twin : C.dim;
};

/** Structured agent-to-agent message: type badge, route, statement and evidence refs. */
export function MessageCard({ card, style }: { card: AgentCard; style?: CSSProperties }) {
  const from = agentColor(card.from);
  return (
    <div style={{ width: 480, borderRadius: 16, padding: 18, background: C.panel, border: `2px solid ${from}`, ...style }}>
      <div className="flex items-center justify-between font-mono text-[16px]">
        <span className="font-bold" style={{ color: from }}>{card.type}</span>
        <span className="text-dim">
          <span style={{ color: from }}>{card.from}</span> → <span style={{ color: agentColor(card.to) }}>{card.to}</span>
        </span>
      </div>
      <div className="mt-2 text-[19px] leading-snug text-ink">{card.text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.refs.map((r) => (
          <span key={r} className="rounded-md px-2 py-0.5 font-mono text-[14px]" style={{ background: C.surface, color: refColor(r) }}>{r}</span>
        ))}
      </div>
    </div>
  );
}
```

`src/ui/ParticleStream.tsx`:
```tsx
import { easeInOut, type Point } from '../engine/anim';
import type { EvidenceKind } from '../scenario/sources';
import { C } from './tokens';

export type ParticleKind = EvidenceKind;

/** Shape encodes input type: ■ structured, ▬ text, ● interaction, ▭ document. */
export function ParticleShape({ kind, x, y, color, opacity = 1 }: { kind: ParticleKind; x: number; y: number; color: string; opacity?: number }) {
  switch (kind) {
    case 'structured':
      return <rect x={x - 6} y={y - 6} width={12} height={12} fill={color} opacity={opacity} />;
    case 'text':
      return <rect x={x - 11} y={y - 3} width={22} height={6} rx={3} fill={color} opacity={opacity} />;
    case 'interaction':
      return <circle cx={x} cy={y} r={6} fill={color} opacity={opacity} />;
    case 'document':
      return <rect x={x - 6} y={y - 8} width={12} height={16} rx={2} fill="none" stroke={color} strokeWidth={2.5} opacity={opacity} />;
  }
}

const quad = (a: Point, c: Point, b: Point, s: number): Point => ({
  x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
  y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
});

export interface ParticleStreamProps {
  t: number;
  from: Point;
  to: Point;
  via?: Point;
  start: number;
  count?: number;
  gap?: number;
  travel?: number;
  kinds?: ParticleKind[];
  color?: string;
}

/** Deterministic particles: particle i departs at start + i*gap and takes `travel` ms. Render inside an <svg>. */
export function ParticleStream({ t, from, to, via, start, count = 10, gap = 140, travel = 1400, kinds = ['structured', 'text', 'interaction', 'document'], color = C.cyan }: ParticleStreamProps) {
  const ctrl = via ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const s = (t - (start + i * gap)) / travel;
        if (s < 0 || s > 1) return null;
        const p = quad(from, ctrl, to, easeInOut(s));
        return <ParticleShape key={i} kind={kinds[i % kinds.length]} x={p.x} y={p.y} color={color} opacity={Math.min(1, s * 6, (1 - s) * 6)} />;
      })}
    </g>
  );
}
```

- [ ] **Step 5: Implement the data-view primitives**

`src/ui/GraphView.tsx`:
```tsx
import { clamp } from '../engine/anim';
import { CONCEPTS, EDGES, conceptById, conceptIndex, type ConceptId, type Edge } from '../scenario/knowledgeGraph';
import { Conduit } from './Conduit';
import { C, masteryColor } from './tokens';

export const GRAPH_W = 1100;
export const GRAPH_H = 560;

export interface GraphViewProps {
  t: number;
  width?: number;
  /** Concepts listed here are filled with their mastery colour; others stay neutral. */
  mastery?: Partial<Record<ConceptId, number>>;
  masteryOpacity?: number;
  highlightNodes?: ConceptId[];
  highlightEdges?: Edge[];
  /** 0→1 reveals nodes in CONCEPTS order. */
  appear?: number;
  showLabels?: boolean;
}

export function GraphView({ t, width = GRAPH_W, mastery = {}, masteryOpacity = 1, highlightNodes = [], highlightEdges = [], appear = 1, showLabels = true }: GraphViewProps) {
  const visible = (id: ConceptId) => clamp(appear * CONCEPTS.length - conceptIndex(id));
  const isHi = (a: ConceptId, b: ConceptId) => highlightEdges.some(([x, y]) => x === a && y === b);
  return (
    <svg width={width} height={(width / GRAPH_W) * GRAPH_H} viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ overflow: 'visible' }}>
      {EDGES.map(([a, b]) => {
        const A = conceptById(a);
        const B = conceptById(b);
        const o = Math.min(visible(a), visible(b));
        return isHi(a, b) ? (
          <Conduit key={`${a}-${b}`} d={`M${A.x} ${A.y} L${B.x} ${B.y}`} color="#FFFFFF" t={t} width={4} opacity={o} />
        ) : (
          <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={C.royal} strokeOpacity={0.5 * o} strokeWidth={2} />
        );
      })}
      {CONCEPTS.map((c) => {
        const m = mastery[c.id];
        const filled = m !== undefined && masteryOpacity > 0.5;
        return (
          <g key={c.id} opacity={visible(c.id)}>
            {highlightNodes.includes(c.id) && (
              <circle cx={c.x} cy={c.y} r={42} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.6 + 0.4 * Math.sin(t / 180)} />
            )}
            <circle cx={c.x} cy={c.y} r={32} fill={C.panel} stroke={C.royal} strokeWidth={3} />
            {m !== undefined && <circle cx={c.x} cy={c.y} r={28} fill={masteryColor(m)} opacity={0.85 * masteryOpacity} />}
            <text x={c.x} y={c.y + 8} textAnchor="middle" fontSize={22} fontWeight={700} fontFamily="JetBrains Mono" fill={filled ? C.deep : C.ink}>{c.symbol}</text>
            {showLabels && <text x={c.x} y={c.y + 58} textAnchor="middle" fontSize={18} fontFamily="Inter" fill={C.dim}>{c.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
```

`src/ui/TwinPanel.tsx`:
```tsx
import type { ReactNode } from 'react';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
import { MINH_ANH, TWIN_ACTIVITY, TWIN_FOCUS, TWIN_HISTORY, TWIN_PAST_INTERVENTIONS, gaps, type Mastery } from '../scenario/minhAnh';
import type { SAS_READS } from '../scenario/agents';
import { C, masteryColor } from './tokens';

export type TwinKey = (typeof SAS_READS)[number] | 'gaps' | `mastery.${ConceptId}`;

const HI_BG = 'rgba(167,139,250,0.14)';

function Block({ title, active, children }: { title: string; active: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ border: `2px solid ${active ? C.twin : 'transparent'}`, background: active ? HI_BG : 'transparent' }}>
      <div className="mb-2 text-[15px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.twin }}>{title}</div>
      {children}
    </div>
  );
}

export function MasteryBar({ id, value, active }: { id: ConceptId; value: number; active: boolean }) {
  const c = conceptById(id);
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1" style={{ background: active ? HI_BG : 'transparent', outline: active ? `2px solid ${C.twin}` : 'none' }}>
      <span className="w-8 text-center font-mono text-[20px] text-ink">{c.symbol}</span>
      <span className="w-40 text-[17px] text-dim">{c.label}</span>
      <div className="h-3 flex-1 rounded-full" style={{ background: C.surface }}>
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: masteryColor(value) }} />
      </div>
      <span className="w-12 text-right font-mono text-[17px] text-ink">{value.toFixed(2)}</span>
    </div>
  );
}

export interface TwinPanelProps {
  mastery: Mastery;
  stateLabel: string;
  highlight?: TwinKey[];
  /** 0→1 evidence-update glow. */
  glow?: number;
  width?: number;
  assessment?: string;
}

export function TwinPanel({ mastery, stateLabel, highlight = [], glow = 0, width = 880, assessment = 'Quiz 2 · 42% (prev. 75%) · implication errors ×6' }: TwinPanelProps) {
  const on = (k: TwinKey) => highlight.includes(k);
  return (
    <div className="rounded-2xl p-5" style={{ width, background: C.panel, border: `2px solid ${C.twin}`, boxShadow: `0 0 ${12 + glow * 48}px rgba(167,139,250,${0.25 + glow * 0.5})` }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[26px] font-extrabold" style={{ color: C.twin }}>Learning Digital Twin</div>
          <div className="text-[20px] text-ink">{MINH_ANH.name} · {MINH_ANH.course}</div>
        </div>
        <span className="rounded-full px-3 py-1 font-mono text-[15px]" style={{ background: HI_BG, color: C.twin }}>{stateLabel}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Block title="Topic-level mastery" active={on('mastery')}>
            {TWIN_FOCUS.map((id) => <MasteryBar key={id} id={id} value={mastery[id]} active={on(`mastery.${id}`)} />)}
          </Block>
          <Block title="Identified gaps" active={on('gaps')}>
            <div className="flex flex-wrap gap-2">
              {gaps(mastery).map((id) => (
                <span key={id} className="rounded-md px-2 py-0.5 text-[16px]" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap }}>
                  {conceptById(id).symbol} {conceptById(id).label}
                </span>
              ))}
            </div>
          </Block>
        </div>
        <div className="space-y-3">
          <Block title="Learning history" active={on('history')}>
            {TWIN_HISTORY.map((h) => (
              <div key={h.when + h.text} className="flex gap-3 text-[16px]">
                <span className="w-24 shrink-0 text-dim">{h.when}</span>
                <span className="text-ink">{h.text}</span>
              </div>
            ))}
          </Block>
          <Block title="Assessment & errors" active={on('assessment') || on('errors')}>
            <div className="text-[16px] text-ink">{assessment}</div>
          </Block>
          <Block title="Activity pattern" active={on('activity')}>
            {TWIN_ACTIVITY.map((a) => <div key={a} className="text-[16px] text-ink">{a}</div>)}
          </Block>
          <Block title="Previous interventions" active={on('interventions')}>
            {TWIN_PAST_INTERVENTIONS.map((p) => (
              <div key={p.what} className="text-[16px] text-ink">{p.what} → <span className="text-dim">{p.outcome}</span></div>
            ))}
          </Block>
        </div>
      </div>
    </div>
  );
}

/** Compact twin used inside the agents' hub. */
export function TwinMini({ mastery, highlight = [], width = 420 }: { mastery: Mastery; highlight?: TwinKey[]; width?: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ width, background: C.panel, border: `2px solid ${C.twin}` }}>
      <div className="mb-2 font-display text-[19px] font-bold" style={{ color: C.twin }}>Digital Twin · {MINH_ANH.short}</div>
      {TWIN_FOCUS.map((id) => <MasteryBar key={id} id={id} value={mastery[id]} active={highlight.includes(`mastery.${id}`)} />)}
    </div>
  );
}
```

`src/ui/StudentGrid.tsx`:
```tsx
import { clamp } from '../engine/anim';
import { STUDENTS, initials, type Status, type Track } from '../scenario/classroom';
import { C } from './tokens';

export const GRID = { x: 64, y: 350, cell: 84, gap: 12, cols: 11 };

export const tilePos = (i: number) => ({
  x: GRID.x + (i % GRID.cols) * (GRID.cell + GRID.gap),
  y: GRID.y + Math.floor(i / GRID.cols) * (GRID.cell + GRID.gap),
});
export const tileCenter = (i: number) => {
  const p = tilePos(i);
  return { x: p.x + GRID.cell / 2, y: p.y + GRID.cell / 2 };
};

const STATUS_BORDER: Record<Status, string> = { onTrack: C.line, support: C.gold, highRisk: C.gap };
const TRACK_DOT: Record<Track, string | null> = { routine: C.engine, adaptive: C.twin, complex: C.gold, none: null };

/** 11×5 grid of the 55 learners, absolutely positioned in canvas coordinates. */
export function StudentGrid({ t, highlight = [], mode = 'status', reveal = 1, labels = {} }: { t: number; highlight?: number[]; mode?: 'status' | 'track' | 'twin'; reveal?: number; labels?: Record<number, string> }) {
  return (
    <>
      {STUDENTS.map((s) => {
        const p = tilePos(s.index);
        const o = clamp(reveal * STUDENTS.length - s.index);
        const hi = highlight.includes(s.index);
        const dot = mode === 'track' ? TRACK_DOT[s.track] : null;
        return (
          <div
            key={s.id}
            data-tile
            className="absolute flex items-center justify-center rounded-2xl font-sans text-[22px] font-semibold text-ink"
            style={{
              left: p.x, top: p.y, width: GRID.cell, height: GRID.cell, opacity: o, background: C.surface,
              border: `3px solid ${STATUS_BORDER[s.status]}`,
              boxShadow: hi ? `0 0 0 4px rgba(255,255,255,${0.55 + 0.45 * Math.sin(t / 160)})` : 'none',
            }}
          >
            {mode === 'twin' && (
              <span className="absolute inset-2 rounded-full" style={{ border: `3px solid ${C.twin}`, opacity: 0.35 + 0.35 * Math.sin(t / 300 + s.index) }} />
            )}
            {initials(s.name)}
            {dot && <span className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full" style={{ background: dot }} />}
            {labels[s.index] && (
              <span className="absolute -left-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: C.twin, color: C.deep }}>
                {labels[s.index]}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
```

`src/ui/PipelineStatus.tsx`:
```tsx
import { C } from './tokens';

/** Status chips; the first `reached` are complete and the last reached one glows. */
export function PipelineStatus({ statuses, reached, compact = false }: { statuses: readonly string[]; reached: number; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s, i) => {
        const done = i < reached;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className="rounded-lg border-2 px-3 py-1.5 font-mono font-bold"
              style={{ fontSize: compact ? 13 : 16, borderColor: done ? C.engine : C.line, color: done ? C.deep : C.dim, background: done ? C.engine : 'transparent', boxShadow: i === reached - 1 ? '0 0 18px rgba(255,255,255,0.8)' : 'none' }}
            >
              {s}
            </span>
            {i < statuses.length - 1 && <span className="font-mono" style={{ color: done ? C.engine : C.line }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests and type-check**

Run: `npx vitest run src/ui && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A .
git commit -m "feat: shared UI primitives (graph, twin, agents, grid, particles, camera, cursor)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Controller app

**Files:**
- Create: `controller.html`, `src/controller/main.tsx`, `src/controller/ControllerApp.tsx`
- Test: `src/controller/controller.test.tsx`

**Interfaces:**
- Consumes:
  - From `playback.ts`: `applyCommand`, `togglePlay`, `initialState`, `localTime`, `countdown`, `isDone`, `formatTime`, `Command`, `PlaybackState`, `Toggles`, `HANDLE_MS`.
  - From `sync.ts`: `openChannel`, `AppName`. From `useNow.ts`: `useNow`. From `scenes.ts`: `SCENES`, `sceneById`, `TOTAL_MS`.
- Produces: `ControllerApp` component (the controller window).

- [ ] **Step 1: Write the failing test** in `src/controller/controller.test.tsx`

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControllerApp } from './ControllerApp';
import { SCENES } from '../scenario/scenes';

describe('ControllerApp', () => {
  it('lists all 12 scenes with durations and the transport', () => {
    const s = renderToStaticMarkup(<ControllerApp />);
    for (const sc of SCENES) expect(s).toContain(sc.label.replace('&', '&amp;'));
    expect(s).toContain('00:12.0');
    expect(s).toContain('Play all');
    expect(s).toContain('Open dashboard window');
    expect(s).toContain('Total 03:30.0');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/controller`
Expected: FAIL with `Failed to resolve import "./ControllerApp"`.

- [ ] **Step 3: Implement** `src/controller/ControllerApp.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyCommand, countdown, formatTime, initialState, isDone, localTime, togglePlay,
  type Command, type PlaybackState, type Toggles,
} from '../engine/playback';
import { openChannel, type AppName, type Channel } from '../engine/sync';
import { useNow } from '../engine/useNow';
import { SCENES, TOTAL_MS, sceneById } from '../scenario/scenes';

const TOGGLE_LABELS: Record<keyof Toggles, string> = { titles: 'Titles', footer: 'Footer label', cursor: 'Cursor', tc: 'Timecode' };
const STANDALONE = [
  { label: 'Copy phone Sc9 autoplay URL', path: '/student.html?scene=9&autoplay' },
  { label: 'Copy dashboard Sc1 autoplay URL', path: '/dashboard.html?scene=1&autoplay' },
];

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink hover:border-dim';

export function ControllerApp() {
  const [state, setState] = useState<PlaybackState>(() => initialState(1));
  const [playAll, setPlayAll] = useState(false);
  const [seen, setSeen] = useState<Record<AppName, number>>({ dashboard: 0, student: 0 });
  const chRef = useRef<Channel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const now = useNow();

  useEffect(() => {
    const ch = openChannel();
    chRef.current = ch;
    const off = ch.subscribe((m) => {
      if (m.kind === 'hello') ch.post({ kind: 'state', state: stateRef.current });
      if (m.kind === 'heartbeat') setSeen((s) => ({ ...s, [m.app]: m.at }));
    });
    return () => {
      off();
      ch.close();
    };
  }, []);

  useEffect(() => {
    chRef.current?.post({ kind: 'state', state });
  }, [state]);

  const send = useCallback((cmd: Command) => setState((s) => applyCommand(s, cmd, Date.now())), []);

  const scene = sceneById(state.scene);

  useEffect(() => {
    if (!playAll || !state.playing || !isDone(state, now, scene.durationMs)) return;
    if (state.scene < SCENES.length) send({ type: 'start', scene: state.scene + 1, preroll: false });
    else setPlayAll(false);
  }, [now, playAll, state, scene.durationMs, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const s = stateRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        send(togglePlay(s));
      } else if (e.key === 'ArrowRight') send({ type: 'select', scene: Math.min(SCENES.length, s.scene + 1) });
      else if (e.key === 'ArrowLeft') send({ type: 'select', scene: Math.max(1, s.scene - 1) });
      else if (e.key.toLowerCase() === 'r') send({ type: 'start', scene: s.scene });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  const t = localTime(state, now, scene.durationMs);
  const cd = countdown(state, now);
  const alive = (app: AppName) => now - seen[app] < 2500;

  return (
    <div className="flex h-screen gap-6 overflow-auto bg-deep p-6 font-sans text-ink">
      <div className="w-[380px] shrink-0 space-y-1">
        <div className="mb-3 font-display text-[22px] font-extrabold">Beyond AI Tutoring · Director</div>
        {SCENES.map((s) => {
          const active = s.id === state.scene;
          return (
            <button
              key={s.id}
              onClick={() => send({ type: 'select', scene: s.id })}
              className="relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left"
              style={{ borderColor: active ? '#F5B942' : '#22355E', background: active ? '#13244A' : 'transparent' }}
            >
              {active && <span className="absolute bottom-0 left-0 h-1 bg-gold" style={{ width: `${(t / s.durationMs) * 100}%` }} />}
              <span className="font-mono text-[14px] text-dim">{String(s.id).padStart(2, '0')}</span>
              <span className="ml-3 text-[16px] font-semibold">{s.label}</span>
              <span className="float-right font-mono text-[14px] text-dim">{formatTime(s.durationMs)}</span>
            </button>
          );
        })}
        <div className="pt-2 font-mono text-[14px] text-dim">Total {formatTime(TOTAL_MS)}</div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <div className="text-[15px] uppercase tracking-widest text-dim">Scene {state.scene}</div>
          <div className="font-display text-[40px] font-extrabold">{scene.label}</div>
          <div className="font-mono text-[28px]">
            {formatTime(t)} / {formatTime(scene.durationMs)}
            {cd > 0 && <span className="ml-6 text-gold">starting in {cd}…</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={btn} onClick={() => send({ type: 'select', scene: Math.max(1, state.scene - 1) })}>⏮ Back</button>
          <button className={btn} onClick={() => send(togglePlay(state))}>{state.playing ? '⏸ Pause' : '▶ Play'}</button>
          <button className={btn} onClick={() => send({ type: 'start', scene: state.scene })}>⟲ Restart</button>
          <button className={btn} onClick={() => send({ type: 'select', scene: Math.min(SCENES.length, state.scene + 1) })}>⏭ Next</button>
          <button
            className={btn}
            onClick={() => {
              setPlayAll(true);
              send({ type: 'start', scene: 1 });
            }}
          >
            ▶▶ Play all{playAll ? ' (running)' : ''}
          </button>
        </div>

        <input
          type="range"
          className="w-full"
          min={0}
          max={scene.durationMs}
          step={100}
          value={t}
          onChange={(e) => send({ type: 'seek', t: Number(e.target.value) })}
        />

        <div className="flex flex-wrap gap-6">
          {(Object.keys(TOGGLE_LABELS) as (keyof Toggles)[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-[16px]">
              <input type="checkbox" checked={state.toggles[k]} onChange={() => send({ type: 'toggle', key: k })} />
              {TOGGLE_LABELS[k]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[16px]">
          {(['dashboard', 'student'] as AppName[]).map((app) => (
            <span key={app}>
              <span style={{ color: alive(app) ? '#4ADE80' : '#F87171' }}>{alive(app) ? '●' : '○'}</span> {app}
            </span>
          ))}
          <button className={btn} onClick={() => window.open('/dashboard.html', 'dashboard', 'width=1920,height=1080')}>Open dashboard window</button>
          <button className={btn} onClick={() => window.open('/student.html', 'student', 'width=390,height=844')}>Open student window</button>
        </div>

        <div className="flex flex-wrap gap-3">
          {STANDALONE.map((s) => (
            <button key={s.path} className={btn} onClick={() => void navigator.clipboard.writeText(window.location.origin + s.path)}>{s.label}</button>
          ))}
        </div>

        <div className="text-[14px] text-dim">Keys: Space play/pause · ← → scene · R restart with pre-roll. Keep all windows in this browser profile.</div>
      </div>
    </div>
  );
}
```

`src/controller/main.tsx`:
```tsx
import '../fonts';
import { createRoot } from 'react-dom/client';
import { ControllerApp } from './ControllerApp';

createRoot(document.getElementById('root')!).render(<ControllerApp />);
```

`controller.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Director · Beyond AI Tutoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/controller/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/controller`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`
Expected: the controller opens. Clicking scenes highlights them. Space starts a countdown of 3, then the time advances. The scrubber seeks. Both status lights show ○, because no apps are open yet.

- [ ] **Step 6: Commit**

```bash
git add -A .
git commit -m "feat: controller window with transport, play-all, scrubber, toggles and status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Student app

**Files:**
- Create: `student.html`, `src/student/main.tsx`, `src/student/StudentApp.tsx`, `src/student/frame.ts`
- Create: `src/student/screens/LockScreen.tsx`, `PlanScreen.tsx`, `PracticeScreen.tsx`, `ProgressScreen.tsx`, `Chrome.tsx`
- Test: `src/student/frame.test.ts`, `src/student/screens.test.tsx`

**Interfaces:**
- Consumes:
  - `practice.ts` (`Q1`, `HINT_ROW`, `TT_ROWS`, `GUIDED`, `SC9`, `SC9_EVIDENCE`, `PROGRESS`)
  - `orchestration.ts` (`PATHWAY_INITIAL`, `PATHWAY_UPDATED`, `PLAN_OBJECTIVES`, `PLAN_OBJECTIVES_UPDATED`), `CUES`
  - `PlaybackProvider`, `useSceneClock`, `Stage`, `Overlays`, `C`, `anim`
- Produces:
  - `StudentScreen` (union), `studentFrame(sceneId, t): StudentScreen`, `STUDENT_SHOTS: Record<number, number[]>`
  - Screen components `LockScreen`, `PlanScreen`, `PracticeScreen`, `ProgressScreen`, and from `Chrome.tsx`: `StatusBar`, `TouchDot`, `EvidencePill`

- [ ] **Step 1: Write the failing tests**

`src/student/frame.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { STUDENT_SHOTS, studentFrame } from './frame';
import { CUES, sceneById } from '../scenario/scenes';
import { SC9 } from '../scenario/practice';

describe('studentFrame', () => {
  it('idles on the lock screen in non-phone scenes', () => {
    expect(studentFrame(1, 0)).toEqual({ screen: 'lock', notification: 0 });
    expect(studentFrame(8, 5000)).toEqual({ screen: 'lock', notification: 0 });
  });
  it('lands the notification at the end of Sc7', () => {
    expect(studentFrame(7, 0)).toEqual({ screen: 'lock', notification: 0 });
    expect(studentFrame(7, CUES.sc7Notify + 1000)).toEqual({ screen: 'lock', notification: 1 });
  });
  it('walks Sc9 through lock → plan → practice → progress', () => {
    expect(studentFrame(9, SC9.tap).screen).toBe('lock');
    expect(studentFrame(9, SC9.plan + 100)).toEqual({ screen: 'plan', variant: 'initial', local: 100 });
    expect(studentFrame(9, SC9.pickWrong)).toEqual({ screen: 'practice', local: SC9.pickWrong });
    expect(studentFrame(9, SC9.progress + 50)).toEqual({ screen: 'progress', local: 50 });
  });
  it('shows the updated plan at the Sc10 cue', () => {
    expect(studentFrame(10, CUES.sc10Update - 1).screen).toBe('lock');
    expect(studentFrame(10, CUES.sc10Update + 10)).toEqual({ screen: 'plan', variant: 'updated', local: 10 });
  });
  it('student shots fall inside their scenes', () => {
    for (const [id, shots] of Object.entries(STUDENT_SHOTS)) {
      for (const t of shots) expect(t).toBeLessThanOrEqual(sceneById(Number(id)).durationMs);
    }
  });
});
```

`src/student/screens.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SC9 } from '../scenario/practice';

describe('student screens', () => {
  it('lock screen shows the notification only when present', () => {
    expect(html(<LockScreen t={0} notification={1} />)).toContain('Your personalized plan is ready');
    expect(html(<LockScreen t={0} notification={0} />)).not.toContain('Your personalized plan is ready');
  });
  it('plan screen shows the right pathway per variant', () => {
    expect(html(<PlanScreen local={5000} variant="initial" />)).toContain('Review logical operators');
    const updated = html(<PlanScreen local={5000} variant="updated" />);
    expect(updated).toContain('Plan updated');
    expect(updated).toContain('Targeted application practice');
  });
  it('practice marks the wrong answer, shows the hint, then the correct answer', () => {
    expect(html(<PracticeScreen t={SC9.pickWrong + 100} />)).toContain('Not quite');
    expect(html(<PracticeScreen t={SC9.hint + 600} />)).toContain('Hint');
    expect(html(<PracticeScreen t={SC9.pickRight + 100} />)).toContain('Correct!');
  });
  it('guided phase reveals steps ending in p ∧ ¬q', () => {
    expect(html(<PracticeScreen t={SC9.guidedSteps[2] + 900} />)).toContain('p ∧ ¬q');
  });
  it('progress counts implication mastery up to 52%', () => {
    expect(html(<ProgressScreen local={5000} />)).toContain('52%');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/student`
Expected: FAIL with `Failed to resolve import "./frame"`.

- [ ] **Step 3: Implement** `src/student/frame.ts`

```ts
import { prog } from '../engine/anim';
import { SC9 } from '../scenario/practice';
import { CUES } from '../scenario/scenes';

export type StudentScreen =
  | { screen: 'lock'; notification: number }
  | { screen: 'plan'; variant: 'initial' | 'updated'; local: number }
  | { screen: 'practice'; local: number }
  | { screen: 'progress'; local: number };

/** Which phone screen shows at scene time t. Practice uses scene time directly (SC9 constants). */
export function studentFrame(sceneId: number, t: number): StudentScreen {
  if (sceneId === 7) return { screen: 'lock', notification: prog(t, CUES.sc7Notify, 500) };
  if (sceneId === 9) {
    if (t < SC9.plan) return { screen: 'lock', notification: 1 };
    if (t < SC9.practice) return { screen: 'plan', variant: 'initial', local: t - SC9.plan };
    if (t < SC9.progress) return { screen: 'practice', local: t };
    return { screen: 'progress', local: t - SC9.progress };
  }
  if (sceneId === 10 && t >= CUES.sc10Update) return { screen: 'plan', variant: 'updated', local: t - CUES.sc10Update };
  return { screen: 'lock', notification: 0 };
}

/** Phone timestamps for the contact sheet. */
export const STUDENT_SHOTS: Record<number, number[]> = {
  7: [22500],
  9: [1800, 4500, 9500, 12000, 15800, 18500],
  10: [28500],
};
```

- [ ] **Step 4: Implement the screens**

`src/student/screens/Chrome.tsx`:
```tsx
import { fade, stepIndex } from '../../engine/anim';
import { SC9_EVIDENCE } from '../../scenario/practice';
import { C } from '../../ui/tokens';

export function StatusBar() {
  return (
    <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 font-sans text-[14px] font-semibold text-slate-900" style={{ height: 44, zIndex: 30 }}>
      <span>09:00</span>
      <span>5G ▮▮▮</span>
    </div>
  );
}

/** Scripted finger tap indicator around time `at`. */
export function TouchDot({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const o = fade(t, at - 300, at + 350, 150);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(15,23,42,0.25)', border: '2px solid rgba(255,255,255,0.9)', opacity: o, zIndex: 40 }} />;
}

/** "Evidence synced ↑" pill after each Sc9 evidence event. */
export function EvidencePill({ t }: { t: number }) {
  const i = stepIndex(t, SC9_EVIDENCE.map((e) => e.at));
  if (i < 0) return null;
  const o = fade(t, SC9_EVIDENCE[i].at, SC9_EVIDENCE[i].at + 1400, 200);
  if (o <= 0) return null;
  return (
    <div className="absolute right-4 rounded-full px-3 py-1 font-sans text-[12px] font-semibold text-white" style={{ top: 48, background: C.twin, opacity: o, zIndex: 35 }}>
      Evidence synced ↑
    </div>
  );
}
```

`src/student/screens/LockScreen.tsx`:
```tsx
import { C } from '../../ui/tokens';
import { TouchDot } from './Chrome';

export function LockScreen({ t, notification, tapAt }: { t: number; notification: number; tapAt?: number }) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: 'linear-gradient(180deg, #0B1A3A 0%, #3B6CF6 140%)' }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-white/80">Saturday, 31 October</div>
      <div className="font-display text-[84px] font-bold leading-none text-white">08:58</div>
      {notification > 0 && (
        <div className="absolute left-3 right-3 rounded-3xl p-4" style={{ top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})`, background: 'rgba(255,255,255,0.94)' }}>
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-md font-display text-[11px] font-extrabold text-white" style={{ background: C.royal }}>BT</span>
            <span className="font-semibold uppercase tracking-wide">Beyond Tutor</span>
            <span className="ml-auto">now</span>
          </div>
          <div className="mt-2 text-[17px] font-semibold text-slate-900">Your personalized plan is ready</div>
          <div className="text-[15px] leading-snug text-slate-600">4 short sessions today to strengthen implication & logical equivalence.</div>
        </div>
      )}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
```

`src/student/screens/PlanScreen.tsx`:
```tsx
import { fade } from '../../engine/anim';
import { PATHWAY_INITIAL, PATHWAY_UPDATED, PLAN_OBJECTIVES, PLAN_OBJECTIVES_UPDATED } from '../../scenario/orchestration';
import { C } from '../../ui/tokens';

export function PlanScreen({ local, variant }: { local: number; variant: 'initial' | 'updated' }) {
  const items = variant === 'initial' ? PATHWAY_INITIAL : PATHWAY_UPDATED;
  const objectives = variant === 'initial' ? PLAN_OBJECTIVES : PLAN_OBJECTIVES_UPDATED;
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="text-[15px] text-slate-500">Good morning,</div>
      <div className="text-[26px] font-bold text-slate-900">Minh Anh</div>
      {variant === 'updated' && (
        <div className="mt-3 rounded-2xl px-4 py-2 text-[14px] font-semibold" style={{ background: '#EDE9FE', color: '#6D28D9', opacity: fade(local, 100) }}>
          Plan updated · based on your progress
        </div>
      )}
      <div className="mt-4 rounded-3xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${C.royal}, #1E3A8A)` }}>
        <div className="text-[12px] uppercase tracking-wider text-white/70">Your personalized learning plan</div>
        <div className="mt-1 font-display text-[21px] font-bold">Discrete Mathematics</div>
        <div className="text-[15px] text-white/85">Topic: Logical Equivalence</div>
        <div className="mt-3 flex gap-2">
          {objectives.map((o) => <span key={o} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">{o}</span>)}
        </div>
      </div>
      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        {variant === 'initial' ? 'Learning pathway · today' : 'Next steps · tomorrow'}
      </div>
      {items.map((it, i) => {
        const o = fade(local, 300 + i * 250);
        return (
          <div key={it.title} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm" style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: C.royal }}>{i + 1}</span>
            <div>
              <div className="text-[16px] font-semibold text-slate-900">{it.title}</div>
              <div className="text-[13px] text-slate-500">{it.when} · {it.mins} min</div>
            </div>
            {i === 0 && <span className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: '#EEF2FF', color: C.royal }}>Up next</span>}
          </div>
        );
      })}
    </div>
  );
}
```

`src/student/screens/PracticeScreen.tsx`:
```tsx
import { fade } from '../../engine/anim';
import { GUIDED, HINT_ROW, Q1, SC9, TT_ROWS } from '../../scenario/practice';
import { C } from '../../ui/tokens';
import { TouchDot } from './Chrome';

const OPTION_TOP = 236;
const OPTION_STEP = 60;
const tf = (b: boolean) => (b ? 'T' : 'F');

function Question({ t }: { t: number }) {
  const wrong = t >= SC9.pickWrong;
  const right = t >= SC9.pickRight;
  return (
    <>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-slate-900">{Q1.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {Q1.options.map((o, i) => {
          const state = right && i === Q1.correct ? 'right' : wrong && !right && i === Q1.chosenWrong ? 'wrong' : 'idle';
          const style = state === 'wrong'
            ? { background: '#FEF2F2', borderColor: '#FCA5A5' }
            : state === 'right'
              ? { background: '#F0FDF4', borderColor: '#86EFAC' }
              : { background: '#FFFFFF', borderColor: '#E2E8F0' };
          return (
            <div key={o.label} className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 font-mono text-[18px] text-slate-900" style={style}>
              {o.label}
              {state === 'wrong' && <span className="font-sans text-[13px] font-semibold text-red-600">Not quite</span>}
              {state === 'right' && <span className="font-sans text-[13px] font-semibold text-green-600">Correct!</span>}
            </div>
          );
        })}
      </div>
      {t >= SC9.hint && (
        <div className="mt-4 rounded-2xl border p-4" style={{ background: '#F5F3FF', borderColor: '#DDD6FE', opacity: fade(t, SC9.hint) }}>
          <div className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: '#7C3AED' }}>Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-slate-700">{Q1.hint}</div>
          <table className="mt-3 w-full text-center font-mono text-[15px] text-slate-800">
            <thead>
              <tr className="text-slate-500"><th>p</th><th>q</th><th>p → q</th><th>q → p</th></tr>
            </thead>
            <tbody>
              {TT_ROWS.map(([p, q]) => {
                const hi = p === HINT_ROW.p && q === HINT_ROW.q;
                return (
                  <tr key={`${p}${q}`} style={{ background: hi ? '#EDE9FE' : 'transparent', fontWeight: hi ? 700 : 400 }}>
                    <td>{tf(p)}</td><td>{tf(q)}</td><td>{tf(!p || q)}</td><td>{tf(!q || p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <TouchDot t={t} at={SC9.pickWrong} x={195} y={OPTION_TOP + Q1.chosenWrong * OPTION_STEP} />
      <TouchDot t={t} at={SC9.pickRight} x={195} y={OPTION_TOP + Q1.correct * OPTION_STEP} />
    </>
  );
}

function Guided({ t }: { t: number }) {
  const last = SC9.guidedSteps[SC9.guidedSteps.length - 1];
  return (
    <>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-slate-900">{GUIDED.prompt}</div>
      <div className="mt-3 rounded-2xl bg-white p-4 font-mono text-[20px] text-slate-900 shadow-sm">¬(p → q)</div>
      {GUIDED.steps.map((s, i) => {
        const o = fade(t, SC9.guidedSteps[i]);
        return (
          <div key={s.expr} className="mt-3 rounded-2xl border border-slate-200 bg-white p-4" style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>
            <div className="text-[13px] text-slate-500">Step {i + 1} · {s.why}</div>
            <div className="mt-1 font-mono text-[20px] text-slate-900">≡ {s.expr}</div>
          </div>
        );
      })}
      {t >= last + 500 && (
        <div className="mt-4 rounded-2xl p-3 text-center text-[15px] font-semibold text-green-700" style={{ background: '#F0FDF4' }}>
          Nice work · 3 / 3 steps with fading support
        </div>
      )}
    </>
  );
}

export function PracticeScreen({ t }: { t: number }) {
  const guided = t >= SC9.guided;
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="flex items-center justify-between text-[13px] text-slate-500">
        <span>Guided practice · Implication</span>
        <span>{guided ? 2 : 1} / 2</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: guided ? '75%' : '40%', background: C.royal }} />
      </div>
      {guided ? <Guided t={t} /> : <Question t={t} />}
    </div>
  );
}
```

`src/student/screens/ProgressScreen.tsx`:
```tsx
import { countUp } from '../../engine/anim';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { PROGRESS } from '../../scenario/practice';
import { C } from '../../ui/tokens';

const R = 64;
const CIRC = 2 * Math.PI * R;

export function ProgressScreen({ local }: { local: number }) {
  const m = countUp(PROGRESS.from, PROGRESS.to, local, 300, 1500);
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="text-[26px] font-bold text-slate-900">Your progress</div>
      <div className="mt-5 flex items-center gap-5 rounded-3xl bg-white p-5 shadow-sm">
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} stroke="#EDE9FE" strokeWidth={14} fill="none" />
          <circle cx={75} cy={75} r={R} stroke={C.twin} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(m / 100) * CIRC} ${CIRC}`} transform="rotate(-90 75 75)" />
          <text x={75} y={84} textAnchor="middle" fontSize={30} fontWeight={800} fill="#0F172A" fontFamily="Manrope">{m}%</text>
        </svg>
        <div>
          <div className="text-[13px] uppercase tracking-wider text-slate-500">{PROGRESS.concept} mastery</div>
          <div className="text-[15px] text-slate-700">up from {PROGRESS.from}% this morning</div>
          <div className="mt-2 text-[15px] font-semibold text-slate-900">Accuracy today {PROGRESS.accuracyToday}%</div>
        </div>
      </div>
      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        Today · {PROGRESS.done} of {PROGRESS.total} activities complete
      </div>
      {PATHWAY_INITIAL.map((it, i) => {
        const done = i < PROGRESS.done;
        return (
          <div key={it.title} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold" style={{ background: done ? '#DCFCE7' : '#F1F5F9', color: done ? '#15803D' : '#64748B' }}>
              {done ? '✓' : i + 1}
            </span>
            <span className="text-[15px] text-slate-900">{it.title}</span>
            {!done && <span className="ml-auto text-[13px] text-slate-500">{it.when.replace('Today ', '')}</span>}
          </div>
        );
      })}
      <div className="mt-4 rounded-2xl px-4 py-3 text-[14px]" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
        Remaining objective: Logical equivalence
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement the app shell**

`src/student/StudentApp.tsx`:
```tsx
import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { SC9 } from '../scenario/practice';
import { Overlays } from '../ui/Overlays';
import { studentFrame } from './frame';
import { EvidencePill, StatusBar } from './screens/Chrome';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { ProgressScreen } from './screens/ProgressScreen';

export function StudentApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  const f = studentFrame(scene.id, t);
  return (
    <Stage width={390} height={844} background="#F8FAFC">
      {f.screen === 'lock' && <LockScreen t={t} notification={f.notification} tapAt={scene.id === 9 ? SC9.tap : undefined} />}
      {f.screen === 'plan' && <PlanScreen local={f.local} variant={f.variant} />}
      {f.screen === 'practice' && <PracticeScreen t={f.local} />}
      {f.screen === 'progress' && <ProgressScreen local={f.local} />}
      {f.screen !== 'lock' && <StatusBar />}
      {scene.id === 9 && <EvidencePill t={t} />}
      <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="phone" />
    </Stage>
  );
}
```

`src/student/main.tsx`:
```tsx
import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { StudentApp } from './StudentApp';

createRoot(document.getElementById('root')!).render(
  <PlaybackProvider app="student" fallbackScene={1}>
    <StudentApp />
  </PlaybackProvider>,
);
```

`student.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Student App · Beyond AI Tutoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/student/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/student && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`. Open `http://localhost:5173/student.html?scene=9&autoplay`.
Expected sequence:
- The notification is tapped.
- The plan appears.
- In practice, q → p is marked "Not quite", the hint table highlights the F/T row, and ¬p ∨ q is marked "Correct!".
- The guided steps appear.
- The progress ring counts up to 52%.
- The "Evidence synced ↑" pill flashes at each answer.

Then open the controller and click **Open student window**: the student status light turns ●.

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: student app (lock, plan, adaptive practice, progress) driven by scene clock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Dashboard shell, Sc1 Fragmented, and the architecture view (Sc2, Sc12)

**Files:**
- Create: `dashboard.html`, `src/dashboard/main.tsx`, `src/dashboard/DashboardApp.tsx`
- Create: `src/dashboard/scenes/types.ts`, `src/dashboard/scenes/index.ts`
- Create: `src/dashboard/scenes/Sc01Fragmented.tsx`, `src/dashboard/architecture/ArchitectureView.tsx`, `src/dashboard/scenes/Sc02Architecture.tsx`, `src/dashboard/scenes/Sc12Closing.tsx`
- Test: `src/dashboard/scenes/scenes.test.tsx`

**Interfaces:**
- Consumes: UI primitives (Task 6), `SOURCE_WINDOWS`, `TEACHER_QUESTIONS`, `SCENES`.
- Produces:
  - `SceneProps {t: number; cursor: boolean}`
  - `SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>>`, to which later tasks add entries
  - `ArchitectureView({t, mode: 'reveal'|'closing'})`

- [ ] **Step 1: Write the failing test** in `src/dashboard/scenes/scenes.test.tsx`

This file grows in later tasks. Each task appends a `describe` block.

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCENE_VIEWS } from './index';
import { SCENES, sceneById } from '../../scenario/scenes';

const render = (id: number, t: number) => {
  const View = SCENE_VIEWS[id];
  if (!View) throw new Error(`Scene ${id} not registered`);
  return renderToStaticMarkup(<View t={t} cursor />);
};

describe('registered scenes render at every shot', () => {
  it('no registered scene throws at its shots, t=0 or the end', () => {
    for (const s of SCENES) {
      if (!SCENE_VIEWS[s.id]) continue;
      for (const t of [0, ...s.shots, s.durationMs]) expect(() => render(s.id, t)).not.toThrow();
    }
  });
});

describe('Sc1 Fragmented', () => {
  it('shows the source windows and the teacher questions', () => {
    const s = render(1, 11000);
    expect(s).toContain('Zalo');
    expect(s).toContain('WhatsApp');
    expect(s).toContain('Inbox');
    expect(s).toContain('Which students are falling behind?');
    expect(s).toContain('What intervention should happen next, and when?');
  });
});

describe('Sc2 Architecture / Sc12 Closing', () => {
  it('reveals the pillars and logo', () => {
    const s = render(2, 9500);
    expect(s).toContain('Multimodal Foundation Models');
    expect(s).toContain('Knowledge Graph');
    expect(s).toContain('Learning Digital Twin');
    expect(s).toContain('BEYOND AI TUTORING');
    expect(render(2, 1000)).not.toContain('BEYOND AI TUTORING');
  });
  it('closing adds the operational components and the full tagline', () => {
    const s = render(12, sceneById(12).durationMs);
    expect(s).toContain('Intervention Orchestration Engine');
    expect(s).toContain('Teacher Command Center');
    expect(s).toContain('Student Application');
    expect(s).toContain('Dynamic Digital Twins');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Failed to resolve import "./index"`.

- [ ] **Step 3: Implement the scene contract and registry**

`src/dashboard/scenes/types.ts`:
```ts
export interface SceneProps {
  /** Scene time in ms. */
  t: number;
  /** Whether the scripted cursor is shown (controller toggle). */
  cursor: boolean;
}
```

`src/dashboard/scenes/index.ts`:
```ts
import type { ComponentType } from 'react';
import type { SceneProps } from './types';
import { Sc01Fragmented } from './Sc01Fragmented';
import { Sc02Architecture } from './Sc02Architecture';
import { Sc12Closing } from './Sc12Closing';

export const SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>> = {
  1: Sc01Fragmented,
  2: Sc02Architecture,
  12: Sc12Closing,
};
```

- [ ] **Step 4: Implement** `src/dashboard/scenes/Sc01Fragmented.tsx`

```tsx
import { fade, prog, stepIndex } from '../../engine/anim';
import { SOURCE_WINDOWS, TEACHER_QUESTIONS } from '../../scenario/sources';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const WINDOW_IN = (i: number) => 300 + i * 650;
const QUESTIONS_IN = 6800;
const QUESTION_STEP = 500;

const CURSOR: CursorKey[] = [
  { t: 2000, x: 1700, y: 1000 },
  { t: 2600, x: 300, y: 90, click: true },
  { t: 3600, x: 900, y: 60, click: true },
  { t: 4600, x: 330, y: 420, click: true },
  { t: 5600, x: 900, y: 400, click: true },
  { t: 6600, x: 1500, y: 110, click: true },
  { t: 7400, x: 1550, y: 440, click: true },
  { t: 8000, x: 1750, y: 1000 },
];
const FOCUS_ORDER = ['lms', 'zalo', 'records', 'assessment', 'whatsapp', 'email'];
const CLICK_TIMES = CURSOR.filter((k) => k.click).map((k) => k.t);

export function Sc01Fragmented({ t, cursor }: SceneProps) {
  const focused = FOCUS_ORDER[stepIndex(t, CLICK_TIMES)];
  const veil = prog(t, QUESTIONS_IN - 300, 600) * 0.7;
  return (
    <div className="absolute inset-0 bg-deep">
      {SOURCE_WINDOWS.map((w, i) => {
        const o = fade(t, WINDOW_IN(i));
        const isFocused = w.kind === focused;
        return (
          <div
            key={w.kind}
            className="absolute overflow-hidden rounded-xl border-2 shadow-2xl"
            style={{ left: w.x, top: w.y, width: w.w, height: w.h, opacity: o, transform: `translateY(${(1 - o) * 30}px)`, zIndex: isFocused ? 20 : 10 + (i % 3), background: C.panel, borderColor: isFocused ? C.ink : C.line }}
          >
            <div className="flex items-center gap-2 px-4" style={{ height: 40, background: C.surface }}>
              {[0, 1, 2].map((d) => <span key={d} className="h-3 w-3 rounded-full" style={{ background: C.line }} />)}
              <span className="ml-2 truncate text-[17px] font-semibold text-dim">{w.title}</span>
            </div>
            <div className="space-y-2 px-5 py-4">
              {w.lines.map((l) => <div key={l} className="font-sans text-[18px] leading-snug text-ink">{l}</div>)}
            </div>
          </div>
        );
      })}
      <div className="absolute inset-0" style={{ background: C.deep, opacity: veil, zIndex: 30 }} />
      <div className="absolute" style={{ left: 520, top: 250, width: 880, zIndex: 40 }}>
        {TEACHER_QUESTIONS.map((q, i) => {
          const o = fade(t, QUESTIONS_IN + i * QUESTION_STEP);
          return (
            <div key={q} className="mb-4 flex items-center gap-4 rounded-2xl border-2 px-6 py-4" style={{ opacity: o, transform: `translateX(${(1 - o) * -40}px)`, background: C.panel, borderColor: C.line }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[24px] font-extrabold" style={{ background: C.gold, color: C.deep }}>?</span>
              <span className="text-[24px] text-ink">{q}</span>
            </div>
          );
        })}
      </div>
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 2000 && t < 8200} />
    </div>
  );
}
```

- [ ] **Step 5: Implement** `src/dashboard/architecture/ArchitectureView.tsx`

```tsx
import type { ReactNode } from 'react';
import { fade, prog } from '../../engine/anim';
import { SOURCE_WINDOWS } from '../../scenario/sources';
import { AgentPair } from '../../ui/AgentPair';
import { Camera, type CamKey } from '../../ui/Camera';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { C } from '../../ui/tokens';

type BoxId = 'mm' | 'kg' | 'twin' | 'agents' | 'teacher' | 'engine' | 'student';
interface Box { id: BoxId; x: number; y: number; w: number; h: number; color: string; title: string; sub: string; pillar?: number }

const BOXES: Box[] = [
  { id: 'mm', x: 470, y: 330, w: 300, h: 420, color: C.cyan, title: 'Multimodal Foundation Models', sub: 'Interpret · Extract · Connect', pillar: 1 },
  { id: 'kg', x: 1000, y: 190, w: 340, h: 150, color: C.royal, title: 'Knowledge Graph', sub: 'Concepts · prerequisites · objectives', pillar: 2 },
  { id: 'twin', x: 1000, y: 465, w: 340, h: 150, color: C.twin, title: 'Learning Digital Twin', sub: 'Dynamic student state', pillar: 3 },
  { id: 'agents', x: 1000, y: 740, w: 340, h: 150, color: C.sas, title: 'Agentic AI', sub: '', pillar: 4 },
  { id: 'teacher', x: 1480, y: 190, w: 340, h: 150, color: C.gold, title: 'Teacher Command Center', sub: 'Policies · oversight · exceptions' },
  { id: 'engine', x: 1480, y: 465, w: 340, h: 150, color: C.engine, title: 'Intervention Orchestration Engine', sub: 'Decisions → executable workflows' },
  { id: 'student', x: 1480, y: 740, w: 340, h: 150, color: C.engine, title: 'Student Application', sub: 'Personalized pathways · evidence' },
];

const LINKS: { d: string; color: string; after: BoxId }[] = [
  { d: 'M770 540 C 880 540, 900 265, 1000 265', color: C.royal, after: 'kg' },
  { d: 'M770 540 L 1000 540', color: C.twin, after: 'twin' },
  { d: 'M770 540 C 880 540, 900 815, 1000 815', color: C.sas, after: 'agents' },
  { d: 'M1170 340 L 1170 465', color: C.royal, after: 'twin' },
  { d: 'M1170 615 L 1170 740', color: C.twin, after: 'agents' },
  { d: 'M1340 815 C 1410 815, 1410 540, 1480 540', color: C.engine, after: 'engine' },
  { d: 'M1650 340 L 1650 465', color: C.gold, after: 'engine' },
  { d: 'M1650 615 L 1650 740', color: C.engine, after: 'student' },
  { d: 'M1650 890 C 1650 1050, 620 1050, 620 750', color: C.cyan, after: 'student' },
];

const REVEAL: Record<BoxId, number> = { mm: 3200, kg: 5400, twin: 6000, agents: 6600, teacher: Infinity, engine: Infinity, student: Infinity };
const CLOSING: Record<BoxId, number> = { mm: 0, kg: 300, twin: 500, agents: 700, teacher: 1100, engine: 1300, student: 1500 };
const REVEAL_CAM: CamKey[] = [{ t: 0, x: 960, y: 540, zoom: 1 }, { t: 10800, x: 960, y: 540, zoom: 1 }, { t: 12800, x: 1170, y: 540, zoom: 2.4 }];
const STILL_CAM: CamKey[] = [{ t: 0, x: 960, y: 540, zoom: 1 }];

const pillY = (i: number) => 230 + i * 80;

function ArchBox({ box, opacity, children }: { box: Box; opacity: number; children?: ReactNode }) {
  return (
    <div className="absolute rounded-2xl border-2 p-5" style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: box.color, background: C.panel, opacity, boxShadow: `0 0 28px ${box.color}55` }}>
      {box.pillar && (
        <span className="absolute -left-4 -top-4 flex h-9 w-9 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: box.color, color: C.deep }}>{box.pillar}</span>
      )}
      <div className="font-display text-[24px] font-bold leading-tight" style={{ color: box.color }}>{box.title}</div>
      {box.sub && <div className="mt-2 text-[18px] text-dim">{box.sub}</div>}
      {children}
    </div>
  );
}

export function ArchitectureView({ t, mode }: { t: number; mode: 'reveal' | 'closing' }) {
  const appear = mode === 'reveal' ? REVEAL : CLOSING;
  const o = (id: BoxId) => fade(t, appear[id]);
  const logo = fade(t, mode === 'reveal' ? 8000 : 6000);
  const tagline = mode === 'reveal'
    ? 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Agentic Adaptation.'
    : 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.';
  const inStart = mode === 'reveal' ? 1500 : 0;
  const outStart = mode === 'reveal' ? 6000 : 0;
  return (
    <Camera t={t} keys={mode === 'reveal' ? REVEAL_CAM : STILL_CAM}>
      <FullSvg>
        {LINKS.map((l) => <Conduit key={l.d} d={l.d} color={l.color} t={t} opacity={o(l.after)} />)}
        {SOURCE_WINDOWS.map((w, i) => (
          <ParticleStream key={w.kind} t={t} from={{ x: 330, y: pillY(i) + 25 }} to={{ x: 470, y: 540 }} start={inStart + i * 120} count={mode === 'reveal' ? 8 : 22} gap={450} travel={1100} kinds={[w.particle]} />
        ))}
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 265 }} via={{ x: 900, y: 540 }} start={outStart} count={14} gap={330} color={C.royal} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 540 }} start={outStart + 150} count={14} gap={330} color={C.twin} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 815 }} via={{ x: 900, y: 540 }} start={outStart + 300} count={14} gap={330} color={C.sas} />
        {mode === 'closing' && (
          <>
            <ParticleStream t={t} from={{ x: 1340, y: 815 }} to={{ x: 1480, y: 540 }} via={{ x: 1410, y: 815 }} start={1500} count={20} gap={400} color={C.engine} />
            <ParticleStream t={t} from={{ x: 1650, y: 615 }} to={{ x: 1650, y: 740 }} start={1700} count={20} gap={400} color={C.engine} />
            <ParticleStream t={t} from={{ x: 1650, y: 890 }} to={{ x: 620, y: 750 }} via={{ x: 1135, y: 1130 }} start={1900} count={20} gap={400} travel={1800} kinds={['interaction']} />
          </>
        )}
      </FullSvg>

      {SOURCE_WINDOWS.map((w, i) => (
        <div key={w.kind} className="absolute flex items-center rounded-full border-2 px-4 text-[18px] font-semibold text-ink" style={{ left: 60, top: pillY(i), width: 270, height: 50, borderColor: C.line, background: C.surface, opacity: fade(t, i * 150) }}>
          {w.short}
        </div>
      ))}

      {BOXES.map((b) => (
        <ArchBox key={b.id} box={b} opacity={o(b.id)}>
          {b.id === 'agents' && <AgentPair t={t} x={1090 - b.x} y={840 - b.y} gap={160} r={30} />}
        </ArchBox>
      ))}

      {logo > 0 && (
        <div className="absolute left-0 right-0 text-center" style={{ top: 48, opacity: logo }}>
          <div className="font-display font-extrabold tracking-[0.18em] text-ink" style={{ fontSize: 64 }}>BEYOND AI TUTORING</div>
          <div className="mt-2 font-display font-semibold text-dim" style={{ fontSize: 24 }}>{tagline}</div>
        </div>
      )}

      {mode === 'reveal' && <div className="absolute inset-0 bg-deep" style={{ opacity: prog(t, 12000, 800) }} />}
    </Camera>
  );
}
```

Note: `AgentPair` positions are absolute inside its parent. Inside `ArchBox` they are box-relative, so the box offset is subtracted above (ring centres land at canvas (1090, 840) and (1250, 840)). Because `AgentPair`'s `FullSvg` is also box-relative, its conduits line up with the rings.

- [ ] **Step 6: Implement the two scene wrappers**

`src/dashboard/scenes/Sc02Architecture.tsx`:
```tsx
import { ArchitectureView } from '../architecture/ArchitectureView';
import type { SceneProps } from './types';

export function Sc02Architecture({ t }: SceneProps) {
  return <ArchitectureView t={t} mode="reveal" />;
}
```

`src/dashboard/scenes/Sc12Closing.tsx`:
```tsx
import { ArchitectureView } from '../architecture/ArchitectureView';
import type { SceneProps } from './types';

export function Sc12Closing({ t }: SceneProps) {
  return <ArchitectureView t={t} mode="closing" />;
}
```

- [ ] **Step 7: Implement the dashboard app shell**

`src/dashboard/DashboardApp.tsx`:
```tsx
import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { Overlays } from '../ui/Overlays';
import { C } from '../ui/tokens';
import { SCENE_VIEWS } from './scenes';

export function DashboardApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  const View = SCENE_VIEWS[scene.id];
  return (
    <Stage width={1920} height={1080} background={C.deep}>
      {View ? (
        <View t={t} cursor={toggles.cursor} />
      ) : (
        <div className="flex h-full items-center justify-center font-display text-[40px] text-dim">Scene {scene.id} · {scene.label}</div>
      )}
      <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="dashboard" />
    </Stage>
  );
}
```

`src/dashboard/main.tsx`:
```tsx
import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { DashboardApp } from './DashboardApp';

createRoot(document.getElementById('root')!).render(
  <PlaybackProvider app="dashboard" fallbackScene={3}>
    <DashboardApp />
  </PlaybackProvider>,
);
```

`dashboard.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard · Beyond AI Tutoring</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dashboard/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS and no type errors.

- [ ] **Step 9: Verify in the browser**

With `npm run dev` running:
1. Open `dashboard.html?scene=1&autoplay`. The windows cascade in, the cursor clicks through them, and the five questions appear.
2. Open `?scene=2&autoplay`. The particles flow into the multimodal layer, the three pillars appear, then the logo, then a zoom with a fade to black.
3. Open `?scene=12&autoplay`. All boxes are shown, the particles loop around, and the full tagline appears.
4. From the controller, click **Open dashboard window**. Its status light turns ●, and pressing Space in the controller plays the scene in that window.

- [ ] **Step 10: Commit**

```bash
git add -A .
git commit -m "feat: dashboard shell, Sc1 fragmented sources, architecture view for Sc2/Sc12" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Classroom Command Center (Sc3 Perceive, Sc8 Govern, Sc11 Scale)

**Files:**
- Create: `src/dashboard/command/CommandFrame.tsx`, `src/dashboard/scenes/Sc03Perceive.tsx`, `src/dashboard/scenes/Sc08Govern.tsx`, `src/dashboard/scenes/Sc11Scale.tsx`
- Modify: `src/dashboard/scenes/index.ts` (register 3, 8, 11)
- Test: append to `src/dashboard/scenes/scenes.test.tsx`

**Interfaces:**
- Consumes: `StudentGrid`, `tileCenter`, `Kpi`, `Panel`, `PipelineStatus`, `ParticleStream`, `FakeCursor`, `Camera`, `classroom.ts`, `sources.ts` (`EVIDENCE_ITEMS`), `agents.ts` (`SAS_DIAGNOSIS`, `JOINT_DECISION`), `orchestration.ts` (`STATUSES`, `EXPECTED_OUTCOME`, `MONITORING_CRITERIA`).
- Produces: `CommandFrame({t, gridMode, highlight, kpis, kpiExtra?, labels?, right})`, plus scenes `Sc03Perceive`, `Sc08Govern`, `Sc11Scale`.

- [ ] **Step 1: Append failing tests** to `src/dashboard/scenes/scenes.test.tsx`

```tsx
describe('Sc3 Perceive', () => {
  it('shows KPIs, extracted evidence and Minh Anh profile', () => {
    const s = render(3, 14000);
    expect(s).toContain('Classroom Command Center');
    expect(s).toContain('Need support');
    expect(s).toContain('Confused why p → q ≠ q → p');
    expect(s).toContain('Nguyễn Minh Anh');
    expect(s).toContain('75% → 42%');
  });
});

describe('Sc8 Govern', () => {
  it('shows the portfolio and the edited escalation rule', () => {
    const before = render(8, 3000);
    expect(before).toContain('Routine');
    expect(before).toContain('31');
    expect(before).toContain('3 sessions');
    const after = render(8, 6000);
    expect(after).toContain('2 sessions');
    expect(after).toContain('Policy updated');
  });
  it('opens Minh Anh intervention summary', () => {
    const s = render(8, 13500);
    expect(s).toContain('Intervention summary');
    expect(s).toContain('MONITORING');
    expect(s).toContain('Logical equivalence mastery ≥ 0.70');
  });
});

describe('Sc11 Scale', () => {
  it('shows parallel interventions and outcomes', () => {
    const s = render(11, 13500);
    expect(s).toContain('Visual scaffolding');
    expect(s).toContain('Teacher-supported intervention');
    expect(s).toContain('Improved learning');
    expect(s).toContain('Guided conceptual practice');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Scene 3 not registered`.

- [ ] **Step 3: Implement** `src/dashboard/command/CommandFrame.tsx`

```tsx
import type { ReactNode } from 'react';
import { GROUPS, HEATMAP, TOPICS } from '../../scenario/classroom';
import { Kpi } from '../../ui/Kpi';
import { StudentGrid } from '../../ui/StudentGrid';
import { C, masteryColor } from '../../ui/tokens';

export interface KpiValues { total: number; needSupport: number; highRisk: number }

export interface CommandFrameProps {
  t: number;
  gridMode: 'status' | 'track' | 'twin';
  highlight: number[];
  kpis: KpiValues;
  kpiExtra?: { label: string; value: number; color: string };
  labels?: Record<number, string>;
  /** Right column content (canvas coordinates; usually x ≥ 1140). */
  right: ReactNode;
  gridReveal?: number;
}

/** Shared Command Center chrome: header, KPI row, 55-learner grid, topic heatmap. */
export function CommandFrame({ t, gridMode, highlight, kpis, kpiExtra, labels, right, gridReveal = 1 }: CommandFrameProps) {
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-10" style={{ height: 88, borderBottom: `1px solid ${C.line}`, background: C.panel }}>
        <div className="flex items-center gap-5">
          <span className="font-display text-[30px] font-extrabold text-ink">Classroom Command Center</span>
          <span className="rounded-full px-4 py-1 text-[18px]" style={{ background: C.surface, color: C.dim }}>Discrete Mathematics · DM-2026 · Week 6</span>
        </div>
        <span className="rounded-full border-2 px-4 py-1 text-[18px] font-semibold" style={{ borderColor: C.gold, color: C.gold }}>Lecturer view</span>
      </div>

      <div className="absolute flex gap-20" style={{ left: 64, top: 112 }}>
        <Kpi label="Students monitored" value={kpis.total} />
        <Kpi label="Need support" value={kpis.needSupport} color={C.gold} />
        <Kpi label="High risk" value={kpis.highRisk} color={C.gap} />
        {kpiExtra && <Kpi label={kpiExtra.label} value={kpiExtra.value} color={kpiExtra.color} />}
      </div>

      <div className="absolute rounded-2xl border-2" style={{ left: 40, top: 280, width: 1080, height: 560, borderColor: C.line, background: C.panel }}>
        <div className="px-6 pt-4 font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Learners · 55</div>
      </div>
      <StudentGrid t={t} highlight={highlight} mode={gridMode} reveal={gridReveal} labels={labels} />

      <div className="absolute rounded-2xl border-2 px-6 py-4" style={{ left: 40, top: 860, width: 1080, height: 190, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Topic mastery by tutorial group</div>
        <div className="mt-3 flex gap-3">
          {TOPICS.map((topic, ti) => (
            <div key={topic} style={{ width: 166 }}>
              <div className="truncate text-[16px] text-ink">{topic}</div>
              <div className="mt-2 flex gap-1">
                {GROUPS.map((g, gi) => (
                  <span key={g} className="rounded" style={{ width: 30, height: 30, background: masteryColor(HEATMAP[ti][gi]), opacity: 0.35 + 0.65 * HEATMAP[ti][gi] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {right}
    </div>
  );
}
```

- [ ] **Step 4: Implement** `src/dashboard/scenes/Sc03Perceive.tsx`

```tsx
import { countUp, fade, prog, pulse } from '../../engine/anim';
import { kpis } from '../../scenario/classroom';
import { MINH_ANH } from '../../scenario/minhAnh';
import { EVIDENCE_ITEMS } from '../../scenario/sources';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleShape, ParticleStream } from '../../ui/ParticleStream';
import { tileCenter } from '../../ui/StudentGrid';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const ITEM_T = (i: number) => 1500 + i * 1300;
const ITEM_Y = (i: number) => 350 + i * 128;
const PROFILE_T = 10000;
const CURSOR: CursorKey[] = [
  { t: 8400, x: 1500, y: 980 },
  { t: 9700, x: 586, y: 488, click: true },
  { t: 11000, x: 700, y: 620 },
];
const PROFILE_ROWS = [
  { label: 'Assessment performance', value: `${MINH_ANH.scorePrev}% → ${MINH_ANH.scoreNow}%` },
  { label: 'Incomplete learning activities', value: String(MINH_ANH.incompleteActivities) },
  { label: 'Repeated conceptual errors', value: 'Implication · chose q → p ×6' },
  { label: 'Prerequisite mastery', value: 'Weak · propositional logic' },
];

export function Sc03Perceive({ t, cursor }: SceneProps) {
  const k = kpis();
  const target = tileCenter(MINH_ANH.index);
  const beats = EVIDENCE_ITEMS.map((_, i) => ITEM_T(i) + 1800);
  const profile = prog(t, PROFILE_T, 600);
  const right = (
    <>
      <div className="absolute rounded-2xl border-2" style={{ left: 1140, top: 280, width: 740, height: 760, borderColor: C.cyan, background: C.panel }}>
        <div className="px-6 pt-4 font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.cyan }}>Multimodal ingestion · live</div>
      </div>
      {EVIDENCE_ITEMS.map((item, i) => {
        const o = fade(t, ITEM_T(i));
        const ev = fade(t, ITEM_T(i) + 700);
        return (
          <div key={item.raw} className="absolute" style={{ left: 1164, top: ITEM_Y(i), width: 692, opacity: o }}>
            <div className="flex items-center gap-3">
              <svg width={24} height={24}><ParticleShape kind={item.kind} x={12} y={12} color={C.cyan} /></svg>
              <span className="text-[16px] font-semibold text-dim">{item.source}</span>
            </div>
            <div className="mt-1 truncate font-sans text-[17px] text-dim">{item.raw}</div>
            <div className="mt-1 inline-block rounded-lg border-2 px-3 py-1 text-[18px] text-ink" style={{ borderColor: C.cyan, opacity: ev }}>→ {item.evidence}</div>
          </div>
        );
      })}
      <FullSvg>
        {EVIDENCE_ITEMS.map((item, i) => (
          <ParticleStream key={item.raw} t={t} from={{ x: 1164, y: ITEM_Y(i) + 90 }} to={target} via={{ x: 900, y: ITEM_Y(i) }} start={ITEM_T(i) + 900} count={3} gap={150} travel={900} kinds={[item.kind]} />
        ))}
      </FullSvg>
      {profile > 0 && (
        <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1140 + (1 - profile) * 200, top: 280, width: 740, height: 760, opacity: profile, borderColor: C.gap, background: C.panel, zIndex: 20 }}>
          <div className="font-sans text-[32px] font-bold text-ink">{MINH_ANH.name}</div>
          <div className="mt-1 text-[19px] text-dim">{MINH_ANH.course} · Topic: {MINH_ANH.topic}</div>
          <span className="mt-4 inline-block rounded-full px-4 py-1 text-[17px] font-semibold" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap }}>Emerging learning concern</span>
          <div className="mt-6 space-y-5">
            {PROFILE_ROWS.map((r, i) => (
              <div key={r.label} style={{ opacity: fade(t, PROFILE_T + 400 + i * 400) }}>
                <div className="text-[17px] text-dim">{r.label}</div>
                <div className="font-display text-[28px] font-bold text-ink">{r.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-[20px] font-semibold" style={{ color: C.twin, opacity: fade(t, 12500) }}>Opening learning digital twin →</div>
        </div>
      )}
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 8400 && t < 12000} />
    </>
  );
  const flagged = t >= 8200 || pulse(t, beats, 700) > 0;
  return (
    <CommandFrame
      t={t}
      gridMode="status"
      highlight={flagged ? [MINH_ANH.index] : []}
      gridReveal={prog(t, 0, 1200)}
      kpis={{ total: countUp(0, k.total, t, 300), needSupport: countUp(0, k.needSupport, t, 400), highRisk: countUp(0, k.highRisk, t, 500) }}
      right={right}
    />
  );
}
```

- [ ] **Step 5: Implement** `src/dashboard/scenes/Sc08Govern.tsx`

```tsx
import type { ReactNode } from 'react';
import { fade, prog } from '../../engine/anim';
import { JOINT_DECISION, SAS_DIAGNOSIS } from '../../scenario/agents';
import { POLICY_RULES, kpis, portfolio } from '../../scenario/classroom';
import { MINH_ANH, MASTERY_INITIAL } from '../../scenario/minhAnh';
import { EXPECTED_OUTCOME, MONITORING_CRITERIA, STATUSES } from '../../scenario/orchestration';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const EDIT_T = 4300;
const DRAWER_T = 8600;
const CURSOR: CursorKey[] = [
  { t: 3000, x: 1200, y: 980 },
  { t: EDIT_T, x: 1760, y: 806, click: true },
  { t: 7000, x: 1500, y: 700 },
  { t: 8200, x: 586, y: 488, click: true },
  { t: 9500, x: 900, y: 650 },
];
const COLUMNS = [
  { key: 'routine', title: 'Routine', desc: 'Automatically delivered · monitored', color: C.engine },
  { key: 'adaptive', title: 'Adaptive', desc: 'Adjusted with new learning evidence', color: C.twin },
  { key: 'complex', title: 'Complex', desc: 'Persistent difficulty · teacher involvement', color: C.gold },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Sc08Govern({ t, cursor }: SceneProps) {
  const pf = portfolio();
  const edited = t >= EDIT_T + 300;
  const drawer = prog(t, DRAWER_T, 600);
  const right = (
    <>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 280, width: 740, height: 340, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Intervention portfolio</div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.key} className="rounded-xl border-2 p-4" style={{ borderColor: c.color }}>
              <div className="font-display text-[56px] font-extrabold leading-none" style={{ color: c.color }}>{pf[c.key]}</div>
              <div className="mt-2 font-display text-[22px] font-bold text-ink">{c.title}</div>
              <div className="mt-1 text-[16px] text-dim">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 640, width: 740, height: 400, borderColor: C.gold, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.gold }}>Intervention policy · teacher-defined</div>
        {POLICY_RULES.map((r) => {
          const changed = r.before !== r.after && edited;
          return (
            <div key={r.id} className="mt-3 flex items-center justify-between rounded-xl px-4" style={{ height: 80, background: C.surface, outline: changed ? `2px solid ${C.gold}` : 'none' }}>
              <span className="text-[18px] text-ink">{r.label}</span>
              <span className="rounded-lg border-2 px-3 py-1 font-mono text-[18px] font-bold" style={{ borderColor: C.gold, color: changed ? C.deep : C.gold, background: changed ? C.gold : 'transparent' }}>
                {edited ? r.after : r.before}
              </span>
            </div>
          );
        })}
        <div className="mt-4 text-[17px] font-semibold" style={{ color: C.gold, opacity: fade(t, EDIT_T + 500, 7600) }}>
          Policy updated · applies to {pf.routine + pf.adaptive + pf.complex} active interventions
        </div>
      </div>
      {drawer > 0 && (
        <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1140 + (1 - drawer) * 760, top: 100, width: 740, height: 940, opacity: drawer, borderColor: C.twin, background: C.panel, zIndex: 20 }}>
          <div className="font-display text-[28px] font-extrabold text-ink">Intervention summary</div>
          <div className="font-sans text-[19px] text-dim">{MINH_ANH.name} · adaptive track</div>
          <Section title="Digital twin state">
            <div className="text-[18px] text-ink">Implication {MASTERY_INITIAL.implication.toFixed(2)} · Equivalence {MASTERY_INITIAL.equivalence.toFixed(2)} · <span style={{ color: C.twin }}>monitoring</span></div>
          </Section>
          <Section title="Diagnosis (SAS)">
            <div className="text-[18px] text-ink">{SAS_DIAGNOSIS.gap}</div>
            {SAS_DIAGNOSIS.evidence.map((e) => <div key={e} className="text-[17px] text-dim">• {e}</div>)}
          </Section>
          <Section title="Intervention pathway">
            <div className="flex flex-wrap items-center gap-2 text-[17px]">
              {JOINT_DECISION.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-lg px-3 py-1 text-ink" style={{ background: C.surface }}>{s}</span>
                  {i < JOINT_DECISION.length - 1 && <span className="text-dim">→</span>}
                </span>
              ))}
            </div>
          </Section>
          <Section title="Execution status">
            <PipelineStatus statuses={STATUSES} reached={STATUSES.length} compact />
          </Section>
          <Section title="Expected outcome">
            <div className="text-[18px] text-ink">{EXPECTED_OUTCOME}</div>
          </Section>
          <Section title="Monitoring criteria">
            <div className="text-[18px] text-ink">{MONITORING_CRITERIA.join(' · ')}</div>
          </Section>
        </div>
      )}
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 3000 && t < 10000} />
    </>
  );
  return (
    <CommandFrame
      t={t}
      gridMode="track"
      highlight={t >= 8200 ? [MINH_ANH.index] : []}
      kpis={kpis()}
      kpiExtra={{ label: 'Active interventions', value: pf.routine + pf.adaptive + pf.complex, color: C.twin }}
      right={right}
    />
  );
}
```

- [ ] **Step 6: Implement** `src/dashboard/scenes/Sc11Scale.tsx`

```tsx
import { countUp, fade, prog } from '../../engine/anim';
import { EFFECTIVENESS, KPIS_AFTER, OUTCOMES_AFTER, PORTFOLIO_AFTER, SCALE_STUDENTS, STUDENTS, kpis, portfolio } from '../../scenario/classroom';
import { MINH_ANH } from '../../scenario/minhAnh';
import { Camera, type CamKey } from '../../ui/Camera';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { tileCenter } from '../../ui/StudentGrid';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const ma = tileCenter(MINH_ANH.index);
const CAM: CamKey[] = [
  { t: 0, x: ma.x, y: ma.y, zoom: 5 },
  { t: 700, x: ma.x, y: ma.y, zoom: 5 },
  { t: 3600, x: 960, y: 540, zoom: 1 },
];
const ROW_T = (i: number) => 4000 + i * 500;
const OUTCOME_T = 7500;
const BAR_T = (i: number) => 9000 + i * 500;
const KPI_T = 11000;

export function Sc11Scale({ t }: SceneProps) {
  const k = kpis();
  const pf = portfolio();
  const labels: Record<number, string> = {};
  SCALE_STUDENTS.forEach((s, i) => { if (t >= ROW_T(i)) labels[s.index] = s.letter; });
  const outcomes = [
    { label: 'Improved learning', value: OUTCOMES_AFTER.improved, color: C.mastered },
    { label: 'Require adjustment', value: OUTCOMES_AFTER.adjust, color: C.gold },
    { label: 'Teacher attention', value: OUTCOMES_AFTER.teacherAttention, color: C.gap },
  ];
  const right = (
    <>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 280, width: 740, height: 360, borderColor: C.twin, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.twin }}>Coordinated interventions · in parallel</div>
        {SCALE_STUDENTS.map((s, i) => (
          <div key={s.letter} className="mt-3 flex items-center gap-3" style={{ opacity: fade(t, ROW_T(i)) }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: C.twin, color: C.deep }}>{s.letter}</span>
            <span className="w-44 truncate font-sans text-[17px] text-ink">{STUDENTS[s.index].name}</span>
            <span className="text-[17px]" style={{ color: C.twin }}>{s.need}</span>
            <span className="text-dim">→</span>
            <span className="rounded-lg px-2 py-0.5 text-[17px] text-ink" style={{ background: C.surface }}>{s.intervention}</span>
          </div>
        ))}
      </div>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 660, width: 740, height: 380, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Class intervention report · updated</div>
        <div className="mt-3 flex gap-10">
          {outcomes.map((o) => (
            <div key={o.label}>
              <div className="font-display text-[52px] font-extrabold leading-none" style={{ color: o.color }}>{countUp(0, o.value, t, OUTCOME_T)}</div>
              <div className="mt-1 text-[17px] text-dim">{o.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {EFFECTIVENESS.map((e, i) => (
            <div key={e.label} className="flex items-center gap-3">
              <span className="w-64 text-[17px] text-ink">{e.label}</span>
              <div className="h-3 flex-1 rounded-full" style={{ background: C.surface }}>
                <div className="h-full rounded-full" style={{ width: `${e.value * prog(t, BAR_T(i), 900)}%`, background: C.tas }} />
              </div>
              <span className="w-12 text-right font-mono text-[17px] text-ink">{countUp(0, e.value, t, BAR_T(i), 900)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[16px] text-dim">
          Routine {countUp(pf.routine, PORTFOLIO_AFTER.routine, t, 10500)} · Adaptive {countUp(pf.adaptive, PORTFOLIO_AFTER.adaptive, t, 10500)} · Complex {countUp(pf.complex, PORTFOLIO_AFTER.complex, t, 10500)}
        </div>
      </div>
      <FullSvg>
        {SCALE_STUDENTS.map((s, i) => (
          <ParticleStream key={s.letter} t={t} from={tileCenter(s.index)} to={{ x: 1140, y: 760 }} via={{ x: 1130, y: tileCenter(s.index).y }} start={6500 + i * 200} count={8} gap={700} travel={1200} kinds={['interaction', 'structured']} />
        ))}
      </FullSvg>
    </>
  );
  return (
    <Camera t={t} keys={CAM}>
      <CommandFrame
        t={t}
        gridMode="twin"
        highlight={SCALE_STUDENTS.filter((_, i) => t >= ROW_T(i)).map((s) => s.index)}
        labels={labels}
        kpis={{ total: k.total, needSupport: countUp(k.needSupport, KPIS_AFTER.needSupport, t, KPI_T), highRisk: countUp(k.highRisk, KPIS_AFTER.highRisk, t, KPI_T) }}
        right={right}
      />
    </Camera>
  );
}
```

- [ ] **Step 7: Register the scenes** by replacing the whole of `src/dashboard/scenes/index.ts`

```ts
import type { ComponentType } from 'react';
import type { SceneProps } from './types';
import { Sc01Fragmented } from './Sc01Fragmented';
import { Sc02Architecture } from './Sc02Architecture';
import { Sc03Perceive } from './Sc03Perceive';
import { Sc08Govern } from './Sc08Govern';
import { Sc11Scale } from './Sc11Scale';
import { Sc12Closing } from './Sc12Closing';

export const SCENE_VIEWS: Partial<Record<number, ComponentType<SceneProps>>> = {
  1: Sc01Fragmented,
  2: Sc02Architecture,
  3: Sc03Perceive,
  8: Sc08Govern,
  11: Sc11Scale,
  12: Sc12Closing,
};
```

- [ ] **Step 8: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS and no type errors. If `tsc` flags the `STUDENTS` import in `Sc03Perceive.tsx`, delete that import and the `void STUDENTS;` line.

- [ ] **Step 9: Verify in the browser**

Play `dashboard.html?scene=3&autoplay`, `?scene=8&autoplay` and `?scene=11&autoplay`.
- Sc3: the KPIs count to 55 / 12 / 5. The evidence items convert one by one and their particles fly to the MA tile. The cursor clicks MA and the profile slides in.
- Sc8: the gold cursor edits "3 sessions" to "2 sessions" and the toast appears. Clicking MA opens the summary drawer.
- Sc11: the view starts zoomed into the MA tile, which shows a twin ring, then pulls out. The A–E labels appear, particles flow right, the counters tick, and Need support goes from 12 to 9.

- [ ] **Step 10: Commit**

```bash
git add -A .
git commit -m "feat: Classroom Command Center scenes (perceive, govern, scale)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Sc4 Represent and the Sc9 companion view

**Files:**
- Create: `src/dashboard/scenes/Sc04Represent.tsx`, `src/dashboard/scenes/Sc09Experience.tsx`
- Modify: `src/dashboard/scenes/index.ts` (register 4, 9)
- Test: append to `src/dashboard/scenes/scenes.test.tsx`

**Interfaces:**
- Consumes:
  - UI: `GraphView`, `TwinPanel`, `TwinKey`, `Conduit`, `FullSvg`, `ParticleStream`, `ParticleShape`
  - Scenario: `pathEdges`, `conceptById`, `MASTERY_PRIOR`, `MASTERY_INITIAL`, `MASTERY_MID`, `lerpMastery`, `SAS_READS`, `SC9_EVIDENCE`, `PATHWAY_INITIAL`
- Produces: `Sc04Represent`, `Sc09Experience`.

- [ ] **Step 1: Append failing tests**

```tsx
describe('Sc4 Represent', () => {
  it('shows the knowledge graph, then the twin with updated evidence', () => {
    const early = render(4, 5500);
    expect(early).toContain('Knowledge Graph');
    expect(early).toContain('Prerequisite gap → Implication');
    const late = render(4, 13500);
    expect(late).toContain('Learning Digital Twin');
    expect(late).toContain('Updated · new evidence');
    expect(late).toContain('Grounded representation');
  });
});

describe('Sc9 Experience (dashboard companion)', () => {
  it('streams evidence from the student device into the twin', () => {
    const s = render(9, 17000);
    expect(s).toContain("Live evidence · Minh Anh's device");
    expect(s).toContain('Answer ¬p ∨ q · correct');
    expect(s).toContain('0.52');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Scene 4 not registered`.

- [ ] **Step 3: Implement** `src/dashboard/scenes/Sc04Represent.tsx`

```tsx
import { easeInOut, fade, lerp, prog, pulse, stepIndex } from '../../engine/anim';
import { SAS_READS } from '../../scenario/agents';
import { conceptById, pathEdges } from '../../scenario/knowledgeGraph';
import { MASTERY_INITIAL, MASTERY_PRIOR, lerpMastery } from '../../scenario/minhAnh';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { GraphView } from '../../ui/GraphView';
import { ParticleStream } from '../../ui/ParticleStream';
import { TwinPanel, type TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const SHRINK_T = 7000;
const TWIN_IN_T = 7500;
const EVIDENCE_T = 10400;
const BRIDGE_T = 12600;
const READ_T = SAS_READS.map((_, i) => 9000 + i * 700);
const PATH = pathEdges('implication', 'equivalence');
const TITLE_H = 50;
const imp = conceptById('implication');

export function Sc04Represent({ t }: SceneProps) {
  const s = prog(t, SHRINK_T, 1500, easeInOut);
  const left = lerp(410, 40, s);
  const top = lerp(250, 300, s);
  const scale = lerp(1, 0.72, s);
  const node = { x: left + imp.x * scale, y: top + (TITLE_H + imp.y) * scale };
  const twinX = lerp(1920, 1000, prog(t, TWIN_IN_T, 1000));
  const readIdx = stepIndex(t, READ_T);
  const highlight: TwinKey[] = readIdx >= 0 && t < 13300 ? [SAS_READS[readIdx]] : [];
  if (t >= EVIDENCE_T && t < EVIDENCE_T + 1500) highlight.push('mastery.implication');
  const mastery = lerpMastery(MASTERY_PRIOR, MASTERY_INITIAL, prog(t, EVIDENCE_T, 800));
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left, top, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <div className="font-display text-[26px] font-extrabold" style={{ color: C.royal, height: TITLE_H }}>Discrete Mathematics · Knowledge Graph</div>
        <GraphView
          t={t}
          appear={prog(t, 0, 1500)}
          mastery={MASTERY_INITIAL}
          masteryOpacity={prog(t, 1800, 800)}
          highlightNodes={t >= 3600 ? ['implication'] : []}
          highlightEdges={t >= 4200 ? PATH : []}
        />
        <div className="absolute rounded-lg border-2 px-3 py-1 text-[20px] font-semibold text-ink" style={{ left: imp.x + 50, top: TITLE_H + imp.y + 60, borderColor: C.gap, background: C.panel, opacity: fade(t, 4800, SHRINK_T + 300) }}>
          Prerequisite gap → Implication
        </div>
      </div>

      {[
        { text: 'Quiz 2 · Q4 chose q → p (×6)', y: 600 },
        { text: 'Zalo · "chưa hiểu vì sao p → q khác q → p"', y: 690 },
      ].map((chip, i) => (
        <div key={chip.text} className="absolute rounded-lg border-2 px-3 py-2 font-sans text-[18px] text-ink" style={{ left: 40, top: chip.y, width: 340, borderColor: C.cyan, background: C.panel, opacity: fade(t, 3000 + i * 300, SHRINK_T) }}>
          {chip.text}
        </div>
      ))}

      <FullSvg>
        <Conduit d={`M380 650 C 520 650, 560 ${node.y}, ${node.x - 32} ${node.y}`} color={C.cyan} t={t} opacity={fade(t, 3600, SHRINK_T)} />
        <ParticleStream t={t} from={{ x: 760, y: 640 }} to={{ x: 1000, y: 520 }} start={9600} count={8} gap={150} travel={800} />
        <Conduit d={`M${node.x + 30} ${node.y} C 600 ${node.y}, 760 560, 1000 560`} color={C.royal} t={t} width={4} opacity={fade(t, BRIDGE_T)} />
      </FullSvg>
      <div className="absolute font-display text-[20px] font-bold" style={{ left: 560, top: 520, color: C.royal, opacity: fade(t, BRIDGE_T + 300) }}>Grounded representation</div>

      <div className="absolute" style={{ left: twinX, top: 110 }}>
        <TwinPanel
          mastery={mastery}
          stateLabel={t < EVIDENCE_T ? 'Synced · Week 5' : 'Updated · new evidence'}
          highlight={highlight}
          glow={pulse(t, [EVIDENCE_T], 1200)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement** `src/dashboard/scenes/Sc09Experience.tsx`

```tsx
import { fade, prog, pulse } from '../../engine/anim';
import { MASTERY_INITIAL, MASTERY_MID, lerpMastery } from '../../scenario/minhAnh';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { SC9, SC9_EVIDENCE } from '../../scenario/practice';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleShape, ParticleStream } from '../../ui/ParticleStream';
import { TwinPanel } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const LATENCY = 400;
const arrive = SC9_EVIDENCE.map((e) => e.at + LATENCY);

export function Sc09Experience({ t }: SceneProps) {
  const f = arrive.reduce((sum, a) => sum + prog(t, a, 600), 0) / arrive.length;
  const mastery = lerpMastery(MASTERY_INITIAL, MASTERY_MID, f);
  const glow = pulse(t, arrive, 900);
  const step3Done = t >= SC9.progress;
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left: 40, top: 110 }}>
        <TwinPanel mastery={mastery} stateLabel="Live · student session" glow={glow} width={1000} highlight={glow > 0 ? ['mastery.implication'] : []} />
      </div>
      <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1080, top: 110, width: 800, height: 930, borderColor: C.cyan, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.cyan }}>Live evidence · Minh Anh's device</div>
        <div className="mt-1 text-[18px] text-dim">Student app · guided practice session active</div>
        <div className="mt-5 space-y-3">
          {SC9_EVIDENCE.map((e, i) => (
            <div key={e.label} className="flex items-center gap-3 rounded-xl border-2 px-4 py-3" style={{ borderColor: C.cyan, opacity: fade(t, arrive[i]) }}>
              <svg width={24} height={24}><ParticleShape kind="interaction" x={12} y={12} color={C.cyan} /></svg>
              <span className="text-[19px] text-ink">{e.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Pathway progress</div>
        {PATHWAY_INITIAL.map((p, i) => {
          const done = i < 2 || (i === 2 && step3Done);
          const active = i === 2 && !step3Done;
          return (
            <div key={p.title} className="mt-3 flex items-center gap-3 text-[18px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full font-bold" style={{ background: done ? C.mastered : active ? C.twin : C.surface, color: C.deep }}>{done ? '✓' : i + 1}</span>
              <span className="text-ink">{p.title}</span>
              <span className="ml-auto text-dim">{active ? 'in progress' : done ? 'done' : p.when}</span>
            </div>
          );
        })}
      </div>
      <FullSvg>
        {SC9_EVIDENCE.map((e) => (
          <ParticleStream key={e.at} t={t} from={{ x: 1920, y: 300 }} to={{ x: 1040, y: 420 }} via={{ x: 1500, y: 200 }} start={e.at} count={3} gap={90} travel={LATENCY + 200} kinds={['interaction']} />
        ))}
      </FullSvg>
    </div>
  );
}
```

- [ ] **Step 5: Register the scenes** by adding these imports and entries to `src/dashboard/scenes/index.ts`

```ts
import { Sc04Represent } from './Sc04Represent';
import { Sc09Experience } from './Sc09Experience';
```
Add `4: Sc04Represent,` and `9: Sc09Experience,` to `SCENE_VIEWS`, keeping the numeric order.

- [ ] **Step 6: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Verify in the browser**

Play `?scene=4&autoplay`. The nodes reveal, the mastery fills, the cyan evidence chips link to →, and the white path lights up from → to ≡. The graph then shrinks left, the twin slides in, its blocks highlight in sequence, and implication drops from 0.38 to 0.31 with a glow. The royal bridge line and its label appear.

Then open the controller and both app windows, and play Sc9. The phone and dashboard react at the same moments: each phone pill is matched by a dashboard evidence row about 0.4 s later.

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: Sc4 knowledge graph + digital twin, Sc9 dashboard evidence companion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Agent stage, Sc5 Reason and Sc6 Collaborate

**Files:**
- Create: `src/dashboard/agents/highlights.ts`, `src/dashboard/agents/AgentStage.tsx`, `src/dashboard/agents/JointDecision.tsx`
- Create: `src/dashboard/scenes/Sc05Reason.tsx`, `src/dashboard/scenes/Sc06Collaborate.tsx`
- Modify: `src/dashboard/scenes/index.ts` (register 5, 6)
- Test: `src/dashboard/agents/highlights.test.ts`, and append to `scenes.test.tsx`

**Interfaces:**
- Consumes:
  - From `agents.ts`: `AgentCard`, `AgentId`, `refTarget`, `EXCHANGES`, `SAS_READS`, `SAS_DIAGNOSIS`, `TAS_ANALYSIS`, `SAS_CHECKS`, `PLAN_DRAFT`, `PLAN_ADDED`, `JOINT_DECISION`
  - From `minhAnh.ts`: `MASTERY_INITIAL`, `Mastery`
  - From `ui`: `AgentNode`, `Conduit`, `FullSvg`, `GraphView`, `TwinMini`, `TwinKey`, `MessageCard`, `cubic`
- Produces:
  - `highlights.ts`:
    - `TOKEN_MS = 1200`
    - `activeHighlights(cards, times, t, holdUntil?): {kg: ConceptId[]; twin: TwinKey[]}`
    - `revealedMastery(cards, times, t, source): Partial<Record<ConceptId, number>>`
    - `latestReceived(cards, times, to, t): {card, arrived} | null`
  - `AgentStage(props)`, with `SAS_POS`, `TAS_POS`, `Token {at, from, label}`
  - `JointDecision({t, steps, at, signAt, exitAt?})`

- [ ] **Step 1: Write the failing tests**

`src/dashboard/agents/highlights.test.ts`:
```ts
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
```

Append to `src/dashboard/scenes/scenes.test.tsx`:
```tsx
describe('Sc5 Reason', () => {
  it('shows both agents, SAS diagnosis and TAS analysis', () => {
    const s = render(5, 14000);
    expect(s).toContain('Student Analysis Agent');
    expect(s).toContain('Teaching Assistance Agent');
    expect(s).toContain('SAS · Student Diagnosis');
    expect(s).toContain('Incomplete understanding of logical operators');
    expect(s).toContain('TAS · Instructional Analysis');
    expect(s).toContain('Mastery assessment');
  });
});

describe('Sc6 Collaborate', () => {
  it('delivers the challenge to TAS and narrows the plan', () => {
    const s = render(6, 13500);
    expect(s).toContain('CHALLENGE');
    expect(s).toContain('line-through');
  });
  it('ends with the co-signed joint decision', () => {
    const s = render(6, 22000);
    expect(s).toContain('Joint decision');
    expect(s).toContain('Targeted Prerequisite Reinforcement');
    expect(s).toContain('SAS ✓');
    expect(s).toContain('TAS ✓');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Failed to resolve import "./highlights"`.

- [ ] **Step 3: Implement** `src/dashboard/agents/highlights.ts`

```ts
import { stepIndex } from '../../engine/anim';
import { refTarget, type AgentCard, type AgentId } from '../../scenario/agents';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { Mastery } from '../../scenario/minhAnh';
import type { TwinKey } from '../../ui/TwinPanel';

/** Travel time of a card token between agents. */
export const TOKEN_MS = 1200;
/** Refs light up this long after a card is sent. */
const REF_DELAY = 600;

/** Concept id referenced by a kg / twin ref, if any. */
function conceptOf(ref: string): ConceptId | null {
  const target = refTarget(ref);
  if (!target) return null;
  if (target.kind === 'kg') return target.id as ConceptId;
  if (target.kind === 'twin') return target.id.split('.')[1] as ConceptId;
  return null;
}

/** Hub highlights for the card in play: from send + REF_DELAY until the next card is sent. */
export function activeHighlights(cards: AgentCard[], times: number[], t: number): { kg: ConceptId[]; twin: TwinKey[] } {
  const i = stepIndex(t, times.map((x) => x + REF_DELAY));
  if (i < 0) return { kg: [], twin: [] };
  const kg: ConceptId[] = [];
  const twin: TwinKey[] = [];
  for (const r of cards[i].refs) {
    const target = refTarget(r);
    const c = conceptOf(r);
    if (!target || !c) continue;
    if (target.kind === 'kg') kg.push(c);
    else twin.push(`mastery.${c}`);
  }
  return { kg, twin };
}

/** Mastery of every concept referenced (kg or twin) by cards whose refs have lit up by t. */
export function revealedMastery(cards: AgentCard[], times: number[], t: number, source: Mastery): Partial<Record<ConceptId, number>> {
  const out: Partial<Record<ConceptId, number>> = {};
  cards.forEach((card, i) => {
    if (t < times[i] + REF_DELAY) return;
    for (const r of card.refs) {
      const c = conceptOf(r);
      if (c) out[c] = source[c];
    }
  });
  return out;
}

/** The most recent card addressed to `to` whose token has arrived by t. */
export function latestReceived(cards: AgentCard[], times: number[], to: AgentId, t: number): { card: AgentCard; arrived: number } | null {
  let found: { card: AgentCard; arrived: number } | null = null;
  cards.forEach((card, i) => {
    const arrived = times[i] + TOKEN_MS;
    if (card.to === to && t >= arrived) found = { card, arrived };
  });
  return found;
}
```

- [ ] **Step 4: Implement** `src/dashboard/agents/AgentStage.tsx`

```tsx
import { cubic, easeInOut, type Point } from '../../engine/anim';
import type { AgentId } from '../../scenario/agents';
import type { ConceptId, Edge } from '../../scenario/knowledgeGraph';
import type { Mastery } from '../../scenario/minhAnh';
import { AgentNode, agentColor } from '../../ui/AgentNode';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { GraphView } from '../../ui/GraphView';
import { TwinMini, type TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { TOKEN_MS } from './highlights';

export const SAS_POS = { x: 330, y: 270 };
export const TAS_POS = { x: 1590, y: 270 };
const UPPER: [Point, Point, Point, Point] = [{ x: 405, y: 250 }, { x: 700, y: 120 }, { x: 1220, y: 120 }, { x: 1515, y: 250 }];
const LOWER: [Point, Point, Point, Point] = [{ x: 1515, y: 300 }, { x: 1220, y: 430 }, { x: 700, y: 430 }, { x: 405, y: 300 }];
const pathD = ([a, b, c, d]: [Point, Point, Point, Point]) => `M${a.x} ${a.y} C${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
const HUB_TWIN = { x: 750, y: 285 };
const HUB_GRAPH = { x: 740, y: 545, width: 440 };

export interface Token { at: number; from: AgentId; label: string }

export interface AgentStageProps {
  t: number;
  sasStatus: string;
  tasStatus: string;
  sasPulse?: number;
  tasPulse?: number;
  twinMastery: Mastery;
  twinHighlight?: TwinKey[];
  kgMastery?: Partial<Record<ConceptId, number>>;
  kgHighlight?: ConceptId[];
  kgEdges?: Edge[];
  tokens?: Token[];
  /** 0→1 strength of each agent's retrieval links into the hub. */
  retrieval?: { sas: number; tas: number };
}

/** SAS and TAS permanently linked through a shared hub (digital twin + knowledge graph). */
export function AgentStage({ t, sasStatus, tasStatus, sasPulse = 0, tasPulse = 0, twinMastery, twinHighlight = [], kgMastery = {}, kgHighlight = [], kgEdges = [], tokens = [], retrieval = { sas: 0.35, tas: 0.35 } }: AgentStageProps) {
  return (
    <>
      <FullSvg>
        <Conduit d={pathD(UPPER)} color={C.sas} t={t} width={4} />
        <Conduit d={pathD(LOWER)} color={C.tas} t={t} width={4} />
        <Conduit d="M405 300 C 560 330, 620 400, 750 400" color={C.sas} t={t} direction={-1} opacity={retrieval.sas} />
        <Conduit d="M405 330 C 540 500, 620 640, 740 650" color={C.sas} t={t} direction={-1} opacity={retrieval.sas} />
        <Conduit d="M1515 300 C 1360 330, 1300 400, 1170 400" color={C.tas} t={t} direction={-1} opacity={retrieval.tas} />
        <Conduit d="M1515 330 C 1380 500, 1300 640, 1180 650" color={C.tas} t={t} direction={-1} opacity={retrieval.tas} />
      </FullSvg>
      <div className="absolute" style={{ left: HUB_TWIN.x, top: HUB_TWIN.y }}>
        <TwinMini mastery={twinMastery} highlight={twinHighlight} />
      </div>
      <div className="absolute rounded-2xl border-2" style={{ left: HUB_GRAPH.x - 10, top: HUB_GRAPH.y - 10, width: HUB_GRAPH.width + 20, height: 244, borderColor: C.royal, background: C.panel }}>
        <div className="absolute" style={{ left: 10, top: 10 }}>
          <GraphView t={t} width={HUB_GRAPH.width} mastery={kgMastery} highlightNodes={kgHighlight} highlightEdges={kgEdges} showLabels={false} />
        </div>
      </div>
      <AgentNode agent="SAS" x={SAS_POS.x} y={SAS_POS.y} status={sasStatus} pulse={sasPulse} />
      <AgentNode agent="TAS" x={TAS_POS.x} y={TAS_POS.y} status={tasStatus} pulse={tasPulse} />
      {tokens.map((tk) => {
        const s = (t - tk.at) / TOKEN_MS;
        if (s < 0 || s > 1) return null;
        const p = cubic(...(tk.from === 'SAS' ? UPPER : LOWER), easeInOut(s));
        const color = agentColor(tk.from);
        return (
          <div key={`${tk.at}-${tk.label}`} className="absolute rounded-lg border-2 px-3 py-1 font-mono text-[16px] font-bold" style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)', borderColor: color, color, background: C.panel, boxShadow: `0 0 18px ${color}`, zIndex: 30 }}>
            {tk.label}
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 5: Implement** `src/dashboard/agents/JointDecision.tsx`

```tsx
import { fade, prog } from '../../engine/anim';
import { C } from '../../ui/tokens';

/** Co-signed decision card: blue→green border, both agents' signatures. */
export function JointDecision({ t, steps, at, signAt, exitAt = Infinity }: { t: number; steps: string[]; at: number; signAt: [number, number]; exitAt?: number }) {
  const o = fade(t, at);
  const exit = prog(t, exitAt, 1200);
  if (o <= 0 || exit >= 1) return null;
  return (
    <div className="absolute rounded-2xl p-[3px]" style={{ left: 560 + exit * 700, top: 790, width: 800, opacity: o * (1 - exit), background: `linear-gradient(90deg, ${C.sas}, ${C.tas})`, zIndex: 25 }}>
      <div className="rounded-2xl px-6 py-5" style={{ background: C.panel }}>
        <div className="flex items-center justify-between">
          <span className="font-display text-[24px] font-extrabold text-ink">Joint decision</span>
          <span className="font-mono text-[18px] font-bold">
            <span style={{ color: C.sas, opacity: fade(t, signAt[0]) }}>SAS ✓</span>
            <span className="ml-4" style={{ color: C.tas, opacity: fade(t, signAt[1]) }}>TAS ✓</span>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-lg px-3 py-2 text-[19px] font-semibold text-ink" style={{ background: C.surface }}>{s}</span>
              {i < steps.length - 1 && <span className="text-[20px] text-dim">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement** `src/dashboard/scenes/Sc05Reason.tsx`

```tsx
import { fade, prog, pulse, stepIndex, typed } from '../../engine/anim';
import { SAS_DIAGNOSIS, SAS_READS, TAS_ANALYSIS } from '../../scenario/agents';
import { MASTERY_INITIAL } from '../../scenario/minhAnh';
import type { TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { AgentStage } from '../agents/AgentStage';
import type { SceneProps } from './types';

const SAS_READ_T = SAS_READS.map((_, i) => 1500 + i * 550);
const SAS_CARD_T = 3800;
const TAS_READ_T = TAS_ANALYSIS.reads.map((_, i) => 5000 + i * 450);
const TAS_CARD_T = 7800;

function sasStatus(t: number): string {
  const i = stepIndex(t, SAS_READ_T);
  if (i < 0) return 'initialising…';
  if (t < 4800) return `reading twin.${SAS_READS[i]}…`;
  return t < 7500 ? 'writing diagnosis…' : 'diagnosis ready';
}

function tasStatus(t: number): string {
  const i = stepIndex(t, TAS_READ_T);
  if (i < 0) return 'listening to SAS…';
  if (t < 7600) return `reading ${TAS_ANALYSIS.reads[i].toLowerCase()}…`;
  return t < 11500 ? 'composing strategy…' : 'strategy ready';
}

export function Sc05Reason({ t }: SceneProps) {
  const readIdx = stepIndex(t, SAS_READ_T);
  const twinHighlight: TwinKey[] = readIdx >= 0 && t < 4800 ? [SAS_READS[readIdx]] : [];
  return (
    <div className="absolute inset-0 bg-deep">
      <AgentStage
        t={t}
        sasStatus={sasStatus(t)}
        tasStatus={tasStatus(t)}
        sasPulse={pulse(t, SAS_READ_T, 400)}
        tasPulse={pulse(t, TAS_READ_T, 400)}
        twinMastery={MASTERY_INITIAL}
        twinHighlight={twinHighlight}
        kgMastery={t >= 3000 ? { implication: MASTERY_INITIAL.implication } : {}}
        kgHighlight={t >= 3000 ? ['implication'] : []}
        retrieval={{ sas: t >= 1500 && t < 4800 ? 1 : 0.35, tas: t >= 5000 && t < 7600 ? 1 : 0.35 }}
        tokens={[{ at: 5600, from: 'SAS', label: 'partial diagnosis' }, { at: 7600, from: 'SAS', label: 'DIAGNOSIS' }]}
      />

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 60, top: 470, width: 500, height: 570, borderColor: C.sas, background: C.panel, opacity: fade(t, SAS_CARD_T) }}>
        <div className="font-display text-[24px] font-extrabold" style={{ color: C.sas }}>SAS · Student Diagnosis</div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Identified learning gap</div>
        <div className="mt-1 min-h-[56px] text-[21px] font-semibold text-ink">{typed(SAS_DIAGNOSIS.gap, t, SAS_CARD_T + 300, 45)}</div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Supporting evidence</div>
        {SAS_DIAGNOSIS.evidence.map((e, i) => (
          <div key={e} className="mt-1 text-[18px] text-ink" style={{ opacity: fade(t, SAS_CARD_T + 1500 + i * 500) }}>• {e}</div>
        ))}
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Learning state</div>
        <div className="mt-1 text-[19px]" style={{ color: C.sas, opacity: fade(t, 6300) }}>{SAS_DIAGNOSIS.state}</div>
      </div>

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1360, top: 470, width: 500, height: 570, borderColor: C.tas, background: C.panel, opacity: fade(t, 5000) }}>
        <div className="font-display text-[24px] font-extrabold" style={{ color: C.tas }}>TAS · Instructional Analysis</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAS_ANALYSIS.reads.map((r, i) => (
            <span key={r} className="rounded-md px-2 py-0.5 text-[15px]" style={{ background: C.surface, color: t >= TAS_READ_T[i] ? C.tas : C.dim }}>
              {t >= TAS_READ_T[i] ? '✓ ' : ''}{r}
            </span>
          ))}
        </div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Instructional recommendation</div>
        <div className="mt-1 min-h-[84px] text-[20px] font-semibold text-ink">{typed(TAS_ANALYSIS.recommendation, t, TAS_CARD_T + 300, 45)}</div>
        <div className="mt-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Proposed approach</div>
        {TAS_ANALYSIS.approach.map((a, i) => (
          <div key={a} className="mt-1 text-[18px] text-ink" style={{ opacity: fade(t, 9300 + i * 500) }}>{i + 1}. {a}</div>
        ))}
      </div>

      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 120px rgba(52,211,153,${0.15 * prog(t, 12500, 800)})`, pointerEvents: 'none' }} />
    </div>
  );
}
```

- [ ] **Step 7: Implement** `src/dashboard/scenes/Sc06Collaborate.tsx`

```tsx
import { fade, pulse } from '../../engine/anim';
import { EXCHANGES, JOINT_DECISION, PLAN_ADDED, PLAN_DRAFT, SAS_CHECKS } from '../../scenario/agents';
import { MASTERY_INITIAL } from '../../scenario/minhAnh';
import { MessageCard } from '../../ui/MessageCard';
import { C } from '../../ui/tokens';
import { AgentStage } from '../agents/AgentStage';
import { JointDecision } from '../agents/JointDecision';
import { TOKEN_MS, activeHighlights, latestReceived, revealedMastery } from '../agents/highlights';
import type { SceneProps } from './types';

const EX_T = [1500, 6500, 11500, 16000];
const CHECK_T = [8000, 8700, 9400];
const DROP_T = 13200;
const ADD_T = 15200;
const JOINT_T = 20000;
const SIGN_T: [number, number] = [20800, 21300];
const EXIT_T = 23200;

function Received({ t, to, left }: { t: number; to: 'SAS' | 'TAS'; left: number }) {
  const r = latestReceived(EXCHANGES, EX_T, to, t);
  if (!r || t >= JOINT_T) return null;
  return <MessageCard card={r.card} style={{ position: 'absolute', left, top: 470, opacity: fade(t, r.arrived, Infinity, 300) }} />;
}

export function Sc06Collaborate({ t }: SceneProps) {
  const hi = activeHighlights(EXCHANGES, EX_T, t);
  const arrivals = EX_T.map((x) => x + TOKEN_MS);
  const sasArrivals = arrivals.filter((_, i) => EXCHANGES[i].to === 'SAS');
  const tasArrivals = arrivals.filter((_, i) => EXCHANGES[i].to === 'TAS');
  const tasStatus = t < arrivals[0] ? 'listening…' : t < EX_T[1] ? 'drafting proposal…' : t < arrivals[2] ? 'awaiting evaluation…' : t < EX_T[3] ? 'refining plan…' : 'plan refined';
  const sasStatus = t < EX_T[0] ? 'sending diagnosis…' : t < arrivals[1] ? 'awaiting proposal…' : t < EX_T[2] ? 'evaluating against twin + KG…' : t < arrivals[3] ? 'awaiting refinement…' : 'refinement accepted';
  return (
    <div className="absolute inset-0 bg-deep">
      <AgentStage
        t={t}
        sasStatus={sasStatus}
        tasStatus={tasStatus}
        sasPulse={pulse(t, sasArrivals, 700)}
        tasPulse={pulse(t, tasArrivals, 700)}
        twinMastery={MASTERY_INITIAL}
        twinHighlight={hi.twin}
        kgMastery={revealedMastery(EXCHANGES, EX_T, t, MASTERY_INITIAL)}
        kgHighlight={hi.kg}
        retrieval={{ sas: t >= arrivals[1] && t < EX_T[2] ? 1 : 0.35, tas: t >= arrivals[2] && t < EX_T[3] ? 1 : 0.35 }}
        tokens={EXCHANGES.map((c, i) => ({ at: EX_T[i], from: c.from, label: c.type }))}
      />

      <Received t={t} to="SAS" left={60} />
      <Received t={t} to="TAS" left={1380} />

      {t < JOINT_T && (
        <>
          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 60, top: 760, width: 480, height: 280, borderColor: C.sas, background: C.panel }}>
            <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.sas }}>SAS · evaluation</div>
            {t < arrivals[1] && <div className="mt-3 text-[18px] text-dim">Diagnosis sent · awaiting proposal</div>}
            {SAS_CHECKS.map((c, i) => {
              const m = MASTERY_INITIAL[c.concept];
              const ok = m >= 0.7;
              return (
                <div key={c.concept} className="mt-3 flex items-center justify-between text-[19px]" style={{ opacity: fade(t, CHECK_T[i]) }}>
                  <span className="font-mono text-ink">{c.label}</span>
                  <span className="font-mono" style={{ color: ok ? C.mastered : C.gap }}>{m.toFixed(2)} {ok ? '✓ mastered' : '✗ gap'}</span>
                </div>
              );
            })}
            <div className="mt-3 text-[18px] font-semibold" style={{ color: C.sas, opacity: fade(t, arrivals[3]) }}>Refinement accepted ✓</div>
          </div>

          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1380, top: 760, width: 480, height: 280, borderColor: C.tas, background: C.panel }}>
            <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.tas }}>TAS · intervention plan</div>
            {PLAN_DRAFT.map((p, i) => {
              const dropped = p.drop && t >= DROP_T;
              return (
                <div key={p.text} className="mt-3 text-[19px]" style={{ opacity: fade(t, arrivals[0] + 800 + i * 400) * (dropped ? 0.4 : 1), color: dropped ? C.dim : C.ink, textDecoration: dropped ? 'line-through' : 'none' }}>
                  {i + 1}. {p.text}
                </div>
              );
            })}
            <div className="mt-3 text-[19px] font-semibold" style={{ color: C.tas, opacity: fade(t, ADD_T) }}>+ {PLAN_ADDED}</div>
          </div>
        </>
      )}

      <JointDecision t={t} steps={JOINT_DECISION} at={JOINT_T} signAt={SIGN_T} exitAt={EXIT_T} />
      <div className="absolute font-display text-[24px] font-bold text-ink" style={{ right: 60, top: 1000, opacity: fade(t, 22500) }}>→ Intervention Orchestration Engine</div>
    </div>
  );
}
```

- [ ] **Step 8: Register the scenes.** Add these imports to `src/dashboard/scenes/index.ts`, plus the entries `5: Sc05Reason,` and `6: Sc06Collaborate,`:

```ts
import { Sc05Reason } from './Sc05Reason';
import { Sc06Collaborate } from './Sc06Collaborate';
```

- [ ] **Step 9: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Verify in the browser**

Play `?scene=5&autoplay` and `?scene=6&autoplay`. Check:
- The two conduits always flow in opposite directions, and the retrieval links brighten while an agent reads.
- In Sc5, TAS starts reading before the SAS diagnosis has finished typing.
- In Sc6, each token travels along its curve. On arrival, the card appears on the receiver's side and the hub's graph and twin rows light up.
- After CHALLENGE, ∧ and ∨ turn green on the graph and "Review ¬, ∧, ∨" is struck through.
- The joint decision is signed by both agents and then slides off to the right.

- [ ] **Step 11: Commit**

```bash
git add -A .
git commit -m "feat: interconnected dual-agent stage, Sc5 reasoning and Sc6 collaboration" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Sc7 Orchestrate

**Files:**
- Create: `src/dashboard/scenes/Sc07Orchestrate.tsx`
- Modify: `src/dashboard/scenes/index.ts` (register 7)
- Test: append to `scenes.test.tsx`

**Interfaces:**
- Consumes:
  - From `orchestration.ts`: `ENGINE_INPUTS`, `OPERATIONS`, `STATUSES`, `RETRIEVED`, `ACTIVITIES`, `PATHWAY_INITIAL`, `MONITORING_CRITERIA`, `EXPECTED_OUTCOME`
  - Other scenario: `RESOURCES`, `CUES`
  - UI: `PipelineStatus`, `AgentPair`, `ParticleStream`, `FullSvg`, `Conduit`
- Produces: `Sc07Orchestrate`.

- [ ] **Step 1: Append failing tests**

```tsx
describe('Sc7 Orchestrate', () => {
  it('runs the six operations and reaches DELIVERED at the cue', () => {
    const mid = render(7, 10500);
    expect(mid).toContain('Intervention Orchestration Engine');
    expect(mid).toContain('Activity generation &amp; assembly');
    expect(mid).toContain('Worked examples');
    const end = render(7, 24000);
    expect(end).toContain('MONITORING');
    expect(end).toContain('Mastery check score');
    expect(end).toContain("Delivered to Minh Anh's student app");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Scene 7 not registered`.

- [ ] **Step 3: Implement** `src/dashboard/scenes/Sc07Orchestrate.tsx`

```tsx
import type { ReactNode } from 'react';
import { fade, stepIndex } from '../../engine/anim';
import { RESOURCES } from '../../scenario/agents';
import {
  ACTIVITIES, ENGINE_INPUTS, EXPECTED_OUTCOME, MONITORING_CRITERIA, OPERATIONS, PATHWAY_INITIAL, RETRIEVED, STATUSES,
} from '../../scenario/orchestration';
import { CUES } from '../../scenario/scenes';
import { AgentPair } from '../../ui/AgentPair';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const OP_T = [4000, 6500, 9500, 12500, 15500, 19000];
const STATUS_T = [4000, 7500, 13500, 16500, CUES.sc7Delivered, 21500];
const INPUT_COLORS = [C.sas, C.tas, C.twin, C.royal, C.dim, C.gold];
const inputY = (i: number) => 230 + i * 105;
const opY = (i: number) => 150 + i * 125;

function Visual({ t, op }: { t: number; op: number }) {
  const list = (items: string[], start: number, render: (s: string) => ReactNode) =>
    items.map((s, i) => (
      <div key={s} className="mt-3 rounded-xl border-2 px-4 py-3 text-[18px] text-ink" style={{ borderColor: C.line, background: C.surface, opacity: fade(t, start + i * 400) }}>{render(s)}</div>
    ));
  switch (op) {
    case 0:
      return (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: C.gold }}>
          <div className="font-display text-[20px] font-bold" style={{ color: C.gold }}>Policy check</div>
          <div className="mt-2 text-[18px] text-ink">Adaptive track · within teacher policy → auto-execute ✓</div>
          <div className="mt-1 text-[18px] text-dim">Escalation: not required</div>
        </div>
      );
    case 1:
      return <>{list(RETRIEVED, OP_T[1] + 200, (id) => RESOURCES[id])}</>;
    case 2:
      return <>{list(ACTIVITIES, OP_T[2] + 200, (a) => a)}</>;
    case 3:
      return <>{list(PATHWAY_INITIAL.map((p) => p.title), OP_T[3] + 200, (s) => <span>⟶ {s}</span>)}</>;
    case 4:
      return (
        <>
          {list(PATHWAY_INITIAL.map((p) => `${p.when} · ${p.title}`), OP_T[4] + 200, (s) => s)}
          <div className="mt-4 font-display text-[20px] font-bold" style={{ color: C.engine, opacity: fade(t, CUES.sc7Delivered) }}>📱 Delivered to Minh Anh's student app</div>
        </>
      );
    default:
      return (
        <>
          <div className="text-[18px] text-dim">Expected outcome</div>
          <div className="text-[19px] text-ink">{EXPECTED_OUTCOME}</div>
          <div className="mt-4 text-[18px] text-dim">Monitoring criteria</div>
          {list(MONITORING_CRITERIA, OP_T[5] + 200, (s) => s)}
          <div className="mt-4 font-display text-[18px] font-bold" style={{ color: C.engine }}>📱 Delivered to Minh Anh's student app</div>
        </>
      );
  }
}

export function Sc07Orchestrate({ t }: SceneProps) {
  const op = stepIndex(t, OP_T);
  const reached = stepIndex(t, STATUS_T) + 1;
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left: 470, top: 36 }}>
        <div className="font-display text-[34px] font-extrabold text-ink">Intervention Orchestration Engine</div>
        <div className="text-[19px] text-dim">Agent decisions → executable workflows</div>
      </div>

      <AgentPair t={t} x={110} y={110} gap={180} r={34} />
      <FullSvg>
        <Conduit d="M200 150 C 260 190, 380 150, 470 170" color={C.engine} t={t} />
        {ENGINE_INPUTS.map((_, i) => (
          <ParticleStream key={i} t={t} from={{ x: 400, y: inputY(i) + 30 }} to={{ x: 470, y: 520 }} start={2500 + i * 150} count={5} gap={300} travel={900} color={INPUT_COLORS[i]} />
        ))}
      </FullSvg>

      {ENGINE_INPUTS.map((label, i) => (
        <div key={label} className="absolute rounded-xl border-2 px-4 py-3 text-[18px] font-semibold text-ink" style={{ left: 40, top: inputY(i), width: 360, borderColor: INPUT_COLORS[i], background: C.panel, opacity: fade(t, 500 + i * 300) }}>
          {label}
        </div>
      ))}

      {OPERATIONS.map((o, i) => {
        const done = i < op;
        const current = i === op;
        return (
          <div key={o.id} className="absolute flex items-center gap-4 rounded-2xl border-2 px-5" style={{ left: 470, top: opY(i), width: 860, height: 110, borderColor: done || current ? C.engine : C.line, background: C.panel, boxShadow: current ? '0 0 28px rgba(255,255,255,0.45)' : 'none', opacity: fade(t, 1500 + i * 150) }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[22px] font-extrabold" style={{ background: done || current ? C.engine : C.surface, color: C.deep }}>{done ? '✓' : i + 1}</span>
            <div>
              <div className="font-display text-[24px] font-bold text-ink">{o.title}</div>
              <div className="text-[18px] text-dim" style={{ opacity: done || current ? 1 : 0.4 }}>{o.detail}</div>
            </div>
          </div>
        );
      })}

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1370, top: 150, width: 510, height: 735, borderColor: C.line, background: C.panel }}>
        {op >= 0 && <Visual t={t} op={op} />}
      </div>

      <div className="absolute" style={{ left: 40, top: 935 }}>
        <PipelineStatus statuses={STATUSES} reached={reached} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Register the scene.** Add `import { Sc07Orchestrate } from './Sc07Orchestrate';` and the entry `7: Sc07Orchestrate,` to `src/dashboard/scenes/index.ts`.

- [ ] **Step 5: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Verify in the browser** with the controller, dashboard and student windows open. Play Sc7.

Expected:
- The inputs fill in and their coloured particles enter the engine.
- The operations light up in sequence, and the right panel swaps to show each step.
- The pipeline reaches DELIVERED at 20.5 s.
- The phone's lock-screen notification slides in at 21 s.

- [ ] **Step 7: Commit**

```bash
git add -A .
git commit -m "feat: Sc7 orchestration engine workflow with delivery cue to the phone" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Sc10 Simulate & Adapt

**Files:**
- Create: `src/dashboard/adapt/SimChart.tsx`, `src/dashboard/scenes/Sc10Adapt.tsx`
- Modify: `src/dashboard/scenes/index.ts` (register 10)
- Test: append to `scenes.test.tsx`

**Interfaces:**
- Consumes:
  - From `simulation.ts`: `SIM_LABEL`, `TARGET`, `PATHWAY_A`, `PATHWAY_B`, `sessionsToTarget`
  - From `minhAnh.ts`: `DELTAS`, `REMAINING_GAP`, `MASTERY_MID`, `MASTERY_POST`, `MINH_ANH`, `lerpMastery`
  - From `agents.ts`: `REASSESSMENT`, `JOINT_DECISION_2`. From `orchestration.ts`: `STATUSES`, `PATHWAY_UPDATED`. From `scenes.ts`: `CUES`
  - From Task 12: `AgentStage`, `JointDecision`, `highlights`. From `ui`: `TwinPanel`, `MessageCard`, `PipelineStatus`
- Produces: `SimChart({t, start, selectAt})`, `Sc10Adapt`.

- [ ] **Step 1: Append failing tests**

```tsx
describe('Sc10 Simulate & Adapt', () => {
  it('shows twin deltas and the labelled simulation', () => {
    const s = render(10, 13500);
    expect(s).toContain('Exercise accuracy');
    expect(s).toContain('78%');
    expect(s).toContain('Simulated projection · illustrative');
    expect(s).toContain('B selected');
  });
  it('reassesses with both agents and delivers the updated pathway', () => {
    expect(render(10, 19500)).toContain('REASSESSMENT');
    const end = render(10, 28500);
    expect(end).toContain('Targeted Application Practice');
    expect(end).toContain('Updated pathway delivered');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/dashboard`
Expected: FAIL with `Scene 10 not registered`.

- [ ] **Step 3: Implement** `src/dashboard/adapt/SimChart.tsx`

```tsx
import { fade, lerp, prog } from '../../engine/anim';
import { PATHWAY_A, PATHWAY_B, SIM_LABEL, TARGET, sessionsToTarget } from '../../scenario/simulation';
import { C } from '../../ui/tokens';

const W = 860;
const H = 330;
const PAD = { l: 60, r: 20, t: 20, b: 44 };
const MAX_SESSIONS = 6;
const x = (i: number) => PAD.l + (i / MAX_SESSIONS) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (1 - (v - 0.3) / 0.5) * (H - PAD.t - PAD.b);

/** Polyline of `curve` drawn up to fraction p of its length (by segment). */
function partial(curve: number[], p: number): string {
  const segs = curve.length - 1;
  const upto = p * segs;
  const pts: string[] = [];
  for (let i = 0; i <= Math.floor(upto); i++) pts.push(`${x(i)},${y(curve[i])}`);
  const frac = upto - Math.floor(upto);
  const i = Math.floor(upto);
  if (frac > 0 && i < segs) pts.push(`${lerp(x(i), x(i + 1), frac)},${lerp(y(curve[i]), y(curve[i + 1]), frac)}`);
  return pts.join(' ');
}

export function SimChart({ t, start, selectAt }: { t: number; start: number; selectAt: number }) {
  const a = prog(t, start + 1000, 2500);
  const b = prog(t, start + 2000, 2500);
  const selected = t >= selectAt;
  return (
    <div className="rounded-2xl border-2 p-5" style={{ width: 920, borderColor: C.twin, background: C.panel, opacity: fade(t, start) }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-[22px] font-extrabold" style={{ color: C.twin }}>Digital twin simulation · pathway comparison</span>
        <span className="rounded-md border-2 px-2 py-0.5 font-mono text-[15px] font-bold" style={{ borderColor: C.gold, color: C.gold }}>{SIM_LABEL}</span>
      </div>
      <svg width={W} height={H} className="mt-2">
        {[0.3, 0.5, 0.7].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={C.line} />
            <text x={PAD.l - 10} y={y(v) + 6} textAnchor="end" fontSize={16} fill={C.dim} fontFamily="Inter">{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(TARGET)} y2={y(TARGET)} stroke={C.ink} strokeDasharray="8 8" strokeOpacity={0.7} />
        <text x={W - PAD.r} y={y(TARGET) - 8} textAnchor="end" fontSize={16} fill={C.ink} fontFamily="Inter">mastery target {TARGET}</text>
        {Array.from({ length: MAX_SESSIONS + 1 }, (_, i) => (
          <text key={i} x={x(i)} y={H - 14} textAnchor="middle" fontSize={16} fill={C.dim} fontFamily="Inter">{i}</text>
        ))}
        <polyline points={partial(PATHWAY_A.curve, a)} fill="none" stroke={C.dim} strokeWidth={selected ? 3 : 4} strokeOpacity={selected ? 0.45 : 1} />
        <polyline points={partial(PATHWAY_B.curve, b)} fill="none" stroke={C.twin} strokeWidth={selected ? 7 : 4} />
      </svg>
      <div className="mt-1 flex gap-8 text-[18px]">
        <span className="text-dim">A · {PATHWAY_A.label}</span>
        <span style={{ color: C.twin }}>B · {PATHWAY_B.label}</span>
      </div>
      <div className="mt-2 font-display text-[20px] font-bold" style={{ color: C.twin, opacity: fade(t, selectAt) }}>
        B selected · reaches {TARGET} in {sessionsToTarget(PATHWAY_B.curve)} sessions (A: {sessionsToTarget(PATHWAY_A.curve)})
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement** `src/dashboard/scenes/Sc10Adapt.tsx`

```tsx
import { countUp, fade, prog, pulse, stepIndex } from '../../engine/anim';
import { JOINT_DECISION_2, REASSESSMENT } from '../../scenario/agents';
import { DELTAS, MASTERY_MID, MASTERY_POST, MINH_ANH, REMAINING_GAP, lerpMastery } from '../../scenario/minhAnh';
import { PATHWAY_UPDATED, STATUSES } from '../../scenario/orchestration';
import { CUES } from '../../scenario/scenes';
import { MessageCard } from '../../ui/MessageCard';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { TwinPanel } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { SimChart } from '../adapt/SimChart';
import { AgentStage } from '../agents/AgentStage';
import { JointDecision } from '../agents/JointDecision';
import { activeHighlights, latestReceived } from '../agents/highlights';
import type { SceneProps } from './types';

const PHASE_B = 15000;
const SIM_T = 7000;
const SELECT_T = 12000;
const RE_T = [16500, 18800];
const JOINT_T = 21500;
const SIGN_T: [number, number] = [22200, 22600];
const PIPE_T = [24000, 24600, 25200, 25800, CUES.sc10Update, 27600];

export function Sc10Adapt({ t }: SceneProps) {
  const a = 1 - prog(t, PHASE_B, 1000);
  const b = prog(t, PHASE_B, 1000);
  const mastery = lerpMastery(MASTERY_MID, MASTERY_POST, prog(t, 1000, 3000));
  const hi = activeHighlights(REASSESSMENT, RE_T, t);
  const toTas = latestReceived(REASSESSMENT, RE_T, 'TAS', t);
  const toSas = latestReceived(REASSESSMENT, RE_T, 'SAS', t);
  const pipe = t >= 24000;
  return (
    <div className="absolute inset-0 bg-deep">
      {a > 0 && (
        <div className="absolute inset-0" style={{ opacity: a }}>
          <div className="absolute" style={{ left: 40, top: 110 }}>
            <TwinPanel mastery={mastery} stateLabel="Updated · mastery assessment" glow={pulse(t, [1000], 1500)} highlight={t < 4500 ? ['mastery'] : ['gaps']} assessment={`Mastery check · ${MINH_ANH.scoreAfter}% (was ${MINH_ANH.scoreNow}%)`} />
          </div>
          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 960, top: 110, width: 920, height: 440, borderColor: C.twin, background: C.panel }}>
            <div className="flex items-center justify-between">
              <span className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.twin }}>New evidence · before → after</span>
              <span className="font-display text-[44px] font-extrabold text-ink">{countUp(MINH_ANH.scoreNow, MINH_ANH.scoreAfter, t, 1200, 1800)}%</span>
            </div>
            {DELTAS.map((d, i) => (
              <div key={d.label} className="mt-2 flex items-center text-[20px]" style={{ opacity: fade(t, 1500 + i * 450) }}>
                <span className="w-80 text-ink">{d.label}</span>
                <span className="w-24 font-mono text-dim">{d.before}</span>
                <span className="w-10 text-dim">→</span>
                <span className="font-mono font-bold" style={{ color: C.mastered }}>{d.after}</span>
              </div>
            ))}
            <div className="mt-3 inline-block rounded-lg px-3 py-1 text-[18px]" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap, opacity: fade(t, 4200) }}>Remaining gap · {REMAINING_GAP}</div>
          </div>
          <div className="absolute" style={{ left: 960, top: 570 }}>
            <SimChart t={t} start={SIM_T} selectAt={SELECT_T} />
          </div>
        </div>
      )}

      {b > 0 && (
        <div className="absolute inset-0" style={{ opacity: b }}>
          <AgentStage
            t={t}
            sasStatus={t < RE_T[0] ? 'reading updated twin…' : t < JOINT_T ? 'reassessing learner…' : 'decision signed'}
            tasStatus={t < RE_T[1] ? 'evaluating observed response…' : t < JOINT_T ? 'adapting strategy…' : 'decision signed'}
            sasPulse={pulse(t, [RE_T[1] + 1200], 700)}
            tasPulse={pulse(t, [RE_T[0] + 1200], 700)}
            twinMastery={MASTERY_POST}
            twinHighlight={hi.twin}
            kgMastery={MASTERY_POST}
            kgHighlight={hi.kg}
            tokens={REASSESSMENT.map((c, i) => ({ at: RE_T[i], from: c.from, label: c.type }))}
          />
          {toTas && t < JOINT_T && <MessageCard card={toTas.card} style={{ position: 'absolute', left: 1380, top: 470, opacity: fade(t, toTas.arrived) }} />}
          {toSas && t < JOINT_T && <MessageCard card={toSas.card} style={{ position: 'absolute', left: 60, top: 470, opacity: fade(t, toSas.arrived) }} />}
          {!pipe && <JointDecision t={t} steps={JOINT_DECISION_2} at={JOINT_T} signAt={SIGN_T} />}
          {pipe && (
            <div className="absolute rounded-2xl border-2 p-5" style={{ left: 300, top: 790, width: 1320, borderColor: C.engine, background: C.panel, opacity: fade(t, 24000) }}>
              <div className="font-display text-[20px] font-bold text-ink">Orchestration engine · re-run · {JOINT_DECISION_2.join(' → ')}</div>
              <div className="mt-3"><PipelineStatus statuses={STATUSES} reached={stepIndex(t, PIPE_T) + 1} /></div>
              <div className="mt-3 flex flex-wrap items-center gap-3" style={{ opacity: fade(t, CUES.sc10Update) }}>
                <span className="font-display text-[20px] font-bold" style={{ color: C.engine }}>📱 Updated pathway delivered</span>
                {PATHWAY_UPDATED.map((p) => <span key={p.title} className="rounded-lg px-3 py-1 text-[17px] text-ink" style={{ background: C.surface }}>{p.when} · {p.title}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Register the scene.** Add `import { Sc10Adapt } from './Sc10Adapt';` and the entry `10: Sc10Adapt,` to `src/dashboard/scenes/index.ts`.

- [ ] **Step 6: Run the tests and type-check**

Run: `npx vitest run src/dashboard && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Verify in the browser** with both apps open. Play Sc10.

Expected:
- The twin mastery bars grow, the score counts from 42% to 78%, and the deltas appear.
- The simulation draws A in grey and B in purple, with the gold "Simulated projection · illustrative" tag inside the panel. B is then selected.
- The view crossfades to the agents, and the two REASSESSMENT/REFINEMENT tokens cross between them.
- The joint decision is signed.
- The pipeline re-runs. At 27 s the dashboard shows "Updated pathway delivered" and the phone switches to the updated plan.

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: Sc10 twin update, labelled pathway simulation, agent reassessment and re-run" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Completeness check, contact sheet, README

**Files:**
- Create: `scripts/contact-sheet.ts`, `README.md`
- Test: append to `src/dashboard/scenes/scenes.test.tsx`

**Interfaces:**
- Consumes: `SCENES`, `STUDENT_SHOTS`, Vite `createServer`, Playwright `chromium`.
- Produces: the `npm run contact-sheet` command (`--verify` checks that frames are identical across runs) and the recording guide.

- [ ] **Step 1: Append the completeness test**

```tsx
describe('completeness', () => {
  it('every scene has a dashboard view', () => {
    expect(SCENES.filter((s) => !SCENE_VIEWS[s.id]).map((s) => s.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS. If the completeness test fails, register the missing scene(s) listed in the failure.

- [ ] **Step 3: Implement** `scripts/contact-sheet.ts`

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { SCENES } from '../src/scenario/scenes';
import { STUDENT_SHOTS } from '../src/student/frame';

const OUT = 'contact-sheet';
const PORT = 5199;
const verify = process.argv.includes('--verify');

async function shoot(page: Page, app: 'dashboard' | 'student', scene: number, t: number): Promise<Buffer> {
  await page.goto(`http://localhost:${PORT}/${app}.html?scene=${scene}&t=${t}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page.screenshot();
}

async function main() {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  const dash = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await mkdir(OUT, { recursive: true });

  const jobs: { page: Page; app: 'dashboard' | 'student'; scene: number; t: number }[] = [];
  for (const s of SCENES) {
    for (const t of s.shots) jobs.push({ page: dash, app: 'dashboard', scene: s.id, t });
    for (const t of STUDENT_SHOTS[s.id] ?? []) jobs.push({ page: phone, app: 'student', scene: s.id, t });
  }

  const mismatches: string[] = [];
  for (const j of jobs) {
    const name = `${OUT}/${j.app}-sc${String(j.scene).padStart(2, '0')}-t${String(j.t).padStart(5, '0')}.png`;
    const first = await shoot(j.page, j.app, j.scene, j.t);
    await writeFile(name, first);
    if (verify) {
      const second = await shoot(j.page, j.app, j.scene, j.t);
      if (!first.equals(second)) mismatches.push(name);
    }
    console.log(name);
  }

  await browser.close();
  await server.close();
  if (mismatches.length) {
    console.error(`Non-deterministic frames:\n${mismatches.join('\n')}`);
    process.exit(1);
  }
  console.log(`${jobs.length} frames written to ${OUT}/${verify ? ' · all deterministic' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Install the browser and run the contact sheet**

Run: `npx playwright install chromium` and then `npm run contact-sheet -- --verify`
Expected: it prints a list of PNG paths, then `NN frames written to contact-sheet/ · all deterministic`, and exits 0. Open a handful of the PNGs to check them:
- `dashboard-sc06-t22000.png` shows the joint decision.
- `dashboard-sc10-t13500.png` shows the simulation with its tag.
- `student-sc09-t09500.png` shows the hint table.

- [ ] **Step 5: Write** `README.md`

````markdown
# Beyond AI Tutoring · Demo Surface Layer

Scripted, deterministic interfaces for the 3:30 "Beyond AI Tutoring" video. Everything on screen is **illustrative demo data** about fictional students; there is no backend or AI.

Spec: `docs/superpowers/specs/2026-10-31-beyond-ai-tutoring-demo-design.md`

## Run

```bash
npm install
npm run dev            # opens the Director (controller) window
```

In the Director, click **Open dashboard window** and **Open student window**. Both status dots should turn ●.
All three windows must stay in the **same browser profile**, because they sync over `BroadcastChannel`.

Controls: `Space` play/pause (frame 0 → 3-second pre-roll) · `←`/`→` change scene · `R` restart · **Play all** runs scenes 1→12 continuously.

## Standalone frames

Any window can render without the controller:

- `dashboard.html?scene=6&t=22000`: hold one frame
- `student.html?scene=9&autoplay`: play a scene once
- Flags: `titles=0`, `footer=0`, `cursor=0`, `tc=1` (timecode burn-in), `scale=N` (force canvas scale)

## Recording

1. Launch Chrome at 2× so a 1920×1080 window captures as 3840×2160:
   `chrome.exe --force-device-scale-factor=2 http://localhost:5173/controller.html`
2. Size the dashboard window to 1920×1080 and the student window to 390×844 (CSS px).
3. In OBS, add two **Window Capture** sources (dashboard 3840×2160, student 780×1688 or larger) and record both at **60 fps**.
4. Press **Play all** (or play single scenes). Every take is identical, so a re-recorded scene cuts in cleanly.
5. Each scene starts with a 2-frame white **sync slate** in the top-left corner. Align the two recordings on it in DaVinci Resolve.
6. Each scene holds its first and last frame for 1 s; use these as edit handles.

## Stock footage map

| Shot | Scene | File | Notes |
|---|---|---|---|
| F1 | Sc1 0:00–0:04 | `lecture hall.mp4` | Establishing shot |
| F2 | Sc1 0:04–0:08 | `teacher_stressed.mp4` | Screen-replace with the Sc1 dashboard capture (Resolve planar tracker + corner pin), or match-cut on a push-in |
| F4 | Sc8 start | `teacher_morning.mp4` | The calm counterpart to F2 |
| F5 | Sc9 2:15 | `greenscreen_phone.mp4` | Key the green screen and corner-pin the student capture (`student.html?scene=9&autoplay`) |
| F6 | Sc11 (optional) | `lecture hall.mp4` | Background for the pull-back to the full classroom |

`lecture hall.mp4` has a small blurred patch in the centre. Cover it with a centred opening title (Manrope bold, white with a soft navy shadow), sized so the text block covers the patch, e.g. *"55 students. One lecturer. Data everywhere."* The title must be on screen from the first frame through 0:04 and dissolve out on the cut to F2. Add a slow 105% push-in on the footage: the title stays fixed while the footage moves, which keeps the patch under the text.

The footage files are git-ignored. Confirm each licence allows commercial and promotional use, keep the licence records with the project, and grade the footage cool navy/blue to sit with the UI.

## Review frames without recording

```bash
npx playwright install chromium   # once
npm run contact-sheet -- --verify # renders every key frame to contact-sheet/ and checks determinism
```

## Tests

```bash
npm test          # scenario consistency, playback/clock, scene smoke tests
npm run build     # tsc --strict + vite build
```
````

- [ ] **Step 6: Run the final verification**

Run: `npm test && npm run build`
Expected: all tests PASS; `tsc` reports no errors; `vite build` writes `dist/` containing `dashboard.html`, `student.html` and `controller.html`.

- [ ] **Step 7: Do a full run-through in the browser**

Open the controller, the dashboard and the student window, then press **Play all**. Watch all 3:30 and confirm:
- Every scene plays.
- The phone reacts in Sc7 (notification), Sc9 (whole session) and Sc10 (updated plan).
- Titles and the footer show.
- No console errors appear in any window.

- [ ] **Step 8: Commit**

```bash
git add -A .
git commit -m "feat: contact-sheet determinism check and recording README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
