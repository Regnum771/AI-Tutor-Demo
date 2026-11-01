# Student Voice: Design

Date: 2026-11-01. Status: awaiting user review. Builds on the live booth app and the student learning loop, both on `main`. The Practice tab in section 5 uses the try data from the quiz attempts spec (`2026-11-01-quiz-attempts-review-design.md`) once that is built.

## 1. Goal

Show the app's main claim, that it brings fragmented information together, in the live app as well as the video. Today the agents cite students' Zalo messages, but the teacher sees only a grey "ZALO" chip, and the message sits at the bottom of the student panel's evidence list. Only Minh Anh has any Zalo messages, and the class has no view of what students are asking.

This spec makes students' own words visible in four places: quotes in answers, an "In their words" section in the student panel, a class FAQ on the Classroom tab, and a student profile pop-up. It also moves the app to the 10-point grading scale and fixes the pass forecast, which the profile's chart would otherwise expose.

### Decisions

| Topic | Decision |
|---|---|
| Student messages | Seeded as ordinary `message` evidence with a story day, so the agents read and cite them through `get_evidence` |
| Class FAQ | Authored in the seed data, never generated: no tokens |
| FAQ place | Classroom tab, above the heatmap |
| Profile | One modal, opened from the classroom, chat citations, the FAQ log and the student panel |
| Profile contents | Forecast chart, messages, the teacher's AI chats, phone practice, interventions, previous subjects and GPA |
| Grade scale | 10-point everywhere: pass 4.0, Khá 7.0, Giỏi 8.5 |
| Forecast | Standing from mastery and the latest mark, plus a gain scaled by planned and done study time |

## 2. Data

### 2.1 Lectures (`src/scenario/course.ts`)

```ts
interface Lecture { n: number; title: string; day: number; concepts: ConceptId[] }
export const LECTURES: Lecture[];
```

One lecture a week, on Tuesday from 09:00 to 11:00 (day `7 × (n − 1) + 1`), Lectures 1–9:

| n | Day | Title | Concepts |
|---|---|---|---|
| 1 | 1 | Propositions | propositions |
| 2 | 8 | Negation, conjunction, disjunction | negation, conjunction, disjunction |
| 3 | 15 | Truth tables | truthTables |
| 4 | 22 | Biconditionals and compound expressions | biconditional, expressions |
| 5 | 29 | Implication | implication |
| 6 | 36 | Logical equivalence and De Morgan | equivalence, deMorgan |
| 7 | 43 | Equivalence laws | equivLaws |
| 8 | 50 | Logic in real problems | applications |
| 9 | 57 | Revision | (none) |

De Morgan sits in Lecture 6 because Quiz 2 on day 38 tests it, and a quiz cannot test a concept taught after it.

`lectureLabel(day, time)` returns the position relative to the nearest lecture before it: "during Lecture 5" for a message sent that day between 09:00 and 11:00, "2 hours after Lecture 5" on the same day, "1 day after Lecture 5", and "before Lecture 1" when no lecture came first.

### 2.2 Question log (`src/scenario/voice.ts`)

```ts
interface VoiceEntry {
  id: string;                 // v1, v2, …
  studentIndex: number;
  channel: 'zalo' | 'email' | 'whatsapp' | 'forum';
  day: number;
  time: string;               // HH:MM
  vi: string | null;          // the original, when written in Vietnamese
  gist: string;               // English, one line
  concept: ConceptId;
  faqId: string;
}
export const VOICE: VoiceEntry[];   // about 50, days 1–39
```

- About 50 entries spread across the 55 students, the four channels and Lectures 1–6. More than half are in Vietnamese. Most come within 2 days after the lecture on their concept.
- Each entry becomes `message` evidence on its student, with id `<studentId>-voice-<id>`, `source` set to the channel name ("Zalo", "Email", "WhatsApp", "LMS forum"), and `text` written as `“<vi>” (<gist>)` when there is an original, or the gist alone.
- `Evidence` gains `day?: number` and `time?: string`. Log messages set both, and the existing `when` label stays.
- Minh Anh's two Zalo messages (`MESSAGES` m1 and m4 in `sources.ts`) move into the log. They keep their evidence ids, `s17-zalo-1` and `s17-zalo-2`, so existing citations and evals still work: an entry's evidence id is `<studentId>-<slug>`, and these two use the slugs `zalo-1` and `zalo-2`. The email extra in `roster.ts` (index 26, De Morgan) moves in the same way with slug `email`. The WhatsApp extra (index 41, "No reply to two check-in messages") is not a student question and stays where it is.
- Practice evidence also gains `day`, so the profile's Practice tab can date it.

### 2.3 FAQ (`src/scenario/voice.ts`)

```ts
interface FaqEntry { id: string; question: string; confusion: string; concept: ConceptId }
export const FAQ: FaqEntry[];   // about 6
```

- Example: "Why is p → q not the same as q → p?", with the confusion "Treat implication as symmetric". Concept: implication.
- `faqStats(faqId)` computes the figures from the log, so they always agree with it: message count, distinct students, the latest day, and the lecture timing. The timing is the most common `lectureLabel` bucket, for example "mostly 1–2 days after Lecture 5".
- FAQ rows are ordered by distinct students, most first.

### 2.4 Academic history (`src/scenario/roster.ts`)

```ts
StudentProfile.history: { subject: string; term: string; grade: number; letter: string }[];   // 10-point grade
StudentProfile.gpa: number;   // 4-point, from history
```

- Every student gets 3–5 previous subjects from two earlier terms, seeded from their index and status the same way `baseEvidence` is.
- The conversion follows the usual Vietnamese mapping: 8.5–10 A (4.0), 8.0–8.4 B+ (3.5), 7.0–7.9 B (3.0), 6.5–6.9 C+ (2.5), 5.5–6.4 C (2.0), 5.0–5.4 D+ (1.5), 4.0–4.9 D (1.0), below 4.0 F (0). The GPA is the credit-weighted mean, with all subjects worth 3 credits.
- Minh Anh's history includes Intro to Logic at 6.8 (C+), which matches the existing `s17-records` entry.

### 2.5 Forecast and the 10-point scale (`src/live/study/estimate.ts`)

The forecast replaces `passEstimate` and its 0–100 score.

```ts
export const PASS = 4.0, KHA = 7.0, GIOI = 8.5;
export function forecast(student, rec): { value: number; band: PassBand };              // where the student stands now, 0–10
export function projection(student, rec, today): number;                                 // the exam, if the plan is kept
```

- **Forecast (standing)** = 0.6 × (10 × mastery weighted by CLO exam share) + 0.4 × (latest mark ÷ 10), rounded to one decimal. The latest mark is the newest of `rec.marks`, or Quiz 2 when there is none. The band and every figure the app shows come from the forecast. It rises as practice raises mastery, and a Quiz 3 drop lowers it.
- **Projection** = min(10, forecast + gain), where gain = 2.0 × min(1, planned minutes to the exam ÷ `minutesNeeded`) × done rate. The done rate is self-study minutes done ÷ minutes planned over the last 7 closed days, or 1 before any day has closed. With no plan the projection equals the forecast. It appears as the dashed line on the profile chart, in the teacher's Road to the exam and as "if the plan is kept" in agent copy, never as the band. The phone does not show it.
- Why the split: a plan that is only promised must not change the band. Minh Anh stands at 4.4 (At risk) at setup whatever time is reported; the projection shows what the plan could add.
- **Bands:** Likely ≥ 5.0, At risk 3.5–4.9, Unlikely < 3.5. `PassBand` keeps its three names.
- **History:** `StudyRecord.forecasts: { day: number; value: number }[]` holds forecast points. A point is added after each plan is applied (setup and replans) and at each day's close. Every student also has two seeded points, on the days of Quiz 1 and Quiz 2, computed from those marks and the seed mastery. Students who never use the phone therefore still have a line.

## 3. Rules (pure)

- `forecast` and `projection` as above. A plan alone never changes the forecast. Reporting more time raises the projection until the plan covers the minutes needed. Skipping planned work lowers the done rate and so the projection. A Quiz 3 drop lowers both.
- `lectureLabel` as in 2.1.
- `faqStats` as in 2.3.
- `gpaOf(history)` and `letterOf(grade)` as in 2.4.
- `detectSignal`'s `bandChange` uses the new bands, and its `markSwing` still compares quiz percentages (15 points).

## 4. Where the scale changes

Everything that shows or reads the 0–100 estimate moves to the 10-point forecast:

- The phone's Road to the exam and semester screens, and the student copy in `studyView.ts` and `cannedStudy.ts`.
- The teacher's Road to the exam panel in the student panel.
- `examRisk` and the "May not pass" attention row.
- The study planner prompt in `study.ts`: "Forecast: 4.4 out of 10 (At risk); 6.4 if the current plan is kept; the pass mark is 4.0."
- `get_exam_outlook` and `get_student` in `server/agents/tools.ts`.
- Quiz and assessment marks stay as percentages everywhere, as the course reports them.

## 5. Teacher UI

### 5.1 Quotes in answers (`src/teacher/LiveText.tsx`)

- When a block cites `message` evidence, a quote card shows under the block. It holds the original text (Vietnamese where there is one), the English gist, and a line such as "Zalo · Minh Anh · Wed 21 Oct · 1 day after Lecture 5".
- At most 2 quote cards per block. Any further cited messages stay as chips.
- Clicking a quote card opens the profile pop-up on the Messages tab, at that entry.
- Other citations stay as chips. A chip for student evidence now opens the pop-up (5.4) instead of the side panel. A chip for class evidence still opens the class panel.

### 5.2 "In their words" (`src/teacher/LivePanel.tsx`)

- A section in the student panel right under the headline figures, above concept mastery.
- It shows the latest 3 entries of kind `message` or `taNote`, each with source, text and the lecture label where there is one, plus a "See all" link that opens the pop-up on the Messages tab.
- It is hidden when the student has none.

### 5.3 "What students are asking" (`src/teacher/Classroom.tsx`)

- A section above the heatmap. Each row shows the question, "14 students · 19 messages", the concept, and the lecture timing.
- Clicking a row expands its log, newest first. Each log row shows the student's name (clicking it opens the pop-up), the channel, the original and the gist, the date and time, and the lecture label, for example "2 days after Lecture 5 · Implication".
- One row is open at a time. The open row is local UI state.

### 5.4 Student profile pop-up (new `src/teacher/StudentProfile.tsx`)

**Opened from:** a roster row or the student card on the Classroom tab (replacing today's small card), a chat citation chip or quote card, an FAQ log row, and "See all" in the student panel. The live context gains `openProfile(studentId, entryId?)`. The open profile is local UI state in the teacher screen: it is not sent to the server or the phone, and opening it costs no tokens.

**Layout:** a large modal over the teacher screen. Esc, Close or a click outside it returns to where the teacher was.

- **Header:** avatar, name, group, band chip, GPA, and "Ask about <name>" (the existing `askStudent` action).
- **Forecast chart:** an SVG line chart on 0–10 across the course days.
  - Solid line: the forecast history. Dashed line: from today's forecast to `projection` on exam day.
  - Horizontal lines: Pass 4.0, Khá 7.0, Giỏi 8.5. Markers: quizzes, assessments and the exam, plus interventions (a pathway sent, a check-in booked, and a focus approved once that plan kind exists).
  - No projection without a study record.
- **Tabs:**
  - **Messages:** every `message` entry, newest first, with channel, original and gist, date and time, and the lecture label. Empty state: "No messages yet".
  - **AI chats:** the teacher's conversations whose panel or plans name this student, each showing the title and the first question (conversations carry no date). Clicking one closes the pop-up and opens that conversation.
  - **Practice:** phone sessions as a timeline: date, session title, concept, questions right, and tries per question once the quiz attempts spec is built (until then: right first try or not). Empty state: "No practice on the phone yet".
  - **Interventions:** pathways and check-ins naming this student (and focus plans, once the quiz attempts spec adds them), with status, date and outcome. Pathways also show the mastery change against their baseline.
  - **Record:** previous subjects, with term, grade and letter, and the GPA.
  - **All evidence:** every entry, newest first, as in the student panel. A citation of a quiz, LMS, attendance or TA-note entry opens here, since no other tab holds those.
- Opened with an entry id, the pop-up shows the tab that holds the entry, scrolled to it and highlighted. An entry id that no longer exists (after a reset) opens the first tab.

## 6. Agents

- `get_evidence` already returns all evidence kinds, so the new messages reach the agents with no new tool. Its output includes the lecture label for message entries.
- New read tool `get_class_questions`: the FAQ entries with their stats and the evidence ids of their log entries, so a class answer can cite real student questions. These ids belong to students, so `checkBlocks` already accepts them. A class answer's chip for one of them opens the student's pop-up.
- `get_student` adds GPA, previous subjects and the forecast.
- SAS prompt: when a student's own words explain a gap, cite the message.
- No new agent runs. Each `get_evidence` call returns more text, so it costs slightly more input tokens.

## 7. Errors and edge cases

- No messages: "In their words" is hidden, and the Messages tab shows its empty state.
- No study record: the chart shows the seeded points only, with no projection.
- A missing entry id opens the first tab (5.4).
- An FAQ with no log entries is a seed error, caught by the seed tests (8).

## 8. Testing

- **Rules:** `forecast` (a plan alone changes nothing, a Quiz 3 drop lowers it) and `projection` (reported time, work done, no plan, the cap at 10), band cut-offs at 3.5 and 5.0, `gpaOf` and `letterOf` at each boundary, and `lectureLabel` (during, hours after, days after, before Lecture 1).
- **Seed:** every log entry points at a real student, concept and FAQ, and every FAQ has entries. Minh Anh's Zalo ids are unchanged, and Minh Anh's Intro to Logic grade matches `s17-records`.
- **UI:** quote cards render for `message` citations only, at most 2 per block. "In their words" sits above mastery and hides when empty. The FAQ sits above the heatmap and expands one row at a time. The pop-up opens from all four entry points, on the right tab and entry. The click audit covers the new buttons.
- **Existing tests:** every test reading the 0–100 estimate moves to the 10-point forecast, including Task 4's rules tests and `examRisk`.
- **Evals (real API):** L6.7 moves to the 10-point scale. L2.1 adds "cites a Zalo message". A new L2.7 asks "What are students confused about after Lecture 5?" and expects at least one cited log entry and the implication FAQ named.

## 9. Out of scope

Students writing new messages during the story, generating the FAQ with an agent, teacher replies to messages, exporting a profile, and the shared intervention record (Lesson planning spec).
