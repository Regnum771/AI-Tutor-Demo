# Quiz Attempts and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone practice keeps every try, lets the student move freely between questions, and ends every session on a review. Mastery credit falls with each try, and the teacher and the agents see tries per question.

**Architecture:** `PhoneState` swaps `hinted`, `result` and `lastOption` for an answer sheet, one `QuestionSheet` per question slot. Pure reducers in `src/live/reducer.ts` gain `phoneGoto`, `phoneAgain`, `phoneFinish` and `phoneContinue`, each wrapped by `DemoSession` and a route, as today. The credit rule is `gainFor(tryNumber)` in `src/live/mastery.ts`, and `noteAttempt` writes one `Attempt` per question at its first right answer. The phone gets a rebuilt `LivePractice` and a new `ReviewScreen`, both reading pure views in `src/student/liveView.ts`.

**Tech Stack:** TypeScript, React 18, Tailwind, Vitest (+ happy-dom for click tests), Hono server.

Spec: `docs/superpowers/specs/2026-11-01-quiz-attempts-review-design.md`, **sections 1 to 7 and the parts of section 9 that test them.**

**Not in this plan:** section 8 (plans only on request, the `focus` plan, focus reports) and its tests in section 9. Section 8 needs this plan's try data and changes the booth story, so it gets its own plan after this one is merged. The opening prompt "Why did Minh Anh's quiz score drop?" therefore still drafts a plan.

## Decisions the spec leaves open

These were settled while building this plan. Task 6 records them in the spec.

| Topic | Decision | Why |
|---|---|---|
| Jumping past empty self-practice slots | Slots fill in order, so a jump to dot 4 also picks slots 2 and 3 | `served` must stay in slot order, as section 2 requires |
| Where Continue goes | New field `PhoneState.reviewNext` | The adapt follow-up can replace the plan while the review is open, so the session can't be worked out from `planId` at that point |
| A follow-up landing on the review | `deliver` keeps the screen, the sheet and `reviewNext` | Finish starts the adapt run, so this is the normal path after a mastery check |
| Counting first tries on the progress screen | New field `Evidence.tries` on a right answer's row; agents don't see it | The sheet is gone by then, and a student on teacher plans alone has no study record |
| A re-answer's evidence | A row reading `answered again: <option>` with no `result` | Logged as the spec asks, without inflating right and wrong counts |
| Answer again, then the option just tapped | Adds nothing: no try, minutes or evidence, and the question closes again | The spec's rule that a repeat is not added |
| A wrong re-answer on screen | That option shows "Not quite" and its hint, and "Correct on try N" stays | Without this the tap would get no feedback |
| Next on the last question | Fails with `No such question.`; the phone shows Finish there | `phoneNext` is `phoneGoto(item + 1)` |
| A question that only ever had wrong tries | No `Attempt`, so question selection and forgetting ignore it | Follows from one `Attempt` at the first right answer; its minutes and evidence are still logged |

## Global Constraints

- Work on branch `quiz-attempts`, cut from `main`.
- Credit by try: `gainFor(tryNumber)` returns 0.30, 0.15, 0.05, then 0. Only the first correct answer for a question earns credit. A wrong answer leaves mastery alone.
- Bloom level: two first-try correct answers in a row move the CLO's level up; a wrong answer moves it down. Re-answers count for neither.
- Minutes: each try logs 1.5 minutes; a repeat tap of the same option logs nothing.
- One `Attempt` per question, written at its first correct answer, with `tries`. `firstTry` stays and means `tries === 1`. Each wrong tap still writes its evidence row.
- Evidence text reads `correct on try N` or `chose <option>`.
- Review summary format: "5 questions · 3 right first try · 9 tries in all".
- Every session ends on the review. Completion (marking the session done, adapt after a mastery check) happens when Finish opens the review. Continue goes to Today after self practice, the plan after a teacher session, and the progress screen after a mastery check.
- A teacher plan arriving mid-session still interrupts. Next day closes an open session without a review and keeps the credit already earned.
- The agent prompts don't change. Agents read the new evidence text and `averageTries`.
- Copy never assumes anyone's pronouns.
- The scripted video keeps working: don't touch `src/student/screens/PracticeScreen.tsx`, and `src/teacher/screen.test.tsx` and `src/teacher/script.test.ts` pass unchanged. `OPTION_CLS` stays exported from `PracticeScreen.tsx`.
- Every commit ends with `Co-Authored-By: <the model that actually writes the commit> <noreply@anthropic.com>`; the commands below show `Claude Opus 5.5`, so replace it if another model writes the commit.
- Stage only the files each task names. Never stage the unrelated working-tree changes: deleted `.env.local.example`, `.env.local copy.example`, `docs/superpowers/specs/2026-11-01-quiz-attempts-review-design.md`, `server/agents/study.test.ts`, anything under `docs/evals/`.
- This checkout's filesystem is case-insensitive: never create two files whose names differ only by case.
- Test command: `npx vitest run <path>`; types: `npm run typecheck`.

**How this plan was checked:** every code block below was built and run in a throwaway clone of `main` at `b7e671a`, one task at a time. The edits were generated from that build and applied in order to prove they reproduce it, so each "replace" text matches `main` exactly and only once. The test counts and failure messages are the real output.

---

### Task 1: Credit by try, and one attempt per question

**Files:**
- Modify: `src/live/mastery.ts`
- Modify: `src/live/reducer.ts`
- Modify: `src/live/study/record.ts`
- Modify: `src/live/types.ts`
- Test: `src/live/core.test.ts`, `src/live/reducer.test.ts`, `src/live/study/reducer.test.ts`, `src/live/study/rules.test.ts`

**Interfaces:**
- Consumes: `BankItem` (`src/scenario/practiceBank.ts`), `cloOf` (`src/scenario/course.ts`), `StudyRecord` (`src/live/types.ts`).
- Produces:
  - In `src/live/mastery.ts`: `gainFor(tryNumber: number): number`; `afterAnswer(value: number, correct: boolean, tryNumber: number): number`. `GAIN_FIRST_TRY` and `GAIN_AFTER_HINT` are gone.
  - In `src/live/types.ts`: `Attempt` gains `tries: number`.
  - In `src/live/study/record.ts`: `noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, tryNumber: number, inSession = false): void` (it no longer pushes an `Attempt` for a wrong try); `averageTries(rec: StudyRecord | undefined, today: number): number | null`.

- [ ] **Step 1: Write the failing tests**

`src/live/core.test.ts`:

Edit 1 of 2. Replace

```ts
import { stateWithPlan } from './fixtures';
import { afterAnswer, statusFor, topicMastery, twinConcepts } from './mastery';

```

with

```ts
import { stateWithPlan } from './fixtures';
import { afterAnswer, gainFor, statusFor, topicMastery, twinConcepts } from './mastery';

```

Edit 2 of 2. Replace

```ts
describe('mastery rule', () => {
  it('moves a correct answer toward 0.9, less after a hint, not at all when wrong', () => {
    expect(afterAnswer(0.3, true, false)).toBe(0.48);
    expect(afterAnswer(0.3, true, true)).toBe(0.39);
    expect(afterAnswer(0.3, false, false)).toBe(0.3);
    expect(afterAnswer(0.3, false, true)).toBe(0.3);
    expect(afterAnswer(0.97, true, false)).toBe(0.97);
    expect(afterAnswer(0.97, true, true)).toBe(0.97);
  });
```

with

```ts
describe('mastery rule', () => {
  it('earns less on each try: 30%, 15%, 5%, then nothing', () => {
    expect([1, 2, 3, 4, 9].map(gainFor)).toEqual([0.3, 0.15, 0.05, 0, 0]);
  });
  it('moves a correct answer toward 0.9 by its try, not at all when wrong', () => {
    expect(afterAnswer(0.3, true, 1)).toBe(0.48);
    expect(afterAnswer(0.3, true, 2)).toBe(0.39);
    expect(afterAnswer(0.3, true, 3)).toBe(0.33);
    expect(afterAnswer(0.3, true, 4)).toBe(0.3);
    expect(afterAnswer(0.3, false, 1)).toBe(0.3);
    expect(afterAnswer(0.97, true, 1)).toBe(0.97);
    expect(afterAnswer(0.97, true, 2)).toBe(0.97);
  });
```

`src/live/reducer.test.ts`:

Replace

```ts
    expect(s.phone.result).toBe('right');
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, true));
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', concept: 'implication', when: '15:30' });
```

with

```ts
    expect(s.phone.result).toBe('right');
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 2));
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', concept: 'implication', when: '15:30' });
```

`src/live/study/reducer.test.ts`:

Edit 1 of 2. Replace

```ts
    ensureRecord(s, 's17').reported = { weekday: 30, weekend: 30 };
    noteAttempt(s.study.s17, BANK[0], s.day, true, true, true);
    expect(s.study.s17.days[s.day]).toMatchObject({ done: 1.5, teacher: 1.5 });
```

with

```ts
    ensureRecord(s, 's17').reported = { weekday: 30, weekend: 30 };
    noteAttempt(s.study.s17, BANK[0], s.day, true, 1, true);
    expect(s.study.s17.days[s.day]).toMatchObject({ done: 1.5, teacher: 1.5 });
```

Edit 2 of 2. Replace

```ts
    Object.assign(s.students[16].mastery, { implication: 0.3, biconditional: 0.29, expressions: 0.295 });
    s.study.s17.attempts.push({ itemId: item('biconditional').id, day: 41, correct: true, firstTry: true });
    const after = ok(advance(s, 7, null)); // Saturday 40 → Saturday 47, through Monday 42
```

with

```ts
    Object.assign(s.students[16].mastery, { implication: 0.3, biconditional: 0.29, expressions: 0.295 });
    s.study.s17.attempts.push({ itemId: item('biconditional').id, day: 41, correct: true, firstTry: true, tries: 1 });
    const after = ok(advance(s, 7, null)); // Saturday 40 → Saturday 47, through Monday 42
```

`src/live/study/rules.test.ts`:

Edit 1 of 6. Replace

```ts
import { markFor } from './marks';
import { ensureRecord, newRecord, noteAttempt, noteForecast } from './record';
import { refocus } from './refocus';
```

with

```ts
import { markFor } from './marks';
import { averageTries, ensureRecord, newRecord, noteAttempt, noteForecast } from './record';
import { refocus } from './refocus';
```

Edit 2 of 6. Replace

```ts
    const first = nextItem(rec, st, 40, ['conjunction'], []);
    rec.attempts.push({ itemId: first.id, day: 39, correct: true, firstTry: true });
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).not.toBe(first.id);
```

with

```ts
    const first = nextItem(rec, st, 40, ['conjunction'], []);
    rec.attempts.push({ itemId: first.id, day: 39, correct: true, firstTry: true, tries: 1 });
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).not.toBe(first.id);
```

Edit 3 of 6. Replace

```ts
    const oldest = ids[2];
    ids.forEach((id) => rec.attempts.push({ itemId: id, day: id === oldest ? 38 : 39, correct: true, firstTry: true }));
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).toBe(oldest);
```

with

```ts
    const oldest = ids[2];
    ids.forEach((id) => rec.attempts.push({ itemId: id, day: id === oldest ? 38 : 39, correct: true, firstTry: true, tries: 1 }));
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).toBe(oldest);
```

Edit 4 of 6. Replace

```ts
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(0);
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(1);
    noteAttempt(rec, item, 40, false, false);
    expect(rec.bloom.CLO1).toBe(0);
  });
});
```

with

```ts
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    noteAttempt(rec, item, 40, true, 1);
    expect(rec.bloom.CLO1).toBe(0);
    noteAttempt(rec, item, 40, true, 1);
    expect(rec.bloom.CLO1).toBe(1);
    noteAttempt(rec, item, 40, false, 1);
    expect(rec.bloom.CLO1).toBe(0);
  });
  it('a right answer after a wrong one leaves the streak alone', () => {
    const rec = newRecord(student(seedState()));
    rec.bloom.CLO1 = 0;
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    noteAttempt(rec, item, 40, true, 1);
    noteAttempt(rec, item, 40, true, 2);
    expect(rec.streak.CLO1).toBe(1);
    expect(rec.bloom.CLO1).toBe(0);
  });
  it('writes one attempt per question, at the right try, and logs minutes for every try', () => {
    const rec = newRecord(student(seedState()));
    const item = BANK[0];
    noteAttempt(rec, item, 40, false, 1);
    noteAttempt(rec, item, 40, false, 2);
    expect(rec.attempts).toEqual([]);
    noteAttempt(rec, item, 40, true, 3);
    expect(rec.attempts).toEqual([{ itemId: item.id, day: 40, correct: true, firstTry: false, tries: 3 }]);
    expect(rec.days[40].done).toBe(4.5);
  });
  it('averages tries over the last 7 days, today included', () => {
    const rec = newRecord(student(seedState()));
    expect(averageTries(rec, 40)).toBeNull();
    expect(averageTries(undefined, 40)).toBeNull();
    const base = { itemId: BANK[0].id, correct: true, firstTry: false };
    rec.attempts.push({ ...base, day: 33, tries: 9 }, { ...base, day: 34, tries: 1 }, { ...base, day: 40, tries: 2 });
    expect(averageTries(rec, 40)).toBe(1.5);
  });
});
```

Edit 5 of 6. Replace

```ts
    rec.days[40] = { planned: 20, done: 0, check: null };
    for (let i = 0; i < 5; i++) noteAttempt(rec, item, 40, true, true, true);
    expect(rec.days[40].done).toBe(7.5);
```

with

```ts
    rec.days[40] = { planned: 20, done: 0, check: null };
    for (let i = 0; i < 5; i++) noteAttempt(rec, item, 40, true, 1, true);
    expect(rec.days[40].done).toBe(7.5);
```

Edit 6 of 6. Replace

```ts
    Object.assign(st.mastery, { expressions: 0.26, equivLaws: 0.2 });
    rec.attempts.push({ itemId: item('implication').id, day: 38, correct: true, firstTry: true });
    rec.attempts.push({ itemId: item('biconditional').id, day: 34, correct: true, firstTry: true });
    forget(st, rec, 42);
```

with

```ts
    Object.assign(st.mastery, { expressions: 0.26, equivLaws: 0.2 });
    rec.attempts.push({ itemId: item('implication').id, day: 38, correct: true, firstTry: true, tries: 1 });
    rec.attempts.push({ itemId: item('biconditional').id, day: 34, correct: true, firstTry: true, tries: 1 });
    forget(st, rec, 42);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/live/core.test.ts src/live/reducer.test.ts src/live/study/reducer.test.ts src/live/study/rules.test.ts`
Expected: FAIL: `gainFor` is `undefined is not a function`, and `averageTries is not a function`.

- [ ] **Step 3: Implement**

The `tryNumber` line in `phoneAnswer` is a bridge: Task 2 replaces it with the real try count from the answer sheet.

`src/live/mastery.ts`:

Edit 1 of 2. Replace

```ts
export const TARGET = 0.9;
export const GAIN_FIRST_TRY = 0.3;
export const GAIN_AFTER_HINT = 0.15;

```

with

```ts
export const TARGET = 0.9;
/** The share of the gap to TARGET a right answer closes, by try. Later tries earn nothing. */
const GAIN_BY_TRY = [0.3, 0.15, 0.05];

```

Edit 2 of 2. Replace

```ts

/** A correct answer moves the item's concept part of the way toward TARGET; a wrong one leaves it. */
export function afterAnswer(value: number, correct: boolean, hinted: boolean): number {
  if (!correct) return value;
  return Math.max(value, round2(value + (TARGET - value) * (hinted ? GAIN_AFTER_HINT : GAIN_FIRST_TRY)));
}
```

with

```ts

export const gainFor = (tryNumber: number): number => GAIN_BY_TRY[tryNumber - 1] ?? 0;

/** A correct answer moves the item's concept part of the way toward TARGET, by the try it came on; a wrong one leaves it. */
export function afterAnswer(value: number, correct: boolean, tryNumber: number): number {
  if (!correct) return value;
  return Math.max(value, round2(value + (TARGET - value) * gainFor(tryNumber)));
}
```

`src/live/reducer.ts`:

Edit 1 of 2. Replace

```ts
  const rec = s.study[student.id];
  if (rec) noteAttempt(rec, item, s.day, correct, correct && !s.phone.hinted, !s.phone.self);
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, s.phone.hinted);
  student.status = statusFor(student.mastery);
```

with

```ts
  const rec = s.study[student.id];
  const tryNumber = s.phone.hinted ? 2 : 1;
  if (rec) noteAttempt(rec, item, s.day, correct, tryNumber, !s.phone.self);
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, tryNumber);
  student.status = statusFor(student.mastery);
```

Edit 2 of 2. Replace

```ts
    for (const item of sessionItems(session.concept, false)) {
      student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], true, true);
      record(s, student, item, 'correct after a hint (skipped ahead)', { result: 'skipped', planId: plan.id });
```

with

```ts
    for (const item of sessionItems(session.concept, false)) {
      student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], true, 2);
      record(s, student, item, 'correct after a hint (skipped ahead)', { result: 'skipped', planId: plan.id });
```

`src/live/study/record.ts`:

Edit 1 of 3. Replace

```ts

/** Logs a graded answer and moves the Bloom level: two first-try answers up, a wrong answer down. Mutates `rec`. */
export function noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, firstTry: boolean, inSession = false): void {
  rec.attempts.push({ itemId: item.id, day, correct, firstTry });
  logMinutes(rec, day, MINUTES.question, inSession);
```

with

```ts

/** Logs one try before a question's first right answer and moves the Bloom level: two first-try answers up, a wrong answer down. The right try writes the question's one `Attempt`. Mutates `rec`. */
export function noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, tryNumber: number, inSession = false): void {
  logMinutes(rec, day, MINUTES.question, inSession);
```

Edit 2 of 3. Replace

```ts
    rec.streak[clo] = 0;
  } else if (firstTry) {
    rec.streak[clo] += 1;
```

with

```ts
    rec.streak[clo] = 0;
    return;
  }
  rec.attempts.push({ itemId: item.id, day, correct, firstTry: tryNumber === 1, tries: tryNumber });
  if (tryNumber === 1) {
    rec.streak[clo] += 1;
```

Edit 3 of 3. Replace

```ts

/** Adds the day's forecast point, replacing one already there for that day. Mutates `rec`. */
```

with

```ts

/** Mean tries per question answered in the last 7 days, today included, to one decimal; null with none. */
export function averageTries(rec: StudyRecord | undefined, today: number): number | null {
  const recent = rec?.attempts.filter((a) => a.day > today - 7) ?? [];
  if (recent.length === 0) return null;
  return Math.round((recent.reduce((a, b) => a + b.tries, 0) / recent.length) * 10) / 10;
}

/** Adds the day's forecast point, replacing one already there for that day. Mutates `rec`. */
```

`src/live/types.ts`:

Replace

```ts

export interface Attempt { itemId: string; day: number; correct: boolean; firstTry: boolean }

```

with

```ts

/** One question answered, written at its first right answer. `tries` is the try that was right; `firstTry` means `tries === 1`. */
export interface Attempt { itemId: string; day: number; correct: boolean; firstTry: boolean; tries: number }

```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; 619 tests pass (one more if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

- [ ] **Step 5: Commit**

```bash
git add src/live/core.test.ts src/live/mastery.ts src/live/reducer.test.ts src/live/reducer.ts src/live/study/record.ts src/live/study/reducer.test.ts src/live/study/rules.test.ts src/live/types.ts
git commit -m "feat(practice): credit falls by try, and each question writes one attempt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The answer sheet, free movement and Answer again

**Files:**
- Modify: `server/agents/tools.ts`
- Modify: `server/app.ts`
- Modify: `server/session.ts`
- Modify: `src/live/reducer.ts`
- Modify: `src/live/seed.ts`
- Modify: `src/live/study/reducer.ts`
- Modify: `src/live/types.ts`
- Modify: `src/student/screens/LivePractice.tsx`
- Test: `server/agents/tools.test.ts`, `server/app.test.ts`, `server/session.test.ts`, `src/live/reducer.test.ts`, `src/live/study/reducer.test.ts`

**Interfaces:**
- Consumes (Task 1): `afterAnswer(value, correct, tryNumber)`, `noteAttempt(rec, item, day, correct, tryNumber, inSession)`; existing `logMinutes`, `MINUTES`, `nextItem`, `SELF_SESSION`.
- Produces:
  - In `src/live/types.ts`: `interface QuestionSheet { itemId: string; tries: number[]; rightOn: number | null; reopened: boolean }`; `PhoneState.sheet: QuestionSheet[]`; `PhoneState.hinted`, `result` and `lastOption` are gone; `Evidence.tries?: number`.
  - In `src/live/reducer.ts`: `slotCount(s: DemoState): number`, `blankQuestion(itemId: string): QuestionSheet`, `phoneGoto(state: DemoState, item: number): Result`, `phoneAgain(state: DemoState): Result`. `phoneNext` now moves to the next slot and, on the last, still ends the session as before (Task 3 replaces that).
  - In `server/session.ts`: `phoneGoto(item: number): Done`, `phoneAgain(): Done`.
  - Routes: `POST /api/phone/goto { item }`, `POST /api/phone/again`.
  - Errors: `No practice open.`, `No such question.`, `Answer the item first.`, `Already answered.`, `Already tried that one.`

- [ ] **Step 1: Write the failing tests**

`server/agents/tools.test.ts`:

Edit 1 of 2. Replace

```ts
  });
  it('evidence for agents leaves out the phone-only result and planId', () => {
    const s = ok(phoneAnswer(ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0)), 0));
    const practice = readTool(s, 'get_evidence', { student_id: 's17', kind: 'practice' }) as Record<string, unknown>[];
```

with

```ts
  });
  it('evidence for agents leaves out the phone-only result, tries and planId', () => {
    const s = ok(phoneAnswer(ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0)), 1));
    const practice = readTool(s, 'get_evidence', { student_id: 's17', kind: 'practice' }) as Record<string, unknown>[];
```

Edit 2 of 2. Replace

```ts
      expect(e).not.toHaveProperty('result');
      expect(e).not.toHaveProperty('planId');
```

with

```ts
      expect(e).not.toHaveProperty('result');
      expect(e).not.toHaveProperty('tries');
      expect(e).not.toHaveProperty('planId');
```

`server/app.test.ts`:

Replace

```ts
    expect((await post('phone/answer', { option: 0 })).status).toBe(200);
    expect(session.state.phone.result).toBe('wrong');
  });
```

with

```ts
    expect((await post('phone/answer', { option: 0 })).status).toBe(200);
    expect(session.state.phone.sheet[0].tries).toEqual([0]);
    expect((await post('phone/goto', { item: 1 })).status).toBe(200);
    expect(session.state.phone.item).toBe(1);
    expect((await post('phone/goto', { item: 9 })).status).toBe(400);
    expect((await post('phone/again')).status).toBe(400);
  });
```

`server/session.test.ts`:

Replace

```ts
    expect(session.approve('nope')).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect(session.phoneNext()).toEqual({ ok: false, error: 'Answer the item first.' });
  });
```

with

```ts
    expect(session.approve('nope')).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect(session.phoneNext()).toEqual({ ok: false, error: 'No practice open.' });
  });
```

`src/live/reducer.test.ts`:

Edit 1 of 3. Replace

```ts
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result,
} from './reducer';
```

with

```ts
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAgain, phoneAnswer, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, slotCount, type Result,
} from './reducer';
```

Edit 2 of 3. Replace

```ts
    s = ok(phoneAnswer(s, 0));
    expect(s.phone).toMatchObject({ result: 'wrong', lastOption: 0, hinted: true });
    expect(ma(s).mastery.implication).toBe(0.31);
    expect(phoneNext(s).ok).toBe(false);
    s = ok(phoneAnswer(s, 1));
    expect(s.phone.result).toBe('right');
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 2));
```

with

```ts
    s = ok(phoneAnswer(s, 0));
    expect(s.phone.sheet[0]).toMatchObject({ tries: [0], rightOn: null });
    expect(ma(s).mastery.implication).toBe(0.31);
    s = ok(phoneAnswer(s, 1));
    expect(s.phone.sheet[0]).toMatchObject({ tries: [0, 1], rightOn: 2 });
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 2));
```

Edit 3 of 3. Replace

```ts
  });
  it('finishing a practice session returns to the plan; finishing the check reports it', () => {
```

with

```ts
  });
  it('opening a session fills the sheet with every question', () => {
    const s = ok(phoneOpen(sent(), 0));
    expect(s.phone.sheet.map((q) => q.itemId)).toEqual(['implication-1', 'implication-2']);
    expect(s.phone.sheet[0]).toEqual({ itemId: 'implication-1', tries: [], rightOn: null, reopened: false });
    expect(slotCount(s)).toBe(2);
  });
  it('the sheet survives going back and forth, in any order', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneAnswer(s, 0));
    s = ok(phoneNext(s));
    expect(s.phone.item).toBe(1);
    const second = currentItems(s)[1];
    s = ok(phoneAnswer(s, second.correct));
    s = ok(phoneGoto(s, 0));
    expect(s.phone.item).toBe(0);
    expect(s.phone.sheet[0].tries).toEqual([0]);
    expect(s.phone.sheet[1].rightOn).toBe(1);
  });
  it('goes only to slots of the open session', () => {
    expect(phoneGoto(sent(), 0)).toEqual({ ok: false, error: 'No practice open.' });
    const s = ok(phoneOpen(sent(), 0));
    expect(phoneGoto(s, 2)).toEqual({ ok: false, error: 'No such question.' });
    expect(phoneGoto(s, -1).ok).toBe(false);
    expect(phoneGoto(s, 0.5).ok).toBe(false);
  });
  it('a third try earns 5%, a fourth nothing, and the evidence says which try', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    const wrongs = item.options.map((_, i) => i).filter((i) => i !== item.correct);
    s = ok(phoneAnswer(ok(phoneAnswer(s, wrongs[0])), wrongs[1]));
    s = ok(phoneAnswer(s, item.correct));
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 3));
    expect(ma(s).evidence.at(-1)).toMatchObject({ result: 'correct', tries: 3, planId: 'p1' });
    expect(ma(s).evidence.at(-1)?.text).toContain('correct on try 3');
    let later = ok(phoneOpen(sent(), 0));
    for (const o of [wrongs[0], wrongs[1], wrongs[2]]) later = ok(phoneAnswer(later, o));
    later = ok(phoneAnswer(later, item.correct));
    expect(ma(later).mastery.implication).toBe(0.31);
    expect(later.phone.sheet[0].rightOn).toBe(4);
  });
  it('Answer again clears the options and earns no more credit, right or wrong', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    const wrong = item.correct === 0 ? 1 : 0;
    expect(phoneAgain(s)).toEqual({ ok: false, error: 'Answer the item first.' });
    s = ok(phoneAnswer(s, item.correct));
    const gained = ma(s).mastery.implication;
    expect(phoneAnswer(s, wrong)).toEqual({ ok: false, error: 'Already answered.' });
    s = ok(phoneAgain(s));
    expect(s.phone.sheet[0].reopened).toBe(true);
    s = ok(phoneAnswer(s, wrong));
    expect(s.phone.sheet[0]).toEqual({ itemId: item.id, tries: [item.correct, wrong], rightOn: 1, reopened: false });
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', planId: 'p1' });
    expect(ma(s).evidence.at(-1)?.result).toBeUndefined();
    expect(ma(s).evidence.at(-1)?.text).toContain('answered again');
    s = ok(phoneAnswer(ok(phoneAgain(s)), item.correct));
    expect(s.phone.sheet[0].rightOn).toBe(1);
    expect(ma(s).mastery.implication).toBe(gained);
  });
  it('choosing the same option after Answer again adds nothing', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    s = ok(phoneAgain(ok(phoneAnswer(s, item.correct))));
    const rows = ma(s).evidence.length;
    s = ok(phoneAnswer(s, item.correct));
    expect(s.phone.sheet[0]).toMatchObject({ tries: [item.correct], reopened: false });
    expect(ma(s).evidence).toHaveLength(rows);
  });
  it('finishing a practice session returns to the plan; finishing the check reports it', () => {
```

`src/live/study/reducer.test.ts`:

Edit 1 of 4. Replace

```ts
import { planFor, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, type Result } from '../reducer';
import { seedState } from '../seed';
```

with

```ts
import { planFor, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAgain, phoneAnswer, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, type Result } from '../reducer';
import { seedState } from '../seed';
```

Edit 2 of 4. Replace

```ts
  });
  it('opening Pick or the check-in clears a self session', () => {
```

with

```ts
  });
  it('a skipped slot picks one question and keeps it', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone.sheet).toHaveLength(1);
    s = ok(phoneNext(s));
    const picked = s.phone.sheet[1].itemId;
    expect(s.phone.self?.served).toEqual(s.phone.sheet.map((q) => q.itemId));
    s = ok(phoneNext(ok(phoneGoto(s, 0))));
    expect(s.phone.sheet[1].itemId).toBe(picked);
    expect(s.phone.sheet).toHaveLength(2);
  });
  it('a jump by dot picks the slots it passes, in order', () => {
    const s = ok(phoneGoto(ok(startSelf(ready(), 'CLO1')), 3));
    expect(s.phone.item).toBe(3);
    expect(s.phone.sheet).toHaveLength(4);
    expect(new Set(s.phone.self?.served).size).toBe(4);
    expect(phoneGoto(s, 5)).toEqual({ ok: false, error: 'No such question.' });
  });
  it('a repeat tap counts once and logs no minutes; a re-answer logs its minutes and moves no Bloom level', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    const item = currentItems(s)[0];
    const wrong = item.correct === 0 ? 1 : 0;
    const level = s.study.s17.bloom.CLO1;
    s = ok(phoneAnswer(s, wrong));
    expect(s.study.s17.days[40].done).toBe(1.5);
    expect(phoneAnswer(s, wrong).ok).toBe(false);
    s = ok(phoneAnswer(s, item.correct));
    expect(s.study.s17.days[40].done).toBe(3);
    expect(s.study.s17.attempts).toEqual([{ itemId: item.id, day: 40, correct: true, firstTry: false, tries: 2 }]);
    const after = s.study.s17.bloom.CLO1;
    expect(after).toBe(Math.max(0, level - 1));
    s = ok(phoneAnswer(ok(phoneAgain(s)), wrong));
    expect(s.study.s17.days[40].done).toBe(4.5);
    expect(s.study.s17.attempts).toHaveLength(1);
    expect(s.study.s17.bloom.CLO1).toBe(after);
  });
  it('opening Pick or the check-in clears a self session', () => {
```

Edit 3 of 4. Replace

```ts
    const sent = ok(approvePlan(s, 'p2'));
    expect(sent.phone).toMatchObject({ screen: 'lock', self: null });
    expect(sent.study.s17.attempts).toHaveLength(logged);
```

with

```ts
    const sent = ok(approvePlan(s, 'p2'));
    expect(sent.phone).toMatchObject({ screen: 'lock', self: null, sheet: [] });
    expect(sent.study.s17.attempts).toHaveLength(logged);
```

Edit 4 of 4. Replace

```ts
  it('advancing during a self session ends it', () => {
    const s = ok(advance(ok(startSelf(ready(), 'CLO1')), 1, null));
    expect(s.phone).toMatchObject({ self: null, session: null, screen: 'lock' });
  });
```

with

```ts
  it('advancing during a self session ends it', () => {
    const started = ok(startSelf(ready(), 'CLO1'));
    const answered = ok(phoneAnswer(started, currentItems(started)[0].correct));
    const s = ok(advance(answered, 1, null));
    expect(s.phone).toMatchObject({ self: null, session: null, screen: 'lock', sheet: [] });
    expect(s.study.s17.attempts).toHaveLength(1);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run server/agents/tools.test.ts server/app.test.ts server/session.test.ts src/live/reducer.test.ts src/live/study/reducer.test.ts`
Expected: FAIL: `phoneAgain is not a function` and `phoneGoto is not a function`.

- [ ] **Step 3: Implement**

`LivePractice` gets only the small change it needs to keep working; Task 4 rebuilds it.

`server/agents/tools.ts`:

Replace

```ts
      const s = studentOf(state, input.student_id);
      // The phone's result and planId stay out of what agents read.
      return s.evidence
        .filter((e) => !input.kind || e.kind === input.kind)
        .map(({ result: _result, planId: _planId, ...e }) => (e.day !== undefined && e.time ? { ...e, lecture: lectureLabel(e.day, e.time) } : e));
    }
```

with

```ts
      const s = studentOf(state, input.student_id);
      // The phone's result, tries and planId stay out of what agents read; the text says the same.
      return s.evidence
        .filter((e) => !input.kind || e.kind === input.kind)
        .map(({ result: _result, tries: _tries, planId: _planId, ...e }) => (e.day !== undefined && e.time ? { ...e, lecture: lectureLabel(e.day, e.time) } : e));
    }
```

`server/app.ts`:

Replace

```ts
  app.post('/api/phone/next', (c) => reply(c, session.phoneNext()));
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
```

with

```ts
  app.post('/api/phone/next', (c) => reply(c, session.phoneNext()));
  app.post('/api/phone/goto', async (c) => reply(c, session.phoneGoto(Number((await body(c)).item))));
  app.post('/api/phone/again', (c) => reply(c, session.phoneAgain()));
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
```

`server/session.ts`:

Replace

```ts
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }
```

with

```ts
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneGoto(item: number): Done { return this.run(R.phoneGoto(this.state, item)); }
  phoneAgain(): Done { return this.run(R.phoneAgain(this.state)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }
```

`src/live/reducer.ts`:

Edit 1 of 10. Replace

```ts
import { IDLE_PHONE } from './seed';
import { noteAttempt } from './study/record';
import { nextItem, SELF_SESSION } from './study/select';
import type { AssistantMsg, DemoState, Evidence, Plan, StudentProfile } from './types';

```

with

```ts
import { IDLE_PHONE } from './seed';
import { logMinutes, MINUTES, noteAttempt } from './study/record';
import { nextItem, SELF_SESSION } from './study/select';
import type { AssistantMsg, DemoState, Evidence, Plan, QuestionSheet, StudentProfile } from './types';

```

Edit 2 of 10. Replace

```ts
    ...IDLE_PHONE,
    done: [],
```

with

```ts
    ...IDLE_PHONE,
    sheet: [],
    done: [],
```

Edit 3 of 10. Replace

```ts

const clearItem = { hinted: false, result: null, lastOption: null } as const;

```

with

```ts

/** How many question slots the open session has. */
export const slotCount = (s: DemoState): number => (s.phone.self ? SELF_SESSION : currentItems(s).length);

export const blankQuestion = (itemId: string): QuestionSheet => ({ itemId, tries: [], rightOn: null, reopened: false });

```

Edit 4 of 10. Replace

```ts
  const s = structuredClone(state);
  s.phone = { ...s.phone, ...clearItem, self: null, screen: 'plan', session: null, item: 0 };
  return done(s);
```

with

```ts
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], self: null, screen: 'plan', session: null, item: 0 };
  return done(s);
```

Edit 5 of 10. Replace

```ts
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, ...clearItem, self: null, screen: 'practice', session: index, item: 0 };
  return done(s);
```

with

```ts
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, self: null, screen: 'practice', session: index, item: 0 };
  s.phone.sheet = currentItems(s).map((item) => blankQuestion(item.id));
  return done(s);
```

Edit 6 of 10. Replace

```ts

function record(s: DemoState, student: StudentProfile, item: BankItem, outcome: string, mark: Pick<Evidence, 'result' | 'planId'>) {
  const n = student.evidence.filter((e) => e.kind === 'practice').length + 1;
```

with

```ts

function record(s: DemoState, student: StudentProfile, item: BankItem, outcome: string, mark: Pick<Evidence, 'result' | 'tries' | 'planId'>) {
  const n = student.evidence.filter((e) => e.kind === 'practice').length + 1;
```

Edit 7 of 10. Replace

```ts
  const item = currentItems(s)[s.phone.item];
  if (!item) return fail('No item to answer.');
  if (s.phone.result === 'right') return fail('Already answered.');
  if (s.phone.result === 'wrong' && s.phone.lastOption === option) return fail('Already tried that one.');
  if (!Number.isInteger(option) || option < 0 || option >= item.options.length) return fail('No such option.');
  const student = studentById(s, s.phone.self ? s.phone.studentId! : planById(s, s.phone.planId)!.studentIds[0])!;
```

with

```ts
  const item = currentItems(s)[s.phone.item];
  const q = s.phone.sheet[s.phone.item];
  if (!item || !q) return fail('No item to answer.');
  if (q.rightOn !== null && !q.reopened) return fail('Already answered.');
  if (!q.reopened && q.tries.at(-1) === option) return fail('Already tried that one.');
  if (!Number.isInteger(option) || option < 0 || option >= item.options.length) return fail('No such option.');
  const reanswer = q.reopened;
  q.reopened = false;
  // Answer again, then the option just tapped: nothing new happened.
  if (reanswer && q.tries.at(-1) === option) return done(s);
  q.tries.push(option);
  const tryNumber = q.tries.length;
  const student = studentById(s, s.phone.self ? s.phone.studentId! : planById(s, s.phone.planId)!.studentIds[0])!;
```

Edit 8 of 10. Replace

```ts
  const rec = s.study[student.id];
  const tryNumber = s.phone.hinted ? 2 : 1;
  if (rec) noteAttempt(rec, item, s.day, correct, tryNumber, !s.phone.self);
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, tryNumber);
  student.status = statusFor(student.mastery);
  record(s, student, item, correct ? (s.phone.hinted ? 'correct after a hint' : 'correct first try') : `chose ${item.options[option]}`, { result: correct ? 'correct' : 'wrong', planId: s.phone.self ? undefined : s.phone.planId ?? undefined });
  s.phone = { ...s.phone, result: correct ? 'right' : 'wrong', lastOption: option, hinted: s.phone.hinted || !correct };
  return done(s);
```

with

```ts
  const rec = s.study[student.id];
  const planId = s.phone.self ? undefined : s.phone.planId ?? undefined;
  if (reanswer) {
    if (rec) logMinutes(rec, s.day, MINUTES.question, !s.phone.self);
    record(s, student, item, `answered again: ${item.options[option]}`, { planId });
    return done(s);
  }
  if (rec) noteAttempt(rec, item, s.day, correct, tryNumber, !s.phone.self);
  if (correct) q.rightOn = tryNumber;
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, tryNumber);
  student.status = statusFor(student.mastery);
  record(s, student, item, correct ? `correct on try ${tryNumber}` : `chose ${item.options[option]}`, { result: correct ? 'correct' : 'wrong', tries: correct ? tryNumber : undefined, planId });
  return done(s);
```

Edit 9 of 10. Replace

```ts

export function phoneNext(state: DemoState): Result {
  if (state.phone.result !== 'right') return fail('Answer the item first.');
  const s = structuredClone(state);
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
  const next = s.phone.item + 1;
  if (next < currentItems(s).length) {
    s.phone = { ...s.phone, ...clearItem, item: next };
    return done(s);
```

with

```ts

/** Opens a slot. In self practice an empty slot picks its question now and keeps it; slots fill in order, so a jump also picks the ones it passes. */
export function phoneGoto(state: DemoState, item: number): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  if (!Number.isInteger(item) || item < 0 || item >= slotCount(state)) return fail('No such question.');
  const s = structuredClone(state);
  const self = s.phone.self;
  if (self) {
    const student = studentById(s, s.phone.studentId!)!;
    while (self.served.length <= item) {
      const { id } = nextItem(s.study[student.id], student, s.day, self.concepts, self.served);
      self.served.push(id);
      s.phone.sheet.push(blankQuestion(id));
    }
  }
  s.phone.item = item;
  return done(s);
}

/** Answer again: clears the options of a question that already has a right answer. */
export function phoneAgain(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  const s = structuredClone(state);
  const q = s.phone.sheet[s.phone.item];
  if (!q || q.rightOn === null) return fail('Answer the item first.');
  q.reopened = true;
  return done(s);
}

export function phoneNext(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  if (state.phone.item + 1 < slotCount(state)) return phoneGoto(state, state.phone.item + 1);
  if ((state.phone.sheet[state.phone.item]?.rightOn ?? null) === null) return fail('Answer the item first.');
  const s = structuredClone(state);
  if (s.phone.self) {
    s.phone = { ...s.phone, sheet: [], self: null, item: 0, screen: 'today' };
    return done(s);
```

Edit 10 of 10. Replace

```ts
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, ...clearItem, done: [...s.phone.done, index], session: null, item: 0, screen: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
```

with

```ts
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, sheet: [], done: [...s.phone.done, index], session: null, item: 0, screen: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
```

`src/live/seed.ts`:

Edit 1 of 2. Replace

```ts
export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, hinted: false, result: null, lastOption: null,
  done: [], lastDone: null, updated: false, studentId: null, morning: false, self: null,
```

with

```ts
export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, sheet: [],
  done: [], lastDone: null, updated: false, studentId: null, morning: false, self: null,
```

Edit 2 of 2. Replace

```ts
    conversations: [],
    phone: { ...IDLE_PHONE, done: [] },
    study: {},
```

with

```ts
    conversations: [],
    phone: { ...IDLE_PHONE, sheet: [], done: [] },
    study: {},
```

`src/live/study/reducer.ts`:

Edit 1 of 4. Replace

```ts
import { statusFor } from '../mastery';
import { studentById } from '../reducer';
import { IDLE_PHONE } from '../seed';
```

with

```ts
import { statusFor } from '../mastery';
import { blankQuestion, studentById } from '../reducer';
import { IDLE_PHONE } from '../seed';
```

Edit 2 of 4. Replace

```ts
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, hinted: false, result: null, lastOption: null } as const;

```

with

```ts
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, sheet: [] };

```

Edit 3 of 4. Replace

```ts
  const plan = open.filter((p) => p.date <= s.day).at(-1) ?? open.at(-1) ?? null;
  s.phone = { ...IDLE_PHONE, done: plan && plan.id === s.phone.planId ? s.phone.done : [], planId: plan?.id ?? null, studentId: id, screen: rec.reported ? 'today' : 'setup' };
  return done(s);
```

with

```ts
  const plan = open.filter((p) => p.date <= s.day).at(-1) ?? open.at(-1) ?? null;
  s.phone = { ...IDLE_PHONE, sheet: [], done: plan && plan.id === s.phone.planId ? s.phone.done : [], planId: plan?.id ?? null, studentId: id, screen: rec.reported ? 'today' : 'setup' };
  return done(s);
```

Edit 4 of 4. Replace

```ts
  const first = nextItem(s.study[id], studentById(s, id)!, s.day, concepts, []);
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'practice', self: { clo, concepts, served: [first.id] } };
  return done(s);
```

with

```ts
  const first = nextItem(s.study[id], studentById(s, id)!, s.day, concepts, []);
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'practice', self: { clo, concepts, served: [first.id] }, sheet: [blankQuestion(first.id)] };
  return done(s);
```

`src/live/types.ts`:

Edit 1 of 3. Replace

```ts
  time?: string;
  /** Live practice only: how the answer went, and the teacher plan it belonged to (none for self-practice). Scripted screens never read these. Agents do not see these two (get_evidence strips them); they do see day and time. */
  result?: 'correct' | 'wrong' | 'skipped';
  planId?: string;
```

with

```ts
  time?: string;
  /** Live practice only: how the answer went, the try a right answer came on, and the teacher plan it belonged to (none for self-practice). A re-answer has no `result`. Scripted screens never read these. Agents do not see these three (get_evidence strips them); they do see day and time. */
  result?: 'correct' | 'wrong' | 'skipped';
  tries?: number;
  planId?: string;
```

Edit 2 of 3. Replace

```ts

/** A self-started practice session. */
```

with

```ts

/** One question slot of the session open on the phone. */
export interface QuestionSheet {
  itemId: string;
  /** Options tapped, in order. A repeat of the option just tapped is not added. */
  tries: number[];
  /** The try number of the first correct answer, or null until there is one. */
  rightOn: number | null;
  /** True after Answer again: the options are cleared until the next tap. */
  reopened: boolean;
}

/** A self-started practice session. */
```

Edit 3 of 3. Replace

```ts
  session: number | null;
  item: number;
  hinted: boolean;
  result: 'right' | 'wrong' | null;
  lastOption: number | null;
  done: number[];
```

with

```ts
  session: number | null;
  /** The slot on screen. */
  item: number;
  /** One entry per question slot opened so far; a teacher session fills all of them when it opens. */
  sheet: QuestionSheet[];
  done: number[];
```

`src/student/screens/LivePractice.tsx`:

Edit 1 of 3. Replace

```tsx
  if (!item || (!ph.self && !session)) return null;
  const right = ph.result === 'right';
  const guided = right ? item.guided : undefined;
```

with

```tsx
  if (!item || (!ph.self && !session)) return null;
  const q = ph.sheet[ph.item];
  const right = q !== undefined && q.rightOn !== null;
  const lastWrong = !right && q?.tries.length ? q.tries.at(-1)! : null;
  const guided = right ? item.guided : undefined;
```

Edit 2 of 3. Replace

```tsx
        {item.options.map((o, i) => {
          const look = right && i === item.correct ? 'right' : ph.result === 'wrong' && i === ph.lastOption ? 'wrong' : 'idle';
          return (
```

with

```tsx
        {item.options.map((o, i) => {
          const look = right && i === item.correct ? 'right' : i === lastWrong ? 'wrong' : 'idle';
          return (
```

Edit 3 of 3. Replace

```tsx
      </div>
      {ph.result === 'wrong' && ph.lastOption !== null && (
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{item.hints[ph.lastOption]}</div>
        </div>
```

with

```tsx
      </div>
      {lastWrong !== null && (
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{item.hints[lastWrong]}</div>
        </div>
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; 628 tests pass (one more if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

- [ ] **Step 5: Commit**

```bash
git add server/agents/tools.test.ts server/agents/tools.ts server/app.test.ts server/app.ts server/session.test.ts server/session.ts src/live/reducer.test.ts src/live/reducer.ts src/live/seed.ts src/live/study/reducer.test.ts src/live/study/reducer.ts src/live/types.ts src/student/screens/LivePractice.tsx
git commit -m "feat(practice): an answer sheet per session, with free movement and Answer again

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Finish, the review and Continue

**Files:**
- Create: `server/playSession.ts`
- Create: `src/student/screens/ReviewScreen.tsx`
- Modify: `server/app.ts`
- Modify: `server/evals/harness.ts`
- Modify: `server/live.smoke.ts`
- Modify: `server/session.ts`
- Modify: `src/live/fixtures.ts`
- Modify: `src/live/reducer.ts`
- Modify: `src/live/seed.ts`
- Modify: `src/live/study/reducer.ts`
- Modify: `src/live/types.ts`
- Modify: `src/student/LivePhone.tsx`
- Modify: `src/student/liveView.ts`
- Test: `server/app.test.ts`, `server/session.study.test.ts`, `server/session.test.ts`, `src/live/reducer.test.ts`, `src/live/study/reducer.test.ts`, `src/student/liveAudit.test.tsx`, `src/student/liveView.test.ts`

**Interfaces:**
- Consumes (Task 2): `slotCount`, `phoneGoto`, `phoneAnswer`, `phoneNext`, `QuestionSheet`; existing `deliver`, `currentItems`, `itemById`.
- Produces:
  - In `src/live/types.ts`: `PhoneScreen` gains `'review'`; `PhoneState.reviewNext: 'today' | 'plan' | 'progress' | null`.
  - In `src/live/reducer.ts`: `phoneFinish(state: DemoState): Result` (`finishedCheck` is set after a mastery check), `phoneContinue(state: DemoState): Result`, and `phoneNext(state: DemoState): Result`, now just `phoneGoto(state, state.phone.item + 1)`.
  - In `src/live/fixtures.ts`: `playOut(state: DemoState, wrongFirst = false): Result`, leaving the session on the review.
  - In `server/session.ts`: `phoneNext(): Done`, `phoneContinue(): Done`, `phoneFinish(): { ok: true; done: Promise<void> } | { ok: false; error: string }`.
  - `server/playSession.ts`: `playOpenSession(session: DemoSession, wrongFirst = false): Promise<void>`, shared by tests, evals and the smoke run.
  - Routes: `POST /api/phone/finish`, `POST /api/phone/continue`.
  - In `src/student/liveView.ts`: `reviewView(state: DemoState): ReviewView`, `interface ReviewRow { prompt; tries: { option: string; right: boolean }[]; answer: string; hints: { option: string; hint: string }[]; guided: BankItem['guided'] | null }`, `interface ReviewView { summary: string; rows: ReviewRow[] }`.
  - `src/student/screens/ReviewScreen.tsx`: `ReviewScreen({ view, onContinue })`. DOM hook: `[data-review-row="<i>"]`.

- [ ] **Step 1: Write the failing tests**

`server/app.test.ts`:

Replace

```ts
    expect((await post('phone/again')).status).toBe(400);
  });
```

with

```ts
    expect((await post('phone/again')).status).toBe(400);
    expect((await post('phone/continue')).status).toBe(400);
    expect((await post('phone/finish')).status).toBe(200);
    expect(session.state.phone.item).toBe(0);
  });
```

`server/session.study.test.ts`:

Edit 1 of 3. Replace

```ts
import { describe, expect, it, vi } from 'vitest';
import { currentItems } from '../src/live/reducer';
import type { DemoState } from '../src/live/types';
```

with

```ts
import { describe, expect, it, vi } from 'vitest';
import type { DemoState } from '../src/live/types';
```

Edit 2 of 3. Replace

```ts
import { studyInput } from './agents/samples';
import { DemoSession } from './session';
```

with

```ts
import { studyInput } from './agents/samples';
import { playOpenSession } from './playSession';
import { DemoSession } from './session';
```

Edit 3 of 3. Replace

```ts
  session.studyPractice(null);
  while (session.state.phone.self) {
    session.phoneAnswer(currentItems(session.state)[session.state.phone.item].correct);
    const next = session.phoneNext();
    if (!next.ok) throw new Error(next.error);
    await next.done;
  }
};
```

with

```ts
  session.studyPractice(null);
  await playOpenSession(session);
};
```

`server/session.test.ts`:

Edit 1 of 4. Replace

```ts
import { planInput, reportInput } from './agents/samples';
import { DemoSession } from './session';
```

with

```ts
import { planInput, reportInput } from './agents/samples';
import { playOpenSession } from './playSession';
import { DemoSession } from './session';
```

Edit 2 of 4. Replace

```ts
  const plan = session.state.plans[0];
  for (const [i, s] of plan.sessions.entries()) {
    if (session.state.phone.done.includes(i)) continue;
    expect(session.phoneOpen(i)).toEqual({ ok: true });
    for (const item of sessionItems(s.concept!, s.isMasteryCheck)) {
      expect(session.phoneAnswer(item.correct)).toEqual({ ok: true });
      const next = session.phoneNext();
      if (!next.ok) throw new Error(next.error);
      await next.done;
    }
  }
```

with

```ts
  const plan = session.state.plans[0];
  for (const i of plan.sessions.keys()) {
    if (session.state.phone.done.includes(i)) continue;
    expect(session.phoneOpen(i)).toEqual({ ok: true });
    await playOpenSession(session);
  }
```

Edit 3 of 4. Replace

```ts
    expect(session.phoneOpen(3)).toEqual({ ok: true });
    for (const item of sessionItems('equivalence', true)) {
      expect(session.phoneAnswer(item.correct)).toEqual({ ok: true });
      const next = session.phoneNext();
      if (!next.ok) throw new Error(next.error);
      await next.done;
    }
    const s = session.state;
```

with

```ts
    expect(session.phoneOpen(3)).toEqual({ ok: true });
    await playOpenSession(session);
    const s = session.state;
```

Edit 4 of 4. Replace

```ts
  });
  it('a perfect offline run reaches the target, with or without Skip', async () => {
```

with

```ts
  });
  it('Finish starts the adapt run, and its follow-up lands while the review is open', async () => {
    const session = new DemoSession(null);
    await asked(session);
    session.approve('p1');
    session.phonePlan();
    session.phoneSkip();
    session.phoneOpen(3);
    for (const [i, item] of sessionItems('equivalence', true).entries()) {
      session.phoneAnswer(item.correct);
      if (i < 2) session.phoneNext();
    }
    const finished = session.phoneFinish();
    if (!finished.ok) throw new Error(finished.error);
    expect(session.state.phone.screen).toBe('review');
    await finished.done;
    expect(session.state.phone).toMatchObject({ screen: 'review', planId: 'p2', updated: true });
    expect(session.state.phone.sheet).toHaveLength(3);
    expect(session.phoneContinue()).toEqual({ ok: true });
    expect(session.state.phone).toMatchObject({ screen: 'progress', planId: 'p2', sheet: [] });
  });
  it('a perfect offline run reaches the target, with or without Skip', async () => {
```

`src/live/reducer.test.ts`:

Edit 1 of 3. Replace

```ts
import { describe, expect, it } from 'vitest';
import { sessionItems } from '../scenario/practiceBank';
import { planFor, stateWithPlan } from './fixtures';
import { afterAnswer } from './mastery';
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAgain, phoneAnswer, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, slotCount, type Result,
} from './reducer';
```

with

```ts
import { describe, expect, it } from 'vitest';
import { planFor, playOut, stateWithPlan } from './fixtures';
import { afterAnswer } from './mastery';
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAgain, phoneAnswer, phoneContinue, phoneFinish, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, slotCount, type Result,
} from './reducer';
```

Edit 2 of 3. Replace

```ts
  });
  it('finishing a practice session returns to the plan; finishing the check reports it', () => {
    let s = ok(phoneOpen(sent(), 0));
    for (const item of sessionItems('implication', false)) {
      s = ok(phoneAnswer(s, item.correct));
      s = ok(phoneNext(s));
    }
    expect(s.phone).toMatchObject({ screen: 'plan', done: [0], session: null });
    s = ok(phoneOpen(s, 1));
    expect(s.clock).toBe(20 * 60);
    const check = sessionItems('equivalence', true);
    let last: Result = { ok: true, state: s };
    for (const item of check) {
      s = ok(phoneAnswer(s, item.correct));
      last = phoneNext(s);
      s = ok(last);
    }
    expect(last.ok && last.finishedCheck).toBe(true);
    expect(s.phone).toMatchObject({ screen: 'progress', done: [0, 1], lastDone: 'p1' });
    expect(s.clock).toBe(20 * 60 + 40);
```

with

```ts
  });
  it('Finish with open questions moves to the first of them and keeps the sheet', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneNext(s));
    s = ok(phoneAnswer(s, currentItems(s)[1].correct));
    s = ok(phoneFinish(s));
    expect(s.phone).toMatchObject({ screen: 'practice', item: 0, session: 0 });
    expect(s.phone.sheet[1].rightOn).toBe(1);
    expect(s.phone.done).toEqual([]);
  });
  it('Finish fails only outside a session; Next stops at the last question', () => {
    expect(phoneFinish(sent())).toEqual({ ok: false, error: 'No practice open.' });
    const s = ok(phoneNext(ok(phoneOpen(sent(), 0))));
    expect(phoneNext(s)).toEqual({ ok: false, error: 'No such question.' });
  });
  it('finishing a practice session opens the review, then the plan; finishing the check reports it', () => {
    let s = ok(playOut(ok(phoneOpen(sent(), 0))));
    expect(s.phone).toMatchObject({ screen: 'review', done: [0], session: null, reviewNext: 'plan' });
    expect(s.phone.sheet).toHaveLength(2);
    s = ok(phoneContinue(s));
    expect(s.phone).toMatchObject({ screen: 'plan', done: [0], session: null, sheet: [], reviewNext: null });
    s = ok(phoneOpen(s, 1));
    expect(s.clock).toBe(20 * 60);
    const last = playOut(s);
    s = ok(last);
    expect(last.ok && last.finishedCheck).toBe(true);
    expect(s.phone).toMatchObject({ screen: 'review', done: [0, 1], lastDone: 'p1', reviewNext: 'progress' });
    expect(s.clock).toBe(20 * 60 + 40);
```

Edit 3 of 3. Replace

```ts
    expect(phoneOpen(s, 0).ok).toBe(false);
  });
```

with

```ts
    expect(phoneOpen(s, 0).ok).toBe(false);
    expect(ok(phoneContinue(s)).phone.screen).toBe('progress');
    expect(phoneContinue(sent())).toEqual({ ok: false, error: 'No review open.' });
  });
  it('a follow-up landing on the review keeps it, and Continue still goes to progress', () => {
    const s = ok(playOut(ok(phoneOpen(sent(), 1))));
    s.plans.push(planFor('pathway', { id: 'p2', status: 'autoApproved' }));
    deliver(s, s.plans[1], true);
    expect(s.phone).toMatchObject({ screen: 'review', planId: 'p2', updated: true, reviewNext: 'progress', lastDone: 'p1' });
    expect(s.phone.sheet).toHaveLength(3);
    expect(ok(phoneContinue(s)).phone).toMatchObject({ screen: 'progress', planId: 'p2', sheet: [] });
  });
```

`src/live/study/reducer.test.ts`:

Edit 1 of 3. Replace

```ts
import { BANK } from '../../scenario/practiceBank';
import { planFor, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAgain, phoneAnswer, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, type Result } from '../reducer';
import { seedState } from '../seed';
```

with

```ts
import { BANK } from '../../scenario/practiceBank';
import { planFor, playOut, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAgain, phoneAnswer, phoneContinue, phoneFinish, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, type Result } from '../reducer';
import { seedState } from '../seed';
```

Edit 2 of 3. Replace

```ts
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
```

with

```ts
describe('self practice', () => {
  it('serves 5 adaptive questions, opens the review and returns to Today', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone).toMatchObject({ screen: 'practice', session: null, item: 0 });
    s = ok(playOut(s));
    expect(s.phone).toMatchObject({ screen: 'review', self: null, reviewNext: 'today' });
    expect(s.phone.sheet).toHaveLength(5);
    s = ok(phoneContinue(s));
    expect(s.phone).toMatchObject({ screen: 'today', self: null, sheet: [] });
    expect(new Set(s.study.s17.attempts.map((a) => a.itemId)).size).toBe(5);
```

Edit 3 of 3. Replace

```ts
  });
  it('a skipped slot picks one question and keeps it', () => {
```

with

```ts
  });
  it('Finish before every slot is opened goes to the first open slot', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    s = ok(phoneAnswer(s, currentItems(s)[0].correct));
    s = ok(phoneFinish(s));
    expect(s.phone).toMatchObject({ screen: 'practice', item: 1 });
    expect(s.phone.sheet).toHaveLength(2);
  });
  it('a skipped slot picks one question and keeps it', () => {
```

`src/student/liveAudit.test.tsx`:

Edit 1 of 3. Replace

```tsx
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { LivePhoneView } from './LivePhone';
```

with

```tsx
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { playOut, stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAnswer, phoneContinue, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { LivePhoneView } from './LivePhone';
```

Edit 2 of 3. Replace

```tsx
const practice = () => ok(phoneOpen(sent(), 0));
const progress = () => {
  let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
  for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
  return s;
};
const study = (screen: DemoState['phone']['screen'], over: Partial<DemoState['phone']> = {}) => () => {
```

with

```tsx
const practice = () => ok(phoneOpen(sent(), 0));
const checked = () => ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1))));
const progress = () => ok(phoneContinue(checked()));
const study = (screen: DemoState['phone']['screen'], over: Partial<DemoState['phone']> = {}) => () => {
```

Edit 3 of 3. Replace

```tsx
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['progress', progress],
```

with

```tsx
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['review', () => ok(playOut(practice(), true))],
  ['review of a mastery check', checked],
  ['progress', progress],
```

`src/student/liveView.test.ts`:

Edit 1 of 5. Replace

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { notificationCopy, planView, progressView } from './liveView';

```

with

```ts
import { describe, expect, it } from 'vitest';
import { playOut, stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneContinue, phoneFinish, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { notificationCopy, planView, progressView, reviewView } from './liveView';

```

Edit 2 of 5. Replace

```ts
  it('progress view after the mastery check', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
    for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
    const p = progressView(s)!;
```

with

```ts
  it('progress view after the mastery check', () => {
    const s = ok(phoneContinue(ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1))))));
    const p = progressView(s)!;
```

Edit 3 of 5. Replace

```ts
    s = ok(phoneNext(ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct))));
    for (const item of rest) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
    // Four answers, three of them correct: the skipped rows do not count.
```

with

```ts
    s = ok(phoneNext(ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct))));
    s = ok(phoneNext(ok(phoneAnswer(s, rest[0].correct))));
    s = ok(phoneAnswer(s, rest[1].correct));
    // Four answers, three of them correct: the skipped rows do not count.
```

Edit 4 of 5. Replace

```ts
    );
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(base)))), 1));
    for (const item of sessionItems('deMorgan', true)) {
      const wrong = item.correct === 0 ? 1 : 0;
      s = ok(phoneNext(ok(phoneAnswer(ok(phoneAnswer(s, wrong)), item.correct))));
    }
    // Three wrong, three right, in this plan's session: half. The self-practice row and the skipped rows do not count.
```

with

```ts
    );
    const s = ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(base)))), 1)), true));
    // Three wrong, three right, in this plan's session: half. The self-practice row and the skipped rows do not count.
```

Edit 5 of 5. Replace

```ts
  });
  it('offers Skip to tonight only on a plan for today', () => {
```

with

```ts
  });
  it('the review lists each question with its tries in order, the answer and the hint for each wrong choice', () => {
    let s = ok(phoneOpen(sent(), 0));
    const [first, second] = sessionItems('implication', false);
    const wrong = first.correct === 0 ? 1 : 0;
    s = ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct));
    s = ok(phoneAnswer(ok(phoneNext(s)), second.correct));
    const v = reviewView(ok(phoneFinish(s)));
    expect(v.summary).toBe('2 questions · 1 right first try · 3 tries in all');
    expect(v.rows[0]).toMatchObject({
      prompt: first.prompt,
      tries: [{ option: first.options[wrong], right: false }, { option: first.options[first.correct], right: true }],
      answer: first.options[first.correct],
      hints: [{ option: first.options[wrong], hint: first.hints[wrong] }],
      guided: first.guided,
    });
    expect(v.rows[1].hints).toEqual([]);
  });
  it('the summary reads naturally for one question and one try', () => {
    const s = sent();
    s.phone.sheet = [{ itemId: 'implication-1', tries: [1], rightOn: 1, reopened: false }];
    expect(reviewView(s).summary).toBe('1 question · 1 right first try · 1 try in all');
  });
  it('offers Skip to tonight only on a plan for today', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run server/app.test.ts server/session.study.test.ts server/session.test.ts src/live/reducer.test.ts src/live/study/reducer.test.ts src/student/liveAudit.test.tsx src/student/liveView.test.ts`
Expected: FAIL: `playOut is not a function`, `phoneFinish is not a function`, `reviewView is not a function`, and `Failed to load url ./playSession`.

- [ ] **Step 3: Implement**

Until Task 4, `LivePhone` sends `phone/finish` from the existing Next button on the last question.

`server/app.ts`:

Replace

```ts
  app.post('/api/phone/again', (c) => reply(c, session.phoneAgain()));
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
```

with

```ts
  app.post('/api/phone/again', (c) => reply(c, session.phoneAgain()));
  app.post('/api/phone/finish', (c) => reply(c, session.phoneFinish()));
  app.post('/api/phone/continue', (c) => reply(c, session.phoneContinue()));
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
```

`server/evals/harness.ts`:

Edit 1 of 4. Replace

```ts
import { classKpis } from '../../src/live/mastery';
import { currentItems, planById, studentById } from '../../src/live/reducer';
import { fmt } from '../../src/live/clock';
```

with

```ts
import { classKpis } from '../../src/live/mastery';
import { planById, studentById } from '../../src/live/reducer';
import { fmt } from '../../src/live/clock';
```

Edit 2 of 4. Replace

```ts
import type { ConceptId } from '../../src/scenario/knowledgeGraph';
import { DemoSession } from '../session';
```

with

```ts
import type { ConceptId } from '../../src/scenario/knowledgeGraph';
import { playOpenSession } from '../playSession';
import { DemoSession } from '../session';
```

Edit 3 of 4. Replace

```ts
  if (!opened.ok) throw new Error(`phoneOpen: ${opened.error}`);
  while (t.state.phone.session === index) {
    const item = currentItems(t.state)[t.state.phone.item];
    if (mode === 'wrong-first') {
      const wrong = item.options.findIndex((_, i) => i !== item.correct);
      t.session.phoneAnswer(wrong);
    }
    const right = t.session.phoneAnswer(item.correct);
    if (!right.ok) throw new Error(`phoneAnswer: ${right.error}`);
    const next = t.session.phoneNext();
    if (!next.ok) throw new Error(`phoneNext: ${next.error}`);
    await next.done;
  }
}
```

with

```ts
  if (!opened.ok) throw new Error(`phoneOpen: ${opened.error}`);
  await playOpenSession(t.session, mode === 'wrong-first');
}
```

Edit 4 of 4. Replace

```ts
  if (!started.ok) throw new Error(`studyPractice: ${started.error}`);
  while (t.state.phone.self) {
    t.session.phoneAnswer(currentItems(t.state)[t.state.phone.item].correct);
    const next = t.session.phoneNext();
    if (!next.ok) throw new Error(`phoneNext: ${next.error}`);
    await next.done;
  }
}
```

with

```ts
  if (!started.ok) throw new Error(`studyPractice: ${started.error}`);
  await playOpenSession(t.session);
}
```

`server/live.smoke.ts`:

Edit 1 of 2. Replace

```ts
import { planProblems } from '../src/live/plans';
import { sessionItems } from '../src/scenario/practiceBank';
import { anthropicClient } from './agents/client';
import { citableIds } from './agents/sas';
import { DemoSession } from './session';
```

with

```ts
import { planProblems } from '../src/live/plans';
import { anthropicClient } from './agents/client';
import { citableIds } from './agents/sas';
import { playOpenSession } from './playSession';
import { DemoSession } from './session';
```

Edit 2 of 2. Replace

```ts
must(session.phoneOpen(check));
for (const item of sessionItems(concept, true)) {
  must(session.phoneAnswer(item.correct));
  const next = session.phoneNext();
  if (!next.ok) fail(next.error);
  await next.done;
}

```

with

```ts
must(session.phoneOpen(check));
await playOpenSession(session);

```

Create `server/playSession.ts`:

```ts
import { currentItems, slotCount } from '../src/live/reducer';
import type { DemoSession } from './session';

const must = (r: { ok: true } | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
};

/** Plays the session open on the phone through its review, tapping like a visitor: every answer right, a wrong tap first when asked. Used by tests, evals and the smoke run. */
export async function playOpenSession(session: DemoSession, wrongFirst = false): Promise<void> {
  for (;;) {
    const { item: slot } = session.state.phone;
    const item = currentItems(session.state)[slot];
    if (wrongFirst) must(session.phoneAnswer(item.correct === 0 ? 1 : 0));
    must(session.phoneAnswer(item.correct));
    if (slot + 1 >= slotCount(session.state)) break;
    must(session.phoneNext());
  }
  const finished = session.phoneFinish();
  if (!finished.ok) throw new Error(finished.error);
  await finished.done;
  must(session.phoneContinue());
}
```

`server/session.ts`:

Replace

```ts
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneGoto(item: number): Done { return this.run(R.phoneGoto(this.state, item)); }
  phoneAgain(): Done { return this.run(R.phoneAgain(this.state)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }

  /** Moves on after a correct answer; finishing a mastery check starts the adapt run. */
  phoneNext(): { ok: true; done: Promise<void> } | { ok: false; error: string } {
    const r = R.phoneNext(this.state);
    if (!r.ok) return { ok: false, error: r.error };
```

with

```ts
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneNext(): Done { return this.run(R.phoneNext(this.state)); }
  phoneGoto(item: number): Done { return this.run(R.phoneGoto(this.state, item)); }
  phoneAgain(): Done { return this.run(R.phoneAgain(this.state)); }
  phoneContinue(): Done { return this.run(R.phoneContinue(this.state)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }

  /** Finish: finishing a mastery check starts the adapt run, which lands while the review is open. */
  phoneFinish(): { ok: true; done: Promise<void> } | { ok: false; error: string } {
    const r = R.phoneFinish(this.state);
    if (!r.ok) return { ok: false, error: r.error };
```

`src/live/fixtures.ts`:

Edit 1 of 2. Replace

```ts
import { resolveDay, START_DAY } from '../scenario/course';
import { seedState } from './seed';
import type { DemoState, LivePanel, Plan, PlanKind } from './types';
```

with

```ts
import { resolveDay, START_DAY } from '../scenario/course';
import { currentItems, phoneAnswer, phoneFinish, phoneNext, slotCount, type Result } from './reducer';
import { seedState } from './seed';
import type { DemoState, LivePanel, Plan, PlanKind } from './types';
```

Edit 2 of 2. Replace

```ts
  state, activeId, post: async () => ({ ok: true }), openConversation: () => {}, showPanel: () => {}, openProfile: () => {}, openPlanning: () => {}, toast: () => {},
});
```

with

```ts
  state, activeId, post: async () => ({ ok: true }), openConversation: () => {}, showPanel: () => {}, openProfile: () => {}, openPlanning: () => {}, toast: () => {},
});

const must = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** Answers the open session right (a wrong tap first when asked), then taps Finish. The result is on the review. */
export function playOut(state: DemoState, wrongFirst = false): Result {
  let s = state;
  for (;;) {
    const item = currentItems(s)[s.phone.item];
    if (wrongFirst) s = must(phoneAnswer(s, item.correct === 0 ? 1 : 0));
    s = must(phoneAnswer(s, item.correct));
    if (s.phone.item + 1 >= slotCount(s)) return phoneFinish(s);
    s = must(phoneNext(s));
  }
}
```

`src/live/reducer.ts`:

Edit 1 of 7. Replace

```ts
 * Puts `plan` on the phone and records its baseline. A fresh delivery shows the lock-screen notification;
 * a follow-up keeps the current screen and the finished plan, so the progress screen still shows that result.
 */
```

with

```ts
 * Puts `plan` on the phone and records its baseline. A fresh delivery shows the lock-screen notification;
 * a follow-up keeps the current screen and the finished plan, so the review and the progress screen still show that result.
 */
```

Edit 2 of 7. Replace

```ts
  }
  s.phone = {
    ...IDLE_PHONE,
    sheet: [],
    done: [],
```

with

```ts
  }
  const reviewing = updated && s.phone.screen === 'review';
  s.phone = {
    ...IDLE_PHONE,
    sheet: reviewing ? s.phone.sheet : [],
    reviewNext: reviewing ? s.phone.reviewNext : null,
    done: [],
```

Edit 3 of 7. Replace

```ts
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], self: null, screen: 'plan', session: null, item: 0 };
  return done(s);
```

with

```ts
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], reviewNext: null, self: null, screen: 'plan', session: null, item: 0 };
  return done(s);
```

Edit 4 of 7. Replace

```ts
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, self: null, screen: 'practice', session: index, item: 0 };
  s.phone.sheet = currentItems(s).map((item) => blankQuestion(item.id));
```

with

```ts
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, reviewNext: null, self: null, screen: 'practice', session: index, item: 0 };
  s.phone.sheet = currentItems(s).map((item) => blankQuestion(item.id));
```

Edit 5 of 7. Replace

```ts

export function phoneNext(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  if (state.phone.item + 1 < slotCount(state)) return phoneGoto(state, state.phone.item + 1);
  if ((state.phone.sheet[state.phone.item]?.rightOn ?? null) === null) return fail('Answer the item first.');
  const s = structuredClone(state);
  if (s.phone.self) {
    s.phone = { ...s.phone, sheet: [], self: null, item: 0, screen: 'today' };
    return done(s);
```

with

```ts

export const phoneNext = (state: DemoState): Result => phoneGoto(state, state.phone.item + 1);

/** The first slot with no right answer yet, or null when every slot has one. */
function firstOpen(s: DemoState): number | null {
  for (let i = 0; i < slotCount(s); i++) if ((s.phone.sheet[i]?.rightOn ?? null) === null) return i;
  return null;
}

/** With open questions, moves to the first of them. Otherwise opens the review and completes the session: marks it done and, after a mastery check, closes the plan. */
export function phoneFinish(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  const open = firstOpen(state);
  if (open !== null) return phoneGoto(state, open);
  const s = structuredClone(state);
  if (s.phone.self) {
    s.phone = { ...s.phone, self: null, item: 0, screen: 'review', reviewNext: 'today' };
    return done(s);
```

Edit 6 of 7. Replace

```ts
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, sheet: [], done: [...s.phone.done, index], session: null, item: 0, screen: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
```

with

```ts
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, done: [...s.phone.done, index], session: null, item: 0, screen: 'review', reviewNext: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
```

Edit 7 of 7. Replace

```ts

/** "Skip to tonight": earlier sessions count as done, each item correct after a hint. */
```

with

```ts

/** Leaves the review for Today, the plan or the progress screen. */
export function phoneContinue(state: DemoState): Result {
  if (state.phone.screen !== 'review') return fail('No review open.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], reviewNext: null, screen: s.phone.reviewNext ?? 'today' };
  return done(s);
}

/** "Skip to tonight": earlier sessions count as done, each item correct after a hint. */
```

`src/live/seed.ts`:

Replace

```ts
export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, sheet: [],
  done: [], lastDone: null, updated: false, studentId: null, morning: false, self: null,
```

with

```ts
export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, sheet: [], reviewNext: null,
  done: [], lastDone: null, updated: false, studentId: null, morning: false, self: null,
```

`src/live/study/reducer.ts`:

Replace

```ts
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, sheet: [] };

```

with

```ts
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, sheet: [], reviewNext: null };

```

`src/live/types.ts`:

Edit 1 of 2. Replace

```ts

export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'progress' | 'pick' | 'setup' | 'today' | 'choosePractice' | 'cards' | 'semester' | 'checkIn';

```

with

```ts

export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'review' | 'progress' | 'pick' | 'setup' | 'today' | 'choosePractice' | 'cards' | 'semester' | 'checkIn';

```

Edit 2 of 2. Replace

```ts
  sheet: QuestionSheet[];
  done: number[];
```

with

```ts
  sheet: QuestionSheet[];
  /** Where Continue goes from the review. Set when a session finishes, because a follow-up can replace the plan while the review is open. */
  reviewNext: 'today' | 'plan' | 'progress' | null;
  done: number[];
```

`src/student/LivePhone.tsx`:

Edit 1 of 4. Replace

```tsx
import { fmt } from '../live/clock';
import { useServerSource, type DemoSource } from '../live/source';
```

with

```tsx
import { fmt } from '../live/clock';
import { slotCount } from '../live/reducer';
import { useServerSource, type DemoSource } from '../live/source';
```

Edit 2 of 4. Replace

```tsx
import type { TodayRow } from '../live/study/today';
import { notificationCopy, planView, progressView } from './liveView';
import { StatusBar } from './screens/Chrome';
```

with

```tsx
import type { TodayRow } from '../live/study/today';
import { notificationCopy, planView, progressView, reviewView } from './liveView';
import { StatusBar } from './screens/Chrome';
```

Edit 3 of 4. Replace

```tsx
import { ProgressScreen } from './screens/ProgressScreen';
import { CardsScreen, CheckInScreen, PickScreen, PractiseScreen, SemesterScreen, SetupScreen, TabBar, TodayScreen } from './screens/StudyScreens';
```

with

```tsx
import { ProgressScreen } from './screens/ProgressScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { CardsScreen, CheckInScreen, PickScreen, PractiseScreen, SemesterScreen, SetupScreen, TabBar, TodayScreen } from './screens/StudyScreens';
```

Edit 4 of 4. Replace

```tsx
      {ph.screen === 'practice' && (
        <LivePractice key={`${ph.session}:${ph.item}`} state={state} onAnswer={(o) => send('phone/answer', { option: o })} onNext={() => send('phone/next')} />
      )}
      {ph.screen === 'progress' && progress && <ProgressScreen local={local} live={progress} onBack={() => send('phone/plan')} />}
```

with

```tsx
      {ph.screen === 'practice' && (
        <LivePractice key={`${ph.session}:${ph.item}`} state={state} onAnswer={(o) => send('phone/answer', { option: o })} onNext={() => send(ph.item + 1 >= slotCount(state) ? 'phone/finish' : 'phone/next')} />
      )}
      {ph.screen === 'review' && <ReviewScreen view={reviewView(state)} onContinue={() => send('phone/continue')} />}
      {ph.screen === 'progress' && progress && <ProgressScreen local={local} live={progress} onBack={() => send('phone/plan')} />}
```

`src/student/liveView.ts`:

Edit 1 of 3. Replace

```ts
import type { DemoState, Plan } from '../live/types';
import { relativeDay } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';

export interface PlanView {
  name: string;
```

with

```ts
import type { DemoState, Plan } from '../live/types';
import { relativeDay } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
import { itemById, type BankItem } from '../scenario/practiceBank';

export interface PlanView {
  name: string;
```

Edit 2 of 3. Replace

```ts
  backLabel: string;
}

const conceptsOf = (plan: Plan): ConceptId[] => [...new Set(plan.sessions.flatMap((s) => (s.concept ? [s.concept] : [])))];
const targetOf = (plan: Plan): ConceptId => plan.sessions.find((s) => s.isMasteryCheck)?.concept ?? 'equivalence';

```

with

```ts
  backLabel: string;
}

export interface ReviewRow {
  prompt: string;
  /** Every option tapped, in order. */
  tries: { option: string; right: boolean }[];
  answer: string;
  /** The hint for each wrong option the student chose. */
  hints: { option: string; hint: string }[];
  guided: BankItem['guided'] | null;
}

export interface ReviewView {
  summary: string;
  rows: ReviewRow[];
}

const conceptsOf = (plan: Plan): ConceptId[] => [...new Set(plan.sessions.flatMap((s) => (s.concept ? [s.concept] : [])))];
const targetOf = (plan: Plan): ConceptId => plan.sessions.find((s) => s.isMasteryCheck)?.concept ?? 'equivalence';

```

Edit 3 of 3. Replace

```ts
    backLabel: state.phone.updated ? 'See tomorrow’s plan' : 'Back to plan',
  };
}
```

with

```ts
    backLabel: state.phone.updated ? 'See tomorrow’s plan' : 'Back to plan',
  };
}

/** The review after a session: a summary line and one row per question, from the answer sheet. */
export function reviewView(state: DemoState): ReviewView {
  const rows = state.phone.sheet.flatMap((q): ReviewRow[] => {
    const item = itemById(q.itemId);
    if (!item) return [];
    const wrong = [...new Set(q.tries)].filter((o) => o !== item.correct);
    return [{
      prompt: item.prompt,
      tries: q.tries.map((o) => ({ option: item.options[o], right: o === item.correct })),
      answer: item.options[item.correct],
      hints: wrong.map((o) => ({ option: item.options[o], hint: item.hints[o] })),
      guided: item.guided ?? null,
    }];
  });
  const firstTry = state.phone.sheet.filter((q) => q.rightOn === 1).length;
  const tries = state.phone.sheet.reduce((a, q) => a + q.tries.length, 0);
  const questions = `${rows.length} question${rows.length === 1 ? '' : 's'}`;
  return { summary: `${questions} · ${firstTry} right first try · ${tries} ${tries === 1 ? 'try' : 'tries'} in all`, rows };
}
```

Create `src/student/screens/ReviewScreen.tsx`:

```tsx
import { useState } from 'react';
import type { ReviewRow, ReviewView } from '../liveView';

function Details({ row }: { row: ReviewRow }) {
  if (row.hints.length === 0 && !row.guided) return <div className="px-4 pb-3 text-[13.5px] text-egg-mute">Right first try: nothing more to show.</div>;
  return (
    <div className="space-y-2 px-4 pb-3 text-[13.5px] leading-snug">
      {row.hints.map((h) => (
        <div key={h.option}>
          <span className="font-mono">{h.option}</span>
          <span className="text-egg-mute">{` · ${h.hint}`}</span>
        </div>
      ))}
      {row.guided && (
        <div>
          <div className="font-mono">{row.guided.start}</div>
          {row.guided.steps.map((s, i) => (
            <div key={s.expr} className="mt-1">
              <div className="font-mono text-[12px] text-egg-mute">{`Step ${i + 1} · ${s.why}`}</div>
              <div className="font-mono">{`≡ ${s.expr}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The end of every session: each question with its tries in order. A row expands into its hints and worked steps. */
export function ReviewScreen({ view, onContinue }: { view: ReviewView; onContinue(): void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-egg-bg px-5 pb-8 pt-14 font-sans text-egg-ink">
      <div className="text-[28px] font-bold">Review</div>
      <div className="mt-1 text-[14px] text-egg-mute">{view.summary}</div>
      <ul className="mt-4 space-y-2.5">
        {view.rows.map((r, i) => (
          <li key={i} data-review-row={i} className="rounded-2xl border border-egg-line bg-egg-card">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="w-full p-4 text-left">
              <span className="block text-[15px] font-semibold leading-snug">{r.prompt}</span>
              <span className="mt-1.5 block font-mono text-[13px] text-egg-mute">{r.tries.map((t) => `${t.right ? '✓' : '✗'} ${t.option}`).join(', then ')}</span>
              <span className="mt-1 block text-[13px] text-egg-mute">{`Answer: ${r.answer}`}</span>
            </button>
            {open === i && <Details row={r} />}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onContinue} className="mt-5 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">Continue</button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; 638 tests pass (one more if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

- [ ] **Step 5: Commit**

```bash
git add server/app.test.ts server/app.ts server/evals/harness.ts server/live.smoke.ts server/playSession.ts server/session.study.test.ts server/session.test.ts server/session.ts src/live/fixtures.ts src/live/reducer.test.ts src/live/reducer.ts src/live/seed.ts src/live/study/reducer.test.ts src/live/study/reducer.ts src/live/types.ts src/student/LivePhone.tsx src/student/liveAudit.test.tsx src/student/liveView.test.ts src/student/liveView.ts src/student/screens/ReviewScreen.tsx
git commit -m "feat(practice): every session ends on a review, and Continue finds its way back

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The practice screen

**Files:**
- Modify: `src/student/LivePhone.tsx`
- Modify: `src/student/liveView.ts`
- Modify: `src/student/screens/LivePractice.tsx`
- Test: `src/student/live.test.tsx`, `src/student/liveAudit.test.tsx`, `src/student/liveTaps.test.tsx`

**Interfaces:**
- Consumes (Tasks 2 and 3): `slotCount`, `currentItems`, `planById`, `QuestionSheet`; routes `phone/next`, `phone/goto`, `phone/again`, `phone/finish`.
- Produces:
  - In `src/student/liveView.ts`: `type DotState = 'empty' | 'tried' | 'right'`, `dotState(q: QuestionSheet | undefined): DotState`, `questionsLeft(state: DemoState): number`.
  - `LivePractice` props: `{ state; onAnswer(option: number): void; onNext(): void; onGoto(item: number): void; onAgain(): void; onFinish(): void }`.
  - DOM hooks: `[data-dot="<empty|tried|right>"]` on each dot, `aria-current="step"` and `disabled` on the dot on screen.

- [ ] **Step 1: Write the failing tests**

`src/student/live.test.tsx`:

Edit 1 of 5. Replace

```tsx
import { ensureRecord } from '../live/study/record';
import { startSelf } from '../live/study/reducer';
import { approvePlan, phoneAnswer, phoneOpen, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { Q1 } from '../scenario/practice';
```

with

```tsx
import { ensureRecord } from '../live/study/record';
import { startSelf } from '../live/study/reducer';
import { approvePlan, currentItems, phoneAgain, phoneAnswer, phoneNext, phoneOpen, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { Q1 } from '../scenario/practice';
```

Edit 2 of 5. Replace

```tsx
};
const practice = () => ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0));
const view = {
  name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence', objectives: ['Implication', 'Logical equivalence'],
```

with

```tsx
};
const practice = () => ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0));
const noop = () => {};
const screen = (state: DemoState) => html(<LivePractice state={state} onAnswer={noop} onNext={noop} onGoto={noop} onAgain={noop} onFinish={noop} />);
const view = {
  name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence', objectives: ['Implication', 'Logical equivalence'],
```

Edit 3 of 5. Replace

```tsx
  });
  it('practice: a wrong answer shows that option’s hint; a right one shows Next and the worked rewrite', () => {
    const wrong = html(<LivePractice state={ok(phoneAnswer(practice(), 0))} onAnswer={() => {}} onNext={() => {}} />);
    expect(wrong).toContain('Not quite');
    expect(wrong).toContain(Q1.hint);
    const right = html(<LivePractice state={ok(phoneAnswer(practice(), 1))} onAnswer={() => {}} onNext={() => {}} />);
    expect(right).toContain('Correct!');
    expect(right).toContain('>Next<');
```

with

```tsx
  });
  it('practice: a wrong answer shows that option’s hint; a right one shows Next and the worked rewrite', () => {
    const wrong = screen(ok(phoneAnswer(practice(), 0)));
    expect(wrong).toContain('Not quite');
    expect(wrong).toContain(Q1.hint);
    const right = screen(ok(phoneAnswer(practice(), 1)));
    expect(right).toContain('Correct!');
    expect(right).toContain('>Next<');
```

Edit 4 of 5. Replace

```tsx
    expect(right).toContain('¬(p → q)');
  });
});

```

with

```tsx
    expect(right).toContain('¬(p → q)');
  });
  it('practice: a dot per question, grey, outlined after a try, green once right', () => {
    const fresh = screen(practice());
    expect(fresh.match(/data-dot="empty"/g)).toHaveLength(2);
    expect(screen(ok(phoneAnswer(practice(), 0))).match(/data-dot="tried"/g)).toHaveLength(1);
    expect(screen(ok(phoneAnswer(practice(), 1))).match(/data-dot="right"/g)).toHaveLength(1);
  });
  it('practice: Next is always there, and Back only after the first question', () => {
    const first = screen(practice());
    expect(first).toContain('>Next<');
    expect(first).not.toContain('>Back<');
    expect(screen(ok(phoneNext(practice())))).toContain('>Back<');
  });
  it('practice: an answered question shows its try and Answer again; Answer again clears the options', () => {
    const wrongThenRight = ok(phoneAnswer(ok(phoneAnswer(practice(), 0)), 1));
    const answered = screen(wrongThenRight);
    expect(answered).toContain('Correct on try 2');
    expect(answered).toContain('Answer again');
    expect(answered).not.toContain('Not quite');
    const cleared = screen(ok(phoneAgain(wrongThenRight)));
    expect(cleared).not.toContain('Correct!');
    expect(cleared).not.toContain('Correct on try');
    expect(cleared).not.toContain('Show the next step');
  });
  it('practice: an open question keeps every tried option marked and hints at the last one', () => {
    const out = screen(ok(phoneAnswer(ok(phoneAnswer(practice(), 0)), 2)));
    expect(out.match(/Not quite/g)).toHaveLength(2);
  });
  it('practice: a wrong re-answer is marked and hinted, and the question stays right', () => {
    const out = screen(ok(phoneAnswer(ok(phoneAgain(ok(phoneAnswer(practice(), 1)))), 0)));
    expect(out).toContain('Correct on try 1');
    expect(out).toContain('Not quite');
    expect(out).toContain(Q1.hint);
  });
  it('practice: the last question offers Finish, or says how many are left', () => {
    expect(screen(ok(phoneNext(practice())))).toContain('2 questions left');
    const firstRight = ok(phoneNext(ok(phoneAnswer(practice(), 1))));
    expect(screen(firstRight)).toContain('1 question left');
    expect(screen(ok(phoneAnswer(firstRight, currentItems(firstRight)[1].correct)))).toContain('Finish session');
  });
});

```

Edit 5 of 5. Replace

```tsx
  };
  it('shows the Bloom level and counts to 5', () => {
    const out = html(<LivePractice state={self()} onAnswer={() => {}} onNext={() => {}} />);
    expect(out).toContain('Practice · Understand');
    expect(out).toContain('1 / 5');
  });
});
```

with

```tsx
  };
  it('shows the Bloom level and counts to 5', () => {
    const out = screen(self());
    expect(out).toContain('Practice · Understand');
    expect(out).toContain('1 / 5');
    expect(out.match(/data-dot=/g)).toHaveLength(5);
  });
});
```

`src/student/liveAudit.test.tsx`:

Edit 1 of 2. Replace

```tsx
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAnswer, phoneContinue, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
```

with

```tsx
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAgain, phoneAnswer, phoneContinue, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
```

Edit 2 of 2. Replace

```tsx
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['review', () => ok(playOut(practice(), true))],
```

with

```tsx
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['practice on the last question', () => ok(phoneNext(practice()))],
  ['practice reopened by Answer again', () => ok(phoneAgain(ok(phoneAnswer(practice(), 1))))],
  ['review', () => ok(playOut(practice(), true))],
```

`src/student/liveTaps.test.tsx`:

Edit 1 of 2. Replace

```tsx
import { ensureRecord } from '../live/study/record';
import { approvePlan, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
```

with

```tsx
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
```

Edit 2 of 2. Replace

```tsx

describe('one tap, one request', () => {
```

with

```tsx

describe('moving through a session', () => {
  const practice = () => ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0));
  it('a dot opens its question, and the dot on screen is disabled', async () => {
    const m = await mount(practice(), instant);
    const dots = m.el.querySelectorAll<HTMLButtonElement>('[data-dot]');
    expect(dots[0].disabled).toBe(true);
    await act(async () => dots[1].click());
    expect(m.calls).toEqual([{ path: 'phone/goto', body: { item: 1 } }]);
  });
  it('Next, Back, Answer again and Finish each post their route', async () => {
    const first = await mount(practice(), instant);
    await act(async () => button(first.el, 'Next').click());
    expect(first.calls.map((c) => c.path)).toEqual(['phone/next']);
    act(() => root?.unmount());
    host?.remove();
    const last = await mount(ok(phoneNext(practice())), instant);
    await act(async () => button(last.el, 'Back').click());
    await act(async () => button(last.el, 'questions left').click());
    expect(last.calls).toEqual([{ path: 'phone/goto', body: { item: 0 } }, { path: 'phone/finish', body: undefined }]);
    act(() => root?.unmount());
    host?.remove();
    const right = await mount(ok(phoneAnswer(practice(), 1)), instant);
    await act(async () => button(right.el, 'Answer again').click());
    expect(right.calls.map((c) => c.path)).toEqual(['phone/again']);
  });
});

describe('one tap, one request', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/student/live.test.tsx src/student/liveAudit.test.tsx src/student/liveTaps.test.tsx`
Expected: FAIL: 9 tests fail across `live.test.tsx` and `liveTaps.test.tsx`: there are no `data-dot` buttons, no Back, no "Correct on try" line, and no "questions left" label.

- [ ] **Step 3: Implement**

`src/student/LivePhone.tsx`:

Edit 1 of 2. Replace

```tsx
import { fmt } from '../live/clock';
import { slotCount } from '../live/reducer';
import { useServerSource, type DemoSource } from '../live/source';
```

with

```tsx
import { fmt } from '../live/clock';
import { useServerSource, type DemoSource } from '../live/source';
```

Edit 2 of 2. Replace

```tsx
      {ph.screen === 'practice' && (
        <LivePractice key={`${ph.session}:${ph.item}`} state={state} onAnswer={(o) => send('phone/answer', { option: o })} onNext={() => send(ph.item + 1 >= slotCount(state) ? 'phone/finish' : 'phone/next')} />
      )}
```

with

```tsx
      {ph.screen === 'practice' && (
        <LivePractice
          key={`${ph.session}:${ph.item}`}
          state={state}
          onAnswer={(o) => send('phone/answer', { option: o })}
          onNext={() => send('phone/next')}
          onGoto={(item) => send('phone/goto', { item })}
          onAgain={() => send('phone/again')}
          onFinish={() => send('phone/finish')}
        />
      )}
```

`src/student/liveView.ts`:

Edit 1 of 3. Replace

```ts
import { planById, studentById } from '../live/reducer';
import type { DemoState, Plan } from '../live/types';
import { relativeDay } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
```

with

```ts
import { planById, slotCount, studentById } from '../live/reducer';
import type { DemoState, Plan, QuestionSheet } from '../live/types';
import { relativeDay } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
```

Edit 2 of 3. Replace

```ts
}

export interface ReviewRow {
  prompt: string;
```

with

```ts
}

export type DotState = 'empty' | 'tried' | 'right';

export interface ReviewRow {
  prompt: string;
```

Edit 3 of 3. Replace

```ts
  return { summary: `${questions} · ${firstTry} right first try · ${tries} ${tries === 1 ? 'try' : 'tries'} in all`, rows };
}
```

with

```ts
  return { summary: `${questions} · ${firstTry} right first try · ${tries} ${tries === 1 ? 'try' : 'tries'} in all`, rows };
}

/** A question dot: grey before any try, outlined after one, green once right. */
export const dotState = (q: QuestionSheet | undefined): DotState => (!q || q.tries.length === 0 ? 'empty' : q.rightOn === null ? 'tried' : 'right');

/** Questions in the open session without a right answer yet, including slots not opened. */
export const questionsLeft = (state: DemoState): number => slotCount(state) - state.phone.sheet.filter((q) => q.rightOn !== null).length;
```

`src/student/screens/LivePractice.tsx`:

Edit 1 of 8. Replace

```tsx
import { useState } from 'react';
import { SELF_SESSION } from '../../live/study/select';
import { currentItems, planById } from '../../live/reducer';
import type { DemoState } from '../../live/types';
```

with

```tsx
import { useState } from 'react';
import { currentItems, planById, slotCount } from '../../live/reducer';
import type { DemoState } from '../../live/types';
```

Edit 2 of 8. Replace

```tsx
import { Mark } from '../../teacher/parts';
import { OPTION_CLS } from './PracticeScreen';

/** Live practice: real taps on canned items, the chosen option's hint, and a worked rewrite after a correct answer. */
export function LivePractice({ state, onAnswer, onNext }: { state: DemoState; onAnswer(option: number): void; onNext(): void }) {
  const [steps, setSteps] = useState(0);
```

with

```tsx
import { Mark } from '../../teacher/parts';
import { dotState, questionsLeft, type DotState } from '../liveView';
import { OPTION_CLS } from './PracticeScreen';

const DOT: Record<DotState, string> = {
  empty: 'border-egg-line bg-egg-line text-egg-mute',
  tried: 'border-egg-ink text-egg-ink',
  right: 'border-egg-sage bg-egg-sage text-egg-card',
};
const PRIMARY = 'flex-1 rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card';
const GHOST = 'flex-1 rounded-full border border-egg-ink py-3 text-[15px] font-semibold';

interface Props {
  state: DemoState;
  onAnswer(option: number): void;
  onNext(): void;
  onGoto(item: number): void;
  onAgain(): void;
  onFinish(): void;
}

/** Live practice: real taps on canned items, free movement between questions, every try kept, and a worked rewrite after a correct answer. */
export function LivePractice({ state, onAnswer, onNext, onGoto, onAgain, onFinish }: Props) {
  const [steps, setSteps] = useState(0);
```

Edit 3 of 8. Replace

```tsx
  const plan = planById(state, ph.planId);
  const items = currentItems(state);
  const item = items[ph.item];
  const session = !ph.self && plan && ph.session !== null ? plan.sessions[ph.session] : null;
  if (!item || (!ph.self && !session)) return null;
  const q = ph.sheet[ph.item];
  const right = q !== undefined && q.rightOn !== null;
  const lastWrong = !right && q?.tries.length ? q.tries.at(-1)! : null;
  const guided = right ? item.guided : undefined;
  const total = ph.self ? SELF_SESSION : items.length;
  const last = ph.item + 1 >= total;
  const heading = session ? (session.isMasteryCheck ? 'Mastery check' : 'Guided practice') : `Practice · ${item.bloom}`;
  return (
```

with

```tsx
  const plan = planById(state, ph.planId);
  const item = currentItems(state)[ph.item];
  const q = ph.sheet[ph.item];
  const session = !ph.self && plan && ph.session !== null ? plan.sessions[ph.session] : null;
  if (!item || !q || (!ph.self && !session)) return null;
  const right = q.rightOn !== null;
  const answered = right && !q.reopened;
  const last = q.tries.at(-1);
  const lastWrong = !q.reopened && last !== undefined && last !== item.correct ? last : null;
  const look = (i: number) => {
    if (q.reopened) return 'idle';
    if (right && i === item.correct) return 'right';
    if (i === lastWrong || (!right && q.tries.includes(i))) return 'wrong';
    return 'idle';
  };
  const guided = answered ? item.guided : undefined;
  const total = slotCount(state);
  const left = questionsLeft(state);
  const heading = session ? (session.isMasteryCheck ? 'Mastery check' : 'Guided practice') : `Practice · ${item.bloom}`;
  const finish = session ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Finish practice';
  return (
```

Edit 4 of 8. Replace

```tsx
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-egg-line">
        <div className="h-full rounded-full bg-egg-accent" style={{ width: `${((ph.item + (right ? 1 : 0)) / total) * 100}%` }} />
      </div>
```

with

```tsx
      </div>
      <div className="mt-2 flex gap-2">
        {Array.from({ length: total }, (_, i) => {
          const dot = dotState(ph.sheet[i]);
          return (
            <button
              key={i}
              type="button"
              data-dot={dot}
              aria-label={`Question ${i + 1}`}
              aria-current={i === ph.item ? 'step' : undefined}
              disabled={i === ph.item}
              onClick={() => onGoto(i)}
              className={`h-8 w-8 rounded-full border text-[13px] font-semibold ${DOT[dot]} ${i === ph.item ? 'ring-2 ring-egg-accent ring-offset-1' : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
```

Edit 5 of 8. Replace

```tsx
        {item.options.map((o, i) => {
          const look = right && i === item.correct ? 'right' : i === lastWrong ? 'wrong' : 'idle';
          return (
```

with

```tsx
        {item.options.map((o, i) => {
          const mark = look(i);
          return (
```

Edit 6 of 8. Replace

```tsx
              type="button"
              disabled={right}
              onClick={() => onAnswer(i)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-[13px] text-left font-mono text-[18px] text-egg-ink ${OPTION_CLS[look]}`}
            >
              {o}
              {look === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {look === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </button>
```

with

```tsx
              type="button"
              disabled={answered}
              onClick={() => onAnswer(i)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-[13px] text-left font-mono text-[18px] text-egg-ink ${OPTION_CLS[mark]}`}
            >
              {o}
              {mark === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {mark === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </button>
```

Edit 7 of 8. Replace

```tsx
      </div>
      {lastWrong !== null && (
```

with

```tsx
      </div>
      {answered && (
        <div className="mt-4 flex items-center justify-between text-[14px]">
          <span className="font-semibold text-egg-sage">{`Correct on try ${q.rightOn}`}</span>
          <button type="button" onClick={onAgain} className="font-semibold text-egg-mute underline underline-offset-4">Answer again</button>
        </div>
      )}
      {lastWrong !== null && (
```

Edit 8 of 8. Replace

```tsx
      )}
      {right && (
        <button type="button" onClick={onNext} className="mt-5 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">
          {last ? (session ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Finish practice') : 'Next'}
        </button>
      )}
    </div>
```

with

```tsx
      )}
      <div className="mt-5 flex gap-3">
        {ph.item > 0 && <button type="button" onClick={() => onGoto(ph.item - 1)} className={GHOST}>Back</button>}
        {ph.item + 1 < total ? (
          <button type="button" onClick={onNext} className={PRIMARY}>Next</button>
        ) : (
          <button type="button" onClick={onFinish} className={PRIMARY}>{left === 0 ? finish : `${left} question${left === 1 ? '' : 's'} left`}</button>
        )}
      </div>
    </div>
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; 648 tests pass (one more if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

- [ ] **Step 5: Commit**

```bash
git add src/student/LivePhone.tsx src/student/live.test.tsx src/student/liveAudit.test.tsx src/student/liveTaps.test.tsx src/student/liveView.ts src/student/screens/LivePractice.tsx
git commit -m "feat(phone): question dots, Back and Next, Answer again and Finish in practice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tries for the teacher and the agents

**Files:**
- Modify: `server/agents/tools.ts`
- Modify: `src/live/study/outlook.ts`
- Modify: `src/student/liveView.ts`
- Modify: `src/teacher/LivePanel.tsx`
- Test: `server/agents/tools.test.ts`, `src/student/liveView.test.ts`, `src/teacher/livePanel.test.tsx`

**Interfaces:**
- Consumes (Tasks 1 to 3): `averageTries(rec, today)`, `Evidence.tries`, `Attempt.tries`.
- Produces:
  - `ExamOutlook.averageTries: number | null`, and `averageTries` on `get_student`.
  - `progressView(...).accuracy` counts questions right on try 1, over all questions.
  - The Road to the exam panel shows "1.6 tries per question this week" once there are answers.

- [ ] **Step 1: Write the failing tests**

`server/agents/tools.test.ts`:

Replace

```ts
  });
  it('names the students whose own Quiz 2 Q4 answer chose the converse', () => {
```

with

```ts
  });
  it('reports average tries per question in the last 7 days', () => {
    const state = seedState();
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({ averageTries: null });
    expect(readTool(state, 'get_student', { student_id: 's17' })).toMatchObject({ averageTries: null });
    const rec = ensureRecord(state, 's17');
    const base = { itemId: 'implication-1', day: 40, correct: true, firstTry: false };
    rec.attempts.push({ ...base, tries: 1 }, { ...base, tries: 2 });
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({ averageTries: 1.5 });
    expect(readTool(state, 'get_student', { student_id: 's17' })).toMatchObject({ averageTries: 1.5 });
    expect(READ_TOOLS.find((t) => t.name === 'get_exam_outlook')!.description).toContain('averageTries');
    expect(READ_TOOLS.find((t) => t.name === 'get_student')!.description).toContain('averageTries');
  });
  it('names the students whose own Quiz 2 Q4 answer chose the converse', () => {
```

`src/student/liveView.test.ts`:

Edit 1 of 3. Replace

```ts
  });
  it('accuracy leaves out the rows Skip wrote', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
```

with

```ts
  });
  it('accuracy counts questions right on try 1, and leaves out the rows Skip wrote', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
```

Edit 2 of 3. Replace

```ts
    s = ok(phoneAnswer(s, rest[1].correct));
    // Four answers, three of them correct: the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(75);
  });
  it('accuracy counts only this plan’s session answers, wrong ones as wrong, and leaves self-practice out', () => {
    const base = sent();
```

with

```ts
    s = ok(phoneAnswer(s, rest[1].correct));
    // Three questions, two right on try 1: the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(67);
  });
  it('accuracy counts only this plan’s questions and leaves self-practice out', () => {
    const base = sent();
```

Edit 3 of 3. Replace

```ts
    const s = ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(base)))), 1)), true));
    // Three wrong, three right, in this plan's session: half. The self-practice row and the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(50);
  });
```

with

```ts
    const s = ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(base)))), 1)), true));
    // Three questions, none right on try 1. The self-practice row and the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(0);
  });
```

`src/teacher/livePanel.test.tsx`:

Replace

```tsx
  });
  it('shows the latest mark', () => {
```

with

```tsx
  });
  it('shows tries per question once there are answers this week', () => {
    const panel: LivePanel = { kind: 'student', studentId: 's17', planId: null, highlight: null };
    expect(render(withStudy(), panel)).not.toContain('tries per question');
    const s = withStudy();
    const base = { itemId: 'implication-1', day: 40, correct: true, firstTry: false };
    s.study.s17.attempts.push({ ...base, tries: 1 }, { ...base, tries: 1 }, { ...base, tries: 3 });
    expect(render(s, panel)).toContain('1.7 tries per question this week');
  });
  it('shows the latest mark', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run server/agents/tools.test.ts src/student/liveView.test.ts src/teacher/livePanel.test.tsx`
Expected: FAIL: 4 tests fail: the two accuracy tests get 75 and 50, `averageTries` is missing from both tools, and the panel has no tries line.

- [ ] **Step 3: Implement**

`server/agents/tools.ts`:

Edit 1 of 4. Replace

```ts
import { forecast } from '../../src/live/study/estimate';
import { fullDate, LECTURES, lectureLabel, shortDate } from '../../src/scenario/course';
```

with

```ts
import { forecast } from '../../src/live/study/estimate';
import { averageTries } from '../../src/live/study/record';
import { fullDate, LECTURES, lectureLabel, shortDate } from '../../src/scenario/course';
```

Edit 2 of 4. Replace

```ts
  }),
  tool('get_student', "One student's learning twin: mastery per concept, status, quiz scores (percent), practice per week, gaps (focus concepts below 0.50) and plans. Also gpa (4-point scale), history (previous subjects, 10-point grades with letters) and forecast (out of 10 now, with its band; an estimate). Mastery is 0 to 1.", {
    student_id: { type: 'string' },
```

with

```ts
  }),
  tool('get_student', "One student's learning twin: mastery per concept, status, quiz scores (percent), practice per week, averageTries (mean tries per question answered in the last 7 days, null with none), gaps (focus concepts below 0.50) and plans. Also gpa (4-point scale), history (previous subjects, 10-point grades with letters) and forecast (out of 10 now, with its band; an estimate). Mastery is 0 to 1.", {
    student_id: { type: 'string' },
```

Edit 3 of 4. Replace

```ts
  }),
  tool('get_exam_outlook', "A student's road to the final exam: forecast out of 10 now (pass 4.0), the forecast if the current plan is kept, and the band (all estimates), mastery per learning outcome (CLO), minutes planned and done against the current plan, practisedLast7Days (minutes done and planned over the last 7 days; little or nothing done means the student has stopped practising), assessment marks so far (for example Quiz 3), the next assessment, and the last change to the study plan with its reason. setUp is false until the student has set up on the phone.", {
    student_id: { type: 'string' },
```

with

```ts
  }),
  tool('get_exam_outlook', "A student's road to the final exam: forecast out of 10 now (pass 4.0), the forecast if the current plan is kept, and the band (all estimates), mastery per learning outcome (CLO), minutes planned and done against the current plan, practisedLast7Days (minutes done and planned over the last 7 days; little or nothing done means the student has stopped practising), averageTries (mean tries per question answered in the last 7 days, null with none), assessment marks so far (for example Quiz 3), the next assessment, and the last change to the study plan with its reason. setUp is false until the student has set up on the phone.", {
    student_id: { type: 'string' },
```

Edit 4 of 4. Replace

```ts
    quiz: s.quiz, practicePerWeek: s.practicePerWeek,
    gpa: s.gpa,
```

with

```ts
    quiz: s.quiz, practicePerWeek: s.practicePerWeek,
    averageTries: averageTries(state.study[s.id], state.day),
    gpa: s.gpa,
```

`src/live/study/outlook.ts`:

Edit 1 of 3. Replace

```ts
import { cloMastery, forecast, PASS, projection } from './estimate';
import { newRecord, selfDone } from './record';
import { lastWeek } from './signals';
```

with

```ts
import { cloMastery, forecast, PASS, projection } from './estimate';
import { averageTries, newRecord, selfDone } from './record';
import { lastWeek } from './signals';
```

Edit 2 of 3. Replace

```ts
  practisedLast7Days: { done: number; planned: number };
  nextAssessment: { title: string; date: string; daysAway: number } | null;
```

with

```ts
  practisedLast7Days: { done: number; planned: number };
  /** Mean tries per question answered in the last 7 days, or null with none. */
  averageTries: number | null;
  nextAssessment: { title: string; date: string; daysAway: number } | null;
```

Edit 3 of 3. Replace

```ts
    practisedLast7Days: lastWeek(rec, state.day),
    nextAssessment: next && { title: next.title, date: fullDate(next.day), daysAway: next.day - state.day },
```

with

```ts
    practisedLast7Days: lastWeek(rec, state.day),
    averageTries: averageTries(rec, state.day),
    nextAssessment: next && { title: next.title, date: fullDate(next.day), daysAway: next.day - state.day },
```

`src/student/liveView.ts`:

Edit 1 of 2. Replace

```ts
  const target = targetOf(plan);
  const practice = student.evidence.filter((e) => e.kind === 'practice' && e.planId === plan.id && e.result !== 'skipped');
  const correct = practice.filter((e) => e.result === 'correct').length;
  return {
```

with

```ts
  const target = targetOf(plan);
  // One 'correct' row per question, carrying the try it came on.
  const questions = student.evidence.filter((e) => e.kind === 'practice' && e.planId === plan.id && e.result === 'correct');
  const firstTry = questions.filter((e) => e.tries === 1).length;
  return {
```

Edit 2 of 2. Replace

```ts
    to: Math.round(student.mastery[target] * 100),
    accuracy: practice.length ? Math.round((correct / practice.length) * 100) : 0,
    items: plan.sessions.map((s) => ({ title: s.title, when: s.time })),
```

with

```ts
    to: Math.round(student.mastery[target] * 100),
    accuracy: questions.length ? Math.round((firstTry / questions.length) * 100) : 0,
    items: plan.sessions.map((s) => ({ title: s.title, when: s.time })),
```

`src/teacher/LivePanel.tsx`:

Replace

```tsx
      {stopped && <div className="mt-3 text-[13.5px] font-semibold text-egg-accent-ink">{`Stopped practising: ${stopped.done} of ${stopped.planned} min in the last 7 days.`}</div>}
      {latest && <div className="mt-3 text-[13.5px] text-egg-ink">{`${latest.title}: ${latest.mark}`}</div>}
```

with

```tsx
      {stopped && <div className="mt-3 text-[13.5px] font-semibold text-egg-accent-ink">{`Stopped practising: ${stopped.done} of ${stopped.planned} min in the last 7 days.`}</div>}
      {o.averageTries !== null && <div className="mt-3 text-[13.5px] text-egg-ink">{`${o.averageTries.toFixed(1)} tries per question this week`}</div>}
      {latest && <div className="mt-3 text-[13.5px] text-egg-ink">{`${latest.title}: ${latest.mark}`}</div>}
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; 650 tests pass (one more if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

- [ ] **Step 5: Commit**

```bash
git add server/agents/tools.test.ts server/agents/tools.ts src/live/study/outlook.ts src/student/liveView.test.ts src/student/liveView.ts src/teacher/LivePanel.tsx src/teacher/livePanel.test.tsx
git commit -m "feat(teacher): tries per question for the teacher and the agents, and accuracy by first try

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verification, README and spec

**Files:**
- Modify: `README.md`
- Modify (leave unstaged): `docs/superpowers/specs/2026-11-01-quiz-attempts-review-design.md`

**Interfaces:**
- Consumes: everything above; the harness's `playOpenSession` from Task 3.

- [ ] **Step 1: Update the README**

`README.md`:

Edit 1 of 2. Replace

```md

On the phone, tap the lock-screen notification and choose a student. Enter the minutes you have, and the Study Planning Agent writes a plan from today to the exam (24 November). Today shows the day's cards and practice; Practise picks 5 questions at the right Bloom level; Cards are self-rated flip cards; Semester shows the weeks to the exam and why the plan changed. **Next day** asks how the day felt and lands on the next morning's notification; **Next week** skips ahead without asking. Both are the booth's clock: they move the story date for both screens, not just the phone.

```

with

```md

On the phone, tap the lock-screen notification and choose a student. Enter the minutes you have, and the Study Planning Agent writes a plan from today to the exam (24 November). Today shows the day's cards and practice; Practise picks 5 questions at the right Bloom level; every session lets you move freely between questions, keeps every try, and ends on a review; Cards are self-rated flip cards; Semester shows the weeks to the exam and why the plan changed. **Next day** asks how the day felt and lands on the next morning's notification; **Next week** skips ahead without asking. Both are the booth's clock: they move the story date for both screens, not just the phone.

```

Edit 2 of 2. Replace

```md
- [ ] Edit a session time, **Approve & send**: the notification lands on the phone.
- [ ] Phone: a wrong answer shows its hint; the teacher's meters move as answers arrive; **Skip to tonight**, finish the mastery check; the teacher gets the 20:40 update and the phone shows tomorrow's plan.
- [ ] Ask about the class and about who needs you personally: approve the class activity and the check-ins (nothing reaches the phone).
```

with

```md
- [ ] Edit a session time, **Approve & send**: the notification lands on the phone.
- [ ] Phone: a wrong answer shows its hint; the question dots, **Back**, **Next** and **Answer again** move around the session; the teacher's meters move as answers arrive; **Skip to tonight**, finish the mastery check; the review lists every try; the teacher gets the 20:40 update; **Continue** shows progress and the phone then shows tomorrow's plan.
- [ ] Ask about the class and about who needs you personally: approve the class activity and the check-ins (nothing reaches the phone).
```

- [ ] **Step 2: Record the decisions in the spec**

This file carries the user's uncommitted section 8, so edit it in the working tree and don't stage it. Make these five replacements; each "replace" text is one whole line of the spec.

In section 2's code block, replace

```
PhoneState.screen: … | 'review';     // new screen
```

with

```
PhoneState.screen: … | 'review';     // new screen
PhoneState.reviewNext: 'today' | 'plan' | 'progress' | null;   // where Continue goes; a follow-up can replace the plan while the review is open
```

In section 2, replace

```
- `Evidence` text for an answer reads `correct on try N` or `chose <option>`. The `result` marker added for the progress screen stays.
```

with

```
- `Evidence` text for an answer reads `correct on try N` or `chose <option>`. The `result` marker added for the progress screen stays, and `Evidence.tries` holds the try of a right answer so the progress screen can count first tries. A re-answer writes a row reading `answered again: <option>` with no `result`. Agents see the text, not these fields.
```

In section 4, replace

```
- **Tapping a dot** opens that question. In self practice, opening an empty slot by Next or by its dot picks the question then with the existing adaptive rule; it stays fixed after that.
```

with

```
- **Tapping a dot** opens that question. In self practice, opening an empty slot by Next or by its dot picks the question then with the existing adaptive rule; it stays fixed after that. Slots fill in order, so a jump also picks the slots it passes.
```

In section 5, replace

```
`phoneAnswer` records the try on the sheet. `phoneNext` becomes "go to the next slot" (`phoneGoto(item + 1)`). `deliver`, `advance` and the other existing transitions that end practice clear `sheet`.
```

with

```
`phoneAnswer` records the try on the sheet. `phoneNext` becomes "go to the next slot" (`phoneGoto(item + 1)`) and stops at the last question. `advance` and the other existing transitions that end practice clear `sheet`. `deliver` clears it too, except that a follow-up landing on the review keeps the review open.
```

In section 6, replace

```
- A repeat tap of the option just tried still fails, as today.
```

with

```
- A repeat tap of the option just tried still fails, as today. After Answer again, choosing the option just tapped adds nothing: no try, no minutes, no evidence.
```

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: all clean; 650 tests pass (651 if the uncommitted test in `server/agents/study.test.ts` is still in your working tree).

Then the free control eval, to check the graders still load:

Run: `npm run eval -- --offline --only L4.1,L4.2,L4.4`
Expected: the run completes with `0/3 cases, 34/44 checks, $0.00`. The offline fallback failing agent checks is normal for the control run. Don't commit the report it writes under `docs/evals/`.

- [ ] **Step 4: Real-API evals (ask the user first: this costs money)**

Ask the user before running. The spec estimates about $0.15.

Run: `npm run eval -- --only L4.1,L4.2,L4.4`
Expected: all three pass as before. `playSession`'s wrong-first mode answers on try 2, so L4.2's credit doesn't change. Update a grader only where it assumed the old credit. Report the new results file under `docs/evals/` to the user, and don't commit eval outputs unless the user asks.

- [ ] **Step 5: Run the booth and look**

Run: `npm run booth`, then check by hand on a phone-sized window:
1. Ask "Why did Minh Anh's quiz score drop?", approve the plan and open the first session on the phone: a row of numbered dots sits above the question.
2. Choose a wrong answer: "Not quite" and a hint show, and the dot turns outlined. Choose another wrong answer: both stay marked and the hint follows the last one.
3. Tap **Next** without answering, then **Back**: the tries are still there.
4. Answer it: "Correct on try 3", the dot turns green, and the teacher's figures move. Tap **Answer again**: the options clear. Choose an answer: no credit is added.
5. On the last question with an open question left, the button reads "1 question left" and jumps to it. With all right it reads **Finish session**.
6. The review reads like "2 questions · 1 right first try · 4 tries in all", with tries in order. A row expands. **Continue** returns to the plan.
7. **Skip to tonight**, then finish the mastery check: the review opens, and the teacher's update arrives while it's open. **Continue** shows the progress screen, then tomorrow's plan.
8. On a student with a study plan, finish a **Practise** set: **Continue** returns to Today, and the teacher's Road to the exam panel shows tries per question.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: the booth checklist and student loop cover attempts and the review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Update the demo scripts**

The live doc [Beyond demo scripts](https://claude.ai/artifact/FDqkLGa3MwsTS5u8KyV45w) describes the old phone flow. In scenario 2, step 2 no longer holds the student on a question, and step 5 now passes through the review first, with the teacher's update arriving before **Continue**. Scenario 6 can add a **Practise** set to show the review. The controller makes this change after the merge, because subagents can't reach that doc.
