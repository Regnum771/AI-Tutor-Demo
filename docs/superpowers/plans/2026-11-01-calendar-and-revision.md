# Calendar, Weekly Revision and Phone Facts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie the app to the course's fixed calendar: revision only uses lectured concepts and is re-picked each Monday, idle weeks cost mastery, the teacher hears when a student stops practising, the phone shows facts instead of a risk band, and the live teacher gets a Calendar tab.

**Architecture:** `taughtBy` in `src/scenario/course.ts` is the single rule for "lectured by this day"; both planners and a new pure `refocus` (`src/live/study/refocus.ts`) use it. A pure `forget` (`src/live/study/forgetting.ts`) runs with `refocus` inside `advance` whenever the story reaches a Monday. `stoppedPractising` reuses the disengagement rule in `signals.ts` and feeds the teacher's Today list, the Road to the exam panel, the profile chart and `get_exam_outlook`. The phone's `TodayView` swaps band and forecast for facts. The calendar is a pure model (`src/teacher/calendar.ts`) rendered by a live-only view (`src/teacher/Calendar.tsx`) behind a new `'calendar'` value of `View`.

**Tech Stack:** TypeScript, React 18, Tailwind, Vitest (+ happy-dom for click tests), Hono server, Anthropic SDK agents.

Spec: `docs/superpowers/specs/2026-11-01-calendar-and-revision-design.md`.

## Global Constraints

- Day 0 is Monday 21 September; a Monday is `day % 7 === 0`. `START_DAY` 40, `EXAM_DAY` 64, `REVISION_START` 56. Lectures are Tuesdays 09:00–11:00 (`LECTURES`).
- A lecture's concepts count as taught from 09:00 on its day (`taughtBy(day)`, default time `'09:00'`). Neither planner schedules a concept before that.
- Refocus runs only when the story reaches a Monday, only for the student on the phone, only on plan days `weekStart`…`weekStart + 6`. It keeps minutes, `reason`, `createdDay`, `leftOut` and `source`; picks up to 2 concepts, prerequisites first; it is not a replan and adds nothing to `replans`.
- Forgetting: 0.02 mastery per concept with no attempt in the 7 days before the Monday, floor 0.25 (a concept already below 0.25 is untouched); only students with a study record; it runs before refocus.
- `stoppedPractising` is the existing disengagement rule (three planned days with nothing done, or under 25% of planned minutes over 7 days) and returns `{ done, planned }` for the last 7 closed days, or null.
- Teacher alert = a Today row, a Road to the exam line, a "Stopped" chart marker on each `disengaged` replan day, and `practisedLast7Days` in `get_exam_outlook`. No chat message, no tokens.
- The phone shows no band and no forecast; it must not show "Likely", "At risk", "Unlikely" or "out of 10". The teacher keeps the forecast, the bands, "May not pass" and the chart.
- Quiz and assessment marks stay percentages.
- New teacher UI is live-only (`useLive()` non-null). The scripted video must render exactly as before: `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` pass unchanged.
- No new agent runs or tokens except the existing signal replans. Browsing the calendar never advances the story and posts nothing.
- Copy never assumes anyone's pronouns.
- Every commit ends with `Co-Authored-By: <the model that actually writes the commit> <noreply@anthropic.com>`; the commands below show `Claude Opus 5.5`, so replace it if another model writes the commit.
- Stage only the files each task names. Never stage the unrelated working-tree changes (deleted `.env.local.example`, `.env.local copy.example`, `docs/superpowers/specs/2026-11-01-quiz-attempts-review-design.md`, existing `docs/evals/` outputs).
- Test command: `npx vitest run <path>`; types: `npm run typecheck`.

---

### Task 1: Taught concepts, and both planners respect them

**Files:**
- Modify: `src/scenario/course.ts` (append after `lectureLabel`)
- Modify: `server/agents/study.ts:6` (imports), `:33-43` (`STUDY_SYSTEM` rules), `:65-73` (`studyPlanProblems` day loop), `:115-136` (`studyMessages` calendar and lines)
- Modify: `server/agents/cannedStudy.ts` (whole file)
- Modify: `server/agents/samples.ts:3,50-59` (`studyInput`)
- Test: `src/scenario/course.test.ts`, `server/agents/study.test.ts`

**Interfaces:**
- Produces (in `src/scenario/course.ts`):
  - `taughtBy(day: number, time?: string): ConceptId[]` (time defaults to `'09:00'`)
  - `lectureOf(concept: ConceptId): Lecture`
  - `nextLecture(day: number, time: string): Lecture | null`
  - `isAssignment(a: Assessment): boolean`
  - `nextTest(today: number): Assessment | null` (next quiz or the exam; assignments are not tests)
  - `nextAssignment(today: number): Assessment | null`
- Produces: `studyPlanProblems` reports `"Day 41: Equivalence laws is not taught until Lecture 7 on Tue 3 Nov."`; `studyMessages` gains the lines `Lectures so far: … Next lecture: …` and `Next assessment: Quiz 3 on Thu 12 Nov, covering CLO2, CLO3.`; `cannedStudyPlan` only uses `taughtBy(day)`; `studyInput` (test sample) only uses lectured concepts.

- [ ] **Step 1: Write the failing tests**

In `src/scenario/course.test.ts`, replace the import on line 2 with:

```ts
import { ASSESSMENTS, CLOS, EXAM_DAY, LECTURES, REVISION_START, START_DAY, cloOf, fullDate, lectureBefore, lectureLabel, lectureOf, nextAssessment, nextAssignment, nextLecture, nextTest, relativeDay, resolveDay, shortDate, studyDays, taughtBy, weekOf } from './course';
```

and append:

```ts
describe('what has been taught', () => {
  it('counts a lecture from 09:00 on its day', () => {
    expect(taughtBy(43, '08:59')).not.toContain('equivLaws');
    expect(taughtBy(43, '09:00')).toContain('equivLaws');
    expect(taughtBy(43)).toContain('equivLaws');
    expect(taughtBy(42)).not.toContain('equivLaws');
    expect(taughtBy(0)).toEqual([]);
    expect(taughtBy(1)).toEqual(['propositions']);
    expect(taughtBy(40)).toEqual(['propositions', 'negation', 'conjunction', 'disjunction', 'truthTables', 'biconditional', 'expressions', 'implication', 'equivalence', 'deMorgan']);
    expect(taughtBy(50)).toHaveLength(12);
  });
  it('finds each concept’s lecture, the next lecture, the next test and the next assignment', () => {
    expect(lectureOf('equivLaws')).toMatchObject({ n: 7, day: 43 });
    expect(nextLecture(40, '15:00')?.n).toBe(7);
    expect(nextLecture(43, '07:30')?.n).toBe(7);
    expect(nextLecture(43, '09:00')?.n).toBe(8);
    expect(nextLecture(57, '10:00')).toBeNull();
    expect(nextTest(40)).toMatchObject({ id: 'quiz3', day: 52, clos: ['CLO2', 'CLO3'] });
    expect(nextTest(53)?.id).toBe('exam');
    expect(nextAssignment(40)?.id).toBe('a2');
    expect(nextAssignment(47)).toBeNull();
  });
});
```

In `server/agents/study.test.ts`, change line 8 to:

```ts
import { CLOS, EXAM_DAY, studyDays, taughtBy } from '../../src/scenario/course';
```

Add inside `describe('study plan checks', …)` after `it('rejects a concept outside the day’s CLO, and more than 3 concepts', …)`:

```ts
  it('rejects a concept before its lecture, naming the lecture and its date', () => {
    const s = ready();
    const early = days(s);
    early[1] = { ...early[1], clo: 'CLO2', concepts: ['equivLaws'] };
    expect(check(s, studyInput(s, 's17', { days: early }))).toMatchObject({ ok: false, error: expect.stringContaining('Day 41: Equivalence laws is not taught until Lecture 7 on Tue 3 Nov.') });
    const onTheDay = days(s);
    onTheDay[3] = { ...onTheDay[3], clo: 'CLO2', concepts: ['equivLaws'] };
    expect(check(s, studyInput(s, 's17', { days: onTheDay })).ok).toBe(true);
  });
```

In `it('rejects a near-empty plan unless it says what is dropped', …)`, replace

```ts
      const clo = CLOS[d.day % 3];
```

with

```ts
      // CLO3 is not lectured until day 50, so earlier CLO3 days take CLO1.
      const clo = d.day < 50 && d.day % 3 === 2 ? CLOS[0] : CLOS[d.day % 3];
```

Add inside `describe('offline planner', …)`:

```ts
  it('never schedules a concept before its lecture, and holds CLO3 until Lecture 8', () => {
    for (const day of [40, 43, 49, 50]) {
      const s = ready();
      s.day = day;
      const plan = cannedStudyPlan(s, 's17', 'setup');
      for (const d of plan.days) for (const c of d.concepts) expect(taughtBy(d.day), `day ${d.day} ${c}`).toContain(c);
      expect(plan.days.filter((d) => d.day < 50).every((d) => d.clo !== 'CLO3')).toBe(true);
    }
  });
```

Add inside `describe('the prompt', …)`:

```ts
  it('states the lecture rule, the lectures so far, the next lecture and the next assessment', () => {
    expect(STUDY_SYSTEM).toContain('Use only concepts already lectured by that day');
    const text = String(studyMessages(ready(), 's17', 'setup')[0].content);
    expect(text).toContain('Lectures so far: 1–6 (latest: Lecture 6 · Logical equivalence and De Morgan, Tue 27 Oct). Next lecture: Lecture 7 · Equivalence laws, Tue 3 Nov.');
    expect(text).toContain('Next assessment: Quiz 3 on Thu 12 Nov, covering CLO2, CLO3.');
    expect(text).toContain('43 · Tue 3 Nov: 30 min available · Lecture 7 (equivLaws)');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/scenario/course.test.ts server/agents/study.test.ts`
Expected: FAIL: `taughtBy`, `lectureOf`, `nextLecture`, `nextTest`, `nextAssignment` are not exported; the untaught-concept and prompt tests fail; the offline planner schedules `applications` on day 41 and `equivLaws` on day 40.

- [ ] **Step 3: Add the course helpers**

Append to `src/scenario/course.ts` (after `lectureLabel`, so `minutesOf` and `LECTURE_START` are in scope):

```ts
/** Concepts of every lecture held by `time` on `day`. A lecture counts from 09:00, so a plan day counts its own lecture. */
export function taughtBy(day: number, time = '09:00'): ConceptId[] {
  const last = lectureBefore(day, time);
  return last ? LECTURES.filter((l) => l.n <= last.n).flatMap((l) => l.concepts) : [];
}

/** The lecture that teaches `concept`. Every concept has one. */
export const lectureOf = (concept: ConceptId): Lecture => LECTURES.find((l) => l.concepts.includes(concept))!;

/** The next lecture that has not started by `time` on `day`, or null after the last. */
export function nextLecture(day: number, time: string): Lecture | null {
  const t = minutesOf(time);
  return LECTURES.find((l) => l.day > day || (l.day === day && t < LECTURE_START)) ?? null;
}

export const isAssignment = (a: Assessment): boolean => a.title.startsWith('Assignment');

/** The next quiz or the final exam, on or after `today`. Assignments are not tests. */
export const nextTest = (today: number): Assessment | null => ASSESSMENTS.find((a) => a.day >= today && !isAssignment(a)) ?? null;

/** The next assignment due on or after `today`. */
export const nextAssignment = (today: number): Assessment | null => ASSESSMENTS.find((a) => a.day >= today && isAssignment(a)) ?? null;
```

- [ ] **Step 4: The agent's check and prompt**

`server/agents/study.ts` line 6 becomes:

```ts
import { ASSESSMENTS, CLOS, EXAM_DAY, LECTURES, lectureBefore, nextLecture, nextTest, shortDate, studyDays, taughtBy, weekOf } from '../../src/scenario/course';
```

In `STUDY_SYSTEM`, after the line `- Each entry names one learning outcome (CLO) and 1 to 3 of that CLO's concepts.` add:

```
- Use only concepts already lectured by that day. A lecture's concepts can be used from the day it is given; the calendar marks each lecture.
```

In `studyPlanProblems`, inside `for (const d of plan.days) { … }`, after the line `if (d.concepts.some((c) => !clo?.concepts.includes(c))) out.push(\`Day ${d.day} has a concept outside ${d.clo}.\`);` add:

```ts
    const taught = taughtBy(d.day);
    for (const c of d.concepts) {
      const lecture = LECTURES.find((l) => l.concepts.includes(c));
      if (lecture && !taught.includes(c)) out.push(`Day ${d.day}: ${conceptById(c).label} is not taught until Lecture ${lecture.n} on ${shortDate(lecture.day)}.`);
    }
```

(An id that is not a concept at all is already reported by the "outside" check, so it is skipped here.)

In `studyMessages`, replace the `calendar` constant:

```ts
  const calendar = studyDays(state.day).map((d) => {
    const parts = [`${d} · ${shortDate(d)}${weekOf(d) === 9 ? ' (revision week)' : ''}: ${capacityLeft(state, studentId, d)} min available`];
    if (teacher[d]) parts.push(`teacher session takes ${teacher[d]} min`);
    const a = ASSESSMENTS.find((x) => x.day === d);
    if (a) parts.push(`${a.title} on ${a.clos.join(', ')}`);
    return parts.join(' · ');
  });
```

with

```ts
  const calendar = studyDays(state.day).map((d) => {
    const parts = [`${d} · ${shortDate(d)}${weekOf(d) === 9 ? ' (revision week)' : ''}: ${capacityLeft(state, studentId, d)} min available`];
    const l = LECTURES.find((x) => x.day === d);
    if (l) parts.push(`Lecture ${l.n} (${l.concepts.join(', ') || 'revision'})`);
    if (teacher[d]) parts.push(`teacher session takes ${teacher[d]} min`);
    const a = ASSESSMENTS.find((x) => x.day === d);
    if (a) parts.push(`${a.title} on ${a.clos.join(', ')}`);
    return parts.join(' · ');
  });
  const held = lectureBefore(state.day, '09:00');
  const coming = nextLecture(state.day, '09:00');
  const test = nextTest(state.day);
```

and in `lines`, directly after the `` `Forecast: … The final exam is on ${shortDate(EXAM_DAY)}.` `` entry, add:

```ts
    `${held ? `Lectures so far: ${held.n === 1 ? '1' : `1–${held.n}`} (latest: Lecture ${held.n} · ${held.title}, ${shortDate(held.day)}).` : 'No lectures yet.'} ${coming ? `Next lecture: Lecture ${coming.n} · ${coming.title}, ${shortDate(coming.day)}.` : 'No lectures are left.'}`,
    ...(test ? [`Next assessment: ${test.title} on ${shortDate(test.day)}, covering ${test.clos.join(', ')}.`] : []),
```

- [ ] **Step 5: The offline planner**

Replace `server/agents/cannedStudy.ts` with:

```ts
import { capacityLeft, shortOfTime } from '../../src/live/study/capacity';
import { cloMastery, minutesNeeded, TARGET_MASTERY as TARGET } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan } from '../../src/live/types';
import { CLOS, EXAM_DAY, nextAssessment, nextTest, shortDate, studyDays, taughtBy, weekOf, type Clo, type CloId } from '../../src/scenario/course';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';

const MAINTENANCE = 10; // minutes a day that keep a strong student's practice alive
const NEED_MARGIN = 1.2;

const REASON: Record<ReplanSignal, (focus: string, exam: string) => string> = {
  setup: (focus, exam) => `This plan works back from the exam on ${exam}, with the most time on ${focus}.`,
  markSwing: (focus) => `Your latest mark changed the picture, so more time now goes to ${focus}.`,
  disengaged: (focus) => `The last few days were quieter, so this plan is lighter and stays on ${focus}.`,
  bandChange: (focus) => `Your exam outlook changed, so more time now goes to ${focus}.`,
  teacherPlan: (focus) => `Your lecturer sent you a plan, so your own study now fits around it, with the rest on ${focus}.`,
};

/** Capacity shared out by exam share × gap, with Week 9 spread across the CLOs still below target. Each day uses only lectured concepts. */
export function cannedStudyPlan(state: DemoState, studentId: string, signal: ReplanSignal): StudyPlan {
  const student = state.students.find((s) => s.id === studentId)!;
  const weight = (c: Clo) => c.share * Math.max(0.05, TARGET - cloMastery(student, c.id));
  const total = CLOS.reduce((a, c) => a + weight(c), 0);
  const byWeight = [...CLOS].sort((a, b) => weight(b) - weight(a));
  const weak = byWeight.filter((c) => cloMastery(student, c.id) < TARGET);
  const given: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };
  const turns: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };

  const taughtIn = (c: Clo, day: number): ConceptId[] => {
    const taught = taughtBy(day);
    return c.concepts.filter((x) => taught.includes(x));
  };
  const pool = (c: Clo, day: number): ConceptId[] => {
    const taught = taughtIn(c, day);
    const low = taught.filter((x) => student.mastery[x] < TARGET);
    return [...(low.length ? low : taught)].sort((a, b) => student.mastery[a] - student.mastery[b]);
  };
  const concepts = (c: Clo, day: number): ConceptId[] => {
    const p = pool(c, day);
    const start = turns[c.id]++;
    return [...new Set(Array.from({ length: Math.min(2, p.length) }, (_, k) => p[(start + k) % p.length]))];
  };

  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  const scale = available ? Math.min(1, (minutesNeeded(student) * NEED_MARGIN) / available) : 0;
  const week9 = studyDays(state.day).filter((d) => weekOf(d) === 9 && capacityLeft(state, studentId, d) > 0);

  const days = studyDays(state.day).map((day) => {
    const left = capacityLeft(state, studentId, day);
    const minutes = Math.min(left, Math.max(MAINTENANCE, Math.round(left * scale)));
    const spent = Object.values(given).reduce((a, b) => a + b, 0) || 1;
    const soon = nextAssessment(day);
    const tested = soon && soon.day !== EXAM_DAY && soon.day - day <= 3 ? CLOS.filter((c) => soon.clos.includes(c.id) && cloMastery(student, c.id) < TARGET) : [];
    // A CLO waits until something in it has been lectured.
    const ready = (list: Clo[]) => list.filter((c) => taughtIn(c, day).length > 0);
    const open = ready(tested).length ? ready(tested) : ready(CLOS).length ? ready(CLOS) : CLOS;
    const behind = [...open].sort((a, b) => (weight(b) / total - given[b.id] / spent) - (weight(a) / total - given[a.id] / spent))[0];
    const chosen = weekOf(day) === 9 && weak.length && minutes > 0 ? weak[week9.indexOf(day) % weak.length] : behind;
    // A day whose CLO has nothing lectured yet takes a CLO the next test covers.
    const clo = taughtIn(chosen, day).length ? chosen : CLOS.find((c) => nextTest(day)?.clos.includes(c.id) && taughtIn(c, day).length > 0) ?? chosen;
    given[clo.id] += minutes;
    return { day, minutes, clo: clo.id, concepts: concepts(clo, day) };
  });

  // What loses out: the CLO with the lowest share of the time its concepts need (120 minutes per 1.0 of gap).
  const need = (c: Clo) => c.concepts.reduce((a, x) => a + Math.max(0, TARGET - student.mastery[x]), 0) * 120;
  const lossy = CLOS.filter((c) => need(c) > 0).sort((a, b) => given[a.id] / need(a) - given[b.id] / need(b))[0];

  return {
    createdDay: state.day,
    reason: REASON[signal](`“${byWeight[0].title}”`, shortDate(EXAM_DAY)),
    leftOut: shortOfTime(state, studentId) && lossy ? [`Full coverage of “${lossy.title}”: there is not enough time for all of it, so it gets less for now.`] : [],
    source: 'offline',
    days,
  };
}
```

- [ ] **Step 6: The test sample uses lectured concepts**

`server/agents/samples.ts` line 3 becomes:

```ts
import { CLOS, studyDays, taughtBy } from '../../src/scenario/course';
```

Replace `studyInput` with:

```ts
/** A valid propose_study_plan input for `state`: 10 minutes a day, each CLO in turn once it has been lectured. */
export const studyInput = (state: DemoState, studentId = 's17', over: Record<string, unknown> = {}): Record<string, unknown> => ({
  reason: 'Minh Anh starts with implication because the rest of the course depends on it.',
  left_out: [],
  days: studyDays(state.day).map((day) => {
    const clo = [CLOS[day % 3], ...CLOS].find((c) => taughtBy(day).includes(c.concepts[0])) ?? CLOS[0];
    return { day, minutes: Math.min(10, capacityLeft(state, studentId, day)), clo: clo.id, concepts: [clo.concepts[0]] };
  }),
  ...over,
});
```

- [ ] **Step 7: Run the tests**

Run: `npm run typecheck && npx vitest run src/scenario server/agents server/session.study.test.ts`
Expected: typecheck clean; all PASS. (Checked while planning: on day 40 the offline plan passes `studyPlanProblems` for every student at 10/15 and 30/60 minutes on days 40, 50 and 57, and gives Minh Anh CLO2 204 min > CLO1 88 min.)

- [ ] **Step 8: Commit**

```bash
git add src/scenario/course.ts src/scenario/course.test.ts server/agents/study.ts server/agents/cannedStudy.ts server/agents/samples.ts server/agents/study.test.ts
git commit -m "feat(study): plans only use concepts already lectured, and the agent hears the lecture calendar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Weekly refocus (pure)

**Files:**
- Create: `src/live/study/refocus.ts`
- Test: `src/live/study/rules.test.ts`

**Interfaces:**
- Consumes (Task 1): `taughtBy(day: number, time?: string): ConceptId[]`, `nextTest(today: number): Assessment | null`; existing `lectureBefore`, `CLOS`, `REVISION_START`, `CONCEPTS`.
- Produces: `refocus(plan: StudyPlan, student: StudentProfile, weekStart: number): StudyPlan` (in `src/live/study/refocus.ts`).

- [ ] **Step 1: Write the failing tests**

In `src/live/study/rules.test.ts`, change the imports:

```ts
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY, taughtBy, type CloId } from '../../scenario/course';
import { CONCEPTS, EDGES, type ConceptId } from '../../scenario/knowledgeGraph';
```

```ts
import type { DemoState, StudentProfile, StudyPlan } from '../types';
```

and add `import { refocus } from './refocus';` after the `./record` import. Append:

```ts
describe('weekly refocus', () => {
  const plan = (clo: (day: number) => CloId, concept: (day: number) => ConceptId): StudyPlan => ({
    createdDay: 40, reason: 'Kept.', leftOut: ['Something'], source: 'agents',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 10 + i, clo: clo(40 + i), concepts: [concept(40 + i)] })),
  });
  const FIRST: Record<CloId, ConceptId> = { CLO1: 'implication', CLO2: 'deMorgan', CLO3: 'applications' };
  const mixed = () => plan((d) => (d === 42 || d === 43 ? 'CLO2' : d === 44 ? 'CLO3' : 'CLO1'), (d) => FIRST[d === 42 || d === 43 ? 'CLO2' : d === 44 ? 'CLO3' : 'CLO1']);
  it('relies on CONCEPTS being listed prerequisites first', () => {
    const at = (c: ConceptId) => CONCEPTS.findIndex((x) => x.id === c);
    for (const [a, b] of EDGES) expect(at(a)).toBeLessThan(at(b));
  });
  it('changes only that week, keeps minutes and the reason, and leaves its input alone', () => {
    const before = mixed();
    const copy = structuredClone(before);
    const after = refocus(before, student(seedState()), 42);
    expect(before).toEqual(copy);
    expect(after.days.map((d) => d.minutes)).toEqual(before.days.map((d) => d.minutes));
    expect(after).toMatchObject({ createdDay: 40, reason: 'Kept.', leftOut: ['Something'], source: 'agents' });
    const outside = (p: StudyPlan) => p.days.filter((d) => d.day < 42 || d.day > 48);
    expect(outside(after)).toEqual(outside(before));
  });
  it('puts the newest lecture first, moves an unlectured CLO to the next test, then takes the weakest', () => {
    const days = refocus(mixed(), student(seedState()), 42).days;
    const on = (day: number) => days.find((d) => d.day === day)!;
    expect(on(42)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'deMorgan'] });
    expect(on(43)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'equivLaws'] });
    expect(on(44)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'equivLaws'] });
    expect(on(45)).toMatchObject({ clo: 'CLO1', concepts: ['implication', 'biconditional'] });
  });
  it('never picks an untaught concept or one outside the day’s CLO', () => {
    const st = student(seedState());
    for (const clo of ['CLO1', 'CLO2', 'CLO3'] as CloId[]) {
      let p = plan(() => clo, () => FIRST[clo]);
      for (const monday of [42, 49, 56, 63]) p = refocus(p, st, monday);
      for (const d of p.days.filter((x) => x.day >= 42)) {
        expect(d.concepts.length).toBeGreaterThan(0);
        expect(d.concepts.length).toBeLessThanOrEqual(2);
        for (const c of d.concepts) {
          expect(taughtBy(d.day), `day ${d.day}`).toContain(c);
          expect(CLOS.find((x) => x.id === d.clo)!.concepts).toContain(c);
        }
      }
      if (clo === 'CLO3') expect(p.days.filter((d) => d.day >= 42 && d.day < 50).every((d) => d.clo === 'CLO2')).toBe(true);
    }
  });
  it('spreads revision week over every taught concept, weakest first', () => {
    const days = refocus(plan(() => 'CLO1', () => 'implication'), student(seedState()), 56).days.filter((d) => d.day >= 56 && d.day <= 62);
    expect(days[0].concepts).toEqual(['implication', 'biconditional']);
    expect(new Set(days.flatMap((d) => d.concepts)).size).toBe(CLOS[0].concepts.length);
  });
  it('leaves a day before Lecture 1 as it is', () => {
    const early: StudyPlan = { createdDay: 0, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 0, minutes: 5, clo: 'CLO3', concepts: ['applications'] }] };
    expect(refocus(early, student(seedState()), 0).days).toEqual(early.days);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/live/study/rules.test.ts`
Expected: FAIL: cannot resolve `./refocus`.

- [ ] **Step 3: Implement**

Create `src/live/study/refocus.ts`:

```ts
import { CLOS, lectureBefore, nextTest, REVISION_START, taughtBy, type CloId } from '../../scenario/course';
import { CONCEPTS, type ConceptId } from '../../scenario/knowledgeGraph';
import type { StudentProfile, StudyPlan, StudyPlanDay } from '../types';

/** CONCEPTS is listed prerequisites first, so its order is a safe study order. */
const ORDER: ConceptId[] = CONCEPTS.map((c) => c.id);
const conceptsOf = (clo: CloId): ConceptId[] => CLOS.find((c) => c.id === clo)!.concepts;

/**
 * Re-picks one week of the plan (`weekStart` to `weekStart + 6`) from what has been lectured by each day: the newest
 * lecture's concepts first, then what the next test covers, then the weakest; up to 2, prerequisites first. Revision
 * week and the days before the exam spread over every taught concept, weakest first. Minutes, the reason and every
 * other day stay as they were. Not a replan. Pure.
 */
export function refocus(plan: StudyPlan, student: StudentProfile, weekStart: number): StudyPlan {
  const turns: Partial<Record<CloId, number>> = {};
  const weakest = (a: ConceptId, b: ConceptId) => student.mastery[a] - student.mastery[b];
  const refocusDay = (d: StudyPlanDay): StudyPlanDay => {
    if (d.day < weekStart || d.day > weekStart + 6) return d;
    const taught = taughtBy(d.day);
    const has = (clo: CloId) => conceptsOf(clo).some((c) => taught.includes(c));
    const test = nextTest(d.day);
    const clo = has(d.clo) ? d.clo : test?.clos.find(has) ?? CLOS.map((c) => c.id).find(has);
    if (!clo) return d; // before Lecture 1
    const pool = conceptsOf(clo).filter((c) => taught.includes(c));
    let picked: ConceptId[];
    if (d.day >= REVISION_START) {
      const sorted = [...pool].sort(weakest);
      const k = (turns[clo] = (turns[clo] ?? -1) + 1);
      picked = [...new Set([sorted[k % sorted.length], sorted[(k + 1) % sorted.length]])];
    } else {
      const newest = lectureBefore(d.day, '09:00')?.concepts ?? [];
      const tested = test ? test.clos.flatMap((c) => conceptsOf(c)) : [];
      const rank = (c: ConceptId) => (newest.includes(c) ? 0 : tested.includes(c) ? 1 : 2);
      picked = [...pool].sort((a, b) => rank(a) - rank(b) || weakest(a, b)).slice(0, 2);
    }
    return { ...d, clo, concepts: picked.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) };
  };
  return { ...plan, days: plan.days.map(refocusDay) };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run src/live/study/rules.test.ts`
Expected: PASS. (Minh Anh's seed: implication 0.31, biconditional 0.35, equivalence 0.35, equivLaws 0.38, deMorgan 0.40; the figures above were checked with a script while planning.)

- [ ] **Step 5: Commit**

```bash
git add src/live/study/refocus.ts src/live/study/rules.test.ts
git commit -m "feat(study): weekly refocus re-picks a week's concepts from the lectures, by rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Forgetting, and Monday runs forget then refocus

**Files:**
- Create: `src/live/study/forgetting.ts`
- Modify: `src/live/study/reducer.ts` (imports, `advance` loop, new `weekTurn`)
- Modify: `server/session.study.test.ts:220-232` (a failed replan keeps the plan)
- Modify: `server/evals/cases.ts:5,390-400` (L6.4)
- Test: `src/live/study/rules.test.ts`, `src/live/study/reducer.test.ts`

**Interfaces:**
- Consumes (Task 2): `refocus(plan: StudyPlan, student: StudentProfile, weekStart: number): StudyPlan`.
- Produces (in `src/live/study/forgetting.ts`): `FORGET_PER_WEEK = 0.02`, `FORGET_FLOOR = 0.25`, `forget(student: StudentProfile, rec: StudyRecord, today: number): void`.
- Produces: `advance` runs, on each Monday it reaches, `forget` for every student with a record (and updates their `status`), then `refocus` on the phone student's plan, then the day's forecast point.

- [ ] **Step 1: Write the failing tests**

In `src/live/study/rules.test.ts` add `import { forget } from './forgetting';` after the `./estimate` import, and append:

```ts
describe('forgetting', () => {
  const item = (c: ConceptId) => BANK.find((i) => i.concept === c)!;
  it('takes 0.02 a week off each concept not practised in the last 7 days, down to 0.25', () => {
    const { s, rec } = setup();
    const st = student(s);
    Object.assign(st.mastery, { applications: 0.26, equivLaws: 0.2 });
    rec.attempts.push({ itemId: item('implication').id, day: 38, correct: true, firstTry: true });
    rec.attempts.push({ itemId: item('biconditional').id, day: 34, correct: true, firstTry: true });
    forget(st, rec, 42);
    expect(st.mastery).toMatchObject({ implication: 0.31, biconditional: 0.33, negation: 0.68, propositions: 0.83, applications: 0.25, equivLaws: 0.2 });
  });
});
```

In `src/live/study/reducer.test.ts`, append:

```ts
describe('a new week', () => {
  const item = (concept: string) => BANK.find((i) => i.concept === concept)!;
  it('a Monday forgets once, then re-picks the week from the lectures', () => {
    const s = structuredClone(ready());
    Object.assign(s.students[16].mastery, { implication: 0.3, biconditional: 0.29, expressions: 0.295 });
    s.study.s17.attempts.push({ itemId: item('biconditional').id, day: 41, correct: true, firstTry: true });
    const after = ok(advance(s, 7, null)); // Saturday 40 → Saturday 47, through Monday 42
    expect(after.students[16].mastery).toMatchObject({ negation: 0.68, implication: 0.28, biconditional: 0.29, expressions: 0.275 });
    const plan = after.study.s17.plan!;
    // Forgetting first: implication and expressions are now the two weakest; before it, biconditional was.
    expect(plan.days.find((d) => d.day === 42)?.concepts).toEqual(['implication', 'expressions']);
    expect(plan.days.find((d) => d.day === 49)?.concepts).toEqual(['implication']);
    expect(plan.days.map((d) => d.minutes)).toEqual(s.study.s17.plan!.days.map((d) => d.minutes));
    expect(plan.reason).toBe('r');
    expect(after.study.s17.replans).toEqual(s.study.s17.replans);
  });
  it('a day that is not a Monday neither forgets nor re-picks', () => {
    const s = ready();
    const after = ok(advance(s, 1, null)); // Saturday 40 → Sunday 41
    expect(after.students[16].mastery).toEqual(s.students[16].mastery);
    expect(after.study.s17.plan).toEqual(s.study.s17.plan);
  });
  it('forgets for every student with a record and leaves the rest alone', () => {
    const s = structuredClone(ready());
    ensureRecord(s, 's29');
    const after = ok(advance(s, 2, null)); // reaches Monday 42
    const of = (st: DemoState, id: string) => st.students.find((x) => x.id === id)!.mastery;
    expect(of(after, 's29')).toMatchObject({ propositions: 0.5, implication: 0.24 });
    expect(of(after, 's2')).toEqual(of(s, 's2'));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/live/study/rules.test.ts src/live/study/reducer.test.ts`
Expected: FAIL: cannot resolve `./forgetting`; once it exists, the `a new week` tests fail because `advance` does not forget or refocus yet.

- [ ] **Step 3: Implement forgetting**

Create `src/live/study/forgetting.ts`:

```ts
import type { ConceptId } from '../../scenario/knowledgeGraph';
import { itemById } from '../../scenario/practiceBank';
import type { StudentProfile, StudyRecord } from '../types';

/** Mastery a concept loses in a week without practice. */
export const FORGET_PER_WEEK = 0.02;
/** Forgetting stops here; a concept already below it is left alone. */
export const FORGET_FLOOR = 0.25;

/** A week's forgetting: every concept with no attempt in the 7 days before `today` loses 0.02, never below 0.25. Mutates `student.mastery`. */
export function forget(student: StudentProfile, rec: StudyRecord, today: number): void {
  const practised = new Set(rec.attempts.filter((a) => a.day >= today - 7 && a.day < today).map((a) => itemById(a.itemId)?.concept));
  for (const c of Object.keys(student.mastery) as ConceptId[]) {
    const m = student.mastery[c];
    if (practised.has(c) || m < FORGET_FLOOR) continue;
    student.mastery[c] = Math.max(FORGET_FLOOR, Math.round((m - FORGET_PER_WEEK) * 1000) / 1000);
  }
}
```

- [ ] **Step 4: Wire it into `advance`**

In `src/live/study/reducer.ts`, add after the `./estimate` import:

```ts
import { forget } from './forgetting';
```

and after the `./record` import:

```ts
import { refocus } from './refocus';
```

In `advance`, replace

```ts
    s.day += 1;
    noteForecast(rec, student, s.day);
```

with

```ts
    s.day += 1;
    if (s.day % 7 === 0) weekTurn(s, id);
    noteForecast(rec, student, s.day);
```

Add after `advance`:

```ts
/** A new week: forgetting for every student with a record, then the phone student's plan re-picked from the lectures. Mutates `s`. */
function weekTurn(s: DemoState, phoneId: string): void {
  for (const [id, rec] of Object.entries(s.study)) {
    const st = studentById(s, id)!;
    forget(st, rec, s.day);
    st.status = statusFor(st.mastery);
  }
  const rec = s.study[phoneId];
  if (rec.plan) rec.plan = refocus(rec.plan, studentById(s, phoneId)!, s.day);
}
```

- [ ] **Step 5: Tests that pinned an unchanged plan across a Monday**

`server/session.study.test.ts`, in `it('a failed replan keeps the plan and leaves the signal pending', …)`, replace

```ts
    expect(session.state.study.s17.plan).toEqual(plan);
```

with

```ts
    // Monday's refocus may re-pick the week's concepts; everything else stays.
    const kept = (p: typeof plan) => p && { ...p, days: p.days.map((d) => ({ day: d.day, minutes: d.minutes })) };
    expect(kept(session.state.study.s17.plan)).toEqual(kept(plan));
```

`server/evals/cases.ts` line 5 becomes:

```ts
import type { AssistantMsg, Plan, StudyPlan } from '../../src/live/types';
```

In L6.4, replace

```ts
    t.check('Oversee', 'the plan is untouched', JSON.stringify(planOf(t)) === JSON.stringify(plan));
```

with

```ts
    // Day 42 is a Monday: the refocus may re-pick concepts, but minutes and the reason stay.
    const kept = (p: StudyPlan | null) => JSON.stringify(p && { reason: p.reason, createdDay: p.createdDay, minutes: p.days.map((d) => d.minutes) });
    t.check('Oversee', 'the plan’s minutes and reason are untouched', kept(planOf(t)) === kept(plan));
```

- [ ] **Step 6: Run the tests**

Run: `npm run typecheck && npx vitest run src/live server/session.study.test.ts server/session.test.ts`
Expected: PASS. Any other test that compared a whole plan or a mastery map across a Monday fails only for this reason: compare the minutes and reason (or the untouched concept) instead. Any other failure is a real bug.

- [ ] **Step 7: Commit**

```bash
git add src/live/study/forgetting.ts src/live/study/reducer.ts src/live/study/rules.test.ts src/live/study/reducer.test.ts server/session.study.test.ts server/evals/cases.ts
git commit -m "feat(study): idle weeks cost mastery, and each Monday forgets then refocuses the week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Stopped practising reaches the teacher

**Files:**
- Modify: `src/live/study/signals.ts` (new `lastWeek`, `stoppedPractising`, `stoppedSince`)
- Modify: `src/live/study/outlook.ts` (`ExamOutlook.practisedLast7Days`)
- Modify: `server/agents/tools.ts:46` (`get_exam_outlook` description)
- Modify: `src/teacher/TeacherScreen.tsx:1-16` (imports), `:40-48` (`TODAY`, `EXAM_ROW`), after `liveFigures` (new `liveTodayRows`), `EmptyState` list and row
- Modify: `src/teacher/LivePanel.tsx:1-10` (imports), `RoadToExam`
- Modify: `src/teacher/StudentProfile.tsx:44-49` (`markers`)
- Test: `src/live/study/rules.test.ts`, `server/agents/tools.test.ts`, `src/teacher/live.test.tsx`, `src/teacher/livePanel.test.tsx`, `src/teacher/forecastChart.test.tsx`

**Interfaces:**
- Produces (in `src/live/study/signals.ts`):
  - `lastWeek(rec: StudyRecord, today: number): { done: number; planned: number }` (rounded minutes, all practice, last 7 closed days)
  - `stoppedPractising(rec: StudyRecord, today: number): { done: number; planned: number } | null`
  - `stoppedSince(rec: StudyRecord, today: number): number | null` (first day of the current stretch)
- Produces: `ExamOutlook.practisedLast7Days: { done: number; planned: number }`.
- Produces (in `src/teacher/TeacherScreen.tsx`): `interface AttentionRow { topic: ContextId; who: string; what: string; prompt?: string; figure?: string }`, `liveTodayRows(s: DemoState): AttentionRow[]`.

- [ ] **Step 1: Write the failing tests**

`src/live/study/rules.test.ts`: change the `./signals` import to

```ts
import { detectSignal, mayReplan, nextReplan, stoppedPractising, stoppedSince } from './signals';
```

and append:

```ts
describe('stopped practising', () => {
  const fresh = () => newRecord(student(seedState()));
  it('is null before any day has closed and while the student practises', () => {
    expect(stoppedPractising(fresh(), 40)).toBeNull();
    const r = fresh();
    for (let d = 33; d < 40; d++) r.days[d] = { planned: 20, done: 10, check: null };
    expect(stoppedPractising(r, 40)).toBeNull();
    expect(stoppedSince(r, 40)).toBeNull();
  });
  it('reports the last 7 days’ minutes and when the stretch began', () => {
    const r = fresh();
    for (const d of [36, 37, 38, 39, 40, 41]) r.days[d] = { planned: 30, done: d === 36 ? 12.5 : 0, check: null };
    expect(stoppedPractising(r, 42)).toEqual({ done: 13, planned: 180 });
    expect(stoppedSince(r, 42)).toBe(40);
  });
  it('matches the disengagement signal', () => {
    const patterns: [number, number][][] = [
      [[30, 0], [30, 0], [30, 0]],
      Array.from({ length: 7 }, () => [20, 4] as [number, number]),
      Array.from({ length: 7 }, () => [20, 6] as [number, number]),
      [[30, 0], [30, 0]],
    ];
    const stopped = patterns.map((p) => {
      const r = fresh();
      p.forEach(([planned, done], i) => { r.days[39 - i] = { planned, done, check: null }; });
      expect(stoppedPractising(r, 40) !== null).toBe(detectSignal(r, 40, 'At risk', null, null) === 'disengaged');
      return stoppedPractising(r, 40) !== null;
    });
    expect(stopped).toEqual([true, true, false, false]);
  });
});
```

`server/agents/tools.test.ts`, in `it('measures against the current plan, and lists marks', …)`, extend the second `toMatchObject`:

```ts
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({
      minutesPlanned: 40, minutesDone: 12, marks: [{ title: 'Quiz 3', mark: 22, date: 'Thu 12 Nov' }], practisedLast7Days: { done: 62, planned: 119 },
    });
    expect(READ_TOOLS.find((t) => t.name === 'get_exam_outlook')!.description).toContain('practisedLast7Days');
```

(replacing the existing `toMatchObject({ minutesPlanned: 40, … })` call; the `toContain('marks')` line stays.)

`src/teacher/live.test.tsx`: change line 11 to

```ts
import { liveTodayRows, TeacherScreen, type TeacherActions } from './TeacherScreen';
```

and add inside `describe('live teacher screen', …)`:

```ts
  it('adds a row for each student who has stopped practising, only while that lasts', () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    for (const d of [37, 38, 39]) rec.days[d] = { planned: 30, done: 0, check: null };
    expect(render(s, null)).toContain('Stopped practising · 0 of 90 min this week');
    expect(liveTodayRows(s).at(-1)).toMatchObject({ what: 'Minh Anh', figure: '0/90', prompt: 'Minh Anh has stopped practising. What should I do?' });
    rec.days[39].done = 15;
    expect(render(s, null)).not.toContain('Stopped practising');
  });
```

`src/teacher/livePanel.test.tsx`, inside `describe('road to the exam', …)`:

```ts
  it('says when the student has stopped practising', () => {
    const panel: LivePanel = { kind: 'student', studentId: 's17', planId: null, highlight: null };
    expect(render(withStudy(), panel)).not.toContain('Stopped practising');
    const s = withStudy();
    s.study.s17.days = { 38: { planned: 30, done: 0, check: null }, 39: { planned: 30, done: 0, check: null }, 40: { planned: 20, done: 0, check: null } };
    expect(render(s, panel)).toContain('Stopped practising: 0 of 80 min in the last 7 days.');
  });
```

`src/teacher/forecastChart.test.tsx`: add imports

```ts
import { ctxFor } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { StudentProfile } from './StudentProfile';
```

and append:

```ts
describe('the profile chart', () => {
  it('marks each disengaged replan as Stopped on the intervention row', () => {
    const s = seedState();
    ensureRecord(s, 's17').replans.push({ day: 43, signal: 'disengaged', reason: 'Lighter.' }, { day: 50, signal: 'markSwing', reason: 'More.' });
    const out = html(
      <LiveProvider value={ctxFor(s, null)}>
        <StudentProfile studentId="s17" entryId={null} onClose={() => {}} onAsk={() => {}} onOpenChat={() => {}} />
      </LiveProvider>,
    );
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Stopped</);
    expect(out.match(/>Stopped</g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/live/study/rules.test.ts server/agents/tools.test.ts src/teacher/live.test.tsx src/teacher/livePanel.test.tsx src/teacher/forecastChart.test.tsx`
Expected: FAIL: `stoppedPractising`, `stoppedSince` and `liveTodayRows` are not exported; no `practisedLast7Days`; no stopped row, line or marker.

- [ ] **Step 3: The rule**

In `src/live/study/signals.ts`, append:

```ts
/** Minutes done (all practice, teacher sessions too) and planned over the 7 closed days before `today`, rounded. */
export function lastWeek(rec: StudyRecord, today: number): { done: number; planned: number } {
  let done = 0;
  let planned = 0;
  for (let d = today - 7; d < today; d++) {
    done += rec.days[d]?.done ?? 0;
    planned += rec.days[d]?.planned ?? 0;
  }
  return { done: Math.round(done), planned: Math.round(planned) };
}

/** The disengagement rule as a fact for the teacher: the last 7 days' minutes while the student has stopped, else null. */
export const stoppedPractising = (rec: StudyRecord, today: number): { done: number; planned: number } | null =>
  disengaged(rec, today) ? lastWeek(rec, today) : null;

/** The first day of the current stopped stretch, or null while the student is practising. */
export function stoppedSince(rec: StudyRecord, today: number): number | null {
  if (!stoppedPractising(rec, today)) return null;
  let day = today;
  while (day > 0 && disengaged(rec, day - 1)) day--;
  return day;
}
```

- [ ] **Step 4: The outlook and its tool**

`src/live/study/outlook.ts`: add `import { lastWeek } from './signals';` after the `./record` import. In `ExamOutlook`, after `minutesDone: number;` add:

```ts
  /** Minutes done and planned over the last 7 closed days; little or nothing done means the student has stopped practising. */
  practisedLast7Days: { done: number; planned: number };
```

In `examOutlook`, after the `minutesDone: …` entry (the three lines ending `: 0,`) add:

```ts
    practisedLast7Days: lastWeek(rec, state.day),
```

`server/agents/tools.ts` line 46: in the `get_exam_outlook` description, replace `minutes planned and done against the current plan,` with `minutes planned and done against the current plan, practisedLast7Days (minutes done and planned over the last 7 days; little or nothing done means the student has stopped practising),`.

- [ ] **Step 5: The teacher's Today list**

`src/teacher/TeacherScreen.tsx`: add after the `examRisk` import:

```ts
import { stoppedPractising } from '../live/study/signals';
```

Replace the `TODAY` and `EXAM_ROW` constants (lines 40–48) with:

```ts
export interface AttentionRow { topic: ContextId; who: string; what: string; prompt?: string; figure?: string }

/** Today's attention list on the empty state, styled after the reference's ruled schedule. */
const TODAY: AttentionRow[] = [
  { topic: 'student', who: 'Nguyễn Minh Anh', what: 'Quiz 2 dropped' },
  { topic: 'class', who: 'Discrete Mathematics', what: 'Gap: logical equivalence' },
  { topic: 'attention', who: 'Escalation rule', what: 'Need you personally' },
];

/** Live only, while at least one student's exam estimate is At risk or Unlikely. */
const EXAM_ROW: AttentionRow = { topic: 'attention', who: 'Road to the exam', what: 'May not pass', prompt: 'Which students may not pass the exam?' };
```

After `liveFigures`, add:

```ts
/** Live only: the three rows with live figures, Road to the exam while anyone may not pass, then one row per student who has stopped practising. */
export function liveTodayRows(s: DemoState): AttentionRow[] {
  const figures = liveFigures(s);
  const rows: AttentionRow[] = TODAY.map((r, i) => ({ ...r, figure: figures[i] }));
  if (examRisk(s).length > 0) rows.push({ ...EXAM_ROW, figure: figures[3] });
  for (const st of s.students) {
    const rec = s.study[st.id];
    const p = rec ? stoppedPractising(rec, s.day) : null;
    if (p) {
      rows.push({
        topic: 'attention', who: `Stopped practising · ${p.done} of ${p.planned} min this week`, what: st.short,
        figure: `${p.done}/${p.planned}`, prompt: `${st.short} has stopped practising. What should I do?`,
      });
    }
  }
  return rows;
}
```

In `EmptyState`, replace

```ts
  const list = live && examRisk(live.state).length > 0 ? [...TODAY, EXAM_ROW] : TODAY;
```

with

```ts
  const list = live ? liveTodayRows(live.state) : TODAY;
```

replace `key={row.what}` with `` key={`${row.who}·${row.what}`} ``, and replace

```tsx
              <span className="font-serif text-[40px] leading-none text-egg-accent-ink">{live ? liveFigures(live.state)[i] : figureOf(i, rows[Math.min(i, 2)])}</span>
```

with

```tsx
              <span className="font-serif text-[40px] leading-none text-egg-accent-ink">{row.figure ?? figureOf(i, rows[Math.min(i, 2)])}</span>
```

(Scripted rows carry no `figure`, so the video still counts its figures up exactly as before.)

- [ ] **Step 6: Road to the exam and the chart marker**

`src/teacher/LivePanel.tsx`: add after the `examOutlook` import:

```ts
import { stoppedPractising } from '../live/study/signals';
```

In `RoadToExam`, after `const latest = o.marks.at(-1);` add:

```ts
  const stopped = state.study[s.id] ? stoppedPractising(state.study[s.id], state.day) : null;
```

and directly after the closing `</div>` of the two-column grid (before `{latest && …}`) add:

```tsx
      {stopped && <div className="mt-3 text-[13.5px] font-semibold text-egg-accent-ink">{`Stopped practising: ${stopped.done} of ${stopped.planned} min in the last 7 days.`}</div>}
```

`src/teacher/StudentProfile.tsx`, in `markers`, after the `...state.plans…` entry add:

```ts
    ...(rec?.replans ?? []).filter((r) => r.signal === 'disengaged').map((r) => ({ day: r.day, label: 'Stopped', row: 'intervention' as const })),
```

- [ ] **Step 7: Run the tests**

Run: `npm run typecheck && npx vitest run src/live server/agents src/teacher`
Expected: PASS, including `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/live/study/signals.ts src/live/study/outlook.ts src/live/study/rules.test.ts server/agents/tools.ts server/agents/tools.test.ts src/teacher/TeacherScreen.tsx src/teacher/LivePanel.tsx src/teacher/StudentProfile.tsx src/teacher/live.test.tsx src/teacher/livePanel.test.tsx src/teacher/forecastChart.test.tsx
git commit -m "feat(teacher): say when a student stops practising: Today row, Road to the exam, chart marker, outlook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The phone shows facts, not risk

**Files:**
- Modify: `src/student/studyView.ts` (imports, `TodayView`, `SemesterView`, `WHY`, `todayView`, `semesterView`, new helpers)
- Modify: `src/student/screens/StudyScreens.tsx:2` (import), `:94-98` (Today's top card), `SemesterScreen`
- Modify: `server/agents/cannedStudy.ts` (`REASON.bandChange`)
- Modify: `server/agents/study.ts` (`STUDY_SYSTEM` reason sentence)
- Test: `src/student/studyView.test.ts`, `src/student/screens.test.tsx`, `server/agents/study.test.ts`

**Interfaces:**
- Consumes (Task 1): `nextLecture(day, time)`, `nextTest(today)`, `nextAssignment(today)`, `isAssignment(a)`; existing `fmt` from `src/live/clock.ts`.
- Produces: `TodayView` loses `band` and `forecast`, gains `gpa: string`, `marks: string`, `nextLecture: string | null`, `nextAssessment: string | null`, `assignment: string | null`. `SemesterView.previous: SubjectGrade[]`.

- [ ] **Step 1: Write the failing tests**

`src/student/studyView.test.ts`: replace `it('builds Today: countdown, estimate, reason and rows', …)` with:

```ts
  it('builds Today: countdown, facts, reason and rows, with no band or forecast', () => {
    const v = todayView(ready())!;
    expect(v).toMatchObject({
      name: 'Minh Anh', examIn: 'Final exam in 24 days', gpa: 'GPA 2.30 of 4', marks: 'Quiz 1 75% · Quiz 2 42%',
      nextLecture: 'Lecture 7 · Equivalence laws · Tue 3 Nov', nextAssessment: 'Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3',
      assignment: 'Assignment 2 · due Fri 6 Nov', reason: 'Implication first.', offline: false, planning: null, examDay: false,
    });
    expect(v).not.toHaveProperty('band');
    expect(v).not.toHaveProperty('forecast');
    expect(v.rows.map(rowLabel)).toEqual(['4 flip cards', 'Practise implication']);
  });
  it('adds marks as they come, the assignment’s mark after its day, and the lecture by the clock', () => {
    const s = ready();
    s.day = 47;
    s.study.s17.marks.push({ assessment: 'a2', mark: 61, day: 46 });
    expect(todayView(s)).toMatchObject({ marks: 'Quiz 1 75% · Quiz 2 42% · Assignment 2 61%', assignment: 'Assignment 2 · 61%', nextAssessment: 'Quiz 3 · Thu 12 Nov · in 5 days · CLO2, CLO3' });
    s.day = 43;
    s.clock = 7 * 60 + 30;
    expect(todayView(s)?.nextLecture).toBe('Lecture 7 · Equivalence laws · Tue 3 Nov');
    s.clock = 9 * 60;
    expect(todayView(s)?.nextLecture).toBe('Lecture 8 · Logic in real problems · Tue 10 Nov');
  });
```

and add inside `describe('study views', …)`:

```ts
  it('lists previous subjects, and tells a band change only as progress', () => {
    const s = ready();
    s.study.s17.replans.push({ day: 45, signal: 'bandChange', reason: 'Your progress changed, so the plan did too.' });
    const v = semesterView(s)!;
    expect(v.previous).toEqual(s.students[16].history);
    expect(v.changes[0]).toEqual({ date: 'Thu 5 Nov', why: 'Your progress changed', reason: 'Your progress changed, so the plan did too.' });
  });
```

`src/student/screens.test.tsx`: add imports

```ts
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import type { DemoState } from '../live/types';
import { SemesterScreen, TodayScreen } from './screens/StudyScreens';
import { semesterView, todayView } from './studyView';
```

and append:

```tsx
describe('study screens', () => {
  const ready = (): DemoState => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    s.phone = { ...s.phone, studentId: 's17', screen: 'today' };
    return s;
  };
  it('Today shows GPA, marks, the next lecture, assessment and assignment, and never a band or forecast', () => {
    const out = html(<TodayScreen view={todayView(ready())!} onRow={() => {}} onNextDay={() => {}} onNextWeek={() => {}} />);
    for (const text of ['GPA 2.30 of 4', 'Quiz 1 75% · Quiz 2 42%', 'Lecture 7 · Equivalence laws · Tue 3 Nov', 'Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3', 'Assignment 2 · due Fri 6 Nov']) expect(out).toContain(text);
    for (const text of ['Likely', 'At risk', 'Unlikely', 'out of 10']) expect(out).not.toContain(text);
  });
  it('Semester lists previous subjects with grade and letter', () => {
    const out = html(<SemesterScreen view={semesterView(ready())!} />);
    expect(out).toContain('Previous subjects');
    expect(out).toContain('Introduction to Logic · Semester 2 · 2025');
    expect(out).toContain('6.8 · C+');
  });
});
```

`server/agents/study.test.ts`, inside `describe('offline planner', …)`:

```ts
  it('tells a band change only as progress', () => {
    expect(cannedStudyPlan(ready(), 's17', 'bandChange').reason).toBe('Your progress changed, so the plan did too.');
  });
```

and inside `describe('the prompt', …)`, in `it('states the rules and never assumes pronouns', …)` add:

```ts
    expect(STUDY_SYSTEM).toContain('without mentioning the forecast, a band or the chance of passing');
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/student server/agents/study.test.ts`
Expected: FAIL: `gpa`, `marks`, `nextLecture`, `nextAssessment`, `assignment` and `previous` are undefined; `band` is still present; Today still says "At risk" and "out of 10"; the canned reason still mentions the outlook.

- [ ] **Step 3: The view model**

In `src/student/studyView.ts`, replace the import lines 1–9 with:

```ts
import { fmt } from '../live/clock';
import { studentById } from '../live/reducer';
import { cardsToday } from '../live/study/cards';
import { cloMastery } from '../live/study/estimate';
import { todayList, type TodayRow } from '../live/study/today';
import type { DemoState, ReplanSignal, StudyRecord } from '../live/types';
import type { Card } from '../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, fullDate, isAssignment, nextAssessment, nextAssignment, nextLecture, nextTest, shortDate, weekOf, type Assessment, type CloId } from '../scenario/course';
import type { SubjectGrade } from '../scenario/grades';
import { conceptById } from '../scenario/knowledgeGraph';
import { MINH_ANH } from '../scenario/minhAnh';
```

In `TodayView`, replace

```ts
  band: PassBand;
  /** Out of 10. An estimate. */
  forecast: number;
```

with

```ts
  /** "GPA 2.30 of 4". */
  gpa: string;
  /** This course's marks so far, oldest first: "Quiz 1 75% · Quiz 2 42%". Percentages. */
  marks: string;
  /** "Lecture 7 · Equivalence laws · Tue 3 Nov"; null after the last lecture. */
  nextLecture: string | null;
  /** The next quiz or the exam: "Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3". */
  nextAssessment: string | null;
  /** "Assignment 2 · due Fri 6 Nov", then its mark once its day has passed: "Assignment 2 · 61%". */
  assignment: string | null;
```

In `SemesterView`, after `changes: …;` add:

```ts
  /** Previous subjects, 10-point grades with letters. */
  previous: SubjectGrade[];
```

In `WHY`, replace `bandChange: 'Your exam outlook changed',` with `bandChange: 'Your progress changed',`.

After `countdown`, add:

```ts
const inDays = (day: number, today: number) => {
  const n = day - today;
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
};

/** Quiz 1 and Quiz 2 from the seed, then the record's marks, oldest first. */
const marksLine = (q: { q1: number; q2: number }, rec: StudyRecord): string =>
  [
    `Quiz 1 ${q.q1}%`,
    `Quiz 2 ${q.q2}%`,
    ...[...rec.marks].sort((a, b) => a.day - b.day).map((m) => `${ASSESSMENTS.find((a) => a.id === m.assessment)?.title ?? m.assessment} ${m.mark}%`),
  ].join(' · ');

/** The assignment due next; once none is due, the last one with its mark. */
function assignmentLine(today: number, rec: StudyRecord): string | null {
  const due = nextAssignment(today);
  if (due) return `${due.title} · due ${shortDate(due.day)}`;
  const last = ASSESSMENTS.filter((a) => isAssignment(a) && a.day < today).at(-1);
  if (!last) return null;
  const mark = rec.marks.find((m) => m.assessment === last.id)?.mark;
  return mark === undefined ? `${last.title} · ${shortDate(last.day)}` : `${last.title} · ${mark}%`;
}
```

In `todayView`, after `const exam = …;` add:

```ts
  const test = nextTest(state.day);
  const lecture = nextLecture(state.day, fmt(state.clock));
```

and replace

```ts
    band: forecast(r.student, r.rec).band,
    forecast: forecast(r.student, r.rec).value,
```

with

```ts
    gpa: `GPA ${r.student.gpa.toFixed(2)} of 4`,
    marks: marksLine(r.student.quiz, r.rec),
    nextLecture: lecture && `Lecture ${lecture.n} · ${lecture.title} · ${shortDate(lecture.day)}`,
    nextAssessment: test && `${test.title} · ${shortDate(test.day)} · ${inDays(test.day, state.day)} · ${test.clos.join(', ')}`,
    assignment: assignmentLine(state.day, r.rec),
```

In `semesterView`, replace `return { weeks, leftOut: plan?.leftOut ?? [], changes };` with:

```ts
  return { weeks, leftOut: plan?.leftOut ?? [], changes, previous: r.student.history };
```

- [ ] **Step 4: The screens**

`src/student/screens/StudyScreens.tsx`: delete line 2 (`import { PASS } from '../../live/study/estimate';`). After the `TABS` constant add:

```ts
const FACTS: [label: string, key: 'nextLecture' | 'nextAssessment' | 'assignment'][] = [
  ['Next lecture', 'nextLecture'], ['Next assessment', 'nextAssessment'], ['Assignment', 'assignment'],
];
```

In `TodayScreen`, replace

```tsx
        <div className="mt-2 font-serif text-[34px] leading-none">{view.band}</div>
        <div className="mt-1.5 text-[13px] text-egg-card/75">{`Your forecast: ${view.forecast.toFixed(1)} out of 10, and ${PASS.toFixed(1)} is a pass. It is an estimate, not a result.`}</div>
```

with

```tsx
        <div className="mt-2 font-serif text-[30px] leading-none">{view.gpa}</div>
        <div className="mt-1.5 text-[13px] text-egg-card/75">{view.marks}</div>
        <dl className="mt-4 space-y-2.5">
          {FACTS.map(([label, key]) => view[key] && (
            <div key={key}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-egg-card/60">{label}</dt>
              <dd className="text-[14px]">{view[key]}</dd>
            </div>
          ))}
        </dl>
```

In `SemesterScreen`, after the `{view.changes.length > 0 && ( … )}` block add:

```tsx
      {view.previous.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Previous subjects</Eyebrow>
          {view.previous.map((h) => (
            <div key={h.subject} className="mt-1 flex justify-between gap-3 text-[14px]">
              <span>{`${h.subject} · ${h.term}`}</span>
              <span className="shrink-0 font-mono">{`${h.grade.toFixed(1)} · ${h.letter}`}</span>
            </div>
          ))}
        </section>
      )}
```

- [ ] **Step 5: Replan reasons stop mentioning the outlook**

`server/agents/cannedStudy.ts`: replace

```ts
  bandChange: (focus) => `Your exam outlook changed, so more time now goes to ${focus}.`,
```

with

```ts
  bandChange: () => 'Your progress changed, so the plan did too.',
```

`server/agents/study.ts`, in `STUDY_SYSTEM`, replace `Write reason as one short sentence to the student, in plain English, without figures.` with `Write reason as one short sentence to the student, in plain English, without figures and without mentioning the forecast, a band or the chance of passing.`

- [ ] **Step 6: Run the tests**

Run: `npm run typecheck && npx vitest run src/student server/agents`
Expected: PASS. TypeScript flags any other reader of `TodayView.band` or `.forecast`; there is none outside `StudyScreens.tsx` today.

- [ ] **Step 7: Commit**

```bash
git add src/student/studyView.ts src/student/screens/StudyScreens.tsx src/student/studyView.test.ts src/student/screens.test.tsx server/agents/cannedStudy.ts server/agents/study.ts server/agents/study.test.ts
git commit -m "feat(phone): Today shows GPA, marks and what comes next instead of a band; Semester adds previous subjects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Calendar model (pure)

**Files:**
- Create: `src/teacher/calendar.ts`
- Test: `src/teacher/calendar.test.ts` (create)

**Interfaces:**
- Consumes (Task 4): `stoppedSince(rec: StudyRecord, today: number): number | null`; existing `LECTURES`, `ASSESSMENTS`, `lectureBefore`, `FAQ`, `faqLog`.
- Produces (in `src/teacher/calendar.ts`):
  - `type CalendarEvent = { kind: 'lecture'; day: number; time: '09:00'; title: string; lecture: number } | { kind: 'assessment'; day: number; title: string; assessment: string } | { kind: 'session'; day: number; time: string; title: string; planId: string; studentIds: string[] } | { kind: 'stopped'; day: number; studentId: string }`
  - `interface CalendarWeek { week: number; days: { day: number; events: CalendarEvent[] }[] }`
  - `FIRST_WEEK = 1`, `LAST_WEEK = 10`
  - `calendarWeek(state: DemoState, week: number): CalendarWeek`
  - `lectureQuestions(n: number): VoiceEntry[]` (oldest first)
  - `assessmentMarks(state: DemoState, id: string): { studentId: string; mark: number }[]` (lowest first)

- [ ] **Step 1: Write the failing test**

Create `src/teacher/calendar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { lectureBefore } from '../scenario/course';
import { VOICE } from '../scenario/voice';
import { assessmentMarks, calendarWeek, lectureQuestions } from './calendar';

const all = (w: ReturnType<typeof calendarWeek>) => w.days.flatMap((d) => d.events);

describe('calendar model', () => {
  it('lays out a week Monday to Sunday with its lecture and assessments', () => {
    const w = calendarWeek(seedState(), 6);
    expect(w.week).toBe(6);
    expect(w.days.map((d) => d.day)).toEqual([35, 36, 37, 38, 39, 40, 41]);
    expect(w.days[1].events).toEqual([{ kind: 'lecture', day: 36, time: '09:00', title: 'Lecture 6 · Logical equivalence and De Morgan', lecture: 6 }]);
    expect(w.days[3].events).toEqual([{ kind: 'assessment', day: 38, title: 'Quiz 2', assessment: 'quiz2' }]);
    expect(calendarWeek(seedState(), 10).days[1].events).toEqual([{ kind: 'assessment', day: 64, title: 'Final exam', assessment: 'exam' }]);
  });
  it('shows the sessions of plans that went ahead, on the plan’s date, untimed events first', () => {
    expect(calendarWeek(stateWithPlan(), 6).days[5].events).toEqual([]);
    expect(calendarWeek(stateWithPlan('pathway', { status: 'dismissed' }), 6).days[5].events).toEqual([]);
    expect(calendarWeek(stateWithPlan('pathway', { status: 'sent' }), 6).days[5].events).toEqual([
      { kind: 'session', day: 40, time: '15:30', title: 'Review implication', planId: 'p1', studentIds: ['s17'] },
      { kind: 'session', day: 40, time: '20:00', title: 'Mastery check', planId: 'p1', studentIds: ['s17'] },
    ]);
    const friday = calendarWeek(stateWithPlan('checkIns', { status: 'approved' }), 7).days[4].events;
    expect(friday.map((e) => e.kind)).toEqual(['assessment', 'session', 'session']);
    expect(friday.flatMap((e) => (e.kind === 'session' ? [e.studentIds] : []))).toEqual([['s29'], ['s42']]);
    expect(all(calendarWeek(stateWithPlan('classActivity', { status: 'done' }), 7)).filter((e) => e.kind === 'session')).toHaveLength(1);
  });
  it('flags a student who stopped practising on the first day of the stretch, only while it lasts', () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    for (const d of [36, 37, 38, 39, 40, 41]) rec.days[d] = { planned: 30, done: d === 36 ? 12 : 0, check: null };
    s.day = 42;
    expect(all(calendarWeek(s, 6)).filter((e) => e.kind === 'stopped')).toEqual([{ kind: 'stopped', day: 40, studentId: 's17' }]);
    rec.days[41].done = 20;
    expect(all(calendarWeek(s, 6)).some((e) => e.kind === 'stopped')).toBe(false);
  });
  it('finds the student questions placed after a lecture, oldest first', () => {
    const q = lectureQuestions(5);
    expect(q.length).toBeGreaterThan(0);
    expect(q).toHaveLength(VOICE.filter((v) => v.faqId && lectureBefore(v.day, v.time)?.n === 5).length);
    expect(q.every((v) => lectureBefore(v.day, v.time)?.n === 5)).toBe(true);
    const stamps = q.map((v) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3)));
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(lectureQuestions(7)).toEqual([]);
  });
  it('lists an assessment’s marks once there are any', () => {
    const s = seedState();
    expect(assessmentMarks(s, 'quiz2')).toHaveLength(55);
    expect(assessmentMarks(s, 'quiz2').find((m) => m.studentId === 's17')?.mark).toBe(42);
    expect(assessmentMarks(s, 'quiz3')).toEqual([]);
    ensureRecord(s, 's17').marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(assessmentMarks(s, 'quiz3')).toEqual([{ studentId: 's17', mark: 22 }]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/calendar.test.ts`
Expected: FAIL: cannot resolve `./calendar`.

- [ ] **Step 3: Implement**

Create `src/teacher/calendar.ts`:

```ts
import { stoppedSince } from '../live/study/signals';
import type { DemoState, PlanStatus } from '../live/types';
import { ASSESSMENTS, LECTURES, lectureBefore } from '../scenario/course';
import { FAQ, faqLog, type VoiceEntry } from '../scenario/voice';

export type CalendarEvent =
  | { kind: 'lecture'; day: number; time: '09:00'; title: string; lecture: number }
  | { kind: 'assessment'; day: number; title: string; assessment: string }
  | { kind: 'session'; day: number; time: string; title: string; planId: string; studentIds: string[] }
  | { kind: 'stopped'; day: number; studentId: string };

export interface CalendarWeek { week: number; days: { day: number; events: CalendarEvent[] }[] }

/** The weeks the calendar browses. */
export const FIRST_WEEK = 1;
export const LAST_WEEK = 10;

/** Plans that went ahead; a proposed or dismissed plan is not on the calendar. */
const SHOWN: PlanStatus[] = ['sent', 'autoApproved', 'approved', 'done'];
const timeOf = (e: CalendarEvent): string => ('time' in e ? e.time : '');

/** One week, Monday to Sunday: lectures, assessments, the sessions of plans that went ahead and stopped-practising flags. Untimed events first, then by time. Pure. */
export function calendarWeek(state: DemoState, week: number): CalendarWeek {
  const events: CalendarEvent[] = [
    ...LECTURES.map((l): CalendarEvent => ({ kind: 'lecture', day: l.day, time: '09:00', title: `Lecture ${l.n} · ${l.title}`, lecture: l.n })),
    ...ASSESSMENTS.map((a): CalendarEvent => ({ kind: 'assessment', day: a.day, title: a.title, assessment: a.id })),
    ...state.plans.filter((p) => SHOWN.includes(p.status)).flatMap((p) =>
      p.sessions.map((s): CalendarEvent => ({ kind: 'session', day: p.date, time: s.time, title: s.title, planId: p.id, studentIds: s.studentId ? [s.studentId] : p.studentIds })),
    ),
    ...Object.entries(state.study).flatMap(([studentId, rec]): CalendarEvent[] => {
      const day = stoppedSince(rec, state.day);
      return day === null ? [] : [{ kind: 'stopped', day, studentId }];
    }),
  ];
  const first = (week - 1) * 7;
  return {
    week,
    days: Array.from({ length: 7 }, (_, i) => first + i).map((day) => ({
      day,
      events: events.filter((e) => e.day === day).sort((a, b) => timeOf(a).localeCompare(timeOf(b))),
    })),
  };
}

const stamp = (v: VoiceEntry) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3));

/** The FAQ log's messages placed after Lecture `n` (their `lectureBefore` is that lecture), oldest first. */
export const lectureQuestions = (n: number): VoiceEntry[] =>
  FAQ.flatMap((f) => faqLog(f.id)).filter((v) => lectureBefore(v.day, v.time)?.n === n).sort((a, b) => stamp(a) - stamp(b));

/** An assessment's marks, lowest first: Quiz 1 and Quiz 2 from the seed for every student, later ones from study records. Percentages. */
export function assessmentMarks(state: DemoState, id: string): { studentId: string; mark: number }[] {
  return state.students
    .flatMap((s) => {
      const mark = id === 'quiz1' ? s.quiz.q1 : id === 'quiz2' ? s.quiz.q2 : state.study[s.id]?.marks.find((m) => m.assessment === id)?.mark;
      return mark === undefined ? [] : [{ studentId: s.id, mark }];
    })
    .sort((a, b) => a.mark - b.mark);
}
```

- [ ] **Step 4: Run the test**

Run: `npm run typecheck && npx vitest run src/teacher/calendar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/calendar.ts src/teacher/calendar.test.ts
git commit -m "feat(teacher): a pure calendar model: lectures, assessments, sessions and stopped flags by week

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The Calendar tab

**Files:**
- Create: `src/teacher/Calendar.tsx`
- Modify: `src/teacher/frame.ts:5` (`View`)
- Modify: `src/teacher/TeacherScreen.tsx` (import, `title`, main view switch, `Sidebar` nav)
- Test: `src/teacher/calendar.dom.test.tsx` (create), `src/teacher/live.test.tsx`

**Interfaces:**
- Consumes (Task 6): `calendarWeek`, `CalendarEvent`, `FIRST_WEEK`, `LAST_WEEK`, `lectureQuestions`, `assessmentMarks`; the live context's `openConversation(id: string)` and `openProfile(studentId: string, entryId?: string | null)`.
- Produces: `View = 'chat' | 'classroom' | 'calendar'`; `Calendar(): JSX.Element | null` (live only). DOM hooks for tests: `[data-week]` on the week heading, `[data-day]` and `aria-current="date"` on today's column, `[data-event="<key>"]` on each event button (`lecture-<n>`, `assessment-<id>`, `session-<planId>-<time>`, `stopped-<studentId>`), `[data-question]` on each question in an open lecture.

- [ ] **Step 1: Write the failing tests**

Create `src/teacher/calendar.dom.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import type { DemoSource } from '../live/source';
import { ensureRecord } from '../live/study/record';
import { lectureQuestions } from './calendar';
import { LiveTeacherView } from './LiveTeacher';

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

/** Plan p1 sent for day 40, and Minh Anh idle on days 37–39. */
const story = () => {
  const s = stateWithPlan('pathway', { status: 'sent' });
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  for (const d of [37, 38, 39]) rec.days[d] = { planned: 30, done: 0, check: null };
  return s;
};
async function mount() {
  const calls: string[] = [];
  const source: DemoSource = { state: story(), post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const event = (el: HTMLElement, key: string) => el.querySelector(`[data-event="${key}"]`)!;
const week = (el: HTMLElement) => el.querySelector('[data-week]')?.textContent;

describe('teacher calendar', () => {
  it('opens on the story’s week with a today marker, and browses Weeks 1 to 10 without moving the story', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    expect(week(m.el)).toBe('Week 6');
    expect(m.el.querySelector('[aria-current="date"]')?.getAttribute('data-day')).toBe('40');
    await click(button(m.el, 'Next week ›'));
    expect(week(m.el)).toBe('Week 7');
    expect(m.el.textContent).toContain('Lecture 7 · Equivalence laws');
    expect(m.el.querySelector('[aria-current="date"]')).toBeNull();
    for (let i = 0; i < 3; i++) await click(button(m.el, 'Next week ›'));
    expect(week(m.el)).toBe('Week 10');
    expect(button(m.el, 'Next week ›').disabled).toBe(true);
    for (let i = 0; i < 9; i++) await click(button(m.el, '‹ Prev week'));
    expect(week(m.el)).toBe('Week 1');
    expect(button(m.el, '‹ Prev week').disabled).toBe(true);
    expect(m.calls).toEqual([]);
  });
  it('expands a lecture into the questions placed after it, and an assessment into its date, CLOs and marks', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(button(m.el, '‹ Prev week'));
    await click(event(m.el, 'lecture-5'));
    expect(m.el.querySelectorAll('[data-question]')).toHaveLength(lectureQuestions(5).length);
    await click(event(m.el, 'lecture-5'));
    expect(m.el.querySelectorAll('[data-question]')).toHaveLength(0);
    await click(button(m.el, 'Next week ›'));
    await click(event(m.el, 'assessment-quiz2'));
    const detail = m.el.querySelector('[data-detail="assessment-quiz2"]')!;
    expect(detail.textContent).toContain('Thursday, 29 October');
    expect(detail.textContent).toContain('CLO2 Establish logical equivalence');
    expect(detail.textContent).toContain('55 marks');
  });
  it('a stopped flag opens the student’s pop-up and a session opens its conversation', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(event(m.el, 'stopped-s17'));
    expect(m.el.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Nguyễn Minh Anh');
    await click(button(m.el, 'Close'));
    await click(event(m.el, 'session-p1-15:30'));
    expect(m.el.textContent).toContain('Quiz 2 fell from');
    expect(m.el.textContent).not.toContain('‹ Prev week');
  });
});
```

`src/teacher/live.test.tsx`, inside `describe('live teacher screen', …)`:

```ts
  it('offers the Calendar only in the live booth', () => {
    expect(render(stateWithPlan())).toContain('>Calendar</button>');
    expect(html(<TeacherScreen frame={teacherFrame([{ at: PAST, type: 'greeting' }], 10)} />)).not.toContain('>Calendar</button>');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/teacher/calendar.dom.test.tsx src/teacher/live.test.tsx`
Expected: FAIL: there is no "Calendar" button.

- [ ] **Step 3: The view type and the screen**

`src/teacher/frame.ts` line 5 becomes:

```ts
export type View = 'chat' | 'classroom' | 'calendar';
```

`src/teacher/TeacherScreen.tsx`: add after the `Blocks` import:

```ts
import { Calendar } from './Calendar';
```

Replace

```ts
  const title = view === 'classroom' ? 'Classroom' : frame.title ?? 'New conversation';
```

with

```ts
  const title = view === 'classroom' ? 'Classroom' : view === 'calendar' ? 'Calendar' : frame.title ?? 'New conversation';
```

Replace

```tsx
        {view === 'classroom' ? (
          <Classroom cls={frame.classroom} studentApproved={frame.approved.includes('student')} actions={actions} />
        ) : empty ? (
```

with

```tsx
        {view === 'classroom' ? (
          <Classroom cls={frame.classroom} studentApproved={frame.approved.includes('student')} actions={actions} />
        ) : view === 'calendar' ? (
          <Calendar />
        ) : empty ? (
```

In `Sidebar`, replace

```tsx
        {nav('classroom', 'Classroom')}
```

with

```tsx
        {nav('classroom', 'Classroom')}
        {live && nav('calendar', 'Calendar')}
```

- [ ] **Step 4: Create `src/teacher/Calendar.tsx`**

```tsx
import { useState } from 'react';
import { useLive } from '../live/LiveContext';
import type { DemoState } from '../live/types';
import { ASSESSMENTS, CLOS, fullDate, LECTURES, shortDate, weekOf } from '../scenario/course';
import { CHANNEL_LABEL, voiceEvidenceId } from '../scenario/voice';
import { assessmentMarks, calendarWeek, FIRST_WEEK, LAST_WEEK, lectureQuestions, type CalendarEvent } from './calendar';
import { Eyebrow } from './parts';
import { Words } from './voiceParts';

const NAV = 'rounded-full border border-egg-line px-3 py-1 text-[12.5px] text-egg-ink hover:border-egg-ink disabled:opacity-40 disabled:hover:border-egg-line';
const STYLE: Record<CalendarEvent['kind'], string> = {
  lecture: 'border border-egg-line bg-egg-card',
  assessment: 'bg-egg-ink text-egg-card',
  session: 'border border-egg-ink/40 bg-egg-paper',
  stopped: 'border border-egg-accent text-egg-accent-ink',
};

const keyOf = (e: CalendarEvent): string =>
  e.kind === 'lecture' ? `lecture-${e.lecture}`
    : e.kind === 'assessment' ? `assessment-${e.assessment}`
    : e.kind === 'session' ? `session-${e.planId}-${e.time}`
    : `stopped-${e.studentId}`;

/** The course week by week. Live only and a view only: browsing never moves the story, posts nothing and costs no tokens. */
export function Calendar() {
  const live = useLive();
  const [week, setWeek] = useState(() => (live ? Math.min(LAST_WEEK, Math.max(FIRST_WEEK, weekOf(live.state.day))) : FIRST_WEEK));
  const [open, setOpen] = useState<string | null>(null);
  if (!live) return null;
  const { state } = live;
  const cal = calendarWeek(state, week);
  const short = (id: string) => state.students.find((s) => s.id === id)?.short ?? id;
  const go = (w: number) => {
    setWeek(w);
    setOpen(null);
  };
  const text = (e: CalendarEvent): string =>
    e.kind === 'session' ? `${e.title} · ${e.studentIds.map(short).join(', ')}`
      : e.kind === 'stopped' ? `Stopped practising · ${short(e.studentId)}`
      : e.title;
  const act = (e: CalendarEvent) => {
    if (e.kind === 'lecture' || e.kind === 'assessment') setOpen(open === keyOf(e) ? null : keyOf(e));
    else if (e.kind === 'session') {
      const plan = state.plans.find((p) => p.id === e.planId);
      if (plan) live.openConversation(plan.conversationId);
    } else live.openProfile(e.studentId);
  };
  const opened = cal.days.flatMap((d) => d.events).find((e) => keyOf(e) === open) ?? null;
  const empty = cal.days.every((d) => d.events.length === 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-8 pb-10 pt-6">
        <div className="flex items-end gap-4">
          <div>
            <Eyebrow>Discrete Mathematics · DM-2026</Eyebrow>
            <h2 data-week={week} className="mt-2 font-serif text-[44px] leading-none">{`Week ${week}`}</h2>
            <div className="mt-1 text-[13px] text-egg-mute">{`${shortDate(cal.days[0].day)} – ${shortDate(cal.days[6].day)}`}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={week <= FIRST_WEEK} onClick={() => go(week - 1)} className={NAV}>‹ Prev week</button>
            <button type="button" disabled={week >= LAST_WEEK} onClick={() => go(week + 1)} className={NAV}>Next week ›</button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-7 border-t-2 border-egg-ink">
          {cal.days.map((d) => {
            const today = d.day === state.day;
            return (
              <div key={d.day} data-day={d.day} aria-current={today ? 'date' : undefined} className={`min-h-[160px] border-b border-r border-egg-line p-2 last:border-r-0 ${today ? 'bg-egg-tint' : ''}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-egg-mute">{shortDate(d.day)}</span>
                  {today && <span className="rounded-full bg-egg-ink px-2 text-[10.5px] font-semibold text-egg-card">Today</span>}
                </div>
                <div className="mt-2 space-y-1.5">
                  {d.events.map((e) => (
                    <button
                      key={keyOf(e)}
                      type="button"
                      data-event={keyOf(e)}
                      aria-expanded={e.kind === 'lecture' || e.kind === 'assessment' ? open === keyOf(e) : undefined}
                      onClick={() => act(e)}
                      className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug ${STYLE[e.kind]}`}
                    >
                      {'time' in e && <span className="block font-mono text-[10.5px] opacity-70">{e.time}</span>}
                      <span className="block font-semibold">{text(e)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {empty && <div className="mt-6 text-[14px] text-egg-mute">Nothing scheduled</div>}
        {opened?.kind === 'lecture' && <LectureDetail n={opened.lecture} state={state} />}
        {opened?.kind === 'assessment' && <AssessmentDetail id={opened.assessment} state={state} />}
      </div>
    </div>
  );
}

/** The student questions placed after a lecture, from the FAQ log. */
function LectureDetail({ n, state }: { n: number; state: DemoState }) {
  const l = LECTURES.find((x) => x.n === n)!;
  const questions = lectureQuestions(n);
  return (
    <section data-detail={`lecture-${n}`} className="mt-6 border-t border-egg-ink/80 pt-3">
      <div className="font-serif text-[26px] leading-none">{`Lecture ${l.n} · ${l.title}`}</div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{`${fullDate(l.day)} · 09:00–11:00 · ${questions.length} student question${questions.length === 1 ? '' : 's'} after it`}</div>
      {questions.length ? (
        <ul className="mt-3 divide-y divide-egg-line">
          {questions.map((v) => {
            const student = state.students[v.studentIndex];
            const id = voiceEvidenceId(v);
            const e = student.evidence.find((x) => x.id === id);
            return (
              <li key={id} data-question={id} className="py-2 text-[13px]">
                <span className="block font-semibold text-egg-ink">{`${student.name} · ${CHANNEL_LABEL[v.channel]} · ${shortDate(v.day)} · ${v.time}`}</span>
                {e && <Words e={e} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 text-[14px] text-egg-mute">No student questions after this lecture yet.</div>
      )}
    </section>
  );
}

/** An assessment's date, CLOs and, once there are any, its marks. */
function AssessmentDetail({ id, state }: { id: string; state: DemoState }) {
  const a = ASSESSMENTS.find((x) => x.id === id)!;
  const marks = assessmentMarks(state, id);
  const name = (sid: string) => state.students.find((s) => s.id === sid)?.name ?? sid;
  const avg = marks.length ? Math.round(marks.reduce((t, m) => t + m.mark, 0) / marks.length) : 0;
  return (
    <section data-detail={`assessment-${id}`} className="mt-6 border-t border-egg-ink/80 pt-3">
      <div className="font-serif text-[26px] leading-none">{a.title}</div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{fullDate(a.day)}</div>
      <div className="mt-2 text-[13.5px] text-egg-ink">{a.clos.map((c) => `${c} ${CLOS.find((x) => x.id === c)!.title}`).join(' · ')}</div>
      {marks.length ? (
        <>
          <div className="mt-3 text-[13px] font-semibold">{`${marks.length} mark${marks.length === 1 ? '' : 's'} · average ${avg}%`}</div>
          <ul className="mt-1 grid grid-cols-3 gap-x-6 text-[13px]">
            {marks.map((m) => (
              <li key={m.studentId} className="flex justify-between gap-2 border-b border-egg-line py-1">
                <span className="truncate">{name(m.studentId)}</span>
                <span className="font-mono">{`${m.mark}%`}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-3 text-[14px] text-egg-mute">No marks yet.</div>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher`
Expected: PASS, with `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` unchanged (the scripted sidebar has no Calendar item). The existing click-audit scenarios click the new Calendar item too; it switches the view, so they pass.

- [ ] **Step 6: Commit**

```bash
git add src/teacher/Calendar.tsx src/teacher/frame.ts src/teacher/TeacherScreen.tsx src/teacher/calendar.dom.test.tsx src/teacher/live.test.tsx
git commit -m "feat(teacher): a live Calendar tab: week grid, lecture questions, assessment marks, sessions and stopped flags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Click audit, L6.8, full verification and spec touch-up

**Files:**
- Modify: `src/teacher/liveAudit.test.tsx` (`SCENARIOS`)
- Modify: `server/evals/cases.ts` (imports, new L6.8 after L6.7)
- Modify: `docs/superpowers/specs/2026-11-01-calendar-and-revision-design.md` (§2.2, §4, §5.2 wording to match the build)

**Interfaces:**
- Consumes: `examOutlook` and `ExamOutlook.practisedLast7Days` (Task 4); `forecast` (existing); everything above.

- [ ] **Step 1: Extend the click audit**

In `src/teacher/liveAudit.test.tsx`, add to `SCENARIOS`:

```ts
  ['calendar', async (el) => click(byText(el, 'Calendar'))],
  ['calendar with Lecture 6 open', async (el) => {
    await click(byText(el, 'Calendar'));
    await click(el.querySelector('[data-event="lecture-6"]')!);
  }],
```

Run: `npx vitest run src/teacher/liveAudit.test.tsx`
Expected: PASS. A failure names the button that "did nothing": make it change the page or remove it. (The disabled week buttons and the `aria-current` Calendar item are skipped by `skip`.)

- [ ] **Step 2: Add L6.8**

`server/evals/cases.ts`: add after the `forecast` import:

```ts
import { examOutlook } from '../../src/live/study/outlook';
```

Append to `CASES`, after L6.7:

```ts
  { id: 'L6.8', level: 6, title: 'Minh Anh skips three weeks', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    const start = forecast(t.student(MA), t.state.study[MA]).value;
    for (let i = 0; i < 3; i++) {
      t.session.nextWeek();
      await t.session.settled();
    }
    const o = examOutlook(t.state, t.student(MA));
    t.check('Sense', 'the outlook reports the missed minutes', o.practisedLast7Days.done === 0 && o.practisedLast7Days.planned > 0, JSON.stringify(o.practisedLast7Days));
    t.check('Sense', 'the forecast fell', o.forecast < start, `${start} -> ${o.forecast}`);
    const a = await t.ask('Is Minh Anh keeping up with revision?', null, 'Diagnose');
    t.check('Diagnose', 'used the exam outlook', a.steps.some((s) => s.includes('road to the exam')), a.steps.join(' | '));
    t.check('Diagnose', 'reports the missed minutes', new RegExp(`\\b${o.practisedLast7Days.planned}\\b`).test(a.answer), `expected ${o.practisedLast7Days.planned} in: ${a.answer}`);
    t.check('Diagnose', 'says the forecast fell', /fell|dropped|lower|down|declin|slipp/i.test(a.answer), a.answer);
    t.noPronouns('Diagnose', a.answer);
  } },
```

- [ ] **Step 3: Record the build in the spec**

In `docs/superpowers/specs/2026-11-01-calendar-and-revision-design.md`:

- §2.2, replace `This week: Lecture 7 · Equivalence laws, Tue 3 Nov.` with `Next lecture: Lecture 7 · Equivalence laws, Tue 3 Nov.` (the story starts on a Saturday, so the next lecture is not "this week").
- §4, replace `"GPA 2.75 of 4"` with `"GPA 2.30 of 4"` (Minh Anh's seeded GPA), and replace `- **Next assignment**: "Assignment 2 · due Fri 6 Nov", and after its day, its mark.` with `- **Assignment**: "Assignment 2 · due Fri 6 Nov", and after its day, its mark ("Assignment 2 · 61%").`
- §5.2, replace `  - a lecture expands inline into the student questions placed after it: the FAQ log filtered to messages whose \`lectureBefore\` is that lecture;` with `  - a lecture expands, under the week grid, into the student questions placed after it: the FAQ log filtered to messages whose \`lectureBefore\` is that lecture;` and `  - an assessment expands inline into its date, CLOs and, once there are any, the marks;` with `  - an assessment expands, under the week grid, into its date, CLOs and, once there are any, the marks;`.

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all clean. Then the free control eval, to check the graders still load:

Run: `npm run eval -- --offline --only L6.1,L6.2,L6.3,L6.4,L6.5,L6.6,L6.7,L6.8`
Expected: the run completes; offline graders failing the agent checks is normal for the control run. L6.4's "minutes and reason are untouched", L6.8's "the outlook reports the missed minutes" and "the forecast fell" are data checks and pass offline too.

- [ ] **Step 5: Real-API evals (ask the user first: this costs money)**

Ask the user before running. The last four-case run cost about $0.15; this one has eight cases, one of them (L6.6) the whole term with its replans, so expect several times that.

Run: `npm run eval -- --only L6.1,L6.2,L6.3,L6.4,L6.5,L6.6,L6.7,L6.8`
Expected: L6.1–L6.7 pass as before (L6.6's figures move a little because idle concepts now forget); L6.8 passes. Report the new results file path under `docs/evals/` to the user, and do not commit eval outputs unless the user asks.

- [ ] **Step 6: Run the booth and look**

Run: `npm run booth`, then check by hand:
1. Phone: set up Minh Anh with 30/60. Today shows "GPA 2.30 of 4", "Quiz 1 75% · Quiz 2 42%", "Lecture 7 · Equivalence laws · Tue 3 Nov", "Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3" and "Assignment 2 · due Fri 6 Nov"; no band and no "out of 10".
2. Tap Next week: on the teacher's opening screen a "Stopped practising · 0 of … min this week" row appears for Minh Anh; clicking it asks "Minh Anh has stopped practising. What should I do?".
3. Teacher sidebar: Calendar. Week 7 opens with the today marker on Sat 7 Nov; Lecture 7 and Assignment 2 show, and the stopped flag sits on its first day. "‹ Prev week" to Week 5, open Lecture 5: its student questions list. The story date in the header does not change.
4. Open Minh Anh's pop-up: the chart shows a "Stopped" marker on the replan day; Road to the exam reads "Stopped practising: 0 of … min in the last 7 days."

- [ ] **Step 7: Commit**

```bash
git add src/teacher/liveAudit.test.tsx server/evals/cases.ts docs/superpowers/specs/2026-11-01-calendar-and-revision-design.md
git commit -m "test: audit the calendar, add L6.8 (three skipped weeks), spec matches the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
