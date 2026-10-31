# Beyond AI Tutoring — Student Learning Loop: Design Spec

**Date:** 2026-11-01
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `2026-10-31-live-booth-app-design.md` (live server, agents, phone). The scripted video is unchanged.

## 1. Goal

Today a student can only practise what a teacher sends. This adds the student's own loop on the phone: start practice themselves, get questions chosen for them, review Anki-style cards, and follow a study plan an agent writes backward from the fixed exam date, balancing the time the student really has, how likely they are to pass, and what to revise.

### Key decisions

| Decision | Choice |
|---|---|
| Identity | The phone picks one of the 55 students; one active at a time. A teacher-sent plan switches the phone to that student |
| Time | Story clock plus a date. "Next day" and "Next week" buttons move it |
| Cards | Flip cards, self-rated Again / Hard / Good / Easy |
| Content | Written once, checked, stored in the repo. About 72 questions and 48 cards. Nothing generated live |
| Difficulty | Bloom's Taxonomy per CLO; each CLO spans 3 consecutive levels |
| Who schedules | An agent writes the plan; rules handle cards, question choice, estimates and carry-over |
| Study time | Ask, then watch: self-report, observed practice and an end-of-day check |
| Replanning | Rare: only on a drastic signal, with a cooldown |
| Teacher | Stays in charge: approved plans take priority and cannot be changed by the agent. Study plans need no approval |

## 2. Course model (`src/scenario/course.ts`)

### 2.1 Calendar

Fixed dates. Days are integers counted from Monday of Week 1 (Mon 21 Sep = day 0). The demo starts on day 40, Sat 31 Oct, end of Week 6.

| Week | Mon | Event |
|---|---|---|
| 1–8 | 21 Sep – 9 Nov | Teaching |
| 3 | 5 Oct | Quiz 1, Thu 8 Oct |
| 4 | 12 Oct | Assignment 1, Fri 16 Oct |
| 6 | 26 Oct | Quiz 2, Thu 29 Oct (in the story) |
| 7 | 2 Nov | Assignment 2, Fri 6 Nov |
| 8 | 9 Nov | Quiz 3, Thu 12 Nov |
| 9 | 16 Nov | Revision week, no classes |
| 10 | 23 Nov | Final exam, Tue 24 Nov (day 64) |

### 2.2 CLOs

| CLO | Concepts | Bloom levels | Exam share |
|---|---|---|---|
| CLO1 Express and evaluate logical statements | propositions, negation, conjunction, disjunction, implication, biconditional, truthTables, expressions | Remember, Understand, Apply | 40% |
| CLO2 Establish logical equivalence | equivalence, deMorgan, equivLaws | Understand, Apply, Analyze | 40% |
| CLO3 Reason about real problems with logic | applications | Apply, Analyze, Evaluate | 20% |

### 2.3 Content

- **Questions** (`src/scenario/practiceBank.ts`): `BankItem` gains `clo` and `bloom`. Each concept has 2 questions per Bloom level of its CLO: about 72 in total. The 37 existing items are kept and tagged. `sessionItems` keeps its current behaviour for teacher plans, restricted to the existing items, so teacher-approved plans behave as today.
- **Cards** (`src/scenario/cards.ts`, new): about 4 per concept (about 48), each `{ id, concept, clo, bloom, front, back }`, at the lower Bloom levels of the CLO.
- **Checks:** a test parses every option that is a logic formula over p, q, r and verifies the answer key by truth table where the item states an equivalence. Other items and all cards get a review pass in the plan's review step.

## 3. Date in the demo state

`DemoState` gains `day: number`. The lock screen, teacher date line and message stamps read it; the scripted video keeps its fixed date.

- `Plan` gains `date: number`, resolved when the plan is drafted (`"Today"`, `"Tomorrow"` or a weekday → a day number), and `baseline: Mastery | null`, set at delivery.
- Opening a phone session dated later than the current day moves the date to that day.
- Finishing a mastery check moves the clock to 20:40 on the session's date, not on the original day.
- **Fix for the eval finding:** adapt reads the baseline from the plan being finished (`plan.baseline`), and the progress screen reads it from `lastDone`. `deliver` no longer carries a stale `before`. A second-cycle update therefore reports the change for that cycle.

## 4. Study record

`DemoState.study: Record<studentId, StudyRecord>`, created on first use, cleared by reset.

```ts
interface StudyRecord {
  reported: { weekday: number; weekend: number } | null;  // minutes per day
  feel: number;              // end-of-day factor, starts at 1, clamped 0.6–1.3
  days: Record<number, { planned: number; done: number; check: 'tooMuch' | 'right' | 'tooLittle' | null }>;
  attempts: { itemId: string; day: number; correct: boolean; firstTry: boolean }[];
  cards: Record<string, { interval: number; ease: number; due: number; reps: number }>;
  bloom: Record<CloId, number>;  // index 0–2 into the CLO's levels
  marks: { assessment: string; mark: number; day: number }[];
  plan: StudyPlan | null;
  pendingSignal: ReplanSignal | null;
  replans: { day: number; signal: ReplanSignal; reason: string }[];
}
```

`PhoneState` gains `studentId: string | null` and a `mode`: `'plan' | 'self' | 'cards'`. Screens gain `pick`, `setup`, `today`, `cards`, `semester`, `checkIn`.

## 5. Rules (`src/live/study/`, pure and unit-tested)

### 5.1 Cards (`cards.ts`)

A simplified SM-2. New cards start with ease 2.5.

| Rating | Reviewed card | New card | Ease |
|---|---|---|---|
| Again | 1 day | 1 day | −0.2 |
| Hard | interval × 1.2, at least 1 | 1 day | −0.15 |
| Good | interval × ease | 2 days | unchanged |
| Easy | interval × ease × 1.3 | 4 days | +0.15 |

Ease never falls below 1.3. Intervals round up. `due` is capped at the day before the exam. Introduce at most 5 new cards a day, from the day's focus concepts. A Good or Easy rating moves the concept 5% of the way toward 0.9; Again and Hard leave it (self-rating only nudges mastery).

### 5.2 Next question (`select.ts`)

1. Candidates are the day's focus concepts, or the chosen CLO's concepts when the student picked one.
2. A concept is eligible when each direct prerequisite (`EDGES`) has mastery ≥ 0.4. If none is eligible, use the weakest prerequisite instead.
3. Take the eligible concept with the lowest mastery.
4. Serve an item at the student's Bloom level for that CLO, skipping items attempted in the last 3 days, falling back to the nearest level, then to the oldest attempt.

Starting Bloom level from CLO mastery: below 0.45 lowest, below 0.70 middle, otherwise highest. Two first-try correct answers at a level move up one; a wrong answer moves down one. A self-started session is 5 questions and updates mastery and evidence exactly as plan practice does.

### 5.3 Pass estimate (`estimate.ts`)

CLO mastery is the mean of its concepts. Projected score = Σ share × min(1, mastery + gain) × 100, where gain = min(0.20, planned minutes left / 1000). Pass mark 50. Bands: **Likely** ≥ 60, **At risk** 45–59, **Unlikely** < 45. Always labelled as an estimate.

### 5.4 Capacity (`capacity.ts`)

Nominal time: a question 1.5 minutes, a card 0.5 minutes. Capacity for a day = min(reported, 1.25 × mean minutes done over the last 7 days) × feel, with at least 10 minutes. With fewer than 3 days of history, use reported × feel. The check multiplies `feel` by 0.9 (Too much) or 1.1 (Too little).

### 5.5 Today (`today.ts`)

In order: teacher plan sessions dated today; cards due; then suggested practice for the day's focus up to the budget. Unfinished minutes carry to the next day within capacity. No agent is involved.

### 5.6 Marks (`marks.ts`)

Moving past an assessment date generates a mark: round(100 × weighted mastery) + a seeded offset of −6 to +6 per student and assessment. Director gains **Simulate a Quiz 3 drop**, which sets the active student's Quiz 3 mark 20 points below their previous mark, so the demo can show a drastic signal on demand.

### 5.7 Replan triggers (`signals.ts`)

| Signal | Rule |
|---|---|
| `markSwing` | A new mark differs by ≥ 15 points from the student's previous mark |
| `disengaged` | 3 days in a row with no practice, or under 25% of planned minutes across the last 7 days |
| `bandChange` | The pass band changes |
| `teacherPlan` | A teacher approves a plan for this student |

**Cooldown:** at most one replan per 5 story days. `markSwing` and `teacherPlan` bypass it. A signal raised during the cooldown stays in `pendingSignal` and fires when it ends, if still true. Days before setup do not count.

## 6. Study Planning Agent (`server/agents/study.ts`)

Runs with the existing loop, client and timeouts.

- **Input:** capacity per day, pass estimate, mastery by CLO, weak concepts, cards due, calendar, teacher plans, and the signal (or setup).
- **Finish tool `propose_study_plan`:** `reason` (one sentence for the student), `left_out` (what is deliberately dropped, may be empty), and `days[]` with `{ day, minutes, clo, concepts }`.
- **Server checks:** no day over capacity; every day from today to the day before the exam, nothing after; every concept real; every minutes value ≥ 0; Week 9 has minutes for each CLO still below 0.75; at most 3 concepts a day. One retry, then the offline planner.
- **Honest prioritisation:** the prompt tells the agent to prioritise by exam share and weakness and to name what it leaves out when time cannot cover everything. If the sum of capacity is under 60% of the minutes needed to reach 0.75 on all CLOs (needed = 12 minutes per 0.1 of gap per concept), `left_out` must be non-empty; the server rejects an empty one.
- **Teacher plans:** sent as fixed days. The agent plans around them and has no tool to change them.
- **Language:** student names, no assumed pronouns, English.
- **Offline planner (`server/agents/cannedStudy.ts`):** allocates capacity by exam share × gap, with Week 9 spread across weak CLOs; templated reason; tagged offline.
- **Read tool for SAS and TAS:** `get_exam_outlook(student_id)` returns pass estimate, CLO mastery, minutes planned versus done, the next assessment, and the last replan and reason.

A replan runs in the background: "Next day" is always instant and Today shows the current plan until the new one lands. A failed replan keeps the plan and leaves the signal pending for the next day.

## 7. Phone

Eggshell style, same components, a bottom tab bar (Today, Practise, Cards, Semester) on the new screens only.

1. **Pick:** "Who are you?", 55 students, Minh Anh first. A teacher plan switches the phone to that student.
2. **Setup:** weekday and weekend minutes, then the agent's thinking lines while it writes the first plan.
3. **Today:** exam countdown, pass band, the plan's reason, the day's list with Start buttons.
4. **Practise:** choose a CLO or "Practise what I need". Reuses `LivePractice`, with the Bloom level shown.
5. **Cards:** front, tap to reveal, Again / Hard / Good / Easy, cards left.
6. **Semester:** weeks to the exam with assessments, minutes and CLO focus, and "Why this changed" after a replan.
7. **Check-in:** "Next day" asks Too much / About right / Too little, then lands on the lock screen at 07:30. "Next week" repeats without asking.

**Morning notification:** built from the plan and rules, no agent call: "Today's calendar · 20 min · 6 cards, implication practice · Quiz 3 in 9 days". Tapping opens Today.

Teacher-plan delivery, its notification and the mastery check keep working; an approved plan appears at the top of Today.

## 8. Teacher

- Student panel: a "Road to the exam" section with pass band, minutes planned versus practised, last replan and reason.
- Classroom tiles unchanged.
- New attention row: the count of students whose band is At risk or Unlikely, among students with a plan.
- Self-started practice appears in evidence and moves mastery, so the Classroom and agents see it.

## 9. Agent fixes first (from eval run `2026-10-31T18-58-11`)

Before the features, fix and re-measure with `npm run eval`:

1. SAS drafts plans for plain facts: `needs_plan` must be false for a factual lookup unless the teacher asks what to do.
2. SAS promises more than the policy allows: state the limits (4 sessions, 45 minutes) in `SAS_SYSTEM`, and when a plan is drafted, never describe its contents in the answer beyond saying it is ready. If the request exceeded the limit, say so.
3. TAS adds extras when revising: "change only what the lecturer asked; keep every other session exactly".

The eval's L4.3 check is tightened to catch a stale first-cycle baseline in any wording.

## 10. Failure handling

| Failure | Behaviour |
|---|---|
| Planning agent fails or times out at setup | Offline planner; the plan is tagged offline |
| Invalid plan twice | Offline planner |
| Replan fails | Keep the plan; the signal stays pending |
| Question pool exhausted for a level | Nearest level, then the oldest attempt |
| Phone refresh | Lands on the same screen from server state |
| Reset | Clears study records, date and phone |

## 11. Testing

- **Rules:** intervals, the exam cap, new-card limit, selection with prerequisites, Bloom moves, estimate bands, capacity, carry-over, each trigger and the cooldown.
- **Content:** tags present, counts per concept, 3 consecutive levels per CLO, truth-table answer keys.
- **Agent:** plan checks, retry, offline fallback, `left_out` enforcement, teacher days preserved, using the fake client.
- **Phone:** click audit over the new screens.
- **Video:** frames byte-identical to the previous build.
- **Eval, new Level 6 "the student's semester" (real API):** a plan fits stated time; a low-time student gets a non-empty `left_out`; a skipped week triggers exactly one replan; small misses trigger none; a Quiz 3 drop replans despite the cooldown; a run from Week 6 to the exam logs mastery and band over time; readiness answers match the data.

## 12. Out of scope

Several students at once, timed reminders during the day, editing questions or cards, AI-written questions, real calendar dates, student login.

## 13. Build order

1. Agent fixes and eval re-run.
2. Date in the state and the baseline fix.
3. Course model, question bank, cards, checks.
4. Rule engines.
5. Study record, day flow, signals, marks.
6. Study Planning Agent and offline planner.
7. Phone screens.
8. Teacher section and Director control.
9. Eval Level 6 and README.
