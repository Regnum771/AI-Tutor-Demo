# Student Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make students' own words visible in the live teacher app (quotes in answers, "In their words", a class FAQ, a student profile pop-up) and move the pass estimate to a 10-point forecast.

**Architecture:** Student questions are seeded as ordinary `message` evidence (`src/scenario/voice.ts`) with a story day and time, placed relative to a new lecture calendar. The FAQ is authored seed data whose figures are computed from the log. The profile pop-up is one live-only modal driven by a new `openProfile` on the live context; its data comes from pure functions in `src/teacher/profile.ts`. The forecast (`src/live/study/estimate.ts`) becomes the standing on 0–10, and the plan's effect is a separate projection.

**Tech Stack:** TypeScript, React 18, Tailwind, Vitest (+ happy-dom for click tests), Hono server, Anthropic SDK agents.

Spec: `docs/superpowers/specs/2026-11-01-student-voice-design.md`.

## Global Constraints

- Grade scale everywhere: pass **4.0**, Khá **7.0**, Giỏi **8.5**. Bands: **Likely ≥ 5.0, At risk 3.5–4.9, Unlikely < 3.5**. `PassBand` keeps the names `'Likely' | 'At risk' | 'Unlikely'`.
- Forecast = round1(0.6 × 10 × exam-share-weighted mastery + 0.4 × latest mark ÷ 10). A plan alone never changes it. Projection = min(10, forecast + 2.0 × min(1, planned minutes ÷ minutesNeeded) × done rate); 0 gain when minutesNeeded is 0.
- Quiz and assessment marks stay as percentages.
- No new agent runs. Opening the FAQ or the profile costs no tokens.
- New teacher UI is live-only (`useLive()` non-null). The scripted video path must render exactly as before.
- Copy never assumes anyone's pronouns.
- Minh Anh's evidence ids `s17-zalo-1` and `s17-zalo-2` stay unchanged; Minh Anh keeps exactly 2 `message` entries and 8 entries in all.
- Every commit ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test command: `npx vitest run <path>`; types: `npm run typecheck`.

---

### Task 1: 10-point forecast and projection

**Files:**
- Modify: `src/live/study/estimate.ts` (whole file)
- Modify: `src/live/study/outlook.ts`
- Modify: `src/live/study/reducer.ts:9,134,156`
- Modify: `src/student/studyView.ts:3,11-26,83`
- Modify: `src/student/screens/StudyScreens.tsx:95-96`
- Modify: `src/teacher/LivePanel.tsx:152-170` (`RoadToExam`)
- Modify: `server/agents/study.ts:4,51,108,126`
- Modify: `server/agents/tools.ts:47` (tool description)
- Modify: `server/agents/sas.ts:54`
- Modify: `server/evals/cases.ts:4,405-424`
- Test: `src/live/study/rules.test.ts:118-138`, `server/agents/tools.test.ts:73`, `src/student/studyView.test.ts:36`, `server/session.study.test.ts:41`

**Interfaces:**
- Produces (in `src/live/study/estimate.ts`):
  - `PASS = 4.0`, `KHA = 7.0`, `GIOI = 8.5`, `TARGET_MASTERY = 0.75`
  - `cloMastery(student: Pick<StudentProfile, 'mastery'>, cloId: CloId): number`
  - `bandOf(value: number): PassBand`
  - `minutesNeeded(student: Pick<StudentProfile, 'mastery'>): number`
  - `standing(student: Pick<StudentProfile, 'mastery'>, mark: number): number`
  - `latestMark(student: StudentProfile, rec?: StudyRecord | null): number`
  - `forecast(student: StudentProfile, rec?: StudyRecord | null): { value: number; band: PassBand }`
  - `doneRate(rec: StudyRecord, today: number): number`
  - `projection(student: StudentProfile, rec: StudyRecord | null | undefined, today: number): number`
- Produces: `ExamOutlook` loses `projectedScore`, gains `forecast: number` and `ifPlanKept: number`; `passMark` becomes `4`.
- Produces: `TodayView.forecast: number`.

- [ ] **Step 1: Replace the pass-estimate tests with forecast tests**

In `src/live/study/rules.test.ts`, change the import on line 10 to:

```ts
import { bandOf, cloMastery, forecast, minutesNeeded, projection } from './estimate';
```

Replace the whole `describe('pass estimate', …)` block (lines 118–138, up to but not including the `it('counts 12 minutes per 0.1 of gap…` test, which stays) with:

```ts
describe('forecast', () => {
  it('weights mastery by exam share and blends in the latest mark, on 0–10', () => {
    const { s, rec } = setup();
    const st = student(s);
    const m = CLOS.reduce((a, c) => a + c.share * cloMastery(st, c.id), 0);
    expect(forecast(st, rec).value).toBeCloseTo(Math.round((6 * m + st.quiz.q2 / 25) * 10) / 10, 5);
    expect(forecast(st, rec)).toEqual({ value: 4.4, band: 'At risk' });
  });
  it('bands at 3.5 and 5.0', () => {
    expect(bandOf(5)).toBe('Likely');
    expect(bandOf(4.9)).toBe('At risk');
    expect(bandOf(3.5)).toBe('At risk');
    expect(bandOf(3.4)).toBe('Unlikely');
  });
  it('a plan alone never moves the forecast; a lower mark does', () => {
    const { s, rec } = setup();
    const st = student(s);
    const before = forecast(st, rec).value;
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 2000, clo: 'CLO1', concepts: [] }] };
    expect(forecast(st, rec).value).toBe(before);
    rec.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(forecast(st, rec).value).toBeLessThan(before - 0.6);
  });
});

describe('projection', () => {
  it('adds the plan, scaled by the time it covers and the work done', () => {
    const { s, rec } = setup();
    const st = student(s);
    const now = forecast(st, rec).value;
    expect(projection(st, rec, 40)).toBe(now);
    const need = minutesNeeded(st);
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: need, clo: 'CLO1', concepts: [] }] };
    expect(projection(st, rec, 40)).toBeCloseTo(now + 2, 5);
    rec.plan.days[0].minutes = Math.round(need / 2);
    expect(projection(st, rec, 40)).toBeCloseTo(now + 1, 1);
    for (let d = 33; d < 40; d++) rec.days[d] = { planned: 20, done: 10, check: null };
    expect(projection(st, rec, 40)).toBeCloseTo(now + 0.5, 1);
  });
  it('caps at 10 and adds nothing when no study is needed', () => {
    const { s, rec } = setup();
    const st = student(s);
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 1000, clo: 'CLO1', concepts: [] }] };
    setAll(st, 0.74);
    rec.marks.push({ assessment: 'quiz3', mark: 100, day: 52 });
    expect(projection(st, rec, 40)).toBe(10);
    setAll(st, 0.97);
    expect(minutesNeeded(st)).toBe(0);
    expect(projection(st, rec, 40)).toBe(forecast(st, rec).value);
  });
```

(The existing `it('counts 12 minutes per 0.1 of gap to 0.75, per concept', …)` and the rest of the old block's closing `});` stay, now inside `describe('projection', …)`.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/live/study/rules.test.ts`
Expected: FAIL: `forecast` and `projection` are not exported from `./estimate`.

- [ ] **Step 3: Rewrite `src/live/study/estimate.ts`**

```ts
import { CLOS, type CloId } from '../../scenario/course';
import type { PassBand, StudentProfile, StudyRecord } from '../types';

/** The 10-point grade scale: pass, Khá (distinction), Giỏi (high distinction). */
export const PASS = 4.0;
export const KHA = 7.0;
export const GIOI = 8.5;
/** The mastery a concept is worked up to. */
export const TARGET_MASTERY = 0.75;
/** The most a plan that is kept can add by exam day. */
const MAX_GAIN = 2.0;

const round1 = (v: number) => Math.round(v * 10) / 10;

export const cloMastery = (student: Pick<StudentProfile, 'mastery'>, cloId: CloId): number => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};

export const bandOf = (value: number): PassBand => (value >= 5 ? 'Likely' : value >= 3.5 ? 'At risk' : 'Unlikely');

/** Minutes to bring every concept to 0.75: 12 per 0.1 of gap. */
export const minutesNeeded = (student: Pick<StudentProfile, 'mastery'>): number =>
  Math.round(Object.values(student.mastery).reduce((a, m) => a + Math.max(0, TARGET_MASTERY - m), 0) * 120);

/** Mastery weighted by exam share, blended with a mark (a percentage), on 0–10. */
export const standing = (student: Pick<StudentProfile, 'mastery'>, mark: number): number =>
  round1(0.6 * 10 * CLOS.reduce((a, c) => a + c.share * cloMastery(student, c.id), 0) + 0.4 * (mark / 10));

/** The newest assessment mark, or Quiz 2 before any. */
export const latestMark = (student: StudentProfile, rec?: StudyRecord | null): number =>
  rec?.marks.length ? [...rec.marks].sort((a, b) => a.day - b.day).at(-1)!.mark : student.quiz.q2;

/** Where the student stands now, out of 10. A plan alone never moves it. An estimate. */
export function forecast(student: StudentProfile, rec?: StudyRecord | null): { value: number; band: PassBand } {
  const value = standing(student, latestMark(student, rec));
  return { value, band: bandOf(value) };
}

/** Self-study done ÷ planned over the last 7 closed days; 1 before any day has closed. */
export function doneRate(rec: StudyRecord, today: number): number {
  let planned = 0;
  let done = 0;
  for (let d = today - 7; d < today; d++) {
    const day = rec.days[d];
    if (!day || day.planned <= 0) continue;
    planned += day.planned;
    done += day.done - (day.teacher ?? 0);
  }
  return planned > 0 ? Math.min(1, Math.max(0, done / planned)) : 1;
}

/** The exam forecast if the current plan is kept. Shown as a projection, never as the band. */
export function projection(student: StudentProfile, rec: StudyRecord | null | undefined, today: number): number {
  const now = forecast(student, rec).value;
  if (!rec?.plan) return now;
  const planned = rec.plan.days.filter((d) => d.day >= today).reduce((a, d) => a + d.minutes, 0);
  const need = minutesNeeded(student);
  const cover = need > 0 ? Math.min(1, planned / need) : 0;
  return round1(Math.min(10, now + MAX_GAIN * cover * doneRate(rec, today)));
}
```

- [ ] **Step 4: Update the callers in `src/`**

`src/live/study/outlook.ts`: change line 3 to `import { cloMastery, forecast, PASS, projection } from './estimate';`. In `ExamOutlook`, replace

```ts
  /** Always an estimate, never a prediction to state as fact. */
  projectedScore: number;
```

with

```ts
  /** Out of 10, now. Always an estimate, never a prediction to state as fact. */
  forecast: number;
  /** Out of 10 on exam day if the current plan is kept. An estimate. */
  ifPlanKept: number;
```

In `examOutlook`, replace `const est = passEstimate(student, rec, state.day);` with `const est = forecast(student, rec);` and replace the lines `projectedScore: est.score,` and `passMark: PASS_MARK,` with:

```ts
    forecast: est.value,
    ifPlanKept: projection(student, rec, state.day),
    band: est.band,
    passMark: PASS,
```

(remove the old `band: est.band,` line so it appears once). Replace `examRisk` with:

```ts
/** Students with a study plan whose forecast is At risk or Unlikely. */
export const examRisk = (state: DemoState): StudentProfile[] =>
  state.students.filter((s) => state.study[s.id]?.plan && forecast(s, state.study[s.id]).band !== 'Likely');
```

`src/live/study/reducer.ts`: line 9 becomes `import { forecast } from './estimate';`. Line 134 becomes `const { band } = forecast(student, rec);`. Line 156 becomes `rec.band = forecast(studentById(s, studentId)!, rec).band;`.

`src/student/studyView.ts`: line 3 becomes `import { cloMastery, forecast } from '../live/study/estimate';`. Add to `TodayView` after `band: PassBand;`:

```ts
  /** Out of 10. An estimate. */
  forecast: number;
```

In `todayView`, replace `band: passEstimate(r.student, r.rec, state.day).band,` with:

```ts
    band: forecast(r.student, r.rec).band,
    forecast: forecast(r.student, r.rec).value,
```

`src/student/screens/StudyScreens.tsx` line 96 becomes:

```tsx
        <div className="mt-1.5 text-[13px] text-egg-card/75">{`Your forecast: ${view.forecast.toFixed(1)} out of 10, and 4.0 passes. It is an estimate, not a result.`}</div>
```

`src/teacher/LivePanel.tsx`, in `RoadToExam`, replace

```tsx
          <Eyebrow>Pass estimate</Eyebrow>
          <div className="mt-1 font-serif text-[28px] leading-none text-egg-ink">{o.band}</div>
```

with

```tsx
          <Eyebrow>Forecast</Eyebrow>
          <div className="mt-1 font-serif text-[28px] leading-none text-egg-ink">{o.band}</div>
          <div className="mt-1 text-[12.5px] text-egg-mute">{`${o.forecast.toFixed(1)} of 10 now · ${o.ifPlanKept.toFixed(1)} if the plan is kept`}</div>
```

- [ ] **Step 5: Update the agents and evals**

`server/agents/study.ts` line 4 becomes:

```ts
import { cloMastery, forecast, minutesNeeded, PASS, projection, TARGET_MASTERY as TARGET } from '../../src/live/study/estimate';
```

Line 51 becomes `  bandChange: 'The forecast moved to a different band.',`. Line 108 becomes `  const est = forecast(s, rec);`. Line 126 becomes:

```ts
    `Forecast: ${est.value.toFixed(1)} out of 10 (${est.band}); ${projection(s, rec, state.day).toFixed(1)} if the current plan is kept; the pass mark is ${PASS.toFixed(1)}. The final exam is on ${shortDate(EXAM_DAY)}.`,
```

`server/agents/tools.ts`, in the `get_exam_outlook` description, replace `projected score and band (estimates)` with `forecast out of 10 now (pass 4.0), the forecast if the current plan is kept, and the band (all estimates)`.

`server/agents/sas.ts` line 54: replace `Its score and band are an estimate, so say so;` with `Its forecast (out of 10; 4.0 passes, 7.0 is Khá, 8.5 is Giỏi), its if-plan-kept figure and its band are estimates, so say so;`.

`server/evals/cases.ts`: line 4 becomes `import { forecast } from '../../src/live/study/estimate';`. In L6.6 replace the `estimate` helper and its uses:

```ts
    const estimate = () => forecast(t.student(MA), t.state.study[MA]);
    const start = estimate().value;
```

and in the loop `t.point(`day ${t.state.day}: ${estimate().band} ${estimate().value.toFixed(1)}`, MA, 'equivalence');` and the check `t.check('Adapt', 'mastery rose', estimate().value > start, `${start} -> ${estimate().value}`);`.

In L6.7 replace the `est` line and the score check with:

```ts
    const est = forecast(t.student(MA), t.state.study[MA]);
```

```ts
    const near = [-0.1, 0, 0.1].map((d) => (est.value + d).toFixed(1).replace('.', '\\.'));
    t.check('Diagnose', 'quotes the forecast (within 0.1)', near.some((v) => new RegExp(`\\b${v}\\b`).test(a.answer)), `expected ${est.value.toFixed(1)} in: ${a.answer}`);
```

- [ ] **Step 6: Update the tests that pinned the old scale**

- `server/agents/tools.test.ts:73`: `passMark: 50` → `passMark: 4`.
- `src/student/studyView.test.ts:36`: `band: 'Likely'` → `band: 'At risk'` (Minh Anh stands at 4.4; a plan no longer lifts the band).
- `server/session.study.test.ts:41`: `band: 'Likely'` → `band: 'At risk'`.

- [ ] **Step 7: Run everything**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all tests PASS. If another test fails only because it expected `Likely` for Minh Anh right after setup, change it to `At risk` (same reason as step 6). Any other failure is a real bug: fix the code, not the test.

- [ ] **Step 8: Commit**

```bash
git add src/live/study src/student server/agents server/evals/cases.ts server/session.study.test.ts src/teacher/LivePanel.tsx
git commit -m "feat(study): a 10-point forecast that a plan alone cannot lift, with the plan as a projection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Forecast history

**Files:**
- Modify: `src/live/types.ts` (`StudentProfile`, `StudyRecord`)
- Modify: `src/live/study/record.ts` (`newRecord`, new `noteForecast`)
- Modify: `src/live/study/estimate.ts` (new `forecastSeries`)
- Modify: `src/live/study/reducer.ts` (`advance`, `applyPlan`)
- Modify: `src/scenario/roster.ts` (`buildRoster`)
- Test: `src/live/study/rules.test.ts`, `src/live/study/reducer.test.ts`

**Interfaces:**
- Consumes: `standing`, `forecast` from Task 1.
- Produces:
  - `StudentProfile.pastForecast: { day: number; value: number }[]` (Quiz 1 and Quiz 2 points)
  - `StudyRecord.forecasts: { day: number; value: number }[]`
  - `noteForecast(rec: StudyRecord, student: StudentProfile, day: number): void` (in `record.ts`)
  - `forecastSeries(student: StudentProfile, rec?: StudyRecord | null): { day: number; value: number }[]` (in `estimate.ts`)

- [ ] **Step 1: Write the failing tests**

Append to `src/live/study/rules.test.ts` (add `forecastSeries` to the `./estimate` import and `noteForecast` to the `./record` import):

```ts
describe('forecast history', () => {
  it('every student starts with Quiz 1 and Quiz 2 points', () => {
    const st = student(seedState(), 's2');
    expect(st.pastForecast.map((p) => p.day)).toEqual([17, 38]);
    expect(forecastSeries(st)).toEqual(st.pastForecast);
  });
  it('a recorded point replaces one already there for the day', () => {
    const { s, rec } = setup();
    const st = student(s);
    noteForecast(rec, st, 40);
    st.mastery.implication = 0.9;
    noteForecast(rec, st, 40);
    expect(rec.forecasts).toEqual([{ day: 40, value: forecast(st, rec).value }]);
    expect(forecastSeries(st, rec).map((p) => p.day)).toEqual([17, 38, 40]);
  });
});
```

Append to `src/live/study/reducer.test.ts` inside `describe('a finished plan', …)`:

```ts
  it('records a forecast point when a plan lands and at each day’s close', () => {
    const s = structuredClone(ready());
    applyPlan(s, 's17', { createdDay: 40, reason: 'Lighter for now.', leftOut: [], source: 'offline', days: [] }, 'disengaged');
    expect(s.study.s17.forecasts.map((p) => p.day)).toEqual([40]);
    const r = advance(s, 2, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.study.s17.forecasts.map((p) => p.day)).toEqual([40, 41, 42]);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/live/study/rules.test.ts src/live/study/reducer.test.ts`
Expected: FAIL: `pastForecast` is undefined, `noteForecast`/`forecastSeries` are not exported.

- [ ] **Step 3: Add the types**

In `src/live/types.ts`, add to `StudentProfile` after `evidence: Evidence[];`:

```ts
  /** Seeded forecast points (out of 10) on the days of Quiz 1 and Quiz 2. */
  pastForecast: { day: number; value: number }[];
```

Add to `StudyRecord` after `replans: …;`:

```ts
  /** Forecast points (out of 10): one per plan applied and per closed day. */
  forecasts: { day: number; value: number }[];
```

- [ ] **Step 4: Implement**

`src/live/study/record.ts`: change line 4 to `import { cloMastery, forecast } from './estimate';`, add `forecasts: [],` to the object returned by `newRecord` (after `replans: [],`), and add at the end of the file:

```ts
/** Adds the day's forecast point, replacing one already there for that day. Mutates `rec`. */
export function noteForecast(rec: StudyRecord, student: StudentProfile, day: number): void {
  const point = { day, value: forecast(student, rec).value };
  if (rec.forecasts.at(-1)?.day === day) rec.forecasts[rec.forecasts.length - 1] = point;
  else rec.forecasts.push(point);
}
```

`src/live/study/estimate.ts`, add at the end:

```ts
/** Seeded points, then the recorded ones; a recorded point wins on the same day. */
export function forecastSeries(student: StudentProfile, rec?: StudyRecord | null): { day: number; value: number }[] {
  const byDay = new Map(student.pastForecast.map((p) => [p.day, p.value]));
  for (const p of rec?.forecasts ?? []) byDay.set(p.day, p.value);
  return [...byDay].sort((a, b) => a[0] - b[0]).map(([day, value]) => ({ day, value }));
}
```

`src/live/study/reducer.ts`: change the `./record` import to include `noteForecast`. In `advance`, directly after `s.day += 1;` inside the loop, add:

```ts
    noteForecast(rec, student, s.day);
```

In `applyPlan`, after the `rec.band = …` line, add:

```ts
  noteForecast(rec, studentById(s, studentId)!, s.day);
```

`src/scenario/roster.ts`: add `import { standing } from '../live/study/estimate';` and, in the object returned by `buildRoster`, after `evidence,`:

```ts
      pastForecast: [{ day: 17, value: standing({ mastery }, quiz.q1) }, { day: 38, value: standing({ mastery }, quiz.q2) }],
```

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. TypeScript flags any test that builds a `StudyRecord` or `StudentProfile` object literal by hand: add `forecasts: []` or `pastForecast: []` to that literal.

- [ ] **Step 6: Commit**

```bash
git add src/live src/scenario/roster.ts
git commit -m "feat(study): keep a forecast history, seeded from Quiz 1 and Quiz 2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lecture calendar

**Files:**
- Modify: `src/scenario/course.ts`
- Test: `src/scenario/course.test.ts` (create)

**Interfaces:**
- Produces (in `src/scenario/course.ts`):
  - `interface Lecture { n: number; title: string; day: number; concepts: ConceptId[] }`
  - `LECTURES: Lecture[]`
  - `lectureBefore(day: number, time: string): Lecture | null`
  - `lectureLabel(day: number, time: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/scenario/course.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LECTURES, lectureBefore, lectureLabel, shortDate } from './course';

describe('lectures', () => {
  it('runs one lecture a week on Tuesday, Lectures 1–9', () => {
    expect(LECTURES.map((l) => l.day)).toEqual([1, 8, 15, 22, 29, 36, 43, 50, 57]);
    expect(shortDate(LECTURES[4].day)).toBe('Tue 20 Oct');
    expect(LECTURES[4]).toMatchObject({ n: 5, title: 'Implication', concepts: ['implication'] });
  });
  it('places a message relative to the lecture before it', () => {
    expect(lectureLabel(29, '10:00')).toBe('during Lecture 5');
    expect(lectureLabel(29, '11:20')).toBe('just after Lecture 5');
    expect(lectureLabel(29, '13:30')).toBe('2 hours after Lecture 5');
    expect(lectureLabel(29, '12:05')).toBe('1 hour after Lecture 5');
    expect(lectureLabel(30, '21:40')).toBe('1 day after Lecture 5');
    expect(lectureLabel(31, '08:10')).toBe('2 days after Lecture 5');
    expect(lectureLabel(29, '08:00')).toBe('7 days after Lecture 4');
    expect(lectureLabel(0, '12:00')).toBe('before Lecture 1');
    expect(lectureBefore(0, '12:00')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/scenario/course.test.ts`
Expected: FAIL: `LECTURES` is not exported.

- [ ] **Step 3: Implement**

Append to `src/scenario/course.ts`:

```ts
export interface Lecture { n: number; title: string; day: number; concepts: ConceptId[] }

const LECTURE_START = 9 * 60;
const LECTURE_END = 11 * 60;

/** One lecture a week, Tuesday 09:00–11:00. */
export const LECTURES: Lecture[] = (
  [
    ['Propositions', ['propositions']],
    ['Negation, conjunction, disjunction', ['negation', 'conjunction', 'disjunction']],
    ['Truth tables', ['truthTables']],
    ['Biconditionals and compound expressions', ['biconditional', 'expressions']],
    ['Implication', ['implication']],
    ['Logical equivalence and De Morgan', ['equivalence', 'deMorgan']],
    ['Equivalence laws', ['equivLaws']],
    ['Logic in real problems', ['applications']],
    ['Revision', []],
  ] as [string, ConceptId[]][]
).map(([title, concepts], i) => ({ n: i + 1, title, day: 7 * i + 1, concepts }));

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** The last lecture that had started by this moment, or null before Lecture 1. */
export function lectureBefore(day: number, time: string): Lecture | null {
  const t = minutesOf(time);
  return [...LECTURES].reverse().find((l) => l.day < day || (l.day === day && t >= LECTURE_START)) ?? null;
}

/** "during Lecture 5", "2 hours after Lecture 5", "1 day after Lecture 5", or "before Lecture 1". */
export function lectureLabel(day: number, time: string): string {
  const l = lectureBefore(day, time);
  if (!l) return 'before Lecture 1';
  if (l.day < day) {
    const d = day - l.day;
    return `${d} day${d === 1 ? '' : 's'} after Lecture ${l.n}`;
  }
  const t = minutesOf(time);
  if (t < LECTURE_END) return `during Lecture ${l.n}`;
  const h = Math.floor((t - LECTURE_END) / 60);
  return h < 1 ? `just after Lecture ${l.n}` : `${h} hour${h === 1 ? '' : 's'} after Lecture ${l.n}`;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/scenario/course.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenario/course.ts src/scenario/course.test.ts
git commit -m "feat(scenario): a weekly lecture calendar and lecture-relative labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Previous subjects and GPA

**Files:**
- Create: `src/scenario/grades.ts`
- Modify: `src/live/types.ts` (`StudentProfile`)
- Modify: `src/scenario/roster.ts` (`buildRoster`)
- Test: `src/scenario/grades.test.ts` (create)

**Interfaces:**
- Produces (in `src/scenario/grades.ts`):
  - `interface SubjectGrade { subject: string; term: string; grade: number; letter: string }`
  - `letterOf(grade: number): string`, `pointsOf(grade: number): number`, `gpaOf(history: SubjectGrade[]): number`
  - `historyFor(index: number, topic: number): SubjectGrade[]`
- Produces: `StudentProfile.history: SubjectGrade[]`, `StudentProfile.gpa: number`.

- [ ] **Step 1: Write the failing test**

Create `src/scenario/grades.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seedState } from '../live/seed';
import { gpaOf, historyFor, letterOf, pointsOf } from './grades';

describe('grades', () => {
  it('converts 10-point grades at each boundary', () => {
    expect([10, 8.5, 8.4, 8.0, 7.9, 7.0, 6.9, 6.5, 6.4, 5.5, 5.4, 5.0, 4.9, 4.0, 3.9].map(letterOf))
      .toEqual(['A', 'A', 'B+', 'B+', 'B', 'B', 'C+', 'C+', 'C', 'C', 'D+', 'D+', 'D', 'D', 'F']);
    expect([8.5, 8.0, 7.0, 6.5, 5.5, 5.0, 4.0, 3.9].map(pointsOf)).toEqual([4, 3.5, 3, 2.5, 2, 1.5, 1, 0]);
  });
  it('averages grade points, all subjects 3 credits', () => {
    expect(gpaOf([{ subject: 'A', term: 't', grade: 8.5, letter: 'A' }, { subject: 'B', term: 't', grade: 6.8, letter: 'C+' }])).toBe(3.25);
    expect(gpaOf([])).toBe(0);
  });
  it('gives every student 4–5 subjects, and Minh Anh the C+ in Intro to Logic', () => {
    expect(historyFor(3, 0.7).length).toBeGreaterThanOrEqual(4);
    const s = seedState();
    for (const st of s.students) expect(st.history.length).toBeGreaterThanOrEqual(4);
    const ma = s.students.find((x) => x.id === 's17')!;
    expect(ma.history.find((h) => h.subject === 'Introduction to Logic')).toMatchObject({ grade: 6.8, letter: 'C+' });
    expect(ma.gpa).toBe(gpaOf(ma.history));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/scenario/grades.test.ts`
Expected: FAIL: cannot find module `./grades`.

- [ ] **Step 3: Implement**

Create `src/scenario/grades.ts`:

```ts
export interface SubjectGrade { subject: string; term: string; grade: number; letter: string }

/** The usual Vietnamese 10-point → letter → 4-point mapping. */
const SCALE: [min: number, letter: string, points: number][] = [
  [8.5, 'A', 4], [8.0, 'B+', 3.5], [7.0, 'B', 3], [6.5, 'C+', 2.5], [5.5, 'C', 2], [5.0, 'D+', 1.5], [4.0, 'D', 1], [0, 'F', 0],
];
const row = (grade: number) => SCALE.find(([min]) => grade >= min - 1e-9)!;

export const letterOf = (grade: number): string => row(grade)[1];
export const pointsOf = (grade: number): number => row(grade)[2];

/** Mean grade points; every subject is worth 3 credits. */
export const gpaOf = (history: SubjectGrade[]): number =>
  history.length ? Math.round((history.reduce((a, h) => a + pointsOf(h.grade), 0) / history.length) * 100) / 100 : 0;

const SUBJECTS: { subject: string; term: string; offset: number; every?: number }[] = [
  { subject: 'Calculus 1', term: 'Semester 1 · 2025', offset: 0.4 },
  { subject: 'Introduction to Programming', term: 'Semester 1 · 2025', offset: 0.8 },
  { subject: 'Academic English', term: 'Semester 1 · 2025', offset: 1.0, every: 2 },
  { subject: 'Introduction to Logic', term: 'Semester 2 · 2025', offset: -0.3 },
  { subject: 'Linear Algebra', term: 'Semester 2 · 2025', offset: 0.1 },
];

/** Deterministic previous subjects from the student's index and this course's topic mastery. */
export function historyFor(index: number, topic: number): SubjectGrade[] {
  return SUBJECTS.filter((x) => !x.every || index % x.every === 0).map((x, k) => {
    const jitter = (((index * 13 + k * 7) % 7) - 3) / 10;
    const grade = Math.round(Math.min(10, Math.max(0, 3 + topic * 7 + x.offset + jitter)) * 10) / 10;
    return { subject: x.subject, term: x.term, grade, letter: letterOf(grade) };
  });
}
```

In `src/live/types.ts`, add `import type { SubjectGrade } from '../scenario/grades';` and add to `StudentProfile` after `pastForecast`:

```ts
  /** Previous subjects, 10-point grades. */
  history: SubjectGrade[];
  /** 4-point GPA from `history`. */
  gpa: number;
```

In `src/scenario/roster.ts`, add `import { gpaOf, historyFor, letterOf } from './grades';`. In `buildRoster`, before the `return {`, add:

```ts
    const history = historyFor(s.index, s.mastery).map((h) =>
      isMinhAnh && h.subject === 'Introduction to Logic' ? { ...h, grade: 6.8, letter: letterOf(6.8) } : h);
```

and in the returned object, after `pastForecast`:

```ts
      history,
      gpa: gpaOf(history),
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. Add `history: [], gpa: 0` to any hand-built `StudentProfile` literal TypeScript flags.

- [ ] **Step 5: Commit**

```bash
git add src/scenario/grades.ts src/scenario/grades.test.ts src/scenario/roster.ts src/live/types.ts
git commit -m "feat(scenario): previous subjects and a 4-point GPA for every student

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The student question log and the class FAQ

**Files:**
- Create: `src/scenario/voice.ts`
- Modify: `src/live/types.ts` (`Evidence`)
- Modify: `src/scenario/roster.ts` (`MINH_ANH_EVIDENCE`, `QUIRKS[26]`, `buildRoster`)
- Modify: `src/live/reducer.ts:137-142` (`record`)
- Test: `src/scenario/voice.test.ts` (create)

**Interfaces:**
- Consumes: `lectureBefore`, `lectureLabel`, `weekOf` from `course.ts` (Task 3).
- Produces (in `src/scenario/voice.ts`):
  - `type Channel = 'zalo' | 'email' | 'whatsapp' | 'forum'`, `CHANNEL_LABEL: Record<Channel, string>`
  - `interface VoiceEntry { slug: string; studentIndex: number; channel: Channel; day: number; time: string; vi: string | null; gist: string; concept: ConceptId; faqId: string | null }`
  - `interface FaqEntry { id: string; question: string; confusion: string; concept: ConceptId }`
  - `VOICE: VoiceEntry[]`, `FAQ: FaqEntry[]`
  - `voiceEvidenceId(v: VoiceEntry): string`, `voiceEvidence(v: VoiceEntry): Evidence`, `voiceFor(evidenceId: string): VoiceEntry | undefined`
  - `faqLog(faqId: string): VoiceEntry[]` (newest first)
  - `faqStats(faqId: string): { messages: number; students: number; latestDay: number; timing: string }`
- Produces: `Evidence.day?: number`, `Evidence.time?: string`; practice evidence carries `day`.

- [ ] **Step 1: Write the failing test**

Create `src/scenario/voice.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seedState } from '../live/seed';
import { CONCEPTS } from './knowledgeGraph';
import { FAQ, VOICE, faqLog, faqStats, voiceEvidenceId, voiceFor } from './voice';
import { MESSAGES } from './sources';

describe('the student question log', () => {
  it('points every entry at a real student, concept and FAQ, and every FAQ has entries', () => {
    const concepts = new Set(CONCEPTS.map((c) => c.id));
    for (const v of VOICE) {
      expect(v.studentIndex).toBeGreaterThanOrEqual(0);
      expect(v.studentIndex).toBeLessThan(55);
      expect(concepts.has(v.concept)).toBe(true);
      expect(v.faqId === null || FAQ.some((f) => f.id === v.faqId)).toBe(true);
      expect(v.day).toBeLessThan(40);
    }
    for (const f of FAQ) expect(faqLog(f.id).length).toBeGreaterThan(0);
    expect(new Set(VOICE.map(voiceEvidenceId)).size).toBe(VOICE.length);
  });
  it('lands on each student as message evidence with a day and time', () => {
    const s = seedState();
    const all = s.students.flatMap((x) => x.evidence);
    for (const v of VOICE) expect(all.find((e) => e.id === voiceEvidenceId(v))).toMatchObject({ kind: 'message', day: v.day, time: v.time });
  });
  it('keeps Minh Anh’s two Zalo messages, their ids and their text', () => {
    const ma = seedState().students.find((x) => x.id === 's17')!;
    expect(ma.evidence).toHaveLength(8);
    expect(ma.evidence.filter((e) => e.kind === 'message').map((e) => e.id)).toEqual(['s17-zalo-1', 's17-zalo-2']);
    expect(ma.evidence.find((e) => e.id === 's17-zalo-1')!.text).toBe(`“${MESSAGES[0].vi}” (${MESSAGES[0].evidence})`);
    expect(voiceFor('s17-zalo-1')).toMatchObject({ day: 30, time: '21:40', faqId: 'f-converse' });
  });
  it('computes FAQ figures from the log', () => {
    expect(faqStats('f-converse')).toMatchObject({ messages: 16, students: 13, timing: 'mostly within 2 days of Lecture 5' });
    const log = faqLog('f-converse');
    expect(log[0].day).toBeGreaterThanOrEqual(log.at(-1)!.day);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/scenario/voice.test.ts`
Expected: FAIL: cannot find module `./voice`.

- [ ] **Step 3: Add `day` and `time` to `Evidence`**

In `src/live/types.ts`, inside `interface Evidence`, after `concept?: ConceptId;`:

```ts
  /** Story day the entry happened: log messages and live practice. */
  day?: number;
  /** HH:MM, log messages only. */
  time?: string;
```

- [ ] **Step 4: Create `src/scenario/voice.ts`**

```ts
import type { Evidence } from '../live/types';
import { STUDENTS } from './classroom';
import { lectureBefore, weekOf } from './course';
import type { ConceptId } from './knowledgeGraph';
import { MESSAGES } from './sources';

export type Channel = 'zalo' | 'email' | 'whatsapp' | 'forum';
export const CHANNEL_LABEL: Record<Channel, string> = { zalo: 'Zalo', email: 'Email', whatsapp: 'WhatsApp', forum: 'LMS forum' };

export interface VoiceEntry {
  /** The evidence id is `<studentId>-<slug>`. */
  slug: string;
  studentIndex: number;
  channel: Channel;
  day: number;
  /** HH:MM */
  time: string;
  /** The original, when written in Vietnamese. */
  vi: string | null;
  /** English, one line. */
  gist: string;
  concept: ConceptId;
  faqId: string | null;
}

export interface FaqEntry { id: string; question: string; confusion: string; concept: ConceptId }

export const FAQ: FaqEntry[] = [
  { id: 'f-converse', question: 'Why is p → q not the same as q → p?', confusion: 'Reading an implication as if it worked both ways', concept: 'implication' },
  { id: 'f-vacuous', question: 'Why is p → q true when p is false?', confusion: 'The false-premise rows of the truth table', concept: 'implication' },
  { id: 'f-equiv', question: 'What is the difference between ≡ and ↔?', confusion: 'Telling logical equivalence from the biconditional', concept: 'equivalence' },
  { id: 'f-rows', question: 'How many rows does a truth table need?', confusion: 'Listing every combination of truth values', concept: 'truthTables' },
  { id: 'f-demorgan', question: 'How do I negate an “and” or an “or”?', confusion: 'Applying De Morgan’s laws', concept: 'deMorgan' },
  { id: 'f-negimp', question: 'What is the negation of p → q?', confusion: 'Negating an implication as ¬p → ¬q', concept: 'negation' },
];

type Row = [slug: string, index: number, channel: Channel, day: number, time: string, vi: string | null, gist: string, concept: ConceptId, faqId: string | null];

const MA = 16;
const m = (id: string) => MESSAGES.find((x) => x.id === id)!;

/** Seeded student messages, days 1–39. Fictional demo data. */
const ROWS: Row[] = [
  // Truth tables, around Lecture 3 (day 15) and Quiz 1 (day 17)
  ['voice-1', 3, 'zalo', 15, '21:05', 'Thầy ơi, bảng chân trị có 3 biến thì cần bao nhiêu dòng ạ?', 'How many rows for a three-variable truth table?', 'truthTables', 'f-rows'],
  ['voice-2', 9, 'forum', 16, '10:20', null, 'Do we list truth-table rows in a fixed order?', 'truthTables', 'f-rows'],
  ['voice-3', 22, 'zalo', 16, '20:45', 'Em làm bảng chân trị bị thiếu dòng, có cách nào kiểm tra không ạ?', 'Keeps missing rows in truth tables; how to check?', 'truthTables', 'f-rows'],
  ['voice-4', 35, 'email', 16, '23:10', null, 'Is there a quick way to know how many rows a truth table needs?', 'truthTables', 'f-rows'],
  ['voice-5', 48, 'zalo', 17, '07:40', 'Bảng chân trị 4 biến có phải 16 dòng không ạ?', 'Is a four-variable truth table 16 rows?', 'truthTables', 'f-rows'],
  ['voice-6', 12, 'forum', 15, '13:30', null, 'Why do truth tables start with the all-T row?', 'truthTables', 'f-rows'],
  ['voice-7', 28, 'zalo', 16, '22:00', 'Em vẫn hay nhầm khi điền bảng chân trị.', 'Still mixes up filling in truth tables', 'truthTables', 'f-rows'],
  // The converse, after Lecture 5 (day 29) and Quiz 2 (day 38)
  ['zalo-1', MA, 'zalo', 30, '21:40', m('m1').vi, m('m1').evidence, 'implication', 'f-converse'],
  ['voice-8', 4, 'zalo', 29, '12:15', 'Sao p → q lại không giống q → p vậy thầy?', 'Why is p → q different from q → p?', 'implication', 'f-converse'],
  ['voice-9', 7, 'forum', 29, '19:50', null, 'If p → q is true, does q → p have to be true too?', 'implication', 'f-converse'],
  ['voice-10', 11, 'zalo', 30, '09:05', 'Em tưởng “nếu p thì q” cũng có nghĩa là “nếu q thì p”.', 'Thought “if p then q” also means “if q then p”', 'implication', 'f-converse'],
  ['voice-11', 19, 'email', 30, '14:30', null, 'Question about the converse and the contrapositive in Lecture 5', 'implication', 'f-converse'],
  ['voice-12', 24, 'zalo', 30, '22:20', 'Mệnh đề đảo và mệnh đề phản đảo khác nhau thế nào ạ?', 'How do the converse and the contrapositive differ?', 'implication', 'f-converse'],
  ['voice-13', 31, 'whatsapp', 31, '08:10', 'Em làm sai bài 4 vì nghĩ p → q tương đương q → p.', 'Got exercise 4 wrong by treating p → q as q → p', 'implication', 'f-converse'],
  ['voice-14', 33, 'zalo', 31, '20:35', 'Thầy giải thích lại giúp em ví dụ “trời mưa thì đường ướt” được không ạ?', 'Asks to go over the “if it rains, the road is wet” example again', 'implication', 'f-converse'],
  ['voice-15', 38, 'forum', 30, '16:45', null, 'Is the converse of a true statement always false?', 'implication', 'f-converse'],
  ['voice-16', 42, 'zalo', 29, '21:30', 'p → q với q → p, cái nào đúng ạ?', 'Which is right, p → q or q → p?', 'implication', 'f-converse'],
  ['voice-17', 50, 'email', 31, '11:00', null, 'Confused by the converse question on the Lecture 5 worksheet', 'implication', 'f-converse'],
  ['voice-18', 45, 'whatsapp', 32, '09:30', null, 'Still unsure when an implication can be reversed', 'implication', 'f-converse'],
  ['voice-19', 4, 'zalo', 37, '21:15', 'Thầy ơi, câu đảo có ra trong Quiz 2 không ạ?', 'Will the converse be on Quiz 2?', 'implication', 'f-converse'],
  ['voice-20', 11, 'zalo', 38, '17:20', 'Em lại chọn q → p ở câu 4 Quiz 2 rồi ạ.', 'Chose q → p again on Quiz 2 Q4', 'implication', 'f-converse'],
  ['voice-21', 24, 'forum', 38, '18:05', null, 'Quiz 2 Q4: why is the converse not equivalent?', 'implication', 'f-converse'],
  ['voice-22', 53, 'zalo', 38, '19:40', 'Câu 4 Quiz 2 em không hiểu sao sai.', 'Does not see why Quiz 2 Q4 was wrong', 'implication', 'f-converse'],
  // False premises, after Lecture 5
  ['voice-23', 1, 'forum', 29, '11:40', null, 'Why is “if pigs fly, then 2 + 2 = 5” true?', 'implication', 'f-vacuous'],
  ['voice-24', 6, 'zalo', 29, '20:10', 'Tại sao p sai thì p → q luôn đúng ạ?', 'Why is p → q always true when p is false?', 'implication', 'f-vacuous'],
  ['voice-25', 14, 'email', 30, '08:55', null, 'The false-premise rows of the implication table make no sense to me', 'implication', 'f-vacuous'],
  ['voice-26', 20, 'zalo', 30, '21:05', 'Em thấy hai dòng cuối của bảng p → q rất khó hiểu.', 'Finds the last two rows of the p → q table confusing', 'implication', 'f-vacuous'],
  ['voice-27', 27, 'zalo', 31, '13:15', 'Nếu giả thiết sai thì kết luận có quan trọng không ạ?', 'Does the conclusion matter if the premise is false?', 'implication', 'f-vacuous'],
  ['voice-28', 36, 'forum', 31, '19:25', null, 'Is “vacuously true” going to be on the quiz?', 'implication', 'f-vacuous'],
  ['voice-29', 44, 'zalo', 32, '22:40', 'Em vẫn chưa thấy thuyết phục vì sao F → F lại là T.', 'Not convinced why F → F is T', 'implication', 'f-vacuous'],
  ['voice-30', 52, 'email', 30, '15:10', null, 'Why does a false hypothesis make the implication true?', 'implication', 'f-vacuous'],
  // Negating an implication, after Lecture 5
  ['voice-31', 2, 'zalo', 31, '21:50', 'Phủ định của p → q có phải là ¬p → ¬q không ạ?', 'Is the negation of p → q just ¬p → ¬q?', 'negation', 'f-negimp'],
  ['voice-32', 18, 'forum', 32, '10:05', null, 'How do you negate an implication?', 'negation', 'f-negimp'],
  ['voice-33', 29, 'zalo', 33, '20:30', 'Em không biết phủ định câu “nếu… thì…” thế nào.', 'Unsure how to negate an “if… then…” sentence', 'negation', 'f-negimp'],
  ['voice-34', 47, 'email', 33, '09:15', null, 'Is ¬(p → q) the same as p ∧ ¬q?', 'negation', 'f-negimp'],
  // Equivalence and the biconditional, after Lecture 6 (day 36)
  ['voice-35', 5, 'zalo', 36, '12:30', 'Ký hiệu ≡ và ↔ khác nhau chỗ nào ạ?', 'What is the difference between ≡ and ↔?', 'equivalence', 'f-equiv'],
  ['voice-36', 10, 'forum', 36, '15:20', null, 'Is logical equivalence just a biconditional that is always true?', 'equivalence', 'f-equiv'],
  ['voice-37', 15, 'zalo', 36, '21:10', 'Làm sao chứng minh hai mệnh đề tương đương mà không dùng bảng chân trị ạ?', 'How to prove two statements equivalent without a truth table?', 'equivalence', 'f-equiv'],
  ['voice-38', 23, 'email', 37, '08:40', null, 'When do I write ≡ and when ↔ in proofs?', 'equivalence', 'f-equiv'],
  ['voice-39', 34, 'zalo', 37, '20:55', 'Em hay viết ↔ thay cho ≡, như vậy có bị trừ điểm không ạ?', 'Writes ↔ for ≡; will that lose marks?', 'equivalence', 'f-equiv'],
  ['voice-40', 40, 'forum', 37, '22:15', null, 'Are p → q and ¬q → ¬p logically equivalent?', 'equivalence', 'f-equiv'],
  ['voice-41', 49, 'zalo', 38, '07:55', 'Tương đương logic có cần đúng ở mọi dòng không ạ?', 'Does logical equivalence need to hold on every row?', 'equivalence', 'f-equiv'],
  // De Morgan, after Lecture 6 and Quiz 2
  ['email', 26, 'email', 39, '08:15', m('m3').vi, m('m3').evidence, 'deMorgan', 'f-demorgan'],
  ['voice-42', 8, 'zalo', 36, '22:30', 'Phủ định của “p và q” là “không p và không q” đúng không ạ?', 'Is the negation of “p and q” “not p and not q”?', 'deMorgan', 'f-demorgan'],
  ['voice-43', 13, 'forum', 37, '12:10', null, 'When negating, does ∧ always turn into ∨?', 'deMorgan', 'f-demorgan'],
  ['voice-44', 21, 'zalo', 37, '21:45', 'Em hay quên đổi ∧ thành ∨ khi phủ định.', 'Forgets to swap ∧ and ∨ when negating', 'deMorgan', 'f-demorgan'],
  ['voice-45', 39, 'email', 38, '20:20', null, 'De Morgan question from Quiz 2: how does it work with three terms?', 'deMorgan', 'f-demorgan'],
  ['voice-46', 54, 'zalo', 39, '10:30', 'Luật De Morgan áp dụng cho lượng từ được không ạ?', 'Does De Morgan apply to quantifiers too?', 'deMorgan', 'f-demorgan'],
  // Not a question
  ['zalo-2', MA, 'zalo', 36, '22:10', m('m4').vi, m('m4').evidence, 'truthTables', null],
];

export const VOICE: VoiceEntry[] = ROWS.map(([slug, studentIndex, channel, day, time, vi, gist, concept, faqId]) => ({ slug, studentIndex, channel, day, time, vi, gist, concept, faqId }));

export const voiceEvidenceId = (v: VoiceEntry): string => `${STUDENTS[v.studentIndex].id}-${v.slug}`;

const BY_EVIDENCE = new Map(VOICE.map((v) => [voiceEvidenceId(v), v]));
export const voiceFor = (evidenceId: string): VoiceEntry | undefined => BY_EVIDENCE.get(evidenceId);

export const voiceEvidence = (v: VoiceEntry): Evidence => ({
  id: voiceEvidenceId(v), kind: 'message', source: CHANNEL_LABEL[v.channel],
  text: v.vi ? `“${v.vi}” (${v.gist})` : v.gist,
  when: `Week ${weekOf(v.day)}`, concept: v.concept, day: v.day, time: v.time,
});

const stamp = (v: VoiceEntry) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3));

/** One FAQ entry's messages, newest first. */
export const faqLog = (faqId: string): VoiceEntry[] => VOICE.filter((v) => v.faqId === faqId).sort((a, b) => stamp(b) - stamp(a));

/** Figures computed from the log, so they always agree with it. */
export function faqStats(faqId: string): { messages: number; students: number; latestDay: number; timing: string } {
  const log = faqLog(faqId);
  const placed = log.flatMap((v) => {
    const l = lectureBefore(v.day, v.time);
    return l ? [{ n: l.n, after: v.day - l.day }] : [];
  });
  const counts = new Map<number, number>();
  for (const p of placed) counts.set(p.n, (counts.get(p.n) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  const ds = placed.filter((p) => p.n === top).map((p) => p.after).sort((a, b) => a - b);
  const lo = ds[Math.floor((ds.length - 1) * 0.25)];
  const hi = ds[Math.floor((ds.length - 1) * 0.75)];
  const days = (d: number) => `${d} day${d === 1 ? '' : 's'}`;
  const timing = top === undefined ? 'before Lecture 1'
    : hi === 0 ? `mostly the same day as Lecture ${top}`
    : lo === 0 ? `mostly within ${days(hi)} of Lecture ${top}`
    : lo === hi ? `mostly ${days(lo)} after Lecture ${top}`
    : `mostly ${lo}–${hi} days after Lecture ${top}`;
  return { messages: log.length, students: new Set(log.map((v) => v.studentIndex)).size, latestDay: log[0]?.day ?? 0, timing };
}
```

- [ ] **Step 5: Put the log on the students**

In `src/scenario/roster.ts`:

- Add `import { VOICE, voiceEvidence } from './voice';` and remove the now-unused `MESSAGES` import.
- In `MINH_ANH_EVIDENCE`, replace the two literal `s17-zalo-1` and `s17-zalo-2` lines with:

```ts
  voiceEvidence(VOICE.find((v) => v.slug === 'zalo-1')!),
  voiceEvidence(VOICE.find((v) => v.slug === 'zalo-2')!),
```

- In `QUIRKS`, delete the whole `26: { … }` entry (its email is now in the log with slug `email`).
- In `buildRoster`, directly after the `for (const { slug, ...e } of quirk?.extra ?? [])` line, add:

```ts
    if (!isMinhAnh) {
      for (const v of VOICE.filter((x) => x.studentIndex === s.index).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))) evidence.push(voiceEvidence(v));
    }
```

In `src/live/reducer.ts`, in `record`, add `day: s.day,` to the pushed object after `when: fmt(s.clock),`.

- [ ] **Step 6: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS. `server/agents/tools.test.ts:46-47` still sees 2 messages and 8 entries for Minh Anh.

- [ ] **Step 7: Commit**

```bash
git add src/scenario src/live/types.ts src/live/reducer.ts
git commit -m "feat(scenario): a seeded student question log across the class, and an authored FAQ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Agents read the log, the FAQ, the record and the forecast

**Files:**
- Modify: `server/agents/tools.ts`
- Modify: `server/agents/sas.ts:54`
- Modify: `server/evals/cases.ts` (L2.1, new L2.7)
- Test: `server/agents/tools.test.ts`

**Interfaces:**
- Consumes: `FAQ`, `faqLog`, `faqStats`, `voiceEvidenceId` (Task 5); `lectureLabel` (Task 3); `forecast` (Task 1); `StudentProfile.history`, `gpa` (Task 4).
- Produces: read tool `get_class_questions` (no input) returning `{ id, question, confusion, concept, messages, students, latestDay, timing, evidenceIds: string[] }[]`; `get_student` gains `gpa`, `history`, `forecast: { value, band }`; `get_evidence` adds `lecture` to entries with `day` and `time`.

- [ ] **Step 1: Write the failing tests**

In `server/agents/tools.test.ts`, change the tool list expectation (line 20) to:

```ts
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students', 'get_exam_outlook', 'get_class_questions']);
```

and add:

```ts
describe('student voice', () => {
  it('lists the class questions with figures and the ids behind them', () => {
    const state = seedState();
    const qs = readTool(state, 'get_class_questions', {}) as Array<Record<string, unknown>>;
    const converse = qs.find((q) => q.id === 'f-converse')!;
    expect(converse).toMatchObject({ messages: 16, students: 13, concept: 'implication' });
    expect(converse.evidenceIds).toContain('s17-zalo-1');
    expect(readLabel(state, 'get_class_questions', {})).toBe('Student Analysis Agent · reading what students are asking');
  });
  it('places messages relative to a lecture, and adds the record and forecast to the twin', () => {
    const state = seedState();
    const msgs = readTool(state, 'get_evidence', { student_id: 's17', kind: 'message' }) as Array<Record<string, unknown>>;
    expect(msgs[0]).toMatchObject({ id: 's17-zalo-1', lecture: '1 day after Lecture 5' });
    const t = readTool(state, 'get_student', { student_id: 's17' }) as Record<string, unknown>;
    expect(t).toMatchObject({ forecast: { value: 4.4, band: 'At risk' } });
    expect(t.gpa).toBeGreaterThan(0);
    expect((t.history as unknown[]).length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run server/agents/tools.test.ts`
Expected: FAIL: the tool list lacks `get_class_questions`.

- [ ] **Step 3: Implement**

In `server/agents/tools.ts`:

- Add imports:

```ts
import { forecast } from '../../src/live/study/estimate';
import { lectureLabel } from '../../src/scenario/course';
import { FAQ, faqLog, faqStats, voiceEvidenceId } from '../../src/scenario/voice';
```

(merge `lectureLabel` into the existing `course` import line instead of adding a second one).

- Append to `READ_TOOLS`:

```ts
  tool('get_class_questions', 'What students have been asking on Zalo, email, WhatsApp and the LMS forum, grouped into FAQ entries: the question, what confuses them, the concept, how many students and messages, when they ask relative to the lectures, and the evidence ids of the messages (cite these).', {}),
```

- In `twin`, add after `practicePerWeek: s.practicePerWeek,`:

```ts
    gpa: s.gpa,
    history: s.history,
    forecast: forecast(s, state.study[s.id]),
```

- In `readTool`, replace the `get_evidence` return with:

```ts
      return s.evidence
        .filter((e) => !input.kind || e.kind === input.kind)
        .map(({ result: _result, planId: _planId, ...e }) => (e.day !== undefined && e.time ? { ...e, lecture: lectureLabel(e.day, e.time) } : e));
```

and add a case before `default`:

```ts
    case 'get_class_questions':
      return FAQ.map((f) => ({ ...f, ...faqStats(f.id), evidenceIds: faqLog(f.id).map(voiceEvidenceId) }));
```

- In `readLabel`, add a case:

```ts
    case 'get_class_questions': return `${p} reading what students are asking`;
```

In `server/agents/sas.ts`, at the end of the paragraph on line 54 (after `use find_students with mistake converse.`), add:

```
 When a student's own message explains a gap, cite that message. For what the class or a group is asking or confused about, use get_class_questions and cite the messages behind the entries you mention.
```

- [ ] **Step 4: Add the evals**

In `server/evals/cases.ts`, in L2.1, after the `'cites at least 3 pieces of evidence'` check, add:

```ts
    t.check('Diagnose', 'cites a Zalo message', a.cites.some((c) => c.startsWith('s17-zalo')), a.cites.join(','));
```

After the L2.6 case, add:

```ts
  { id: 'L2.7', level: 2, title: 'Reads what students are asking', run: async (t) => {
    const a = await t.ask('What are students confused about after Lecture 5?', null, 'Diagnose');
    t.check('Diagnose', 'read the class questions', a.steps.some((s) => s.includes('what students are asking')), a.steps.join(' | '));
    const messages = new Set(t.state.students.flatMap((s) => s.evidence.filter((e) => e.kind === 'message').map((e) => e.id)));
    t.check('Diagnose', 'cites a student message', a.cites.some((c) => messages.has(c)), a.cites.join(','));
    t.check('Diagnose', 'names the converse confusion', /converse|q → p|both ways/i.test(a.answer), a.answer);
    t.noPronouns('Diagnose', a.answer);
  } },
```

- [ ] **Step 5: Run the tests**

Run: `npm run typecheck && npx vitest run server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/agents server/evals/cases.ts
git commit -m "feat(agents): read the class questions, lecture timing, previous subjects and the forecast

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Profile data (pure)

**Files:**
- Create: `src/teacher/profile.ts`
- Test: `src/teacher/profile.test.ts` (create)

**Interfaces:**
- Consumes: `Evidence.day/time` (Task 5), plans and conversations from `DemoState`.
- Produces (in `src/teacher/profile.ts`):
  - `type ProfileTab = 'messages' | 'chats' | 'practice' | 'interventions' | 'record' | 'evidence'`
  - `PROFILE_TABS: { id: ProfileTab; label: string }[]`
  - `tabFor(s: StudentProfile, entryId: string | null): ProfileTab`
  - `messagesOf(s: StudentProfile): Evidence[]`
  - `interface ChatLink { id: string; title: string; first: string }`, `chatsAbout(state: DemoState, studentId: string): ChatLink[]`
  - `interface PracticeSession { key: string; day: number; title: string; concepts: string[]; right: number; wrong: number; skipped: number; entryIds: string[] }`, `practiceSessions(state: DemoState, s: StudentProfile): PracticeSession[]`
  - `interface InterventionRow { id: string; kind: string; title: string; status: string; date: string; change: string | null }`, `interventionsOf(state: DemoState, s: StudentProfile): InterventionRow[]`

- [ ] **Step 1: Write the failing test**

Create `src/teacher/profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { chatsAbout, interventionsOf, messagesOf, practiceSessions, tabFor } from './profile';

const ma = (s = stateWithPlan()) => s.students.find((x) => x.id === 's17')!;

describe('profile data', () => {
  it('opens the tab that holds an entry', () => {
    const s = ma();
    expect(tabFor(s, 's17-zalo-1')).toBe('messages');
    expect(tabFor(s, 's17-records')).toBe('record');
    expect(tabFor(s, 's17-quiz2')).toBe('evidence');
    expect(tabFor(s, 'gone')).toBe('messages');
    expect(tabFor(s, null)).toBe('messages');
  });
  it('lists messages newest first', () => {
    expect(messagesOf(ma()).map((e) => e.id)).toEqual(['s17-zalo-2', 's17-zalo-1']);
  });
  it('finds the teacher’s conversations about a student', () => {
    const state = stateWithPlan();
    expect(chatsAbout(state, 's17')).toEqual([{ id: 'c1', title: state.conversations[0].title, first: 'Why did Minh Anh’s quiz score drop?' }]);
    expect(chatsAbout(state, 's2')).toEqual([]);
  });
  it('groups phone practice into sessions with right and wrong tries', () => {
    const state = stateWithPlan('pathway', { status: 'sent' });
    const s = ma(state);
    s.evidence.push(
      { id: 's17-practice-1', kind: 'practice', source: 'Beyond practice', when: '15:31', day: 40, concept: 'implication', text: 'x', result: 'wrong', planId: 'p1' },
      { id: 's17-practice-2', kind: 'practice', source: 'Beyond practice', when: '15:32', day: 40, concept: 'implication', text: 'x', result: 'correct', planId: 'p1' },
    );
    expect(practiceSessions(state, s)).toEqual([{
      key: '40|p1', day: 40, title: 'Rebuild implication, then equivalence', concepts: ['Implication'], right: 1, wrong: 1, skipped: 0, entryIds: ['s17-practice-1', 's17-practice-2'],
    }]);
  });
  it('lists interventions with the mastery change against the baseline', () => {
    const state = stateWithPlan('pathway', { status: 'sent' });
    const s = ma(state);
    state.plans[0].baseline = { ...s.mastery, equivalence: 0.35 };
    s.mastery.equivalence = 0.71;
    expect(interventionsOf(state, s)).toEqual([{ id: 'p1', kind: 'Pathway', title: 'Rebuild implication, then equivalence', status: 'Sent to the phone', date: expect.any(String), change: 'Logical equivalence 0.35 → 0.71' }]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/profile.test.ts`
Expected: FAIL: cannot find module `./profile`. (The literals match the fixture: `stateWithPlan` opens conversation `c1` with "Why did Minh Anh’s quiz score drop?", and the concept labels are "Implication" and "Logical equivalence".)

- [ ] **Step 3: Implement**

Create `src/teacher/profile.ts`:

```ts
import { parseTime } from '../live/clock';
import type { DemoState, Evidence, Plan, PlanStatus, StudentProfile } from '../live/types';
import { shortDate } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';

export type ProfileTab = 'messages' | 'chats' | 'practice' | 'interventions' | 'record' | 'evidence';

export const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'chats', label: 'AI chats' },
  { id: 'practice', label: 'Practice' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'record', label: 'Record' },
  { id: 'evidence', label: 'All evidence' },
];

/** The tab that shows an evidence entry; Messages when there is none. */
export function tabFor(s: StudentProfile, entryId: string | null): ProfileTab {
  const e = entryId ? s.evidence.find((x) => x.id === entryId) : undefined;
  if (!e) return 'messages';
  return e.kind === 'message' ? 'messages' : e.kind === 'practice' ? 'practice' : e.kind === 'record' ? 'record' : 'evidence';
}

const stamp = (e: Evidence) => (e.day ?? -1) * 1440 + (e.time ? parseTime(e.time) ?? 0 : 0);

/** Message evidence, newest first. */
export const messagesOf = (s: StudentProfile): Evidence[] =>
  s.evidence.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'message').sort((a, b) => stamp(b.e) - stamp(a.e) || b.i - a.i).map(({ e }) => e);

export interface ChatLink { id: string; title: string; first: string }

/** The teacher's conversations whose panel or plans name this student, newest first. */
export function chatsAbout(state: DemoState, studentId: string): ChatLink[] {
  return state.conversations
    .filter((c) =>
      c.msgs.some((m) => m.role === 'assistant' && m.panel?.kind === 'student' && m.panel.studentId === studentId)
      || state.plans.some((p) => p.conversationId === c.id && p.studentIds.includes(studentId)))
    .map((c) => {
      const first = c.msgs.find((m) => m.role === 'teacher');
      return { id: c.id, title: c.title, first: first?.role === 'teacher' ? first.text : '' };
    })
    .reverse();
}

export interface PracticeSession { key: string; day: number; title: string; concepts: string[]; right: number; wrong: number; skipped: number; entryIds: string[] }

/** Phone practice grouped by day and plan (or self practice), newest first. */
export function practiceSessions(state: DemoState, s: StudentProfile): PracticeSession[] {
  const out: PracticeSession[] = [];
  for (const e of s.evidence) {
    if (e.kind !== 'practice') continue;
    const day = e.day ?? state.day;
    const key = `${day}|${e.planId ?? 'self'}`;
    let row = out.find((r) => r.key === key);
    if (!row) {
      const plan = e.planId ? state.plans.find((p) => p.id === e.planId) : undefined;
      row = { key, day, title: plan?.title ?? 'Self practice', concepts: [], right: 0, wrong: 0, skipped: 0, entryIds: [] };
      out.push(row);
    }
    const label = e.concept ? conceptById(e.concept).label : null;
    if (label && !row.concepts.includes(label)) row.concepts.push(label);
    if (e.result === 'correct') row.right++;
    else if (e.result === 'wrong') row.wrong++;
    else if (e.result === 'skipped') row.skipped++;
    row.entryIds.push(e.id);
  }
  return out.reverse();
}

const KIND: Record<Plan['kind'], string> = { pathway: 'Pathway', classActivity: 'Class activity', checkIns: 'Check-in' };
const STATUS: Record<PlanStatus, string> = {
  proposed: 'Waiting for you', approved: 'Approved', sent: 'Sent to the phone', done: 'Done', autoApproved: 'Auto-approved', dismissed: 'Set aside',
};

export interface InterventionRow { id: string; kind: string; title: string; status: string; date: string; change: string | null }

/** Plans naming this student, newest first; set-aside plans are left out. */
export function interventionsOf(state: DemoState, s: StudentProfile): InterventionRow[] {
  return state.plans
    .filter((p) => p.studentIds.includes(s.id) && p.status !== 'dismissed')
    .map((p) => {
      const target = p.sessions.at(-1)?.concept ?? null;
      const change = p.kind === 'pathway' && p.baseline && target
        ? `${conceptById(target).label} ${p.baseline[target].toFixed(2)} → ${s.mastery[target].toFixed(2)}`
        : null;
      return { id: p.id, kind: KIND[p.kind], title: p.title, status: STATUS[p.status], date: shortDate(p.date), change };
    })
    .reverse();
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/teacher/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/profile.ts src/teacher/profile.test.ts
git commit -m "feat(teacher): profile data: messages, AI chats, practice sessions and interventions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Forecast chart

**Files:**
- Create: `src/teacher/ForecastChart.tsx`
- Test: `src/teacher/forecastChart.test.tsx` (create)

**Interfaces:**
- Consumes: `PASS`, `KHA`, `GIOI` (Task 1).
- Produces: `ForecastChart({ points, projection, markers }: { points: ChartPoint[]; projection: ChartPoint | null; markers: ChartMarker[] })` with `ChartPoint = { day: number; value: number }`, `ChartMarker = { day: number; label: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/teacher/forecastChart.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ForecastChart } from './ForecastChart';

describe('forecast chart', () => {
  const points = [{ day: 17, value: 6.1 }, { day: 38, value: 4.4 }, { day: 40, value: 4.4 }];
  it('draws the history, the grade lines and the markers', () => {
    const out = html(<ForecastChart points={points} projection={null} markers={[{ day: 52, label: 'Quiz 3' }]} />);
    expect(out).toContain('Pass 4.0');
    expect(out).toContain('Khá 7.0');
    expect(out).toContain('Giỏi 8.5');
    expect(out).toContain('Quiz 3');
    expect(out).toContain('data-series="forecast"');
    expect(out).not.toContain('data-series="projection"');
  });
  it('dashes the projection from the last point to the exam', () => {
    const out = html(<ForecastChart points={points} projection={{ day: 64, value: 6.4 }} markers={[]} />);
    expect(out).toContain('data-series="projection"');
    expect(out).toContain('6.4 if the plan is kept');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/forecastChart.test.tsx`
Expected: FAIL: cannot find module `./ForecastChart`.

- [ ] **Step 3: Implement**

Create `src/teacher/ForecastChart.tsx`:

```tsx
import { GIOI, KHA, PASS } from '../live/study/estimate';
import { EXAM_DAY } from '../scenario/course';
import { egg } from '../ui/theme';

export interface ChartPoint { day: number; value: number }
export interface ChartMarker { day: number; label: string }

const W = 760;
const H = 220;
const LEFT = 28;
const RIGHT = 70;
const TOP = 12;
const BOTTOM = 30;
const x = (day: number) => LEFT + (day / EXAM_DAY) * (W - LEFT - RIGHT);
const y = (v: number) => TOP + (1 - v / 10) * (H - TOP - BOTTOM);
const LINES = [{ v: PASS, label: 'Pass 4.0' }, { v: KHA, label: 'Khá 7.0' }, { v: GIOI, label: 'Giỏi 8.5' }];

/** The forecast out of 10 across the course, with the grade lines and, when there is a plan, the projection to the exam. */
export function ForecastChart({ points, projection, markers }: { points: ChartPoint[]; projection: ChartPoint | null; markers: ChartMarker[] }) {
  const last = points.at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast out of 10 across the course">
      {[0, 5, 10].map((v) => (
        <text key={v} x={LEFT - 8} y={y(v) + 4} fontSize="10" textAnchor="end" fill={egg('mute')}>{v}</text>
      ))}
      <line x1={LEFT} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke={egg('line')} />
      {LINES.map(({ v, label }) => (
        <g key={label}>
          <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke={egg('mute')} strokeDasharray="2 4" />
          <text x={W - RIGHT + 6} y={y(v) + 4} fontSize="11" fill={egg('mute')}>{label}</text>
        </g>
      ))}
      {markers.map((m) => (
        <g key={`${m.day}-${m.label}`}>
          <line x1={x(m.day)} x2={x(m.day)} y1={TOP} y2={y(0)} stroke={egg('line')} />
          <text x={x(m.day)} y={H - BOTTOM + 14} fontSize="10" textAnchor="middle" fill={egg('mute')}>{m.label}</text>
        </g>
      ))}
      {points.length > 1 && (
        <polyline data-series="forecast" points={points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={egg('ink')} strokeWidth="2" />
      )}
      {points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="3" fill={egg('ink')} />)}
      {last && projection && (
        <g>
          <line data-series="projection" x1={x(last.day)} y1={y(last.value)} x2={x(projection.day)} y2={y(projection.value)} stroke={egg('accent-ink')} strokeWidth="2" strokeDasharray="6 5" />
          <text x={x(projection.day) - 4} y={y(projection.value) - 8} fontSize="11" textAnchor="end" fill={egg('accent-ink')}>{`${projection.value.toFixed(1)} if the plan is kept`}</text>
        </g>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/teacher/forecastChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/ForecastChart.tsx src/teacher/forecastChart.test.tsx
git commit -m "feat(teacher): a forecast chart with pass, Khá and Giỏi lines and a dashed projection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Student profile pop-up and its entry points

**Files:**
- Create: `src/teacher/voiceParts.tsx`
- Create: `src/teacher/StudentProfile.tsx`
- Modify: `src/live/LiveContext.tsx` (`LiveCtx.openProfile`)
- Modify: `src/live/fixtures.ts:67-69` (`ctxFor`)
- Modify: `src/teacher/LiveTeacher.tsx`
- Modify: `src/teacher/LivePanel.tsx` (export `EvidenceList`)
- Modify: `src/teacher/LiveText.tsx` (student chips open the pop-up)
- Modify: `src/teacher/Classroom.tsx` (`pick` in live mode)
- Test: `src/teacher/profile.dom.test.tsx` (create)

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5, 7, 8.
- Produces:
  - `LiveCtx.openProfile(studentId: string, entryId?: string | null): void`
  - `voiceParts.tsx`: `metaOf(e: Evidence): string`, `Words({ e })`, `MessageRow({ e, lit, rowRef? })`
  - `StudentProfile({ studentId, entryId, onClose, onAsk, onOpenChat })`

- [ ] **Step 1: Write the failing test**

Create `src/teacher/profile.dom.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import type { DemoSource } from '../live/source';
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

async function mount(state = stateWithPlan()) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const dialog = (el: HTMLElement) => el.querySelector('[role="dialog"]');

describe('student profile pop-up', () => {
  it('opens from a student citation on the tab holding the entry, and closes', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[0].cites = ['s17-quiz2'];
    const m = await mount(s);
    await click(m.el.querySelector('[data-cite="s17-quiz2"]')!);
    expect(dialog(m.el)?.getAttribute('aria-label')).toBe('Nguyễn Minh Anh');
    expect(button(m.el, 'All evidence').getAttribute('aria-current')).toBe('true');
    expect(dialog(m.el)!.querySelector('[data-evidence="s17-quiz2"]')!.getAttribute('style')).toContain('background');
    await click(button(m.el, 'Close'));
    expect(dialog(m.el)).toBeNull();
  });
  it('opens from the classroom roster and shows the record, chart and chats', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    await click(m.el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    const d = dialog(m.el)!;
    expect(d.textContent).toContain('GPA');
    expect(d.textContent).toContain('Pass 4.0');
    expect(d.textContent).toContain('Em vẫn chưa hiểu');
    await click(button(m.el, 'Record'));
    expect(dialog(m.el)!.textContent).toContain('Introduction to Logic');
    await click(button(m.el, 'AI chats'));
    await click([...dialog(m.el)!.querySelectorAll('button')].find((b) => b.textContent?.includes('Why did Minh Anh'))!);
    expect(dialog(m.el)).toBeNull();
  });
  it('closes on Escape', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    await click(m.el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(dialog(m.el)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/profile.dom.test.tsx`
Expected: FAIL: no `[role="dialog"]` after clicking.

- [ ] **Step 3: Add `openProfile` to the live context**

`src/live/LiveContext.tsx`, inside `LiveCtx` after `showPanel(…)`:

```ts
  /** Opens a student's profile pop-up, at an evidence entry when one is given. Local to this window. */
  openProfile(studentId: string, entryId?: string | null): void;
```

`src/live/fixtures.ts`, in `ctxFor`, add `openProfile: () => {},` after `showPanel: () => {},`.

- [ ] **Step 4: Create `src/teacher/voiceParts.tsx`**

```tsx
import type { Evidence } from '../live/types';
import { lectureLabel, shortDate } from '../scenario/course';
import { voiceFor } from '../scenario/voice';
import { egg } from '../ui/theme';

/** "Zalo · Wed 21 Oct · 21:40 · 1 day after Lecture 5": where and when an entry came from. */
export function metaOf(e: Evidence): string {
  const when = e.day !== undefined && e.time ? `${shortDate(e.day)} · ${e.time} · ${lectureLabel(e.day, e.time)}` : e.when;
  return `${e.source} · ${when}`;
}

/** An entry in the student's words: the original, then the English gist. Spans only, so it fits inside a <p> or a <button>. */
export function Words({ e }: { e: Evidence }) {
  const v = voiceFor(e.id);
  if (!v) return <span className="block text-[14px] text-egg-ink">{e.text}</span>;
  return (
    <>
      {v.vi && <span className="block text-[14px] text-egg-ink">{`“${v.vi}”`}</span>}
      <span className={`block ${v.vi ? 'text-[12.5px] text-egg-mute' : 'text-[14px] text-egg-ink'}`}>{v.vi ? v.gist : `“${v.gist}”`}</span>
    </>
  );
}

export function MessageRow({ e, lit, rowRef }: { e: Evidence; lit: boolean; rowRef?: (el: HTMLLIElement | null) => void }) {
  return (
    <li ref={rowRef} data-entry={e.id} className="py-2.5" style={lit ? { background: egg('accent', 0.18) } : undefined}>
      <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{metaOf(e)}</span>
      <Words e={e} />
    </li>
  );
}
```

- [ ] **Step 5: Export `EvidenceList`**

In `src/teacher/LivePanel.tsx`, change `function EvidenceList(` to `export function EvidenceList(`.

- [ ] **Step 6: Create `src/teacher/StudentProfile.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useLive } from '../live/LiveContext';
import { forecast, forecastSeries, projection } from '../live/study/estimate';
import type { StudentProfile as Profile } from '../live/types';
import { ASSESSMENTS, EXAM_DAY, shortDate } from '../scenario/course';
import { egg } from '../ui/theme';
import { ForecastChart, type ChartMarker } from './ForecastChart';
import { EvidenceList } from './LivePanel';
import { Avatar, Button, Eyebrow } from './parts';
import { chatsAbout, interventionsOf, messagesOf, practiceSessions, PROFILE_TABS, tabFor, type ProfileTab } from './profile';
import { MessageRow } from './voiceParts';

const SHORT: Record<string, string> = { quiz1: 'Quiz 1', a1: 'A1', quiz2: 'Quiz 2', a2: 'A2', quiz3: 'Quiz 3', exam: 'Exam' };

export interface ProfileProps {
  studentId: string;
  entryId: string | null;
  onClose(): void;
  onAsk(s: Profile): void;
  onOpenChat(conversationId: string): void;
}

/** One student's full picture over the teacher screen. Local UI only: nothing is posted, no tokens are spent. */
export function StudentProfile({ studentId, entryId, onClose, onAsk, onOpenChat }: ProfileProps) {
  const live = useLive();
  const s = live?.state.students.find((x) => x.id === studentId);
  const [tab, setTab] = useState<ProfileTab>(() => (s ? tabFor(s, entryId) : 'messages'));
  const hi = useRef<HTMLElement | null>(null);
  useEffect(() => { if (s) setTab(tabFor(s, entryId)); }, [studentId, entryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { hi.current?.scrollIntoView?.({ block: 'center' }); }, [tab, entryId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!live || !s) return null;

  const state = live.state;
  const rec = state.study[s.id];
  const now = forecast(s, rec);
  const lit = (id: string) => id === entryId;
  const keep = (id: string) => (id === entryId ? (el: HTMLElement | null) => { hi.current = el; } : undefined);
  const markers: ChartMarker[] = [
    ...ASSESSMENTS.map((a) => ({ day: a.day, label: SHORT[a.id] ?? a.title })),
    ...state.plans
      .filter((p) => p.studentIds.includes(s.id) && ['sent', 'autoApproved', 'done', 'approved'].includes(p.status) && p.kind !== 'classActivity')
      .map((p) => ({ day: p.date, label: p.kind === 'pathway' ? 'Pathway' : 'Check-in' })),
  ];
  const empty = (text: string) => <div className="py-6 text-[14px] text-egg-mute">{text}</div>;

  const body = (() => {
    switch (tab) {
      case 'messages': {
        const list = messagesOf(s);
        return list.length ? <ul className="divide-y divide-egg-line">{list.map((e) => <MessageRow key={e.id} e={e} lit={lit(e.id)} rowRef={keep(e.id)} />)}</ul> : empty('No messages yet');
      }
      case 'chats': {
        const list = chatsAbout(state, s.id);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenChat(c.id)} className="block w-full py-2.5 text-left hover:bg-egg-card/60">
                  <span className="block text-[14px] font-semibold text-egg-ink">{c.title}</span>
                  <span className="block text-[12.5px] text-egg-mute">{c.first}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : empty(`No AI chats about ${s.short} yet`);
      }
      case 'practice': {
        const list = practiceSessions(state, s);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((p) => {
              const on = entryId !== null && p.entryIds.includes(entryId);
              return (
                <li key={p.key} ref={on ? (el) => { hi.current = el; } : undefined} data-entry={on ? entryId : undefined} className="py-2.5" style={on ? { background: egg('accent', 0.18) } : undefined}>
                  <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${shortDate(p.day)} · ${p.concepts.join(', ')}`}</span>
                  <span className="block text-[14px] font-semibold text-egg-ink">{p.title}</span>
                  <span className="block text-[12.5px] text-egg-mute">{`${p.right} right · ${p.wrong} wrong tr${p.wrong === 1 ? 'y' : 'ies'}${p.skipped ? ` · ${p.skipped} skipped` : ''}`}</span>
                </li>
              );
            })}
          </ul>
        ) : empty('No practice on the phone yet');
      }
      case 'interventions': {
        const list = interventionsOf(state, s);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((r) => (
              <li key={r.id} className="py-2.5">
                <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${r.kind} · ${r.date} · ${r.status}`}</span>
                <span className="block text-[14px] font-semibold text-egg-ink">{r.title}</span>
                {r.change && <span className="block text-[12.5px] text-egg-mute">{r.change}</span>}
              </li>
            ))}
          </ul>
        ) : empty('No interventions yet');
      }
      case 'record':
        return (
          <>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left font-mono text-[10.5px] uppercase tracking-wide text-egg-mute"><th className="py-1.5 font-normal">Subject</th><th className="font-normal">Term</th><th className="font-normal">Grade</th><th className="font-normal">Letter</th></tr>
              </thead>
              <tbody className="divide-y divide-egg-line">
                {s.history.map((h) => (
                  <tr key={h.subject} className="text-egg-ink"><td className="py-2">{h.subject}</td><td className="text-egg-mute">{h.term}</td><td className="tabular-nums">{h.grade.toFixed(1)}</td><td>{h.letter}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[13.5px] font-semibold text-egg-ink">{`GPA ${s.gpa.toFixed(2)} of 4`}</div>
            <ul className="mt-3 divide-y divide-egg-line">{s.evidence.filter((e) => e.kind === 'record').map((e) => <MessageRow key={e.id} e={e} lit={lit(e.id)} rowRef={keep(e.id)} />)}</ul>
          </>
        );
      case 'evidence':
        return <EvidenceList entries={s.evidence} highlight={entryId} />;
    }
  })();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-egg-ink/40 p-8 font-sans" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={s.name} className="flex max-h-full w-[920px] flex-col overflow-hidden rounded-3xl bg-egg-bg text-egg-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-egg-line px-7 py-5">
          <Avatar name={s.name} size={52} accent={s.status === 'highRisk'} />
          <div className="min-w-0">
            <div className="text-[20px] font-semibold">{s.name}</div>
            <div className="text-[13px] text-egg-mute">{`Discrete Mathematics · Group ${s.group} · GPA ${s.gpa.toFixed(2)}`}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-egg-line px-2.5 py-0.5 text-[12px]">{`Forecast ${now.value.toFixed(1)} · ${now.band}`}</span>
            <Button kind="primary" onClick={() => onAsk(s)}>{`Ask about ${s.short}`}</Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7">
          <div className="mt-5">
            <Eyebrow>Forecast out of 10 · an estimate</Eyebrow>
            <ForecastChart points={forecastSeries(s, rec)} projection={rec?.plan ? { day: EXAM_DAY, value: projection(s, rec, state.day) } : null} markers={markers} />
          </div>
          <div className="mt-5 flex gap-1 border-b border-egg-ink/80">
            {PROFILE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'true' : undefined}
                className={`rounded-t-lg px-3 py-1.5 text-[13px] ${tab === t.id ? 'bg-egg-ink text-egg-card' : 'text-egg-mute hover:text-egg-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2">{body}</div>
        </div>
      </div>
    </div>
  );
}
```

If the project's ESLint does not know the `react-hooks/exhaustive-deps` rule, drop that comment.

- [ ] **Step 7: Wire it into the live teacher window**

`src/teacher/LiveTeacher.tsx`:

- Add `import { StudentProfile } from './StudentProfile';` and `import type { StudentProfile as Profile } from '../live/types';` (merge with the existing `LivePanel` type import).
- After the `toast` state, add:

```ts
  const [profile, setProfile] = useState<{ studentId: string; entryId: string | null } | null>(null);
```

- In the epoch-change block, after `setLocal([]);`, add `setProfile(null);`.
- Replace the `askStudent` action with one that shares a helper, defined above `const actions`:

```ts
  const askAbout = (s: { index: number; name: string }) =>
    void ask(s.index === MINH_ANH.index ? CANNED_TOPICS.student.prompt : `How is ${s.name} doing?`, null);
```

and in `actions`: `askStudent: (s: Student) => askAbout(s),`.
- Change the context line to:

```ts
  const ctx: LiveCtx = {
    state, activeId, post, openConversation: switchTo, showPanel, toast: showToast,
    openProfile: (studentId, entryId = null) => setProfile({ studentId, entryId }),
  };
```

- After `<TeacherScreen … />`, add:

```tsx
      {profile && (
        <StudentProfile
          studentId={profile.studentId}
          entryId={profile.entryId}
          onClose={() => setProfile(null)}
          onAsk={(s: Profile) => { setProfile(null); askAbout(s); }}
          onOpenChat={(id) => { setProfile(null); switchTo(id); }}
        />
      )}
```

- [ ] **Step 8: Route the entry points**

`src/teacher/LiveText.tsx`: inside `LiveText`, add

```ts
  const open = (id: string) => {
    if (!live) return;
    if (id.startsWith('class-')) live.showPanel(panelForEvidence(id));
    else live.openProfile(id.split('-')[0], id);
  };
```

and change the chip's `onClick` to `onClick={() => open(id)}`.

`src/teacher/Classroom.tsx`: change the `pick` line in the classroom component to:

```ts
  const pick = (i: number) => (live ? live.openProfile(students[i].id) : actions?.select(cls.selected === i ? null : i));
```

- [ ] **Step 9: Run the tests**

Run: `npm run typecheck && npx vitest run src/teacher src/live`
Expected: PASS, including the existing click audit (its "classroom with a student open" scenario now audits the pop-up's buttons). If the existing test `a class chip carries its highlight to the panel` fails, the class branch of `open` is wrong: it must call `showPanel(panelForEvidence(id))` exactly as before.

- [ ] **Step 10: Commit**

```bash
git add src/live/LiveContext.tsx src/live/fixtures.ts src/teacher
git commit -m "feat(teacher): a student profile pop-up from the classroom and from citations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Quote cards in answers

**Files:**
- Modify: `src/teacher/voiceParts.tsx` (add `QuoteCard`)
- Modify: `src/teacher/LiveText.tsx`
- Test: `src/teacher/profile.dom.test.tsx`

**Interfaces:**
- Consumes: `Words`, `openProfile` (Task 9); `lectureLabel` (Task 3).
- Produces: `QuoteCard({ e, name, onOpen }: { e: Evidence; name: string; onOpen(): void })`, rendered with `data-quote={e.id}`.

- [ ] **Step 1: Write the failing test**

Append to `src/teacher/profile.dom.test.tsx`:

```tsx
describe('quotes in answers', () => {
  it('quotes up to two cited messages under the block and opens the profile at one', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[0].cites = ['s17-quiz2', 's17-zalo-1', 's17-zalo-2', 's5-voice-8'];
    const m = await mount(s);
    const quotes = [...m.el.querySelectorAll('[data-quote]')].map((q) => q.getAttribute('data-quote'));
    expect(quotes).toEqual(['s17-zalo-1', 's17-zalo-2']);
    expect(m.el.querySelector('[data-quote="s17-zalo-1"]')!.textContent).toContain('Zalo · Nguyễn Minh Anh · Wed 21 Oct · 1 day after Lecture 5');
    await click(m.el.querySelector('[data-quote="s17-zalo-1"]')!);
    expect(dialog(m.el)!.querySelector('[data-entry="s17-zalo-1"]')!.getAttribute('style')).toContain('background');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/profile.dom.test.tsx`
Expected: FAIL: no `[data-quote]` elements.

- [ ] **Step 3: Implement**

Append to `src/teacher/voiceParts.tsx`:

```tsx
/** A cited message under an answer block: the student's words, then who and when. */
export function QuoteCard({ e, name, onOpen }: { e: Evidence; name: string; onOpen(): void }) {
  const when = e.day !== undefined && e.time ? ` · ${shortDate(e.day)} · ${lectureLabel(e.day, e.time)}` : ` · ${e.when}`;
  return (
    <button type="button" data-quote={e.id} onClick={onOpen} className="mt-2 block w-full rounded-xl border-l-4 border-egg-accent bg-egg-card px-3 py-2 text-left hover:bg-egg-tint">
      <Words e={e} />
      <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${e.source} · ${name}${when}`}</span>
    </button>
  );
}
```

In `src/teacher/LiveText.tsx`, add `import { QuoteCard } from './voiceParts';`, and inside `LiveText` add:

```ts
  const studentOf = (id: string) => live?.state.students.find((s) => s.id === id.split('-')[0]);
  const quotes = block.cites
    .flatMap((id) => {
      const e = id.startsWith('class-') ? undefined : studentOf(id)?.evidence.find((x) => x.id === id);
      return e?.kind === 'message' ? [e] : [];
    })
    .slice(0, 2);
```

and after the chips' `))}` and before the closing `</>`:

```tsx
      {quotes.map((e) => <QuoteCard key={e.id} e={e} name={studentOf(e.id)?.name ?? ''} onOpen={() => open(e.id)} />)}
```

The test's `s5-voice-8` is a real message but the third one, so it stays a chip only.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/teacher`
Expected: PASS. The click audit covers the quote buttons through the existing conversation scenario once its answer cites a message.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/voiceParts.tsx src/teacher/LiveText.tsx src/teacher/profile.dom.test.tsx
git commit -m "feat(teacher): quote cited student messages under the answer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: "In their words" in the student panel

**Files:**
- Modify: `src/teacher/LivePanel.tsx` (`StudentLive`, new `TheirWords`)
- Test: `src/teacher/livePanel.test.tsx`

**Interfaces:**
- Consumes: `MessageRow` (Task 9), `openProfile` (Task 9).

- [ ] **Step 1: Write the failing test**

Append to the `describe('live panels', …)` block in `src/teacher/livePanel.test.tsx`:

```ts
  it('puts the student’s own words above concept mastery, and hides the section when there are none', () => {
    const out = render(stateWithPlan(), student());
    expect(out).toContain('In their words');
    expect(out.indexOf('In their words')).toBeLessThan(out.indexOf('Concept mastery'));
    expect(out).toContain('See all');
    expect(out.indexOf('data-entry="s17-zalo-2"')).toBeLessThan(out.indexOf('data-entry="s17-zalo-1"'));
    const quiet = stateWithPlan();
    const st = quiet.students.find((x) => x.id === 's17')!;
    st.evidence = st.evidence.filter((e) => e.kind !== 'message' && e.kind !== 'taNote');
    expect(render(quiet, student())).not.toContain('In their words');
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/teacher/livePanel.test.tsx`
Expected: FAIL: output lacks "In their words".

- [ ] **Step 3: Implement**

In `src/teacher/LivePanel.tsx`, add `import { MessageRow } from './voiceParts';` and add above `StudentLive`:

```tsx
/** The latest three messages and TA notes, so practice rows never push the student's own words out of sight. */
function TheirWords({ s }: { s: StudentProfile }) {
  const live = useLive();
  const words = [...s.evidence].reverse().filter((e) => e.kind === 'message' || e.kind === 'taNote').slice(0, 3);
  if (words.length === 0) return null;
  return (
    <Section title="In their words" aside={<button type="button" onClick={() => live?.openProfile(s.id)} className="hover:text-egg-ink hover:underline">See all</button>}>
      <ul className="divide-y divide-egg-line">{words.map((e) => <MessageRow key={e.id} e={e} lit={false} />)}</ul>
    </Section>
  );
}
```

In `StudentLive`, insert `<TheirWords s={s} />` directly before `<Section title="Concept mastery" …>`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/teacher`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/LivePanel.tsx src/teacher/livePanel.test.tsx
git commit -m "feat(teacher): the student's own words near the top of the student panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: "What students are asking" on the Classroom tab

**Files:**
- Create: `src/teacher/ClassQuestions.tsx`
- Modify: `src/teacher/Classroom.tsx` (aside, before `Heatmap`)
- Test: `src/teacher/profile.dom.test.tsx`

**Interfaces:**
- Consumes: `FAQ`, `faqLog`, `faqStats`, `voiceEvidenceId`, `CHANNEL_LABEL` (Task 5); `lectureBefore`, `lectureLabel` (Task 3); `openProfile`, `Words` (Task 9).

- [ ] **Step 1: Write the failing test**

Append to `src/teacher/profile.dom.test.tsx`:

```tsx
describe('what students are asking', () => {
  it('sits above the heatmap, expands one entry into its log, and opens a student from it', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    const html = m.el.innerHTML;
    expect(html.indexOf('What students are asking')).toBeGreaterThan(-1);
    expect(html.indexOf('What students are asking')).toBeLessThan(html.indexOf('data-heatmap'));
    const row = [...m.el.querySelectorAll('button')].find((b) => b.textContent?.includes('Why is p → q not the same as q → p?'))!;
    expect(row.textContent).toContain('13 students · 16 messages');
    expect(row.textContent).toContain('mostly within 2 days of Lecture 5');
    await click(row);
    expect(m.el.querySelectorAll('[data-log-entry]')).toHaveLength(16);
    await click([...m.el.querySelectorAll('[data-log-entry] button')].find((b) => b.textContent === 'Nguyễn Minh Anh')!);
    expect(dialog(m.el)!.querySelector('[data-entry="s17-zalo-1"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Mark the heatmap and run the test to see it fail**

In `src/teacher/Classroom.tsx`, find the root `<section …>` element returned by the `Heatmap` component and add the attribute `data-heatmap` to it (no other change).

Run: `npx vitest run src/teacher/profile.dom.test.tsx`
Expected: FAIL: "What students are asking" is not in the page.

- [ ] **Step 3: Implement**

Create `src/teacher/ClassQuestions.tsx`:

```tsx
import { useState } from 'react';
import { useLive } from '../live/LiveContext';
import { lectureBefore, lectureLabel, shortDate } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';
import { CHANNEL_LABEL, FAQ, faqLog, faqStats, voiceEvidenceId } from '../scenario/voice';
import { Words } from './voiceParts';

/** The class FAQ, authored in the seed data, with figures computed from the message log. Live only; no tokens. */
export function ClassQuestions() {
  const live = useLive();
  const [open, setOpen] = useState<string | null>(null);
  if (!live) return null;
  const rows = FAQ.map((f) => ({ f, st: faqStats(f.id) })).sort((a, b) => b.st.students - a.st.students);
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
        <h3 className="font-serif text-[26px] leading-none">What students are asking</h3>
        <span className="text-[12px] text-egg-mute">Zalo, email, WhatsApp, LMS forum</span>
      </div>
      <ul className="divide-y divide-egg-line">
        {rows.map(({ f, st }) => (
          <li key={f.id}>
            <button type="button" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)} className="block w-full py-2.5 text-left hover:bg-egg-card/60">
              <span className="block text-[14px] font-semibold text-egg-ink">{f.question}</span>
              <span className="block text-[12.5px] text-egg-mute">{`${st.students} students · ${st.messages} messages · ${conceptById(f.concept).label} · ${st.timing}`}</span>
            </button>
            {open === f.id && (
              <ul className="mb-3 space-y-2 border-l-2 border-egg-line pl-3">
                {faqLog(f.id).map((v) => {
                  const student = live.state.students[v.studentIndex];
                  const id = voiceEvidenceId(v);
                  const e = student.evidence.find((x) => x.id === id);
                  const lecture = lectureBefore(v.day, v.time);
                  return (
                    <li key={id} data-log-entry={id} className="text-[13px]">
                      <span className="block">
                        <button type="button" onClick={() => live.openProfile(student.id, id)} className="font-semibold text-egg-ink hover:underline">{student.name}</button>
                        <span className="text-egg-mute">{` · ${CHANNEL_LABEL[v.channel]} · ${shortDate(v.day)} · ${v.time}`}</span>
                      </span>
                      {e && <Words e={e} />}
                      <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${lectureLabel(v.day, v.time)}${lecture ? ` · ${lecture.title}` : ''}`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

In `src/teacher/Classroom.tsx`, add `import { ClassQuestions } from './ClassQuestions';` and, in the aside, directly before `{cls.kpi > 0 && <Heatmap …/>}`, add:

```tsx
            {live && cls.kpi > 0 && <ClassQuestions />}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/teacher`
Expected: PASS. The scripted screen tests (`screen.test.tsx`, `script.test.ts`) still pass because the section renders only when `useLive()` is non-null.

- [ ] **Step 5: Commit**

```bash
git add src/teacher/ClassQuestions.tsx src/teacher/Classroom.tsx src/teacher/profile.dom.test.tsx
git commit -m "feat(teacher): what students are asking, above the heatmap, with the full log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Click audit, full verification and spec touch-up

**Files:**
- Modify: `src/teacher/liveAudit.test.tsx` (`SCENARIOS`)
- Modify: `docs/superpowers/specs/2026-11-01-student-voice-design.md` (5.4 tabs)

- [ ] **Step 1: Extend the click audit**

In `src/teacher/liveAudit.test.tsx`, add to `SCENARIOS`:

```ts
  ['profile pop-up on the Record tab', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    await click(byText(el, 'Record'));
  }],
  ['classroom with a question open', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(buttons(el).find((b) => b.textContent?.includes('Why is p → q not the same as q → p?'))!);
  }],
```

- [ ] **Step 2: Run the audit**

Run: `npx vitest run src/teacher/liveAudit.test.tsx`
Expected: PASS. A failure names the button that "did nothing": make that button change the page or remove it.

- [ ] **Step 3: Record the extra tab in the spec**

In `docs/superpowers/specs/2026-11-01-student-voice-design.md`, section 5.4, after the **Record** tab bullet add:

```markdown
  - **All evidence:** every entry, newest first, as in the student panel. A citation of a quiz, LMS, attendance or TA-note entry opens here, since no other tab holds those.
```

- [ ] **Step 4: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all clean. Then run the free control eval to check the graders still load:

Run: `npm run eval -- --offline --only L2.1,L2.7,L6.6,L6.7`
Expected: the run completes; offline graders failing most checks is normal for the control run.

- [ ] **Step 5: Real-API evals (ask the user first: about $0.15)**

Run: `npm run eval -- --only L2.1,L2.7,L6.6,L6.7`
Expected: L2.1, L2.7 and L6.7 pass. L6.6's figures change because the forecast no longer counts the plan. Report the results file path under `docs/evals/` to the user.

- [ ] **Step 6: Run the booth and look**

Run: `npm run booth`, open the teacher window, then check by hand:
1. Ask "Why did Minh Anh's quiz score drop?": a Zalo quote card appears under a bullet.
2. Click the quote: the pop-up opens on Messages at that message. The chart shows Pass, Khá and Giỏi lines.
3. Classroom tab: "What students are asking" sits above the heatmap; expanding the converse entry shows 16 messages.
4. On the phone, set up Minh Anh with 30/60 minutes: Today reads "At risk" with "4.4 out of 10"; the pop-up's chart now shows a dashed projection.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/liveAudit.test.tsx docs/superpowers/specs/2026-11-01-student-voice-design.md
git commit -m "test(teacher): audit the profile pop-up and the class questions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
