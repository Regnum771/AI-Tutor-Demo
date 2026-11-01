# Lesson Planning Tab and Resource Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the live teacher one place to plan the coming lectures: a knowledge graph coloured by class mastery, class mastery over the term with the interventions marked, and each upcoming lecture's learning materials with who has and has not opened them. Agents read the same library and cite resources by id.

**Architecture:** A seeded, fictional library (`src/scenario/materials.ts`: `RESOURCES`, `engagement`, `classEngagement`, `notOpened`) is the single source for resources and engagement; engagement is a pure function of resource, student index and story day. Class mastery over time is `seededHistory` (Weeks 1–6, computed from the seed roster) joined to `DemoState.masteryHistory`, which `advance` appends to through `noteClassMastery` after each day's forgetting. The teacher side is a pure model (`src/teacher/planningModel.ts`) plus three components (`ConceptGraph`, `MasteryChart`, `ResourceList`) assembled by a live-only view (`src/teacher/LessonPlanning.tsx`) behind a new `'planning'` value of `View`. `ResourceList` is shared with the Calendar's lecture details. One new read tool, `get_lecture_materials`, and `checkBlocks` accepting library ids let answers carry resource chips; a chip calls the new `LiveCtx.openPlanning(resourceId)`.

**Tech Stack:** TypeScript, React 18, Tailwind, Vitest (+ happy-dom for click tests), Hono server, Anthropic SDK agents.

Spec: `docs/superpowers/specs/2026-11-01-lesson-planning-design.md`.

## Global Constraints

- Day 0 is Monday 21 September. `START_DAY` 40 (Saturday, 15:00), `EXAM_DAY` 64. Lectures are Tuesdays 09:00–11:00 (`LECTURES`, days 1, 8, …, 57); on day 40 the next lecture is Lecture 7 on Tue 3 Nov (day 43), then 8 and 9.
- The library: slides, recording and worksheet for Lectures 1–8; one reading or short video for Lectures 3, 5, 6 and 7; a revision sheet for Lecture 9: 29 resources, ids `l<n>-<slides|recording|worksheet|reading|video|revision>`. Titles "Lecture 5 · Implication.pdf", "Worksheet · Truth tables", "Lecture 5 recording" match the video.
- Bloom: slides and recordings Remember or Understand, worksheets Apply, readings Understand or Analyze.
- No URLs anywhere in the library, the tool output, the prompt or agent copy; a reading names a textbook section ("Rosen §1.1").
- Engagement is seeded and deterministic. Before a lecture has started its resources have no engagement ("0 of 55", "Not released yet"). Minh Anh: `l5-recording` opened, 0.22 watched. Index 7 (s8) opened nothing after Week 4. `l5-recording` reads "31 of 55 opened · 46% watched on average" on day 40.
- Class mastery: 0.20 before a concept's lecture; seeded Weeks 1–6 plus day 40; one live point per concept per closed day, appended by `advance` after forgetting. The gap line is 0.50.
- New teacher UI is live-only (`useLive()` non-null). The scripted video must render exactly as before: `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` pass unchanged; the scripted sidebar has no "Lesson planning" item.
- No new agent runs or tokens. Browsing the tab never advances the story and posts nothing. The phone is unchanged.
- Copy never assumes anyone's pronouns.
- Every commit ends with `Co-Authored-By: <the model that actually writes the commit> <noreply@anthropic.com>`; the commands below show `Claude Opus 5.5`, so replace it if another model writes the commit.
- Stage only the files each task names. Never stage the unrelated working-tree changes (deleted `.env.local.example`, `.env.local copy.example`, `docs/superpowers/specs/2026-11-01-quiz-attempts-review-design.md`, existing `docs/evals/` outputs).
- This checkout's filesystem is case-insensitive: never create two files whose names differ only by case. The pure model is `planningModel.ts`, the view is `LessonPlanning.tsx`.
- Test command: `npx vitest run <path>`; types: `npm run typecheck`.

---

### Task 1: The resource library and its engagement (pure)

**Files:**
- Create: `src/scenario/materials.ts`
- Test: `src/scenario/materials.test.ts` (create)

**Interfaces:**
- Consumes: `STUDENTS`, `Status` (`src/scenario/classroom.ts`); `LECTURES`, `lectureBefore(day: number, time: string): Lecture | null`, `START_DAY`, `Bloom` (`src/scenario/course.ts`); `CONCEPTS`, `ConceptId` (`src/scenario/knowledgeGraph.ts`); `MINH_ANH` (`src/scenario/minhAnh.ts`).
- Produces (in `src/scenario/materials.ts`):
  - `type ResourceKind = 'slides' | 'recording' | 'worksheet' | 'reading' | 'video'`
  - `type ResourceBloom = Exclude<Bloom, 'Create'>`; `RESOURCE_BLOOMS: ResourceBloom[]`
  - `interface Resource { id: string; lecture: number; kind: ResourceKind; title: string; concepts: ConceptId[]; bloom: ResourceBloom; minutes: number; source: string }`
  - `KIND_LABEL: Record<ResourceKind, string>` ("Slides", "Recording", "Worksheet", "Reading", "Video")
  - `RESOURCES: Resource[]` (29), `resourcesFor(lecture: number): Resource[]`, `resourceById(id: string): Resource | undefined`
  - `isReleased(r: Resource, day: number, time: string): boolean`
  - `resourceChip(r: Resource): string` ("Slides · Lecture 7")
  - `engagement(resourceId: string, studentIndex: number, today?: number): { opened: boolean; fraction: number }` (`today` defaults to `START_DAY`)
  - `classEngagement(resourceId: string, today?: number): { opened: number; of: number; meanFraction: number }`
  - `notOpened(resourceId: string, today?: number): number[]` (student indexes, roster order)

- [ ] **Step 1: Write the failing test**

Create `src/scenario/materials.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STUDENTS } from './classroom';
import { LECTURES } from './course';
import { CONCEPTS } from './knowledgeGraph';
import { classEngagement, engagement, isReleased, notOpened, RESOURCE_BLOOMS, RESOURCES, resourceById, resourceChip, resourcesFor } from './materials';

describe('the resource library', () => {
  it('points every resource at a real lecture and its concepts, with a valid Bloom level and a unique id', () => {
    expect(RESOURCES).toHaveLength(29);
    expect(new Set(RESOURCES.map((r) => r.id)).size).toBe(RESOURCES.length);
    for (const r of RESOURCES) {
      const l = LECTURES.find((x) => x.n === r.lecture);
      expect(l, r.id).toBeDefined();
      const allowed = l!.concepts.length ? l!.concepts : CONCEPTS.map((c) => c.id);
      expect(r.concepts.length, r.id).toBeGreaterThan(0);
      for (const c of r.concepts) expect(allowed, r.id).toContain(c);
      expect(RESOURCE_BLOOMS).toContain(r.bloom);
      expect(r.minutes).toBeGreaterThan(0);
      expect(`${r.title} ${r.source}`).not.toMatch(/https?:|www\.|\.com\b/);
    }
    for (const l of LECTURES) expect(resourcesFor(l.n).length, `Lecture ${l.n}`).toBeGreaterThan(0);
  });
  it('has slides, a recording and a worksheet for Lectures 1–8, an extra for 3, 5, 6 and 7, and a revision sheet for 9', () => {
    for (let n = 1; n <= 8; n++) expect(resourcesFor(n).slice(0, 3).map((r) => r.kind)).toEqual(['slides', 'recording', 'worksheet']);
    expect([3, 5, 6, 7].map((n) => resourcesFor(n).length)).toEqual([4, 4, 4, 4]);
    expect([1, 2, 4, 8].map((n) => resourcesFor(n).length)).toEqual([3, 3, 3, 3]);
    expect(resourcesFor(9).map((r) => r.id)).toEqual(['l9-revision']);
  });
  it('keeps the titles from the video’s Learning Materials window', () => {
    expect(resourceById('l5-slides')?.title).toBe('Lecture 5 · Implication.pdf');
    expect(resourceById('l3-worksheet')?.title).toBe('Worksheet · Truth tables');
    expect(resourceById('l5-recording')?.title).toBe('Lecture 5 recording');
    expect(resourceById('l5-reading')?.source).toBe('Rosen §1.1');
    expect(resourceChip(resourceById('l7-slides')!)).toBe('Slides · Lecture 7');
  });
  it('follows the material with its Bloom level', () => {
    for (const r of RESOURCES) {
      if (r.kind === 'slides' || r.kind === 'recording') expect(['Remember', 'Understand']).toContain(r.bloom);
      if (r.kind === 'worksheet') expect(r.bloom).toBe('Apply');
      if (r.kind === 'reading') expect(['Understand', 'Analyze']).toContain(r.bloom);
    }
  });
});

describe('engagement', () => {
  it('is deterministic and stays in range', () => {
    for (const r of RESOURCES) {
      for (const s of STUDENTS) {
        const e = engagement(r.id, s.index);
        expect(engagement(r.id, s.index)).toEqual(e);
        expect(e.fraction).toBeGreaterThanOrEqual(0);
        expect(e.fraction).toBeLessThanOrEqual(1);
        if (!e.opened) expect(e.fraction).toBe(0);
      }
    }
  });
  it('Minh Anh opened the Lecture 5 recording and watched 22% of it', () => {
    expect(engagement('l5-recording', 16)).toEqual({ opened: true, fraction: 0.22 });
    expect(resourcesFor(6).some((r) => engagement(r.id, 16).opened)).toBe(false);
  });
  it('the quiet disengager (index 7) opened nothing after Week 4', () => {
    for (const r of RESOURCES.filter((x) => x.lecture >= 5)) expect(engagement(r.id, 7).opened, r.id).toBe(false);
    expect(RESOURCES.filter((x) => x.lecture <= 4).some((r) => engagement(r.id, 7).opened)).toBe(true);
  });
  it('on-track students open more than high-risk students', () => {
    const rate = (status: string) => {
      const group = STUDENTS.filter((s) => s.status === status);
      const opened = RESOURCES.filter((r) => r.lecture <= 6).reduce((a, r) => a + group.filter((s) => engagement(r.id, s.index).opened).length, 0);
      return opened / group.length;
    };
    expect(rate('onTrack')).toBeGreaterThan(rate('support'));
    expect(rate('support')).toBeGreaterThan(rate('highRisk'));
  });
  it('has nothing for lectures after today, and fills in as the story moves on', () => {
    for (const r of RESOURCES.filter((x) => x.lecture >= 7)) {
      expect(classEngagement(r.id)).toEqual({ opened: 0, of: 55, meanFraction: 0 });
      expect(notOpened(r.id)).toHaveLength(55);
    }
    expect(classEngagement('l7-slides', 50).opened).toBeGreaterThan(0);
    expect(isReleased(resourceById('l7-slides')!, 40, '15:00')).toBe(false);
    expect(isReleased(resourceById('l7-slides')!, 43, '09:00')).toBe(true);
    expect(isReleased(resourceById('l6-slides')!, 40, '15:00')).toBe(true);
  });
  it('reports the class figure the tab shows', () => {
    expect(classEngagement('l5-recording')).toEqual({ opened: 31, of: 55, meanFraction: 0.46 });
    expect(notOpened('l5-recording')).toHaveLength(24);
    expect(notOpened('l5-recording')).not.toContain(16);
    expect(notOpened('l5-recording')).toContain(7);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/scenario/materials.test.ts`
Expected: FAIL: `Failed to resolve import "./materials"` (the module does not exist yet).

- [ ] **Step 3: Implement**

Create `src/scenario/materials.ts`:

```ts
import { STUDENTS, type Status } from './classroom';
import { LECTURES, lectureBefore, START_DAY, type Bloom } from './course';
import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { MINH_ANH } from './minhAnh';

export type ResourceKind = 'slides' | 'recording' | 'worksheet' | 'reading' | 'video';
/** The Bloom levels a resource can carry: the course's levels without Create. */
export type ResourceBloom = Exclude<Bloom, 'Create'>;
export const RESOURCE_BLOOMS: ResourceBloom[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];

export interface Resource {
  /** "l5-slides", "l5-recording", …: what the agents cite. */
  id: string;
  /** LECTURES n */
  lecture: number;
  kind: ResourceKind;
  title: string;
  /** A subset of the lecture's concepts; the revision sheet covers the whole course. */
  concepts: ConceptId[];
  bloom: ResourceBloom;
  /** Length, or the expected time to work through it. */
  minutes: number;
  /** "Course slides", "Recording", "Worksheet", "Short video" or a textbook section. Never a link. */
  source: string;
}

export const KIND_LABEL: Record<ResourceKind, string> = { slides: 'Slides', recording: 'Recording', worksheet: 'Worksheet', reading: 'Reading', video: 'Video' };

/** One reading or short video for Lectures 3, 5, 6 and 7. Fictional; a reading names a textbook section, never a link. */
const EXTRA: Record<number, Omit<Resource, 'lecture'>> = {
  3: { id: 'l3-video', kind: 'video', title: 'Building a truth table, row by row', concepts: ['truthTables'], bloom: 'Understand', minutes: 8, source: 'Short video' },
  5: { id: 'l5-reading', kind: 'reading', title: 'Rosen §1.1 · Conditional statements', concepts: ['implication'], bloom: 'Analyze', minutes: 25, source: 'Rosen §1.1' },
  6: { id: 'l6-reading', kind: 'reading', title: 'Rosen §1.3 · Propositional equivalences', concepts: ['equivalence', 'deMorgan'], bloom: 'Understand', minutes: 30, source: 'Rosen §1.3' },
  7: { id: 'l7-video', kind: 'video', title: 'Equivalence laws in six minutes', concepts: ['equivLaws'], bloom: 'Understand', minutes: 6, source: 'Short video' },
};

/** The course library: slides, a recording and a worksheet for Lectures 1–8, the extras above, and a revision sheet for Lecture 9. */
export const RESOURCES: Resource[] = LECTURES.flatMap((l): Resource[] => {
  if (l.concepts.length === 0) {
    return [{ id: `l${l.n}-revision`, lecture: l.n, kind: 'worksheet', title: 'Revision sheet · The whole course', concepts: CONCEPTS.map((c) => c.id), bloom: 'Apply', minutes: 60, source: 'Worksheet' }];
  }
  const intro = l.n === 1 ? 'Remember' : 'Understand';
  const extra = EXTRA[l.n];
  return [
    { id: `l${l.n}-slides`, lecture: l.n, kind: 'slides', title: `Lecture ${l.n} · ${l.title}.pdf`, concepts: l.concepts, bloom: intro, minutes: 25, source: 'Course slides' },
    { id: `l${l.n}-recording`, lecture: l.n, kind: 'recording', title: `Lecture ${l.n} recording`, concepts: l.concepts, bloom: intro, minutes: 110, source: 'Recording' },
    { id: `l${l.n}-worksheet`, lecture: l.n, kind: 'worksheet', title: `Worksheet · ${l.title}`, concepts: l.concepts, bloom: 'Apply', minutes: 40, source: 'Worksheet' },
    ...(extra ? [{ ...extra, lecture: l.n }] : []),
  ];
});

export const resourcesFor = (lecture: number): Resource[] => RESOURCES.filter((r) => r.lecture === lecture);
export const resourceById = (id: string): Resource | undefined => RESOURCES.find((r) => r.id === id);

/** A resource is out once its lecture has started. */
export const isReleased = (r: Resource, day: number, time: string): boolean => (lectureBefore(day, time)?.n ?? 0) >= r.lecture;

/** "Slides · Lecture 7": a citation chip. */
export const resourceChip = (r: Resource): string => `${KIND_LABEL[r.kind]} · Lecture ${r.lecture}`;

const OPEN: Record<Status, number> = { onTrack: 0.9, support: 0.65, highRisk: 0.4 };
const KIND_OPEN: Record<ResourceKind, number> = { slides: 1, recording: 0.8, worksheet: 0.85, reading: 0.5, video: 0.7 };
const SHARE: Record<Status, [number, number]> = { onTrack: [0.55, 0.95], support: [0.35, 0.75], highRisk: [0.1, 0.45] };
/** A two-hour recording is rarely watched to the end. */
const KIND_SHARE: Record<ResourceKind, number> = { slides: 1, recording: 0.65, worksheet: 1, reading: 0.9, video: 1 };
/** The quiet disengager (s8): present every week, nothing opened after Week 4. */
const DISENGAGED = 7;
const END_OF_WEEK_4 = 27;

const round2 = (v: number) => Math.round(v * 100) / 100;
/** A fixed 0–1 value per pair, so engagement is the same on every run. */
function hash(a: number, b: number): number {
  let x = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** Whether a student has opened a resource by `today`, and how much of it they got through (0–1). Seeded from the index and status; fictional. */
export function engagement(resourceId: string, studentIndex: number, today = START_DAY): { opened: boolean; fraction: number } {
  const r = resourceById(resourceId);
  if (!r) throw new Error(`Unknown resource ${resourceId}.`);
  const student = STUDENTS[studentIndex];
  const k = RESOURCES.indexOf(r);
  const day = LECTURES[r.lecture - 1].day;
  // Opened from the day after the lecture, up to 4 days late.
  const openDay = day + 1 + Math.floor(hash(studentIndex, k + 100) * 4);
  const none = { opened: false, fraction: 0 };
  if (openDay > today) return none;
  if (studentIndex === MINH_ANH.index) {
    // The video's Learning Materials window, and the LMS log: last login before Lecture 6.
    if (r.id === 'l5-recording') return { opened: true, fraction: 0.22 };
    if (r.lecture === 6) return none;
  }
  if (studentIndex === DISENGAGED && openDay > END_OF_WEEK_4) return none;
  if (hash(studentIndex, k) >= OPEN[student.status] * KIND_OPEN[r.kind]) return none;
  const [lo, hi] = SHARE[student.status];
  return { opened: true, fraction: round2((lo + (hi - lo) * hash(k, studentIndex + 500)) * KIND_SHARE[r.kind]) };
}

/** The class figure: how many of the 55 opened it, and the mean share of it among those who did. */
export function classEngagement(resourceId: string, today = START_DAY): { opened: number; of: number; meanFraction: number } {
  const rows = STUDENTS.map((s) => engagement(resourceId, s.index, today)).filter((e) => e.opened);
  return { opened: rows.length, of: STUDENTS.length, meanFraction: rows.length ? round2(rows.reduce((a, e) => a + e.fraction, 0) / rows.length) : 0 };
}

/** Student indexes that have not opened the resource by `today`, in roster order. */
export const notOpened = (resourceId: string, today = START_DAY): number[] =>
  STUDENTS.filter((s) => !engagement(resourceId, s.index, today).opened).map((s) => s.index);
```

- [ ] **Step 4: Run the test**

Run: `npm run typecheck && npx vitest run src/scenario`
Expected: typecheck clean; all PASS. (Checked while planning: on day 40 every Lecture 1–6 resource has 23–49 openers; `l5-recording` is 31 of 55 at 0.46; s8 opened only Lecture 1–3 material; Lectures 7–9 are 0 of 55, and Lecture 7 slides reach 47 of 55 by day 50.)

- [ ] **Step 5: Commit**

```bash
git add src/scenario/materials.ts src/scenario/materials.test.ts
git commit -m "feat(materials): a seeded resource library per lecture with student engagement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Class mastery over time (seeded and live)

**Files:**
- Create: `src/live/history.ts`
- Modify: `src/live/types.ts` (new `MasteryPoint` before `SelfSession`; `DemoState.masteryHistory`)
- Modify: `src/live/seed.ts` (import, `seedState`)
- Modify: `src/live/study/reducer.ts` (import, `advance` day loop)
- Test: `src/live/history.test.ts` (create)

**Interfaces:**
- Consumes: `lectureOf(concept: ConceptId): Lecture`, `taughtBy(day: number, time?: string): ConceptId[]`, `START_DAY` (`src/scenario/course.ts`); `CONCEPTS`; `advance(state: DemoState, days: number, check): StudyResult` and its private `weekTurn` (forgetting runs there on Mondays).
- Produces:
  - `interface MasteryPoint { day: number; value: number }` and `DemoState.masteryHistory: Record<ConceptId, MasteryPoint[]>` (`src/live/types.ts`)
  - In `src/live/history.ts`: `BEFORE_LECTURE = 0.2`, `RAMP_DAYS = 14`, `emptyHistory(): Record<ConceptId, MasteryPoint[]>`, `classAverage(students: StudentProfile[], concept: ConceptId): number` (3 decimals), `seededHistory(students: StudentProfile[]): Record<ConceptId, MasteryPoint[]>` (days 0, 7, 14, 21, 28, 35, 40), `noteClassMastery(s: DemoState): void`
  - `seedState()` starts `masteryHistory` as `emptyHistory()`; `advance` calls `noteClassMastery(s)` after `weekTurn`, once per closed day.

- [ ] **Step 1: Write the failing test**

Create `src/live/history.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lectureOf } from '../scenario/course';
import { CONCEPTS } from '../scenario/knowledgeGraph';
import { BEFORE_LECTURE, classAverage, noteClassMastery, seededHistory } from './history';
import { seedState } from './seed';
import { openPick, pickStudent, saveSetup, advance, type StudyResult } from './study/reducer';
import type { DemoState } from './types';

const ok = (r: StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const ready = () => ok(saveSetup(ok(pickStudent(ok(openPick(seedState())), 's17')), 30, 60));

describe('class mastery over time', () => {
  it('seeds Weeks 1–6 and day 40: 0–1, 0.20 before each lecture, the class average once lectured', () => {
    const s = seedState();
    const h = seededHistory(s.students);
    for (const c of CONCEPTS) {
      const points = h[c.id];
      expect(points.map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40]);
      for (const p of points) {
        expect(p.value).toBeGreaterThanOrEqual(0);
        expect(p.value).toBeLessThanOrEqual(1);
        if (p.day < lectureOf(c.id).day) expect(p.value, `${c.id} day ${p.day}`).toBe(BEFORE_LECTURE);
      }
    }
    expect(h.propositions.map((p) => p.value)).toEqual([0.2, 0.488, 0.823, 0.871, 0.871, 0.871, 0.871]);
    expect(h.implication.map((p) => p.value)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2, 0.453, 0.664]);
    expect(h.equivalence.at(-1)!.value).toBe(classAverage(s.students, 'equivalence'));
    expect(h.equivLaws.at(-1)!.value).toBe(BEFORE_LECTURE);
  });
  it('starts the live history empty', () => {
    const s = seedState();
    for (const c of CONCEPTS) expect(s.masteryHistory[c.id]).toEqual([]);
  });
  it('adds one point per concept for each closed day, after forgetting, and a concept waits for its lecture', () => {
    const s = ready();
    s.students[16].mastery.equivalence = 0.95;
    const after = ok(advance(s, 3, null)); // Saturday 40 → Tuesday 43, through Monday 42
    for (const c of CONCEPTS) expect(after.masteryHistory[c.id].map((p) => p.day)).toEqual([41, 42, 43]);
    expect(after.masteryHistory.equivalence[0].value).toBe(classAverage(s.students, 'equivalence'));
    // Monday 42: Minh Anh forgets 0.02 on every lectured concept not practised in the last 7 days.
    expect(after.masteryHistory.equivalence[1].value).toBe(classAverage(after.students, 'equivalence'));
    expect(after.masteryHistory.equivalence[1].value).toBeLessThan(after.masteryHistory.equivalence[0].value);
    expect(after.masteryHistory.equivLaws.map((p) => p.value)).toEqual([BEFORE_LECTURE, BEFORE_LECTURE, classAverage(after.students, 'equivLaws')]);
  });
  it('replaces a point already there for the same day', () => {
    const s = seedState();
    noteClassMastery(s);
    s.students[0].mastery.propositions = 0.1;
    noteClassMastery(s);
    expect(s.masteryHistory.propositions).toEqual([{ day: 40, value: classAverage(s.students, 'propositions') }]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/live/history.test.ts`
Expected: FAIL: `Failed to resolve import "./history"`.

- [ ] **Step 3: Implement the history**

Create `src/live/history.ts`:

```ts
import { lectureOf, START_DAY, taughtBy } from '../scenario/course';
import { CONCEPTS, type ConceptId } from '../scenario/knowledgeGraph';
import type { DemoState, MasteryPoint, StudentProfile } from './types';

/** Where a concept sits before its lecture. */
export const BEFORE_LECTURE = 0.2;
/** A lectured concept climbs to the class's seed average over this many days. */
export const RAMP_DAYS = 14;
/** Mondays of Weeks 1–6, then the story's first day. */
const SEEDED_DAYS = [0, 7, 14, 21, 28, 35, START_DAY];

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export const emptyHistory = (): Record<ConceptId, MasteryPoint[]> =>
  Object.fromEntries(CONCEPTS.map((c) => [c.id, []])) as unknown as Record<ConceptId, MasteryPoint[]>;

/** The class's mean mastery on one concept. */
export const classAverage = (students: StudentProfile[], concept: ConceptId): number =>
  round3(students.reduce((a, s) => a + s.mastery[concept], 0) / students.length);

/** Weeks 1–6 and the story's first day: 0.20 before a concept's lecture, then a straight climb to the class's average, reached two weeks after the lecture or on day 40, whichever is first. */
export function seededHistory(students: StudentProfile[]): Record<ConceptId, MasteryPoint[]> {
  const out = emptyHistory();
  for (const c of CONCEPTS) {
    const from = lectureOf(c.id).day;
    const to = Math.min(from + RAMP_DAYS, START_DAY);
    const avg = classAverage(students, c.id);
    out[c.id] = SEEDED_DAYS.map((day) => ({
      day,
      value: day < from ? BEFORE_LECTURE : round3(BEFORE_LECTURE + (avg - BEFORE_LECTURE) * Math.min(1, (day - from) / Math.max(1, to - from))),
    }));
  }
  return out;
}

/** Appends today's class average per concept (0.20 for a concept not lectured yet), replacing a point already there for today. Mutates `s`. */
export function noteClassMastery(s: DemoState): void {
  const taught = taughtBy(s.day);
  for (const c of CONCEPTS) {
    const point = { day: s.day, value: taught.includes(c.id) ? classAverage(s.students, c.id) : BEFORE_LECTURE };
    const list = s.masteryHistory[c.id];
    if (list.at(-1)?.day === s.day) list[list.length - 1] = point;
    else list.push(point);
  }
}
```

- [ ] **Step 4: The state, the seed and `advance`**

`src/live/types.ts`: directly before `/** A self-started practice session. */` add:

```ts
/** One point of the class's average mastery on a concept. */
export interface MasteryPoint { day: number; value: number }

```

and in `DemoState` replace

```ts
  study: Record<string, StudyRecord>;
  busy: boolean;
}
```

with

```ts
  study: Record<string, StudyRecord>;
  /** Class average mastery per concept, one point per closed live day. The seeded Weeks 1–6 come from `seededHistory`. */
  masteryHistory: Record<ConceptId, MasteryPoint[]>;
  busy: boolean;
}
```

(`ConceptId` is already imported at the top of `types.ts`.)

`src/live/seed.ts`: after `import { STORY_START } from './clock';` add

```ts
import { emptyHistory } from './history';
```

and in `seedState` replace

```ts
    study: {},
    busy: false,
```

with

```ts
    study: {},
    masteryHistory: emptyHistory(),
    busy: false,
```

`src/live/study/reducer.ts`: before `import { statusFor } from '../mastery';` add

```ts
import { noteClassMastery } from '../history';
```

and in `advance` replace

```ts
    if (s.day % 7 === 0) weekTurn(s, id);
    noteForecast(rec, student, s.day);
```

with

```ts
    if (s.day % 7 === 0) weekTurn(s, id);
    noteClassMastery(s);
    noteForecast(rec, student, s.day);
```

(Points are stamped with the new day, like the forecast points, so the first live point is day 41.)

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run src/live server`
Expected: typecheck clean; all PASS (no test compares a whole `DemoState`, so the new field breaks nothing).

- [ ] **Step 6: Commit**

```bash
git add src/live/history.ts src/live/history.test.ts src/live/types.ts src/live/seed.ts src/live/study/reducer.ts
git commit -m "feat(live): class mastery over time, seeded Weeks 1-6 and one live point per closed day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `get_lecture_materials`, the SAS prompt, and citations that accept resource ids

**Files:**
- Modify: `server/agents/tools.ts` (imports; `READ_TOOLS`; new `materials`; `readTool`; `readLabel`)
- Modify: `server/agents/sas.ts` (import; `BLOCKS_SCHEMA` cites description; `SAS_SYSTEM`; new `citableIds`; `checkBlocks`)
- Test: `server/agents/tools.test.ts`, `server/agents/agents.test.ts`

**Interfaces:**
- Consumes (Task 1): `RESOURCES`, `engagement`, `classEngagement`, `isReleased`; existing `studentOf` (private in `tools.ts`), `CONCEPT_IDS`, `fmt`, `shortDate`, `LECTURES`.
- Produces:
  - Read tool `get_lecture_materials { lecture: number (-1 for all), concept: '' | ConceptId, student_id: string ('' for none) }` returning `Array<{ id, lecture, lectureDate, kind, title, concepts, bloom, minutes, source, released: boolean, classEngagement: { opened, of, meanFraction }, opened?: boolean, fraction?: number }>`; throws `Unknown lecture …`, `Unknown concept …`, `Unknown student id …`.
  - Thinking lines `Student Analysis Agent · reading the materials for Lecture 7` / `… reading the learning materials`.
  - `citableIds(state: DemoState): Set<string>` (evidence ids ∪ `RESOURCES` ids) in `server/agents/sas.ts`; `checkBlocks` validates against it.
  - `SAS_SYSTEM` contains `Cite learning material only by the ids get_lecture_materials returns. Never invent a link, a book or a resource.`

- [ ] **Step 1: Write the failing tests**

In `server/agents/tools.test.ts`, in `it('are strict object schemas', …)` replace

```ts
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students', 'get_exam_outlook', 'get_class_questions']);
```

with

```ts
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students', 'get_exam_outlook', 'get_class_questions', 'get_lecture_materials']);
```

and append:

```ts
describe('lecture materials', () => {
  const state = seedState();
  const materials = (input: Record<string, unknown>) =>
    readTool(state, 'get_lecture_materials', { lecture: -1, concept: '', student_id: '', ...input }) as Array<Record<string, unknown>>;
  it('lists a lecture’s resources with their class engagement, and nothing opened before the lecture', () => {
    expect(materials({ lecture: 7 }).map((r) => r.id)).toEqual(['l7-slides', 'l7-recording', 'l7-worksheet', 'l7-video']);
    expect(materials({ lecture: 7 })[0]).toMatchObject({
      lecture: 7, lectureDate: 'Tue 3 Nov', kind: 'slides', title: 'Lecture 7 · Equivalence laws.pdf', concepts: ['equivLaws'], bloom: 'Understand', minutes: 25,
      source: 'Course slides', released: false, classEngagement: { opened: 0, of: 55, meanFraction: 0 },
    });
    expect(materials({ lecture: 5 }).find((r) => r.id === 'l5-recording')).toMatchObject({ released: true, classEngagement: { opened: 31, of: 55, meanFraction: 0.46 } });
    expect(materials({})).toHaveLength(29);
  });
  it('filters by concept, and adds one student’s own figures', () => {
    expect(materials({ concept: 'implication' }).map((r) => r.id)).toEqual(['l5-slides', 'l5-recording', 'l5-worksheet', 'l5-reading', 'l9-revision']);
    expect(materials({ lecture: 5 })[0]).not.toHaveProperty('opened');
    const ma = materials({ lecture: 5, student_id: 's17' });
    expect(ma.find((r) => r.id === 'l5-recording')).toMatchObject({ opened: true, fraction: 0.22 });
    expect(materials({ lecture: 6, student_id: 's8' }).every((r) => r.opened === false && r.fraction === 0)).toBe(true);
  });
  it('fails clearly on an unknown lecture, concept or student, and never returns a link', () => {
    expect(() => materials({ lecture: 12 })).toThrow('Unknown lecture 12. Lectures run from 1 to 9; use -1 for every lecture.');
    expect(() => materials({ concept: 'predicates' })).toThrow('Unknown concept predicates.');
    expect(() => materials({ student_id: 's99' })).toThrow('Unknown student id s99.');
    expect(JSON.stringify(materials({}))).not.toMatch(/https?:|www\./);
  });
  it('labels the call as a thinking line', () => {
    expect(readLabel(state, 'get_lecture_materials', { lecture: 7, concept: '', student_id: '' })).toBe('Student Analysis Agent · reading the materials for Lecture 7');
    expect(readLabel(state, 'get_lecture_materials', { lecture: -1, concept: 'implication', student_id: '' })).toBe('Student Analysis Agent · reading the learning materials');
  });
});
```

In `server/agents/agents.test.ts`, replace the import

```ts
import { SAS_SYSTEM, sasMessages, sasSpec, type Report } from './sas';
```

with

```ts
import { checkBlocks, SAS_SYSTEM, sasMessages, sasSpec, type Report } from './sas';
```

and inside `describe('prompts carry the eval fixes', …)`, before `it('TAS changes only what was asked when revising', …)`, add:

```ts
  it('SAS cites learning material only by library id', () => {
    expect(SAS_SYSTEM).toContain('Cite learning material only by the ids get_lecture_materials returns. Never invent a link, a book or a resource.');
    const state = stateWithPlan();
    expect(checkBlocks(state, [{ kind: 'p', text: 'Set the slides.', cites: ['l7-slides', 's17-quiz2'] }])).toMatchObject({ ok: true });
    expect(checkBlocks(state, [{ kind: 'p', text: 'Set the handout.', cites: ['l7-handout'] }])).toEqual({ ok: false, error: 'These evidence ids do not exist: l7-handout. Cite only ids returned by the tools.' });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run server/agents/tools.test.ts server/agents/agents.test.ts`
Expected: FAIL: the tool list has no `get_lecture_materials`; the materials tests throw `Unknown tool get_lecture_materials.`; the label is `null`; `SAS_SYSTEM` lacks the citation rule; `checkBlocks` rejects `l7-slides`.

- [ ] **Step 3: The tool**

`server/agents/tools.ts`: replace

```ts
import { fullDate, lectureLabel, shortDate } from '../../src/scenario/course';
```

with

```ts
import { fullDate, LECTURES, lectureLabel, shortDate } from '../../src/scenario/course';
```

and after `import { choseConverse } from '../../src/scenario/roster';` add

```ts
import { classEngagement, engagement, isReleased, RESOURCES } from '../../src/scenario/materials';
```

In `READ_TOOLS`, replace the last entry and the closing bracket

```ts
  tool('get_class_questions', 'What students have been asking on Zalo, email, WhatsApp and the LMS forum, grouped into FAQ entries: the question, what confuses them, the concept, how many students and messages, when they ask relative to the lectures, and the evidence ids of the messages (cite these).', {}),
];
```

with

```ts
  tool('get_class_questions', 'What students have been asking on Zalo, email, WhatsApp and the LMS forum, grouped into FAQ entries: the question, what confuses them, the concept, how many students and messages, when they ask relative to the lectures, and the evidence ids of the messages (cite these).', {}),
  tool('get_lecture_materials', "The course's learning materials (slides, recordings, worksheets, readings, short videos) with their resource ids (cite these): lecture and its date, kind, title, concepts, Bloom level, minutes, source, released (false before the lecture) and classEngagement (opened of 55, and meanFraction: the mean share worked through by those who opened it). With student_id, each also carries that student's opened and fraction. Readings name a textbook section and have no link. Use -1 or \"\" to leave a filter out.", {
    lecture: { type: 'number', description: 'Lecture 1–9, or -1 for every lecture.' },
    concept: { type: 'string', enum: ['', ...CONCEPT_IDS] },
    student_id: { type: 'string', description: 'A student id such as s17, or "".' },
  }),
];
```

Directly before `/** Executes a read tool against a state snapshot. Throws (→ error tool result) on bad input. */` add:

```ts
function materials(state: DemoState, input: Record<string, unknown>) {
  const lecture = Number(input.lecture ?? -1);
  if (lecture !== -1 && !LECTURES.some((l) => l.n === lecture)) throw new Error(`Unknown lecture ${String(input.lecture)}. Lectures run from 1 to ${LECTURES.length}; use -1 for every lecture.`);
  const concept = String(input.concept ?? '');
  if (concept && !CONCEPT_IDS.includes(concept as ConceptId)) throw new Error(`Unknown concept ${concept}. Use one of ${CONCEPT_IDS.join(', ')}, or "" for any.`);
  const student = input.student_id ? studentOf(state, input.student_id) : null;
  const time = fmt(state.clock);
  return RESOURCES
    .filter((r) => (lecture === -1 || r.lecture === lecture) && (!concept || r.concepts.includes(concept as ConceptId)))
    .map((r) => ({
      id: r.id, lecture: r.lecture, lectureDate: shortDate(LECTURES[r.lecture - 1].day), kind: r.kind, title: r.title, concepts: r.concepts,
      bloom: r.bloom, minutes: r.minutes, source: r.source,
      released: isReleased(r, state.day, time),
      classEngagement: classEngagement(r.id, state.day),
      ...(student ? engagement(r.id, student.index, state.day) : {}),
    }));
}

```

In `readTool`, replace

```ts
      }).sort((a, b) => b.students - a.students || b.messages - a.messages);
    default: throw new Error(`Unknown tool ${name}.`);
```

with

```ts
      }).sort((a, b) => b.students - a.students || b.messages - a.messages);
    case 'get_lecture_materials': return materials(state, input);
    default: throw new Error(`Unknown tool ${name}.`);
```

In `readLabel`, after

```ts
    case 'get_class_questions': return `${p} reading what students are asking`;
```

add:

```ts
    case 'get_lecture_materials': return Number(input.lecture) > 0 ? `${p} reading the materials for Lecture ${Number(input.lecture)}` : `${p} reading the learning materials`;
```

(The Teaching Assistance and Adapt agents share `READ_TOOLS`, so they can read the library too; the TAS label swap in `tas.ts` already covers the new line.)

- [ ] **Step 4: The prompt and the citation check**

`server/agents/sas.ts`: after `import { fullDate } from '../../src/scenario/course';` add

```ts
import { RESOURCES } from '../../src/scenario/materials';
```

In `BLOCKS_SCHEMA`, replace `description: 'Evidence ids behind this block, exactly as the tools returned them.'` with `description: 'Evidence or resource ids behind this block, exactly as the tools returned them.'`.

In `SAS_SYSTEM`, replace

```
Student ids look like s17; evidence ids look like s17-quiz2-q4 or class-quiz2-q4.
```

with

```
Student ids look like s17; evidence ids look like s17-quiz2-q4 or class-quiz2-q4; resource ids look like l7-slides.
```

and replace

```
For what the class or a group is asking or confused about, use get_class_questions and cite the messages behind the entries you mention.
```

with

```
For what the class or a group is asking or confused about, use get_class_questions and cite the messages behind the entries you mention. For slides, recordings, worksheets, readings or what to set before a lecture, use get_lecture_materials and cite each resource you mention. Cite learning material only by the ids get_lecture_materials returns. Never invent a link, a book or a resource.
```

Directly before `type RawBlock = { kind?: unknown; text?: unknown; cites?: unknown };` add:

```ts
/** Everything an answer may cite: evidence ids and the library's resource ids. */
export function citableIds(state: DemoState): Set<string> {
  const ids = evidenceIds(state);
  for (const r of RESOURCES) ids.add(r.id);
  return ids;
}

```

In `checkBlocks`, replace the doc comment `/** Model blocks → LiveBlocks; rejects empty answers and cited ids that do not exist. */` with `/** Model blocks → LiveBlocks; rejects empty answers and cited ids that are neither evidence nor a library resource. */`, and replace

```ts
  const known = evidenceIds(state);
```

with

```ts
  const known = citableIds(state);
```

(The error text stays `These evidence ids do not exist: …`, so the existing "sends invented evidence ids back once" test is unchanged. `evidenceIds` itself is unchanged; `server/live.smoke.ts` and eval L2.1 keep using it.)

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run server`
Expected: typecheck clean; all PASS.

- [ ] **Step 6: Commit**

```bash
git add server/agents/tools.ts server/agents/sas.ts server/agents/tools.test.ts server/agents/agents.test.ts
git commit -m "feat(agents): get_lecture_materials, and answers may cite library resources by id

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Resource chips in answers, and `LiveCtx.openPlanning`

**Files:**
- Modify: `src/live/LiveContext.tsx` (`LiveCtx`)
- Modify: `src/live/fixtures.ts` (`ctxFor`)
- Modify: `src/teacher/frame.ts:5` (`View`)
- Modify: `src/teacher/LiveTeacher.tsx` (`planning` state, epoch reset, `actions.setView`, `ctx`)
- Modify: `src/teacher/LiveText.tsx` (import, `source`, `open`)
- Test: `src/teacher/planning.dom.test.tsx` (create; Task 8 extends it)

**Interfaces:**
- Consumes (Task 1): `resourceById(id: string): Resource | undefined`, `resourceChip(r: Resource): string`.
- Produces:
  - `LiveCtx.openPlanning(resourceId: string): void` and `LiveCtx.planningResource?: string | null`
  - `View = 'chat' | 'classroom' | 'calendar' | 'planning'`
  - `LiveTeacherView`: `openPlanning` stores the resource id and switches the view to `'planning'`; any sidebar `setView` clears it; a reset clears it.
  - `LiveText`: a cited resource id renders a chip `data-cite="<id>"` reading `resourceChip(r)` ("Slides · Lecture 7"); clicking it calls `live.openPlanning(id)`.
  - (Until Task 8 renders the tab, a `'planning'` view shows the chat thread; nothing can reach it yet except a chip.)

- [ ] **Step 1: Write the failing test**

Create `src/teacher/planning.dom.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import { LiveText } from './LiveText';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeAll(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
const click = async (b: Element) => act(async () => (b as HTMLElement).click());

describe('resource chips', () => {
  it('read kind and lecture, and open the Lesson planning tab through openPlanning', async () => {
    const opened: string[] = [];
    const profiles: string[] = [];
    const ctx = { ...ctxFor(stateWithPlan()), openPlanning: (id: string) => { opened.push(id); }, openProfile: (id: string) => { profiles.push(id); } };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const block = { kind: 'p' as const, text: 'Set the slides before Lecture 7.', cites: ['l7-slides', 's17-quiz2'] };
    await act(async () => root!.render(<LiveProvider value={ctx}><LiveText block={block} /></LiveProvider>));
    const chip = host.querySelector('[data-cite="l7-slides"]')!;
    expect(chip.textContent).toBe('Slides · Lecture 7');
    await click(chip);
    expect(opened).toEqual(['l7-slides']);
    expect(profiles).toEqual([]);
    await click(host.querySelector('[data-cite="s17-quiz2"]')!);
    expect(profiles).toEqual(['s17']);
    expect(opened).toEqual(['l7-slides']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/planning.dom.test.tsx`
Expected: FAIL: the chip reads `Evidence`, and clicking it calls `openProfile('l7', 'l7-slides')`.

- [ ] **Step 3: The context, the fixture and the view type**

`src/live/LiveContext.tsx`: replace

```ts
  /** The student whose profile pop-up is open, if any. */
  profileId?: string | null;
```

with

```ts
  /** The student whose profile pop-up is open, if any. */
  profileId?: string | null;
  /** Opens the Lesson planning tab with a library resource's row expanded. Local to this window. */
  openPlanning(resourceId: string): void;
  /** The resource the Lesson planning tab opens on, if any. */
  planningResource?: string | null;
```

`src/live/fixtures.ts`, in `ctxFor`, replace `openProfile: () => {}, toast: () => {},` with `openProfile: () => {}, openPlanning: () => {}, toast: () => {},`.

`src/teacher/frame.ts` line 5 becomes:

```ts
export type View = 'chat' | 'classroom' | 'calendar' | 'planning';
```

- [ ] **Step 4: The live teacher window**

`src/teacher/LiveTeacher.tsx`: after

```ts
  const [profile, setProfile] = useState<{ studentId: string; entryId: string | null } | null>(null);
```

add

```ts
  const [planning, setPlanning] = useState<string | null>(null);
```

In the epoch block, replace

```ts
    setLocal([]);
    setProfile(null);
```

with

```ts
    setLocal([]);
    setProfile(null);
    setPlanning(null);
```

In `actions`, replace

```ts
    setView: (v: View) => pushLocal({ at: t, type: 'view', view: v }),
```

with

```ts
    setView: (v: View) => {
      setPlanning(null);
      pushLocal({ at: t, type: 'view', view: v });
    },
```

In `ctx`, replace

```ts
    openProfile: (studentId, entryId = null) => setProfile({ studentId, entryId }),
    profileId: profile?.studentId ?? null,
  };
```

with

```ts
    openProfile: (studentId, entryId = null) => setProfile({ studentId, entryId }),
    profileId: profile?.studentId ?? null,
    openPlanning: (resourceId) => {
      setPlanning(resourceId);
      pushLocal({ at: t, type: 'view', view: 'planning' });
    },
    planningResource: planning,
  };
```

- [ ] **Step 5: The chip**

`src/teacher/LiveText.tsx`: after `import type { LiveBlock, LivePanel } from '../live/types';` add

```ts
import { resourceById, resourceChip } from '../scenario/materials';
```

Replace the doc line

```ts
/** A live answer block: `**bold**` spans, then one chip per cited evidence entry. */
```

with

```ts
/** A live answer block: `**bold**` spans, then one chip per cited evidence entry or library resource. */
```

Replace

```ts
  const source = (id: string) => {
    const list = id.startsWith('class-') ? live?.state.classEvidence : live?.state.students.find((s) => s.id === id.split('-')[0])?.evidence;
```

with

```ts
  const source = (id: string) => {
    const r = resourceById(id);
    if (r) return resourceChip(r);
    const list = id.startsWith('class-') ? live?.state.classEvidence : live?.state.students.find((s) => s.id === id.split('-')[0])?.evidence;
```

and replace

```ts
  const open = (id: string) => {
    if (!live) return;
    if (id.startsWith('class-')) live.showPanel(panelForEvidence(id));
    else live.openProfile(id.split('-')[0], id);
  };
```

with

```ts
  const open = (id: string) => {
    if (!live) return;
    if (resourceById(id)) live.openPlanning(id);
    else if (id.startsWith('class-')) live.showPanel(panelForEvidence(id));
    else live.openProfile(id.split('-')[0], id);
  };
```

(A resource id matches no student, so it never gets a quote card.)

- [ ] **Step 6: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher src/live`
Expected: typecheck clean; all PASS, `screen.test.tsx` and `script.test.ts` unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/live/LiveContext.tsx src/live/fixtures.ts src/teacher/frame.ts src/teacher/LiveTeacher.tsx src/teacher/LiveText.tsx src/teacher/planning.dom.test.tsx
git commit -m "feat(teacher): resource chips in answers, opening Lesson planning through openPlanning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `ResourceList`, shared with the Calendar's lecture details

**Files:**
- Create: `src/teacher/ResourceList.tsx`
- Modify: `src/teacher/CalendarTab.tsx` (import; `LectureDetail`)
- Test: `src/teacher/calendar.dom.test.tsx`

**Interfaces:**
- Consumes (Task 1): `resourcesFor`, `classEngagement`, `isReleased`, `notOpened`, `KIND_LABEL`, `Resource`, `ResourceKind`; `useLive().openProfile(studentId: string)`, `fmt`, `LECTURES`, `shortDate`.
- Produces (in `src/teacher/ResourceList.tsx`):
  - `engagementLine(r: Resource, released: boolean, today: number): string` ("31 of 55 opened · 46% watched on average", "0 of 55 opened", "Not released yet"; verbs: slides viewed, recording/video watched, worksheet done, reading read)
  - `ResourceList({ lecture, initialOpen }: { lecture: number; initialOpen?: string | null }): JSX.Element | null`
  - DOM hooks: `[data-resources="<n>"]` on the list, `[data-resource="<id>"]` on each row's `li` (its first child is the row button with `aria-expanded`), `[data-engagement]` on the figure, `[data-not-opened="<id>"]` on an expansion, `[data-student="<studentId>"]` on each name button.

- [ ] **Step 1: Write the failing test**

In `src/teacher/calendar.dom.test.tsx`, replace

```ts
import { lectureQuestions } from './calendar';
```

with

```ts
import { notOpened } from '../scenario/materials';
import { lectureQuestions } from './calendar';
```

and inside `describe('teacher calendar', …)`, before `it('a stopped flag opens the student’s pop-up and a session opens its conversation', …)`, add:

```ts
  it('shows a lecture’s materials above its questions, and a row lists who has not opened it', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(button(m.el, '‹ Prev week'));
    await click(event(m.el, 'lecture-5'));
    const detail = () => m.el.querySelector('[data-detail="lecture-5"]')!;
    expect([...detail().querySelectorAll('[data-resource]')].map((r) => r.getAttribute('data-resource'))).toEqual(['l5-slides', 'l5-recording', 'l5-worksheet', 'l5-reading']);
    expect(detail().querySelector('[data-resources]')!.compareDocumentPosition(detail().querySelector('[data-question]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detail().querySelector('[data-resource="l5-recording"] [data-engagement]')!.textContent).toBe('31 of 55 opened · 46% watched on average');
    await click(detail().querySelector('[data-resource="l5-recording"] button')!);
    expect(detail().querySelectorAll('[data-not-opened="l5-recording"] [data-student]')).toHaveLength(notOpened('l5-recording').length);
    expect(m.calls).toEqual([]);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/calendar.dom.test.tsx`
Expected: FAIL: the lecture detail has no `[data-resource]` rows (`[]` instead of the four ids).

- [ ] **Step 3: Create `src/teacher/ResourceList.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { LECTURES, shortDate } from '../scenario/course';
import { classEngagement, isReleased, KIND_LABEL, notOpened, resourcesFor, type Resource, type ResourceKind } from '../scenario/materials';

const VERB: Record<ResourceKind, string> = { slides: 'viewed', recording: 'watched', worksheet: 'done', reading: 'read', video: 'watched' };

/** "31 of 55 opened · 46% watched on average", or "Not released yet" before the lecture. */
export function engagementLine(r: Resource, released: boolean, today: number): string {
  if (!released) return 'Not released yet';
  const c = classEngagement(r.id, today);
  return c.opened ? `${c.opened} of ${c.of} opened · ${Math.round(c.meanFraction * 100)}% ${VERB[r.kind]} on average` : `0 of ${c.of} opened`;
}

/** A lecture's materials with class engagement. A row expands into the students who have not opened it; a name opens the profile pop-up. Live only; posts nothing. */
export function ResourceList({ lecture, initialOpen = null }: { lecture: number; initialOpen?: string | null }) {
  const live = useLive();
  const list = resourcesFor(lecture);
  const [open, setOpen] = useState<string | null>(() => (initialOpen && list.some((r) => r.id === initialOpen) ? initialOpen : null));
  const first = useRef<HTMLLIElement | null>(null);
  useEffect(() => { first.current?.scrollIntoView?.({ block: 'center' }); }, []);
  if (!live) return null;
  const { state } = live;
  const time = fmt(state.clock);
  const l = LECTURES[lecture - 1];
  return (
    <ul data-resources={lecture} className="divide-y divide-egg-line border-y border-egg-line">
      {list.map((r) => {
        const released = isReleased(r, state.day, time);
        const expanded = open === r.id;
        const missing = released ? notOpened(r.id, state.day).map((i) => state.students[i]) : [];
        return (
          <li key={r.id} data-resource={r.id} ref={r.id === initialOpen ? first : undefined}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
              className="grid w-full grid-cols-[92px_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-left hover:bg-egg-card/60"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-egg-mute">{KIND_LABEL[r.kind]}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-egg-ink">{r.title}</span>
                <span className="block text-[12px] text-egg-mute">{`${r.bloom} · ${r.minutes} min · ${r.source}`}</span>
              </span>
              <span data-engagement className="text-right text-[12px] text-egg-mute">{engagementLine(r, released, state.day)}</span>
            </button>
            {expanded && (
              <div data-not-opened={r.id} className="pb-3 pl-[104px] text-[13px]">
                {!released ? (
                  <span className="text-egg-mute">{`Nobody can open it before Lecture ${l.n} on ${shortDate(l.day)}.`}</span>
                ) : missing.length === 0 ? (
                  <span className="text-egg-mute">Every student has opened it.</span>
                ) : (
                  <>
                    <span className="block text-egg-mute">{`${missing.length} student${missing.length === 1 ? ' has' : 's have'} not opened it`}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {missing.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          data-student={s.id}
                          onClick={() => live.openProfile(s.id)}
                          className="rounded-full border border-egg-line px-2.5 py-0.5 text-[12.5px] text-egg-ink hover:border-egg-ink"
                        >
                          {s.name}
                        </button>
                      ))}
                    </span>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: The Calendar's lecture details**

`src/teacher/CalendarTab.tsx`: after `import { Eyebrow } from './parts';` add

```ts
import { ResourceList } from './ResourceList';
```

Replace the doc line `/** The student questions placed after a lecture, from the FAQ log. */` with `/** A lecture's materials, then the student questions placed after it, from the FAQ log. */`, and in `LectureDetail` replace

```tsx
      <div className="mt-1 text-[12.5px] text-egg-mute">{`${fullDate(l.day)} · 09:00–11:00 · ${questions.length} student question${questions.length === 1 ? '' : 's'} after it`}</div>
      {questions.length ? (
```

with

```tsx
      <div className="mt-1 text-[12.5px] text-egg-mute">{`${fullDate(l.day)} · 09:00–11:00 · ${questions.length} student question${questions.length === 1 ? '' : 's'} after it`}</div>
      <div className="mt-4"><Eyebrow>Materials</Eyebrow></div>
      <div className="mt-1"><ResourceList lecture={n} /></div>
      <div className="mt-5"><Eyebrow>Student questions</Eyebrow></div>
      {questions.length ? (
```

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher`
Expected: PASS. The click audit's "calendar with Lecture 6 open" scenario now meets the resource rows; each toggles its expansion, so it still passes.

- [ ] **Step 6: Commit**

```bash
git add src/teacher/ResourceList.tsx src/teacher/CalendarTab.tsx src/teacher/calendar.dom.test.tsx
git commit -m "feat(teacher): ResourceList with class engagement and who has not opened it, in the Calendar's lecture details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The knowledge graph

**Files:**
- Create: `src/teacher/ConceptGraph.tsx`
- Modify: `src/teacher/Classroom.tsx` (export the heatmap scale as `gapFill`; `Heatmap` uses it)
- Test: `src/teacher/conceptGraph.dom.test.tsx` (create)

**Interfaces:**
- Consumes (Task 2): `classAverage(students, concept): number`; `CONCEPTS` (x/y in the 1100×560 viewBox), `EDGES`, `conceptById`; `taughtBy`, `lectureOf`, `shortDate`; `fmt`; `egg`.
- Produces:
  - `gapFill(v: number): string` in `src/teacher/Classroom.tsx` (the heatmap's `color-mix` scale, unchanged output)
  - `GAP = 0.5` and `ConceptGraph({ state, selected, onSelect }: { state: DemoState; selected: ConceptId | null; onSelect(concept: ConceptId | null): void })` in `src/teacher/ConceptGraph.tsx`
  - DOM hooks: `[data-graph]`; `[data-edge="<from>-<to>"]` per edge; a `button[data-node="<id>"]` per concept with `aria-pressed`, `data-untaught` when not lectured yet, `data-gap` when lectured and below 0.50 (its value is bold, as on the heatmap).

- [ ] **Step 1: Write the failing test**

Create `src/teacher/conceptGraph.dom.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { classAverage } from '../live/history';
import { seedState } from '../live/seed';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { EDGES } from '../scenario/knowledgeGraph';
import { ConceptGraph } from './ConceptGraph';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const graph = (s = seedState(), selected: ConceptId | null = null) => {
  host = document.createElement('div');
  host.innerHTML = html(<ConceptGraph state={s} selected={selected} onSelect={() => {}} />);
  return host;
};
const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node="${id}"]`)!;

describe('knowledge graph', () => {
  it('draws the 12 concepts and every prerequisite edge', () => {
    const el = graph();
    expect(el.querySelectorAll('[data-node]')).toHaveLength(12);
    expect(el.querySelectorAll('[data-edge]')).toHaveLength(EDGES.length);
    expect(el.querySelector('[data-edge="equivalence-equivLaws"]')).not.toBeNull();
  });
  it('shows the class average under each lectured concept, and greys the rest with their lecture and date', () => {
    const s = seedState();
    const el = graph(s);
    expect(node(el, 'equivalence').textContent).toBe(`Logical equivalence${classAverage(s.students, 'equivalence').toFixed(2)}`);
    expect(node(el, 'equivalence').hasAttribute('data-untaught')).toBe(false);
    expect([...el.querySelectorAll('[data-untaught]')].map((n) => n.getAttribute('data-node'))).toEqual(['equivLaws', 'applications']);
    expect(node(el, 'equivLaws').textContent).toBe('Equivalence lawsLecture 7 · Tue 3 Nov');
    expect(node(el, 'applications').textContent).toBe('ApplicationsLecture 8 · Tue 10 Nov');
  });
  it('marks a concept below 0.50 as a gap, the way the heatmap does', () => {
    const s = seedState();
    expect(graph(s).querySelectorAll('[data-gap]')).toHaveLength(0);
    for (const st of s.students) st.mastery.implication = 0.3;
    const el = graph(s);
    expect([...el.querySelectorAll('[data-gap]')].map((n) => n.getAttribute('data-node'))).toEqual(['implication']);
    expect(node(el, 'implication').querySelector('.font-bold')?.textContent).toBe('0.30');
  });
  it('selects a node on click and clears it on a second click', async () => {
    const picks: (ConceptId | null)[] = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const draw = (selected: ConceptId | null) => root!.render(<ConceptGraph state={seedState()} selected={selected} onSelect={(c) => { picks.push(c); }} />);
    await act(async () => draw(null));
    await act(async () => (node(host!, 'implication') as HTMLElement).click());
    await act(async () => draw('implication'));
    expect(node(host, 'implication').getAttribute('aria-pressed')).toBe('true');
    await act(async () => (node(host!, 'implication') as HTMLElement).click());
    expect(picks).toEqual(['implication', null]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/conceptGraph.dom.test.tsx`
Expected: FAIL: `Failed to resolve import "./ConceptGraph"`.

- [ ] **Step 3: Share the heatmap's scale**

`src/teacher/Classroom.tsx`: after

```ts
const risk = (a: number) => `rgb(255 91 31 / ${a})`;
```

add

```ts
/** The heatmap's scale: the more orange, the bigger the gap (none at 0.90, full at 0.40 and below). */
export const gapFill = (v: number): string => `color-mix(in oklab, ${risk(1)} ${Math.max(0, Math.min(1, (0.9 - v) / 0.5)) * 100}%, ${egg('card')})`;
```

In `Heatmap`, delete the line

```ts
  const tint = (v: number) => Math.max(0, Math.min(1, (0.9 - v) / 0.5)) * 100;
```

and replace

```tsx
                  style={{ background: `color-mix(in oklab, ${risk(1)} ${tint(v)}%, ${egg('card')})` }}
```

with

```tsx
                  style={{ background: gapFill(v) }}
```

(The style string is identical, so the scripted Classroom renders exactly as before.)

- [ ] **Step 4: Create `src/teacher/ConceptGraph.tsx`**

```tsx
import { fmt } from '../live/clock';
import { classAverage } from '../live/history';
import type { DemoState } from '../live/types';
import { lectureOf, shortDate, taughtBy } from '../scenario/course';
import { CONCEPTS, conceptById, EDGES, type ConceptId } from '../scenario/knowledgeGraph';
import { egg } from '../ui/theme';
import { gapFill } from './Classroom';

/** The graph's viewBox, the same one `CONCEPTS` x/y are given in. */
const W = 1100;
const H = 560;
/** Below this class average a concept is a gap, as on the heatmap. */
export const GAP = 0.5;

/** The 12 concepts at their fixed positions, joined by their prerequisite edges. A lectured node is filled by class average mastery on the heatmap's scale; a node not lectured yet is greyed with its lecture and date. Clicking a node selects it; clicking it again clears the selection. */
export function ConceptGraph({ state, selected, onSelect }: { state: DemoState; selected: ConceptId | null; onSelect(concept: ConceptId | null): void }) {
  const taught = taughtBy(state.day, fmt(state.clock));
  return (
    <div data-graph className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {EDGES.map(([a, b]) => {
          const from = conceptById(a);
          const to = conceptById(b);
          const on = selected === a || selected === b;
          return <line key={`${a}-${b}`} data-edge={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={egg(on ? 'ink' : 'line')} strokeWidth={on ? 2.5 : 1.5} />;
        })}
      </svg>
      {CONCEPTS.map((c) => {
        const lectured = taught.includes(c.id);
        const v = classAverage(state.students, c.id);
        const gap = lectured && v < GAP;
        const l = lectureOf(c.id);
        const on = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            data-node={c.id}
            data-untaught={lectured ? undefined : ''}
            data-gap={gap ? '' : undefined}
            aria-pressed={on}
            title={lectured ? `${c.label}: class average ${v.toFixed(2)}` : `${c.label}: taught in Lecture ${l.n} on ${shortDate(l.day)}`}
            onClick={() => onSelect(on ? null : c.id)}
            className={`absolute w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2 py-1.5 text-center leading-tight ${on ? 'border-egg-ink ring-2 ring-egg-ink' : 'border-egg-line'} ${lectured ? 'text-egg-ink' : 'border-dashed bg-egg-paper text-egg-faint'}`}
            style={{ left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%`, ...(lectured ? { background: gapFill(v) } : {}) }}
          >
            <span className="block text-[12px] font-semibold">{c.label}</span>
            <span className={`block font-mono text-[11.5px] tabular-nums ${gap ? 'font-bold' : ''}`}>{lectured ? v.toFixed(2) : `Lecture ${l.n} · ${shortDate(l.day)}`}</span>
          </button>
        );
      })}
    </div>
  );
}
```

(Nodes are HTML buttons over an SVG of the edges, so the click audit and keyboard users reach them like any other button.)

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher`
Expected: PASS, with `screen.test.tsx`, `script.test.ts` and `live.test.tsx` (heatmap titles) unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/teacher/ConceptGraph.tsx src/teacher/Classroom.tsx src/teacher/conceptGraph.dom.test.tsx
git commit -m "feat(teacher): a knowledge graph coloured by class mastery on the heatmap's scale

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `MasteryChart` and the chart's data

**Files:**
- Create: `src/teacher/MasteryChart.tsx`
- Create: `src/teacher/planningModel.ts` (series and markers; Task 8 adds the lecture lists)
- Test: `src/teacher/planningModel.test.tsx` (create; Task 8 extends it)

**Interfaces:**
- Consumes (Task 2): `seededHistory`, `DemoState.masteryHistory`; (Task 6): `GAP`; `ChartPoint`, `ChartMarker` from `src/teacher/ForecastChart.tsx`; `buildRoster()`; `EXAM_DAY`, `LECTURES`.
- Produces:
  - `MasteryChart({ concept, label, points, markers }: { concept: ConceptId; label: string; points: ChartPoint[]; markers: ChartMarker[] })`. DOM hooks: `polyline[data-series="mastery"][data-concept="<id>"]`, `[data-gap-line]`, `text[data-tick="<n>"]` reading `L<n>`, `circle[data-point="<day>"]`, `text[data-marker-row="intervention"]`.
  - In `src/teacher/planningModel.ts`: `DEFAULT_CONCEPT: ConceptId = 'equivalence'`; `masterySeries(state: DemoState, concept: ConceptId): ChartPoint[]` (seeded from the seed roster, then `state.masteryHistory`); `planMarkers(state: DemoState): ChartMarker[]` (plans `sent`, `autoApproved`, `approved` or `done`; labels "Pathway", "Class activity", "Check-ins"; one per kind and day).

- [ ] **Step 1: Write the failing test**

Create `src/teacher/planningModel.test.tsx`:

```tsx
import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { planFor, stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { advance, openPick, pickStudent, saveSetup, type StudyResult } from '../live/study/reducer';
import type { DemoState } from '../live/types';
import { MasteryChart } from './MasteryChart';
import { DEFAULT_CONCEPT, masterySeries, planMarkers } from './planningModel';

const ok = (r: StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('mastery chart', () => {
  const points = masterySeries(seedState(), 'implication');
  it('draws the series, the 0.50 gap line, a tick per lecture and the exam', () => {
    const out = html(<MasteryChart concept="implication" label="Implication" points={points} markers={[]} />);
    expect(out).toContain('data-series="mastery"');
    expect(out).toContain('data-concept="implication"');
    expect(out).toContain('data-gap-line');
    expect(out).toContain('Gap 0.50');
    expect(out.match(/data-tick="/g)).toHaveLength(9);
    expect(out).toMatch(/data-tick="7"[^>]*>L7</);
    expect(out).toContain('>Exam<');
    expect(out.match(/data-point="/g)).toHaveLength(points.length);
  });
  it('puts intervention labels on their own row along the top', () => {
    const out = html(<MasteryChart concept="implication" label="Implication" points={points} markers={[{ day: 40, label: 'Pathway', row: 'intervention' }, { day: 40, label: 'Check-ins', row: 'intervention' }]} />);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Pathway</);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Check-ins</);
  });
});

describe('the chart’s data', () => {
  it('shows the seeded points only until a live day closes, then joins the live points', () => {
    const s = seedState();
    expect(DEFAULT_CONCEPT).toBe('equivalence');
    expect(masterySeries(s, 'equivalence').map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40]);
    const after = ok(advance(ok(saveSetup(ok(pickStudent(ok(openPick(s)), 's17')), 30, 60)), 2, null));
    expect(masterySeries(after, 'equivalence').map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40, 41, 42]);
  });
  it('keeps the seeded weeks fixed when the class changes live', () => {
    const s = seedState();
    const before = masterySeries(s, 'propositions');
    for (const st of s.students) st.mastery.propositions = 0.1;
    expect(masterySeries(s, 'propositions')).toEqual(before);
  });
  it('marks pathways sent, class activities approved and check-ins booked, not proposals or dismissals', () => {
    expect(planMarkers(stateWithPlan())).toEqual([]);
    expect(planMarkers(stateWithPlan('pathway', { status: 'sent' }))).toEqual([{ day: 40, label: 'Pathway', row: 'intervention' }]);
    const s = stateWithPlan('classActivity', { status: 'approved' });
    s.plans.push(planFor('checkIns', { id: 'p2', status: 'approved' }), planFor('pathway', { id: 'p3', status: 'dismissed' }), planFor('pathway', { id: 'p4', status: 'done', date: 41 }));
    expect(planMarkers(s)).toEqual([
      { day: 45, label: 'Class activity', row: 'intervention' },
      { day: 46, label: 'Check-ins', row: 'intervention' },
      { day: 41, label: 'Pathway', row: 'intervention' },
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/planningModel.test.tsx`
Expected: FAIL: `Failed to resolve import "./MasteryChart"`.

- [ ] **Step 3: Create `src/teacher/MasteryChart.tsx`**

```tsx
import { EXAM_DAY, LECTURES } from '../scenario/course';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { egg } from '../ui/theme';
import { GAP } from './ConceptGraph';
import type { ChartMarker, ChartPoint } from './ForecastChart';

const W = 760;
const H = 220;
const LEFT = 34;
const RIGHT = 70;
const TOP = 36;
const BOTTOM = 30;
const x = (day: number) => LEFT + (day / EXAM_DAY) * (W - LEFT - RIGHT);
const y = (v: number) => TOP + (1 - v) * (H - TOP - BOTTOM);

/** Class average mastery (0–1) on one concept from Week 1 to the exam: the 0.50 gap line, a tick on each lecture day and the interventions on their own row along the top, as on the forecast chart. */
export function MasteryChart({ concept, label, points, markers }: { concept: ConceptId; label: string; points: ChartPoint[]; markers: ChartMarker[] }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Class average mastery on ${label} across the course`}>
      {[0, 0.5, 1].map((v) => (
        <text key={v} x={LEFT - 8} y={y(v) + 4} fontSize="10" textAnchor="end" fill={egg('mute')}>{v.toFixed(1)}</text>
      ))}
      <line x1={LEFT} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke={egg('line')} />
      <line data-gap-line x1={LEFT} x2={W - RIGHT} y1={y(GAP)} y2={y(GAP)} stroke={egg('mute')} strokeDasharray="2 4" />
      <text x={W - RIGHT + 6} y={y(GAP) + 4} fontSize="11" fill={egg('mute')}>Gap 0.50</text>
      {LECTURES.map((l) => (
        <g key={l.n}>
          <line x1={x(l.day)} x2={x(l.day)} y1={y(0)} y2={y(0) + 4} stroke={egg('mute')} />
          <text data-tick={l.n} x={x(l.day)} y={H - BOTTOM + 16} fontSize="10" textAnchor="middle" fill={egg('mute')}>{`L${l.n}`}</text>
        </g>
      ))}
      <text x={x(EXAM_DAY)} y={H - BOTTOM + 16} fontSize="10" textAnchor="middle" fill={egg('mute')}>Exam</text>
      {markers.map((m, i) => {
        // Markers on the same day stack upwards instead of overlapping.
        const stack = markers.slice(0, i).filter((o) => o.day === m.day).length;
        return (
          <g key={i}>
            <line x1={x(m.day)} x2={x(m.day)} y1={TOP - 6} y2={y(0)} stroke={egg('line')} strokeDasharray="3 3" />
            <text data-marker-row={m.row} x={x(m.day)} y={TOP - 10 - stack * 12} fontSize="10" textAnchor="middle" fill={egg('accent-ink')}>{m.label}</text>
          </g>
        );
      })}
      {points.length > 1 && (
        <polyline data-series="mastery" data-concept={concept} points={points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={egg('ink')} strokeWidth="2" />
      )}
      {points.map((p) => <circle key={p.day} data-point={p.day} cx={x(p.day)} cy={y(p.value)} r="3" fill={egg('ink')} />)}
    </svg>
  );
}
```

- [ ] **Step 4: Create `src/teacher/planningModel.ts`**

```ts
import { seededHistory } from '../live/history';
import type { DemoState, PlanKind, PlanStatus } from '../live/types';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { buildRoster } from '../scenario/roster';
import type { ChartMarker, ChartPoint } from './ForecastChart';

/** The Week 6 topic: the chart's concept when nothing is selected. */
export const DEFAULT_CONCEPT: ConceptId = 'equivalence';

/** Weeks 1–6 from the seed roster, so the past stays put whatever happens live. */
const SEEDED = seededHistory(buildRoster());

/** The seeded points, then one per closed live day. */
export const masterySeries = (state: DemoState, concept: ConceptId): ChartPoint[] => [...SEEDED[concept], ...state.masteryHistory[concept]];

/** Plans that went ahead, as on the calendar. */
const SHOWN: PlanStatus[] = ['sent', 'autoApproved', 'approved', 'done'];
const MARK: Record<PlanKind, string> = { pathway: 'Pathway', classActivity: 'Class activity', checkIns: 'Check-ins' };

/** Pathways sent, class activities approved and check-ins booked, on their plan dates; one marker per kind and day. */
export function planMarkers(state: DemoState): ChartMarker[] {
  const seen = new Set<string>();
  return state.plans.filter((p) => SHOWN.includes(p.status)).flatMap((p): ChartMarker[] => {
    const key = `${p.date}:${p.kind}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ day: p.date, label: MARK[p.kind], row: 'intervention' }];
  });
}
```

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/teacher/MasteryChart.tsx src/teacher/planningModel.ts src/teacher/planningModel.test.tsx
git commit -m "feat(teacher): MasteryChart of class mastery over the term, with intervention markers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The Lesson planning tab

**Files:**
- Create: `src/teacher/LessonPlanning.tsx`
- Modify: `src/teacher/planningModel.ts` (imports; `upcomingLectures`, `pastLectures`)
- Modify: `src/teacher/TeacherScreen.tsx` (import, `title`, main view switch, `Sidebar` nav)
- Test: `src/teacher/planningModel.test.tsx`, `src/teacher/planning.dom.test.tsx`, `src/teacher/live.test.tsx`

**Interfaces:**
- Consumes: `ConceptGraph`, `GAP` (Task 6); `MasteryChart`, `DEFAULT_CONCEPT`, `masterySeries`, `planMarkers` (Task 7); `ResourceList` (Task 5); `LiveCtx.planningResource`, `openPlanning` (Task 4); `resourceById`, `resourcesFor` (Task 1); `nextLecture(day, time)`, `lectureOf`, `LECTURES`, `fullDate`, `conceptById`, `fmt`.
- Produces:
  - In `src/teacher/planningModel.ts`: `upcomingLectures(day: number, time: string, concept: ConceptId | null): Lecture[]` (the next lecture and the two after it; with a concept, those whose materials cover it plus `lectureOf(concept)`, in lecture order) and `pastLectures(day: number, time: string, concept: ConceptId | null): Lecture[]` (held lectures, newest first, minus those listed above; with a concept, only those whose materials cover it).
  - `LessonPlanning(): JSX.Element | null` (live only). DOM hooks: `[data-section="graph" | "chart" | "lectures"]`, `[data-chart-title]`, `[data-lecture="<n>"]` per listed lecture; the "Past lectures" / "Hide past lectures" toggle.
  - Sidebar item "Lesson planning" after Calendar, live only; header title "Lesson planning".

- [ ] **Step 1: Write the failing tests**

In `src/teacher/planningModel.test.tsx`, replace

```ts
import { DEFAULT_CONCEPT, masterySeries, planMarkers } from './planningModel';
```

with

```ts
import { DEFAULT_CONCEPT, masterySeries, pastLectures, planMarkers, upcomingLectures } from './planningModel';
```

and append:

```ts
describe('which lectures the tab lists', () => {
  const ns = (ls: { n: number }[]) => ls.map((l) => l.n);
  it('takes the next lecture and the two after it, and the rest as past lectures, newest first', () => {
    expect(ns(upcomingLectures(40, '15:00', null))).toEqual([7, 8, 9]);
    expect(ns(pastLectures(40, '15:00', null))).toEqual([6, 5, 4, 3, 2, 1]);
    expect(ns(upcomingLectures(43, '10:00', null))).toEqual([8, 9]);
    expect(ns(pastLectures(43, '10:00', null))).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(upcomingLectures(57, '10:00', null)).toEqual([]);
  });
  it('with a concept, keeps the coming lectures with material on it plus the lecture that taught it', () => {
    expect(ns(upcomingLectures(40, '15:00', 'implication'))).toEqual([5, 9]);
    expect(ns(upcomingLectures(40, '15:00', 'equivLaws'))).toEqual([7, 9]);
    expect(ns(upcomingLectures(40, '15:00', 'applications'))).toEqual([8, 9]);
    expect(pastLectures(40, '15:00', 'implication')).toEqual([]);
  });
});
```

In `src/teacher/planning.dom.test.tsx`, replace

```tsx
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import { LiveText } from './LiveText';
```

with

```tsx
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { classEngagement, notOpened } from '../scenario/materials';
import { LiveTeacherView } from './LiveTeacher';
import { LiveText } from './LiveText';
```

after the `click` helper add:

```tsx
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const lectures = (el: HTMLElement) => [...el.querySelectorAll('[data-lecture]')].map((l) => l.getAttribute('data-lecture'));
const row = (el: HTMLElement, id: string) => el.querySelector(`[data-resource="${id}"] > button`)!;
const series = (el: HTMLElement) => el.querySelector('[data-series="mastery"]')?.getAttribute('data-concept');

async function mount(state: DemoState = stateWithPlan()) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}
```

and append:

```tsx
describe('lesson planning tab', () => {
  it('lists the next three lectures, and a concept on the graph changes the chart and filters the lectures', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    expect(m.el.querySelector('h1')?.textContent).toBe('Lesson planning');
    expect(m.el.querySelectorAll('[data-node]')).toHaveLength(12);
    expect(m.el.querySelectorAll('[data-edge]')).toHaveLength(19);
    expect([...m.el.querySelectorAll('[data-untaught]')].map((n) => n.textContent)).toEqual(['Equivalence lawsLecture 7 · Tue 3 Nov', 'ApplicationsLecture 8 · Tue 10 Nov']);
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
    expect(series(m.el)).toBe('equivalence');
    expect(m.el.querySelector('[data-chart-title]')?.textContent).toBe('Mastery over time · Logical equivalence');
    await click(m.el.querySelector('[data-node="implication"]')!);
    expect(series(m.el)).toBe('implication');
    expect(m.el.querySelector('[data-chart-title]')?.textContent).toBe('Mastery over time · Implication');
    expect(lectures(m.el)).toEqual(['5', '9']);
    await click(m.el.querySelector('[data-node="implication"]')!);
    expect(series(m.el)).toBe('equivalence');
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
    expect(m.calls).toEqual([]);
  });
  it('shows class engagement for past lectures, newest first, and "Not released yet" before a lecture', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    expect(m.el.querySelector('[data-resource="l7-slides"] [data-engagement]')?.textContent).toBe('Not released yet');
    await click(button(m.el, 'Past lectures'));
    expect(lectures(m.el)).toEqual(['7', '8', '9', '6', '5', '4', '3', '2', '1']);
    const c = classEngagement('l6-recording');
    expect(m.el.querySelector('[data-resource="l6-recording"] [data-engagement]')?.textContent).toBe(`${c.opened} of 55 opened · ${Math.round(c.meanFraction * 100)}% watched on average`);
    await click(button(m.el, 'Hide past lectures'));
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
  });
  it('expands a resource into exactly the students who have not opened it, and a name opens the pop-up', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    await click(button(m.el, 'Past lectures'));
    await click(row(m.el, 'l5-recording'));
    const missing = notOpened('l5-recording');
    expect([...m.el.querySelectorAll('[data-not-opened="l5-recording"] [data-student]')].map((b) => b.getAttribute('data-student'))).toEqual(missing.map((i) => `s${i + 1}`));
    await click(m.el.querySelector('[data-not-opened="l5-recording"] [data-student]')!);
    expect(m.el.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(stateWithPlan().students[missing[0]].name);
    await click(button(m.el, 'Close'));
    await click(row(m.el, 'l7-slides'));
    expect(m.el.querySelector('[data-not-opened="l7-slides"]')?.textContent).toBe('Nobody can open it before Lecture 7 on Tue 3 Nov.');
    expect(m.el.querySelectorAll('[data-not-opened="l7-slides"] [data-student]')).toHaveLength(0);
    expect(m.calls).toEqual([]);
  });
  it('a resource chip in an answer opens the tab with that row expanded, past lectures included', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[1].cites = ['l5-recording', 'l7-slides'];
    const m = await mount(s);
    await click(m.el.querySelector('[data-cite="l5-recording"]')!);
    expect(m.el.querySelector('h1')?.textContent).toBe('Lesson planning');
    expect(row(m.el, 'l5-recording').getAttribute('aria-expanded')).toBe('true');
    expect(m.el.querySelectorAll('[data-not-opened="l5-recording"] [data-student]')).toHaveLength(notOpened('l5-recording').length);
    await click(button(m.el, 'Chat'));
    await click(m.el.querySelector('[data-cite="l7-slides"]')!);
    expect(row(m.el, 'l7-slides').getAttribute('aria-expanded')).toBe('true');
    expect(m.el.querySelector('[data-not-opened="l5-recording"]')).toBeNull();
    expect(m.calls).toEqual([]);
  });
});
```

In `src/teacher/live.test.tsx`, inside `describe('live classroom', …)`, before `it('offers "Open context" only when another panel is showing', …)`, add:

```tsx
  it('offers Lesson planning only in the live booth', () => {
    expect(render(stateWithPlan())).toContain('>Lesson planning</button>');
    expect(html(<TeacherScreen frame={teacherFrame([{ at: PAST, type: 'greeting' }], 10)} />)).not.toContain('>Lesson planning</button>');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/teacher/planningModel.test.tsx src/teacher/planning.dom.test.tsx src/teacher/live.test.tsx`
Expected: FAIL: `upcomingLectures is not a function`; there is no "Lesson planning" button (`Cannot read properties of undefined (reading 'click')`); the live render has no `>Lesson planning</button>`. The Task 4 chip test still passes.

- [ ] **Step 3: The lecture lists**

`src/teacher/planningModel.ts`: replace

```ts
import type { ConceptId } from '../scenario/knowledgeGraph';
```

with

```ts
import { LECTURES, lectureOf, nextLecture, type Lecture } from '../scenario/course';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { resourcesFor } from '../scenario/materials';
```

and append:

```ts

const covers = (l: Lecture, concept: ConceptId) => resourcesFor(l.n).some((r) => r.concepts.includes(concept));

/** The next lecture and the two after it. With a concept, those of them whose materials cover it, plus the lecture that taught it; in lecture order. */
export function upcomingLectures(day: number, time: string, concept: ConceptId | null): Lecture[] {
  const next = nextLecture(day, time);
  const three = next ? LECTURES.slice(next.n - 1, next.n + 2) : [];
  if (!concept) return three;
  const taught = lectureOf(concept);
  return LECTURES.filter((l) => l === taught || (three.includes(l) && covers(l, concept)));
}

/** The lectures already held, newest first, without any listed by `upcomingLectures`; with a concept, only those whose materials cover it. */
export function pastLectures(day: number, time: string, concept: ConceptId | null): Lecture[] {
  const next = nextLecture(day, time);
  const shown = upcomingLectures(day, time, concept);
  return LECTURES.filter((l) => (!next || l.n < next.n) && !shown.includes(l) && (!concept || covers(l, concept))).reverse();
}
```

(The Lecture 9 revision sheet covers every concept, so a selected concept always keeps Lecture 9 while it is upcoming.)

- [ ] **Step 4: Create `src/teacher/LessonPlanning.tsx`**

```tsx
import { useState } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { fullDate, type Lecture } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
import { resourceById } from '../scenario/materials';
import { ConceptGraph } from './ConceptGraph';
import { MasteryChart } from './MasteryChart';
import { Eyebrow } from './parts';
import { DEFAULT_CONCEPT, masterySeries, pastLectures, planMarkers, upcomingLectures } from './planningModel';
import { ResourceList } from './ResourceList';

const TOGGLE = 'rounded-full border border-egg-line px-3 py-1 text-[12.5px] text-egg-ink hover:border-egg-ink';

/** The coming lectures in one place: the class's concepts, how they moved over the term, and each lecture's materials with who has used them. Live only and a view only: it posts nothing and costs no tokens. */
export function LessonPlanning() {
  const live = useLive();
  const [selected, setSelected] = useState<ConceptId | null>(null);
  // A chip for a past lecture's resource opens with the past lectures showing, so its row is on screen.
  const [showPast, setShowPast] = useState(() => {
    const r = live?.planningResource ? resourceById(live.planningResource) : undefined;
    return !!(live && r && pastLectures(live.state.day, fmt(live.state.clock), null).some((l) => l.n === r.lecture));
  });
  if (!live) return null;
  const { state } = live;
  const time = fmt(state.clock);
  const concept = selected ?? DEFAULT_CONCEPT;
  const label = conceptById(concept).label;
  const upcoming = upcomingLectures(state.day, time, selected);
  const past = pastLectures(state.day, time, selected);

  const lecture = (l: Lecture) => (
    <section key={l.n} data-lecture={l.n} className="mt-5">
      <div className="flex items-baseline gap-3">
        <h4 className="font-serif text-[22px] leading-none">{`Lecture ${l.n} · ${l.title}`}</h4>
        <span className="text-[12.5px] text-egg-mute">{fullDate(l.day)}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{l.concepts.length ? l.concepts.map((c) => conceptById(c).label).join(' · ') : 'Revision of the whole course'}</div>
      <div className="mt-2"><ResourceList lecture={l.n} initialOpen={live.planningResource} /></div>
    </section>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-8 pb-10 pt-6">
        <Eyebrow>Discrete Mathematics · DM-2026</Eyebrow>
        <section data-section="graph" className="mt-3">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 className="font-serif text-[26px] leading-none">Knowledge graph</h3>
            <span className="text-[12px] text-egg-mute">{selected ? `Showing ${label} · click it again to clear` : 'Class average mastery · click a concept to focus'}</span>
          </div>
          <div className="mt-3"><ConceptGraph state={state} selected={selected} onSelect={setSelected} /></div>
        </section>

        <section data-section="chart" className="mt-8">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 data-chart-title className="font-serif text-[26px] leading-none">{`Mastery over time · ${label}`}</h3>
            <span className="text-[12px] text-egg-mute">{selected ? 'Class average, 0 to 1' : 'Class average, 0 to 1 · the Week 6 topic'}</span>
          </div>
          <div className="mt-3"><MasteryChart concept={concept} label={label} points={masterySeries(state, concept)} markers={planMarkers(state)} /></div>
        </section>

        <section data-section="lectures" className="mt-8">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 className="font-serif text-[26px] leading-none">Upcoming lectures</h3>
            {selected && <span className="text-[12px] text-egg-mute">{`Lectures with material on ${label}`}</span>}
          </div>
          {upcoming.length ? upcoming.map(lecture) : <div className="mt-4 text-[14px] text-egg-mute">No lectures are left.</div>}
          <div className="mt-6">
            <button type="button" aria-expanded={showPast} onClick={() => setShowPast(!showPast)} className={TOGGLE}>
              {showPast ? 'Hide past lectures' : 'Past lectures'}
            </button>
          </div>
          {showPast && (past.length ? past.map(lecture) : <div className="mt-4 text-[14px] text-egg-mute">{selected ? `No other past lecture has material on ${label}.` : 'No lectures yet.'}</div>)}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: The screen and the sidebar**

`src/teacher/TeacherScreen.tsx`: after `import { GREETING, type FrameMsg, type TeacherFrame, type View } from './frame';` add

```ts
import { LessonPlanning } from './LessonPlanning';
```

Replace

```ts
  const title = view === 'classroom' ? 'Classroom' : view === 'calendar' ? 'Calendar' : frame.title ?? 'New conversation';
```

with

```ts
  const title = view === 'classroom' ? 'Classroom' : view === 'calendar' ? 'Calendar' : view === 'planning' ? 'Lesson planning' : frame.title ?? 'New conversation';
```

Replace

```tsx
        ) : view === 'calendar' ? (
          <Calendar />
        ) : empty ? (
```

with

```tsx
        ) : view === 'calendar' ? (
          <Calendar />
        ) : view === 'planning' ? (
          <LessonPlanning />
        ) : empty ? (
```

In `Sidebar`, replace

```tsx
        {live && nav('calendar', 'Calendar')}
```

with

```tsx
        {live && nav('calendar', 'Calendar')}
        {live && nav('planning', 'Lesson planning')}
```

- [ ] **Step 6: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher`
Expected: PASS, with `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` unchanged (the scripted sidebar has no Lesson planning item). The existing click-audit scenarios click the new sidebar item too; it switches the view, so they pass.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/LessonPlanning.tsx src/teacher/planningModel.ts src/teacher/TeacherScreen.tsx src/teacher/planningModel.test.tsx src/teacher/planning.dom.test.tsx src/teacher/live.test.tsx
git commit -m "feat(teacher): a live Lesson planning tab: knowledge graph, mastery over time and upcoming lectures with their materials

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Click audit, L2.8, full verification and spec touch-up

**Files:**
- Modify: `src/teacher/liveAudit.test.tsx` (`SCENARIOS`)
- Modify: `server/evals/cases.ts` (imports; new L2.8 after L2.7)
- Modify: `docs/superpowers/specs/2026-11-01-lesson-planning-design.md` (§2.1, §2.2, §2.3, §3.3, §5, §6 wording to match the build)

**Interfaces:**
- Consumes: `RESOURCES` (Task 1); `citableIds` (Task 3); the tab (Task 8); the harness's `t.ask`, `t.check`, `t.noPronouns`.

- [ ] **Step 1: Extend the click audit**

In `src/teacher/liveAudit.test.tsx`, add to `SCENARIOS`, after `['calendar with Lecture 6 open', …]`:

```ts
  ['lesson planning', async (el) => click(byText(el, 'Lesson planning'))],
  ['lesson planning with past lectures and a resource open', async (el) => {
    await click(byText(el, 'Lesson planning'));
    await click(byText(el, 'Past lectures'));
    await click(el.querySelector('[data-resource="l6-worksheet"] > button')!);
  }],
```

Run: `npx vitest run src/teacher/liveAudit.test.tsx`
Expected: PASS (the two new scenarios take about 0.5 s and 1.5 s). A failure names the button that "did nothing": make it change the page or remove it. (Graph nodes toggle the selection, resource rows toggle their expansion, names open the pop-up, the past-lectures button toggles; the `aria-current` sidebar item is skipped by `skip`.)

- [ ] **Step 2: Add L2.8**

`server/evals/cases.ts`: replace

```ts
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { evidenceIds } from '../agents/sas';
```

with

```ts
import { RESOURCES } from '../../src/scenario/materials';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { citableIds, evidenceIds } from '../agents/sas';
```

Append to `CASES`, after L2.7:

```ts
  { id: 'L2.8', level: 2, title: 'Recommends reading from the library', run: async (t) => {
    const a = await t.ask('What should students read before Lecture 7?', null, 'Diagnose');
    t.check('Diagnose', 'read the learning materials', a.steps.some((s) => s.includes('materials')), a.steps.join(' | '));
    const library = new Set(RESOURCES.map((r) => r.id));
    t.check('Diagnose', 'cites resources from the library', a.cites.some((c) => library.has(c)), a.cites.join(','));
    t.check('Diagnose', 'every cited id exists', a.cites.every((c) => citableIds(t.state).has(c)), a.cites.join(','));
    t.check('Diagnose', 'puts no link in the answer', !/https?:\/\/|www\.|\.(com|org|edu|net)\b/i.test(a.answer), a.answer);
    t.noPronouns('Diagnose', a.answer);
  } },
```

- [ ] **Step 3: Record the build in the spec**

In `docs/superpowers/specs/2026-11-01-lesson-planning-design.md`, make these replacements (each "replace" text is one whole line of the spec).

§2.1, in the code block, replace

```
type Bloom = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate';
```

with

```
type ResourceBloom = Exclude<Bloom, 'Create'>;   // course.ts Bloom without Create
```

replace

```
  concepts: ConceptId[];     // a subset of that lecture's concepts
```

with

```
  concepts: ConceptId[];     // a subset of that lecture's concepts; the Lecture 9 revision sheet covers all 12
```

and replace

```
  bloom: Bloom;
```

with

```
  bloom: ResourceBloom;
```

In §2.1's first bullet, replace the words `That makes about 30 resources.` with `That makes 29 resources.`

§2.2, replace the two signature lines

```
export function engagement(resourceId: string, studentIndex: number): { opened: boolean; fraction: number };   // fraction 0–1
export function classEngagement(resourceId: string): { opened: number; of: number; meanFraction: number };
```

with

```
export function engagement(resourceId: string, studentIndex: number, today = START_DAY): { opened: boolean; fraction: number };   // fraction 0–1
export function classEngagement(resourceId: string, today = START_DAY): { opened: number; of: number; meanFraction: number };   // meanFraction among those who opened it
```

replace

```
- Resources for lectures after today have no engagement (nobody opened them yet). `classEngagement` reports 0 of 55.
```

with

```
- A student opens a resource from the day after its lecture, up to 4 days late, so engagement fills in as the story moves on. Resources for lectures after today have no engagement (nobody opened them yet). `classEngagement` reports 0 of 55.
```

and replace

```
- Minh Anh: the Lecture 5 recording is opened, 22% watched, as in the video.
```

with

```
- Minh Anh: the Lecture 5 recording is opened, 22% watched, as in the video; nothing from Lecture 6 (the LMS log's last login was 6 days before day 40).
```

§2.3, replace

```
export function seededHistory(students: StudentProfile[]): Record<ConceptId, { day: number; value: number }[]>;   // weekly, days 0–35
```

with

```
export function seededHistory(students: StudentProfile[]): Record<ConceptId, { day: number; value: number }[]>;   // weekly, days 0–35, and day 40
```

replace

```
- **Seeded, Weeks 1–6:** one point per week per concept. A concept sits at 0.20 before its lecture and rises linearly over the two weeks after it to the class's seed average for that concept.
```

with

```
- **Seeded, Weeks 1–6:** one point per week per concept, and a last point on day 40 that meets the live line. A concept sits at 0.20 before its lecture and rises linearly to the class's seed average for that concept, reached two weeks after the lecture or on day 40, whichever is first. The chart computes it from the seed roster, so the past never moves.
```

and replace

```
- **Live, from day 40:** `advance` calls `noteClassMastery` at each day's close, after forgetting. Practice and forgetting on the phone therefore move the line slightly.
```

with

```
- **Live, from day 40:** `advance` calls `noteClassMastery` at each day's close, after forgetting, stamped with the new day as the forecast points are (the first live point is day 41). A concept not lectured yet stays at 0.20. Practice and forgetting on the phone therefore move the line slightly.
```

§3.3, replace

```
- Clicking a resource row expands it into the students who have not opened it, each name opening the profile pop-up (`openProfile`).
```

with

```
- Clicking a resource row expands it into the students who have not opened it, each name opening the profile pop-up (`openProfile`). Before its lecture the row instead says nobody can open it yet.
```

§5, in the first bullet, replace the sentence

```
It returns the matching resources with id, lecture, kind, title, concepts, Bloom level, minutes, source and class engagement; with a student id, each resource also carries that student's `opened` and `fraction`.
```

with

```
It returns the matching resources with id, lecture and its date, kind, title, concepts, Bloom level, minutes, source, `released` and `classEngagement`; with a student id, each resource also carries that student's `opened` and `fraction`.
```

§6, replace

```
- A concept with no lecture yet has no resources and no "not opened" list.
```

with

```
- A lecture not given yet has no engagement: its rows read "Not released yet" and expand to a note instead of a "not opened" list.
```

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all clean (611 tests when checked while planning). Then the free control eval, to check the graders still load:

Run: `npm run eval -- --offline --only L2.7,L2.8`
Expected: the run completes; the offline fallback fails most agent checks (normal for the control run). Do not commit the report it writes under `docs/evals/`.

- [ ] **Step 5: Real-API evals (ask the user first: this costs money)**

Ask the user before running. Two Level 2 questions cost a few cents.

Run: `npm run eval -- --only L2.7,L2.8`
Expected: L2.7 passes as before; L2.8 passes: the steps include "reading the materials for Lecture 7" (or "the learning materials"), the answer cites library ids such as `l6-reading` or `l7-slides`, every cited id exists and there is no link. Report the new results file path under `docs/evals/` to the user, and do not commit eval outputs unless the user asks.

- [ ] **Step 6: Run the booth and look**

Run: `npm run booth`, then check by hand:
1. Teacher sidebar: Chat, Classroom, Calendar, Lesson planning. Open Lesson planning: the graph shows 12 nodes with class averages, Equivalence laws greyed "Lecture 7 · Tue 3 Nov" and Applications "Lecture 8 · Tue 10 Nov"; the chart shows logical equivalence at 0.20 until Lecture 6, then the class average on day 40, with the dashed 0.50 line and L1–L9 ticks.
2. Click Implication: the chart switches to Implication and the lectures list Lecture 5 and Lecture 9; click it again to clear.
3. Under Lecture 7 every row reads "Not released yet". Open "Past lectures", click "Lecture 5 recording": "31 of 55 opened · 46% watched on average", and 24 names; a name opens that student's pop-up. The story date in the header does not change.
4. Calendar: "‹ Prev week", open Lecture 5: its materials list above the student questions.
5. Ask "What should students read before Lecture 7?": the answer's chips read like "Reading · Lecture 6"; clicking one opens Lesson planning with that row expanded.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/liveAudit.test.tsx server/evals/cases.ts docs/superpowers/specs/2026-11-01-lesson-planning-design.md
git commit -m "test: audit Lesson planning, add L2.8 (readings before Lecture 7), spec matches the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
