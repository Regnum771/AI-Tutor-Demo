# Lesson Planning Tab and Resource Library: Design

Date: 2026-11-01. Status: awaiting user review. Builds on `main` (student voice, calendar and revision). This is sub-project A of Lesson planning. B (one shared intervention record with check dates, results and keep/change/escalate decisions) and C (new intervention kinds: plan on the next lecture, send readings, exit tickets, agent-drafted messages, 1:1 talking points, TA clinics, peer pairing) get their own specs later.

## 1. Goal

Give the teacher one place to plan the coming lectures: which concepts the class has, how that changed over the term, and what learning material each lecture has and who has used it. The live app has no learning materials today; they appear only in the video's "fragmented" desktop.

### Decisions

| Topic | Decision |
|---|---|
| Scope | Sub-project A only: the tab, the seeded resource library with engagement, class mastery over time |
| Placement | A new live-only "Lesson planning" teacher tab; the Calendar's lecture details reuse its materials list |
| Phone | Unchanged; the library is teacher-side only (sending readings is sub-project C) |
| Links | None; readings name a textbook section, never a URL |
| Agents | One new read tool; they cite resources only by library id |
| Interventions on the timeline | The existing approved, sent and done plans; full records come with B |

## 2. Data

### 2.1 Resource library (`src/scenario/materials.ts`)

```ts
type ResourceKind = 'slides' | 'recording' | 'worksheet' | 'reading' | 'video';
type ResourceBloom = Exclude<Bloom, 'Create'>;   // course.ts Bloom without Create

interface Resource {
  id: string;                // "l5-slides", "l5-recording", …
  lecture: number;           // LECTURES n
  kind: ResourceKind;
  title: string;             // "Lecture 5 · Implication.pdf"
  concepts: ConceptId[];     // a subset of that lecture's concepts; the Lecture 9 revision sheet covers all 12
  bloom: ResourceBloom;
  minutes: number;           // length, or expected time to work through
  source: string;            // "Course slides", "Recording", "Rosen §1.1", "Worksheet"
}
export const RESOURCES: Resource[];
export const resourcesFor: (lecture: number) => Resource[];
```

- Every lecture 1–8 has slides, a recording and a worksheet. Lectures 3, 5, 6 and 7 also have one reading or short video. Lecture 9 (revision) has a revision sheet. That makes 29 resources.
- The titles "Lecture 5 · Implication.pdf", "Worksheet · Truth tables" (Lecture 3) and "Lecture 5 recording" match the video's Learning Materials window.
- Bloom levels follow the material: slides and recordings are Remember or Understand, worksheets Apply, readings Understand or Analyze.
- Fictional data. A reading names a textbook section and has no link.

### 2.2 Engagement (`src/scenario/materials.ts`)

```ts
export function engagement(resourceId: string, studentIndex: number, today = START_DAY): { opened: boolean; fraction: number };   // fraction 0–1
export function classEngagement(resourceId: string, today = START_DAY): { opened: number; of: number; meanFraction: number };   // meanFraction among those who opened it
```

- Seeded deterministically from the student's index and status, the same way the other seed data is built. On-track students open most material; high-risk and disengaged students open less and watch less of it.
- A student opens a resource from the day after its lecture, up to 4 days late, so engagement fills in as the story moves on. Resources for lectures after today have no engagement (nobody opened them yet). `classEngagement` reports 0 of 55.
- Minh Anh: the Lecture 5 recording is opened, 22% watched, as in the video; nothing from Lecture 6 (the LMS log's last login was 6 days before day 40).
- The index-7 quiet disengager opened nothing after Week 4, matching that student's LMS evidence.

### 2.3 Class mastery over time (`src/live/history.ts`)

```ts
export function seededHistory(students: StudentProfile[]): Record<ConceptId, { day: number; value: number }[]>;   // weekly, days 0–35, and day 40
DemoState.masteryHistory: Record<ConceptId, { day: number; value: number }[]>;   // live points from day 40
export function noteClassMastery(s: DemoState): void;   // appends today's class average per concept
```

- **Seeded, Weeks 1–6:** one point per week per concept, and a last point on day 40 that meets the live line. A concept sits at 0.20 before its lecture and rises linearly to the class's seed average for that concept, reached two weeks after the lecture or on day 40, whichever is first. The chart computes it from the seed roster, so the past never moves.
- **Live, from day 40:** `advance` calls `noteClassMastery` at each day's close, after forgetting, stamped with the new day as the forecast points are (the first live point is day 41). A concept not lectured yet stays at 0.20. Practice and forgetting on the phone therefore move the line slightly.
- `seedState` starts `masteryHistory` empty; the chart joins the seeded and live points.

## 3. The Lesson planning tab (`src/teacher/LessonPlanning.tsx`, live only)

A "Lesson planning" item in the teacher sidebar after Calendar, shown only in the live booth. The `View` type gains `'planning'`. The scripted video's sidebar is unchanged. Three parts, top to bottom:

### 3.1 Knowledge graph

- An SVG of the 12 concepts at their `CONCEPTS` x/y positions, joined by the `EDGES` prerequisite lines.
- Each node is filled by class average mastery on the heatmap's scale, with the value under its label. Nodes below 0.50 are drawn with the gap marking the heatmap uses.
- A concept not yet lectured is greyed and labelled with its lecture and date ("Lecture 7 · Tue 3 Nov").
- Clicking a node selects that concept; clicking it again clears the selection. The selection filters 3.2 and 3.3.

### 3.2 Mastery over time

- A line chart (`src/teacher/MasteryChart.tsx`) of class average mastery, 0–1, from Week 1 to the exam, for the selected concept, or for logical equivalence (the Week 6 topic) when nothing is selected.
- A dashed line at 0.50 (the gap line). Ticks on lecture days, labelled with the lecture number.
- Intervention markers on their own row along the top, the same pattern as the forecast chart: pathways sent, class activities approved, check-ins booked, on their plan dates.

### 3.3 Upcoming lectures

- The next three lectures from today (by `nextLecture` and the two after it), each with its date, its concepts and its resources. With a concept selected, only lectures teaching it are listed, plus the lecture it was taught in.
- Each resource row: kind, title, Bloom level, minutes, source, and the class engagement ("31 of 55 opened · 46% watched on average"; future lectures read "Not released yet").
- Clicking a resource row expands it into the students who have not opened it, each name opening the profile pop-up (`openProfile`). Before its lecture the row instead says nobody can open it yet.
- A "Past lectures" toggle lists earlier lectures the same way, newest first.

### 3.4 Shared component

`ResourceList({ lecture })` renders a lecture's resources with engagement and the expandable not-opened list. The Lesson planning tab and the Calendar's lecture details both use it.

## 4. Calendar

A lecture's details in the Calendar tab, which today list the student questions placed after it, also show `ResourceList` for that lecture, above the questions.

## 5. Agents

- New read tool `get_lecture_materials { lecture: number (or -1), concept: string (or ""), student_id: string (or "") }`. It returns the matching resources with id, lecture and its date, kind, title, concepts, Bloom level, minutes, source, `released` and `classEngagement`; with a student id, each resource also carries that student's `opened` and `fraction`.
- SAS prompt: "Cite learning material only by the ids get_lecture_materials returns. Never invent a link, a book or a resource." The agents recommend only released resources, since nobody can open the others before their lecture.
- **Citations:** `checkBlocks` accepts resource ids as well as evidence ids, so an unknown resource id is rejected like an unknown evidence id. In an answer, a resource chip reads "Slides · Lecture 7" (kind and lecture). Clicking it opens the Lesson planning tab with that resource's row expanded, through a new `LiveCtx.openPlanning(resourceId)`.
- `get_evidence` is unchanged.
- No new agent runs.

## 6. Errors and edge cases

- A lecture not given yet has no engagement: its rows read "Not released yet" and expand to a note instead of a "not opened" list.
- Before any live day has closed, the chart shows the seeded points only.
- `get_lecture_materials` with an unknown lecture, concept or student id throws a message the agent can act on, as the other tools do.

## 7. Testing

- **Seed:** every resource points at a real lecture, its concepts belong to that lecture, its Bloom level is valid and ids are unique; every lecture 1–9 has resources; Minh Anh's Lecture 5 recording is opened at 0.22; index 7 opened nothing after Week 4; future lectures have no engagement.
- **History:** seeded values stay in 0–1 and sit at 0.20 before each concept's lecture; `noteClassMastery` adds one point per concept per closed day.
- **Tab:** the graph renders 12 nodes and the edges, untaught concepts greyed with their lecture date, gaps marked; selecting a concept changes the chart's series and filters the lectures; engagement text matches `classEngagement`; expanding a resource lists exactly the students who have not opened it, and a name opens the pop-up. Live-only: the scripted sidebar has no "Lesson planning" item.
- **Calendar:** a lecture's details show its resources.
- **Agents:** tool tests for filters and the per-student fields; `checkBlocks` accepts a real resource id and rejects an unknown one; a resource chip opens the tab with its row expanded; the click audit gains a "lesson planning" scenario.
- **Eval (real API):** new L2.8, "What should students read before Lecture 7?", expects cited resource ids that exist in the library, all released at that point (nothing is recommended that nobody can open yet), and no URL in the answer.

## 8. Out of scope

Sending readings or anything else to students (sub-project C), the shared intervention record (B), editing the library, real links or files, and any phone change.
