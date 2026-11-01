# Teacher Calendar, Weekly Revision and Phone Facts: Design

Date: 2026-11-01. Status: awaiting user review. Builds on the student voice work (branch `student-voice`), which added the lecture calendar (`LECTURES`), the 10-point forecast and the profile pop-up.

## 1. Goal

The course has a fixed structure in time: a lecture every Tuesday, quizzes and assignments on set days, the exam on day 64. Today the app ignores most of it. The study plan can schedule a concept before its lecture, the revision content never moves on by itself, a student can skip three weeks without the teacher hearing about it, and the phone shows the student a risk band.

This spec ties the app to that structure:

- **Revision follows the lectures.** A plan day only uses concepts already lectured by that day, and each new week the plan's concepts are re-picked from the newest lecture and the next assessment.
- **Idle weeks cost mastery,** so skipping lowers the forecast.
- **The teacher is told when a student stops practising.**
- **The phone shows facts, not risk:** GPA, this course's marks, the next lecture, the next assessment and the next assignment.
- **The teacher gets a Calendar tab** with lectures, assessments, sessions, check-ins and stopped-practising flags.

### Decisions

| Topic | Decision |
|---|---|
| Weekly refresh | Rules re-pick each new week's concepts (no tokens); the agent still rewrites the whole plan only on the existing signals |
| Untaught concepts | Never scheduled before their lecture, by either planner |
| Forgetting | 0.02 mastery a week for each unpractised concept, floor 0.25, students with a study record only |
| Teacher alert | Attention row, a line in Road to the exam, a chart marker; no chat message, no tokens |
| Phone | No band or forecast; GPA, this course's marks, next lecture, next assessment, next assignment |
| Calendar | A live-only teacher tab with a week grid; a view only, nothing new for the agents |
| Lesson planning tab | Out of scope (separate spec) |

## 2. Revision follows the lectures

### 2.1 Taught concepts (`src/scenario/course.ts`)

```ts
export function taughtBy(day: number): ConceptId[];   // concepts of every lecture held on or before `day` (from 09:00 that day)
```

### 2.2 Both planners respect it

- **Agent plan check** (`server/agents/study.ts`): a plan day that lists a concept not yet taught by that day is rejected with a message the agent can act on, for example "Day 41: Equivalence laws is not taught until Lecture 7 on Tue 3 Nov."
- **Agent prompt** gains two lines: "Lectures so far: 1–6 (latest: Lecture 6 · Logical equivalence and De Morgan, Tue 27 Oct). Next lecture: Lecture 7 · Equivalence laws, Tue 3 Nov." and "Next assessment: Quiz 3 on Thu 12 Nov, covering CLO2, CLO3."
- **Offline planner** (`server/agents/cannedStudy.ts`): draws each day's concepts only from `taughtBy(day)`. A day whose CLO has no taught concept yet takes a CLO the next assessment tests.

### 2.3 Weekly refocus (`src/live/study/refocus.ts`, pure)

```ts
export function refocus(plan: StudyPlan, student: StudentProfile, weekStart: number): StudyPlan;
```

Runs in `advance` whenever the story reaches a Monday (`day % 7 === 0`), for the student on the phone. It changes only the plan days from `weekStart` to `weekStart + 6`:

- **Minutes** stay as the plan set them.
- **CLO** stays if it has a concept taught by that day; otherwise it becomes the first CLO the next assessment tests that has a taught concept.
- **Concepts** (up to 2, prerequisites first), all taught by that day, in this order:
  1. the newest lecture's concepts,
  2. concepts the next assessment tests,
  3. the weakest.
- **Week 9 (revision) and the days before the exam:** every taught concept is eligible, weakest first.
- The plan keeps its `reason`; refocusing is not a replan and adds nothing to `replans`.

### 2.4 Forgetting (`src/live/study/forgetting.ts`, pure)

```ts
export function forget(student: StudentProfile, rec: StudyRecord, today: number): void;   // mutates student.mastery
```

Runs in `advance` at each Monday, before `refocus`. Every concept with no attempt in the last 7 days loses 0.02 mastery, but never drops below 0.25 (a concept already below 0.25 stays where it is). Only students with a study record are affected, which in practice is the student on the phone.

## 3. Stopped-practising alert

```ts
// src/live/study/signals.ts
export function stoppedPractising(rec: StudyRecord, today: number): { done: number; planned: number } | null;
```

Uses the existing disengagement rule (three planned days with nothing done, or under 25% of planned minutes over 7 days) and returns the minutes for the last 7 closed days, or null when the student is practising.

- **Teacher Today list** (`TeacherScreen.tsx`, live only): one row per affected student, "Stopped practising · Minh Anh · 0 of 210 min this week". Clicking it asks "Minh Anh has stopped practising. What should I do?".
- **Road to the exam** (student panel): the line "Stopped practising: 0 of 210 min in the last 7 days."
- **Forecast chart** (profile pop-up): a "Stopped" marker on the intervention row on each day a `disengaged` replan happened.
- **`get_exam_outlook`** gains `practisedLast7Days: { done: number; planned: number }`.

## 4. The phone shows facts, not risk

- **Today's top card** loses the band and the forecast. It shows:
  - **GPA**: "GPA 2.30 of 4".
  - **This course's marks so far**: "Quiz 1 75% · Quiz 2 42%", from the seed (Quiz 1 and Quiz 2), then `rec.marks`, oldest first.
  - **Next lecture**: "Lecture 7 · Equivalence laws · Tue 3 Nov".
  - **Next assessment**: "Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3".
  - **Assignment**: "Assignment 2 · due Fri 6 Nov", and after its day, its mark ("Assignment 2 · 61%").
- **Semester screen** adds "Previous subjects": subject, term, grade and letter.
- **Replan reasons** no longer mention the outlook: `bandChange` copy becomes "Your progress changed, so the plan did too."
- `TodayView` drops `band` and `forecast`.
- The teacher keeps the forecast, the bands, "May not pass" and the chart.

## 5. Teacher calendar

### 5.1 Model (`src/teacher/calendar.ts`, pure)

```ts
type CalendarEvent =
  | { kind: 'lecture'; day: number; time: '09:00'; title: string; lecture: number }
  | { kind: 'assessment'; day: number; title: string; assessment: string }
  | { kind: 'session'; day: number; time: string; title: string; planId: string; studentIds: string[] }
  | { kind: 'stopped'; day: number; studentId: string };

export function calendarWeek(state: DemoState, week: number): { week: number; days: { day: number; events: CalendarEvent[] }[] };
```

- **Lectures** from `LECTURES`.
- **Assessments** from `ASSESSMENTS`.
- **Sessions:** the sessions of plans with status `sent`, `autoApproved`, `approved` or `done` (pathways, class activities, check-ins), on the plan's date.
- **Stopped:** one event per student, on the first day of the current stretch of `stoppedPractising`.
- Events in a day are ordered by time, untimed ones first.

### 5.2 Tab (`src/teacher/CalendarTab.tsx`, exported `Calendar`, live only)

- A "Calendar" item in the teacher sidebar, next to Classroom, shown only in the live booth. The `View` type gains `'calendar'`. The scripted video's sidebar is unchanged.
- A week grid, Monday to Sunday, opening on the story's current week, with a today marker. "‹ Prev week" and "Next week ›" browse Weeks 1 to 10; they never advance the story.
- **Each event opens something:**
  - a lecture expands, under the week grid, into the student questions placed after it: the FAQ log filtered to messages whose `lectureBefore` is that lecture;
  - an assessment expands, under the week grid, into its date, CLOs and, once there are any, the marks;
  - a session opens its plan's conversation;
  - a stopped flag opens the student's profile pop-up.
- Empty days show nothing. A week with no events reads "Nothing scheduled".

## 6. Errors and edge cases

- On a Monday with no plan (before setup), `refocus` does nothing; `forget` still runs for students with a record.
- If no CLO has a taught concept on a day, which can only happen before Lecture 1, `refocus` leaves that day as it is.
- `stoppedPractising` before any closed day returns null.
- Browsing the calendar past Week 10 or before Week 1 is disabled at the ends.

## 7. Testing

- **Rules:** `taughtBy` at lecture boundaries (08:59 and 09:00 on a Tuesday); `refocus` keeps minutes, never picks an untaught concept, puts the newest lecture first, then the next assessment, and spreads weeks 9–10 across all taught concepts; `forget` lowers only unpractised concepts, respects the floor, and leaves students without a record alone; `stoppedPractising` matches the disengagement rule.
- **Planners:** the agent plan check rejects an untaught concept with its lecture date; the offline plan never schedules one; the prompt lists the lectures and the next assessment.
- **Reducer:** Next week on a Monday runs `forget` then `refocus` once; a day that is not a Monday runs neither.
- **Phone:** Today shows GPA, marks, next lecture, next assessment and next assignment, and contains neither "Likely", "At risk", "Unlikely" nor "out of 10"; Semester lists previous subjects.
- **Teacher:** the Today list gains the stopped row only while `stoppedPractising` is non-null; the Road to the exam line and the chart marker appear; the calendar model returns lectures, assessments, sessions and stopped flags on the right days; the tab browses weeks, expands a lecture into its questions, and opens a session's conversation and a student's pop-up. The click audit gains a "calendar" scenario.
- **Evals (real API):** re-run L6.1–L6.7; add L6.8: "Minh Anh skips three weeks", which checks that the teacher's outlook reports the missed minutes and the forecast fell.

## 8. Out of scope

The Lesson planning tab, editing or dragging calendar events, tutorials (no data), reminders or notifications on the phone, and an agent tool for the calendar.
