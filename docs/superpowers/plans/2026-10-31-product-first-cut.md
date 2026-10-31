# Product-First Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark 12-scene dashboard cut with a 10-scene, 2:30 product story built on the eggshell/orange teacher app (chat + Classroom), recordable frame-exactly alongside the phone.

**Architecture:** A pure `teacherFrame(events, t)` folds a timeline of time-stamped events into everything the teacher screen shows. Recorded scenes use fixed event lists (`scriptFor(scene)`), driven by the existing Director clock. The live draft appends events as you click. One set of stateless components renders both. Scenes 1, 9 and 10 are full-canvas light restyles of the old Problem and Architecture views.

**Tech Stack:** Vite 5 multi-page, React 18, TypeScript strict, Tailwind 3, Vitest 2, Playwright (contact sheet only), @fontsource (Inter, Manrope, JetBrains Mono, Instrument Serif).

**Spec:** `docs/superpowers/specs/2026-10-31-product-first-cut-design.md`

## Global Constraints

- **Determinism.** Every visual value in `src/teacher/` is a pure function of the frame and `t`. No CSS `animation`/`transition` classes, no `Date.now()`/`Math.random()` in render, and no `chat-rise`/`chat-slide`/`chat-dot`. The single exceptions are hover colour changes on buttons and the live-only composer draft and Classroom filter `useState`.
- **Canvases.** Teacher 1920×1080 logical canvas (scripted mode renders through `Stage`); phone 390×844.
- **Tokens.** Teacher colours: `egg.bg #F2EDE4`, `egg.paper #F8F4EC`, `egg.card #FFFDF8`, `egg.line #DCD3C5`, `egg.ink #1A1714`, `egg.mute #6B6359`, `egg.faint #9C9285`, `egg.orange #FF5B1F`, `egg.tint #FFE5D6`. Serif = `"Instrument Serif"`.
- **Fonts.** Instrument Serif has no Vietnamese glyphs. Never put a Vietnamese name in a `font-serif` element.
- **Footer label.** `Illustrative demo data · fictional students` (exact).
- **Scene table.** Use exactly the scene table in Task 3, Step 1 (ids, labels, titles, subtitles, chapters, durations, shots). Total 150000 ms. Cues: `CUES.approveNotify = 7500` (Sc6), `CUES.adaptUpdate = 9000` (Sc8).
- **SSR tests.** `renderToStaticMarkup` escapes `'` as `&#x27;` and `&` as `&amp;`. Curly `’` is not escaped. Assert absence only for elements that are conditionally rendered, never ones at opacity 0.
- **Commits.** Commit messages end with the co-author trailer your environment specifies. Run `npm test` and `npx tsc --noEmit` before every commit.

---

## File map

| File | Responsibility |
|---|---|
| `teacher.html`, `src/teacher/main.tsx` | Entry. `?scene` → scripted `TeacherApp` inside `PlaybackProvider`; otherwise → `LiveTeacher` |
| `src/teacher/frame.ts` | `TeacherEvent`, `TeacherFrame`, `teacherFrame(events, t)`, `PAST`, `GREETING` |
| `src/teacher/script.ts` | Per-scene event lists and cursor keys; `scriptFor(scene)` |
| `src/teacher/conversations.tsx` | Topic copy as `Block[]`, `routePrompt`, `studentBrief`, `ADAPT`, `FALLBACK`, `QUESTION_SHORT` |
| `src/teacher/Blocks.tsx` | Renders `Block[]` with a shown-count (groups `li` into `ul`) |
| `src/teacher/TeacherScreen.tsx` | Stateless shell: sidebar, header, tracker, chat thread/opening screen or Classroom, side panel |
| `src/teacher/ContextPanel.tsx`, `Classroom.tsx`, `parts.tsx` | Frame-driven panel, Classroom and shared parts (moved from `src/chat/`) |
| `src/teacher/LiveTeacher.tsx` | Live driver: event list in state, `useNow` clock, `TeacherActions` |
| `src/teacher/TeacherApp.tsx` | Scripted driver: Sc1 `ProblemScene`, Sc2–8 `TeacherScreen` + `FakeCursor`, Sc9 `HowItWorks`, Sc10 `Closing`, `Overlays` |
| `src/teacher/scenes/ProblemScene.tsx`, `HowItWorks.tsx`, `Closing.tsx` | Light restyles of old Sc1 / architecture view, plus the new closing |
| `src/scenario/scenes.ts`, `orchestration.ts` | New scene table, cues, pathway constants |
| `src/student/frame.ts`, screens | Remapped phone timeline and clocks |
| `src/ui/Overlays.tsx`, `FakeCursor.tsx` | Light restyle, chapter label |
| `src/controller/ControllerApp.tsx`, `src/engine/playback.ts`, `sync.ts` | `chapter` toggle, `teacher` app name, new window and URL buttons |
| `scripts/contact-sheet.ts`, `README.md` | Teacher + phone frames; new recording recipe |

---

### Task 1: Move to `src/teacher/`, block-structured copy, and the frame model

**Files:**
- Move: `src/chat/*` → `src/teacher/` (`git mv`), `chat.html` → `teacher.html`
- Modify: `vite.config.ts` (input `chat` → `teacher`), `src/teacher/conversations.tsx`, `src/teacher/ChatApp.tsx` (render blocks)
- Create: `src/teacher/Blocks.tsx`, `src/teacher/frame.ts`, `src/teacher/frame.test.ts`

**Interfaces:**
- Produces:
  - `type Block = { kind: 'p' | 'li'; body: ReactNode }`
  - `Topic.answer: Block[]`, `Topic.approved: Block[]`
  - `studentBrief(s: Student): Block[]`, `ADAPT: Block[]`, `FALLBACK: Block[]`
  - `QUESTION_SHORT: string[]` (5)
  - `Blocks({ blocks, shown }: { blocks: Block[]; shown: number })`
  - everything exported from `frame.ts` below

- [ ] **Step 1: Move the files.**

```bash
git mv src/chat src/teacher
git mv chat.html teacher.html
```

In `teacher.html`, change the script src to `/src/teacher/main.tsx` and the title to `Teacher App · Beyond AI Tutoring`. In `vite.config.ts`, replace `chat: page('chat')` with `teacher: page('teacher')`.

- [ ] **Step 2: Convert the copy to blocks.** In `src/teacher/conversations.tsx`:

  1. Add the block type and the short questions.

  ```tsx
  /** One revealable unit of an assistant message. Consecutive `li` blocks render as one list. */
  export type Block = { kind: 'p' | 'li'; body: ReactNode };

  /** Short labels for the five teacher questions (tracker strip). Order matches TEACHER_QUESTIONS. */
  export const QUESTION_SHORT = ['Who is falling behind?', 'What are the gaps?', 'Topic or prerequisite?', 'Group or individual?', 'What happens next?'];
  ```

  2. Change `Topic` so that `answer: Block[]` and `approved: Block[]`.

  3. Rewrite each topic's `answer` and `approved` as arrays. Keep the existing sentences exactly; each `<p>` becomes `{ kind: 'p', body: <>…</> }` and each `<li>` becomes `{ kind: 'li', body: <>…</> }`. The block counts are:
     - student answer: 6 (p, li, li, li, li, p)
     - class answer: 5 (p, li, li, li, p)
     - attention answer: 4 (p, li, li, p)
     - each `approved`: 1

  4. Change the student topic's `followUps` to `['What gap is the class facing this week?', 'Show me her full history', 'Draft a message to her']`, and its `prompt` stays `'Why did Minh Anh’s quiz score drop?'`. Change the class topic's `prompt` to `'What gap is the class facing this week?'` (it already is). Its `thinking` lines stay.

  5. Make `studentBrief` return `Block[]`: the same single paragraph wrapped as `[{ kind: 'p', body: <>…</> }]`.

  6. Make `FALLBACK` a `Block[]` with its one paragraph.

  7. Add the adapt message.

  ```tsx
  /** Sc8: the unprompted message after Minh Anh's mastery check. */
  export const ADAPT: Block[] = [
    { kind: 'p', body: <>Minh Anh passed tonight’s mastery check: logical equivalence <B>0.35 → 0.72</B>. She’s reached the target.</> },
    { kind: 'p', body: <>One gap remains: <B>applying equivalence laws</B>. Within your policy, I’ve sent her a 3-session follow-up for tomorrow.</> },
  ];
  ```

- [ ] **Step 3: Write `Blocks.tsx`.**

```tsx
import type { Block } from './conversations';

/** Renders the first `shown` blocks; consecutive list items share one <ul>. */
export function Blocks({ blocks, shown }: { blocks: Block[]; shown: number }) {
  const visible = blocks.slice(0, Math.max(0, shown));
  const groups: Block[][] = [];
  for (const b of visible) {
    const last = groups[groups.length - 1];
    if (b.kind === 'li' && last && last[0].kind === 'li') last.push(b);
    else groups.push([b]);
  }
  return (
    <>
      {groups.map((g, i) =>
        g[0].kind === 'li' ? <ul key={i}>{g.map((b, j) => <li key={j}>{b.body}</li>)}</ul> : <p key={i}>{g[0].body}</p>,
      )}
    </>
  );
}
```

In `ChatApp.tsx`'s `AssistantMsg`, render `<Blocks blocks={…} shown={Infinity} />` for each kind (fallback → `FALLBACK`, brief → `studentBrief(STUDENTS[msg.index])`, answer → `topic.answer`, approved → `topic.approved`). This keeps the live draft working until Task 2 replaces it.

- [ ] **Step 4: Write the failing frame tests** in `src/teacher/frame.test.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { GREETING, PAST, teacherFrame, type TeacherEvent } from './frame';

const at = (events: TeacherEvent[], t: number) => teacherFrame(events, t);

describe('teacherFrame', () => {
  it('starts on the empty chat view', () => {
    const f = at([], 0);
    expect(f.view).toBe('chat');
    expect(f.messages).toEqual([]);
    expect(f.panel).toBeNull();
    expect(f.greeting).toEqual({ chars: 0, rows: [0, 0, 0] });
    expect(f.ticks).toEqual([false, false, false, false, false]);
  });

  it('ignores events that have not happened yet, in any order', () => {
    const f = at([{ at: 5000, type: 'view', view: 'classroom' }, { at: 100, type: 'tick', q: 2 }], 1000);
    expect(f.view).toBe('chat');
    expect(f.ticks[2]).toBe(true);
  });

  it('types the greeting at 10 cps and brings the rows in at +2500/+3100/+3700', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'greeting' }];
    expect(at(ev, 1000).greeting.chars).toBe(10);
    expect(at(ev, 9000).greeting.chars).toBe(GREETING.length);
    expect(at(ev, 2400).greeting.rows).toEqual([0, 0, 0]);
    expect(at(ev, 9000).greeting.rows).toEqual([1, 1, 1]);
  });

  it('types into the composer, then send clears it and posts the teacher message', () => {
    const ev: TeacherEvent[] = [
      { at: 0, type: 'type', text: 'Hello there', cps: 10 },
      { at: 2000, type: 'send', text: 'Hello there' },
    ];
    expect(at(ev, 500).composer).toBe('Hello');
    const f = at(ev, 2500);
    expect(f.composer).toBe('');
    expect(f.messages).toHaveLength(1);
    expect(f.messages[0]).toMatchObject({ role: 'teacher', text: 'Hello there' });
  });

  it('shows thinking lines one per step, then the assistant reveals block by block', () => {
    const ev: TeacherEvent[] = [
      { at: 0, type: 'think', lines: ['a', 'b'], stepMs: 1000, title: 'T' },
      { at: 3000, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
    ];
    expect(at(ev, 500).thinking?.shown).toBe(1);
    expect(at(ev, 1500).thinking?.shown).toBe(2);
    expect(at(ev, 1500).title).toBe('T');
    const f = at(ev, 4500);
    expect(f.thinking).toBeNull();
    expect(f.messages[0]).toMatchObject({ role: 'assistant', kind: 'answer', topic: 'student', shown: 2 });
  });

  it('opens the panel, then grows the bars from +1000 over 2000 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'panel', id: 'student' }];
    expect(at(ev, 900).panel?.bars).toBe(0);
    expect(at(ev, 3000).panel).toMatchObject({ id: 'student', appear: 1, bars: 1 });
    expect(at([...ev, { at: 4000, type: 'panel', id: null }], 4100).panel).toBeNull();
  });

  it('load replaces the thread with a finished topic conversation and opens its panel', () => {
    const f = at([{ at: 0, type: 'send', text: 'x' }, { at: 100, type: 'load', topic: 'student' }], 2000);
    expect(f.messages).toHaveLength(2);
    expect(f.messages[1]).toMatchObject({ kind: 'answer', topic: 'student', appear: 1 });
    expect(f.panel?.id).toBe('student');
    expect(f.title).toBe('Minh Anh’s Quiz 2 drop');
  });

  it('scrolls, edits and approves the proposal', () => {
    const ev: TeacherEvent[] = [
      { at: PAST, type: 'panel', id: 'student' },
      { at: 0, type: 'panelScroll', y: 120, dur: 1000 },
      { at: 2000, type: 'edit' },
      { at: 4000, type: 'approve', id: 'student' },
    ];
    expect(at(ev, 1000).panel?.scroll).toBe(120);
    expect(at(ev, 2000).panel).toMatchObject({ edited: true, editFlash: 1 });
    expect(at(ev, 3000).panel?.editFlash).toBe(0);
    expect(at(ev, 4000).approved).toEqual(['student']);
  });

  it('adaptTwin blends the twin and switches to the follow-up after 2000 ms', () => {
    const ev: TeacherEvent[] = [{ at: PAST, type: 'panel', id: 'student' }, { at: 0, type: 'adaptTwin' }];
    expect(at(ev, 1999).panel?.followUp).toBe(false);
    expect(at(ev, 2000).panel).toMatchObject({ twin: 1, followUp: true });
  });

  it('builds the classroom: KPIs over 2700 ms, 55 tiles from +200 over 7000 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'classroomReveal' }];
    expect(at(ev, 199).classroom.tiles).toBe(0);
    expect(at(ev, 200).classroom.tiles).toBe(1);
    expect(at(ev, 7200).classroom.tiles).toBe(55);
    expect(at(ev, 2700).classroom.kpi).toBe(1);
  });

  it('pulses until a student is selected; adaptClass runs over 2500 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'pulse' }];
    expect(at(ev, 785).classroom.pulse).toBeGreaterThan(0.9);
    expect(at([...ev, { at: 1000, type: 'select', index: 16 }], 1500).classroom).toMatchObject({ pulse: 0, selected: 16 });
    expect(at([{ at: 0, type: 'adaptClass' }], 2500).classroom.adapt).toBe(1);
  });

  it('reset clears the thread, panel and title but keeps ticks and approvals', () => {
    const f = at([
      { at: 0, type: 'tick', q: 0 },
      { at: 0, type: 'approve', id: 'class' },
      { at: 0, type: 'load', topic: 'class' },
      { at: 10, type: 'reset' },
    ], 20);
    expect(f.messages).toEqual([]);
    expect(f.panel).toBeNull();
    expect(f.title).toBeNull();
    expect(f.ticks[0]).toBe(true);
    expect(f.approved).toEqual(['class']);
  });
});
```

- [ ] **Step 5: Run the tests to see them fail.**

Run: `npx vitest run src/teacher/frame.test.ts`
Expected: FAIL (cannot resolve `./frame`).

- [ ] **Step 6: Implement `src/teacher/frame.ts`.**

```ts
import { clamp, easeInOut, lerp, prog, typed } from '../engine/anim';
import { TOPICS, type ContextId } from './conversations';

export type View = 'chat' | 'classroom';
export type AssistantKind = 'answer' | 'approved' | 'fallback' | 'brief' | 'adapt';

/** Far enough before any scene that every animation keyed to it has finished. */
export const PAST = -600_000;
export const GREETING = 'Good afternoon, Lam.';
const GREETING_CPS = 10;
const ROW_OFFSETS = [2500, 3100, 3700];
const TILE_COUNT = 55;
const TILE_START = 200;
const TILE_SPAN = 7000;

export type TeacherEvent =
  | { at: number; type: 'reset' }
  | { at: number; type: 'view'; view: View }
  | { at: number; type: 'greeting' }
  | { at: number; type: 'tracker'; on: boolean }
  | { at: number; type: 'tick'; q: number }
  | { at: number; type: 'type'; text: string; cps: number }
  | { at: number; type: 'send'; text: string }
  | { at: number; type: 'think'; lines: string[]; stepMs: number; title: string; sansTitle?: boolean }
  | { at: number; type: 'assistant'; kind: AssistantKind; topic?: ContextId; index?: number; blockMs: number; stamp?: string }
  | { at: number; type: 'load'; topic: ContextId }
  | { at: number; type: 'panel'; id: ContextId | null }
  | { at: number; type: 'panelScroll'; y: number; dur: number }
  | { at: number; type: 'edit' }
  | { at: number; type: 'approve'; id: ContextId }
  | { at: number; type: 'adaptTwin' }
  | { at: number; type: 'select'; index: number | null }
  | { at: number; type: 'classroomReveal' }
  | { at: number; type: 'pulse' }
  | { at: number; type: 'adaptClass' };

export interface FrameMsg {
  role: 'teacher' | 'assistant';
  text: string;
  kind?: AssistantKind;
  topic?: ContextId;
  index?: number;
  stamp?: string;
  /** 0→1 fade/rise. */
  appear: number;
  /** Number of blocks revealed (teacher messages: 1). */
  shown: number;
}

export interface FramePanel {
  id: ContextId;
  appear: number;
  /** 0→1 growth of the meter bars. */
  bars: number;
  scroll: number;
  edited: boolean;
  /** 1 at the edit, fading linearly to 0 over 1000 ms. */
  editFlash: number;
  /** 0→1 blend from MASTERY_INITIAL to MASTERY_POST. */
  twin: number;
  followUp: boolean;
}

export interface FrameClassroom {
  /** 0→1 KPI count-up. */
  kpi: number;
  /** Tiles revealed, in index order. */
  tiles: number;
  selected: number | null;
  selectAppear: number;
  /** 0..1 pulse on Minh Anh's tile (0 when not pulsing). */
  pulse: number;
  /** 0→1 blend to the post-adapt KPIs and Minh Anh's new state. */
  adapt: number;
}

export interface TeacherFrame {
  view: View;
  title: string | null;
  sansTitle: boolean;
  greeting: { chars: number; rows: number[] };
  tracker: number;
  ticks: boolean[];
  composer: string;
  messages: FrameMsg[];
  thinking: { lines: string[]; shown: number; elapsed: number } | null;
  panel: FramePanel | null;
  approved: ContextId[];
  classroom: FrameClassroom;
}

const openPanel = (id: ContextId, at: number, t: number): FramePanel => ({
  id, appear: prog(t, at, 500), bars: prog(t, at + 1000, 2000), scroll: 0, edited: false, editFlash: 0, twin: 0, followUp: false,
});

/** Folds every event with `at <= t` (in array order) into the frame shown at time t. Pure. */
export function teacherFrame(events: TeacherEvent[], t: number): TeacherFrame {
  const f: TeacherFrame = {
    view: 'chat', title: null, sansTitle: false,
    greeting: { chars: 0, rows: [0, 0, 0] },
    tracker: 0, ticks: [false, false, false, false, false],
    composer: '', messages: [], thinking: null, panel: null, approved: [],
    classroom: { kpi: 0, tiles: 0, selected: null, selectAppear: 0, pulse: 0, adapt: 0 },
  };
  let pulseAt: number | null = null;

  for (const e of events) {
    if (e.at > t) continue;
    const dt = t - e.at;
    switch (e.type) {
      case 'reset':
        f.messages = []; f.panel = null; f.thinking = null; f.title = null; f.sansTitle = false; f.composer = '';
        break;
      case 'view':
        f.view = e.view;
        break;
      case 'greeting':
        f.greeting = {
          chars: Math.min(GREETING.length, Math.floor((dt / 1000) * GREETING_CPS)),
          rows: ROW_OFFSETS.map((o) => prog(t, e.at + o, 800)),
        };
        break;
      case 'tracker':
        f.tracker = e.on ? prog(t, e.at, 400) : 0;
        break;
      case 'tick':
        f.ticks = f.ticks.map((v, i) => v || i === e.q);
        break;
      case 'type':
        f.composer = typed(e.text, t, e.at, e.cps);
        break;
      case 'send':
        f.composer = '';
        f.messages = [...f.messages, { role: 'teacher', text: e.text, appear: prog(t, e.at, 300), shown: 1 }];
        break;
      case 'think':
        f.thinking = { lines: e.lines, shown: Math.min(e.lines.length, Math.floor(dt / e.stepMs) + 1), elapsed: dt };
        f.title = e.title;
        f.sansTitle = e.sansTitle ?? false;
        break;
      case 'assistant':
        f.thinking = null;
        f.messages = [...f.messages, {
          role: 'assistant', text: '', kind: e.kind, topic: e.topic, index: e.index, stamp: e.stamp,
          appear: prog(t, e.at, 400), shown: e.blockMs > 0 ? Math.floor(dt / e.blockMs) + 1 : Infinity,
        }];
        break;
      case 'load':
        f.thinking = null;
        f.messages = [
          { role: 'teacher', text: TOPICS[e.topic].prompt, appear: 1, shown: 1 },
          { role: 'assistant', text: '', kind: 'answer', topic: e.topic, appear: 1, shown: Infinity },
        ];
        f.title = TOPICS[e.topic].title;
        f.sansTitle = false;
        f.panel = openPanel(e.topic, e.at, t);
        break;
      case 'panel':
        f.panel = e.id === null ? null : openPanel(e.id, e.at, t);
        break;
      case 'panelScroll':
        if (f.panel) f.panel = { ...f.panel, scroll: lerp(f.panel.scroll, e.y, prog(t, e.at, e.dur, easeInOut)) };
        break;
      case 'edit':
        if (f.panel) f.panel = { ...f.panel, edited: true, editFlash: 1 - clamp(dt / 1000) };
        break;
      case 'approve':
        if (!f.approved.includes(e.id)) f.approved = [...f.approved, e.id];
        break;
      case 'adaptTwin':
        if (f.panel) f.panel = { ...f.panel, twin: prog(t, e.at, 2000), followUp: dt >= 2000 };
        break;
      case 'select':
        f.classroom = { ...f.classroom, selected: e.index, selectAppear: prog(t, e.at, 300) };
        pulseAt = null;
        break;
      case 'classroomReveal':
        f.classroom = {
          ...f.classroom,
          kpi: prog(t, e.at, 2700),
          tiles: clamp(Math.floor((dt - TILE_START) / (TILE_SPAN / TILE_COUNT)) + 1, 0, TILE_COUNT),
        };
        break;
      case 'pulse':
        pulseAt = e.at;
        break;
      case 'adaptClass':
        f.classroom = { ...f.classroom, adapt: prog(t, e.at, 2500) };
        break;
    }
  }
  f.classroom = { ...f.classroom, pulse: pulseAt === null ? 0 : 0.5 - 0.5 * Math.cos((t - pulseAt) / 250) };
  return f;
}
```

Note: `prog` uses `easeOut`, which reaches exactly 1 at the end of its window, as the tests expect.

- [ ] **Step 7: Run the tests and check they pass.**

Run: `npx vitest run src/teacher/frame.test.ts`
Expected: PASS (12 tests). If the pulse test fails on the exact threshold, check the formula against `t = 785` (cos(3.14) ≈ −1 → pulse ≈ 1).

- [ ] **Step 8: Full check and commit.**

Run: `npm test && npx tsc --noEmit`
Expected: all pass.

```bash
git add -A
git commit -m "feat(teacher): move draft to src/teacher, block-structured copy, teacherFrame model"
```

---

### Task 2: Frame-driven screens and the live driver

**Files:**
- Create: `src/teacher/TeacherScreen.tsx`, `src/teacher/LiveTeacher.tsx`, `src/teacher/screen.test.tsx`
- Modify: `src/teacher/ContextPanel.tsx`, `src/teacher/Classroom.tsx`, `src/teacher/parts.tsx`, `src/teacher/main.tsx`, `src/styles.css`
- Delete: `src/teacher/ChatApp.tsx`

**Interfaces:**
- Consumes: `teacherFrame`, `TeacherFrame`, `TeacherEvent`, `PAST`, `GREETING` (Task 1); `Blocks`, `TOPICS`, `ADAPT`, `FALLBACK`, `studentBrief`, `routePrompt` (Task 1)
- Produces:
  - `TeacherScreen({ frame, actions?, composer? })`, where `composer?: { value: string; onChange(v: string): void }` overrides `frame.composer` in live mode
  - `TeacherActions`, as defined in Step 1
  - `LiveTeacher()`

- [ ] **Step 1: Define the actions** at the top of `TeacherScreen.tsx`.

```ts
export interface TeacherActions {
  send(text: string): void;
  open(topic: ContextId): void;
  reset(): void;
  setView(v: View): void;
  approve(id: ContextId): void;
  edit(): void;
  showPanel(id: ContextId | null): void;
  select(index: number | null): void;
  askStudent(s: Student): void;
  askClass(): void;
}
```

When `actions` is undefined (scripted mode), every button renders but its `onClick` is a no-op.

- [ ] **Step 2: Build `TeacherScreen`** by moving the JSX of the old `ChatApp` (`Sidebar`, `EmptyState`, `Composer`, `TeacherMsg`, `AssistantMsg`, `Thinking`) into `TeacherScreen.tsx` as stateless functions of `frame`.

  **Values from the frame**

  | Element | Value |
  |---|---|
  | View | `frame.view` |
  | Header title | `frame.title ?? 'New conversation'`, or `'Classroom'` when `frame.view === 'classroom'`. Use the sans style (`text-[19px] font-semibold`) when `frame.sansTitle`, else `font-serif text-[24px]` |
  | Header "Show context" button | rendered only when `actions` exists, `frame.view === 'chat'`, `frame.panel === null` and the thread has an answer |
  | Opening screen | shows when `frame.view === 'chat'`, `frame.messages.length === 0` and `frame.thinking === null` |
  | Greeting text | `GREETING.slice(0, frame.greeting.chars)`. Render it as `Good afternoon,<br/><span className="italic">Lam.</span>` split at the comma, so the typed prefix fills line 1 first |
  | Attention row `i` | `opacity: rows[i]`, `transform: translateY((1-rows[i])*12px)` |
  | Attention row figures | count with `rows[i]`: `75→42` shows as `${Math.round(75 - 33*rows[i])}` until `rows[i] === 1` (then the full `75→42`), `12/55` as `${Math.round(12*rows[i])}/55`, and `3` as `${Math.round(3*rows[i])}` |
  | Message `m` | `opacity: m.appear`, `transform: translateY((1-m.appear)*6px)` |
  | Assistant message content | `<Blocks blocks={…} shown={m.shown} />`. Blocks by kind: answer → `TOPICS[m.topic!].answer`; approved → `TOPICS[m.topic!].approved`; adapt → `ADAPT`; fallback → `FALLBACK`; brief → `studentBrief(STUDENTS[m.index!])` |
  | Assistant stamp | `m.stamp`, when set, renders above the blocks as `font-mono text-[11px] text-egg-mute` |
  | Agent chip and "Open context →" | only once the message is fully shown (`m.shown >= blocks.length`) |
  | Follow-up chips | only on the last assistant message of kind `answer`, when it is fully shown and `frame.thinking === null` |
  | Thinking lines | `frame.thinking.lines.slice(0, shown)` |
  | Thinking asterisk | `style={{ transform: `rotate(${elapsed * 0.15}deg)` }}` |
  | Thinking dot `d` (on the last line) | `opacity: 0.25 + 0.75 * Math.max(0, Math.sin((elapsed / 1100) * 2 * Math.PI - d * 0.8))` |
  | Composer | `composer?.value ?? frame.composer`. The textarea is `readOnly` when `composer` is undefined |
  | Send button | orange when the text is non-empty |
  | Side panel | rendered when `frame.view === 'chat' && frame.panel` |
  | Classroom | rendered when `frame.view === 'classroom'` |

  **Remove these:** every `chat-rise`, `chat-slide`, `chat-dot`, `animate-spin` and `transition-*` class.

  **Layout:**
  - Root: `flex h-full bg-egg-bg font-sans text-egg-ink antialiased`.
  - Sidebar: as in the draft. The active topic is highlighted from `frame.panel?.id` when `frame.view === 'chat'`.
  - Leave a slot directly under the 60 px header for the tracker. Task 5 fills it; for now render nothing there.

- [ ] **Step 3: Make the panel frame-driven.**

  1. Change `ContextPanel` props to `{ panel: FramePanel; approved: boolean; actions?: TeacherActions }`.

  2. The outer `<aside>` gets the style below. Remove `key` and `chat-slide`.

  ```tsx
  style={{ opacity: panel.appear, transform: `translateX(${(1 - panel.appear) * 24}px)` }}
  ```

  3. The scroll container stays `overflow-y-auto`. Its inner wrapper gets `style={{ transform: `translateY(${-panel.scroll}px)` }}`.

  4. Bars:
     - Pass `grow={panel.bars}` to each `Meter`.
     - Student mastery uses `lerp(MASTERY_INITIAL[c], MASTERY_POST[c], panel.twin)` as its value. Import `MASTERY_POST` and `lerp`.
     - Class group meters use their `HEATMAP` values.

  5. Proposal, student panel:
     - `steps` comes from `panel.followUp ? PATHWAY_UPDATED : panel.edited ? PATHWAY_INITIAL : PATHWAY_PROPOSED`. Display each step's time as `when.replace(/^(Today|Tomorrow) /, '')`.
     - The title becomes `'Next: equivalence laws in practice'` when `followUp`.
     - The `by` line becomes `'Auto-approved · within your policy'` when `followUp`.
     - The step-4 row gets `style={{ background: `rgba(255,91,31,${0.25 * panel.editFlash})` }}`.

  6. Proposal buttons:
     - When `followUp`, show only a dark pill reading `Auto-approved · tomorrow 09:00`.
     - When `approved`, show the existing done pill.
     - Otherwise show **Approve & send** (`actions?.approve(panel.id)`), **Edit** (`actions?.edit()`) and **Not now**.

  7. Class and attention panels keep their content, with the same `approved`/`actions` wiring. **Close** calls `actions?.showPanel(null)`.

- [ ] **Step 4: Make the Classroom frame-driven.**

  1. Change `Classroom` props to `{ cls: FrameClassroom; actions?: TeacherActions }`. Keep the `filter` `useState` (live-only UI; scripted mode never changes it).

  2. Remove the `selected` state and use `cls.selected`. Tile and intervention clicks call `actions?.select(cls.selected === i ? null : i)`.

  3. KPI targets, with `a = cls.adapt` and `k = cls.kpi`:

     | KPI | Value | Note |
     |---|---|---|
     | Students | `Math.round(55 * k)` | |
     | Need support | `Math.round(lerp(12, 9, a) * k)` | |
     | High risk | `Math.round(lerp(5, 3, a) * k)` | note `${COMPLEX.length} escalated to you` |
     | Running | `Math.round(RUNNING_TOTAL * k)` | |
     | Avg. mastery | `(avg * k).toFixed(2)` | |

     The headline uses the Need support value: `55 students, <span>{needSupport}</span> need support`.

  4. Tiles:
     - Tile `i` renders as a revealed tile only when `i < cls.tiles`. Otherwise it renders as an empty placeholder (`border border-dashed border-egg-line bg-transparent`, no text) of the same size.
     - Minh Anh (`MINH_ANH.index`) shows `lerp(0.35, 0.72, a).toFixed(2)`. Her band is `'support'` when `a >= 0.5`, else `bandOf(s)`.
     - When `cls.pulse > 0` and she is not selected, her tile gets `style={{ boxShadow: `0 0 0 ${2 + 6 * cls.pulse}px rgba(255,91,31,${0.35 + 0.4 * cls.pulse})` }}`.

  5. The student card (when `cls.selected !== null`) gets `opacity: cls.selectAppear`. Its **Ask about** button calls `actions?.askStudent(s)`, and **Close** calls `actions?.select(null)`. **Ask about the class** calls `actions?.askClass()`.

  6. Remove `transition-opacity`.

- [ ] **Step 5: Update `parts.tsx`.**
  - `Meter` gains `grow = 1`. The bar width becomes `${value * grow * 100}%`; the number keeps showing `value.toFixed(2)`.
  - Remove `transition-colors` from `Button`.
  - Remove the `chat-rise`, `chat-slide`, `chat-dot` keyframes and classes from `src/styles.css`. Keep `body.chat` renamed to `body.teacher` and update `teacher.html` to `<body class="teacher">`. Keep the `.chat-prose` rules.

- [ ] **Step 6: Write `LiveTeacher.tsx`.**

```tsx
import { useState } from 'react';
import { useNow } from '../engine/useNow';
import type { Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { routePrompt, TOPICS, type ContextId } from './conversations';
import { PAST, teacherFrame, type TeacherEvent, type View } from './frame';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const STEP_MS = 900;
const BLOCK_MS = 250;
const FALLBACK_LINES = ['Reading your class context'];

/** Live draft: clicks append time-stamped events; the same frame model renders them. */
export function LiveTeacher() {
  const [t0] = useState(() => Date.now());
  const now = useNow();
  const t = now - t0;
  const [events, setEvents] = useState<TeacherEvent[]>([
    { at: PAST, type: 'greeting' },
    { at: PAST, type: 'classroomReveal' },
  ]);
  const [draft, setDraft] = useState('');
  const frame = teacherFrame(events, t);
  const busy = frame.thinking !== null || events.some((e) => e.at > t);
  const push = (...e: TeacherEvent[]) => setEvents((list) => [...list, ...e]);

  const askEvents = (text: string, start: number): TeacherEvent[] => {
    const topic = routePrompt(text);
    const lines = topic ? TOPICS[topic].thinking : FALLBACK_LINES;
    const answerAt = start + lines.length * STEP_MS + 300;
    const out: TeacherEvent[] = [
      { at: start, type: 'send', text },
      { at: start, type: 'think', lines, stepMs: STEP_MS, title: topic ? TOPICS[topic].title : frame.title ?? 'New conversation' },
      { at: answerAt, type: 'assistant', kind: topic ? 'answer' : 'fallback', topic: topic ?? undefined, blockMs: BLOCK_MS },
    ];
    if (topic) out.push({ at: answerAt, type: 'panel', id: topic });
    return out;
  };

  const actions: TeacherActions = {
    send: (text) => {
      if (!text.trim() || busy) return;
      setDraft('');
      push(...askEvents(text.trim(), t));
    },
    open: (topic) => push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'load', topic }),
    reset: () => push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }),
    setView: (v: View) => push({ at: t, type: 'view', view: v }),
    approve: (id: ContextId) => push({ at: t, type: 'approve', id }, { at: t + 500, type: 'assistant', kind: 'approved', topic: id, blockMs: BLOCK_MS }),
    edit: () => push({ at: t, type: 'edit' }),
    showPanel: (id) => push({ at: t, type: 'panel', id }),
    select: (index) => push({ at: t, type: 'select', index }),
    askStudent: (s: Student) => {
      if (busy) return;
      const base: TeacherEvent[] = [{ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }];
      if (s.index === MINH_ANH.index) return push(...base, ...askEvents(TOPICS.student.prompt, t));
      push(
        ...base,
        { at: t, type: 'send', text: `How is ${s.name} doing?` },
        { at: t, type: 'think', lines: [`Student Analysis Agent · reading ${s.name}’s learning twin`], stepMs: STEP_MS, title: s.name, sansTitle: true },
        { at: t + STEP_MS + 300, type: 'assistant', kind: 'brief', index: s.index, blockMs: BLOCK_MS },
      );
    },
    askClass: () => {
      if (busy) return;
      push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }, ...askEvents(TOPICS.class.prompt, t));
    },
  };

  return <TeacherScreen frame={frame} actions={actions} composer={{ value: draft, onChange: setDraft }} />;
}
```

- [ ] **Step 7: Live entry.** Replace `src/teacher/main.tsx` with:

```tsx
import '../fonts';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import { createRoot } from 'react-dom/client';
import { LiveTeacher } from './LiveTeacher';

createRoot(document.getElementById('root')!).render(<LiveTeacher />);
```

Task 4 adds the `?scene` branch.

- [ ] **Step 8: Write the screen smoke tests** in `src/teacher/screen.test.tsx`.

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { TeacherScreen } from './TeacherScreen';
import { Classroom } from './Classroom';

const render = (events: TeacherEvent[], t = 0) => html(<TeacherScreen frame={teacherFrame(events, t)} />);

describe('TeacherScreen', () => {
  it('opening screen types the greeting', () => {
    expect(render([{ at: 0, type: 'greeting' }], 1000)).toContain('Good after');
    expect(render([{ at: 0, type: 'greeting' }], 1000)).not.toContain('Lam.');
  });
  it('reveals only the shown answer blocks', () => {
    const ev: TeacherEvent[] = [
      { at: PAST, type: 'send', text: 'Why did Minh Anh’s quiz score drop?' },
      { at: 0, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
    ];
    expect(render(ev, 500)).toContain('75% to 42%');
    expect(render(ev, 500)).not.toContain('converse');
    expect(render(ev, 5500)).toContain('waiting for your approval');
  });
  it('renders the student panel with the edited 20:00 step after edit', () => {
    const ev: TeacherEvent[] = [{ at: PAST, type: 'load', topic: 'student' }];
    expect(render(ev)).toContain('19:00');
    expect(render([...ev, { at: PAST, type: 'edit' }])).toContain('20:00');
  });
  it('renders the classroom with placeholders before the reveal', () => {
    const before = html(<Classroom cls={teacherFrame([], 0).classroom} />);
    expect(before).toContain('need support');
    expect(before).not.toContain('Minh Anh');
    const after = html(<Classroom cls={teacherFrame([{ at: PAST, type: 'classroomReveal' }], 0).classroom} />);
    expect(after).toContain('Minh Anh');
  });
  it('shows the adapt message with its stamp', () => {
    const out = render([{ at: PAST, type: 'load', topic: 'student' }, { at: PAST, type: 'assistant', kind: 'adapt', blockMs: 0, stamp: '20:41' }]);
    expect(out).toContain('20:41');
    expect(out).toContain('0.35 → 0.72');
  });
});
```

The classroom placeholder test renders `Classroom` alone (the sidebar also names Minh Anh). It relies on unrevealed tiles rendering no name, and on the Interventions list (which names Minh Anh) being hidden until `cls.kpi > 0`. Render the Interventions list and the heatmap only when `cls.kpi > 0`.

- [ ] **Step 9: Run the tests.**

Run: `npx vitest run src/teacher`
Expected: PASS.

- [ ] **Step 10: Check the live draft in a browser.**
  1. Start or reuse `npm run dev` and open `http://localhost:5173/teacher.html`.
  2. Click the first attention row. Expect the thinking lines, the answer revealing block by block, and the panel sliding in.
  3. Click **Edit** (step 4 changes to 20:00), then **Approve & send** (the confirmation arrives).
  4. In **Classroom**, click a tile, then **Ask about …**.
  5. Expect no console errors.

  Use the Playwright script pattern from the README's contact sheet, or a manual browser. Report what you saw.

- [ ] **Step 11: Full check and commit.**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(teacher): stateless frame-driven screens and live driver"
```

---

### Task 3: New scene table, phone remap, Director, and removing the dark dashboard

**Files:**
- Modify:
  - `src/scenario/scenes.ts`, `src/scenario/orchestration.ts`
  - `src/student/frame.ts`, `src/student/frame.test.ts`, `src/student/StudentApp.tsx`, `src/student/screens/LockScreen.tsx`, `src/student/screens/Chrome.tsx`, `src/student/screens.test.tsx`
  - `src/engine/playback.ts`, `src/engine/sync.ts`, `src/engine/playback.test.ts`
  - `src/controller/ControllerApp.tsx`, `src/controller/controller.test.tsx`
  - `src/scenario/core.test.ts`, `src/scenario/content.test.ts`
  - `src/ui/primitives.test.tsx`, `src/ui/overlays.test.tsx`
  - `vite.config.ts`
- Delete:
  - `dashboard.html`
  - `src/dashboard/` — first move `src/dashboard/scenes/Sc01Fragmented.tsx` → `src/teacher/scenes/ProblemScene.tsx` and `src/dashboard/architecture/ArchitectureView.tsx` → `src/teacher/scenes/HowItWorks.tsx` (Task 4 restyles them)
  - `src/scenario/agents.ts`, `src/scenario/simulation.ts`
  - every `src/ui/*` file that no longer has an importer

**Interfaces:**
- Produces:
  - `SceneDef.chapter: string`
  - `CUES = { approveNotify: 7500, adaptUpdate: 9000 }`
  - `PATHWAY_PROPOSED`, `PATHWAY_INITIAL` (assessment at 20:00)
  - `Toggles.chapter: boolean` (default `true`, URL `chapter=0`)
  - `AppName = 'teacher' | 'student'`
  - `StudentScreen` variants all carry `clock: string`

- [ ] **Step 1: Replace the scene table** in `src/scenario/scenes.ts`.

  1. Add `chapter: string;` to `SceneDef`, with the doc comment `/** Loop stage shown as the chapter label; empty = none. */`.

  2. Replace the scene list with:

  ```ts
  export const SCENES: SceneDef[] = [
    { id: 1, label: 'Problem', title: 'Fragmented Data', subtitle: 'Heterogeneous information. Limited learning intelligence.', chapter: '', durationMs: 15000, shots: [3000, 8000, 14000] },
    { id: 2, label: 'Beyond', title: 'Multimodal Foundation Models', subtitle: 'Every source. One conversation.', chapter: 'Sense', durationMs: 10000, shots: [1500, 4500, 9500] },
    { id: 3, label: 'Classroom', title: 'Learning Digital Twins', subtitle: 'A live model of every student.', chapter: 'Sense', durationMs: 15000, shots: [1500, 5000, 11500, 14500] },
    { id: 4, label: 'Minh Anh', title: 'Collaborative Agent Intelligence', subtitle: 'Knowledge-grounded reasoning, with evidence.', chapter: 'Diagnose', durationMs: 25000, shots: [1500, 4000, 6500, 11000, 17000, 24000] },
    { id: 5, label: 'Class gap', title: 'Knowledge Graphs → Grounded Inference', subtitle: 'Prerequisite gaps, across the class.', chapter: 'Diagnose', durationMs: 10000, shots: [1500, 4500, 9500] },
    { id: 6, label: 'Approve', title: 'AI Coordinates. Teachers Govern.', subtitle: '', chapter: 'Intervene · Oversee', durationMs: 15000, shots: [1000, 3200, 5000, 7200, 14500] },
    { id: 7, label: 'Student', title: 'Personalized Learning', subtitle: 'Adaptive support. Continuous evidence.', chapter: 'Intervene', durationMs: 20000, shots: [19000] },
    { id: 8, label: 'Adapt', title: 'Monitor. Adapt.', subtitle: 'The closed-loop learning digital twin.', chapter: 'Adapt', durationMs: 15000, shots: [2500, 6000, 9000, 14500] },
    { id: 9, label: 'How it works', title: 'One Integrated AI Architecture', subtitle: 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.', chapter: '', durationMs: 20000, shots: [4000, 11000, 15000, 19500] },
    { id: 10, label: 'Closing', title: '', subtitle: '', chapter: '', durationMs: 5000, shots: [4500] },
  ];
  ```

  3. Replace `CUES` with:

  ```ts
  export const CUES = {
    /** Sc6: notification lands on the phone, 1 s after the teacher clicks Approve (6500). */
    approveNotify: 7500,
    /** Sc8: the follow-up plan appears on the phone, as the Classroom updates. */
    adaptUpdate: 9000,
  } as const;
  ```

- [ ] **Step 2: Update the pathway** in `src/scenario/orchestration.ts`. Replace `PATHWAY_INITIAL` with:

```ts
/** Proposed in Sc4–Sc6, before the teacher's edit. Every session falls after the 15:00 approval. */
export const PATHWAY_PROPOSED = [
  { title: 'Review logical operators', mins: 5, when: 'Today 15:30' },
  { title: 'Explore visual explanations', mins: 8, when: 'Today 16:00' },
  { title: 'Practice guided examples', mins: 10, when: 'Today 17:00' },
  { title: 'Complete a mastery assessment', mins: 10, when: 'Today 19:00' },
];

/** Approved in Sc6: the teacher moved the mastery assessment to 20:00. The phone shows this. */
export const PATHWAY_INITIAL = PATHWAY_PROPOSED.map((p, i) => (i === 3 ? { ...p, when: 'Today 20:00' } : p));
```

- [ ] **Step 3: Write the failing phone-frame tests.** Replace `src/student/frame.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { STUDENT_SHOTS, studentFrame } from './frame';
import { CUES, sceneById } from '../scenario/scenes';
import { SC9 } from '../scenario/practice';

describe('studentFrame', () => {
  it('idles on the lock screen outside Sc6–Sc8', () => {
    expect(studentFrame(1, 0)).toEqual({ screen: 'lock', notification: 0, clock: '14:58' });
    expect(studentFrame(4, 5000)).toEqual({ screen: 'lock', notification: 0, clock: '14:58' });
  });
  it('lands the notification 1 s after Approve in Sc6', () => {
    expect(studentFrame(6, CUES.approveNotify - 1)).toEqual({ screen: 'lock', notification: 0, clock: '15:00' });
    expect(studentFrame(6, CUES.approveNotify + 1000)).toEqual({ screen: 'lock', notification: 1, clock: '15:00' });
  });
  it('walks Sc7 through lock → plan → practice → progress at 17:00', () => {
    expect(studentFrame(7, SC9.tap)).toMatchObject({ screen: 'lock', clock: '16:58' });
    expect(studentFrame(7, SC9.plan + 100)).toEqual({ screen: 'plan', variant: 'initial', local: 100, clock: '17:00' });
    expect(studentFrame(7, SC9.pickWrong)).toEqual({ screen: 'practice', local: SC9.pickWrong, clock: '17:00' });
    expect(studentFrame(7, SC9.progress + 50)).toEqual({ screen: 'progress', local: 50, clock: '17:00' });
  });
  it('shows the updated plan from the Sc8 cue', () => {
    expect(studentFrame(8, CUES.adaptUpdate - 1)).toMatchObject({ screen: 'lock', clock: '20:41' });
    expect(studentFrame(8, CUES.adaptUpdate + 10)).toEqual({ screen: 'plan', variant: 'updated', local: 10, clock: '20:42' });
  });
  it('student shots fall inside their scenes', () => {
    for (const [id, shots] of Object.entries(STUDENT_SHOTS)) {
      for (const t of shots) expect(t).toBeLessThanOrEqual(sceneById(Number(id)).durationMs);
    }
  });
});
```

- [ ] **Step 4: Run them to see them fail.**

Run: `npx vitest run src/student/frame.test.ts`
Expected: FAIL (no `clock` field; scene mapping still old).

- [ ] **Step 5: Implement `src/student/frame.ts`.**

```ts
import { prog } from '../engine/anim';
import { SC9 } from '../scenario/practice';
import { CUES } from '../scenario/scenes';

export type StudentScreen =
  | { screen: 'lock'; notification: number; clock: string }
  | { screen: 'plan'; variant: 'initial' | 'updated'; local: number; clock: string }
  | { screen: 'practice'; local: number; clock: string }
  | { screen: 'progress'; local: number; clock: string };

/** Which phone screen shows at scene time t. Sc7 reuses the practice timeline (SC9 constants, scene time). */
export function studentFrame(sceneId: number, t: number): StudentScreen {
  if (sceneId === 6) return { screen: 'lock', notification: prog(t, CUES.approveNotify, 500), clock: '15:00' };
  if (sceneId === 7) {
    if (t < SC9.plan) return { screen: 'lock', notification: 1, clock: '16:58' };
    if (t < SC9.practice) return { screen: 'plan', variant: 'initial', local: t - SC9.plan, clock: '17:00' };
    if (t < SC9.progress) return { screen: 'practice', local: t, clock: '17:00' };
    return { screen: 'progress', local: t - SC9.progress, clock: '17:00' };
  }
  if (sceneId === 8) {
    return t >= CUES.adaptUpdate
      ? { screen: 'plan', variant: 'updated', local: t - CUES.adaptUpdate, clock: '20:42' }
      : { screen: 'lock', notification: 0, clock: '20:41' };
  }
  return { screen: 'lock', notification: 0, clock: '14:58' };
}

/** Phone timestamps for the contact sheet. */
export const STUDENT_SHOTS: Record<number, number[]> = {
  6: [8200],
  7: [1800, 4500, 9500, 12000, 15800, 18500],
  8: [10500],
};
```

Then wire the clock through the phone screens:
- `LockScreen` gains a `clock: string` prop that replaces the hard-coded `14:58`.
- `StatusBar` in `Chrome.tsx` gains `clock: string`, replacing `15:00`.
- In `StudentApp.tsx`:
  - pass `clock={f.clock}` to `LockScreen` and `StatusBar`
  - change `tapAt={scene.id === 9 ? …}` to `scene.id === 7`
  - change `scene.id === 9 && <EvidencePill …/>` to `scene.id === 7`
- Update `src/student/screens.test.tsx` call sites to pass `clock="14:58"` (or `"17:00"`).

- [ ] **Step 6: Add the chapter toggle and rename the app.**
  1. `playback.ts`: add `chapter: boolean` to `Toggles`, set `chapter: true` in `DEFAULT_TOGGLES`, and add `chapter: q.get('chapter') !== '0'` in `stateFromSearch`. Update its doc comment to `titles=0 footer=0 cursor=0 chapter=0 tc=1`.
  2. `sync.ts`: `export type AppName = 'teacher' | 'student';`.
  3. `playback.test.ts`: update any `toggles` literal to include `chapter`.
  4. `ControllerApp.tsx`:
     - `TOGGLE_LABELS` gains `chapter: 'Chapter label'`.
     - `seen` initial becomes `{ teacher: 0, student: 0 }`.
     - The app list becomes `(['teacher', 'student'] as AppName[])`.
     - The open buttons become `window.open('/teacher.html?scene=1', 'teacher', 'width=1920,height=1080')` labelled **Open teacher window**, and the existing student button.
     - `STANDALONE` becomes:

     ```ts
     const STANDALONE = [
       { label: 'Copy phone Sc7 autoplay URL', path: '/student.html?scene=7&autoplay' },
       { label: 'Copy teacher Sc1 autoplay URL', path: '/teacher.html?scene=1&autoplay' },
     ];
     ```

- [ ] **Step 7: Remove the dark dashboard.**

```bash
mkdir -p src/teacher/scenes
git mv src/dashboard/scenes/Sc01Fragmented.tsx src/teacher/scenes/ProblemScene.tsx
git mv src/dashboard/architecture/ArchitectureView.tsx src/teacher/scenes/HowItWorks.tsx
git rm -r src/dashboard dashboard.html src/scenario/agents.ts src/scenario/simulation.ts
```

Then, in order:
1. In `vite.config.ts`, remove `dashboard: page('dashboard')`.
2. In `ProblemScene.tsx`, rename the export to `ProblemScene`, change its props to `{ t: number; cursor: boolean }`, and fix import paths (`../../engine/anim`, `../../scenario/sources`, `../../ui/FakeCursor`, `../../ui/tokens`).
3. In `HowItWorks.tsx`, rename the export to `HowItWorks` and fix import paths. Leave the styling for Task 4.
4. For each file in `src/ui/`, run `grep -rln "ui/<Name>'" src scripts`. Delete the file if nothing outside `src/ui/*.test.tsx` imports it. Expected deletions: `AgentNode.tsx` (only if `AgentPair` is also gone after Task 4), `GraphView.tsx`, `Kpi.tsx`, `MessageCard.tsx`, `Panel.tsx`, `PhoneGlyph.tsx`, `PipelineStatus.tsx`, `StudentGrid.tsx`, `TwinPanel.tsx`. Keep anything `HowItWorks` still imports (`AgentPair`, `AgentNode`, `Camera`, `Conduit`, `FullSvg`, `ParticleStream`) until Task 4.
5. Trim `src/ui/primitives.test.tsx` to the components that still exist.
6. Trim `src/scenario/content.test.ts` and `core.test.ts`: remove tests for `agents.ts`, `simulation.ts` and removed constants. Update the scene assertions:
   - `TOTAL_MS === 150000`
   - `SCENES.length === 10`
   - every `shots` entry is ≤ its `durationMs`
   - the `CUES` values above lie inside Sc6 and Sc8
   - `PATHWAY_INITIAL[3].when === 'Today 20:00'` and `PATHWAY_PROPOSED[3].when === 'Today 19:00'`
7. Update `src/ui/overlays.test.tsx` and `src/controller/controller.test.tsx` for the new scene ids and labels (for example, assert the Director lists `Classroom` and `How it works`).

- [ ] **Step 8: Run everything.**

Run: `npm test && npx tsc --noEmit`
Expected: all pass. The teacher window has no scripted mode yet; that is Task 4.

- [ ] **Step 9: Commit.**

```bash
git add -A
git commit -m "feat: 10-scene product-first table, phone remap and clocks, chapter toggle; remove dark dashboard"
```

---

### Task 4: Scripted teacher window, light overlays, and Sc1, Sc9, Sc10

**Files:**
- Create: `src/teacher/TeacherApp.tsx`, `src/teacher/script.ts` (with an empty script table for now), `src/teacher/scenes/Closing.tsx`, `src/teacher/scenes/scenes.test.tsx`
- Modify: `src/teacher/main.tsx`, `src/teacher/scenes/ProblemScene.tsx`, `src/teacher/scenes/HowItWorks.tsx`, `src/ui/Overlays.tsx`, `src/ui/FakeCursor.tsx`, `src/ui/overlays.test.tsx`, `src/student/StudentApp.tsx` (overlay variant name)

**Interfaces:**
- Consumes: `teacherFrame`, `TeacherScreen`, `SceneDef.chapter`, `Toggles.chapter`
- Produces:
  - `interface TeacherScript { events: TeacherEvent[]; cursor: CursorKey[] }`
  - `scriptFor(scene: number): TeacherScript`
  - `TEACHER_SCENES = [2, 3, 4, 5, 6, 7, 8]`
  - `OverlaysProps.variant: 'teacher' | 'phone'`

- [ ] **Step 1: Write the script skeleton** in `src/teacher/script.ts`. Task 5 fills `OWN`.

```ts
import type { CursorKey } from '../ui/FakeCursor';
import { PAST, type TeacherEvent } from './frame';

export interface TeacherScript {
  events: TeacherEvent[];
  cursor: CursorKey[];
}

/** Scenes rendered by TeacherScreen. Sc7 has no events of its own: it holds Sc6's last frame. */
export const TEACHER_SCENES = [2, 3, 4, 5, 6, 7, 8];

/** Each scene's own events in scene time, ascending. */
const OWN: Partial<Record<number, TeacherScript>> = {};

/** A scene's script: every earlier teacher scene's events replayed at PAST (finished), then its own. */
export function scriptFor(scene: number): TeacherScript {
  const prior = TEACHER_SCENES.filter((id) => id < scene).flatMap((id) => (OWN[id]?.events ?? []).map((e) => ({ ...e, at: PAST })));
  const own = OWN[scene] ?? { events: [], cursor: [] };
  return { events: [...prior, ...own.events], cursor: own.cursor };
}
```

`OWN` stays `const`; Task 5 adds entries.

- [ ] **Step 2: Restyle the cursor and overlays.**

  1. `FakeCursor`: arrow `fill="#1A1714"`, `stroke="#FFFFFF"`; ripple border `3px solid #FF5B1F`. Doc comment: `/** Scripted pointer: glides between keyframes; an orange ripple plays at each click key. */`.

  2. `Overlays`:
     - `variant: 'teacher' | 'phone'`. Rename `dash` to `teacher`. Update call sites: `StudentApp` stays `phone`.
     - Title card background: `linear-gradient(90deg, rgba(242,237,228,0.97) 60%, rgba(242,237,228,0))`.
     - Accent bar: `#FF5B1F`.
     - Title: `font-serif` at `fontSize: 64`, colour `#1A1714`, no `font-extrabold`.
     - Subtitle: `font-sans font-medium` at `fontSize: 26`, colour `#6B6359`.
     - Footer: teacher colour `#9C9285`.
     - Chapter label (teacher only), shown when `toggles.chapter && scene.chapter`:

     ```tsx
     <div className="font-mono uppercase" style={{ position: 'absolute', right: 32, bottom: 44, zIndex: 60, fontSize: 15, letterSpacing: '0.16em', color: '#1A1714', display: 'flex', alignItems: 'center', gap: 10 }}>
       <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5B1F' }} />
       {scene.chapter}
     </div>
     ```

  3. Update `overlays.test.tsx`:
     - the chapter label shows for scene 4 (`Diagnose`) and is absent with `chapter: false`
     - it is absent for scene 1 (empty chapter)
     - it is absent on the phone variant

- [ ] **Step 3: Restyle `ProblemScene`** (light, and the spec's question timing).
  - `QUESTIONS_IN = 8000`, `QUESTION_STEP = 1000`.
  - Root background `#F2EDE4`.
  - Window body `#FFFDF8`, title bar `#F8F4EC`, traffic dots `#DCD3C5`, title text `#6B6359`, body text `#1A1714`. Border `#DCD3C5`, or `#1A1714` when focused. Shadow `0 18px 40px -20px rgba(26,23,20,0.35)`.
  - Veil colour `#F2EDE4`, max opacity `0.75`.
  - Question chips: background `#FFFDF8`, border `#1A1714`. The "?" circle is `#FF5B1F` with `#1A1714` text. Question text `#1A1714`.
  - Remove the `C` import if unused.
  - Window `title` strings are Vietnamese in places, so keep them in the sans face (they already are).

- [ ] **Step 4: Restyle `HowItWorks`** into the light segment.
  - Drop `Camera` and `mode`. The signature is `HowItWorks({ t }: { t: number })`.
  - Root `absolute inset-0` with background `#F2EDE4`.
  - Boxes:
    - card `#FFFDF8`, `2px` border `#1A1714`, no glow
    - pillar numbers are `#FF5B1F` circles with `#1A1714` text
    - titles `font-serif text-[30px] leading-tight text-[#1A1714]`
    - subs `text-[17px] text-[#6B6359]`
  - Box changes:
    - `teacher` → title `Teacher app`, sub `Chat · Classroom · approvals`
    - `student` → title `Student app`, sub `Personalized pathways · evidence`
    - `agents` keeps the title `Agentic AI`, and instead of `AgentPair` renders two pills, `SAS` and `TAS`, joined by `⇄` (`font-mono text-[16px]`, pills `border border-[#1A1714] rounded-full px-3 py-1`)
  - Reveal times: `mm: 1500, kg: 3500, twin: 4500, agents: 6000, engine: 8000, teacher: 9500, student: 10500`. Source pills fade in at `i * 150`.
  - Conduits use colour `#1A1714` at their existing opacity logic. All `ParticleStream`s use `color="#FF5B1F"`, start after their target box appears, and run with `count` large enough to keep flowing to 20000 (for example `count={40} gap={450}`).
  - Loop highlight: `const LOOP: BoxId[] = ['mm', 'kg', 'twin', 'agents', 'engine', 'teacher', 'student'];` and `const active = LOOP[stepIndex(t, LOOP.map((_, i) => 12000 + i * 800))];`. The active box's border becomes `#FF5B1F` with `boxShadow: '0 0 0 6px rgba(255,91,31,0.18)'`. After 17600 nothing is highlighted, so `active` is only valid while `t < 12000 + LOOP.length * 800`.
  - Remove the logo block and the `tagline` (the lower-third title carries it).
  - After this, delete `src/ui/AgentPair.tsx`, `src/ui/AgentNode.tsx` and `src/ui/Camera.tsx` if nothing imports them, and trim `primitives.test.tsx` accordingly.

- [ ] **Step 5: Write `Closing.tsx`.**

```tsx
import { fade } from '../../engine/anim';
import { Asterisk } from '../parts';

const TAGLINE = 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.';

export function Closing({ t }: { t: number }) {
  const mark = fade(t, 300);
  const line = fade(t, 1200);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-egg-bg text-egg-ink">
      <div className="flex items-center gap-5" style={{ opacity: mark, transform: `translateY(${(1 - mark) * 14}px)` }}>
        <span className="font-serif text-[180px] leading-none">Beyond</span>
        <Asterisk size={84} />
      </div>
      <div className="mt-4 font-mono text-[18px] uppercase tracking-[0.3em] text-egg-mute" style={{ opacity: mark }}>AI Tutoring</div>
      <div className="mt-10 max-w-[1300px] text-center font-serif text-[40px] italic leading-tight" style={{ opacity: line }}>{TAGLINE}</div>
    </div>
  );
}
```

- [ ] **Step 6: Write `TeacherApp.tsx`.**

```tsx
import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { FakeCursor } from '../ui/FakeCursor';
import { Overlays } from '../ui/Overlays';
import { teacherFrame } from './frame';
import { Closing } from './scenes/Closing';
import { HowItWorks } from './scenes/HowItWorks';
import { ProblemScene } from './scenes/ProblemScene';
import { scriptFor } from './script';
import { TeacherScreen } from './TeacherScreen';

const CURSOR_TAIL_MS = 300;

/** Scripted teacher window: every frame is a function of the Director's scene clock. */
export function TeacherApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  let body;
  if (scene.id === 1) body = <ProblemScene t={t} cursor={toggles.cursor} />;
  else if (scene.id === 9) body = <HowItWorks t={t} />;
  else if (scene.id === 10) body = <Closing t={t} />;
  else {
    const { events, cursor } = scriptFor(scene.id);
    const shown = toggles.cursor && cursor.length > 0 && t >= cursor[0].t && t <= cursor[cursor.length - 1].t + CURSOR_TAIL_MS;
    body = (
      <>
        <TeacherScreen frame={teacherFrame(events, t)} />
        <FakeCursor t={t} keys={cursor} visible={shown} />
      </>
    );
  }
  return (
    <Stage width={1920} height={1080} background="#F2EDE4">
      {body}
      <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="teacher" />
    </Stage>
  );
}
```

- [ ] **Step 7: Branch the entry.** In `src/teacher/main.tsx`:

```tsx
import '../fonts';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { LiveTeacher } from './LiveTeacher';
import { TeacherApp } from './TeacherApp';

/** `?scene=N` → scripted (Director-synced, recordable); no scene → the live clickable draft. */
const scripted = new URLSearchParams(window.location.search).has('scene');

createRoot(document.getElementById('root')!).render(
  scripted ? (
    <PlaybackProvider app="teacher" fallbackScene={1}>
      <TeacherApp />
    </PlaybackProvider>
  ) : (
    <LiveTeacher />
  ),
);
```

Also add the Instrument Serif face to the warm-up list in `src/fonts.ts`: import `@fontsource/instrument-serif/400.css` and `400-italic.css` there, and add `'400 16px "Instrument Serif"'` and `'italic 400 16px "Instrument Serif"'` to the face list. Then remove the two duplicate imports from `main.tsx`. Instrument Serif has no `ạ`; use the sample text `'Aa→'` for those two faces by loading them in a separate `document.fonts.load(face, 'Aa→')` loop.

- [ ] **Step 8: Write the scene smoke tests** in `src/teacher/scenes/scenes.test.tsx`.

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ProblemScene } from './ProblemScene';
import { HowItWorks } from './HowItWorks';
import { Closing } from './Closing';
import { TEACHER_QUESTIONS } from '../../scenario/sources';

describe('full-canvas scenes', () => {
  it('Problem shows the questions only from 8000', () => {
    expect(html(<ProblemScene t={7000} cursor={false} />)).not.toContain(TEACHER_QUESTIONS[0]);
    expect(html(<ProblemScene t={14000} cursor={false} />)).toContain(TEACHER_QUESTIONS[4]);
  });
  it('How it works names every layer and both apps', () => {
    const out = html(<HowItWorks t={19000} />);
    for (const s of ['Multimodal Foundation Models', 'Knowledge Graph', 'Learning Digital Twin', 'Agentic AI', 'Teacher app', 'Student app', 'SAS', 'TAS']) expect(out).toContain(s);
  });
  it('Closing shows the wordmark and tagline', () => {
    const out = html(<Closing t={4000} />);
    expect(out).toContain('Beyond');
    expect(out).toContain('Agentic Adaptation.');
  });
});
```

The first assertion requires the question chips to be conditionally rendered (`o > 0 &&`) rather than drawn at opacity 0. Change `ProblemScene` to render each chip only when its fade is above 0.

- [ ] **Step 9: Run tests and do a browser check.**

Run: `npm test && npx tsc --noEmit`

Then open these URLs and look at each:
- `teacher.html?scene=1&t=14000`
- `teacher.html?scene=9&t=15000`
- `teacher.html?scene=10&t=4500`
- `teacher.html?scene=4&t=0` (expect the empty chat opening screen with no greeting: there are no scripts yet)

Expect light layouts, no dark remnants and no console errors.

- [ ] **Step 10: Commit.**

```bash
git add -A
git commit -m "feat(teacher): scripted teacher window, light overlays + chapter label, Problem/How it works/Closing scenes"
```

---

### Task 5: Scene scripts Sc2–Sc8, question tracker, and continuity tests

**Files:**
- Modify: `src/teacher/script.ts`, `src/teacher/TeacherScreen.tsx` (tracker strip)
- Create: `src/teacher/script.test.ts`

**Interfaces:**
- Consumes: `TeacherEvent` types, `TOPICS`, `QUESTION_SHORT`, `MINH_ANH`, `GREETING`
- Produces: the filled `OWN` table

- [ ] **Step 1: Add the tracker strip** to `TeacherScreen`. Directly under the header, when `frame.tracker > 0`, render a 44 px strip with `opacity: frame.tracker`:

```tsx
<div className="flex h-[44px] shrink-0 items-center gap-6 border-b border-egg-line px-8" style={{ opacity: frame.tracker }}>
  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-mute">Five questions</span>
  {QUESTION_SHORT.map((q, i) => (
    <span key={q} className="flex items-center gap-2 text-[13.5px]">
      <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${frame.ticks[i] ? 'border-egg-orange bg-egg-orange text-egg-ink' : 'border-egg-ink/40'}`}>
        {frame.ticks[i] && <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 5.2 4.2 7.4 8 2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <span className={frame.ticks[i] ? 'text-egg-ink' : 'text-egg-mute'}>{q}</span>
    </span>
  ))}
</div>
```

It sits in the main column, so the side panel is unaffected.

- [ ] **Step 2: Write the failing script tests** in `src/teacher/script.test.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { sceneById } from '../scenario/scenes';
import { MINH_ANH } from '../scenario/minhAnh';
import { teacherFrame } from './frame';
import { scriptFor, TEACHER_SCENES } from './script';

const frame = (scene: number, t: number) => teacherFrame(scriptFor(scene).events, t);
const persistent = (scene: number, t: number) => {
  const f = frame(scene, t);
  return { view: f.view, title: f.title, msgs: f.messages.length, panel: f.panel?.id ?? null, approved: f.approved, ticks: f.ticks, edited: f.panel?.edited ?? false, selected: f.classroom.selected };
};

describe('teacher scene scripts', () => {
  it('each scene starts where the previous one ended', () => {
    for (const id of TEACHER_SCENES.slice(1)) {
      expect(persistent(id, 0), `Sc${id}`).toEqual(persistent(id - 1, sceneById(id - 1).durationMs));
    }
  });
  it('own events are in ascending time order and inside the scene', () => {
    for (const id of TEACHER_SCENES) {
      const own = scriptFor(id).events.filter((e) => e.at >= 0).map((e) => e.at);
      expect(own).toEqual([...own].sort((a, b) => a - b));
      for (const at of own) expect(at).toBeLessThanOrEqual(sceneById(id).durationMs);
    }
  });
  it('Sc2 types the greeting, brings in the rows, then shows the tracker', () => {
    expect(frame(2, 1500).greeting.chars).toBe(10);
    expect(frame(2, 5100).greeting.rows).toEqual([1, 1, 1]);
    expect(frame(2, 9000).tracker).toBe(1);
  });
  it('Sc3 switches to the Classroom, reveals it, pulses Minh Anh and ticks Q1', () => {
    expect(frame(3, 1400).view).toBe('chat');
    expect(frame(3, 1600).view).toBe('classroom');
    expect(frame(3, 1900).classroom.tiles).toBe(0);
    expect(frame(3, 9500).classroom.tiles).toBe(55);
    expect(frame(3, 10000).classroom.pulse).toBeGreaterThan(0);
    expect(frame(3, 11000).ticks[0]).toBe(true);
  });
  it('Sc4 selects Minh Anh, asks, thinks, answers, opens the panel and ticks Q2–Q3', () => {
    expect(frame(4, 1000).classroom.selected).toBe(MINH_ANH.index);
    expect(frame(4, 3600).composer.length).toBeGreaterThan(0);
    expect(frame(4, 4900).messages[0]).toMatchObject({ role: 'teacher', text: 'Why did Minh Anh’s quiz score drop?' });
    expect(frame(4, 6500).thinking?.shown).toBe(2);
    expect(frame(4, 10500).messages[1]).toMatchObject({ kind: 'answer', topic: 'student', shown: 3 });
    expect(frame(4, 16000).panel?.id).toBe('student');
    expect(frame(4, 19000).ticks.slice(1, 3)).toEqual([true, true]);
  });
  it('Sc5 asks the class question, opens the class panel and ticks Q4', () => {
    expect(frame(5, 6500).panel?.id).toBe('class');
    expect(frame(5, 8000).ticks[3]).toBe(true);
    expect(frame(5, 10000).messages).toHaveLength(4);
  });
  it('Sc6 reloads Minh Anh, edits step 4, approves and confirms; Q5 ticks', () => {
    expect(frame(6, 700)).toMatchObject({ title: 'Minh Anh’s Quiz 2 drop' });
    expect(frame(6, 700).messages).toHaveLength(2);
    expect(frame(6, 3000).panel?.scroll).toBe(120);
    expect(frame(6, 4600).panel?.edited).toBe(true);
    expect(frame(6, 6600).approved).toContain('student');
    expect(frame(6, 8000).messages).toHaveLength(3);
    expect(frame(6, 8000).ticks).toEqual([true, true, true, true, true]);
  });
  it('Sc7 holds the last Sc6 frame', () => {
    expect(persistent(7, 20000)).toEqual(persistent(6, 15000));
  });
  it('Sc8 posts the adapt message, blends the twin, then updates the Classroom', () => {
    expect(frame(8, 0).tracker).toBe(0);
    expect(frame(8, 1500).messages.at(-1)).toMatchObject({ kind: 'adapt', stamp: '20:41' });
    expect(frame(8, 5000).panel).toMatchObject({ twin: 1, followUp: true });
    expect(frame(8, 8100).view).toBe('classroom');
    expect(frame(8, 11000).classroom.adapt).toBe(1);
  });
  it('cursor keys are ascending and every click lands while the cursor is shown', () => {
    for (const id of TEACHER_SCENES) {
      const keys = scriptFor(id).cursor.map((k) => k.t);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });
});
```

- [ ] **Step 3: Run them to see them fail.**

Run: `npx vitest run src/teacher/script.test.ts`
Expected: FAIL (`OWN` is empty).

- [ ] **Step 4: Fill `OWN`** in `src/teacher/script.ts`. Replace the empty table with the code below, and add the imports `TOPICS` from `./conversations` and `MINH_ANH` from `../scenario/minhAnh`.

```ts
const ASK_MINH_ANH = TOPICS.student.prompt;
const ASK_CLASS = TOPICS.class.prompt;

/** Each scene's own events in scene time, ascending. Cursor positions are in the 1920×1080 canvas. */
const OWN: Partial<Record<number, TeacherScript>> = {
  2: {
    events: [
      { at: 500, type: 'greeting' },
      { at: 5000, type: 'tracker', on: true },
    ],
    cursor: [],
  },
  3: {
    events: [
      { at: 1500, type: 'view', view: 'classroom' },
      { at: 1800, type: 'classroomReveal' },
      { at: 9500, type: 'pulse' },
      { at: 11000, type: 'tick', q: 0 },
    ],
    cursor: [
      { t: 600, x: 1100, y: 760 },
      { t: 1500, x: 70, y: 192, click: true },
      { t: 2600, x: 520, y: 900 },
    ],
  },
  4: {
    events: [
      { at: 800, type: 'select', index: MINH_ANH.index },
      { at: 2200, type: 'view', view: 'chat' },
      { at: 2200, type: 'reset' },
      { at: 2600, type: 'type', text: ASK_MINH_ANH, cps: 18 },
      { at: 4800, type: 'send', text: ASK_MINH_ANH },
      { at: 5200, type: 'think', lines: TOPICS.student.thinking, stepMs: 1200, title: TOPICS.student.title },
      { at: 8000, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
      { at: 15500, type: 'panel', id: 'student' },
      { at: 19000, type: 'tick', q: 1 },
      { at: 19000, type: 'tick', q: 2 },
    ],
    cursor: [
      { t: 0, x: 980, y: 820 },
      { t: 800, x: 855, y: 564, click: true },
      { t: 2200, x: 1560, y: 697, click: true },
      { t: 3000, x: 1300, y: 960 },
    ],
  },
  5: {
    events: [
      { at: 800, type: 'send', text: ASK_CLASS },
      { at: 1200, type: 'think', lines: TOPICS.class.thinking, stepMs: 800, title: TOPICS.class.title },
      { at: 3000, type: 'assistant', kind: 'answer', topic: 'class', blockMs: 600 },
      { at: 6000, type: 'panel', id: 'class' },
      { at: 8000, type: 'tick', q: 3 },
    ],
    cursor: [
      { t: 0, x: 1000, y: 820 },
      { t: 800, x: 700, y: 601, click: true },
      { t: 1600, x: 1050, y: 860 },
    ],
  },
  6: {
    events: [
      { at: 600, type: 'load', topic: 'student' },
      { at: 1500, type: 'panelScroll', y: 120, dur: 1500 },
      { at: 4500, type: 'edit' },
      { at: 6500, type: 'approve', id: 'student' },
      { at: 7000, type: 'assistant', kind: 'approved', topic: 'student', blockMs: 400 },
      { at: 8000, type: 'tick', q: 4 },
    ],
    cursor: [
      { t: 0, x: 900, y: 700 },
      { t: 600, x: 106, y: 281, click: true },
      { t: 2500, x: 1400, y: 700 },
      { t: 3500, x: 1680, y: 787, click: true },
      { t: 5500, x: 1600, y: 830 },
      { t: 6500, x: 1575, y: 787, click: true },
      { t: 7500, x: 1300, y: 920 },
    ],
  },
  8: {
    events: [
      { at: 0, type: 'tracker', on: false },
      { at: 1000, type: 'assistant', kind: 'adapt', blockMs: 900, stamp: '20:41' },
      { at: 3000, type: 'adaptTwin' },
      { at: 8000, type: 'view', view: 'classroom' },
      { at: 8500, type: 'adaptClass' },
    ],
    cursor: [
      { t: 6000, x: 900, y: 820 },
      { t: 8000, x: 70, y: 192, click: true },
      { t: 9000, x: 520, y: 900 },
    ],
  },
};
```

Then adjust `frame.ts` so that `{ type: 'tracker', on: false }` sets `f.tracker = 0`. It already does: `prog` is only used when `on` is true.

- [ ] **Step 5: Run the tests.**

Run: `npx vitest run src/teacher`
Expected: PASS.

The continuity test needs every Sc(n−1) animation to finish by the scene's end. If it fails, the failing scene id names the event that is still mid-animation at the boundary. Fix it by moving that event earlier, never by excluding fields.

- [ ] **Step 6: Line up the cursor on screen.** The cursor coordinates above are first estimates from the draft layout, which is now shifted 44 px down by the tracker.

  1. For each click key, open `teacher.html?scene=N&t=<key.t>` and screenshot it at 1920×1080 with the Playwright pattern from `scripts/contact-sheet.ts`.
  2. Check that the cursor tip sits on the intended control:

     | Scene | Click | Target |
     |---|---|---|
     | Sc3 | 1500 | the Classroom nav |
     | Sc4 | 800 | Minh Anh's tile |
     | Sc4 | 2200 | **Ask about Minh Anh** |
     | Sc5 | 800 | the first follow-up chip |
     | Sc6 | 600 | the sidebar topic |
     | Sc6 | 3500 | **Edit** |
     | Sc6 | 6500 | **Approve & send** |
     | Sc8 | 8000 | the Classroom nav |

  3. Correct `x`/`y` until each lands. Read positions from the rendered page, for example `page.locator(…).boundingBox()` at that `t`.
  4. Record the final coordinates in the commit message body.

- [ ] **Step 7: Full check and commit.**

Run: `npm test && npx tsc --noEmit`

```bash
git add -A
git commit -m "feat(teacher): scripted scenes 2–8 with cursor, question tracker, continuity tests"
```

---

### Task 6: Contact sheet, README, and end-to-end verification

**Files:**
- Modify: `scripts/contact-sheet.ts`, `README.md`

- [ ] **Step 1: Point the contact sheet at the teacher window.** In `scripts/contact-sheet.ts`:
  - The app type becomes `'teacher' | 'student'`.
  - The teacher page uses `teacher.html`.
  - Jobs: for each `s of SCENES`, push the teacher shots for every scene (`s.shots`) and the student shots from `STUDENT_SHOTS[s.id]`.
  - Rename the `dash` variable to `teacher`.

- [ ] **Step 2: Run the determinism check.**

Run: `npm run contact-sheet -- --verify`
Expected: `42 frames written to contact-sheet/ · all deterministic` (34 teacher shots + 8 phone shots). If the count differs, it must equal the sum of `shots` lengths plus the `STUDENT_SHOTS` lengths. Report the actual number.

- [ ] **Step 3: Review the frames by eye.** Open every PNG in `contact-sheet/` and check:
  - no Vietnamese name renders with broken accents
  - nothing overlaps the tracker or the chapter label
  - the cursor tips sit on their targets
  - Sc8's final Classroom shows 9 need support and 3 high risk, with Minh Anh's tile peach at 0.72
  - the phone in Sc6 shows the 15:00 lock with the notification, and in Sc8 the updated plan

  Fix anything found, re-run Step 2, and list the fixes in the report.

- [ ] **Step 4: Update `README.md`.**
  - The scene table becomes the 10 scenes, with label, duration, window and chapter. Total 2:30.
  - Windows: Director (`controller.html`) → **Open teacher window** (`teacher.html?scene=1`) and **Open student window**. `teacher.html` with no `?scene` is the live clickable draft for rehearsing.
  - Footage map:
    - F2 `teacher_stressed.mp4` → Sc1
    - F3 `teacher_morning.mp4` → Sc2
    - F4 `greenscreen_phone.mp4` → Sc7
    - F1 `lecture hall.mp4` → Sc9 (keep the existing cover-title note for the blurred patch)
  - Toggles: add **Chapter label**, and say it can be turned off if the chapters are added in Resolve.
  - Sync checks: the Sc6 dry run (Approve on the teacher window, notification 1 s later on the phone) replaces the old Sc7 dry run.
  - Teaser: a short "60 s teaser" section listing the cut points from the spec (§1), done in the editor.
  - Remove every reference to `dashboard.html`, the old scene names and the dark theme.

- [ ] **Step 5: Do a final run-through.**
  1. Run `npm test && npx tsc --noEmit && npm run build`. All must pass.
  2. Open the Director and both windows (teacher and student) in one browser profile.
  3. Run **Play all** once.
  4. Expect both heartbeats green, each scene advancing automatically, and no console errors.
  5. Report anything that looked wrong at full speed.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "chore: contact sheet for teacher window, README for the product-first cut"
```
