# Student Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the student their own loop on the phone: pick who they are, start practice themselves with adaptively chosen questions, review Anki-style cards, and follow an agent-written study plan worked backward from the fixed exam date.

**Architecture:** Pure rules in `src/live/study/` handle cards, question choice, estimates, carry-over and replan signals. A new Study Planning Agent (`server/agents/study.ts`) writes the semester plan on setup and only on a drastic signal, with an offline planner as fallback. All study data lives in `DemoState.study`, so the existing SSE snapshot sync, reset and refresh keep working. `DemoState.day` adds a real date to the story clock.

**Tech Stack:** Existing: TypeScript strict, React 18, Vite 5, Tailwind 3, Vitest 2 + happy-dom, Hono 4, `@anthropic-ai/sdk` 1.3.0. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-student-learning-loop-design.md`

## Global Constraints

- Scripted video mode must not change: contact-sheet frames stay byte-identical, and every existing scripted test keeps passing.
- Language: English. Generated and written copy never assumes students' pronouns; use the student's name.
- Day 0 is Monday 21 September. The demo starts on day 40 (`START_DAY`, Sat 31 Oct). The exam is day 64 (`EXAM_DAY`, Tue 24 Nov). Exam dates are fixed.
- Teacher-approved plans keep using the original 37 questions (`core: true`) and behave as they do today.
- Agents never change a teacher plan. Study plans need no approval.
- Replanning happens only on setup, `markSwing`, `disengaged`, `bandChange` or `teacherPlan`; at most one per 5 story days, with `markSwing` and `teacherPlan` bypassing the cooldown.
- "Next day" and "Next week" are always instant; replans run in the background.
- Agent requests use the existing `runAgent` (strict tools, auto tool choice, 25 s timeout, `fallbacks: 'default'`).
- Phone colours: egg tokens only (`src/student/palette.test.ts`).
- Never read, print or stage `.env.local`. Stage files by name; never `git add -A`. The working tree holds the user's deletion of `.env.local.example` and an untracked `.env.local copy.example`: leave both alone.
- Real API calls happen only in the steps that say so.

## Before you start

Work on branch `live-booth`. Baseline: `npm test` = 304 passing.

## File map

**Shared rules and data**
- `src/scenario/course.ts` — calendar, assessments, CLOs, Bloom levels, date helpers.
- `src/scenario/practiceBank.ts` — `clo`, `bloom`, `core`, `equivTo` on items.
- `src/scenario/practiceExtra.ts` — the added questions.
- `src/scenario/cards.ts` — the flip-card deck.
- `src/live/study/cards.ts`, `select.ts`, `estimate.ts`, `capacity.ts`, `today.ts`, `marks.ts`, `signals.ts`, `outlook.ts` — pure rules.
- `src/live/study/record.ts` — creating and updating a `StudyRecord`.
- `src/live/study/reducer.ts` — phone study transitions and day rollover.

**Server**
- `server/agents/study.ts` — Study Planning Agent.
- `server/agents/cannedStudy.ts` — offline planner.
- Modify `server/session.ts`, `server/app.ts`, `server/agents/tools.ts`, `samples.ts`, `sas.ts`, `tas.ts`, `adapt.ts`, `canned.ts`, `orchestrate.ts`.

**Clients**
- `src/student/studyView.ts` — view helpers.
- `src/student/screens/StudyScreens.tsx` — Pick, Setup, Today, Practise, Cards, Semester, Check-in, tab bar.
- Modify `src/student/LivePhone.tsx`, `liveView.ts`, `screens/LockScreen.tsx`, `screens/LivePractice.tsx`, `src/teacher/LivePanel.tsx`, `TeacherScreen.tsx`, `src/controller/BoothPanel.tsx`.

**Eval**
- Modify `server/evals/cases.ts`, `harness.ts`, `run.ts`.

---

### Task 1: Commit the eval suite and fix the three agent weaknesses

**Files:**
- Modify: `server/agents/sas.ts`, `server/agents/tas.ts`, `server/evals/cases.ts`
- Commit as-is first: `server/evals/`, `docs/evals/`, `package.json`
- Test: `server/agents/agents.test.ts`

**Interfaces:** No new exports.

- [ ] **Step 1: Commit the existing eval suite and results**

```bash
git add server/evals docs/evals package.json
git commit -m "test(evals): agent eval suite, control run and first results"
```

- [ ] **Step 2: Write the failing test**

Add to `server/agents/agents.test.ts`:

```ts
describe('prompts carry the eval fixes', () => {
  it('SAS keeps plain facts plan-free and knows the plan limits', () => {
    expect(SAS_SYSTEM).toContain('A factual lookup (a score, a count, a list) never sets needs_plan.');
    expect(SAS_SYSTEM).toContain('limited to 4 sessions and 45 minutes');
    expect(SAS_SYSTEM).toContain('Never describe a plan’s length or contents');
  });
  it('TAS changes only what was asked when revising', () => {
    expect(TAS_SYSTEM).toContain('change only what the lecturer asked');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/agents/agents.test.ts`
Expected: FAIL on the two new tests.

- [ ] **Step 4: Update the prompts**

In `SAS_SYSTEM` (`server/agents/sas.ts`), replace the sentence beginning `Set needs_plan when the lecturer asks what to do or who needs them personally, or when one student or the class has a clear gap a short intervention would address.` with:

```
Set needs_plan only when the lecturer asks what to do, asks for a plan, asks who needs them personally, or asks why a student or group is struggling. A factual lookup (a score, a count, a list) never sets needs_plan. A plan is drafted separately by the Teaching Assistance Agent and is limited to 4 sessions and 45 minutes in total. Never describe a plan’s length or contents in your answer; only say one is ready. If the lecturer asks for more than the limit, say so.
```

In `TAS_SYSTEM` (`server/agents/tas.ts`), replace `If an open plan is given, revise it to do what the lecturer asked and keep everything else.` with:

```
If an open plan is given, change only what the lecturer asked and keep every other session exactly as it is. Do not add, remove or reorder sessions unless asked.
```

- [ ] **Step 5: Tighten eval case L4.3**

In `server/evals/cases.ts`, replace the check named `` `cycle ${cycles}: reports this cycle, not the first baseline` `` with:

```ts
      t.check('Adapt', `cycle ${cycles}: reports this cycle, not the first baseline`, !textOf(msg).includes(r.before.toFixed(2)), textOf(msg).slice(0, 200));
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/agents/sas.ts server/agents/tas.ts server/agents/agents.test.ts server/evals/cases.ts
git commit -m "fix(agents): plain facts stay plan-free, state plan limits, revise only what was asked"
```

The controller then runs `npm run eval` against the real API (about $1). L4.3 is expected to fail on the baseline until Task 2.

---

### Task 2: Course calendar, a date in the state, and the per-plan baseline

**Files:**
- Create: `src/scenario/course.ts`, `src/scenario/course.test.ts`
- Modify: `src/live/types.ts`, `src/live/seed.ts`, `src/live/plans.ts`, `src/live/reducer.ts`, `src/live/fixtures.ts`, `server/agents/tas.ts`, `adapt.ts`, `canned.ts`, `orchestrate.ts`, `sas.ts`, `tools.ts`, `src/student/liveView.ts`, `src/student/LivePhone.tsx`, `src/student/screens/LockScreen.tsx`, `src/teacher/TeacherScreen.tsx`
- Modify tests that use `phone.before`: `src/live/reducer.test.ts`, `server/agents/orchestrate.test.ts`, `src/live/plans.test.ts`

**Interfaces:**
- Produces in `course.ts`: `START_DAY`, `EXAM_DAY`, `REVISION_START`, `studyDays(today)`, `type CloId`, `type Bloom`, `Clo`, `CLOS`, `cloOf(concept)`, `Assessment`, `ASSESSMENTS`, `fullDate(day)`, `shortDate(day)`, `weekOf(day)`, `isWeekend(day)`, `resolveDay(label, today)`, `relativeDay(day, today)`, `nextAssessment(today)`.
- `DemoState.day: number`; `Plan.date: number`; `Plan.baseline: Mastery | null`. `PhoneState.before` is removed.

- [ ] **Step 1: Write the failing test**

Create `src/scenario/course.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ASSESSMENTS, CLOS, EXAM_DAY, REVISION_START, START_DAY, cloOf, fullDate, nextAssessment, relativeDay, resolveDay, shortDate, studyDays, weekOf } from './course';
import { CONCEPTS } from './knowledgeGraph';

describe('course calendar', () => {
  it('places the story and the exam on the right dates', () => {
    expect(fullDate(START_DAY)).toBe('Saturday, 31 October');
    expect(shortDate(EXAM_DAY)).toBe('Tue 24 Nov');
    expect(weekOf(START_DAY)).toBe(6);
    expect(weekOf(EXAM_DAY)).toBe(10);
    expect(weekOf(REVISION_START)).toBe(9);
    expect(fullDate(REVISION_START)).toBe('Monday, 16 November');
    expect(studyDays(START_DAY)).toHaveLength(24);
    expect(studyDays(EXAM_DAY)).toEqual([]);
  });
  it('fixes every assessment date', () => {
    expect(ASSESSMENTS.map((a) => shortDate(a.day))).toEqual(['Thu 8 Oct', 'Fri 16 Oct', 'Thu 29 Oct', 'Fri 6 Nov', 'Thu 12 Nov', 'Tue 24 Nov']);
    expect(nextAssessment(START_DAY)?.id).toBe('a2');
  });
  it('resolves day labels against today', () => {
    expect(resolveDay('Today', 40)).toBe(40);
    expect(resolveDay('Tomorrow', 40)).toBe(41);
    expect(resolveDay('Thursday', 40)).toBe(45);
    expect(resolveDay('Saturday', 40)).toBe(47);
    expect(resolveDay('nonsense', 40)).toBe(40);
    expect(relativeDay(40, 40)).toBe('Today');
    expect(relativeDay(41, 40)).toBe('Tomorrow');
    expect(relativeDay(45, 40)).toBe('Thu 5 Nov');
  });
});

describe('CLOs', () => {
  it('cover every concept once, span 3 consecutive Bloom levels and add to 100%', () => {
    expect(CLOS.flatMap((c) => c.concepts).sort()).toEqual(CONCEPTS.map((c) => c.id).sort());
    const ladder = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
    for (const c of CLOS) {
      const i = ladder.indexOf(c.levels[0]);
      expect(c.levels).toEqual(ladder.slice(i, i + 3));
    }
    expect(CLOS.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1);
    expect(cloOf('applications').id).toBe('CLO3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenario/course.test.ts`
Expected: FAIL — cannot resolve `./course`.

- [ ] **Step 3: Write `src/scenario/course.ts`**

```ts
import type { ConceptId } from './knowledgeGraph';

/** Day 0 is Monday 21 September. The story starts at the end of Week 6. */
export const START_DAY = 40;
/** The final exam, Tuesday 24 November (Week 10). */
export const EXAM_DAY = 64;
/** Monday of Week 9, the revision week. */
export const REVISION_START = 56;

const toDate = (day: number) => new Date(Date.UTC(2026, 8, 21 + day));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fullDate = (day: number): string => {
  const d = toDate(day);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const shortDate = (day: number): string => {
  const d = toDate(day);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};
export const weekOf = (day: number): number => Math.floor(day / 7) + 1;
export const isWeekend = (day: number): boolean => day % 7 >= 5;

/** Every day from `today` to the day before the exam. */
export const studyDays = (today: number): number[] => Array.from({ length: Math.max(0, EXAM_DAY - today) }, (_, i) => today + i);

/** "Today", "Tomorrow" or a weekday name → a day number. Unknown labels mean today. */
export function resolveDay(label: string, today: number): number {
  const l = label.trim().toLowerCase();
  if (l === 'tomorrow') return today + 1;
  const i = WEEKDAYS.findIndex((w) => w.toLowerCase() === l);
  if (i < 0) return today;
  const ahead = (i - toDate(today).getUTCDay() + 7) % 7;
  return today + (ahead === 0 ? 7 : ahead);
}

export const relativeDay = (day: number, today: number): string =>
  day === today ? 'Today' : day === today + 1 ? 'Tomorrow' : shortDate(day);

export type CloId = 'CLO1' | 'CLO2' | 'CLO3';
export type Bloom = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface Clo {
  id: CloId;
  title: string;
  concepts: ConceptId[];
  /** Three consecutive Bloom levels, lowest first. */
  levels: [Bloom, Bloom, Bloom];
  /** Share of the final exam. */
  share: number;
}

export const CLOS: Clo[] = [
  {
    id: 'CLO1', title: 'Express and evaluate logical statements', share: 0.4, levels: ['Remember', 'Understand', 'Apply'],
    concepts: ['propositions', 'negation', 'conjunction', 'disjunction', 'implication', 'biconditional', 'truthTables', 'expressions'],
  },
  { id: 'CLO2', title: 'Establish logical equivalence', share: 0.4, levels: ['Understand', 'Apply', 'Analyze'], concepts: ['equivalence', 'deMorgan', 'equivLaws'] },
  { id: 'CLO3', title: 'Reason about real problems with logic', share: 0.2, levels: ['Apply', 'Analyze', 'Evaluate'], concepts: ['applications'] },
];

export const cloOf = (concept: ConceptId): Clo => CLOS.find((c) => c.concepts.includes(concept))!;

export interface Assessment { id: string; title: string; day: number; clos: CloId[] }

export const ASSESSMENTS: Assessment[] = [
  { id: 'quiz1', title: 'Quiz 1', day: 17, clos: ['CLO1'] },
  { id: 'a1', title: 'Assignment 1', day: 25, clos: ['CLO1'] },
  { id: 'quiz2', title: 'Quiz 2', day: 38, clos: ['CLO1', 'CLO2'] },
  { id: 'a2', title: 'Assignment 2', day: 46, clos: ['CLO2'] },
  { id: 'quiz3', title: 'Quiz 3', day: 52, clos: ['CLO2', 'CLO3'] },
  { id: 'exam', title: 'Final exam', day: EXAM_DAY, clos: ['CLO1', 'CLO2', 'CLO3'] },
];

export const nextAssessment = (today: number): Assessment | null => ASSESSMENTS.find((a) => a.day >= today) ?? null;
```

- [ ] **Step 4: Add the date and baseline to the types and seed**

In `src/live/types.ts`:
- In `Plan`, add after `day: string;`:

```ts
  /** The day number `day` resolved to when the plan was drafted. */
  date: number;
  /** Mastery when the plan reached the phone; adapt reports the change against this. */
  baseline: Mastery | null;
```

- In `PhoneState`, delete the `before` field and its comment.
- In `DemoState`, add after `clock`:

```ts
  /** Story date: day 0 is Monday 21 September. */
  day: number;
```

In `src/live/seed.ts`, import `START_DAY` from `../scenario/course`, remove `before: null,` from `IDLE_PHONE`, and add `day: START_DAY,` after `clock: STORY_START,`.

In `src/live/fixtures.ts`: import `resolveDay, START_DAY` from `../scenario/course`, and change `planFor` to:

```ts
export const planFor = (kind: PlanKind, over: Partial<Plan> = {}): Plan => {
  const base = BASE[kind]();
  return { ...base, date: resolveDay(base.day, START_DAY), baseline: null, id: 'p1', status: 'proposed', conversationId: 'c1', ...over };
};
```

- [ ] **Step 5: Use the date in the reducer and plan checks**

In `src/live/plans.ts`, replace `plan.day === 'Today' && t <= state.clock` with `plan.date === state.day && t <= state.clock`, and widen `type PlanContext = Pick<DemoState, 'clock' | 'day' | 'students'>;`.

In `src/live/reducer.ts`:

Replace `deliver` with:

```ts
/**
 * Puts `plan` on the phone and records its baseline. A fresh delivery shows the lock-screen notification;
 * a follow-up keeps the current screen and the finished plan, so the progress screen still shows that result.
 */
export function deliver(s: DemoState, plan: Plan, updated: boolean): void {
  const student = studentById(s, plan.studentIds[0]);
  plan.baseline = student ? { ...student.mastery } : null;
  s.phone = {
    ...IDLE_PHONE,
    done: [],
    planId: plan.id,
    screen: updated ? s.phone.screen : 'lock',
    lastDone: updated ? s.phone.lastDone : null,
    updated,
  };
}
```

Replace `moveClockTo` with:

```ts
/** Opening a session moves the story to it: forward to its date, then forward to its time. */
function moveClockTo(s: DemoState, plan: Plan, time: string) {
  if (plan.date > s.day) {
    s.day = plan.date;
    s.clock = 0;
  }
  const t = parseTime(time);
  if (plan.date === s.day && t !== null && t > s.clock) s.clock = t;
}
```

- [ ] **Step 6: Set the date when plans are drafted; adapt reads the baseline**

In `server/agents/tas.ts`:
- Import `resolveDay` from `../../src/scenario/course`.
- Add `today: number` to `type Meta`.
- In `toPlan`, compute `const day = dayOf(r.day);` and return `day, date: resolveDay(day, meta.today), baseline: null,` in place of the current `day:` field.
- In `checkPlan`, pass `today: state.day` in the meta.
- In `tasMessages`, change the story-time line to `` `Story time now: ${fullDate(state.day)}, ${fmt(state.clock)} (day "Today").` `` (import `fullDate`).

In `server/agents/adapt.ts`: pass `today: state.day` to `toPlan`, and in `adaptMessages` use `` `Story time now: ${fullDate(state.day)}, ${fmt(state.clock)}.` ``.

In `server/agents/canned.ts`, add `date: resolveDay(<the plan's day>, state.day), baseline: null` to each plan built in `cannedPlan` and to the follow-up in `cannedAdapt` (`date: state.day + 1`), importing `resolveDay`.

In `server/agents/orchestrate.ts`, in `adaptAfterCheck`, replace the `before` line with:

```ts
  const before = plan.baseline ?? studentById(state, plan.studentIds[0])!.mastery;
```

and set the stamp with `stamp: stampOf(state)`, adding:

```ts
/** A plain time on the story's first day, otherwise the date too. */
const stampOf = (s: DemoState) => (s.day === START_DAY ? fmt(s.clock) : `${shortDate(s.day)} · ${fmt(s.clock)}`);
```

(import `START_DAY, shortDate` from `../../src/scenario/course`).

In `server/agents/sas.ts`, replace `` `Story time: ${fmt(state.clock)} on Saturday 31 October.` `` with `` `Story time: ${fmt(state.clock)} on ${fullDate(state.day)}.` ``. The existing test expects `Story time: 15:00`, which still holds.

In `server/agents/tools.ts`, in `overview`, add `date: fullDate(state.day),` after `now`.

- [ ] **Step 7: Use the date on screens**

In `src/student/screens/LockScreen.tsx`, add a prop `date = 'Saturday, 31 October'` and render `{date}` in the date line. Scripted callers pass nothing.

In `src/student/LivePhone.tsx`, pass `date={fullDate(state.day)}` to `LockScreen` (import from `../scenario/course`).

In `src/teacher/TeacherScreen.tsx`, replace the live eyebrow with `` `${fullDate(live.state.day)} · ${fmt(live.state.clock)}` `` and keep the scripted string.

In `src/student/liveView.ts`:
- `planView`: `heading: `Learning pathway · ${relativeDay(plan.date, state.day).toLowerCase()}``, `items: … when: `${relativeDay(plan.date, state.day)} ${s.time}``, `canSkip: plan.date === state.day && …`.
- `notificationCopy`: use `relativeDay(plan.date, state.day).toLowerCase()` for the day word.
- `progressView`: `from: Math.round((plan.baseline?.[target] ?? student.mastery[target]) * 100)`.

- [ ] **Step 8: Update the tests that used `phone.before`, and add the baseline test**

- `src/live/reducer.test.ts`: replace `expect(s.phone.before).toEqual(ma(s).mastery);` with `expect(s.plans[0].baseline).toEqual(ma(s).mastery);`, and remove `before` from any `toMatchObject`.
- `server/agents/orchestrate.test.ts`: in `after()`, replace `s.phone.before = { ...MASTERY_INITIAL };` with `s.plans[0].baseline = { ...MASTERY_INITIAL };`.
- `src/live/plans.test.ts`: change `planProblems({ ...p, day: 'Tomorrow' }, state)` to `planProblems({ ...p, day: 'Tomorrow', date: 41 }, state)`.

Add to `src/live/reducer.test.ts`:

```ts
describe('dates', () => {
  it('a follow-up keeps its own baseline, and opening it moves the story to its date', () => {
    const first = ok(approvePlan(stateWithPlan(), 'p1'));
    const s = structuredClone(first);
    s.students[16].mastery.equivalence = 0.65;
    const follow = planFor('pathway', { id: 'p2', day: 'Tomorrow', date: 41, status: 'autoApproved' });
    s.plans.push(follow);
    deliver(s, s.plans[1], true);
    expect(s.plans[1].baseline?.equivalence).toBe(0.65);
    expect(s.plans[0].baseline?.equivalence).toBe(0.35);
    const opened = ok(phoneOpen(s, 0));
    expect(opened.day).toBe(41);
    expect(opened.clock).toBe(15 * 60 + 30);
  });
});
```

(import `deliver` and `planFor`).

- [ ] **Step 9: Run tests**

Run: `npm test && npm run typecheck`
Expected: PASS. If another test breaks only because a plan literal lacks `date` and `baseline`, add them.

- [ ] **Step 10: Commit**

```bash
git add src/scenario/course.ts src/scenario/course.test.ts src/live src/student server/agents src/teacher/TeacherScreen.tsx
git commit -m "feat(live): course calendar, a real date in the state, and per-plan baselines"
```

The controller re-runs `npm run eval -- --only L4.3,L4.1` against the real API. The second-cycle update should now report that cycle.

---

### Task 3: Bloom-tagged questions and flip cards

**Files:**
- Modify: `src/scenario/practiceBank.ts`
- Create: `src/scenario/practiceExtra.ts`, `src/scenario/cards.ts`, `src/scenario/logic.ts`, `src/scenario/content.bloom.test.ts`
- Modify test: `src/scenario/practiceBank.test.ts` (only if a count changes; see Step 4)

**Interfaces:**
- `BankItem` gains `clo: CloId`, `bloom: Bloom`, `core: boolean`, `equivTo?: string`.
- `Card { id, concept, clo, bloom, front, back }`, `CARDS: Card[]`.
- `evalFormula(text, env)`, `sameTruth(a, b)` in `logic.ts`.
- `sessionItems` uses only `core` items, so teacher plans are unchanged.

**How the content is written:** the implementer writes the questions and cards; this task fixes their shape and the rules, and the tests enforce them. A reviewer then checks every answer key and hint by hand.

- [ ] **Step 1: Write the formula checker**

Create `src/scenario/logic.ts`:

```ts
type Env = Record<string, boolean>;

/** A small parser for p, q, r formulas with ¬ ∧ ∨ → ↔ and parentheses. Throws on anything else. */
export function evalFormula(text: string, env: Env): boolean {
  const tokens = text.replace(/\s+/g, '').split('');
  let i = 0;
  const peek = () => tokens[i];
  const atom = (): boolean => {
    const t = tokens[i++];
    if (t === '¬') return !atom();
    if (t === '(') {
      const v = iff();
      if (tokens[i++] !== ')') throw new Error(`Unbalanced: ${text}`);
      return v;
    }
    if (t === undefined || !(t in env)) throw new Error(`Not a formula: ${text}`);
    return env[t];
  };
  const and = (): boolean => {
    let v = atom();
    while (peek() === '∧') { i++; const r = atom(); v = v && r; }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (peek() === '∨') { i++; const r = and(); v = v || r; }
    return v;
  };
  const imp = (): boolean => {
    const v = or();
    if (peek() !== '→') return v;
    i++;
    const r = imp();
    return !v || r;
  };
  function iff(): boolean {
    let v = imp();
    while (peek() === '↔') { i++; const r = imp(); v = v === r; }
    return v;
  }
  const out = iff();
  if (i !== tokens.length) throw new Error(`Trailing input: ${text}`);
  return out;
}

const VALUES = [true, false];

/** Whether two formulas over p, q, r agree on every row of the truth table. */
export function sameTruth(a: string, b: string): boolean {
  for (const p of VALUES) for (const q of VALUES) for (const r of VALUES) {
    if (evalFormula(a, { p, q, r }) !== evalFormula(b, { p, q, r })) return false;
  }
  return true;
}
```

- [ ] **Step 2: Write the failing content test**

Create `src/scenario/content.bloom.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { CLOS, cloOf } from './course';
import { CONCEPTS } from './knowledgeGraph';
import { evalFormula, sameTruth } from './logic';
import { BANK, sessionItems } from './practiceBank';

describe('formula checker', () => {
  it('evaluates and compares formulas', () => {
    expect(evalFormula('p → q', { p: true, q: false })).toBe(false);
    expect(sameTruth('p → q', '¬p ∨ q')).toBe(true);
    expect(sameTruth('p → q', 'q → p')).toBe(false);
    expect(sameTruth('¬(p ∧ q)', '¬p ∨ ¬q')).toBe(true);
    expect(() => evalFormula('Yes', { p: true })).toThrow();
  });
});

describe('question bank', () => {
  it('has exactly 2 questions per Bloom level of each concept’s CLO', () => {
    for (const concept of CONCEPTS) {
      for (const level of cloOf(concept.id).levels) {
        const n = BANK.filter((i) => i.concept === concept.id && i.bloom === level).length;
        expect(n, `${concept.id} ${level}`).toBe(2);
      }
    }
    expect(BANK).toHaveLength(72);
  });
  it('tags every question with its concept’s CLO, and only its levels', () => {
    for (const i of BANK) {
      expect(i.clo, i.id).toBe(cloOf(i.concept).id);
      expect(cloOf(i.concept).levels, i.id).toContain(i.bloom);
    }
  });
  it('has unique ids and one hint per wrong option', () => {
    expect(new Set(BANK.map((i) => i.id)).size).toBe(BANK.length);
    for (const i of BANK) {
      expect(i.hints, i.id).toHaveLength(i.options.length);
      i.hints.forEach((h, n) => expect(n === i.correct ? h === '' : h.length > 10, `${i.id} hint ${n}`).toBe(true));
    }
  });
  it('checks every stated equivalence by truth table', () => {
    const checked = BANK.filter((i) => i.equivTo);
    expect(checked.length).toBeGreaterThanOrEqual(12);
    for (const i of checked) {
      i.options.forEach((o, n) => expect(sameTruth(i.equivTo!, o), `${i.id} option ${n}: ${o}`).toBe(n === i.correct));
    }
  });
  it('keeps teacher plans on the original 37 questions', () => {
    expect(BANK.filter((i) => i.core)).toHaveLength(37);
    for (const c of CONCEPTS) for (const check of [true, false]) expect(sessionItems(c.id, check).every((i) => i.core), c.id).toBe(true);
  });
});

describe('cards', () => {
  it('has 4 cards per concept at the CLO’s lower two levels', () => {
    for (const concept of CONCEPTS) {
      const cards = CARDS.filter((c) => c.concept === concept.id);
      expect(cards, concept.id).toHaveLength(4);
      for (const c of cards) {
        expect(c.clo).toBe(cloOf(concept.id).id);
        expect(cloOf(concept.id).levels.slice(0, 2), c.id).toContain(c.bloom);
      }
    }
    expect(CARDS).toHaveLength(48);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(48);
  });
  it('every card has a real front and back', () => {
    for (const c of CARDS) {
      expect(c.front.length, c.id).toBeGreaterThan(10);
      expect(c.back.length, c.id).toBeGreaterThan(5);
    }
  });
  it('covers each CLO', () => {
    for (const clo of CLOS) expect(CARDS.some((c) => c.clo === clo.id)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/scenario/content.bloom.test.ts`
Expected: FAIL — cannot resolve `./cards`.

- [ ] **Step 4: Tag the original questions**

In `src/scenario/practiceBank.ts`:

1. Import `cloOf`, `type Bloom`, `type CloId` from `./course`, and `EXTRA_ITEMS` from `./practiceExtra`.
2. Add to `BankItem`:

```ts
  clo: CloId;
  /** Difficulty, as a Bloom level of the concept's CLO. */
  bloom: Bloom;
  /** One of the original items teacher plans use. */
  core: boolean;
  /** The option formulas are compared with this by truth table: only the correct one may match. */
  equivTo?: string;
```

3. Keep the `item()` calls unchanged, renaming the array `ORIGINAL`, typed `Omit<BankItem, 'clo' | 'bloom' | 'core'>[]`, and make `item()` return that shape.
4. Add a tag table that assigns each of the 37 originals one of its CLO's three Bloom levels, with at most 2 originals per level per concept, for example:

```ts
const TAGS: Record<string, { bloom: Bloom; equivTo?: string }> = {
  'propositions-1': { bloom: 'Remember' },
  'implication-1': { bloom: 'Understand', equivTo: 'p → q' },
  // …one entry for each of the 37 items…
};
```

Set `equivTo` on every original whose prompt asks for a formula equivalent to a stated one and whose options are all formulas.

5. Build the bank and keep the existing helpers working:

```ts
export const BANK: BankItem[] = [
  ...ORIGINAL.map((i) => ({ ...i, ...TAGS[i.id], clo: cloOf(i.concept).id, core: true })),
  ...EXTRA_ITEMS,
];

export const BANK_CONCEPTS: ConceptId[] = [...new Set(BANK.map((i) => i.concept))];
export const itemsFor = (c: ConceptId): BankItem[] => BANK.filter((i) => i.concept === c && i.core);
export const itemById = (id: string): BankItem | undefined => BANK.find((i) => i.id === id);
```

`itemsFor` stays core-only, so `sessionItems` and the existing bank tests are unchanged, except that the existing test `has unique ids and one hint per wrong option` still reads `BANK`. If that test or `covers all 12 concepts` depends on the old array length, leave its assertions as they are: they hold for the larger bank.

- [ ] **Step 5: Write the added questions**

Create `src/scenario/practiceExtra.ts` exporting `EXTRA_ITEMS: BankItem[]`: the 35 questions that bring every concept to exactly 2 per Bloom level. Rules:

- Ids are `<concept>-x<n>`. `core: false`.
- `clo` from `cloOf`, `bloom` from the level being filled.
- 2–4 options. `hints` has one entry per option: `''` for the correct one, and for each wrong one a specific reason, preferably a counterexample row, never a bare "wrong".
- Bloom means what it says. Remember: recall a definition or name. Understand: explain or restate. Apply: use a rule on a new expression. Analyze: compare structures, or find where a derivation or argument fails. Evaluate (CLO3): judge which formulation or argument is sound, and why.
- Where options are all formulas over p, q, r and the question asks for an equivalent, set `equivTo`.
- `guided` is optional. Do not reuse the prompt of an existing item.
- Scenarios are neutral and avoid pronouns for people.

Example of the shape:

```ts
{
  id: 'deMorgan-x1', concept: 'deMorgan', clo: 'CLO2', bloom: 'Analyze', core: false,
  prompt: 'A student rewrites ¬(p ∨ ¬q) as ¬p ∨ q. Which is the correct rewrite?',
  options: ['¬p ∧ q', '¬p ∨ q', 'p ∧ ¬q', 'p ∨ ¬q'], correct: 0, equivTo: '¬(p ∨ ¬q)',
  hints: ['', 'Negating ∨ gives ∧: check p = F, q = F.', 'Negate each part: ¬¬q is q, not ¬q.', 'That is the original with the negation removed.'],
},
```

- [ ] **Step 6: Write the cards**

Create `src/scenario/cards.ts`:

```ts
import { cloOf, type Bloom, type CloId } from './course';
import type { ConceptId } from './knowledgeGraph';

export interface Card {
  id: string;
  concept: ConceptId;
  clo: CloId;
  bloom: Bloom;
  front: string;
  back: string;
}

const card = (concept: ConceptId, n: number, bloom: Bloom, front: string, back: string): Card => ({
  id: `card-${concept}-${n}`, concept, clo: cloOf(concept).id, bloom, front, back,
});

export const CARDS: Card[] = [
  card('implication', 1, 'Remember', 'What is the contrapositive of p → q?', '¬q → ¬p. It always has the same truth table as p → q.'),
  // …4 cards per concept, 48 in total…
];
```

Four cards per concept: the two lower Bloom levels of the concept's CLO, split roughly evenly. A front is one question; a back is the answer plus, where useful, a short reason. No pronouns for people.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/scenario`
Expected: PASS. A failed truth-table check means an answer key or option is wrong: fix the content, not the test.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/scenario/practiceBank.ts src/scenario/practiceExtra.ts src/scenario/cards.ts src/scenario/logic.ts src/scenario/content.bloom.test.ts
git commit -m "feat(content): Bloom-tagged question bank and 48 flip cards, with truth-table checks"
```

---

### Task 4: Study types and the pure rule engines

**Files:**
- Modify: `src/live/types.ts`, `src/live/seed.ts`
- Create: `src/live/study/record.ts`, `cards.ts`, `select.ts`, `estimate.ts`, `capacity.ts`, `today.ts`, `marks.ts`, `signals.ts`
- Test: `src/live/study/rules.test.ts`

**Interfaces:**
- Consumes: `course.ts`, `practiceBank.ts` (`BANK`), `cards.ts` (scenario), `EDGES`.
- Produces (types in `types.ts`): `CardRating`, `CardState`, `StudyDay`, `Attempt`, `StudyPlanDay`, `StudyPlan`, `ReplanSignal`, `PassBand`, `StudyRecord`, `SelfSession`; `DemoState.study`; `PhoneState.studentId/morning/self`; extended `PhoneScreen`.
- `record.ts`: `MINUTES`, `newRecord(student)`, `ensureRecord(state, studentId)`, `logMinutes(rec, day, minutes)`, `noteAttempt(rec, item, day, correct, firstTry)`.
- `cards.ts`: `reviewCard(card, rating, today)`, `cardsToday(rec, today, focus)`, `NEW_PER_DAY`.
- `select.ts`: `nextItem(rec, student, today, concepts, served)`, `SELF_SESSION`.
- `estimate.ts`: `cloMastery(student, cloId)`, `passEstimate(student, rec, today)`, `bandOf(score)`, `minutesNeeded(student)`, `PASS_MARK`.
- `capacity.ts`: `capacityFor(rec, day, today?)`, `applyCheck(feel, check)`, `teacherMinutes(state, studentId)`, `capacityLeft(state, studentId, day)`, `shortOfTime(state, studentId)`.
- `today.ts`: `TodayRow`, `todayList(state, studentId)`.
- `marks.ts`: `markFor(student, assessment)`.
- `signals.ts`: `detectSignal(rec, today, band, newMark, previousMark)`, `mayReplan(rec, signal, today)`, `nextReplan(rec, raised, today)`.

- [ ] **Step 1: Add the types and seed**

In `src/live/types.ts`, add `import type { CloId } from '../scenario/course';`, and add:

```ts
export type CardRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardState {
  /** Days until the next review. */
  interval: number;
  ease: number;
  due: number;
  reps: number;
  /** The day this card was first seen. */
  introduced: number;
}

export interface StudyDay {
  planned: number;
  done: number;
  check: 'tooMuch' | 'right' | 'tooLittle' | null;
}

export interface Attempt { itemId: string; day: number; correct: boolean; firstTry: boolean }

export interface StudyPlanDay { day: number; minutes: number; clo: CloId; concepts: ConceptId[] }

export interface StudyPlan {
  createdDay: number;
  /** One sentence for the student. */
  reason: string;
  /** What is deliberately dropped because time cannot cover everything. */
  leftOut: string[];
  source: 'agents' | 'offline';
  days: StudyPlanDay[];
}

export type ReplanSignal = 'setup' | 'markSwing' | 'disengaged' | 'bandChange' | 'teacherPlan';
export type PassBand = 'Likely' | 'At risk' | 'Unlikely';

export interface StudyRecord {
  /** Minutes per day the student said they have. */
  reported: { weekday: number; weekend: number } | null;
  /** End-of-day factor, starts at 1, clamped 0.6–1.3. */
  feel: number;
  days: Record<number, StudyDay>;
  attempts: Attempt[];
  cards: Record<string, CardState>;
  /** Index 0–2 into each CLO's Bloom levels. */
  bloom: Record<CloId, number>;
  /** First-try correct answers in a row at the current level. */
  streak: Record<CloId, number>;
  marks: { assessment: string; mark: number; day: number }[];
  plan: StudyPlan | null;
  /** The band when the plan was last made. */
  band: PassBand | null;
  pendingSignal: ReplanSignal | null;
  lastReplanDay: number | null;
  replans: { day: number; signal: ReplanSignal; reason: string }[];
  /** Agent steps while a plan is being written. */
  planning: { steps: string[] } | null;
}

/** A self-started practice session. */
export interface SelfSession { clo: CloId | null; concepts: ConceptId[]; served: string[] }
```

Replace `PhoneScreen` with:

```ts
export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'progress' | 'pick' | 'setup' | 'today' | 'choosePractice' | 'cards' | 'semester' | 'checkIn';
```

Add to `PhoneState`:

```ts
  /** The student on this phone. A teacher plan switches it to that student. */
  studentId: string | null;
  /** The lock screen shows the morning "Today's calendar". */
  morning: boolean;
  self: SelfSession | null;
```

Add to `DemoState`: `study: Record<string, StudyRecord>;`.

In `src/live/seed.ts`, add `studentId: null, morning: false, self: null,` to `IDLE_PHONE`, and `study: {},` to `seedState`.

In `src/live/reducer.ts`, in `deliver`, add `studentId: plan.studentIds[0],` to the new phone state.

- [ ] **Step 2: Write the failing test**

Create `src/live/study/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY } from '../../scenario/course';
import { CONCEPTS } from '../../scenario/knowledgeGraph';
import { planFor } from '../fixtures';
import { seedState } from '../seed';
import type { DemoState, StudentProfile } from '../types';
import { applyCheck, capacityFor, capacityLeft, shortOfTime, teacherMinutes } from './capacity';
import { NEW_PER_DAY, cardsToday, reviewCard } from './cards';
import { bandOf, cloMastery, minutesNeeded, passEstimate } from './estimate';
import { markFor } from './marks';
import { ensureRecord, newRecord, noteAttempt } from './record';
import { SELF_SESSION, nextItem } from './select';
import { detectSignal, mayReplan, nextReplan } from './signals';
import { todayList } from './today';
import { BANK } from '../../scenario/practiceBank';

const student = (s: DemoState, id = 's17'): StudentProfile => s.students.find((x) => x.id === id)!;
const setAll = (st: StudentProfile, v: number) => { for (const c of CONCEPTS) st.mastery[c.id] = v; };
const setup = () => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  s.phone.studentId = 's17';
  return { s, rec };
};

describe('card scheduling', () => {
  it('schedules a new card by rating', () => {
    expect(reviewCard(undefined, 'again', 40).due).toBe(41);
    expect(reviewCard(undefined, 'hard', 40).due).toBe(41);
    expect(reviewCard(undefined, 'good', 40).due).toBe(42);
    expect(reviewCard(undefined, 'easy', 40).due).toBe(44);
  });
  it('lengthens a reviewed card and shortens it on Again', () => {
    const first = reviewCard(undefined, 'good', 40);
    const second = reviewCard(first, 'good', 42);
    expect(second.interval).toBe(5);
    expect(second.due).toBe(47);
    const lapsed = reviewCard(second, 'again', 47);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.ease).toBeCloseTo(2.3);
  });
  it('never lets ease fall below 1.3, and never schedules past the exam', () => {
    let c = reviewCard(undefined, 'hard', 40);
    for (let i = 0; i < 20; i++) c = reviewCard(c, 'hard', 41);
    expect(c.ease).toBe(1.3);
    const late = reviewCard({ interval: 30, ease: 2.5, due: 60, reps: 4, introduced: 40 }, 'easy', 60);
    expect(late.due).toBe(EXAM_DAY - 1);
  });
  it('serves due cards and at most 5 new cards a day from the focus', () => {
    const { rec } = setup();
    const first = cardsToday(rec, 40, ['implication', 'equivalence']);
    expect(first.fresh).toHaveLength(Math.min(NEW_PER_DAY, 8));
    expect(first.fresh.every((c) => ['implication', 'equivalence'].includes(c.concept))).toBe(true);
    rec.cards[CARDS[0].id] = reviewCard(undefined, 'good', 38);
    expect(cardsToday(rec, 40, []).due.map((c) => c.id)).toEqual([CARDS[0].id]);
    rec.cards[first.fresh[0].id] = reviewCard(undefined, 'good', 40);
    expect(cardsToday(rec, 40, ['implication', 'equivalence']).fresh).toHaveLength(NEW_PER_DAY - 1);
  });
});

describe('next question', () => {
  it('skips a concept whose prerequisite is too weak', () => {
    const { s, rec } = setup();
    const st = student(s);
    st.mastery.equivalence = 0.2;
    st.mastery.biconditional = 0.3;
    const item = nextItem(rec, st, 40, ['equivalence'], []);
    expect(item.concept).toBe('biconditional');
  });
  it('picks the weakest eligible concept at the student’s Bloom level', () => {
    const { s, rec } = setup();
    const st = student(s);
    st.mastery.negation = 0.9;
    st.mastery.conjunction = 0.5;
    rec.bloom.CLO1 = 2;
    const item = nextItem(rec, st, 40, ['negation', 'conjunction'], []);
    expect(item.concept).toBe('conjunction');
    expect(item.bloom).toBe('Apply');
  });
  it('does not repeat served or recent questions while others remain', () => {
    const { s, rec } = setup();
    const st = student(s);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const item = nextItem(rec, st, 40, ['conjunction'], [...seen]);
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
    }
    expect(SELF_SESSION).toBe(5);
  });
  it('moves up after two first-try answers and down after a wrong one', () => {
    const rec = newRecord(student(seedState()));
    rec.bloom.CLO1 = 0;
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(0);
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(1);
    noteAttempt(rec, item, 40, false, false);
    expect(rec.bloom.CLO1).toBe(0);
  });
});

describe('pass estimate', () => {
  it('weights CLO mastery by exam share and bands the score', () => {
    const { s, rec } = setup();
    const st = student(s);
    const est = passEstimate(st, rec, 40);
    const expected = CLOS.reduce((a, c) => a + c.share * cloMastery(st, c.id), 0) * 100;
    expect(Math.abs(est.score - expected)).toBeLessThanOrEqual(0.5);
    expect(est.band).toBe(bandOf(est.score));
    expect(bandOf(60)).toBe('Likely');
    expect(bandOf(59)).toBe('At risk');
    expect(bandOf(45)).toBe('At risk');
    expect(bandOf(44)).toBe('Unlikely');
  });
  it('counts planned study, capped at +0.20 mastery', () => {
    const { s, rec } = setup();
    const st = student(s);
    const plain = passEstimate(st, rec, 40).score;
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 2000, clo: 'CLO1', concepts: [] }] };
    expect(passEstimate(st, rec, 40).score).toBeLessThanOrEqual(plain + 20.01);
    expect(passEstimate(st, rec, 40).score).toBeGreaterThan(plain);
  });
  it('counts 12 minutes per 0.1 of gap to 0.75, per concept', () => {
    const st = student(seedState());
    setAll(st, 0.75);
    expect(minutesNeeded(st)).toBe(0);
    st.mastery.implication = 0.35;
    expect(minutesNeeded(st)).toBe(48);
  });
});

describe('capacity', () => {
  it('starts from what was reported, by weekday or weekend', () => {
    const { rec } = setup();
    expect(capacityFor(rec, 42)).toBe(30);
    expect(capacityFor(rec, 40)).toBe(60);
  });
  it('then trusts what actually happens', () => {
    const { rec } = setup();
    for (const d of [39, 40, 41]) rec.days[d] = { planned: 30, done: 8, check: null };
    expect(capacityFor(rec, 42)).toBe(10);
  });
  it('judges future days by what has happened up to today', () => {
    const { rec } = setup();
    for (const d of [39, 40, 41]) rec.days[d] = { planned: 30, done: 8, check: null };
    expect(capacityFor(rec, 50, 42)).toBe(10);
    expect(capacityFor(rec, 50)).toBe(30);
  });
  it('takes a teacher’s sessions off the day', () => {
    const { s } = setup();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    expect(teacherMinutes(s, 's17')).toEqual({ 42: 18 });
    expect(capacityLeft(s, 's17', 42)).toBe(12);
    expect(capacityLeft(s, 's17', 43)).toBe(30);
  });
  it('knows when the time left cannot cover the gaps', () => {
    const { s, rec } = setup();
    expect(shortOfTime(s, 's17')).toBe(false);
    rec.reported = { weekday: 5, weekend: 5 };
    setAll(s.students[16], 0.1);
    expect(shortOfTime(s, 's17')).toBe(true);
  });
  it('adjusts with the end-of-day check, within limits', () => {
    expect(applyCheck(1, 'tooMuch')).toBeCloseTo(0.9);
    expect(applyCheck(1, 'tooLittle')).toBeCloseTo(1.1);
    expect(applyCheck(1, 'right')).toBe(1);
    expect(applyCheck(0.6, 'tooMuch')).toBe(0.6);
    expect(applyCheck(1.3, 'tooLittle')).toBe(1.3);
  });
});

describe('today', () => {
  it('lists cards then practice within the budget, and carries yesterday’s shortfall', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }, { day: 41, minutes: 20, clo: 'CLO2', concepts: ['equivalence'] }] };
    const first = todayList(s, 's17');
    expect(first.budget).toBe(20);
    expect(first.rows.map((r) => r.kind)).toEqual(['cards', 'practice']);
    rec.days[40] = { planned: 20, done: 5, check: null };
    s.day = 41;
    expect(todayList(s, 's17').budget).toBe(35);
  });
  it('puts today’s teacher sessions first', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    s.plans.push({ id: 'p1', kind: 'pathway', title: 'T', studentIds: ['s17'], day: 'Today', date: 40, baseline: null, rationale: '', outcome: '', status: 'sent', conversationId: 'c1', sessions: [{ time: '16:00', title: 'Review', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null }] });
    s.phone.planId = 'p1';
    expect(todayList(s, 's17').rows[0]).toMatchObject({ kind: 'plan', index: 0, title: 'Review' });
  });
});

describe('marks', () => {
  it('generates a mark from mastery, deterministically', () => {
    const s = seedState();
    const quiz3 = ASSESSMENTS.find((a) => a.id === 'quiz3')!;
    expect(markFor(student(s), quiz3)).toBe(markFor(student(s), quiz3));
    expect(markFor(student(s), quiz3)).toBeGreaterThanOrEqual(0);
    expect(markFor(student(s), quiz3)).toBeLessThanOrEqual(100);
  });
});

describe('replan signals', () => {
  const rec = () => setup().rec;

  it('fires on a mark swing of 15 points either way', () => {
    expect(detectSignal(rec(), 50, 'At risk', 40, 56)).toBe('markSwing');
    expect(detectSignal(rec(), 50, 'At risk', 75, 60)).toBe('markSwing');
    expect(detectSignal(rec(), 50, 'At risk', 50, 56)).toBeNull();
  });
  it('fires when the band changes', () => {
    const r = rec();
    r.band = 'Likely';
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('bandChange');
    expect(detectSignal(r, 50, 'Likely', null, null)).toBeNull();
  });
  it('fires after 3 days with no practice, not 2', () => {
    const r = rec();
    r.band = 'At risk';
    r.days[47] = { planned: 20, done: 10, check: null };
    r.days[48] = { planned: 20, done: 0, check: null };
    r.days[49] = { planned: 20, done: 0, check: null };
    expect(detectSignal(r, 50, 'At risk', null, null)).toBeNull();
    r.days[47].done = 0;
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('disengaged');
  });
  it('fires under 25% of planned minutes across 7 days', () => {
    const r = rec();
    r.band = 'At risk';
    for (let d = 43; d < 50; d++) r.days[d] = { planned: 20, done: d % 2 ? 6 : 1, check: null };
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('disengaged');
  });
  it('holds a cooldown of 5 story days, except for marks and teacher plans', () => {
    const r = rec();
    r.lastReplanDay = 48;
    expect(mayReplan(r, 'disengaged', 50)).toBe(false);
    expect(mayReplan(r, 'bandChange', 52)).toBe(false);
    expect(mayReplan(r, 'bandChange', 53)).toBe(true);
    expect(mayReplan(r, 'markSwing', 49)).toBe(true);
    expect(mayReplan(r, 'teacherPlan', 49)).toBe(true);
  });
  it('holds a signal through the cooldown, and drops it if it stops being true', () => {
    const r = rec();
    r.lastReplanDay = 48;
    expect(nextReplan(r, 'disengaged', 50)).toEqual({ run: null, hold: 'disengaged' });
    r.pendingSignal = 'disengaged';
    expect(nextReplan(r, null, 51)).toEqual({ run: null, hold: null });
    expect(nextReplan(r, 'disengaged', 53)).toEqual({ run: 'disengaged', hold: null });
  });
  it('keeps a mark swing or teacher plan that has not been acted on', () => {
    const r = rec();
    r.lastReplanDay = 48;
    r.pendingSignal = 'markSwing';
    expect(nextReplan(r, null, 49)).toEqual({ run: 'markSwing', hold: null });
  });
  it('stops replanning on exam day', () => {
    expect(nextReplan(rec(), 'markSwing', EXAM_DAY)).toEqual({ run: null, hold: null });
  });
});

describe('start', () => {
  it('uses the story start day', () => {
    expect(seedState().day).toBe(START_DAY);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/live/study`
Expected: FAIL — cannot resolve `../seed` imports such as `./capacity`.

- [ ] **Step 4: Write `src/live/study/record.ts`**

```ts
import { CLOS, cloOf, type CloId } from '../../scenario/course';
import type { BankItem } from '../../scenario/practiceBank';
import type { DemoState, StudentProfile, StudyRecord } from '../types';

/** Nominal study time: story time is not real time. */
export const MINUTES = { question: 1.5, card: 0.5 };

const meanOf = (student: StudentProfile, cloId: CloId) => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};
const startLevel = (mastery: number) => (mastery < 0.45 ? 0 : mastery < 0.7 ? 1 : 2);

export function newRecord(student: StudentProfile): StudyRecord {
  return {
    reported: null, feel: 1, days: {}, attempts: [], cards: {}, marks: [], plan: null, band: null,
    bloom: { CLO1: startLevel(meanOf(student, 'CLO1')), CLO2: startLevel(meanOf(student, 'CLO2')), CLO3: startLevel(meanOf(student, 'CLO3')) },
    streak: { CLO1: 0, CLO2: 0, CLO3: 0 },
    pendingSignal: null, lastReplanDay: null, replans: [], planning: null,
  };
}

/** The student's record, created on first use. Mutates `s`. */
export function ensureRecord(s: DemoState, studentId: string): StudyRecord {
  s.study[studentId] ??= newRecord(s.students.find((x) => x.id === studentId)!);
  return s.study[studentId];
}

export function logMinutes(rec: StudyRecord, day: number, minutes: number): void {
  rec.days[day] ??= { planned: 0, done: 0, check: null };
  rec.days[day].done += minutes;
}

/** Logs a graded answer and moves the Bloom level: two first-try answers up, a wrong answer down. Mutates `rec`. */
export function noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, firstTry: boolean): void {
  rec.attempts.push({ itemId: item.id, day, correct, firstTry });
  logMinutes(rec, day, MINUTES.question);
  const clo = cloOf(item.concept).id;
  if (!correct) {
    rec.bloom[clo] = Math.max(0, rec.bloom[clo] - 1);
    rec.streak[clo] = 0;
  } else if (firstTry) {
    rec.streak[clo] += 1;
    if (rec.streak[clo] >= 2) {
      rec.bloom[clo] = Math.min(2, rec.bloom[clo] + 1);
      rec.streak[clo] = 0;
    }
  }
}
```

- [ ] **Step 5: Write `src/live/study/cards.ts`**

```ts
import { CARDS, type Card } from '../../scenario/cards';
import { EXAM_DAY } from '../../scenario/course';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { CardRating, CardState, StudyRecord } from '../types';

export const NEW_PER_DAY = 5;
const FIRST_INTERVAL: Record<CardRating, number> = { again: 1, hard: 1, good: 2, easy: 4 };

/** A simplified SM-2. Intervals round up and never run past the day before the exam. */
export function reviewCard(card: CardState | undefined, rating: CardRating, today: number): CardState {
  const ease = card?.ease ?? 2.5;
  const nextEase = Math.max(1.3, ease + { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[rating]);
  let interval = FIRST_INTERVAL[rating];
  if (card) {
    if (rating === 'hard') interval = Math.max(1, Math.ceil(card.interval * 1.2));
    if (rating === 'good') interval = Math.ceil(card.interval * ease);
    if (rating === 'easy') interval = Math.ceil(card.interval * ease * 1.3);
  }
  const due = Math.min(today + interval, Math.max(today + 1, EXAM_DAY - 1));
  return { interval, ease: nextEase, due, reps: (card?.reps ?? 0) + 1, introduced: card?.introduced ?? today };
}

/** Cards due today, plus new cards from the day's focus up to the daily limit. */
export function cardsToday(rec: StudyRecord, today: number, focus: ConceptId[]): { due: Card[]; fresh: Card[] } {
  const due = CARDS.filter((c) => rec.cards[c.id] && rec.cards[c.id].due <= today);
  const introducedToday = Object.values(rec.cards).filter((c) => c.introduced === today).length;
  const fresh = CARDS.filter((c) => !rec.cards[c.id] && focus.includes(c.concept)).slice(0, Math.max(0, NEW_PER_DAY - introducedToday));
  return { due, fresh };
}
```

- [ ] **Step 6: Write `src/live/study/select.ts`**

```ts
import { cloOf } from '../../scenario/course';
import { EDGES, type ConceptId } from '../../scenario/knowledgeGraph';
import { BANK, type BankItem } from '../../scenario/practiceBank';
import type { StudentProfile, StudyRecord } from '../types';

export const SELF_SESSION = 5;
const READY = 0.4;
const RECENT_DAYS = 3;

const prerequisites = (c: ConceptId) => EDGES.filter(([, to]) => to === c).map(([from]) => from);

function chooseConcept(student: StudentProfile, concepts: ConceptId[]): ConceptId {
  const weakest = (list: ConceptId[]) => [...list].sort((a, b) => student.mastery[a] - student.mastery[b])[0];
  const eligible = concepts.filter((c) => prerequisites(c).every((p) => student.mastery[p] >= READY));
  if (eligible.length) return weakest(eligible);
  const blocking = [...new Set(concepts.flatMap(prerequisites))].filter((p) => student.mastery[p] < READY);
  return weakest(blocking.length ? blocking : concepts);
}

/** The next question: the weakest ready concept, at the student's Bloom level, avoiding recent repeats. */
export function nextItem(rec: StudyRecord, student: StudentProfile, today: number, concepts: ConceptId[], served: string[]): BankItem {
  const concept = chooseConcept(student, concepts);
  const clo = cloOf(concept);
  const level = rec.bloom[clo.id];
  const recent = new Set(rec.attempts.filter((a) => today - a.day < RECENT_DAYS).map((a) => a.itemId));
  const pool = BANK.filter((i) => i.concept === concept && !served.includes(i.id));
  const byDistance = [level, level - 1, level + 1, level - 2, level + 2].filter((l) => l >= 0 && l <= 2);
  for (const l of byDistance) {
    const fresh = pool.find((i) => i.bloom === clo.levels[l] && !recent.has(i.id));
    if (fresh) return fresh;
  }
  const lastSeen = (id: string) => [...rec.attempts].reverse().find((a) => a.itemId === id)?.day ?? -1;
  return [...pool].sort((a, b) => lastSeen(a.id) - lastSeen(b.id))[0] ?? BANK.find((i) => i.concept === concept)!;
}
```

- [ ] **Step 7: Write `src/live/study/estimate.ts`**

```ts
import { CLOS, type CloId } from '../../scenario/course';
import type { PassBand, StudentProfile, StudyRecord } from '../types';

export const PASS_MARK = 50;

export const cloMastery = (student: StudentProfile, cloId: CloId): number => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};

export const bandOf = (score: number): PassBand => (score >= 60 ? 'Likely' : score >= 45 ? 'At risk' : 'Unlikely');

/** Minutes to bring every concept to 0.75: 12 per 0.1 of gap. */
export const minutesNeeded = (student: StudentProfile): number =>
  Math.round(Object.values(student.mastery).reduce((a, m) => a + Math.max(0, 0.75 - m), 0) * 120);

/** Projected exam score: CLO mastery by exam share, plus a capped gain for the study still planned. An estimate. */
export function passEstimate(student: StudentProfile, rec: StudyRecord, today: number): { score: number; band: PassBand } {
  const planned = rec.plan?.days.filter((d) => d.day >= today).reduce((a, d) => a + d.minutes, 0) ?? 0;
  const gain = Math.min(0.2, planned / 1000);
  const score = CLOS.reduce((a, c) => a + c.share * Math.min(1, cloMastery(student, c.id) + gain), 0) * 100;
  return { score: Math.round(score), band: bandOf(Math.round(score)) };
}
```

- [ ] **Step 8: Write `src/live/study/capacity.ts`**

```ts
import { isWeekend, studyDays } from '../../scenario/course';
import type { DemoState, StudyDay, StudyRecord } from '../types';
import { minutesNeeded } from './estimate';

const clamp = (v: number) => Math.min(1.3, Math.max(0.6, v));

export const applyCheck = (feel: number, check: StudyDay['check']): number =>
  clamp(feel * (check === 'tooMuch' ? 0.9 : check === 'tooLittle' ? 1.1 : 1));

/** Minutes for `day`, judged from `today`: the lower of what was reported and 1.25× what really happened lately, adjusted by the end-of-day check. At least 10. */
export function capacityFor(rec: StudyRecord, day: number, today = day): number {
  const reported = rec.reported ? (isWeekend(day) ? rec.reported.weekend : rec.reported.weekday) : 0;
  const recent = Object.entries(rec.days).filter(([d]) => Number(d) < today && Number(d) >= today - 7).map(([, v]) => v.done);
  const base = recent.length < 3 ? reported : Math.min(reported, 1.25 * (recent.reduce((a, b) => a + b, 0) / recent.length));
  return Math.max(10, Math.round(base * rec.feel));
}

/** Minutes a teacher's pathway already takes, by day. Those sessions are fixed. */
export function teacherMinutes(state: DemoState, studentId: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const p of state.plans) {
    if (p.kind !== 'pathway' || !p.studentIds.includes(studentId) || !['sent', 'autoApproved'].includes(p.status)) continue;
    out[p.date] = (out[p.date] ?? 0) + p.sessions.reduce((a, s) => a + s.minutes, 0);
  }
  return out;
}

/** What is left for self-study on `day`. */
export const capacityLeft = (state: DemoState, studentId: string, day: number): number =>
  Math.max(0, capacityFor(state.study[studentId], day, state.day) - (teacherMinutes(state, studentId)[day] ?? 0));

/** Whether the time left is under 60% of what reaching 0.75 on every concept would take. */
export function shortOfTime(state: DemoState, studentId: string): boolean {
  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  return available < 0.6 * minutesNeeded(state.students.find((s) => s.id === studentId)!);
}
```

- [ ] **Step 9: Write `src/live/study/today.ts`**

```ts
import { cloOf, type CloId } from '../../scenario/course';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { DemoState } from '../types';
import { capacityFor } from './capacity';
import { cardsToday } from './cards';
import { MINUTES } from './record';

export type TodayRow =
  | { kind: 'plan'; index: number; title: string; minutes: number }
  | { kind: 'cards'; count: number; minutes: number }
  | { kind: 'practice'; clo: CloId; concepts: ConceptId[]; minutes: number };

/** The day's list: teacher sessions, then cards, then practice up to the budget. Missed minutes carry over within capacity. */
export function todayList(state: DemoState, studentId: string): { budget: number; done: number; concepts: ConceptId[]; rows: TodayRow[] } {
  const rec = state.study[studentId];
  const day = state.day;
  const planned = rec.plan?.days.find((d) => d.day === day);
  const concepts = planned?.concepts ?? [];
  const yesterday = rec.days[day - 1];
  const carry = yesterday ? Math.max(0, yesterday.planned - yesterday.done) : 0;
  const budget = Math.min(capacityFor(rec, day), (planned?.minutes ?? 0) + carry);
  const done = rec.days[day]?.done ?? 0;
  const rows: TodayRow[] = [];

  const teacher = state.plans.find((p) => p.id === state.phone.planId && p.kind === 'pathway' && p.studentIds[0] === studentId && p.date === day && p.status !== 'done');
  teacher?.sessions.forEach((s, index) => {
    if (!state.phone.done.includes(index)) rows.push({ kind: 'plan', index, title: s.title, minutes: s.minutes });
  });

  const { due, fresh } = cardsToday(rec, day, concepts);
  const count = due.length + fresh.length;
  const cardMinutes = Math.ceil(count * MINUTES.card);
  if (count > 0) rows.push({ kind: 'cards', count, minutes: cardMinutes });

  const left = Math.max(0, budget - done - cardMinutes);
  if (left > 0 && concepts.length > 0) rows.push({ kind: 'practice', clo: cloOf(concepts[0]).id, concepts, minutes: left });
  return { budget, done, concepts, rows };
}
```

- [ ] **Step 10: Write `src/live/study/marks.ts` and `signals.ts`**

`marks.ts`:

```ts
import { CLOS, type Assessment } from '../../scenario/course';
import type { StudentProfile } from '../types';
import { cloMastery } from './estimate';

/** A mark for an assessment that has just passed: mastery on its CLOs, plus a seeded offset of −6 to +6. */
export function markFor(student: StudentProfile, assessment: Assessment): number {
  const clos = CLOS.filter((c) => assessment.clos.includes(c.id));
  const weight = clos.reduce((a, c) => a + c.share, 0);
  const mastery = clos.reduce((a, c) => a + c.share * cloMastery(student, c.id), 0) / weight;
  const offset = ((student.index * 37 + assessment.day * 11) % 13) - 6;
  return Math.max(0, Math.min(100, Math.round(mastery * 100) + offset));
}
```

`signals.ts`:

```ts
import { EXAM_DAY } from '../../scenario/course';
import type { PassBand, ReplanSignal, StudyRecord } from '../types';

const MARK_SWING = 15;
const COOLDOWN_DAYS = 5;

function disengaged(rec: StudyRecord, today: number): boolean {
  const last = (n: number) => Array.from({ length: n }, (_, i) => rec.days[today - 1 - i]);
  if (last(3).every((d) => d && d.planned > 0 && d.done === 0)) return true;
  const week = last(7).filter(Boolean);
  const planned = week.reduce((a, d) => a + d.planned, 0);
  return week.length === 7 && planned > 0 && week.reduce((a, d) => a + d.done, 0) / planned < 0.25;
}

/** The drastic signal that justifies a new plan, if any. Small day-to-day slips are handled by carry-over, not here. */
export function detectSignal(rec: StudyRecord, today: number, band: PassBand, newMark: number | null, previousMark: number | null): ReplanSignal | null {
  if (newMark !== null && previousMark !== null && Math.abs(newMark - previousMark) >= MARK_SWING) return 'markSwing';
  if (rec.band !== null && rec.band !== band) return 'bandChange';
  return disengaged(rec, today) ? 'disengaged' : null;
}

/** At most one replan per 5 story days; a mark swing, teacher plan or setup goes straight through. */
export const mayReplan = (rec: StudyRecord, signal: ReplanSignal, today: number): boolean =>
  signal === 'markSwing' || signal === 'teacherPlan' || signal === 'setup' || rec.lastReplanDay === null || today - rec.lastReplanDay >= COOLDOWN_DAYS;

/**
 * What a new day does with a signal: replan now, or hold it through the cooldown. A disengagement or band change
 * counts only if it is raised again; a mark or a teacher plan is a fact that stays true until a plan answers it.
 */
export function nextReplan(rec: StudyRecord, raised: ReplanSignal | null, today: number): { run: ReplanSignal | null; hold: ReplanSignal | null } {
  if (today >= EXAM_DAY) return { run: null, hold: null };
  const kept = rec.pendingSignal === 'markSwing' || rec.pendingSignal === 'teacherPlan' || rec.pendingSignal === 'setup' ? rec.pendingSignal : null;
  const wanted = kept ?? raised;
  if (!wanted) return { run: null, hold: null };
  return mayReplan(rec, wanted, today) ? { run: wanted, hold: null } : { run: null, hold: wanted };
}
```

- [ ] **Step 11: Run tests**

Run: `npx vitest run src/live/study`
Expected: PASS. In `capacity`'s second test: mean done 8 × 1.25 = 10, so capacity 10.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/live/types.ts src/live/seed.ts src/live/reducer.ts src/live/study
git commit -m "feat(study): study record and rules for cards, selection, estimates, capacity and replan signals"
```

---

### Task 5: Phone study transitions and the day rollover

**Files:**
- Create: `src/live/study/reducer.ts`
- Modify: `src/live/reducer.ts`
- Test: `src/live/study/reducer.test.ts`

**Interfaces:**
- Consumes: Task 4; `currentItems`, `phoneAnswer`, `phoneNext` in `src/live/reducer.ts`.
- Produces: `type StudyResult = { ok: true; state: DemoState; signal: ReplanSignal | null } | { ok: false; error: string }`; `type StudyTab = 'today' | 'choosePractice' | 'cards' | 'semester'`; `openPick(state)`, `pickStudent(state, id)`, `saveSetup(state, weekday, weekend)`, `showTab(state, tab)`, `startSelf(state, clo)`, `rateCard(state, cardId, rating)`, `openCheckIn(state)`, `advance(state, days, check)`, `simulateDrop(state)`, `applyPlan(s, studentId, plan, signal)`.
- `reducer.ts`: `currentItems` serves a self session; `phoneAnswer` logs study attempts; `phoneNext` continues a self session; `deliver` leaves a running self session alone.

- [ ] **Step 1: Write the failing test**

Create `src/live/study/reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { planFor, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAnswer, phoneNext, type Result } from '../reducer';
import { seedState } from '../seed';
import type { DemoState } from '../types';
import { advance, applyPlan, openCheckIn, openPick, pickStudent, rateCard, saveSetup, showTab, simulateDrop, startSelf, type StudyResult } from './reducer';

const ok = (r: Result | StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const planned = (s: DemoState) => {
  s.study.s17.plan = {
    createdDay: 40, reason: 'r', leftOut: [], source: 'offline',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
  };
  return s;
};
const ready = () => planned(ok(saveSetup(ok(pickStudent(ok(openPick(seedState())), 's17')), 30, 60)));

describe('joining', () => {
  it('moves from pick to setup to today', () => {
    const picked = ok(pickStudent(ok(openPick(seedState())), 's17'));
    expect(picked.phone).toMatchObject({ screen: 'setup', studentId: 's17' });
    expect(picked.study.s17.reported).toBeNull();
    const set = ok(saveSetup(picked, 30, 60));
    expect(set.phone.screen).toBe('today');
    expect(set.study.s17.reported).toEqual({ weekday: 30, weekend: 60 });
  });
  it('rejects an unknown student and impossible minutes', () => {
    expect(pickStudent(seedState(), 's99').ok).toBe(false);
    const picked = ok(pickStudent(seedState(), 's17'));
    expect(saveSetup(picked, 0, 60).ok).toBe(false);
    expect(saveSetup(picked, 30, 500).ok).toBe(false);
  });
  it('a returning student skips setup', () => {
    const s = ready();
    expect(ok(pickStudent(s, 's17')).phone.screen).toBe('today');
  });
});

describe('self practice', () => {
  it('serves 5 adaptive questions and returns to Today', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone).toMatchObject({ screen: 'practice', session: null, item: 0 });
    for (let n = 0; n < 5; n++) {
      const item = currentItems(s)[s.phone.item];
      expect(item).toBeDefined();
      s = ok(phoneAnswer(s, item.correct));
      s = ok(phoneNext(s));
    }
    expect(s.phone).toMatchObject({ screen: 'today', self: null });
    expect(new Set(s.study.s17.attempts.map((a) => a.itemId)).size).toBe(5);
    expect(s.study.s17.days[40].done).toBe(7.5);
    expect(s.students[16].evidence.filter((e) => e.kind === 'practice')).toHaveLength(5);
  });
  it('practises the day’s focus when no CLO is chosen', () => {
    const s = ok(startSelf(ready(), null));
    expect(s.phone.self?.concepts).toEqual(['implication']);
  });
  it('rejects a CLO that does not exist', () => {
    expect(startSelf(ready(), 'CLO9' as 'CLO1').ok).toBe(false);
  });
  it('a follow-up plan arriving mid-session does not interrupt it', () => {
    const s = structuredClone(ok(startSelf(ready(), 'CLO1')));
    s.plans.push(planFor('pathway', { id: 'p2', status: 'autoApproved' }));
    deliver(s, s.plans[0], true);
    expect(s.phone).toMatchObject({ screen: 'practice', planId: 'p2', updated: true });
    expect(s.phone.self).not.toBeNull();
    expect(currentItems(s)).toHaveLength(1);
  });
});

describe('cards', () => {
  it('schedules a rated card, logs the time and nudges mastery only on Good or Easy', () => {
    const card = CARDS.find((c) => c.concept === 'implication')!;
    const before = ready().students[16].mastery.implication;
    const good = ok(rateCard(ready(), card.id, 'good'));
    expect(good.study.s17.cards[card.id].due).toBe(42);
    expect(good.study.s17.days[40].done).toBe(0.5);
    expect(good.students[16].mastery.implication).toBeGreaterThan(before);
    expect(ok(rateCard(ready(), card.id, 'again')).students[16].mastery.implication).toBe(before);
    expect(rateCard(ready(), 'nope', 'good').ok).toBe(false);
    expect(rateCard(ready(), card.id, 'perfect' as 'good').ok).toBe(false);
  });
});

describe('moving through days', () => {
  it('Next day closes the day, applies the check and lands on the morning lock screen', () => {
    const r = advance(ok(openCheckIn(ready())), 1, 'tooMuch');
    const s = ok(r);
    expect(s.day).toBe(41);
    expect(s.clock).toBe(7 * 60 + 30);
    expect(s.phone).toMatchObject({ screen: 'lock', morning: true });
    expect(s.study.s17.feel).toBeCloseTo(0.9);
    expect(s.study.s17.days[40]).toMatchObject({ planned: 20, done: 0, check: 'tooMuch' });
  });
  it('passing an assessment generates its mark', () => {
    const s = ok(advance(ready(), 7, null));
    expect(s.day).toBe(47);
    expect(s.study.s17.marks.map((m) => m.assessment)).toEqual(['a2']);
  });
  it('a date jumped over by a teacher session still gets its mark, once', () => {
    const s = ready();
    s.day = 47;
    const after = ok(advance(s, 1, null));
    expect(after.study.s17.marks.map((m) => m.assessment)).toEqual(['a2']);
    expect(ok(advance(after, 1, null)).study.s17.marks).toHaveLength(1);
  });
  it('a skipped stretch raises disengagement, and small misses raise nothing', () => {
    const skipped = advance(ready(), 7, null);
    expect(skipped.ok && skipped.signal).toBe('disengaged');
    const small = advance(ready(), 1, null);
    expect(small.ok && small.signal).toBeNull();
  });
  it('stops at the exam', () => {
    const s = ok(advance(ready(), 60, null));
    expect(s.day).toBe(64);
    expect(advance(s, 1, null).ok).toBe(false);
  });
  it('needs a student who has set up, and a real check', () => {
    expect(advance(seedState(), 1, null).ok).toBe(false);
    expect(advance(ready(), 1, 'whatever' as 'right').ok).toBe(false);
  });
});

describe('a finished plan', () => {
  it('replaces the plan, sets the band and logs why', () => {
    const s = structuredClone(ready());
    s.study.s17.planning = { steps: [] };
    applyPlan(s, 's17', { createdDay: 40, reason: 'Lighter for now.', leftOut: [], source: 'offline', days: [] }, 'disengaged');
    expect(s.study.s17).toMatchObject({ planning: null, lastReplanDay: 40, band: 'At risk' });
    expect(s.study.s17.plan?.reason).toBe('Lighter for now.');
    expect(s.study.s17.replans).toEqual([{ day: 40, signal: 'disengaged', reason: 'Lighter for now.' }]);
  });
});

describe('teacher plans stay intact', () => {
  it('a plan switches the phone to that student and keeps working', () => {
    const s = stateWithPlan();
    s.phone.studentId = 's8';
    const sent = ok(approvePlan(s, 'p1'));
    expect(sent.phone).toMatchObject({ studentId: 's17', screen: 'lock', planId: 'p1', morning: false });
  });
});

describe('simulate a drop', () => {
  it('sets Quiz 3 20 points below the last mark and raises a mark swing', () => {
    const r = simulateDrop(ready());
    const s = ok(r);
    expect(r.ok && r.signal).toBe('markSwing');
    expect(s.study.s17.marks.at(-1)).toMatchObject({ assessment: 'quiz3', mark: 22 });
  });
  it('needs an active student', () => {
    expect(simulateDrop(seedState()).ok).toBe(false);
  });
});

describe('tabs', () => {
  it('switches between study screens only', () => {
    expect(ok(showTab(ready(), 'semester')).phone.screen).toBe('semester');
    expect(ok(showTab(ready(), 'cards')).phone.screen).toBe('cards');
    expect(showTab(ready(), 'plan' as 'cards').ok).toBe(false);
  });
  it('sends a student who has only had teacher plans to setup', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    expect(ok(showTab(s, 'today')).phone).toMatchObject({ screen: 'setup', planId: 'p1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/live/study/reducer.test.ts`
Expected: FAIL — cannot resolve `./reducer`.

- [ ] **Step 3: Make the phone answer flow serve self sessions**

In `src/live/reducer.ts`, add imports:

```ts
import { itemById, sessionItems, type BankItem } from '../scenario/practiceBank';
import { noteAttempt } from './study/record';
import { nextItem, SELF_SESSION } from './study/select';
```

Replace `currentItems` with:

```ts
/** The items of the session open on the phone: a teacher plan session, or the questions served so far in a self session. */
export function currentItems(s: DemoState): BankItem[] {
  if (s.phone.self) return s.phone.self.served.flatMap((id) => itemById(id) ?? []);
  const plan = planById(s, s.phone.planId);
  const session = plan && s.phone.session !== null ? plan.sessions[s.phone.session] : null;
  return session?.concept ? sessionItems(session.concept, session.isMasteryCheck) : [];
}
```

In `deliver`, after the `plan.baseline = …` line, add:

```ts
  // A follow-up can land while the student is in a self-started session.
  if (updated && s.phone.self) {
    s.phone = { ...s.phone, planId: plan.id, done: [], updated };
    return;
  }
```

In `phoneAnswer`, replace the `const student = …` line with:

```ts
  const student = studentById(s, s.phone.self ? s.phone.studentId! : planById(s, s.phone.planId)!.studentIds[0])!;
```

and after `const correct = …;` add:

```ts
  const rec = s.study[student.id];
  if (rec) noteAttempt(rec, item, s.day, correct, correct && !s.phone.hinted);
```

In `phoneNext`, after `const s = structuredClone(state);` add:

```ts
  if (s.phone.self) {
    const self = s.phone.self;
    if (self.served.length < SELF_SESSION) {
      const student = studentById(s, s.phone.studentId!)!;
      self.served.push(nextItem(s.study[student.id], student, s.day, self.concepts, self.served).id);
      s.phone = { ...s.phone, ...clearItem, item: self.served.length - 1 };
    } else {
      s.phone = { ...s.phone, ...clearItem, self: null, item: 0, screen: 'today' };
    }
    return done(s);
  }
```

`phoneSkip` keeps using `plan.studentIds[0]`.

- [ ] **Step 4: Write `src/live/study/reducer.ts`**

```ts
import { CARDS } from '../../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY, type CloId } from '../../scenario/course';
import { statusFor } from '../mastery';
import { studentById } from '../reducer';
import { IDLE_PHONE } from '../seed';
import type { CardRating, DemoState, ReplanSignal, StudyDay, StudyPlan } from '../types';
import { applyCheck } from './capacity';
import { reviewCard } from './cards';
import { passEstimate } from './estimate';
import { markFor } from './marks';
import { ensureRecord, logMinutes, MINUTES } from './record';
import { nextItem } from './select';
import { detectSignal } from './signals';
import { todayList } from './today';

export type StudyResult = { ok: true; state: DemoState; signal: ReplanSignal | null } | { ok: false; error: string };
export type StudyTab = 'today' | 'choosePractice' | 'cards' | 'semester';

const TABS: StudyTab[] = ['today', 'choosePractice', 'cards', 'semester'];
const RATINGS: CardRating[] = ['again', 'hard', 'good', 'easy'];
const CHECKS: StudyDay['check'][] = ['tooMuch', 'right', 'tooLittle', null];
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, hinted: false, result: null, lastOption: null } as const;

const fail = (error: string): StudyResult => ({ ok: false, error });
const done = (state: DemoState, signal: ReplanSignal | null = null): StudyResult => ({ ok: true, state, signal });

export function openPick(state: DemoState): StudyResult {
  const s = structuredClone(state);
  s.phone = { ...s.phone, screen: 'pick', morning: false };
  return done(s);
}

/** The student on this phone. A returning student goes straight to Today. */
export function pickStudent(state: DemoState, id: string): StudyResult {
  if (!studentById(state, id)) return fail('No such student.');
  const s = structuredClone(state);
  const rec = ensureRecord(s, id);
  s.phone = { ...IDLE_PHONE, done: [], studentId: id, screen: rec.reported ? 'today' : 'setup' };
  return done(s);
}

export function saveSetup(state: DemoState, weekday: number, weekend: number): StudyResult {
  const valid = (m: number) => Number.isFinite(m) && m >= 5 && m <= 240;
  if (!valid(weekday) || !valid(weekend)) return fail('Minutes must be between 5 and 240.');
  const id = state.phone.studentId;
  if (!id) return fail('Choose a student first.');
  const s = structuredClone(state);
  ensureRecord(s, id).reported = { weekday, weekend };
  s.phone.screen = 'today';
  return done(s);
}

/** A student who has only had teacher plans sets up on the way in. */
export function showTab(state: DemoState, tab: StudyTab): StudyResult {
  const id = state.phone.studentId;
  if (!id) return fail('Choose a student first.');
  if (!TABS.includes(tab)) return fail('No such tab.');
  const s = structuredClone(state);
  const rec = ensureRecord(s, id);
  s.phone = { ...s.phone, ...NO_PRACTICE, morning: false, screen: rec.reported ? tab : 'setup' };
  return done(s);
}

/** Starts a self session on a CLO, or on the day's focus (every concept when nothing is planned). */
export function startSelf(state: DemoState, clo: CloId | null): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]) return fail('Choose a student first.');
  const chosen = clo ? CLOS.find((c) => c.id === clo) : null;
  if (clo && !chosen) return fail('No such learning outcome.');
  const s = structuredClone(state);
  const focus = chosen?.concepts ?? todayList(s, id).concepts;
  const concepts = focus.length ? focus : CLOS.flatMap((c) => c.concepts);
  const first = nextItem(s.study[id], studentById(s, id)!, s.day, concepts, []);
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'practice', self: { clo, concepts, served: [first.id] } };
  return done(s);
}

/** Self-rating schedules the card; only Good and Easy nudge mastery, 5% of the way toward 0.9. */
export function rateCard(state: DemoState, cardId: string, rating: CardRating): StudyResult {
  const id = state.phone.studentId;
  const card = CARDS.find((c) => c.id === cardId);
  if (!id || !state.study[id]) return fail('Choose a student first.');
  if (!card) return fail('No such card.');
  if (!RATINGS.includes(rating)) return fail('No such rating.');
  const s = structuredClone(state);
  const rec = s.study[id];
  rec.cards[cardId] = reviewCard(rec.cards[cardId], rating, s.day);
  logMinutes(rec, s.day, MINUTES.card);
  if (rating === 'good' || rating === 'easy') {
    const student = studentById(s, id)!;
    const v = student.mastery[card.concept];
    student.mastery[card.concept] = Math.max(v, Math.round((v + (0.9 - v) * 0.05) * 100) / 100);
    student.status = statusFor(student.mastery);
  }
  return done(s);
}

export function openCheckIn(state: DemoState): StudyResult {
  if (!state.phone.studentId) return fail('Choose a student first.');
  const s = structuredClone(state);
  s.phone.screen = 'checkIn';
  return done(s);
}

/** Closes `days` days and lands on the next morning's lock screen. Reports any drastic signal; the session decides on a replan. */
export function advance(state: DemoState, days: number, check: StudyDay['check']): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]?.reported) return fail('Choose a student and set up first.');
  if (state.day >= EXAM_DAY) return fail('The exam is today.');
  if (!CHECKS.includes(check)) return fail('No such check.');
  const s = structuredClone(state);
  const rec = s.study[id];
  const student = studentById(s, id)!;
  let newMark: number | null = null;
  let previousMark: number | null = null;
  for (let i = 0; i < days && s.day < EXAM_DAY; i++) {
    const budget = todayList(s, id).budget;
    const entry = rec.days[s.day] ?? { planned: 0, done: 0, check: null };
    rec.days[s.day] = { ...entry, planned: budget, check: i === 0 ? check : null };
    if (i === 0 && check) rec.feel = applyCheck(rec.feel, check);
    for (const a of ASSESSMENTS) {
      if (a.day < START_DAY || a.day > s.day || rec.marks.some((m) => m.assessment === a.id)) continue;
      previousMark = rec.marks.at(-1)?.mark ?? student.quiz.q2;
      newMark = markFor(student, a);
      rec.marks.push({ assessment: a.id, mark: newMark, day: a.day });
    }
    s.day += 1;
  }
  s.clock = MORNING;
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'lock', morning: true };
  const { band } = passEstimate(student, rec, s.day);
  rec.band ??= band;
  return done(s, detectSignal(rec, s.day, band, newMark, previousMark));
}

/** Director control: a Quiz 3 result 20 points below the last mark, so the demo can show a drastic signal. */
export function simulateDrop(state: DemoState): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]?.reported) return fail('Choose a student on the phone and set up first.');
  const s = structuredClone(state);
  const rec = s.study[id];
  const previous = rec.marks.at(-1)?.mark ?? studentById(s, id)!.quiz.q2;
  rec.marks.push({ assessment: 'quiz3', mark: Math.max(0, previous - 20), day: s.day });
  return done(s, 'markSwing');
}

/** Puts a finished plan in place and records why it changed. A signal raised while it was written stays pending. Mutates `s`. */
export function applyPlan(s: DemoState, studentId: string, plan: StudyPlan, signal: ReplanSignal): void {
  const rec = s.study[studentId];
  Object.assign(rec, { plan, planning: null, lastReplanDay: s.day });
  rec.band = passEstimate(studentById(s, studentId)!, rec, s.day).band;
  rec.replans.push({ day: s.day, signal, reason: plan.reason });
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/live`
Expected: PASS. In `simulate a drop`, Minh Anh's previous mark is the Quiz 2 score, 42, so the new mark is 22. In the skipped-week test the Assignment 2 mark is 38, only 4 from Quiz 2, so the signal is disengagement and not a mark swing.

There is no import cycle: `study/reducer.ts` imports `reducer.ts`, and `reducer.ts` imports only `study/record.ts` and `study/select.ts`, which never import it back.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/live/reducer.ts src/live/study/reducer.ts src/live/study/reducer.test.ts
git commit -m "feat(study): phone study flow, self practice, cards and the day rollover"
```

---

### Task 6: Study Planning Agent, offline planner and the exam outlook tool

**Files:**
- Create: `src/live/study/outlook.ts`, `server/agents/study.ts`, `server/agents/cannedStudy.ts`
- Modify: `server/agents/tools.ts`, `server/agents/sas.ts`, `server/agents/samples.ts`
- Test: `server/agents/study.test.ts`, modify `server/agents/tools.test.ts`, `server/agents/agents.test.ts`

**Interfaces:**
- Consumes: Task 4 `capacityLeft`, `teacherMinutes`, `shortOfTime`, `passEstimate`, `cloMastery`, `cardsToday`; `runAgent`, `AgentError`; `tool`, `obj`, `CONCEPT_IDS`.
- Produces: `ExamOutlook`, `examOutlook(state, student)`, `examRisk(state)` in `outlook.ts`; `STUDY_SYSTEM`, `studyPlanProblems(state, studentId, plan)`, `studySpec(state, studentId)`, `studyMessages(state, studentId, signal)`, `planStudy(state, studentId, signal, deps)` in `study.ts`; `cannedStudyPlan(state, studentId, signal)`; `studyInput(state, studentId?)` in `samples.ts`; read tool `get_exam_outlook`; `find_students` status `examRisk`.
- `planStudy` returns a plan, or `null` when a replan should keep the current plan.

- [ ] **Step 1: Write the failing test**

Add to `server/agents/samples.ts`:

```ts
/** A valid propose_study_plan input for `state`: 10 minutes a day, each CLO in turn. */
export const studyInput = (state: DemoState, studentId = 's17', over: Record<string, unknown> = {}): Record<string, unknown> => ({
  reason: 'Minh Anh starts with implication because the rest of the course depends on it.',
  left_out: [],
  days: studyDays(state.day).map((day) => {
    const clo = CLOS[day % 3];
    return { day, minutes: Math.min(10, capacityLeft(state, studentId, day)), clo: clo.id, concepts: [clo.concepts[0]] };
  }),
  ...over,
});
```

with these imports at the top of the file:

```ts
import { capacityLeft } from '../../src/live/study/capacity';
import type { DemoState } from '../../src/live/types';
import { CLOS, studyDays } from '../../src/scenario/course';
```

Create `server/agents/study.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planFor } from '../../src/live/fixtures';
import { seedState } from '../../src/live/seed';
import { ensureRecord } from '../../src/live/study/record';
import type { DemoState, StudyPlan } from '../../src/live/types';
import { EXAM_DAY } from '../../src/scenario/course';
import { CONCEPTS } from '../../src/scenario/knowledgeGraph';
import { cannedStudyPlan } from './cannedStudy';
import { failingClient, fakeClient } from './fakeClient';
import { studyInput } from './samples';
import { STUDY_SYSTEM, planStudy, studyMessages, studyPlanProblems, studySpec } from './study';

const ready = (weekday = 30, weekend = 60): DemoState => {
  const s = seedState();
  ensureRecord(s, 's17').reported = { weekday, weekend };
  return s;
};
const lowTime = () => {
  const s = ready(5, 5);
  for (const c of CONCEPTS) s.students[16].mastery[c.id] = 0.1;
  return s;
};
const check = (s: DemoState, input: Record<string, unknown>) => studySpec(s, 's17').check(input);
const days = (s: DemoState) => (studyInput(s).days as { day: number; minutes: number; clo: string; concepts: string[] }[]);
const deps = (client: Parameters<typeof planStudy>[3]['client']) => ({ client, onStep: () => {} });
const CALL = (input: Record<string, unknown>) => [{ tool: 'propose_study_plan', input }];

describe('study plan checks', () => {
  it('accepts a plan that fits', () => {
    const s = ready();
    const r = check(s, studyInput(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ createdDay: 40, source: 'agents', leftOut: [] });
  });
  it('rejects a day over capacity', () => {
    const s = ready();
    const d = days(s);
    d[2].minutes = 500;
    expect(check(s, studyInput(s, 's17', { days: d }))).toMatchObject({ ok: false, error: expect.stringContaining('available') });
  });
  it('needs every day to the exam and nothing after it', () => {
    const s = ready();
    expect(check(s, studyInput(s, 's17', { days: days(s).slice(1) })).ok).toBe(false);
    expect(check(s, studyInput(s, 's17', { days: [...days(s), { day: EXAM_DAY, minutes: 10, clo: 'CLO1', concepts: ['negation'] }] })).ok).toBe(false);
  });
  it('rejects a concept outside the day’s CLO, and more than 3 concepts', () => {
    const s = ready();
    const wrong = days(s);
    wrong[0] = { ...wrong[0], clo: 'CLO1', concepts: ['applications'] };
    expect(check(s, studyInput(s, 's17', { days: wrong })).ok).toBe(false);
    const many = days(s);
    many[0] = { ...many[0], clo: 'CLO1', concepts: ['negation', 'conjunction', 'disjunction', 'implication'] };
    expect(check(s, studyInput(s, 's17', { days: many })).ok).toBe(false);
  });
  it('needs Week 9 to cover each CLO below 0.75 while it is still ahead', () => {
    const s = ready();
    const one = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: one }))).toMatchObject({ ok: false, error: expect.stringContaining('Week 9') });
    s.day = 58;
    const late = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: late })).ok).toBe(true);
  });
  it('needs left_out when time is short', () => {
    const s = lowTime();
    expect(check(s, studyInput(s))).toMatchObject({ ok: false, error: expect.stringContaining('left_out') });
    expect(check(s, studyInput(s, 's17', { left_out: ['Evaluate-level questions on real problems'] })).ok).toBe(true);
  });
  it('plans around a teacher’s sessions', () => {
    const s = ready();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    const d = days(s);
    d[2].minutes = 13;
    expect(check(s, studyInput(s, 's17', { days: d })).ok).toBe(false);
  });
});

describe('offline planner', () => {
  const clean = (s: DemoState) => studyPlanProblems(s, 's17', cannedStudyPlan(s, 's17', 'setup'));
  it('always passes the agent’s own checks', () => {
    expect(clean(ready())).toEqual([]);
    expect(clean(lowTime())).toEqual([]);
    const later = ready();
    later.day = 52;
    expect(clean(later)).toEqual([]);
    const teacher = ready();
    teacher.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    expect(clean(teacher)).toEqual([]);
  });
  it('is tagged offline and says what it drops when time is short', () => {
    const plan = cannedStudyPlan(lowTime(), 's17', 'setup');
    expect(plan.source).toBe('offline');
    expect(plan.leftOut.length).toBeGreaterThan(0);
  });
  it('spends more on the bigger, weaker CLOs', () => {
    const plan = cannedStudyPlan(ready(), 's17', 'setup');
    const minutes = (clo: string) => plan.days.filter((d) => d.clo === clo).reduce((a, d) => a + d.minutes, 0);
    expect(minutes('CLO2')).toBeGreaterThan(minutes('CLO1'));
  });
});

describe('the prompt', () => {
  it('states the rules and never assumes pronouns', () => {
    expect(STUDY_SYSTEM).toContain('exactly one entry for every day');
    expect(STUDY_SYSTEM).toContain('left_out');
    expect(STUDY_SYSTEM).toContain("do not assume anyone's pronouns");
  });
  it('gives the agent the calendar, the estimate and the reason for the plan', () => {
    const s = ready();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    const text = String(studyMessages(s, 's17', 'markSwing')[0].content);
    expect(text).toContain('Nguyễn Minh Anh');
    expect(text).toContain('Sat 31 Oct');
    expect(text).toContain('Quiz 3');
    expect(text).toContain('teacher session takes 18 min');
    expect(text).toContain('At risk');
    expect(text).toContain('A new mark moved sharply');
  });
});

describe('planStudy', () => {
  it('uses the agent’s plan and shows thinking lines', async () => {
    const s = ready();
    const { client } = fakeClient([CALL(studyInput(s))]);
    const steps: string[] = [];
    const plan = await planStudy(s, 's17', 'setup', { client, onStep: (l) => steps.push(l) });
    expect(plan?.source).toBe('agents');
    expect(steps.every((l) => l.startsWith('Study Planning Agent ·'))).toBe(true);
    expect(steps.length).toBeGreaterThan(1);
  });
  it('retries an invalid plan once, then falls back to the offline planner', async () => {
    const s = ready();
    const bad = studyInput(s, 's17', { days: [] });
    const fake = fakeClient([CALL(bad), CALL(bad)]);
    expect((await planStudy(s, 's17', 'setup', deps(fake.client)))?.source).toBe('offline');
    expect(fake.calls).toHaveLength(2);
    expect((await planStudy(s, 's17', 'bandChange', deps(fakeClient([CALL(bad), CALL(bad)]).client)))?.source).toBe('offline');
  });
  it('falls back at setup, but a failed replan keeps the current plan', async () => {
    const s = ready();
    expect((await planStudy(s, 's17', 'setup', deps(failingClient())))?.source).toBe('offline');
    expect(await planStudy(s, 's17', 'disengaged', deps(failingClient()))).toBeNull();
  });
  it('plans offline with no client', async () => {
    const plan: StudyPlan | null = await planStudy(ready(), 's17', 'markSwing', deps(null));
    expect(plan?.source).toBe('offline');
  });
});
```

In `server/agents/tools.test.ts`, change the expected tool list to end with `'compare_students', 'get_exam_outlook'`, and add:

```ts
describe('exam outlook', () => {
  it('reports the road to the exam, and says when a student has not set up', () => {
    const state = seedState();
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({ setUp: false, passMark: 50, nextAssessment: { title: 'Assignment 2' } });
    const rec = ensureRecord(state, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents', days: [{ day: 41, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    rec.days[40] = { planned: 20, done: 12, check: null };
    rec.replans.push({ day: 40, signal: 'setup', reason: 'Implication first.' });
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({
      setUp: true, band: 'At risk', minutesPlanned: 20, minutesDone: 12, lastChange: { reason: 'Implication first.' },
    });
    expect(readLabel(state, 'get_exam_outlook', { student_id: 's17' })).toBe('Student Analysis Agent · reading Minh Anh’s road to the exam');
  });
  it('finds students who may not pass, among those with a plan', () => {
    const state = seedState();
    expect(readTool(state, 'find_students', { status: 'examRisk', concept: '', below: -1, name: '' })).toEqual([]);
    const rec = ensureRecord(state, 's17');
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [] };
    expect(readTool(state, 'find_students', { status: 'examRisk', concept: '', below: -1, name: '' })).toMatchObject([{ id: 's17' }]);
  });
});
```

(import `ensureRecord` from `../../src/live/study/record`, and `seedState` if the file does not already.)

In `server/agents/agents.test.ts`, add to `prompts carry the eval fixes`:

```ts
  it('SAS answers exam questions from the outlook, as an estimate', () => {
    expect(SAS_SYSTEM).toContain('get_exam_outlook');
    expect(SAS_SYSTEM).toContain('an estimate');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/agents`
Expected: FAIL — cannot resolve `./cannedStudy`.

- [ ] **Step 3: Write `src/live/study/outlook.ts`**

```ts
import { CLOS, EXAM_DAY, fullDate, nextAssessment, type CloId } from '../../scenario/course';
import type { DemoState, PassBand, ReplanSignal, StudentProfile } from '../types';
import { cloMastery, PASS_MARK, passEstimate } from './estimate';
import { newRecord } from './record';

export interface ExamOutlook {
  setUp: boolean;
  /** Always an estimate, never a prediction to state as fact. */
  projectedScore: number;
  band: PassBand;
  passMark: number;
  cloMastery: Record<CloId, number>;
  minutesPlanned: number;
  minutesDone: number;
  nextAssessment: { title: string; date: string; daysAway: number } | null;
  exam: { date: string; daysAway: number };
  lastChange: { date: string; signal: ReplanSignal; reason: string } | null;
}

/** Where a student stands on the road to the exam. Used by the agents and the teacher's panel. */
export function examOutlook(state: DemoState, student: StudentProfile): ExamOutlook {
  const rec = state.study[student.id] ?? newRecord(student);
  const days = Object.values(rec.days);
  const next = nextAssessment(state.day);
  const last = rec.replans.at(-1) ?? null;
  const est = passEstimate(student, rec, state.day);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  return {
    setUp: rec.reported !== null,
    projectedScore: est.score,
    band: est.band,
    passMark: PASS_MARK,
    cloMastery: Object.fromEntries(CLOS.map((c) => [c.id, round2(cloMastery(student, c.id))])) as Record<CloId, number>,
    minutesPlanned: days.reduce((a, d) => a + d.planned, 0),
    minutesDone: Math.round(days.reduce((a, d) => a + d.done, 0)),
    nextAssessment: next && { title: next.title, date: fullDate(next.day), daysAway: next.day - state.day },
    exam: { date: fullDate(EXAM_DAY), daysAway: EXAM_DAY - state.day },
    lastChange: last && { date: fullDate(last.day), signal: last.signal, reason: last.reason },
  };
}

/** Students with a study plan whose estimate is At risk or Unlikely. */
export const examRisk = (state: DemoState): StudentProfile[] =>
  state.students.filter((s) => state.study[s.id]?.plan && passEstimate(s, state.study[s.id], state.day).band !== 'Likely');
```

- [ ] **Step 4: Add the tool**

In `server/agents/tools.ts`:

Import `examOutlook, examRisk` from `../../src/live/study/outlook`.

In `READ_TOOLS`, widen `find_students`'s `status` enum to `['', 'onTrack', 'support', 'highRisk', 'escalated', 'examRisk']`, append to its description ` "examRisk" means students with a study plan whose exam estimate is At risk or Unlikely.`, and add a last entry:

```ts
  tool('get_exam_outlook', "A student's road to the final exam: projected score and band (estimates), mastery per learning outcome (CLO), minutes planned and done, the next assessment, and the last change to the study plan with its reason. setUp is false until the student has set up on the phone.", {
    student_id: { type: 'string' },
  }),
```

In `find`, after the `escalated` branch:

```ts
  else if (status === 'examRisk') list = examRisk(state);
```

placed before the generic `else if (status)`. In `readTool`:

```ts
    case 'get_exam_outlook': return examOutlook(state, studentOf(state, input.student_id));
```

In `readLabel`:

```ts
    case 'get_exam_outlook': return `${p} reading ${who(input.student_id)}’s road to the exam`;
```

In `server/agents/sas.ts`, add this paragraph to `SAS_SYSTEM`, just before the paragraph that begins `When you have the answer`:

```
For questions about the exam, passing or readiness, use get_exam_outlook. Its score and band are an estimate, so say so; never state a pass or fail as fact. To find who may not pass, use find_students with status examRisk.
```

- [ ] **Step 5: Write `server/agents/cannedStudy.ts`**

```ts
import { capacityLeft, shortOfTime } from '../../src/live/study/capacity';
import { cloMastery } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan } from '../../src/live/types';
import { CLOS, EXAM_DAY, REVISION_START, shortDate, studyDays, weekOf, type Clo, type CloId } from '../../src/scenario/course';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';

const TARGET = 0.75;

const REASON: Record<ReplanSignal, (focus: string, exam: string) => string> = {
  setup: (focus, exam) => `This plan works back from the exam on ${exam}, with the most time on ${focus}.`,
  markSwing: (focus) => `Your latest mark changed the picture, so more time now goes to ${focus}.`,
  disengaged: (focus) => `The last few days were quieter, so this plan is lighter and stays on ${focus}.`,
  bandChange: (focus) => `Your exam outlook changed, so more time now goes to ${focus}.`,
  teacherPlan: (focus) => `Your lecturer sent you a plan, so your own study now fits around it, with the rest on ${focus}.`,
};

/** Capacity shared out by exam share × gap, with Week 9 spread across the CLOs still below target. */
export function cannedStudyPlan(state: DemoState, studentId: string, signal: ReplanSignal): StudyPlan {
  const student = state.students.find((s) => s.id === studentId)!;
  const weight = (c: Clo) => c.share * Math.max(0.05, TARGET - cloMastery(student, c.id));
  const total = CLOS.reduce((a, c) => a + weight(c), 0);
  const byWeight = [...CLOS].sort((a, b) => weight(b) - weight(a));
  const weak = byWeight.filter((c) => cloMastery(student, c.id) < TARGET);
  const given: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };
  const turns: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };

  const pool = (c: Clo): ConceptId[] => {
    const low = c.concepts.filter((x) => student.mastery[x] < TARGET);
    return [...(low.length ? low : c.concepts)].sort((a, b) => student.mastery[a] - student.mastery[b]);
  };
  const concepts = (c: Clo): ConceptId[] => {
    const p = pool(c);
    const start = turns[c.id]++;
    return [...new Set(Array.from({ length: Math.min(2, p.length) }, (_, k) => p[(start + k) % p.length]))];
  };

  const days = studyDays(state.day).map((day) => {
    const minutes = capacityLeft(state, studentId, day);
    const spent = Object.values(given).reduce((a, b) => a + b, 0) || 1;
    const behind = [...CLOS].sort((a, b) => (weight(b) / total - given[b.id] / spent) - (weight(a) / total - given[a.id] / spent))[0];
    const clo = weekOf(day) === 9 && weak.length ? weak[(day - REVISION_START) % weak.length] : behind;
    given[clo.id] += minutes;
    return { day, minutes, clo: clo.id, concepts: concepts(clo) };
  });

  return {
    createdDay: state.day,
    reason: REASON[signal](byWeight[0].title.toLowerCase(), shortDate(EXAM_DAY)),
    leftOut: shortOfTime(state, studentId) ? [`Full coverage of “${byWeight[byWeight.length - 1].title}”: the time goes where the exam weighs most.`] : [],
    source: 'offline',
    days,
  };
}
```

- [ ] **Step 6: Write `server/agents/study.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { capacityLeft, shortOfTime, teacherMinutes } from '../../src/live/study/capacity';
import { cardsToday } from '../../src/live/study/cards';
import { cloMastery, minutesNeeded, PASS_MARK, passEstimate } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan, StudyPlanDay } from '../../src/live/types';
import { ASSESSMENTS, CLOS, EXAM_DAY, REVISION_START, shortDate, studyDays, weekOf } from '../../src/scenario/course';
import { conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { cannedStudyPlan } from './cannedStudy';
import { AgentError, runAgent, type AgentSpec, type Check } from './loop';
import type { Deps } from './orchestrate';
import { CONCEPT_IDS, obj, tool } from './tools';

const TARGET = 0.75;
const STEP = 'Study Planning Agent ·';

const STUDY_TOOL = tool('propose_study_plan', 'Hand in the study plan. Call this once, last.', {
  reason: { type: 'string', description: 'One sentence for the student: what this plan focuses on, and why.' },
  left_out: { type: 'array', items: { type: 'string' }, description: 'What is deliberately dropped because time cannot cover everything. Empty when nothing is.' },
  days: {
    type: 'array',
    items: obj({
      day: { type: 'integer', description: 'The day number from the calendar.' },
      minutes: { type: 'integer' },
      clo: { type: 'string', enum: CLOS.map((c) => c.id) },
      concepts: { type: 'array', items: { type: 'string', enum: CONCEPT_IDS } },
    }),
  },
});

export const STUDY_SYSTEM = `You are the Study Planning Agent in Beyond. You write one student's study plan from today to the day before the final exam of Discrete Mathematics. All data is fictional demo data.

Balance three things: the time the student really has, how likely they are to pass, and what most needs revising. Exam and assessment dates are fixed.

Rules:
- Give exactly one entry for every day in the calendar, in order. Never go over a day's available minutes. A rest day has 0 minutes.
- Each entry names one learning outcome (CLO) and 1 to 3 of that CLO's concepts.
- Prioritise by exam share and weakness. Build on prerequisites: a concept comes after the concepts it depends on.
- Before an assessment, favour the CLOs it tests.
- Week 9 is revision week: give minutes to every CLO still below 0.75.
- Teacher sessions are fixed, and their minutes are already taken off the calendar. Plan around them; you cannot change them.
- Do not fill every minute if less will do. A plan the student can keep to beats a full one.
- left_out names what you are deliberately dropping when time cannot cover everything. Leave it empty otherwise. Be honest: never imply everything fits when it does not.

Write reason as one short sentence to the student, in plain English, without figures. Use the student's name if you use a name at all; do not assume anyone's pronouns.

Always finish with propose_study_plan.`;

const WHY: Record<ReplanSignal, string> = {
  setup: 'This is the student’s first plan.',
  markSwing: 'A new mark moved sharply against the previous one.',
  disengaged: 'The student has mostly stopped practising.',
  bandChange: 'The pass estimate moved to a different band.',
  teacherPlan: 'The lecturer has just sent the student a plan.',
};

/** What is wrong with a plan, as messages the agent can act on. */
export function studyPlanProblems(state: DemoState, studentId: string, plan: StudyPlan): string[] {
  const student = state.students.find((s) => s.id === studentId)!;
  const wanted = studyDays(state.day);
  const out: string[] = [];
  if (!plan.reason.trim()) out.push('Give a reason.');
  if (plan.days.length !== wanted.length || wanted.some((d, i) => plan.days[i].day !== d)) {
    out.push(`Give exactly one entry for each day from ${state.day} to ${EXAM_DAY - 1}, in order, and nothing after that.`);
    return out;
  }
  for (const d of plan.days) {
    const clo = CLOS.find((c) => c.id === d.clo);
    const left = capacityLeft(state, studentId, d.day);
    if (d.minutes < 0) out.push(`Day ${d.day} has negative minutes.`);
    if (d.minutes > left) out.push(`Day ${d.day} has ${d.minutes} minutes but only ${left} are available.`);
    if (d.concepts.length > 3) out.push(`Day ${d.day} has more than 3 concepts.`);
    if (d.minutes > 0 && d.concepts.length === 0) out.push(`Day ${d.day} has minutes but no concepts.`);
    if (d.concepts.some((c) => !clo?.concepts.includes(c))) out.push(`Day ${d.day} has a concept outside ${d.clo}.`);
  }
  if (state.day <= REVISION_START) {
    for (const c of CLOS) {
      const covered = plan.days.some((d) => weekOf(d.day) === 9 && d.clo === c.id && d.minutes > 0);
      if (cloMastery(student, c.id) < TARGET && !covered) out.push(`Week 9 needs minutes for ${c.id}, which is still below ${TARGET}.`);
    }
  }
  if (plan.leftOut.length === 0 && shortOfTime(state, studentId)) out.push('The time left cannot cover everything: say what you are dropping in left_out.');
  return out;
}

export const studySpec = (state: DemoState, studentId: string): AgentSpec<StudyPlan> => {
  const check: Check<StudyPlan> = (input) => {
    const r = input as { reason: string; left_out: string[]; days: StudyPlanDay[] };
    const plan: StudyPlan = { createdDay: state.day, reason: r.reason, leftOut: r.left_out, source: 'agents', days: r.days };
    const problems = studyPlanProblems(state, studentId, plan);
    return problems.length ? { ok: false, error: `The plan needs fixing: ${problems.join(' ')} Call propose_study_plan again.` } : { ok: true, value: plan };
  };
  return {
    system: STUDY_SYSTEM,
    tools: [STUDY_TOOL],
    finish: 'propose_study_plan',
    check,
    exec: (name) => { throw new Error(`Unknown tool ${name}.`); },
    label: () => null,
  };
};

export function studyMessages(state: DemoState, studentId: string, signal: ReplanSignal): Anthropic.Beta.BetaMessageParam[] {
  const s = state.students.find((x) => x.id === studentId)!;
  const rec = state.study[studentId];
  const est = passEstimate(s, rec, state.day);
  const teacher = teacherMinutes(state, studentId);
  const label = (c: ConceptId) => conceptById(c).label;
  const weakest = [...CONCEPT_IDS].sort((a, b) => s.mastery[a] - s.mastery[b]).slice(0, 5);
  const recent = Object.entries(rec.days).filter(([d]) => Number(d) >= state.day - 7).map(([, v]) => v.done);
  const { due } = cardsToday(rec, state.day, []);
  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  const calendar = studyDays(state.day).map((d) => {
    const parts = [`${d} · ${shortDate(d)}${weekOf(d) === 9 ? ' (revision week)' : ''}: ${capacityLeft(state, studentId, d)} min available`];
    if (teacher[d]) parts.push(`teacher session takes ${teacher[d]} min`);
    const a = ASSESSMENTS.find((x) => x.day === d);
    if (a) parts.push(`${a.title} on ${a.clos.join(', ')}`);
    return parts.join(' · ');
  });
  const lines = [
    `Student: ${s.name} (${s.id}; call them ${s.short}).`,
    `Why this plan is being written: ${WHY[signal]}`,
    ...(rec.plan ? [`The current plan’s reason: ${rec.plan.reason}`] : []),
    `Pass estimate: ${est.score} out of 100 (${est.band}); the pass mark is ${PASS_MARK}. The final exam is on ${shortDate(EXAM_DAY)}.`,
    `Time the student reported: ${rec.reported?.weekday} min on weekdays, ${rec.reported?.weekend} min at weekends. Actually done on recent days: ${recent.join(', ') || 'no data yet'}.`,
    'Learning outcomes:',
    ...CLOS.map((c) => `- ${c.id} ${c.title}: mastery ${cloMastery(s, c.id).toFixed(2)}, ${Math.round(c.share * 100)}% of the exam. Concepts: ${c.concepts.join(', ')}.`),
    `Weakest concepts: ${weakest.map((c) => `${label(c)} ${s.mastery[c].toFixed(2)}`).join(', ')}.`,
    `Marks this term: ${rec.marks.map((m) => `${m.assessment} ${m.mark}`).join(', ') || 'none since Quiz 2'}. Cards due today: ${due.length}.`,
    `Reaching 0.75 on every concept would take about ${minutesNeeded(s)} minutes; ${available} are available.${shortOfTime(state, studentId) ? ' That is not enough: left_out must say what you are dropping.' : ''}`,
    'Calendar (day number · date: minutes available):',
    ...calendar,
  ];
  return [{ role: 'user', content: lines.join('\n') }];
}

const warn = (e: unknown) => console.warn(`[beyond] study planning failed: ${e instanceof Error ? e.message : e}`);

/**
 * The student's plan. The offline planner steps in when there is no client, at setup, or when the agent cannot produce
 * a valid plan. If a replan fails for any other reason, the result is null: the student keeps the current plan.
 */
export async function planStudy(state: DemoState, studentId: string, signal: ReplanSignal, deps: Pick<Deps, 'client' | 'onStep' | 'signal'>): Promise<StudyPlan | null> {
  const offline = () => cannedStudyPlan(state, studentId, signal);
  if (!deps.client) return offline();
  deps.onStep(`${STEP} reading progress and practice`);
  deps.onStep(`${STEP} checking the exam calendar`);
  deps.onStep(`${STEP} writing the plan`);
  try {
    return await runAgent(deps.client, studySpec(state, studentId), studyMessages(state, studentId, signal), deps);
  } catch (e) {
    if (deps.signal?.aborted) throw e;
    warn(e);
    return signal === 'setup' || e instanceof AgentError ? offline() : null;
  }
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run server/agents`
Expected: PASS.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/live/study/outlook.ts server/agents/study.ts server/agents/cannedStudy.ts server/agents/study.test.ts server/agents/tools.ts server/agents/tools.test.ts server/agents/sas.ts server/agents/samples.ts server/agents/agents.test.ts
git commit -m "feat(agents): Study Planning Agent, offline planner and the exam outlook tool"
```

---

### Task 7: Background replans in the session, and the study routes

**Files:**
- Modify: `server/session.ts`, `server/app.ts`
- Test: `server/session.study.test.ts`, modify `server/app.test.ts`

**Interfaces:**
- Consumes: Task 5 reducers, `applyPlan`; Task 4 `nextReplan`; Task 6 `planStudy`.
- Produces on `DemoSession`: `studyOpen()`, `studyPick(id)`, `studySetup(weekday, weekend)`, `studyTab(tab)`, `studyPractice(clo)`, `studyRate(cardId, rating)`, `studyCheckIn()`, `nextDay(check)`, `nextWeek()`, `simulateDrop()`, `settled()`.
- Routes under `/api/study/`: `open`, `pick {studentId}`, `setup {weekday, weekend}`, `tab {tab}`, `practice {clo}`, `rate {cardId, rating}`, `check-in`, `next-day {check}`, `next-week`, `simulate-drop`.

- [ ] **Step 1: Write the failing test**

Create `server/session.study.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { currentItems } from '../src/live/reducer';
import type { DemoState } from '../src/live/types';
import type { MessagesClient } from './agents/client';
import { failingClient, fakeClient } from './agents/fakeClient';
import { studyInput } from './agents/samples';
import { DemoSession } from './session';

/** Answers every planning request with a valid plan for the state at that moment. */
const planner = (get: () => DemoState): MessagesClient => ({
  create: (params, options) => fakeClient([[{ tool: 'propose_study_plan', input: studyInput(get()) }]]).client.create(params, options),
});
/** Never answers until aborted. */
const hanging: MessagesClient = {
  create: (_p, o) => new Promise((_, reject) => { o?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }),
};

const joined = async (session: DemoSession, id = 's17') => {
  session.studyOpen();
  session.studyPick(id);
  session.studySetup(30, 60);
  await session.settled();
  return session;
};
const offline = () => joined(new DemoSession(null));
const replans = (s: DemoSession) => s.state.study.s17.replans.filter((r) => r.signal !== 'setup');
const practise = async (session: DemoSession) => {
  session.studyPractice(null);
  while (session.state.phone.self) {
    session.phoneAnswer(currentItems(session.state)[session.state.phone.item].correct);
    const next = session.phoneNext();
    if (!next.ok) throw new Error(next.error);
    await next.done;
  }
};

describe('setup', () => {
  it('writes the first plan in the background and lands on Today', async () => {
    const session = await offline();
    expect(session.state.phone.screen).toBe('today');
    expect(session.state.study.s17).toMatchObject({ planning: null, pendingSignal: null, lastReplanDay: 40, band: 'Likely' });
    expect(session.state.study.s17.plan?.source).toBe('offline');
  });
  it('shows the agent’s thinking lines while it writes', async () => {
    const session: DemoSession = new DemoSession(planner(() => session.state));
    const seen: string[][] = [];
    session.subscribe((s) => { if (s.study.s17?.planning) seen.push(s.study.s17.planning.steps); });
    await joined(session);
    expect(seen.at(-1)?.length).toBeGreaterThan(0);
    expect(session.state.study.s17.plan?.source).toBe('agents');
  });
  it('does not make the teacher wait', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    expect(session.state.busy).toBe(false);
    expect(session.ask('How is the class doing?', null).ok).toBe(true);
    session.reset();
  });
});

describe('replanning stays rare', () => {
  it('a day with a little practice replans nothing', async () => {
    const session = await offline();
    await practise(session);
    session.nextDay('right');
    await session.settled();
    expect(replans(session)).toEqual([]);
  });
  it('a skipped week replans exactly once', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    expect(replans(session).map((r) => r.signal)).toEqual(['disengaged']);
  });
  it('holds a signal during the cooldown and replans when it ends, if still true', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    for (let day = 48; day < 52; day++) {
      session.nextDay(null);
      await session.settled();
      expect(session.state.study.s17.pendingSignal, `day ${day}`).not.toBeNull();
      expect(replans(session)).toHaveLength(1);
    }
    session.nextDay(null);
    await session.settled();
    expect(session.state.day).toBe(52);
    expect(replans(session)).toHaveLength(2);
  });
  it('drops a held signal once the student is back', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    session.nextDay(null);
    await session.settled();
    expect(session.state.study.s17.pendingSignal).toBe('disengaged');
    for (let i = 0; i < 3; i++) {
      await practise(session);
      session.nextDay('right');
      await session.settled();
    }
    expect(session.state.study.s17.pendingSignal).not.toBe('disengaged');
  });
  it('a mark swing goes straight through the cooldown', async () => {
    const session = await offline();
    session.simulateDrop();
    await session.settled();
    expect(replans(session).map((r) => r.signal)).toEqual(['markSwing']);
  });
  it('a pathway the teacher approves replans around it, without changing it', async () => {
    const session = await offline();
    const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
    if (!r.ok) throw new Error(r.error);
    await r.done;
    const before = structuredClone(session.state.plans[0].sessions);
    session.approve('p1');
    await session.settled();
    expect(replans(session).map((x) => x.signal)).toEqual(['teacherPlan']);
    expect(session.state.plans[0].sessions).toEqual(before);
  });
  it('a teacher plan for someone not set up starts nothing', async () => {
    const session = new DemoSession(null);
    const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
    if (!r.ok) throw new Error(r.error);
    await r.done;
    session.approve('p1');
    await session.settled();
    expect(session.state.study).toEqual({});
  });
});

describe('Next day never waits for an agent', () => {
  it('moves on while a plan is still being written', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    expect(session.nextDay(null)).toEqual({ ok: true });
    expect(session.state.day).toBe(41);
    session.reset();
  });
  it('a signal raised while a plan is being written waits its turn', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.simulateDrop();
    expect(session.state.study.s17.pendingSignal).toBe('markSwing');
    session.reset();
  });
});

describe('when planning fails', () => {
  it('a failed replan keeps the plan and leaves the signal pending', async () => {
    let fail = false;
    const session: DemoSession = new DemoSession({ create: (p, o) => (fail ? failingClient() : planner(() => session.state)).create(p, o) });
    await joined(session);
    const plan = session.state.study.s17.plan;
    fail = true;
    session.nextWeek();
    await session.settled();
    expect(session.state.study.s17.plan).toEqual(plan);
    expect(session.state.study.s17).toMatchObject({ pendingSignal: 'disengaged', planning: null });
  });
  it('setup still ends with a plan, tagged offline', async () => {
    const session = await joined(new DemoSession(failingClient()));
    expect(session.state.study.s17.plan?.source).toBe('offline');
  });
  it('reset drops a plan being written and clears the study records', async () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.reset();
    await session.settled();
    expect(session.state).toMatchObject({ study: {}, day: 40 });
    expect(session.state.phone).toMatchObject({ screen: 'lock', studentId: null });
  });
});
```

Add to `server/app.test.ts`:

```ts
describe('study routes', () => {
  it('runs the student’s day over HTTP', async () => {
    const { session, post } = setup();
    expect((await post('study/open')).status).toBe(200);
    expect(session.state.phone.screen).toBe('pick');
    expect((await post('study/pick', { studentId: 's17' })).status).toBe(200);
    expect((await post('study/setup', { weekday: 30, weekend: 60 })).status).toBe(200);
    await session.settled();
    expect((await post('study/tab', { tab: 'cards' })).status).toBe(200);
    expect((await post('study/practice', { clo: 'CLO1' })).status).toBe(200);
    expect(session.state.phone.screen).toBe('practice');
    expect((await post('study/tab', { tab: 'today' })).status).toBe(200);
    expect((await post('study/rate', { cardId: 'card-implication-1', rating: 'good' })).status).toBe(200);
    expect((await post('study/check-in')).status).toBe(200);
    expect((await post('study/next-day', { check: 'right' })).status).toBe(200);
    expect(session.state.day).toBe(41);
    expect((await post('study/next-week')).status).toBe(200);
    expect(session.state.day).toBe(48);
    expect((await post('study/simulate-drop')).status).toBe(200);
    await session.settled();
  });
  it('rejects bad input', async () => {
    const { post } = setup();
    expect((await post('study/pick', { studentId: 's99' })).status).toBe(400);
    expect((await post('study/setup', { weekday: 30, weekend: 60 })).status).toBe(400);
    expect((await post('study/simulate-drop')).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/session.study.test.ts server/app.test.ts`
Expected: FAIL — `session.studyOpen is not a function`.

- [ ] **Step 3: Add replanning to the session**

In `server/session.ts`, add imports:

```ts
import * as S from '../src/live/study/reducer';
import { nextReplan } from '../src/live/study/signals';
import type { CardRating, DemoState, ReplanSignal, StudyDay } from '../src/live/types';
import type { CloId } from '../src/scenario/course';
import { planStudy } from './agents/study';
```

(replacing the existing `DemoState` type import). Add fields after `runs`:

```ts
  /** Study plans being written. They never set `busy`: the phone and the teacher keep working. */
  private planners = new Set<AbortController>();
  private planning = new Set<Promise<void>>();
```

Replace `approve` with:

```ts
  approve(planId: string): Done {
    const out = this.run(R.approvePlan(this.state, planId));
    const plan = R.planById(this.state, planId);
    if (out.ok && plan?.kind === 'pathway' && this.state.study[plan.studentIds[0]]?.reported) this.weigh(plan.studentIds[0], 'teacherPlan');
    return out;
  }
```

Add after `adapt`:

```ts
  studyOpen(): Done { return this.run(S.openPick(this.state)); }
  studyPick(id: string): Done { return this.run(S.pickStudent(this.state, id)); }
  studyTab(tab: S.StudyTab): Done { return this.run(S.showTab(this.state, tab)); }
  studyPractice(clo: CloId | null): Done { return this.run(S.startSelf(this.state, clo)); }
  studyRate(cardId: string, rating: CardRating): Done { return this.run(S.rateCard(this.state, cardId, rating)); }
  studyCheckIn(): Done { return this.run(S.openCheckIn(this.state)); }
  nextDay(check: StudyDay['check']): Done { return this.moved(S.advance(this.state, 1, check)); }
  nextWeek(): Done { return this.moved(S.advance(this.state, 7, null)); }
  simulateDrop(): Done { return this.moved(S.simulateDrop(this.state)); }

  /** Saves the student's time and writes the first plan. */
  studySetup(weekday: number, weekend: number): Done {
    const out = this.run(S.saveSetup(this.state, weekday, weekend));
    if (out.ok) this.replan(this.state.phone.studentId!, 'setup');
    return out;
  }

  /** Settles when no study plan is being written. */
  async settled(): Promise<void> {
    await Promise.all(this.planning);
  }

  private moved(r: S.StudyResult): Done {
    const out = this.run(r);
    if (r.ok) this.weigh(r.state.phone.studentId!, r.signal);
    return out;
  }

  /** What a signal means today: a replan now, or held until the cooldown or the plan in progress ends. */
  private weigh(studentId: string, raised: ReplanSignal | null) {
    const rec = this.state.study[studentId];
    const { run, hold } = nextReplan(rec, raised, this.state.day);
    if (run && !rec.planning) {
      this.replan(studentId, run);
      return;
    }
    this.update(this.state.epoch, (st) => { st.study[studentId].pendingSignal = run ?? hold; });
  }

  /** Writes a plan in the background. A failed replan keeps the current plan and leaves the signal pending. */
  private replan(studentId: string, signal: ReplanSignal) {
    const epoch = this.state.epoch;
    const abort = new AbortController();
    this.planners.add(abort);
    this.update(epoch, (st) => { Object.assign(st.study[studentId], { planning: { steps: [] }, pendingSignal: null }); });
    const giveUp = () => this.update(epoch, (st) => { Object.assign(st.study[studentId], { planning: null, pendingSignal: signal }); });
    const run = planStudy(structuredClone(this.state), studentId, signal, {
      client: this.client,
      signal: abort.signal,
      onStep: (line) => this.update(epoch, (st) => { st.study[studentId].planning?.steps.push(line); }),
    })
      .then((plan) => {
        if (plan) this.update(epoch, (st) => S.applyPlan(st, studentId, plan, signal));
        else giveUp();
      })
      .catch((e) => {
        if (abort.signal.aborted) return; // reset: its result is dropped on purpose
        console.warn('[beyond] study planning failed:', e instanceof Error ? e.message : e);
        giveUp();
      })
      .finally(() => {
        this.planners.delete(abort);
        this.planning.delete(run);
      });
    this.planning.add(run);
  }
```

In `reset`, before `this.set(seedState(...))`:

```ts
    for (const run of this.planners) run.abort();
    this.planners.clear();
```

- [ ] **Step 4: Add the routes**

In `server/app.ts`, import `type { StudyTab } from '../src/live/study/reducer'`, `type { CardRating, StudyDay } from '../src/live/types'` and `type { CloId } from '../src/scenario/course'`, and add before `/api/reset`:

```ts
  app.post('/api/study/open', (c) => reply(c, session.studyOpen()));
  app.post('/api/study/pick', async (c) => reply(c, session.studyPick(String((await body(c)).studentId))));
  app.post('/api/study/setup', async (c) => {
    const b = await body(c);
    return reply(c, session.studySetup(Number(b.weekday), Number(b.weekend)));
  });
  app.post('/api/study/tab', async (c) => reply(c, session.studyTab(String((await body(c)).tab) as StudyTab)));
  app.post('/api/study/practice', async (c) => {
    const b = await body(c);
    return reply(c, session.studyPractice(typeof b.clo === 'string' ? (b.clo as CloId) : null));
  });
  app.post('/api/study/rate', async (c) => {
    const b = await body(c);
    return reply(c, session.studyRate(String(b.cardId), String(b.rating) as CardRating));
  });
  app.post('/api/study/check-in', (c) => reply(c, session.studyCheckIn()));
  app.post('/api/study/next-day', async (c) => {
    const b = await body(c);
    return reply(c, session.nextDay(typeof b.check === 'string' ? (b.check as StudyDay['check']) : null));
  });
  app.post('/api/study/next-week', (c) => reply(c, session.nextWeek()));
  app.post('/api/study/simulate-drop', (c) => reply(c, session.simulateDrop()));
```

The reducers validate the cast values, so an unknown tab, rating or check returns 400.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server`
Expected: PASS. In the setup test, Minh Anh's band is `Likely` because the plan's minutes add the capped gain of 0.20 to an unplanned 46.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/session.ts server/app.ts server/session.study.test.ts server/app.test.ts
git commit -m "feat(study): background replans with a cooldown, and the study routes"
```

---

### Task 8: The phone's study screens

**Files:**
- Create: `src/student/studyView.ts`, `src/student/studyView.test.ts`, `src/student/screens/StudyScreens.tsx`
- Modify: `src/student/LivePhone.tsx`, `src/student/screens/LivePractice.tsx`, `src/student/liveAudit.test.tsx`, `src/student/live.test.tsx`

**Interfaces:**
- Consumes: `todayList`, `TodayRow`, `cardsToday`, `passEstimate`, `cloMastery`, `SELF_SESSION`; `course.ts` helpers; routes from Task 7.
- Produces: `pickList(state)`, `todayView(state)`, `morningCopy(state)`, `practiseView(state)`, `cardsView(state)`, `semesterView(state)`, `rowLabel(row)`, and their view types; `TabBar`, `PickScreen`, `SetupScreen`, `TodayScreen`, `PractiseScreen`, `CardsScreen`, `SemesterScreen`, `CheckInScreen`.

Screens use egg tokens only. Student names use the sans face, because Instrument Serif has no Vietnamese glyphs.

- [ ] **Step 1: Write the failing tests**

Create `src/student/studyView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan } from '../live/reducer';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { reviewCard } from '../live/study/cards';
import type { DemoState, StudyPlan } from '../live/types';
import { CARDS } from '../scenario/cards';
import { cardsView, morningCopy, pickList, practiseView, rowLabel, semesterView, todayView } from './studyView';

const PLAN: StudyPlan = {
  createdDay: 40, reason: 'Implication first.', leftOut: ['Evaluate-level questions'], source: 'agents',
  days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
};
const ready = (): DemoState => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  rec.plan = PLAN;
  s.phone = { ...s.phone, studentId: 's17', screen: 'today' };
  return s;
};

describe('study views', () => {
  it('lists Minh Anh first of the 55 students', () => {
    const list = pickList(seedState());
    expect(list).toHaveLength(55);
    expect(list[0]).toMatchObject({ id: 's17', name: 'Nguyễn Minh Anh' });
  });
  it('builds Today: countdown, estimate, reason and rows', () => {
    const v = todayView(ready())!;
    expect(v).toMatchObject({ name: 'Minh Anh', examIn: 'Final exam in 24 days', band: 'Likely', reason: 'Implication first.', offline: false, planning: null, examDay: false });
    expect(v.rows.map(rowLabel)).toEqual(['4 flip cards', 'Practise implication']);
  });
  it('shows the agent’s lines while the first plan is written', () => {
    const s = ready();
    Object.assign(s.study.s17, { plan: null, planning: { steps: ['Study Planning Agent · writing the plan'] } });
    expect(todayView(s)).toMatchObject({ planning: ['Study Planning Agent · writing the plan'], reason: null });
  });
  it('builds the morning notification with no agent', () => {
    const s = ready();
    s.phone.morning = true;
    expect(morningCopy(s)).toEqual({ title: 'Today’s calendar', body: '20 min · 4 cards, implication practice · Assignment 2 in 6 days' });
    s.day = 51;
    expect(morningCopy(s)?.body).toContain('Quiz 3 tomorrow');
    s.phone.morning = false;
    expect(morningCopy(s)).toBeNull();
  });
  it('shows each CLO with the student’s Bloom level', () => {
    const s = ready();
    expect(practiseView(s)).toMatchObject([
      { id: 'CLO1', level: 'Understand', share: 40 },
      { id: 'CLO2', level: 'Understand', share: 40 },
      { id: 'CLO3', level: 'Apply', share: 20 },
    ]);
  });
  it('serves due cards before new ones, and says when none are left', () => {
    const s = ready();
    const due = CARDS.find((c) => c.concept === 'negation')!;
    s.study.s17.cards[due.id] = reviewCard(undefined, 'good', 38);
    expect(cardsView(s)).toMatchObject({ card: { id: due.id }, left: 5 });
    for (const c of CARDS) s.study.s17.cards[c.id] = reviewCard(undefined, 'easy', 40);
    expect(cardsView(s)).toMatchObject({ card: null, left: 0 });
  });
  it('lays out the weeks to the exam, marks and why the plan changed', () => {
    const s = ready();
    const rec = s.study.s17;
    rec.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    rec.replans.push({ day: 40, signal: 'setup', reason: 'First.' }, { day: 52, signal: 'markSwing', reason: 'More equivalence.' });
    const v = semesterView(s)!;
    expect(v.weeks.map((w) => w.week)).toEqual([6, 7, 8, 9, 10]);
    expect(v.weeks[1].assessments).toEqual([{ title: 'Assignment 2', date: 'Fri 6 Nov', mark: null }]);
    expect(v.weeks[2].assessments[0]).toMatchObject({ title: 'Quiz 3', mark: 22 });
    expect(v.weeks[3]).toMatchObject({ revision: true, minutes: 140 });
    expect(v.changes).toEqual([{ date: 'Thu 12 Nov', why: 'A mark moved sharply', reason: 'More equivalence.' }]);
    expect(v.leftOut).toEqual(['Evaluate-level questions']);
  });
  it('puts a teacher’s plan at the top of Today', () => {
    const r = approvePlan(stateWithPlan('pathway', { day: 'Today', date: 40 }), 'p1');
    if (!r.ok) throw new Error(r.error);
    const rec = ensureRecord(r.state, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = PLAN;
    expect(todayView(r.state)!.rows[0]).toMatchObject({ kind: 'plan', title: 'Review implication' });
  });
});
```

Add to `src/student/live.test.tsx`:

```ts
describe('self-started practice', () => {
  const self = () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    s.phone.studentId = 's17';
    const r = startSelf(s, 'CLO1');
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  it('shows the Bloom level and counts to 5', () => {
    const out = html(<LivePractice state={self()} onAnswer={() => {}} onNext={() => {}} />);
    expect(out).toContain('Practice · Understand');
    expect(out).toContain('1 / 5');
  });
});
```

(import `seedState`, `ensureRecord` from `../live/study/record`, `startSelf` from `../live/study/reducer`.)

In `src/student/liveAudit.test.tsx`, add the study states to `STATES`, with these helpers above it:

```ts
const study = (screen: DemoState['phone']['screen'], over: Partial<DemoState['phone']> = {}) => () => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  rec.plan = {
    createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
  };
  s.phone = { ...s.phone, studentId: 's17', screen, ...over };
  return s;
};
```

```ts
  ['idle lock', seedState],
  ['morning lock', study('lock', { morning: true })],
  ['pick', () => ({ ...seedState(), phone: { ...seedState().phone, screen: 'pick' as const } })],
  ['setup', () => { const s = study('setup')(); s.study.s17.reported = null; return s; }],
  ['today', study('today')],
  ['choose practice', study('choosePractice')],
  ['cards', study('cards')],
  ['semester', study('semester')],
  ['check-in', study('checkIn')],
```

(import `seedState`, `ensureRecord`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/student`
Expected: FAIL — cannot resolve `./studyView`.

- [ ] **Step 3: Write `src/student/studyView.ts`**

```ts
import { studentById } from '../live/reducer';
import { cardsToday } from '../live/study/cards';
import { cloMastery, passEstimate } from '../live/study/estimate';
import { todayList, type TodayRow } from '../live/study/today';
import type { DemoState, PassBand, ReplanSignal } from '../live/types';
import type { Card } from '../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, fullDate, nextAssessment, shortDate, weekOf, type Assessment, type CloId } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';
import { MINH_ANH } from '../scenario/minhAnh';

export interface TodayView {
  name: string;
  date: string;
  examIn: string;
  examDay: boolean;
  band: PassBand;
  reason: string | null;
  offline: boolean;
  /** Agent steps while a plan is being written with none on the phone yet. */
  planning: string[] | null;
  /** A new plan is being written behind the current one. */
  replanning: boolean;
  budget: number;
  done: number;
  rows: TodayRow[];
}

export interface PractiseRow { id: CloId; title: string; level: string; share: number; mastery: number }

export interface SemesterWeek {
  week: number;
  from: string;
  minutes: number;
  focus: CloId[];
  revision: boolean;
  assessments: { title: string; date: string; mark: number | null }[];
}

export interface SemesterView {
  weeks: SemesterWeek[];
  leftOut: string[];
  changes: { date: string; why: string; reason: string }[];
}

const WHY: Partial<Record<ReplanSignal, string>> = {
  markSwing: 'A mark moved sharply',
  disengaged: 'Practice dropped off',
  bandChange: 'Your exam outlook changed',
  teacherPlan: 'Your lecturer sent a plan',
};

const countdown = (a: Assessment, today: number) => {
  const n = a.day - today;
  return n === 0 ? `${a.title} today` : n === 1 ? `${a.title} tomorrow` : `${a.title} in ${n} days`;
};

const recordOf = (state: DemoState) => {
  const id = state.phone.studentId;
  const rec = id ? state.study[id] : undefined;
  return id && rec?.reported ? { id, rec, student: studentById(state, id)! } : null;
};

/** Minh Anh first, then the class in roster order. */
export const pickList = (state: DemoState): { id: string; name: string }[] =>
  [...state.students].sort((a, b) => Number(b.id === MINH_ANH.id) - Number(a.id === MINH_ANH.id)).map((s) => ({ id: s.id, name: s.name }));

export function rowLabel(row: TodayRow): string {
  if (row.kind === 'plan') return row.title;
  if (row.kind === 'cards') return `${row.count} flip cards`;
  return `Practise ${row.concepts.map((c) => conceptById(c).label.toLowerCase()).join(', ')}`;
}

export function todayView(state: DemoState): TodayView | null {
  const r = recordOf(state);
  if (!r) return null;
  const { budget, done, rows } = todayList(state, r.id);
  const exam = ASSESSMENTS.find((a) => a.day === EXAM_DAY)!;
  return {
    name: r.student.short,
    date: fullDate(state.day),
    examIn: countdown(exam, state.day),
    examDay: state.day >= EXAM_DAY,
    band: passEstimate(r.student, r.rec, state.day).band,
    reason: r.rec.plan?.reason ?? null,
    offline: r.rec.plan?.source === 'offline',
    planning: r.rec.planning && !r.rec.plan ? r.rec.planning.steps : null,
    replanning: r.rec.planning !== null && r.rec.plan !== null,
    budget,
    done: Math.round(done),
    rows,
  };
}

/** "Today's calendar", built from the plan and the rules. No agent is involved. */
export function morningCopy(state: DemoState): { title: string; body: string } | null {
  const r = state.phone.morning ? recordOf(state) : null;
  if (!r) return null;
  const { budget, rows } = todayList(state, r.id);
  const cards = rows.find((x) => x.kind === 'cards');
  const practice = rows.find((x) => x.kind === 'practice');
  const work = [
    cards?.kind === 'cards' ? `${cards.count} cards` : null,
    practice?.kind === 'practice' ? `${conceptById(practice.concepts[0]).label.toLowerCase()} practice` : null,
  ].filter(Boolean).join(', ');
  const next = nextAssessment(state.day);
  return { title: 'Today’s calendar', body: [`${budget} min`, work, next && countdown(next, state.day)].filter(Boolean).join(' · ') };
}

export function practiseView(state: DemoState): PractiseRow[] {
  const r = recordOf(state);
  if (!r) return [];
  return CLOS.map((c) => ({
    id: c.id, title: c.title, level: c.levels[r.rec.bloom[c.id]], share: Math.round(c.share * 100), mastery: Math.round(cloMastery(r.student, c.id) * 100),
  }));
}

export function cardsView(state: DemoState): { card: Card | null; left: number } {
  const r = recordOf(state);
  if (!r) return { card: null, left: 0 };
  const { due, fresh } = cardsToday(r.rec, state.day, todayList(state, r.id).concepts);
  const queue = [...due, ...fresh];
  return { card: queue[0] ?? null, left: queue.length };
}

export function semesterView(state: DemoState): SemesterView | null {
  const r = recordOf(state);
  if (!r) return null;
  const plan = r.rec.plan;
  const weeks: SemesterWeek[] = [];
  for (let week = weekOf(state.day); week <= weekOf(EXAM_DAY); week++) {
    const days = plan?.days.filter((d) => weekOf(d.day) === week && d.day >= state.day) ?? [];
    weeks.push({
      week,
      from: shortDate((week - 1) * 7),
      minutes: days.reduce((a, d) => a + d.minutes, 0),
      focus: [...new Set(days.filter((d) => d.minutes > 0).map((d) => d.clo))],
      revision: week === 9,
      assessments: ASSESSMENTS.filter((a) => weekOf(a.day) === week).map((a) => ({
        title: a.title, date: shortDate(a.day), mark: r.rec.marks.find((m) => m.assessment === a.id)?.mark ?? (a.id === 'quiz2' ? r.student.quiz.q2 : null),
      })),
    });
  }
  const changes = [...r.rec.replans].reverse().flatMap((c) => {
    const why = WHY[c.signal];
    return why ? [{ date: shortDate(c.day), why, reason: c.reason }] : [];
  });
  return { weeks, leftOut: plan?.leftOut ?? [], changes };
}
```

- [ ] **Step 4: Write `src/student/screens/StudyScreens.tsx`**

```tsx
import { useState } from 'react';
import type { TodayRow } from '../../live/study/today';
import type { CardRating, StudyDay } from '../../live/types';
import type { Card } from '../../scenario/cards';
import type { CloId } from '../../scenario/course';
import { Eyebrow, Mark } from '../../teacher/parts';
import { rowLabel, type PractiseRow, type SemesterView, type TodayView } from '../studyView';
import type { StudyTab } from '../../live/study/reducer';

const BASE = 'absolute inset-0 overflow-y-auto bg-egg-bg px-5 pt-14 font-sans text-egg-ink';
/** Leaves room for the tab bar. */
const SCREEN = `${BASE} pb-24`;
const PLAIN = `${BASE} pb-8`;
const PRIMARY = 'w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card';
const GHOST = 'w-full rounded-full border border-egg-ink py-3 text-[15px] font-semibold text-egg-ink';
const ROW = 'flex w-full items-center gap-3 border-b border-egg-line py-3.5 text-left';

const TABS: { id: StudyTab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'choosePractice', label: 'Practise' }, { id: 'cards', label: 'Cards' }, { id: 'semester', label: 'Semester' },
];

export function TabBar({ active, onTab }: { active: StudyTab; onTab(tab: StudyTab): void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 flex border-t border-egg-line bg-egg-card" style={{ zIndex: 20 }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onTab(t.id)}
          className={`flex-1 py-3.5 text-[13.5px] font-semibold ${t.id === active ? 'text-egg-ink' : 'text-egg-mute'}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function PickScreen({ students, onPick }: { students: { id: string; name: string }[]; onPick(id: string): void }) {
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">Who are you?</div>
      <div className="mt-1 text-[14px] text-egg-mute">Choose a student from the class. All of them are fictional.</div>
      <div className="mt-4 border-t border-egg-line">
        {students.map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s.id)} className={`${ROW} text-[16px] font-semibold`}>{s.name}</button>
        ))}
      </div>
    </div>
  );
}

function Minutes({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="mt-4 block">
      <span className="text-[15px] font-semibold">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={5}
        max={240}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-egg-line bg-egg-card px-4 py-3 font-mono text-[18px] text-egg-ink"
      />
    </label>
  );
}

export function SetupScreen({ onSave }: { onSave(weekday: number, weekend: number): void }) {
  const [weekday, setWeekday] = useState('30');
  const [weekend, setWeekend] = useState('60');
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">How much time do you have?</div>
      <div className="mt-1 text-[14px] text-egg-mute">Your plan will fit this, then learn from what you really do.</div>
      <Minutes label="Minutes on a weekday" value={weekday} onChange={setWeekday} />
      <Minutes label="Minutes on a weekend day" value={weekend} onChange={setWeekend} />
      <button type="button" onClick={() => onSave(Number(weekday), Number(weekend))} className={`${PRIMARY} mt-6`}>Build my plan</button>
    </div>
  );
}

export function TodayScreen({ view, onRow, onNextDay, onNextWeek }: { view: TodayView; onRow(row: TodayRow): void; onNextDay(): void; onNextWeek(): void }) {
  return (
    <div className={SCREEN}>
      <div className="text-[15px] text-egg-mute">{view.date}</div>
      <div className="text-[26px] font-bold">{view.name}</div>
      <div className="mt-4 rounded-3xl bg-egg-ink p-5 text-egg-card">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-card/60">{view.examIn}</div>
        <div className="mt-2 font-serif text-[34px] leading-none">{view.band}</div>
        <div className="mt-1.5 text-[13px] text-egg-card/75">Your pass estimate. It is an estimate, not a result.</div>
      </div>
      {view.planning && (
        <div className="mt-4 rounded-2xl bg-egg-tint p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><Mark size={14} />Writing your plan</div>
          {view.planning.map((line) => <div key={line} className="mt-1 text-[13px] text-egg-mute">{line}</div>)}
        </div>
      )}
      {view.reason && <div className="mt-4 text-[15px] leading-snug">{view.reason}</div>}
      {view.offline && <div className="mt-1 text-[12.5px] text-egg-mute">Offline plan</div>}
      {view.replanning && <div className="mt-1 text-[12.5px] text-egg-mute">Updating your plan…</div>}
      {!view.examDay && !view.planning && (
        <>
          <div className="mt-6"><Eyebrow>{`Today · ${view.done} of ${view.budget} min`}</Eyebrow></div>
          <div className="mt-2 border-t border-egg-line">
            {view.rows.map((row, i) => (
              <button key={i} type="button" onClick={() => onRow(row)} className={ROW}>
                <span className="flex-1 text-[16px] font-semibold">{rowLabel(row)}</span>
                <span className="text-[13px] text-egg-mute">{`${row.minutes} min`}</span>
              </button>
            ))}
            {view.rows.length === 0 && <div className="py-3.5 text-[15px] text-egg-mute">Nothing left for today.</div>}
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onNextDay} className={GHOST}>Next day</button>
            <button type="button" onClick={onNextWeek} className={GHOST}>Next week</button>
          </div>
        </>
      )}
      {view.examDay && <div className="mt-6 rounded-2xl bg-egg-sage-tint p-3 text-center text-[15px] font-semibold text-egg-sage">Good luck today</div>}
    </div>
  );
}

export function PractiseScreen({ rows, onStart }: { rows: PractiseRow[]; onStart(clo: CloId | null): void }) {
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Practise</div>
      <div className="mt-1 text-[14px] text-egg-mute">5 questions, chosen for you.</div>
      <button type="button" onClick={() => onStart(null)} className={`${PRIMARY} mt-4`}>Practise what I need</button>
      <div className="mt-6 border-t border-egg-line">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => onStart(r.id)} className={ROW}>
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">{r.title}</span>
              <span className="block text-[13px] text-egg-mute">{`${r.level} · ${r.share}% of the exam`}</span>
            </span>
            <span className="font-mono text-[14px] text-egg-mute">{`${r.mastery}%`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const RATINGS: { id: CardRating; label: string }[] = [{ id: 'again', label: 'Again' }, { id: 'hard', label: 'Hard' }, { id: 'good', label: 'Good' }, { id: 'easy', label: 'Easy' }];

/** Reveal is local: the server only hears the rating. Keyed by card in LivePhone, so a new card starts face down. */
export function CardsScreen({ card, left, onRate }: { card: Card | null; left: number; onRate(rating: CardRating): void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Cards</div>
      <div className="mt-1 text-[14px] text-egg-mute">{card ? `${left} left today` : 'Nothing due. Come back tomorrow.'}</div>
      {card && (
        <>
          <div className="mt-4 rounded-3xl border border-egg-line bg-egg-card p-5">
            <div className="text-[19px] font-bold leading-snug">{card.front}</div>
            {shown && <div className="mt-4 border-t border-egg-line pt-4 text-[16px] leading-snug">{card.back}</div>}
          </div>
          {shown ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button key={r.id} type="button" onClick={() => onRate(r.id)} className="rounded-2xl border border-egg-ink py-2.5 text-[14px] font-semibold">{r.label}</button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setShown(true)} className={`${PRIMARY} mt-4`}>Show the answer</button>
          )}
        </>
      )}
    </div>
  );
}

export function SemesterScreen({ view }: { view: SemesterView }) {
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Road to the exam</div>
      {view.weeks.map((w) => (
        <section key={w.week} className="mt-4 border-t border-egg-line pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">{`Week ${w.week}${w.revision ? ' · revision' : ''}`}</span>
            <span className="text-[13px] text-egg-mute">{w.minutes ? `${w.minutes} min · ${w.focus.join(', ')}` : w.from}</span>
          </div>
          {w.assessments.map((a) => (
            <div key={a.title} className="mt-1 flex justify-between text-[14px]">
              <span>{`${a.title} · ${a.date}`}</span>
              {a.mark !== null && <span className="font-mono">{`${a.mark}%`}</span>}
            </div>
          ))}
        </section>
      ))}
      {view.leftOut.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Left out for now</Eyebrow>
          {view.leftOut.map((l) => <div key={l} className="mt-1 text-[14px] leading-snug">{l}</div>)}
        </section>
      )}
      {view.changes.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Why this changed</Eyebrow>
          {view.changes.map((c) => (
            <div key={`${c.date}:${c.why}`} className="mt-2 rounded-2xl bg-egg-tint p-3 text-[14px] leading-snug">
              <div className="font-semibold">{`${c.date} · ${c.why}`}</div>
              <div className="text-egg-mute">{c.reason}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const CHECKS: { id: Exclude<StudyDay['check'], null>; label: string }[] = [
  { id: 'tooMuch', label: 'Too much' }, { id: 'right', label: 'About right' }, { id: 'tooLittle', label: 'Too little' },
];

export function CheckInScreen({ onAnswer, onBack }: { onAnswer(check: StudyDay['check']): void; onBack(): void }) {
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">How was today?</div>
      <div className="mt-1 text-[14px] text-egg-mute">This keeps your plan realistic.</div>
      <div className="mt-5 space-y-3">
        {CHECKS.map((c) => <button key={c.id} type="button" onClick={() => onAnswer(c.id)} className={GHOST}>{c.label}</button>)}
      </div>
      <button type="button" onClick={onBack} className="mt-5 text-[13.5px] font-semibold text-egg-mute underline underline-offset-4">Back to today</button>
    </div>
  );
}
```

- [ ] **Step 5: Teach `LivePractice` about self sessions**

In `src/student/screens/LivePractice.tsx`, import `SELF_SESSION` from `../../live/study/select`, and replace the lines from `const plan = …` through `const last = …` with:

```tsx
  const plan = planById(state, ph.planId);
  const items = currentItems(state);
  const item = items[ph.item];
  const session = !ph.self && plan && ph.session !== null ? plan.sessions[ph.session] : null;
  if (!item || (!ph.self && !session)) return null;
  const right = ph.result === 'right';
  const guided = right ? item.guided : undefined;
  const total = ph.self ? SELF_SESSION : items.length;
  const last = ph.item + 1 >= total;
  const heading = session ? (session.isMasteryCheck ? 'Mastery check' : 'Guided practice') : `Practice · ${item.bloom}`;
```

Replace the header line, the progress width and the last-button label to use them:

```tsx
        <span>{`${heading} · ${conceptById(item.concept).label}`}</span>
        <span>{`${ph.item + 1} / ${total}`}</span>
```

```tsx
        <div className="h-full rounded-full bg-egg-accent" style={{ width: `${((ph.item + (right ? 1 : 0)) / total) * 100}%` }} />
```

```tsx
          {last ? (session ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Finish practice') : 'Next'}
```

Change the option buttons' `key={o}` to `key={i}`: added items may have long or repeated text.

- [ ] **Step 6: Wire `LivePhone`**

In `src/student/LivePhone.tsx`:

Add imports:

```tsx
import type { StudyTab } from '../live/study/reducer';
import type { TodayRow } from '../live/study/today';
import { CardsScreen, CheckInScreen, PickScreen, PractiseScreen, SemesterScreen, SetupScreen, TabBar, TodayScreen } from './screens/StudyScreens';
import { cardsView, morningCopy, pickList, practiseView, semesterView, todayView } from './studyView';
```

Add above `LivePhone`:

```tsx
const IDLE_COPY = { title: 'Welcome to Beyond', body: 'Tap to choose your student.' };
const TAB_SCREENS: readonly string[] = ['today', 'choosePractice', 'cards', 'semester'];
```

Replace `const message = notificationCopy(state);` with:

```tsx
  const morning = morningCopy(state);
  const message = morning ?? notificationCopy(state) ?? (ph.studentId ? null : IDLE_COPY);
```

After `const send = …`, add:

```tsx
  const tapLock = () => {
    if (morning) send('study/tab', { tab: 'today' });
    else if (ph.planId) send('phone/plan');
    else send('study/open');
  };
  const tab = (t: StudyTab) => send('study/tab', { tab: t });
  const openRow = (row: TodayRow) => {
    if (row.kind === 'plan') send('phone/open', { sessionIndex: row.index });
    else if (row.kind === 'cards') tab('cards');
    else send('study/practice', { clo: null });
  };
  const today = ph.screen === 'today' ? todayView(state) : null;
  const semester = ph.screen === 'semester' ? semesterView(state) : null;
  const cards = cardsView(state);
```

Change the lock line's `onTap` to `onTap={message ? tapLock : undefined}`, and add after the `progress` line:

```tsx
      {ph.screen === 'pick' && <PickScreen students={pickList(state)} onPick={(id) => send('study/pick', { studentId: id })} />}
      {ph.screen === 'setup' && <SetupScreen onSave={(weekday, weekend) => send('study/setup', { weekday, weekend })} />}
      {today && <TodayScreen view={today} onRow={openRow} onNextDay={() => send('study/check-in')} onNextWeek={() => send('study/next-week')} />}
      {ph.screen === 'choosePractice' && <PractiseScreen rows={practiseView(state)} onStart={(clo) => send('study/practice', { clo })} />}
      {ph.screen === 'cards' && <CardsScreen key={cards.card?.id ?? 'none'} card={cards.card} left={cards.left} onRate={(rating) => send('study/rate', { cardId: cards.card!.id, rating })} />}
      {semester && <SemesterScreen view={semester} />}
      {ph.screen === 'checkIn' && <CheckInScreen onAnswer={(check) => send('study/next-day', { check })} onBack={() => tab('today')} />}
      {TAB_SCREENS.includes(ph.screen) && <TabBar active={ph.screen as StudyTab} onTab={tab} />}
      {(ph.screen === 'plan' || ph.screen === 'progress') && ph.studentId && (
        <button type="button" onClick={() => tab('today')} className="absolute right-5 text-[13.5px] font-semibold text-egg-mute underline underline-offset-4" style={{ top: 58, zIndex: 31 }}>
          Today
        </button>
      )}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/student`
Expected: PASS.

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/student/studyView.ts src/student/studyView.test.ts src/student/screens/StudyScreens.tsx src/student/screens/LivePractice.tsx src/student/LivePhone.tsx src/student/liveAudit.test.tsx src/student/live.test.tsx
git commit -m "feat(phone): pick, setup, Today, practise, cards, semester and check-in screens"
```

---

### Task 9: Teacher view and the Director's drop button

**Files:**
- Modify: `src/teacher/LivePanel.tsx`, `src/teacher/TeacherScreen.tsx`, `src/controller/BoothPanel.tsx`
- Test: `src/teacher/livePanel.test.tsx`, `src/teacher/live.test.tsx`, `src/controller/controller.test.tsx`

**Interfaces:**
- Consumes: `examOutlook`, `examRisk`.
- Produces: `RoadToExam` section in the student panel; a live-only attention row; **Simulate a Quiz 3 drop** in the Director.

- [ ] **Step 1: Write the failing tests**

Add to `src/teacher/livePanel.test.tsx`:

```tsx
describe('road to the exam', () => {
  const withStudy = () => {
    const s = stateWithPlan();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'More on equivalence.', leftOut: [], source: 'agents', days: [{ day: 41, minutes: 20, clo: 'CLO2', concepts: ['equivalence'] }] };
    rec.days[40] = { planned: 20, done: 12, check: null };
    rec.replans.push({ day: 40, signal: 'markSwing', reason: 'More on equivalence.' });
    return s;
  };
  it('shows the estimate, minutes and the last change for a student with a plan', () => {
    const out = render(withStudy(), { kind: 'student', studentId: 's17', planId: null, highlight: null });
    expect(out).toContain('Road to the exam');
    expect(out).toContain('At risk');
    expect(out).toContain('12 of 20 min');
    expect(out).toContain('More on equivalence.');
  });
  it('stays out of the way for a student who has not set up', () => {
    expect(render(stateWithPlan(), { kind: 'student', studentId: 's17', planId: null, highlight: null })).not.toContain('Road to the exam');
  });
});
```

(import `ensureRecord` from `../live/study/record`.)

Add to `src/teacher/live.test.tsx`, beside the test `shows the story clock, Reset demo and live attention figures on the opening screen`, using that file's `render` helper:

```tsx
  it('adds an attention row for students who may not pass, only when there are some', () => {
    expect(render(seedState(), null)).not.toContain('May not pass');
    const withPlan = seedState();
    ensureRecord(withPlan, 's17').plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [] };
    expect(render(withPlan, null)).toContain('May not pass');
  });
```

(import `seedState` from `../live/seed` and `ensureRecord` from `../live/study/record`.)

Add to `src/controller/controller.test.tsx`, inside `describe('BoothPanel', …)`:

```tsx
  it('offers the Quiz 3 drop for a drastic signal on demand', () => {
    expect(renderToStaticMarkup(<BoothPanel />)).toContain('Simulate a Quiz 3 drop');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/teacher src/controller`
Expected: FAIL on the three additions.

- [ ] **Step 3: Add the panel section**

In `src/teacher/LivePanel.tsx`, import `examOutlook` from `../live/study/outlook`, and add above `StudentLive`:

```tsx
/** The student's own study, for a teacher who wants to look in. Nothing here needs approval. */
function RoadToExam({ s, state }: { s: StudentProfile; state: DemoState }) {
  const o = examOutlook(state, s);
  if (!o.setUp) return null;
  return (
    <Section title="Road to the exam" aside="estimate">
      <div className="grid grid-cols-2 border-b border-egg-line pb-3">
        <div className="pr-4">
          <Eyebrow>Pass estimate</Eyebrow>
          <div className="mt-1 font-serif text-[28px] leading-none text-egg-ink">{o.band}</div>
        </div>
        <div className="pl-4">
          <Eyebrow>Studied</Eyebrow>
          <div className="mt-1 text-[15px] font-semibold text-egg-ink">{`${o.minutesDone} of ${o.minutesPlanned} min`}</div>
        </div>
      </div>
      {o.lastChange && <div className="mt-3 text-[13.5px] text-egg-ink">{`${o.lastChange.date}: ${o.lastChange.reason}`}</div>}
    </Section>
  );
}
```

In `StudentLive`, add `<RoadToExam s={s} state={state} />` directly after the `Concept mastery` `Section`.

- [ ] **Step 4: Add the attention row**

In `src/teacher/TeacherScreen.tsx`:

Import `examRisk` from `../live/study/outlook`.

Widen `TODAY`'s type to `{ topic: ContextId; who: string; what: string; prompt?: string }[]`, and add below it:

```ts
/** Live only, while at least one student's exam estimate is At risk or Unlikely. */
const EXAM_ROW = { topic: 'attention' as ContextId, who: 'Road to the exam', what: 'May not pass', prompt: 'Which students may not pass the exam?' };
```

Append to the array in `liveFigures`: `String(examRisk(s).length)`.

Above `return` in the greeting component, add:

```tsx
  const list = live && examRisk(live.state).length > 0 ? [...TODAY, EXAM_ROW] : TODAY;
```

Change the map to:

```tsx
          {list.map((row, i) => (
            <button
              key={row.what}
              type="button"
              onClick={() => actions?.send(row.prompt ?? TOPICS[row.topic].prompt)}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-6 border-t border-egg-ink/70 py-3.5 text-left"
              style={{ opacity: rows[Math.min(i, 2)], transform: `translateY(${(1 - rows[Math.min(i, 2)]) * 12}px)` }}
            >
```

and in the row's figure use `figureOf(i, rows[Math.min(i, 2)])`. Nothing else in the row changes, so the scripted frames stay byte-identical.

- [ ] **Step 5: Add the Director button**

In `src/controller/BoothPanel.tsx`, add a state and handler in `BoothPanel`:

```tsx
  const [note, setNote] = useState<string | null>(null);
  const drop = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    void fetch('/api/study/simulate-drop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => setNote(r.ok ? 'Quiz 3 mark dropped: the phone’s plan is being rewritten.' : ((await r.json()) as { error?: string }).error ?? 'That did not work.'))
      .catch(() => setInfo('down'));
  };
```

Add the button after **Reset demo**, and the note below the button row:

```tsx
          <button className={btn} onClick={drop}>Simulate a Quiz 3 drop</button>
```

```tsx
        {note && <div className="mt-2 text-[13px] text-dim">{note}</div>}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/teacher src/controller`
Expected: PASS.

Run: `npm test && npm run typecheck && npm run contact-sheet -- --verify`
Expected: PASS, and the 43 frames match on both renders.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/LivePanel.tsx src/teacher/TeacherScreen.tsx src/controller/BoothPanel.tsx src/teacher/livePanel.test.tsx src/teacher/live.test.tsx src/controller/controller.test.tsx
git commit -m "feat(teacher): road to the exam, an attention row, and a Quiz 3 drop in the Director"
```

---

### Task 10: Eval Level 6, README and final verification

**Files:**
- Modify: `server/evals/cases.ts`, `server/evals/harness.ts`, `server/evals/run.ts`, `README.md`

**Interfaces:**
- Consumes: `DemoSession` study methods, `settled()`; `studyPlanProblems`, `passEstimate`, `examOutlook`.
- Produces: `practiseToday(t)` and `joinPhone(t, id, weekday, weekend)` in `harness.ts`; cases L6.1–L6.7.

- [ ] **Step 1: Add the harness helpers**

Add to `server/evals/harness.ts`:

```ts
/** The phone joins as a student and waits for the first plan. */
export async function joinPhone(t: T, studentId: string, weekday: number, weekend: number): Promise<void> {
  t.session.studyOpen();
  t.session.studyPick(studentId);
  const set = t.session.studySetup(weekday, weekend);
  if (!set.ok) throw new Error(`studySetup: ${set.error}`);
  await t.session.settled();
}

/** One self-started session, answering everything correctly first try. */
export async function practiseToday(t: T): Promise<void> {
  const started = t.session.studyPractice(null);
  if (!started.ok) throw new Error(`studyPractice: ${started.error}`);
  while (t.state.phone.self) {
    t.session.phoneAnswer(currentItems(t.state)[t.state.phone.item].correct);
    const next = t.session.phoneNext();
    if (!next.ok) throw new Error(`phoneNext: ${next.error}`);
    await next.done;
  }
}
```

- [ ] **Step 2: Add the cases**

In `server/evals/cases.ts`:

Change `level: 1 | 2 | 3 | 4 | 5;` to `level: 1 | 2 | 3 | 4 | 5 | 6;`. Add imports:

```ts
import { passEstimate } from '../../src/live/study/estimate';
import { studyPlanProblems } from '../agents/study';
```

add `joinPhone, practiseToday` to the import from `./harness`, and replace the `knowledgeGraph` import with `import { CONCEPTS, type ConceptId } from '../../src/scenario/knowledgeGraph';`.

Above `export const CASES`, add:

```ts
const planOf = (t: T, id = MA) => t.state.study[id].plan;
const replansOf = (t: T, id = MA) => t.state.study[id].replans.filter((r) => r.signal !== 'setup');
/** The first plan must come from the agent, not the offline planner. */
function firstPlanIsGood(t: T, id = MA) {
  const plan = planOf(t, id);
  t.check('Intervene', 'the agent wrote the plan', plan?.source === 'agents', `source: ${plan?.source}`);
  if (plan) t.check('Oversee', 'the plan passes every check', studyPlanProblems(t.state, id, plan).length === 0, studyPlanProblems(t.state, id, plan).join(' '));
  t.noPronouns('Intervene', plan?.reason ?? '');
}
```

Append to `CASES`:

```ts
  { id: 'L6.1', level: 6, title: 'The plan fits the time the student has', run: async (t) => {
    await joinPhone(t, MA, 20, 40);
    firstPlanIsGood(t);
    const over = planOf(t)!.days.filter((d) => d.minutes > (d.day % 7 >= 5 ? 40 : 20));
    t.check('Intervene', 'no day goes over the stated time', over.length === 0, JSON.stringify(over.slice(0, 3)));
  } },
  { id: 'L6.2', level: 6, title: 'Honest about what time cannot cover', run: async (t) => {
    for (const c of CONCEPTS) t.student('s29').mastery[c.id] = 0.15;
    await joinPhone(t, 's29', 5, 5);
    firstPlanIsGood(t, 's29');
    t.check('Intervene', 'left_out says what is dropped', (planOf(t, 's29')?.leftOut.length ?? 0) > 0, JSON.stringify(planOf(t, 's29')));
  } },
  { id: 'L6.3', level: 6, title: 'A skipped week replans exactly once', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    t.session.nextWeek();
    await t.session.settled();
    t.check('Adapt', 'one replan, for disengagement', replansOf(t).map((r) => r.signal).join() === 'disengaged', replansOf(t).map((r) => r.signal).join());
    t.check('Adapt', 'the new plan is the agent’s', planOf(t)?.source === 'agents', `source: ${planOf(t)?.source}`);
    t.check('Adapt', 'the new plan respects what really happened', planOf(t)!.days.every((d) => d.minutes <= 10), JSON.stringify(planOf(t)!.days.slice(0, 3)));
  } },
  { id: 'L6.4', level: 6, title: 'Small misses change nothing', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    const plan = planOf(t);
    for (let i = 0; i < 3; i++) {
      await practiseToday(t);
      t.session.nextDay('right');
      await t.session.settled();
    }
    t.check('Oversee', 'no replan', replansOf(t).length === 0, replansOf(t).map((r) => r.signal).join());
    t.check('Oversee', 'the plan is untouched', planOf(t) === plan || JSON.stringify(planOf(t)) === JSON.stringify(plan));
  } },
  { id: 'L6.5', level: 6, title: 'A Quiz 3 drop goes through the cooldown', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    t.session.nextDay('right');
    await t.session.settled();
    t.session.simulateDrop();
    await t.session.settled();
    t.check('Adapt', 'one replan, for the mark', replansOf(t).map((r) => r.signal).join() === 'markSwing', replansOf(t).map((r) => r.signal).join());
    t.check('Adapt', 'the replan says what changed', (replansOf(t)[0]?.reason.length ?? 0) > 10 && /mark|quiz|result|score/i.test(replansOf(t)[0]?.reason ?? ''), replansOf(t)[0]?.reason);
    t.noPronouns('Adapt', replansOf(t)[0]?.reason ?? '');
  } },
  { id: 'L6.6', level: 6, title: 'Week 6 to the exam', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    const estimate = () => passEstimate(t.student(MA), t.state.study[MA], t.state.day);
    const start = estimate().score;
    t.point('setup', MA, 'equivalence');
    while (t.state.day < 64) {
      await practiseToday(t);
      t.session.nextDay('right');
      await t.session.settled();
      if (t.state.day % 7 === 1) t.point(`day ${t.state.day}: ${estimate().band} ${estimate().score}`, MA, 'equivalence');
    }
    const rec = t.state.study[MA];
    t.check('Adapt', 'mastery rose', estimate().score > start, `${start} -> ${estimate().score}`);
    t.check('Sense', 'both remaining assessments have marks', rec.marks.map((m) => m.assessment).join() === 'a2,quiz3', rec.marks.map((m) => m.assessment).join());
    t.check('Oversee', 'replans stayed rare', replansOf(t).length <= 4, replansOf(t).map((r) => `${r.day}:${r.signal}`).join(' '));
  } },
  { id: 'L6.7', level: 6, title: 'Readiness answers match the data', run: async (t) => {
    await joinPhone(t, MA, 30, 60);
    const est = passEstimate(t.student(MA), t.state.study[MA], t.state.day);
    const a = await t.ask('Is Minh Anh likely to pass the exam?', null, 'Diagnose');
    t.check('Diagnose', 'used the exam outlook', a.steps.some((s) => s.includes('road to the exam')), a.steps.join(' | '));
    t.check('Diagnose', 'quotes the projected score', a.answer.includes(String(est.score)), `expected ${est.score} in: ${a.answer}`);
    t.check('Diagnose', 'says it is an estimate', /estimate|projected|projection/i.test(a.answer), a.answer);
    t.noPronouns('Diagnose', a.answer);
  } },
```

- [ ] **Step 3: Report Level 6**

In `server/evals/run.ts`, append `'The student’s semester: plans, replans and the road to the exam'` to `LEVEL_NAME`, and change the loop to `for (let level = 1; level <= 6; level++)`.

- [ ] **Step 4: Check the suite offline**

Run: `npm run eval -- --offline --level 6`
Expected: it runs with no crash and no spend. Agent-source checks fail, because this is the control.

- [ ] **Step 5: Update the README**

In `README.md`, in the **Live booth demo** section, add after the numbered steps:

```markdown
### The student's own loop

On the phone, tap the lock-screen notification and choose a student. Enter the minutes you have, and the Study Planning Agent writes a plan from today to the exam (24 November). Today shows the day's cards and practice; Practise picks 5 questions at the right Bloom level; Cards are self-rated flip cards; Semester shows the weeks to the exam and why the plan changed. **Next day** asks how the day felt and lands on the next morning's notification; **Next week** skips ahead without asking.

Plans change only on a drastic signal (a 15-point mark swing, three days with no practice, a change of pass band, or a teacher's plan) and at most once every 5 story days, except for marks and teacher plans. Replans run in the background, so the phone never waits. The Director's **Simulate a Quiz 3 drop** shows one on demand.
```

Add to the **Booth checklist**:

```markdown
- [ ] Phone: tap in, choose Minh Anh, set your minutes: the plan's thinking lines appear, then Today.
- [ ] Practise a set, flip some cards, **Next day**: the morning notification lands and opens Today.
- [ ] **Simulate a Quiz 3 drop**: Semester shows "Why this changed", and the teacher's panel shows the new reason under Road to the exam.
```

- [ ] **Step 6: Run the full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS.

Compare the video with the baseline the live booth work used:

```bash
npm run contact-sheet -- --verify
git worktree add .superpowers/frames-base cd4731f
(cd .superpowers/frames-base && npm ci && npm run contact-sheet)
diff -rq contact-sheet .superpowers/frames-base/contact-sheet
git worktree remove --force .superpowers/frames-base
```

Expected: 43 frames deterministic, and `diff` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add server/evals/cases.ts server/evals/harness.ts server/evals/run.ts README.md
git commit -m "test(evals): Level 6, the student's semester; README for the student loop"
```

The controller then runs, against the real API: `npm run test:live`, then `npm run eval` (about $3), commits the new report in `docs/evals/`, and reports the results.
