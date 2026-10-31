# Live Booth App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the scripted Beyond demo into a live booth app: two real Claude agents answer the teacher from fictional class data and draft plans; approved pathways reach a real phone; phone answers update mastery live and trigger an adapt step.

**Architecture:** A small Hono server (`server/`) holds one in-memory `DemoState`, runs the agents with the Anthropic SDK (manual tool-use loop), and pushes the full state over SSE after every change. Pure shared code in `src/live/` (types, reducers, plan checks, snapshot → timeline translation) is used by both server and clients. The live teacher window turns each snapshot into the existing `TeacherEvent` timeline, so `teacherFrame`/`TeacherScreen` keep rendering; components that need live data read it from a React context that is empty in scripted (video) mode. The phone gets a `?live` mode driven by `PhoneState` and real taps.

**Tech Stack:** TypeScript (strict), React 18, Vite 5, Tailwind 3, Vitest 2 (+ happy-dom and Testing-Library-free `react-dom/client` + `act` for click audits), Hono 4 + `@hono/node-server`, `@anthropic-ai/sdk` 1.3.0, `tsx`, `concurrently`, `qrcode`.

**Spec:** `docs/superpowers/specs/2026-10-31-live-booth-app-design.md`

## Global Constraints

- Language: English everywhere (UI copy, agent prompts, practice bank).
- Default model `claude-sonnet-5-5`, overridable with `BEYOND_MODEL`; effort from `BEYOND_EFFORT` (default `medium`).
- Every model request: non-streaming, `timeout: 25_000`, `maxRetries: 1`, system prompt as one text block with `cache_control: { type: 'ephemeral' }`, `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`, `tool_choice` left at `auto` (forced tool choice returns 400 on this model), tools `strict: true` with `additionalProperties: false`.
- Agent loop: at most 8 tool turns; one retry for an invalid finish-tool input; one nudge if a turn ends without the finish tool.
- Policy: pathway 2–4 sessions, ≤ 45 minutes total, every session concept in the practice bank, last session is the mastery check; follow-up auto-approved only when ≤ 3 sessions; check-ins ≤ 5 students; "Today" session times must be after the story clock.
- Story clock starts 15:00 (`STORY_START = 900`); finishing a mastery check moves it to 20:40 (`TONIGHT = 1240`).
- Mastery rule: correct first try moves the concept 30% toward 0.9; correct after a hint 15%; wrong leaves it. Status bands on logical-equivalence mastery: high risk < 0.42 ≤ support < 0.60 ≤ on track.
- Scripted video mode (`teacher.html?scene=N`, `student.html?scene=N`, Director playback, contact sheet) must behave exactly as before; every existing test must keep passing unchanged.
- No CSS animations/transitions in teacher components; motion is computed from time.
- Never infer student pronouns in generated copy: use the student's name (prompts tell the agents the same).
- Instrument Serif has no Vietnamese glyphs: student-name titles use the sans face (`sansTitle`).
- Every visible live-mode control is live, routed to the agents, or decorative with the "Not part of this demo" toast (spec §2.6).
- `.env.local` holds `ANTHROPIC_API_KEY` and is git-ignored. `BEYOND_OFFLINE=1` forces canned answers.

## Before you start

The branch `sc1-clutter` has uncommitted video work (30 modified files plus `src/ui/theme.tsx`). Do not mix it into this work. Ask the user whether to commit it on `sc1-clutter` first; then create the working branch from that commit:

```bash
git switch -c live-booth
```

(or use superpowers:using-git-worktrees for an isolated worktree). Run `npm install` and `npm test` once to confirm a green baseline before Task 1.

## File map

**Shared (pure, used by server and clients)**
- `src/live/types.ts` — `DemoState` and everything in it (students, evidence, plans, conversations, phone).
- `src/live/clock.ts` — story clock constants, `fmt`, `parseTime`.
- `src/live/mastery.ts` — mastery rule, status bands, class KPIs, `liveStudents`.
- `src/live/plans.ts` — policy constants and `planProblems`.
- `src/live/seed.ts` — `seedState`, `IDLE_PHONE`.
- `src/live/reducer.ts` — pure state transitions (approve, edit, dismiss, phone flow, delivery).
- `src/live/fixtures.ts` — test fixtures (`planFor`, `stateWithPlan`).
- `src/live/events.ts` — `SeenClock`, `keysOf`, `liveEvents` (snapshot → `TeacherEvent[]`).
- `src/live/source.ts` — `DemoSource`, `useServerSource` (SSE), `postJson`.
- `src/live/LiveContext.tsx` — `LiveProvider`, `useLive`, `DEMO_ONLY`.
- `src/scenario/roster.ts` — seeded 55-student profiles and class evidence.
- `src/scenario/practiceBank.ts` — canned practice items for the 12 concepts.
- `src/teacher/route.ts` — `routePrompt` and canned topic titles/follow-ups (moved out of the JSX file so the server can import it).

**Server**
- `server/env.ts` — loads `.env.local`.
- `server/agents/client.ts` — `MessagesClient`, `anthropicClient`, `request`.
- `server/agents/loop.ts` — `runAgent`, `AgentSpec`, `AgentError`.
- `server/agents/fakeClient.ts` — scripted fake for tests.
- `server/agents/tools.ts` — SAS read tools, executors, thinking-line labels.
- `server/agents/sas.ts`, `server/agents/tas.ts`, `server/agents/adapt.ts` — the three agent specs.
- `server/agents/canned.ts` — offline answers, plans and adapt.
- `server/agents/orchestrate.ts` — `answer` and `adaptAfterCheck`.
- `server/session.ts` — `DemoSession` (state, subscribers, commands, background runs).
- `server/app.ts` — Hono routes and SSE; `server/index.ts` — process entry.
- `server/live.smoke.ts` — optional real-API smoke check.

**Clients**
- Modify `src/teacher/frame.ts` (live fields), `src/teacher/TeacherScreen.tsx`, `src/teacher/ContextPanel.tsx`, `src/teacher/Classroom.tsx`, `src/teacher/LiveTeacher.tsx`, `src/teacher/conversations.tsx`.
- Create `src/teacher/LiveText.tsx`, `src/teacher/LivePanel.tsx`.
- Modify `src/student/main.tsx`, `src/student/screens/LockScreen.tsx`, `PlanScreen.tsx`, `ProgressScreen.tsx`, `PracticeScreen.tsx` (export only).
- Create `src/student/LivePhone.tsx`, `src/student/screens/LivePractice.tsx`.
- Create `src/controller/BoothPanel.tsx`; modify `src/controller/ControllerApp.tsx`.
- Modify `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `README.md`; create `.env.local.example`.

---

### Task 1: Live state types, story clock and mastery rules

**Files:**
- Create: `src/live/types.ts`, `src/live/clock.ts`, `src/live/mastery.ts`
- Modify: `src/scenario/classroom.ts` (add `groupOf`), `src/teacher/Classroom.tsx:17-18` (import `groupOf` instead of defining it)
- Test: `src/live/core.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - types `Mastery`, `EvidenceKind`, `Evidence`, `StudentProfile`, `PlanKind`, `PlanStatus`, `PlanSession`, `Plan`, `LiveBlock`, `LivePanel`, `AssistantMsg`, `ChatMsg`, `Conversation`, `PhoneScreen`, `PhoneState`, `DemoState` (exact shapes below)
  - `STORY_START = 900`, `TONIGHT = 1240`, `fmt(minutes): string`, `parseTime(s): number | null`
  - `TARGET`, `GAIN_FIRST_TRY`, `GAIN_AFTER_HINT`, `afterAnswer(value, correct, hinted): number`, `topicMastery(m): number`, `statusFor(m): Status`, `ClassKpis`, `classKpis(students): ClassKpis`, `liveStudents(state): Student[]`
  - `groupOf(index): string` from `src/scenario/classroom.ts`

- [ ] **Step 1: Write the failing test**

Create `src/live/core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STUDENTS, groupOf } from '../scenario/classroom';
import { MASTERY_INITIAL } from '../scenario/minhAnh';
import { fmt, parseTime, STORY_START, TONIGHT } from './clock';
import { afterAnswer, statusFor, topicMastery } from './mastery';

describe('story clock', () => {
  it('formats and parses HH:MM', () => {
    expect(fmt(STORY_START)).toBe('15:00');
    expect(fmt(TONIGHT)).toBe('20:40');
    expect(fmt(9 * 60 + 5)).toBe('09:05');
    expect(parseTime('19:30')).toBe(19 * 60 + 30);
    expect(parseTime(' 07:00 ')).toBe(420);
    expect(parseTime('7pm')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
  });
});

describe('mastery rule', () => {
  it('moves a correct answer toward 0.9, less after a hint, not at all when wrong', () => {
    expect(afterAnswer(0.3, true, false)).toBe(0.48);
    expect(afterAnswer(0.3, true, true)).toBe(0.39);
    expect(afterAnswer(0.3, false, false)).toBe(0.3);
    expect(afterAnswer(0.3, false, true)).toBe(0.3);
  });
  it('bands status on logical equivalence', () => {
    const m = (equivalence: number) => ({ ...MASTERY_INITIAL, equivalence });
    expect(topicMastery(m(0.5))).toBe(0.5);
    expect(statusFor(m(0.41))).toBe('highRisk');
    expect(statusFor(m(0.42))).toBe('support');
    expect(statusFor(m(0.59))).toBe('support');
    expect(statusFor(m(0.6))).toBe('onTrack');
  });
  it('the roster statuses already agree with the bands', () => {
    for (const s of STUDENTS) expect(statusFor({ ...MASTERY_INITIAL, equivalence: s.mastery }), s.name).toBe(s.status);
  });
});

describe('groupOf', () => {
  it('puts Minh Anh (index 16) in G4', () => {
    expect(groupOf(16)).toBe('G4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/live/core.test.ts`
Expected: FAIL — cannot resolve `./clock` / `groupOf` is not exported.

- [ ] **Step 3: Add `groupOf` to the scenario and use it in Classroom**

In `src/scenario/classroom.ts`, after the `GROUPS` line, add:

```ts
/** Tutorial group per student index (Minh Anh, index 16, sits in G4). */
export const groupOf = (i: number) => GROUPS[(i + 2) % GROUPS.length];
```

In `src/teacher/Classroom.tsx`, replace

```ts
import { COMPLEX, GROUPS, HEATMAP, SCALE_STUDENTS, STUDENTS, TOPICS, type Student } from '../scenario/classroom';
```

with

```ts
import { COMPLEX, GROUPS, HEATMAP, SCALE_STUDENTS, STUDENTS, TOPICS, groupOf, type Student } from '../scenario/classroom';
```

and delete these two lines:

```ts
/** Group assignment (Minh Anh sits in G4, matching the student panel). */
export const groupOf = (i: number) => GROUPS[(i + 2) % GROUPS.length];
```

- [ ] **Step 4: Write `src/live/types.ts`**

```ts
import type { Status } from '../scenario/classroom';
import type { ConceptId } from '../scenario/knowledgeGraph';

export type Mastery = Record<ConceptId, number>;

export type EvidenceKind = 'quiz' | 'activity' | 'attendance' | 'message' | 'taNote' | 'record' | 'practice';

export interface Evidence {
  /** Stable id the agents cite: `<studentId>-<slug>` for a student, `class-<slug>` for the class. */
  id: string;
  kind: EvidenceKind;
  source: string;
  text: string;
  /** Story-time label, e.g. "Week 6" or "17:04". */
  when: string;
  concept?: ConceptId;
}

export interface StudentProfile {
  index: number;
  id: string;
  name: string;
  /** Name for copy: the given name, or "Minh Anh". */
  short: string;
  group: string;
  status: Status;
  /** On the teacher's escalation list (the "Needs you" band). */
  escalated: boolean;
  mastery: Mastery;
  quiz: { q1: number; q2: number };
  practicePerWeek: number;
  evidence: Evidence[];
}

export type PlanKind = 'pathway' | 'classActivity' | 'checkIns';
export type PlanStatus = 'proposed' | 'approved' | 'sent' | 'done' | 'autoApproved' | 'dismissed';

export interface PlanSession {
  /** HH:MM, 24-hour. */
  time: string;
  title: string;
  minutes: number;
  concept: ConceptId | null;
  isMasteryCheck: boolean;
  /** checkIns: who the slot is with. */
  studentId: string | null;
}

export interface Plan {
  id: string;
  kind: PlanKind;
  title: string;
  /** pathway: one id; classActivity: the affected students; checkIns: one per session. */
  studentIds: string[];
  /** "Today", "Tomorrow" or a weekday. Only "Today" sessions must fall after the story clock. */
  day: string;
  sessions: PlanSession[];
  rationale: string;
  outcome: string;
  status: PlanStatus;
  conversationId: string;
}

export interface LiveBlock {
  kind: 'p' | 'li';
  /** Plain text; `**bold**` spans allowed. */
  text: string;
  /** Evidence ids behind the block. */
  cites: string[];
}

export type LivePanel =
  | { kind: 'student'; studentId: string; planId: string | null; highlight: string | null }
  | { kind: 'class'; planId: string | null }
  | { kind: 'checkIns'; planId: string };

export interface AssistantMsg {
  role: 'assistant';
  /** agents: written by SAS/TAS; offline: canned fallback; system: fixed confirmation copy. */
  source: 'agents' | 'offline' | 'system';
  blocks: LiveBlock[];
  /** Offline answers reuse the draft's canned topic copy. */
  canned: 'student' | 'class' | 'attention' | 'fallback' | null;
  followUps: string[];
  panel: LivePanel | null;
  stamp: string | null;
}

export type ChatMsg = { role: 'teacher'; text: string } | AssistantMsg;

export interface Conversation {
  id: string;
  title: string;
  /** Titles with Vietnamese names use the sans face. */
  sansTitle: boolean;
  msgs: ChatMsg[];
  /** Agent steps while a run is in flight. */
  pending: { steps: string[] } | null;
}

export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'progress';

export interface PhoneState {
  planId: string | null;
  screen: PhoneScreen;
  session: number | null;
  item: number;
  hinted: boolean;
  result: 'right' | 'wrong' | null;
  lastOption: number | null;
  done: number[];
  /** Mastery when the current plan arrived, for the progress screen. */
  before: Mastery | null;
  /** The plan whose mastery check finished last (the progress screen's subject). */
  lastDone: string | null;
  /** The plan was replaced by an auto-approved follow-up. */
  updated: boolean;
}

export interface DemoState {
  /** Bumped on reset so clients drop what they remember. */
  epoch: number;
  /** Story clock, minutes after midnight. */
  clock: number;
  students: StudentProfile[];
  classEvidence: Evidence[];
  plans: Plan[];
  conversations: Conversation[];
  phone: PhoneState;
  busy: boolean;
}
```

- [ ] **Step 5: Write `src/live/clock.ts`**

```ts
/** Story time at the start of the demo: the teacher logs in at 15:00. */
export const STORY_START = 15 * 60;
/** Story time after the mastery check (the Sc8 "that evening" moment). */
export const TONIGHT = 20 * 60 + 40;

export const fmt = (m: number): string =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "HH:MM" → minutes after midnight, or null when malformed. */
export function parseTime(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
```

- [ ] **Step 6: Write `src/live/mastery.ts`**

```ts
import { STUDENTS, type Status, type Student } from '../scenario/classroom';
import type { DemoState, Mastery, StudentProfile } from './types';

export const TARGET = 0.9;
export const GAIN_FIRST_TRY = 0.3;
export const GAIN_AFTER_HINT = 0.15;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** A correct answer moves the item's concept part of the way toward TARGET; a wrong one leaves it. */
export function afterAnswer(value: number, correct: boolean, hinted: boolean): number {
  if (!correct) return value;
  return round2(value + (TARGET - value) * (hinted ? GAIN_AFTER_HINT : GAIN_FIRST_TRY));
}

/** Week 6 is logical equivalence: the Classroom's per-student figure. */
export const topicMastery = (m: Mastery): number => m.equivalence;

/** The bands the roster was built with: high risk < 0.42 ≤ support < 0.60 ≤ on track. */
export function statusFor(m: Mastery): Status {
  const v = topicMastery(m);
  return v < 0.42 ? 'highRisk' : v < 0.6 ? 'support' : 'onTrack';
}

export interface ClassKpis {
  students: number;
  needSupport: number;
  highRisk: number;
  escalated: number;
  avgMastery: number;
}

export function classKpis(students: StudentProfile[]): ClassKpis {
  const sum = students.reduce((a, s) => a + topicMastery(s.mastery), 0);
  return {
    students: students.length,
    needSupport: students.filter((s) => s.status !== 'onTrack').length,
    highRisk: students.filter((s) => s.status === 'highRisk').length,
    escalated: students.filter((s) => s.escalated).length,
    avgMastery: round2(sum / students.length),
  };
}

/** Live profiles in the Classroom's `Student` shape (tracks stay as scripted). */
export const liveStudents = (state: DemoState): Student[] =>
  state.students.map((p) => ({
    index: p.index, id: p.id, name: p.name, status: p.status, mastery: topicMastery(p.mastery), track: STUDENTS[p.index].track,
  }));
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/live/core.test.ts`
Expected: PASS (6 tests).

Run: `npm test`
Expected: PASS (everything that passed before still passes).

- [ ] **Step 8: Commit**

```bash
git add src/live src/scenario/classroom.ts src/teacher/Classroom.tsx
git commit -m "feat(live): demo state types, story clock and mastery rules"
```

---

### Task 2: Seeded roster of 55 student profiles

**Files:**
- Create: `src/scenario/roster.ts`
- Test: `src/scenario/roster.test.ts`

**Interfaces:**
- Consumes: `StudentProfile`, `Evidence`, `Mastery` (Task 1); `STUDENTS`, `COMPLEX`, `groupOf` (`src/scenario/classroom.ts`); `MASTERY_INITIAL`, `MINH_ANH` (`src/scenario/minhAnh.ts`); `MESSAGES` (`src/scenario/sources.ts`); `CONCEPTS` (`src/scenario/knowledgeGraph.ts`); `classKpis`, `statusFor` (Task 1).
- Produces: `buildRoster(): StudentProfile[]`, `CLASS_EVIDENCE: Evidence[]`.

- [ ] **Step 1: Write the failing test**

Create `src/scenario/roster.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classKpis, statusFor } from '../live/mastery';
import { STUDENTS } from './classroom';
import { MASTERY_INITIAL } from './minhAnh';
import { buildRoster, CLASS_EVIDENCE } from './roster';

const round2 = (v: number) => Math.round(v * 100) / 100;

describe('roster', () => {
  const roster = buildRoster();

  it('is deterministic and has 55 students', () => {
    expect(roster).toHaveLength(55);
    expect(buildRoster()).toEqual(roster);
  });
  it('reproduces the Classroom figures', () => {
    const k = classKpis(roster);
    expect(k.needSupport).toBe(12);
    expect(k.highRisk).toBe(5);
    expect(k.escalated).toBe(3);
    expect(k.avgMastery).toBe(round2(STUDENTS.reduce((a, s) => a + s.mastery, 0) / 55));
  });
  it('keeps every student, status and topic figure from the scripted roster', () => {
    roster.forEach((p, i) => {
      expect(p.name).toBe(STUDENTS[i].name);
      expect(p.status).toBe(STUDENTS[i].status);
      expect(p.status).toBe(statusFor(p.mastery));
      expect(p.mastery.equivalence).toBe(STUDENTS[i].mastery);
    });
  });
  it('keeps Minh Anh hand-written', () => {
    const ma = roster[16];
    expect(ma.short).toBe('Minh Anh');
    expect(ma.group).toBe('G4');
    expect(ma.mastery).toEqual(MASTERY_INITIAL);
    expect(ma.quiz).toEqual({ q1: 75, q2: 42 });
    expect(ma.evidence.map((e) => e.id)).toContain('s17-quiz2-q4');
  });
  it('has unique, student-prefixed evidence ids and mastery within 0..1', () => {
    const ids = [...roster.flatMap((p) => p.evidence.map((e) => e.id)), ...CLASS_EVIDENCE.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of roster) {
      for (const e of p.evidence) expect(e.id.startsWith(`${p.id}-`), e.id).toBe(true);
      for (const v of Object.values(p.mastery)) expect(v >= 0 && v <= 1).toBe(true);
    }
    for (const e of CLASS_EVIDENCE) expect(e.id.startsWith('class-')).toBe(true);
  });
  it('gives the quirk students their stories', () => {
    expect(roster[7].evidence.some((e) => e.kind === 'taNote')).toBe(true);
    expect(roster[41].evidence.find((e) => e.id === 's42-attendance')?.text).toContain('3 of 6');
    expect(roster[30].quiz.q2).toBeGreaterThan(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenario/roster.test.ts`
Expected: FAIL — cannot resolve `./roster`.

- [ ] **Step 3: Write `src/scenario/roster.ts`**

```ts
import type { Evidence, Mastery, StudentProfile } from '../live/types';
import { COMPLEX, STUDENTS, groupOf, type Status } from './classroom';
import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { MASTERY_INITIAL, MINH_ANH } from './minhAnh';
import { MESSAGES } from './sources';

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number) => Math.min(0.97, Math.max(0.08, v));

/** How far each concept sits from the Week 6 topic (logical equivalence): prerequisites higher, later topics lower. */
const LIFT: Record<ConceptId, number> = {
  propositions: 0.22, negation: 0.14, conjunction: 0.16, disjunction: 0.13, implication: -0.02, biconditional: -0.01,
  truthTables: 0.08, expressions: 0.06, equivalence: 0, deMorgan: -0.03, equivLaws: -0.05, applications: -0.08,
};
const jitter = (i: number, ci: number) => (((i * 31 + ci * 17) % 9) - 4) / 100;

function masteryFor(i: number, topic: number): Mastery {
  const m = {} as Mastery;
  CONCEPTS.forEach((c, ci) => {
    m[c.id] = c.id === 'equivalence' ? topic : round2(clamp(topic + LIFT[c.id] + jitter(i, ci)));
  });
  return m;
}

const quizFor = (i: number, topic: number) => {
  const q2 = Math.round(30 + topic * 65);
  return { q1: Math.min(100, q2 + ((i * 7) % 9) - 2), q2 };
};

function baseEvidence(id: string, index: number, status: Status, m: Mastery, q: { q1: number; q2: number }): Evidence[] {
  const lmsDone = Math.max(1, Math.min(6, Math.round(m.equivalence * 7)));
  const present = 6 - (index % 3 === 0 && status !== 'onTrack' ? 1 : 0);
  return [
    { id: `${id}-quiz1`, kind: 'quiz', source: 'Assessments', text: `Quiz 1: ${q.q1}%`, when: 'Week 3' },
    { id: `${id}-quiz2`, kind: 'quiz', source: 'Assessments', text: `Quiz 2: ${q.q2}%`, when: 'Week 6' },
    {
      id: `${id}-quiz2-q4`, kind: 'quiz', source: 'Quiz 2 responses', when: 'Week 6', concept: 'implication',
      text: m.implication < 0.5 ? 'Q4 (p → q ≡ ?): chose the converse q → p' : 'Q4 (p → q ≡ ?): correct',
    },
    { id: `${id}-lms`, kind: 'activity', source: 'LMS activity log', text: `${lmsDone} of 6 Week 5–6 activities complete`, when: 'Week 6' },
    { id: `${id}-attendance`, kind: 'attendance', source: 'Attendance', text: `Attended ${present} of 6 tutorials`, when: 'Week 6' },
  ];
}

interface Quirk {
  /** Replaces the text of a base entry, keyed by its slug (the part after `<id>-`). */
  replace?: Record<string, string>;
  extra?: (Omit<Evidence, 'id'> & { slug: string })[];
  quiz?: { q1: number; q2: number };
  practicePerWeek?: number;
}

/** Hand-written stories so free questions have interesting answers. Keys are student indexes. */
const QUIRKS: Record<number, Quirk> = {
  7: {
    replace: { attendance: 'Attended 6 of 6 tutorials', lms: '0 of 6 Week 5–6 activities submitted · last submission in Week 4' },
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Linh', text: 'Present every week, sits at the back, has not spoken in tutorial since Week 3', when: 'Week 6' }],
    practicePerWeek: 0.2,
  },
  12: {
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Linh', text: 'Family situation this month (shared in confidence); keep messages low-pressure', when: 'Week 5' }],
  },
  26: {
    extra: [{ slug: 'email', kind: 'message', source: 'Email', text: "Asks about De Morgan's laws from Quiz 2", when: 'Week 6', concept: 'deMorgan' }],
  },
  28: {
    extra: [
      { slug: 'adaptive', kind: 'activity', source: 'Beyond practice', text: 'Adaptive pathway: 2 cycles completed, no mastery gain (0.29 → 0.30)', when: 'Week 6' },
      { slug: 'ta', kind: 'taNote', source: 'TA note · Hưng', text: 'Works hard in tutorial but freezes on truth tables', when: 'Week 6' },
    ],
  },
  30: {
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Hưng', text: 'Top quiz scores but silent in discussion; may be ready for challenge tasks', when: 'Week 6' }],
    quiz: { q1: 94, q2: 96 },
  },
  41: {
    replace: { attendance: 'Attended 3 of 6 tutorials · missed the last three' },
    extra: [{ slug: 'whatsapp', kind: 'message', source: 'WhatsApp', text: 'No reply to two check-in messages', when: 'Week 6' }],
  },
  45: {
    extra: [{ slug: 'officehours', kind: 'activity', source: 'Office hours', text: 'Came to office hours in Week 5; Quiz 2 up from Quiz 1', when: 'Week 5' }],
    quiz: { q1: 38, q2: 55 },
  },
  50: {
    extra: [{ slug: 'trend', kind: 'record', source: 'Academic records', text: 'Mastery falling across 3 topics since Week 4', when: 'Week 6' }],
    quiz: { q1: 61, q2: 38 },
  },
};

const MINH_ANH_EVIDENCE: Evidence[] = [
  { id: 's17-quiz1', kind: 'quiz', source: 'Assessments', text: 'Quiz 1: 75%', when: 'Week 3' },
  { id: 's17-quiz2', kind: 'quiz', source: 'Assessments', text: 'Quiz 2: 42% (down from 75%)', when: 'Week 6' },
  { id: 's17-quiz2-q4', kind: 'quiz', source: 'Quiz 2 responses', text: 'Chose the converse q → p on 6 implication items across two quizzes', when: 'Week 6', concept: 'implication' },
  { id: 's17-zalo-1', kind: 'message', source: 'Zalo', text: `“${MESSAGES[0].vi}” (${MESSAGES[0].evidence})`, when: 'Week 6', concept: 'implication' },
  { id: 's17-zalo-2', kind: 'message', source: 'Zalo', text: `“${MESSAGES[3].vi}” (${MESSAGES[3].evidence})`, when: 'Week 6', concept: 'truthTables' },
  { id: 's17-lms', kind: 'activity', source: 'LMS activity log', text: 'Truth-table lab and implication worksheet still open · last login 6 days ago', when: 'Week 6' },
  { id: 's17-attendance', kind: 'attendance', source: 'Attendance', text: 'Absent from tutorial 5', when: 'Week 5' },
  { id: 's17-records', kind: 'record', source: 'Academic records', text: 'Intro to Logic: C+ (68%)', when: 'Last year' },
];

export const CLASS_EVIDENCE: Evidence[] = [
  { id: 'class-quiz2-q4', kind: 'quiz', source: 'Quiz 2 responses', text: 'Q4 (p → q ≡ ?): 58% of the class incorrect', when: 'Week 6', concept: 'implication' },
  { id: 'class-quiz2-q7', kind: 'quiz', source: 'Quiz 2 responses', text: "Q7 (De Morgan's law): 44% of the class incorrect", when: 'Week 6', concept: 'deMorgan' },
  { id: 'class-quiz2-avg', kind: 'quiz', source: 'LMS gradebook', text: 'Quiz 2 class average 61%', when: 'Week 6' },
  { id: 'class-attendance', kind: 'attendance', source: 'Attendance', text: 'Week 6 tutorials: 47 of 55 present', when: 'Week 6' },
  { id: 'class-assignment3', kind: 'activity', source: 'LMS gradebook', text: 'Assignment 3: 41 of 55 submitted', when: 'Week 6' },
];

/** The 55 fictional students as full profiles. Deterministic; reproduces the scripted Classroom figures. */
export function buildRoster(): StudentProfile[] {
  return STUDENTS.map((s) => {
    const isMinhAnh = s.index === MINH_ANH.index;
    const quirk = QUIRKS[s.index];
    const mastery = isMinhAnh ? { ...MASTERY_INITIAL } : masteryFor(s.index, s.mastery);
    const quiz = isMinhAnh ? { q1: MINH_ANH.scorePrev, q2: MINH_ANH.scoreNow } : quirk?.quiz ?? quizFor(s.index, s.mastery);
    let evidence = isMinhAnh ? MINH_ANH_EVIDENCE.map((e) => ({ ...e })) : baseEvidence(s.id, s.index, s.status, mastery, quiz);
    if (quirk?.replace) {
      const replace = quirk.replace;
      evidence = evidence.map((e) => {
        const text = replace[e.id.slice(s.id.length + 1)];
        return text ? { ...e, text } : e;
      });
    }
    for (const { slug, ...e } of quirk?.extra ?? []) evidence.push({ ...e, id: `${s.id}-${slug}` });
    return {
      index: s.index,
      id: s.id,
      name: s.name,
      short: isMinhAnh ? MINH_ANH.short : s.name.split(' ').slice(-1)[0],
      group: groupOf(s.index),
      status: s.status,
      escalated: COMPLEX.includes(s.index),
      mastery,
      quiz,
      practicePerWeek: isMinhAnh ? 1.5 : quirk?.practicePerWeek ?? Math.round((1 + s.mastery * 3) * 10) / 10,
      evidence,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scenario/roster.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenario/roster.ts src/scenario/roster.test.ts
git commit -m "feat(live): seeded 55-student roster with evidence and quirk stories"
```

---

### Task 3: Practice bank

**Files:**
- Create: `src/scenario/practiceBank.ts`
- Test: `src/scenario/practiceBank.test.ts`

**Interfaces:**
- Consumes: `ConceptId`, `CONCEPTS` (`knowledgeGraph.ts`); `Q1`, `GUIDED` (`practice.ts`).
- Produces: `GuidedStep`, `BankItem`, `BANK: BankItem[]`, `BANK_CONCEPTS: ConceptId[]`, `itemsFor(concept): BankItem[]`, `sessionItems(concept, isMasteryCheck): BankItem[]`.

- [ ] **Step 1: Write the failing test**

Create `src/scenario/practiceBank.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONCEPTS } from './knowledgeGraph';
import { Q1 } from './practice';
import { BANK, BANK_CONCEPTS, itemsFor, sessionItems } from './practiceBank';

describe('practice bank', () => {
  it('covers all 12 concepts with at least 3 items each', () => {
    expect(BANK_CONCEPTS.sort()).toEqual(CONCEPTS.map((c) => c.id).sort());
    for (const c of CONCEPTS) expect(itemsFor(c.id).length, c.id).toBeGreaterThanOrEqual(3);
  });
  it('has unique ids and one hint per wrong option', () => {
    expect(new Set(BANK.map((i) => i.id)).size).toBe(BANK.length);
    for (const item of BANK) {
      expect(item.hints, item.id).toHaveLength(item.options.length);
      expect(item.correct >= 0 && item.correct < item.options.length, item.id).toBe(true);
      item.hints.forEach((h, i) => expect(i === item.correct ? h === '' : h.length > 10, `${item.id} hint ${i}`).toBe(true));
    }
  });
  it('reuses the video item (converse mistake) as implication-1', () => {
    const first = itemsFor('implication')[0];
    expect(first.id).toBe('implication-1');
    expect(first.prompt).toBe(Q1.prompt);
    expect(first.hints[Q1.chosenWrong]).toBe(Q1.hint);
    expect(first.guided?.steps.at(-1)?.expr).toBe('p ∧ ¬q');
  });
  it('sizes sessions: practice takes 2 items, the mastery check takes the last 3', () => {
    expect(sessionItems('equivalence', false).map((i) => i.id)).toEqual(['equivalence-1', 'equivalence-2']);
    expect(sessionItems('equivalence', true).map((i) => i.id)).toEqual(['equivalence-2', 'equivalence-3', 'equivalence-4']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenario/practiceBank.test.ts`
Expected: FAIL — cannot resolve `./practiceBank`.

- [ ] **Step 3: Write `src/scenario/practiceBank.ts`**

```ts
import type { ConceptId } from './knowledgeGraph';
import { GUIDED, Q1 } from './practice';

export interface GuidedStep { expr: string; why: string }

export interface BankItem {
  id: string;
  concept: ConceptId;
  prompt: string;
  options: string[];
  correct: number;
  /** One hint per option; the correct option's entry is ''. */
  hints: string[];
  /** Shown after a correct answer: a worked rewrite the student steps through. */
  guided?: { start: string; steps: GuidedStep[] };
}

let counts: Partial<Record<ConceptId, number>> = {};
function item(concept: ConceptId, prompt: string, options: string[], correct: number, hints: string[], guided?: BankItem['guided']): BankItem {
  counts[concept] = (counts[concept] ?? 0) + 1;
  return { id: `${concept}-${counts[concept]}`, concept, prompt, options, correct, hints, guided };
}

export const BANK: BankItem[] = [
  item('propositions', 'Which of these is a proposition?', ['x + 2 = 5', 'Close the door.', '7 is a prime number.', 'Is it raining?'], 2, [
    'It has a variable, so it is not true or false on its own.', 'A command is not true or false.', '', 'A question is not true or false.']),
  item('propositions', 'p: “It is raining”, q: “I take an umbrella”. Which sentence is p ∧ q?', ['It is raining or I take an umbrella.', 'It is raining and I take an umbrella.', 'If it is raining, I take an umbrella.', 'It is not raining.'], 1, [
    '“or” is ∨, not ∧.', '', '“If … then” is implication (→).', 'That is ¬p.']),
  item('propositions', 'How many rows does the truth table for p, q, r have?', ['3', '6', '8', '9'], 2, [
    'Each variable doubles the rows: 2 × 2 × 2.', 'Each variable doubles the rows; it does not add 2.', '', 'Rows are 2ⁿ, not 3ⁿ: each variable is T or F.']),

  item('negation', 'What is the negation of “All students passed”?', ['No student passed.', 'Some student did not pass.', 'All students failed.', 'Some students passed.'], 1, [
    '“None passed” is stronger than the negation: one failure is enough.', '', 'Negating “all” does not flip every case: one counterexample is enough.', 'That can be true together with the original, so it is not its negation.']),
  item('negation', 'If p is true, what is ¬¬p?', ['True', 'False', 'Undefined', 'Depends on q'], 0, [
    '', 'Two negations cancel: ¬¬p has the same value as p.', 'Every compound of p has a value once p is known.', 'q does not appear in ¬¬p.']),
  item('negation', 'Which is equivalent to ¬(p ∧ q)?', ['¬p ∧ ¬q', '¬p ∨ ¬q', 'p ∨ q', '¬p → q'], 1, [
    'Negating ∧ turns it into ∨ (De Morgan): check p = T, q = F.', '', 'Each part must be negated too.', 'Check p = F, q = F: ¬(p ∧ q) is T but ¬p → q is F.'],
    { start: '¬(p ∧ q)', steps: [{ expr: '¬p ∨ ¬q', why: "De Morgan's law: negate each part, swap ∧ for ∨" }] }),

  item('conjunction', 'p ∧ q is true exactly when…', ['p is true', 'at least one of p, q is true', 'both p and q are true', 'p and q have the same value'], 2, [
    'q must be true as well.', 'That describes p ∨ q.', '', 'That describes p ↔ q (both false also counts).']),
  item('conjunction', 'p = T, q = F. What is p ∧ q?', ['T', 'F'], 1, ['∧ needs both sides true; q is false.', '']),
  item('conjunction', 'Which is equivalent to p ∧ (p ∨ q)?', ['p', 'q', 'p ∧ q', 'p ∨ q'], 0, [
    '', 'Check p = F, q = T: the expression is F but q is T.', 'Check p = T, q = F: the expression is T but p ∧ q is F.', 'Check p = F, q = T: the expression is F but p ∨ q is T.'],
    { start: 'p ∧ (p ∨ q)', steps: [
      { expr: '(p ∧ p) ∨ (p ∧ q)', why: 'Distribute ∧ over ∨' },
      { expr: 'p ∨ (p ∧ q)', why: 'Idempotence: p ∧ p ≡ p' },
      { expr: 'p', why: 'Absorption' },
    ] }),

  item('disjunction', 'p ∨ q is false exactly when…', ['p is false', 'both p and q are false', 'exactly one is false', 'both are true'], 1, [
    'q could still be true.', '', 'One true side is enough to make ∨ true.', 'Both true makes ∨ true.']),
  item('disjunction', '“I will have tea or coffee” (inclusive or). Which case makes it false?', ['Tea, no coffee', 'Coffee, no tea', 'Both', 'Neither'], 3, [
    'One true side makes it true.', 'One true side makes it true.', 'Inclusive or is true when both hold.', '']),
  item('disjunction', 'Which is equivalent to ¬(p ∨ q)?', ['¬p ∨ ¬q', '¬p ∧ ¬q', 'p ∧ q', '¬p ∨ q'], 1, [
    'Negating ∨ turns it into ∧: check p = T, q = F.', '', 'Each part must be negated.', 'Check p = F, q = T: ¬(p ∨ q) is F but ¬p ∨ q is T.']),

  item('implication', Q1.prompt, Q1.options.map((o) => o.label), Q1.correct, [
    Q1.hint, '', 'p ∧ ¬q is the negation of p → q: it is true exactly when the implication fails.', '¬p → ¬q is the inverse; it has the same truth table as the converse, not the original.'],
    { start: '¬(p → q)', steps: GUIDED.steps.map(({ expr, why }) => ({ expr, why })) }),
  item('implication', 'When is p → q false?', ['p = T, q = T', 'p = T, q = F', 'p = F, q = T', 'p = F, q = F'], 1, [
    'A promise kept: the implication holds.', '', 'With p false the implication is vacuously true.', 'With p false the implication is vacuously true.']),
  item('implication', 'Which statement is the contrapositive of p → q?', ['q → p', '¬p → ¬q', '¬q → ¬p', 'p → ¬q'], 2, [
    'That is the converse: it swaps the sides without negating.', 'That is the inverse: it negates without swapping.', '', 'That contradicts the original when p and q are both true.']),

  item('biconditional', 'p ↔ q is true exactly when…', ['p and q have the same value', 'p is true', 'p → q is true', 'at least one is true'], 0, [
    '', 'Both false also makes ↔ true.', 'q → p must hold too.', 'p = T, q = F has one true side, but ↔ is false.']),
  item('biconditional', 'Which is equivalent to p ↔ q?', ['(p → q) ∧ (q → p)', '(p → q) ∨ (q → p)', 'p ∧ q', '¬p ∨ q'], 0, [
    '', 'Check p = T, q = F: one implication fails, so ↔ is F, but the ∨ is T.', 'Check p = F, q = F: ↔ is T but p ∧ q is F.', 'That is p → q only.']),
  item('biconditional', 'p = F, q = F. What is p ↔ q?', ['T', 'F'], 0, ['', 'Same value on both sides makes ↔ true.']),

  item('truthTables', 'In the truth table of p → q, how many rows are true?', ['1', '2', '3', '4'], 2, [
    'Only one row is false: p = T, q = F.', 'Only one row is false: p = T, q = F.', '', 'The row p = T, q = F is false.']),
  item('truthTables', 'A formula is true in every row of its truth table. It is a…', ['contradiction', 'tautology', 'contingency', 'proposition variable'], 1, [
    'A contradiction is false in every row.', '', 'A contingency is true in some rows and false in others.', 'A variable takes both values.']),
  item('truthTables', 'Which formula is a tautology?', ['p ∧ ¬p', 'p ∨ ¬p', 'p → ¬p', 'p ↔ ¬p'], 1, [
    'p and ¬p are never both true: always false.', '', 'False when p is true.', 'p and ¬p never have the same value: always false.']),

  item('expressions', 'Translate “If it rains, the match is cancelled” with r: rains, c: cancelled.', ['c → r', 'r → c', 'r ∧ c', 'r ↔ c'], 1, [
    'That is the converse: “if cancelled, it rained”.', '', 'That claims both happen.', 'That also claims “if cancelled, then it rained”.']),
  item('expressions', 'p = T, q = F, r = T. What is (p ∨ q) ∧ ¬r?', ['T', 'F'], 1, ['¬r is F, and anything ∧ F is F.', '']),
  item('expressions', 'Which expression means “neither p nor q”?', ['¬p ∨ ¬q', '¬(p ∧ q)', '¬p ∧ ¬q', '¬p → q'], 2, [
    'That allows one of them to be true.', 'That only rules out both being true.', '', 'That means p ∨ q.']),

  item('equivalence', 'Two formulas are logically equivalent when…', ['they have the same variables', 'they have the same value in every row of the truth table', 'one implies the other', 'they are both true in some row'], 1, [
    'Same variables is not enough: p ∧ q and p ∨ q share variables.', '', 'Equivalence needs both directions, in every row.', 'Agreeing on one row is not enough.']),
  item('equivalence', 'Which is equivalent to p → q?', ['¬q → ¬p', 'q → p', '¬p → ¬q', 'p ∧ q'], 0, [
    '', 'The converse: check p = F, q = T.', 'The inverse: check p = F, q = T.', 'Check p = F, q = F: p → q is T but p ∧ q is F.'],
    { start: 'p → q', steps: [
      { expr: '¬p ∨ q', why: 'Implication as disjunction' },
      { expr: 'q ∨ ¬p', why: 'Commutativity' },
      { expr: '¬q → ¬p', why: 'Disjunction back to implication' },
    ] }),
  item('equivalence', 'Is p → q equivalent to ¬p ∨ q?', ['Yes', 'No'], 0, ['', 'Compare the rows: both are false only when p = T and q = F.']),
  item('equivalence', 'Which pair is NOT equivalent?', ['p ∨ q and q ∨ p', '¬¬p and p', 'p → q and q → p', '¬(p ∨ q) and ¬p ∧ ¬q'], 2, [
    '∨ is commutative.', 'Double negation cancels.', '', "That is De Morgan's law."]),

  item('deMorgan', '¬(p ∧ q) ≡ ?', ['¬p ∧ ¬q', '¬p ∨ ¬q', 'p ∨ q', '¬p ∧ q'], 1, [
    'Swap ∧ for ∨ when the negation moves inside.', '', 'Each part needs its own negation.', 'Both parts need the negation.']),
  item('deMorgan', 'Negate “The code compiles and the tests pass”.', ['The code does not compile and the tests fail.', 'The code does not compile or the tests fail.', 'The code compiles or the tests pass.', 'The code compiles and the tests fail.'], 1, [
    'Too strong: one failure is enough to negate “and”.', '', 'That is not a negation: it is true when both hold.', 'That is only one of the two ways the original can fail.']),
  item('deMorgan', '¬(¬p ∨ q) ≡ ?', ['p ∧ ¬q', '¬p ∧ q', 'p ∨ ¬q', '¬p ∨ ¬q'], 0, [
    '', 'Negate each part: ¬¬p is p, and q becomes ¬q.', 'Negating ∨ gives ∧.', 'Negating ∨ gives ∧, and ¬¬p is p.'],
    { start: '¬(¬p ∨ q)', steps: [{ expr: '¬¬p ∧ ¬q', why: "De Morgan's law" }, { expr: 'p ∧ ¬q', why: 'Double negation' }] }),

  item('equivLaws', 'Which law gives p ∨ (p ∧ q) ≡ p?', ['Distributive', 'Absorption', 'Idempotent', 'Identity'], 1, [
    'Distribution would expand it, not shrink it.', '', 'Idempotence is p ∨ p ≡ p.', 'Identity is p ∨ F ≡ p.']),
  item('equivLaws', 'p ∧ (q ∨ r) ≡ ?', ['(p ∧ q) ∨ (p ∧ r)', '(p ∨ q) ∧ (p ∨ r)', 'p ∧ q ∧ r', '(p ∧ q) ∨ r'], 0, [
    '', 'That distributes ∨ over ∧, the other law.', 'Check p = T, q = T, r = F.', 'Check p = F, q = F, r = T.']),
  item('equivLaws', 'Simplify ¬(p → q) ∨ q.', ['p ∨ q', 'q', 'p ∧ q', '¬p'], 0, [
    '', 'Check p = T, q = F: the expression is T but q is F.', 'Check p = T, q = F: the expression is T but p ∧ q is F.', 'Check p = T, q = F: the expression is T but ¬p is F.'],
    { start: '¬(p → q) ∨ q', steps: [
      { expr: '(p ∧ ¬q) ∨ q', why: 'Negated implication' },
      { expr: '(p ∨ q) ∧ (¬q ∨ q)', why: 'Distribute ∨ over ∧' },
      { expr: 'p ∨ q', why: '¬q ∨ q ≡ T, and x ∧ T ≡ x' },
    ] }),

  item('applications', 'A door opens if you have a badge or a code, and the alarm is off. Which formula?', ['(b ∨ c) ∧ ¬a', 'b ∨ (c ∧ ¬a)', '(b ∧ c) ∨ ¬a', 'b ∨ c ∨ ¬a'], 0, [
    '', 'The alarm must be off for the badge too.', 'You need a badge or a code, not both.', 'The alarm condition must always hold.']),
  item('applications', 'Rule: “if a student misses 3 tutorials, the teacher is alerted”. The teacher was not alerted. What follows?', ['The student missed 3 tutorials.', 'The student did not miss 3 tutorials.', 'Nothing follows.', 'The rule was broken.'], 1, [
    'That would make the rule fail.', '', 'The contrapositive applies: ¬q → ¬p.', 'The rule still holds; reason from it.']),
  item('applications', 'Which query finds students who are in neither G1 nor G2?', ['¬(G1 ∨ G2)', '¬G1 ∨ ¬G2', '¬(G1 ∧ G2)', 'G1 ∨ G2'], 0, [
    '', 'That includes every student in G1 (they are not in G2).', 'Nobody is in both groups, so that matches everyone.', 'That finds the students in G1 or G2.']),
];
counts = {};

export const BANK_CONCEPTS: ConceptId[] = [...new Set(BANK.map((i) => i.concept))];

export const itemsFor = (c: ConceptId): BankItem[] => BANK.filter((i) => i.concept === c);

/** Practice sessions take a concept's first 2 items; the mastery check takes its last 3. */
export function sessionItems(concept: ConceptId, isMasteryCheck: boolean): BankItem[] {
  const all = itemsFor(concept);
  return isMasteryCheck ? all.slice(-3) : all.slice(0, 2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/scenario/practiceBank.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenario/practiceBank.ts src/scenario/practiceBank.test.ts
git commit -m "feat(live): canned practice bank for the 12 concepts"
```

---

### Task 4: Plan policy checks, seed state and test fixtures

**Files:**
- Create: `src/live/plans.ts`, `src/live/seed.ts`, `src/live/fixtures.ts`
- Test: `src/live/plans.test.ts`

**Interfaces:**
- Consumes: Task 1 types and clock; `BANK_CONCEPTS` (Task 3); `buildRoster`, `CLASS_EVIDENCE` (Task 2).
- Produces:
  - `POLICY = { maxSessions: 4, maxMinutes: 45, followUpMaxSessions: 3, maxCheckIns: 5 }`
  - `planProblems(plan: Plan, state: Pick<DemoState, 'clock' | 'students'>): string[]`
  - `withinFollowUpPolicy(plan, state): boolean`
  - `IDLE_PHONE: PhoneState`, `seedState(epoch?: number): DemoState`
  - fixtures `planFor(kind, over?): Plan` (id `p1`, conversation `c1`, status `proposed`) and `stateWithPlan(kind?, over?): DemoState`

- [ ] **Step 1: Write the failing test**

Create `src/live/plans.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planFor, stateWithPlan } from './fixtures';
import { planProblems, withinFollowUpPolicy } from './plans';
import { seedState } from './seed';

describe('planProblems', () => {
  const state = seedState();

  it('accepts the fixture plans', () => {
    expect(planProblems(planFor('pathway'), state)).toEqual([]);
    expect(planProblems(planFor('classActivity'), state)).toEqual([]);
    expect(planProblems(planFor('checkIns'), state)).toEqual([]);
  });
  it('rejects Today sessions that are not after the story clock', () => {
    const p = planFor('pathway');
    p.sessions[0].time = '14:30';
    expect(planProblems(p, state)).toEqual(['Session 1 at 14:30 is not after now (15:00).']);
    expect(planProblems({ ...p, day: 'Tomorrow' }, state)).toEqual([]);
  });
  it('rejects malformed times and unknown students', () => {
    const p = planFor('pathway', { studentIds: ['s99'] });
    p.sessions[0].time = '7pm';
    expect(planProblems(p, state)).toEqual(['Unknown student id s99.', 'Session 1: time "7pm" is not HH:MM.']);
  });
  it('enforces the pathway policy', () => {
    const long = planFor('pathway');
    long.sessions = [0, 1, 2, 3, 4].map((i) => ({ ...long.sessions[0], time: `1${6 + i}:00`, minutes: 10, isMasteryCheck: i === 4 }));
    expect(planProblems(long, state)).toEqual(['At most 4 sessions.', 'Total 50 minutes is over the 45-minute limit.']);
    const noCheck = planFor('pathway');
    noCheck.sessions[1].isMasteryCheck = false;
    expect(planProblems(noCheck, state)).toEqual(['The last session must be the mastery check.']);
    const noBank = planFor('pathway');
    noBank.sessions[0].concept = null;
    expect(planProblems(noBank, state)).toEqual(['Session 1: concept none has no practice items.']);
  });
  it('needs a valid student on every check-in', () => {
    const p = planFor('checkIns');
    p.sessions[1].studentId = null;
    expect(planProblems(p, state)).toEqual(['Check-in 2 needs a valid student id.']);
  });
  it('auto-approves only small pathway follow-ups', () => {
    expect(withinFollowUpPolicy(planFor('pathway'), state)).toBe(true);
    expect(withinFollowUpPolicy(planFor('classActivity'), state)).toBe(false);
    const four = planFor('pathway');
    four.sessions = [0, 1, 2, 3].map((i) => ({ ...four.sessions[0], time: `1${6 + i}:00`, minutes: 8, isMasteryCheck: i === 3 }));
    expect(withinFollowUpPolicy(four, state)).toBe(false);
  });
});

describe('seedState', () => {
  it('starts at 15:00 with an idle phone and fresh copies', () => {
    const a = seedState();
    const b = seedState();
    a.students[0].mastery.equivalence = 0;
    expect(b.students[0].mastery.equivalence).not.toBe(0);
    expect(b.clock).toBe(900);
    expect(b.phone.screen).toBe('lock');
    expect(b.phone.planId).toBeNull();
    expect(seedState(3).epoch).toBe(3);
  });
  it('fixture state holds conversation c1 with plan p1', () => {
    const s = stateWithPlan();
    expect(s.conversations[0].id).toBe('c1');
    expect(s.plans[0].id).toBe('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/live/plans.test.ts`
Expected: FAIL — cannot resolve `./fixtures`.

- [ ] **Step 3: Write `src/live/plans.ts`**

```ts
import { BANK_CONCEPTS } from '../scenario/practiceBank';
import { fmt, parseTime } from './clock';
import type { DemoState, Plan } from './types';

export const POLICY = { maxSessions: 4, maxMinutes: 45, followUpMaxSessions: 3, maxCheckIns: 5 } as const;

type PlanContext = Pick<DemoState, 'clock' | 'students'>;

/** Problems with a draft plan, as sentences an agent can act on. Empty when the plan is valid. */
export function planProblems(plan: Plan, state: PlanContext): string[] {
  const out: string[] = [];
  const ids = new Set(state.students.map((s) => s.id));
  if (plan.sessions.length === 0) out.push('A plan needs at least one session.');
  for (const id of plan.studentIds) if (!ids.has(id)) out.push(`Unknown student id ${id}.`);
  plan.sessions.forEach((s, i) => {
    const t = parseTime(s.time);
    if (t === null) out.push(`Session ${i + 1}: time "${s.time}" is not HH:MM.`);
    else if (plan.day === 'Today' && t <= state.clock) out.push(`Session ${i + 1} at ${s.time} is not after now (${fmt(state.clock)}).`);
  });
  if (plan.kind === 'pathway') {
    if (plan.studentIds.length !== 1) out.push('A pathway is for exactly one student.');
    if (plan.sessions.length > POLICY.maxSessions) out.push(`At most ${POLICY.maxSessions} sessions.`);
    const minutes = plan.sessions.reduce((a, s) => a + s.minutes, 0);
    if (minutes > POLICY.maxMinutes) out.push(`Total ${minutes} minutes is over the ${POLICY.maxMinutes}-minute limit.`);
    plan.sessions.forEach((s, i) => {
      if (!s.concept || !BANK_CONCEPTS.includes(s.concept)) out.push(`Session ${i + 1}: concept ${s.concept ?? 'none'} has no practice items.`);
    });
    if (plan.sessions.length > 0 && !plan.sessions[plan.sessions.length - 1].isMasteryCheck) out.push('The last session must be the mastery check.');
  }
  if (plan.kind === 'checkIns') {
    if (plan.sessions.length > POLICY.maxCheckIns) out.push(`At most ${POLICY.maxCheckIns} check-ins.`);
    plan.sessions.forEach((s, i) => {
      if (!s.studentId || !ids.has(s.studentId)) out.push(`Check-in ${i + 1} needs a valid student id.`);
    });
  }
  return out;
}

/** A follow-up the agents may send without asking: a valid pathway of at most 3 sessions. */
export const withinFollowUpPolicy = (plan: Plan, state: PlanContext): boolean =>
  plan.kind === 'pathway' && plan.sessions.length <= POLICY.followUpMaxSessions && planProblems(plan, state).length === 0;
```

- [ ] **Step 4: Write `src/live/seed.ts`**

```ts
import { buildRoster, CLASS_EVIDENCE } from '../scenario/roster';
import { STORY_START } from './clock';
import type { DemoState, PhoneState } from './types';

export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, hinted: false, result: null, lastOption: null,
  done: [], before: null, lastDone: null, updated: false,
};

/** The demo as a visitor first sees it: 15:00, no conversations, no plans, idle phone. */
export function seedState(epoch = 0): DemoState {
  return {
    epoch,
    clock: STORY_START,
    students: buildRoster(),
    classEvidence: CLASS_EVIDENCE.map((e) => ({ ...e })),
    plans: [],
    conversations: [],
    phone: { ...IDLE_PHONE, done: [] },
    busy: false,
  };
}
```

- [ ] **Step 5: Write `src/live/fixtures.ts`**

```ts
import { seedState } from './seed';
import type { DemoState, LivePanel, Plan, PlanKind } from './types';

type PlanBase = Omit<Plan, 'id' | 'status' | 'conversationId'>;

const BASE: Record<PlanKind, () => PlanBase> = {
  pathway: () => ({
    kind: 'pathway', title: 'Rebuild implication, then equivalence', studentIds: ['s17'], day: 'Today',
    rationale: 'Implication is the root gap.', outcome: 'Logical equivalence mastery ≥ 0.75',
    sessions: [
      { time: '15:30', title: 'Review implication', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null },
      { time: '20:00', title: 'Mastery check', minutes: 10, concept: 'equivalence', isMasteryCheck: true, studentId: null },
    ],
  }),
  classActivity: () => ({
    kind: 'classActivity', title: 'Group recap', studentIds: ['s8', 's13'], day: 'Thursday',
    rationale: 'A shared gap.', outcome: 'Class mastery ≥ 0.60',
    sessions: [{ time: '10:00', title: '15-min recap in tutorial', minutes: 15, concept: null, isMasteryCheck: false, studentId: null }],
  }),
  checkIns: () => ({
    kind: 'checkIns', title: '15-minute check-ins', studentIds: ['s29', 's42'], day: 'Friday',
    rationale: 'Both are on the escalation list.', outcome: 'An agreed plan with each student',
    sessions: [
      { time: '14:00', title: 'Check-in', minutes: 15, concept: null, isMasteryCheck: false, studentId: 's29' },
      { time: '14:20', title: 'Check-in', minutes: 15, concept: null, isMasteryCheck: false, studentId: 's42' },
    ],
  }),
};

/** A valid proposed plan of each kind: id p1, conversation c1. */
export const planFor = (kind: PlanKind, over: Partial<Plan> = {}): Plan =>
  ({ ...BASE[kind](), id: 'p1', status: 'proposed', conversationId: 'c1', ...over });

const PANEL: Record<PlanKind, LivePanel> = {
  pathway: { kind: 'student', studentId: 's17', planId: 'p1', highlight: null },
  classActivity: { kind: 'class', planId: 'p1' },
  checkIns: { kind: 'checkIns', planId: 'p1' },
};

/** Seed state plus conversation c1 (one question, one agent answer) holding plan p1. */
export function stateWithPlan(kind: PlanKind = 'pathway', over: Partial<Plan> = {}): DemoState {
  const s = seedState();
  s.plans.push(planFor(kind, over));
  s.conversations.push({
    id: 'c1', title: 'Minh Anh · implication gap', sansTitle: true, pending: null,
    msgs: [
      { role: 'teacher', text: 'Why did Minh Anh’s quiz score drop?' },
      {
        role: 'assistant', source: 'agents', canned: null, stamp: null,
        blocks: [
          { kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] },
          { kind: 'li', text: 'She picked the converse on 6 items.', cites: ['s17-quiz2-q4'] },
        ],
        followUps: ['What gap is the class facing this week?', 'Show me her full history'],
        panel: PANEL[kind],
      },
    ],
  });
  return s;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/live/plans.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Commit**

```bash
git add src/live/plans.ts src/live/seed.ts src/live/fixtures.ts src/live/plans.test.ts
git commit -m "feat(live): plan policy checks, seed state and fixtures"
```

---

### Task 5: Pure state transitions (approve, edit, dismiss, phone flow)

**Files:**
- Create: `src/live/reducer.ts`
- Test: `src/live/reducer.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `type Result = { ok: true; state: DemoState; finishedCheck?: boolean } | { ok: false; error: string }`
  - `planById(state, id: string | null): Plan | null`, `studentById(state, id): StudentProfile | null`
  - `systemMsg(text, stamp?): AssistantMsg`
  - `deliver(state, plan, updated): void` — mutates `state.phone` to carry `plan` (fresh lock-screen notification unless `updated`)
  - `currentItems(state): BankItem[]`
  - `editPlan(state, planId, index, change: { time?: string; remove?: boolean }): Result`
  - `approvePlan(state, planId): Result`, `dismissPlan(state, planId): Result`
  - `phoneShowPlan(state): Result`, `phoneOpen(state, index): Result`, `phoneAnswer(state, option): Result`, `phoneNext(state): Result` (sets `finishedCheck: true` when a mastery check completes), `phoneSkip(state): Result`

- [ ] **Step 1: Write the failing test**

Create `src/live/reducer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sessionItems } from '../scenario/practiceBank';
import { stateWithPlan } from './fixtures';
import { afterAnswer } from './mastery';
import {
  approvePlan, currentItems, dismissPlan, editPlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result,
} from './reducer';
import type { DemoState } from './types';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const ma = (s: DemoState) => s.students[16];
const lastMsg = (s: DemoState) => s.conversations[0].msgs.at(-1)!;

describe('plan transitions', () => {
  it('approving a pathway sends it to the phone and confirms in the conversation', () => {
    const before = stateWithPlan();
    const s = ok(approvePlan(before, 'p1'));
    expect(s.plans[0].status).toBe('sent');
    expect(s.phone).toMatchObject({ planId: 'p1', screen: 'lock', done: [], updated: false });
    expect(s.phone.before).toEqual(ma(s).mastery);
    const msg = lastMsg(s);
    expect(msg.role === 'assistant' && msg.source).toBe('system');
    expect(msg.role === 'assistant' && msg.blocks[0].text).toContain('Sent to Minh Anh’s phone');
    expect(before.plans[0].status).toBe('proposed');
  });
  it('approving a class activity or check-ins records it and never touches the phone', () => {
    for (const kind of ['classActivity', 'checkIns'] as const) {
      const s = ok(approvePlan(stateWithPlan(kind), 'p1'));
      expect(s.plans[0].status).toBe('approved');
      expect(s.phone.planId).toBeNull();
      expect(lastMsg(s).role).toBe('assistant');
    }
  });
  it('only a proposed plan can be approved, edited or dismissed', () => {
    const sent = ok(approvePlan(stateWithPlan(), 'p1'));
    expect(approvePlan(sent, 'p1').ok).toBe(false);
    expect(editPlan(sent, 'p1', 0, { time: '16:00' }).ok).toBe(false);
    expect(dismissPlan(sent, 'p1').ok).toBe(false);
    expect(approvePlan(sent, 'nope').ok).toBe(false);
  });
  it('edits a time, rejects a bad time, and keeps the mastery check', () => {
    const s = ok(editPlan(stateWithPlan(), 'p1', 1, { time: '20:30' }));
    expect(s.plans[0].sessions[1].time).toBe('20:30');
    expect(editPlan(s, 'p1', 1, { time: '8.30' })).toEqual({ ok: false, error: 'Time must be HH:MM.' });
    expect(editPlan(s, 'p1', 1, { remove: true })).toEqual({ ok: false, error: 'The mastery check stays in the plan.' });
    expect(ok(editPlan(s, 'p1', 0, { remove: true })).plans[0].sessions).toHaveLength(1);
  });
  it('dismissing sets the plan aside with a one-line acknowledgement', () => {
    const s = ok(dismissPlan(stateWithPlan(), 'p1'));
    expect(s.plans[0].status).toBe('dismissed');
    expect(lastMsg(s).role === 'assistant' && lastMsg(s).source).toBe('system');
  });
});

describe('phone flow', () => {
  const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));

  it('tapping the notification shows the plan; opening a session moves the clock to it', () => {
    const s = ok(phoneOpen(ok(phoneShowPlan(sent())), 0));
    expect(s.phone).toMatchObject({ screen: 'practice', session: 0, item: 0 });
    expect(s.clock).toBe(15 * 60 + 30);
    expect(currentItems(s).map((i) => i.id)).toEqual(['implication-1', 'implication-2']);
  });
  it('a wrong answer shows the hint and leaves mastery; a right one after it gains 15%', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneAnswer(s, 0));
    expect(s.phone).toMatchObject({ result: 'wrong', lastOption: 0, hinted: true });
    expect(ma(s).mastery.implication).toBe(0.31);
    expect(phoneNext(s).ok).toBe(false);
    s = ok(phoneAnswer(s, 1));
    expect(s.phone.result).toBe('right');
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, true));
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', concept: 'implication', when: '15:30' });
    expect(phoneAnswer(s, 1).ok).toBe(false);
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
    expect(s.plans[0].status).toBe('done');
    expect(ma(s).status).toBe('onTrack');
    expect(phoneOpen(s, 0).ok).toBe(false);
  });
  it('skip to tonight marks earlier sessions done with seeded results', () => {
    const s = ok(phoneSkip(ok(phoneShowPlan(sent()))));
    expect(s.phone.done).toEqual([0]);
    expect(s.clock).toBe(20 * 60);
    expect(ma(s).mastery.implication).toBeGreaterThan(0.31);
    expect(ma(s).evidence.filter((e) => e.kind === 'practice')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/live/reducer.test.ts`
Expected: FAIL — cannot resolve `./reducer`.

- [ ] **Step 3: Write `src/live/reducer.ts`**

```ts
import { conceptById } from '../scenario/knowledgeGraph';
import { sessionItems, type BankItem } from '../scenario/practiceBank';
import { fmt, parseTime, TONIGHT } from './clock';
import { afterAnswer, statusFor } from './mastery';
import { IDLE_PHONE } from './seed';
import type { AssistantMsg, DemoState, Plan, StudentProfile } from './types';

export type Result = { ok: true; state: DemoState; finishedCheck?: boolean } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const done = (state: DemoState, finishedCheck = false): Result => ({ ok: true, state, ...(finishedCheck ? { finishedCheck } : {}) });

export const planById = (s: DemoState, id: string | null): Plan | null => s.plans.find((p) => p.id === id) ?? null;
export const studentById = (s: DemoState, id: string): StudentProfile | null => s.students.find((x) => x.id === id) ?? null;

export const systemMsg = (text: string, stamp: string | null = null): AssistantMsg => ({
  role: 'assistant', source: 'system', blocks: [{ kind: 'p', text, cites: [] }], canned: null, followUps: [], panel: null, stamp,
});

function say(s: DemoState, conversationId: string, text: string) {
  s.conversations.find((c) => c.id === conversationId)?.msgs.push(systemMsg(text));
}

/**
 * Puts `plan` on the phone. A fresh delivery shows the lock-screen notification and records the mastery baseline;
 * a follow-up keeps the current screen, the baseline and the finished plan, so the progress screen still tells tonight's story.
 */
export function deliver(s: DemoState, plan: Plan, updated: boolean): void {
  const student = studentById(s, plan.studentIds[0]);
  s.phone = {
    ...IDLE_PHONE,
    done: [],
    planId: plan.id,
    screen: updated ? s.phone.screen : 'lock',
    before: updated ? s.phone.before : student ? { ...student.mastery } : null,
    lastDone: updated ? s.phone.lastDone : null,
    updated,
  };
}

export function editPlan(state: DemoState, planId: string, index: number, change: { time?: string; remove?: boolean }): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be edited.');
  const session = plan.sessions[index];
  if (!session) return fail('No such session.');
  if (change.remove) {
    if (session.isMasteryCheck) return fail('The mastery check stays in the plan.');
    if (plan.sessions.length === 1) return fail('A plan needs at least one session.');
    plan.sessions.splice(index, 1);
    return done(s);
  }
  if (change.time !== undefined) {
    if (parseTime(change.time) === null) return fail('Time must be HH:MM.');
    session.time = change.time;
  }
  return done(s);
}

export function approvePlan(state: DemoState, planId: string): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be approved.');
  if (plan.kind === 'pathway') {
    plan.status = 'sent';
    deliver(s, plan, false);
    const name = studentById(s, plan.studentIds[0])?.short ?? 'the student';
    const first = plan.sessions[0];
    say(s, plan.conversationId, `Sent to ${name}’s phone. The first session, “${first.title}”, starts at ${first.time}. I’ll check back after the mastery check.`);
  } else {
    plan.status = 'approved';
    say(s, plan.conversationId, plan.kind === 'classActivity'
      ? `Scheduled: “${plan.title}” on ${plan.day}, for ${plan.studentIds.length} students. I’ll report back after it runs.`
      : `Booked. ${plan.sessions.length} check-in invitations for ${plan.day} are on their way, and automated plans for these students stay paused until you’ve met.`);
  }
  return done(s);
}

export function dismissPlan(state: DemoState, planId: string): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be set aside.');
  plan.status = 'dismissed';
  say(s, plan.conversationId, `Okay, I’ve set “${plan.title}” aside. Ask me again whenever you want a new plan.`);
  return done(s);
}

/** The bank items of the session open on the phone. */
export function currentItems(s: DemoState): BankItem[] {
  const plan = planById(s, s.phone.planId);
  const session = plan && s.phone.session !== null ? plan.sessions[s.phone.session] : null;
  return session?.concept ? sessionItems(session.concept, session.isMasteryCheck) : [];
}

const clearItem = { hinted: false, result: null, lastOption: null } as const;

export function phoneShowPlan(state: DemoState): Result {
  if (!state.phone.planId) return fail('No plan on the phone.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, ...clearItem, screen: 'plan', session: null, item: 0 };
  return done(s);
}

function moveClockTo(s: DemoState, plan: Plan, time: string) {
  const t = parseTime(time);
  if (plan.day === 'Today' && t !== null && t > s.clock) s.clock = t;
}

export function phoneOpen(state: DemoState, index: number): Result {
  const s = structuredClone(state);
  const plan = planById(s, s.phone.planId);
  const session = plan?.sessions[index];
  if (!plan || !session) return fail('No such session.');
  if (s.phone.done.includes(index)) return fail('That session is already done.');
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, ...clearItem, screen: 'practice', session: index, item: 0 };
  return done(s);
}

function record(s: DemoState, student: StudentProfile, item: BankItem, outcome: string) {
  const n = student.evidence.filter((e) => e.kind === 'practice').length + 1;
  student.evidence.push({
    id: `${student.id}-practice-${n}`, kind: 'practice', source: 'Beyond practice', when: fmt(s.clock), concept: item.concept,
    text: `${conceptById(item.concept).label}: “${item.prompt}” · ${outcome}`,
  });
}

export function phoneAnswer(state: DemoState, option: number): Result {
  const s = structuredClone(state);
  if (s.phone.screen !== 'practice') return fail('No practice open.');
  const item = currentItems(s)[s.phone.item];
  if (!item) return fail('No item to answer.');
  if (s.phone.result === 'right') return fail('Already answered.');
  if (!Number.isInteger(option) || option < 0 || option >= item.options.length) return fail('No such option.');
  const student = studentById(s, planById(s, s.phone.planId)!.studentIds[0])!;
  const correct = option === item.correct;
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, s.phone.hinted);
  student.status = statusFor(student.mastery);
  record(s, student, item, correct ? (s.phone.hinted ? 'correct after a hint' : 'correct first try') : `chose ${item.options[option]}`);
  s.phone = { ...s.phone, result: correct ? 'right' : 'wrong', lastOption: option, hinted: s.phone.hinted || !correct };
  return done(s);
}

export function phoneNext(state: DemoState): Result {
  if (state.phone.result !== 'right') return fail('Answer the item first.');
  const s = structuredClone(state);
  const next = s.phone.item + 1;
  if (next < currentItems(s).length) {
    s.phone = { ...s.phone, ...clearItem, item: next };
    return done(s);
  }
  const plan = planById(s, s.phone.planId)!;
  const index = s.phone.session!;
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, ...clearItem, done: [...s.phone.done, index], session: null, item: 0, screen: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
  s.clock = Math.max(s.clock, TONIGHT);
  plan.status = 'done';
  s.phone.lastDone = plan.id;
  return done(s, true);
}

/** "Skip to tonight": earlier sessions count as done, each item correct after a hint. */
export function phoneSkip(state: DemoState): Result {
  const s = structuredClone(state);
  const plan = planById(s, s.phone.planId);
  if (!plan) return fail('No plan on the phone.');
  const checkIndex = plan.sessions.findIndex((x) => x.isMasteryCheck);
  const student = studentById(s, plan.studentIds[0])!;
  plan.sessions.forEach((session, i) => {
    if (i >= checkIndex || s.phone.done.includes(i) || !session.concept) return;
    for (const item of sessionItems(session.concept, false)) {
      student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], true, true);
      record(s, student, item, 'correct after a hint (skipped ahead)');
    }
    s.phone.done = [...s.phone.done, i];
  });
  student.status = statusFor(student.mastery);
  if (checkIndex >= 0) moveClockTo(s, plan, plan.sessions[checkIndex].time);
  return done(s);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/live/reducer.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/live/reducer.ts src/live/reducer.test.ts
git commit -m "feat(live): pure transitions for plans and the phone flow"
```

---

### Task 6: Anthropic client wrapper and the agent tool-use loop

**Files:**
- Modify: `package.json` (add `@anthropic-ai/sdk`), `tsconfig.json` (include `server`), `vite.config.ts` (test include `server/**/*.test.ts`)
- Create: `server/agents/client.ts`, `server/agents/loop.ts`, `server/agents/fakeClient.ts`
- Test: `server/agents/loop.test.ts`

**Interfaces:**
- Produces:
  - `type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming`, `type AgentMessage = Anthropic.Beta.BetaMessage`
  - `interface MessagesClient { create(params: CreateParams, options?: { signal?: AbortSignal }): Promise<AgentMessage> }`
  - `model(): string`, `request(system, tools, messages): CreateParams`, `anthropicClient(): MessagesClient | null`
  - `type Check<T>`, `interface AgentSpec<T> { system; tools; finish; check; exec; label }`, `interface RunOptions { onStep; signal?; maxTurns? }`, `class AgentError`, `runAgent<T>(client, spec, messages, opts): Promise<T>`
  - test helpers `fakeClient(turns: FakeBlock[][]): { client; calls: CreateParams[] }`, `failingClient(message?)`, `refusingClient`

- [ ] **Step 1: Install the SDK and include `server/` in typecheck and tests**

Run: `npm install @anthropic-ai/sdk@1.3.0`

In `tsconfig.json`, change the `include` line to:

```json
  "include": ["src", "scripts", "server", "vite.config.ts"]
```

In `vite.config.ts`, change the `test` line to:

```ts
  test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'] },
```

- [ ] **Step 2: Write the failing test**

Create `server/agents/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { failingClient, fakeClient, refusingClient } from './fakeClient';
import { AgentError, runAgent, type AgentSpec } from './loop';

const schema = (prop: string) => ({ type: 'object' as const, properties: { [prop]: { type: 'string' } }, required: [prop], additionalProperties: false });

const spec = (over: Partial<AgentSpec<string>> = {}): AgentSpec<string> => ({
  system: 'You are a test agent.',
  tools: [
    { name: 'lookup', description: 'Look something up', input_schema: schema('q'), strict: true },
    { name: 'done', description: 'Finish', input_schema: schema('answer'), strict: true },
  ],
  finish: 'done',
  check: (input) => {
    const a = (input as { answer?: unknown }).answer;
    return typeof a === 'string' && a !== 'bad' ? { ok: true, value: a } : { ok: false, error: 'answer must not be "bad"' };
  },
  exec: (name, input) => ({ name, echo: input.q }),
  label: (name, input) => `Agent · ${name} ${String(input.q)}`,
  ...over,
});
const user = [{ role: 'user' as const, content: 'question' }];
const quiet = { onStep: () => {} };

describe('runAgent', () => {
  it('runs read tools, reports steps and returns the checked finish input', async () => {
    const { client, calls } = fakeClient([[{ tool: 'lookup', input: { q: 'x' } }], [{ tool: 'done', input: { answer: '42' } }]]);
    const steps: string[] = [];
    await expect(runAgent(client, spec(), user, { onStep: (l) => steps.push(l) })).resolves.toBe('42');
    expect(steps).toEqual(['Agent · lookup x']);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1_0', content: JSON.stringify({ name: 'lookup', echo: 'x' }) }],
    });
  });
  it('sends the cached system prompt and the refusal fallback, with auto tool choice', async () => {
    const { client, calls } = fakeClient([[{ tool: 'done', input: { answer: 'ok' } }]]);
    await runAgent(client, spec(), user, quiet);
    const p = calls[0];
    expect(p.system).toEqual([{ type: 'text', text: 'You are a test agent.', cache_control: { type: 'ephemeral' } }]);
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.tool_choice).toBeUndefined();
    expect(p.model).toBe(process.env.BEYOND_MODEL ?? 'claude-sonnet-5-5');
  });
  it('returns an error result for an invalid finish input once, then accepts a fix', async () => {
    const { client, calls } = fakeClient([[{ tool: 'done', input: { answer: 'bad' } }], [{ tool: 'done', input: { answer: 'good' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).resolves.toBe('good');
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1_0', content: 'answer must not be "bad"', is_error: true }],
    });
  });
  it('gives up after a second invalid finish input', async () => {
    const { client } = fakeClient([[{ tool: 'done', input: { answer: 'bad' } }], [{ tool: 'done', input: { answer: 'bad' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).rejects.toThrow(AgentError);
  });
  it('nudges once when a turn ends without the finish tool', async () => {
    const { client, calls } = fakeClient([[{ text: 'Here you go.' }], [{ tool: 'done', input: { answer: 'ok' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).resolves.toBe('ok');
    expect(calls[1].messages.at(-1)).toEqual({ role: 'user', content: 'Finish by calling the done tool.' });
    const twice = fakeClient([[{ text: 'a' }], [{ text: 'b' }]]);
    await expect(runAgent(twice.client, spec(), user, quiet)).rejects.toThrow('no done call');
  });
  it('turns a failing read tool into an error result', async () => {
    const { client, calls } = fakeClient([[{ tool: 'lookup', input: { q: 'x' } }], [{ tool: 'done', input: { answer: 'ok' } }]]);
    await runAgent(client, spec({ exec: () => { throw new Error('Unknown student id s99.'); } }), user, quiet);
    expect(calls[1].messages.at(-1)).toMatchObject({ content: [{ is_error: true, content: 'Unknown student id s99.' }] });
  });
  it('stops on refusals, API errors and the turn cap', async () => {
    await expect(runAgent(refusingClient, spec(), user, quiet)).rejects.toThrow('refusal');
    await expect(runAgent(failingClient(), spec(), user, quiet)).rejects.toThrow('ECONNREFUSED');
    const loop = fakeClient(Array.from({ length: 3 }, () => [{ tool: 'lookup', input: { q: 'x' } }]));
    await expect(runAgent(loop.client, spec(), user, { ...quiet, maxTurns: 3 })).rejects.toThrow('too many turns');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/agents/loop.test.ts`
Expected: FAIL — cannot resolve `./fakeClient`.

- [ ] **Step 4: Write `server/agents/client.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';

export type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;
export type AgentMessage = Anthropic.Beta.BetaMessage;

/** The one model call the agents make; tests pass a fake. */
export interface MessagesClient {
  create(params: CreateParams, options?: { signal?: AbortSignal }): Promise<AgentMessage>;
}

/** Read at call time so `.env.local` (loaded by server/env.ts) applies. */
export const model = (): string => process.env.BEYOND_MODEL ?? 'claude-sonnet-5-5';
const effort = (): 'low' | 'medium' | 'high' => {
  const e = process.env.BEYOND_EFFORT;
  return e === 'low' || e === 'high' ? e : 'medium';
};

/** Every agent request: cached static system prompt, strict tools, auto tool choice, server-side refusal fallback. */
export function request(system: string, tools: Anthropic.Beta.BetaTool[], messages: Anthropic.Beta.BetaMessageParam[]): CreateParams {
  return {
    model: model(),
    max_tokens: 8000,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools,
    messages,
    output_config: { effort: effort() },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

/** The real client, or null when the booth runs offline (BEYOND_OFFLINE=1 or no usable credentials). */
export function anthropicClient(): MessagesClient | null {
  if (process.env.BEYOND_OFFLINE === '1') return null;
  try {
    const sdk = new Anthropic({ timeout: 25_000, maxRetries: 1 });
    return { create: (params, options) => sdk.beta.messages.create(params, options) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Write `server/agents/loop.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { request, type MessagesClient } from './client';

export type Check<T> = (input: unknown) => { ok: true; value: T } | { ok: false; error: string };

export interface AgentSpec<T> {
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  /** The tool whose call ends the run; its checked input is the result. */
  finish: string;
  check: Check<T>;
  /** Runs a read tool. Throwing sends an error result back to the model. */
  exec(name: string, input: Record<string, unknown>): unknown;
  /** Thinking-line copy for a tool call, or null to show nothing. */
  label(name: string, input: Record<string, unknown>): string | null;
}

export interface RunOptions {
  onStep(line: string): void;
  signal?: AbortSignal;
  maxTurns?: number;
}

export class AgentError extends Error {}

/** Manual tool-use loop: read tools run locally until the model calls `spec.finish` with an input that passes `spec.check`. */
export async function runAgent<T>(client: MessagesClient, spec: AgentSpec<T>, messages: Anthropic.Beta.BetaMessageParam[], opts: RunOptions): Promise<T> {
  const history = [...messages];
  let finishRetries = 1;
  let nudged = false;
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const res = await client.create(request(spec.system, spec.tools, history), { signal: opts.signal });
    if (res.stop_reason === 'refusal') throw new AgentError('refusal');
    if (res.stop_reason === 'max_tokens') throw new AgentError('max_tokens');
    // Append the full content (thinking blocks included) so the history stays append-only.
    history.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (uses.length === 0) {
      if (nudged) throw new AgentError(`no ${spec.finish} call`);
      nudged = true;
      history.push({ role: 'user', content: `Finish by calling the ${spec.finish} tool.` });
      continue;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      if (use.name === spec.finish) {
        const checked = spec.check(input);
        if (checked.ok) return checked.value;
        if (finishRetries-- <= 0) throw new AgentError(checked.error);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: checked.error, is_error: true });
        continue;
      }
      const line = spec.label(use.name, input);
      if (line) opts.onStep(line);
      try {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(spec.exec(use.name, input)) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: e instanceof Error ? e.message : String(e), is_error: true });
      }
    }
    history.push({ role: 'user', content: results });
  }
  throw new AgentError('too many turns');
}
```

- [ ] **Step 6: Write `server/agents/fakeClient.ts`**

```ts
import type { AgentMessage, CreateParams, MessagesClient } from './client';

export type FakeBlock = { tool: string; input: Record<string, unknown> } | { text: string };

const message = (n: number, content: unknown[], stop: string): AgentMessage =>
  ({
    id: `msg_${n}`, type: 'message', role: 'assistant', model: 'fake', content,
    stop_reason: stop, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
  }) as unknown as AgentMessage;

/** Replays one scripted assistant turn per request and records a copy of every request. */
export function fakeClient(turns: FakeBlock[][]) {
  const calls: CreateParams[] = [];
  let n = 0;
  const client: MessagesClient = {
    async create(params) {
      calls.push(structuredClone(params));
      const turn = turns[n++];
      if (!turn) throw new Error('fake client: script exhausted');
      const content = turn.map((b, i) =>
        'tool' in b ? { type: 'tool_use', id: `tu_${n}_${i}`, name: b.tool, input: b.input } : { type: 'text', text: b.text, citations: null });
      return message(n, content, content.some((c) => c.type === 'tool_use') ? 'tool_use' : 'end_turn');
    },
  };
  return { client, calls };
}

/** Every request fails, like an unreachable API. */
export const failingClient = (text = 'connect ECONNREFUSED'): MessagesClient => ({
  create: async () => {
    throw new Error(text);
  },
});

/** Every request is declined by the safety classifiers. */
export const refusingClient: MessagesClient = { create: async () => message(0, [], 'refusal') };
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run server/agents/loop.test.ts`
Expected: PASS (7 tests).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts server/agents
git commit -m "feat(server): Anthropic client wrapper and agent tool-use loop"
```

---

### Task 7: Student Analysis Agent read tools and thinking-line labels

**Files:**
- Create: `server/agents/tools.ts`
- Test: `server/agents/tools.test.ts`

**Interfaces:**
- Consumes: `DemoState`, `classKpis`, `topicMastery`, `fmt` (Task 1); `GROUPS`; `CONCEPTS`, `conceptById`; `TWIN_FOCUS`.
- Produces: `CONCEPT_IDS: ConceptId[]`, `obj(properties)` (strict object schema), `tool(name, description, properties): BetaTool`, `READ_TOOLS: BetaTool[]`, `readTool(state, name, input): unknown`, `readLabel(state, name, input): string | null`.

- [ ] **Step 1: Write the failing test**

Create `server/agents/tools.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seedState } from '../../src/live/seed';
import { READ_TOOLS, readLabel, readTool } from './tools';

const state = seedState();
const find = (input: Record<string, unknown>) =>
  readTool(state, 'find_students', { status: '', concept: '', below: -1, name: '', ...input }) as Array<Record<string, unknown>>;

describe('read tools', () => {
  it('are strict object schemas', () => {
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students']);
    for (const t of READ_TOOLS) {
      expect(t.strict).toBe(true);
      expect(t.input_schema.additionalProperties).toBe(false);
    }
  });
  it('overview reports KPIs, group figures and class evidence', () => {
    const o = readTool(state, 'get_class_overview', {}) as Record<string, unknown>;
    expect(o).toMatchObject({ needSupport: 12, highRisk: 5, escalated: [{ id: 's29' }, { id: 's42' }, { id: 's51' }], now: '15:00' });
    expect(Object.keys(o.topicMasteryByGroup as object)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5']);
    expect((o.evidence as { id: string }[]).map((e) => e.id)).toContain('class-quiz2-q4');
  });
  it('finds students by status, concept threshold and accent-insensitive name', () => {
    expect(find({ status: 'escalated' }).map((s) => s.id)).toEqual(['s29', 's42', 's51']);
    const weak = find({ concept: 'implication', below: 0.35 });
    expect(weak.length).toBeGreaterThan(0);
    for (const s of weak) expect(s.implication as number).toBeLessThan(0.35);
    expect(find({ name: 'nguyen minh anh' }).map((s) => s.id)).toEqual(['s17']);
  });
  it('reads one twin with gaps, and fails clearly on an unknown id', () => {
    const t = readTool(state, 'get_student', { student_id: 's17' }) as Record<string, unknown>;
    expect(t).toMatchObject({ name: 'Nguyễn Minh Anh', group: 'G4', gaps: ['implication', 'biconditional', 'equivalence'], plans: [] });
    expect(() => readTool(state, 'get_student', { student_id: 's99' })).toThrow('Unknown student id s99.');
  });
  it('filters evidence by kind and compares students', () => {
    expect(readTool(state, 'get_evidence', { student_id: 's17', kind: 'message' })).toHaveLength(2);
    expect(readTool(state, 'get_evidence', { student_id: 's17', kind: '' })).toHaveLength(8);
    expect(readTool(state, 'compare_students', { student_ids: ['s17', 's29'] })).toHaveLength(2);
  });
  it('labels each call as a thinking line', () => {
    expect(readLabel(state, 'get_class_overview', {})).toBe('Student Analysis Agent · reading the class overview');
    expect(readLabel(state, 'get_student', { student_id: 's17' })).toBe('Student Analysis Agent · reading Minh Anh’s learning twin');
    expect(readLabel(state, 'get_evidence', { student_id: 's17', kind: 'quiz' })).toBe('Student Analysis Agent · reading Minh Anh’s quiz responses');
    expect(readLabel(state, 'find_students', { status: '', concept: 'implication', below: 0.35, name: '' })).toBe('Student Analysis Agent · finding students below 0.35 on Implication');
    expect(readLabel(state, 'find_students', { status: 'escalated', concept: '', below: -1, name: '' })).toBe('Student Analysis Agent · searching the class');
    expect(readLabel(state, 'compare_students', { student_ids: ['s1', 's2', 's3'] })).toBe('Student Analysis Agent · comparing 3 learning twins');
    expect(readLabel(state, 'report', {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/agents/tools.test.ts`
Expected: FAIL — cannot resolve `./tools`.

- [ ] **Step 3: Write `server/agents/tools.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { classKpis, topicMastery } from '../../src/live/mastery';
import type { DemoState, EvidenceKind, StudentProfile } from '../../src/live/types';
import { GROUPS } from '../../src/scenario/classroom';
import { CONCEPTS, conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';

export const CONCEPT_IDS: ConceptId[] = CONCEPTS.map((c) => c.id);

/** Strict object schema: every property required, nothing else allowed. */
export const obj = (properties: Record<string, unknown>) => ({
  type: 'object' as const, properties, required: Object.keys(properties), additionalProperties: false,
});

export const tool = (name: string, description: string, properties: Record<string, unknown>): Anthropic.Beta.BetaTool => ({
  name, description, input_schema: obj(properties), strict: true,
});

const EVIDENCE_KINDS: EvidenceKind[] = ['quiz', 'activity', 'attendance', 'message', 'taNote', 'record', 'practice'];

export const READ_TOOLS: Anthropic.Beta.BetaTool[] = [
  tool('get_class_overview', 'Class KPIs, average mastery per concept, Week 6 topic mastery per tutorial group, the escalation list and class-level evidence (with ids you can cite).', {}),
  tool('find_students', 'List students matching filters (use "" or -1 to leave a filter out). Returns id, name, group, status, escalation and topic mastery, plus the filtered concept value.', {
    status: { type: 'string', enum: ['', 'onTrack', 'support', 'highRisk', 'escalated'] },
    concept: { type: 'string', enum: ['', ...CONCEPT_IDS] },
    below: { type: 'number', description: 'With concept: only students below this mastery (0–1). -1 for no limit.' },
    name: { type: 'string', description: 'Part of a name (accents optional), or "".' },
  }),
  tool('get_student', "One student's learning twin: mastery per concept, status, quiz scores, practice per week, gaps (focus concepts below 0.50) and plans.", {
    student_id: { type: 'string' },
  }),
  tool('get_evidence', "A student's evidence entries (quiz items, LMS activity, attendance, messages, TA notes, records, practice). Cite entries by id.", {
    student_id: { type: 'string' },
    kind: { type: 'string', enum: ['', ...EVIDENCE_KINDS] },
  }),
  tool('compare_students', 'Mastery per concept for several students side by side.', {
    student_ids: { type: 'array', items: { type: 'string' } },
  }),
];

const round2 = (v: number) => Math.round(v * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

function studentOf(state: DemoState, id: unknown): StudentProfile {
  const s = state.students.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown student id ${String(id)}. Use find_students to look ids up.`);
  return s;
}

function overview(state: DemoState) {
  const k = classKpis(state.students);
  return {
    course: 'Discrete Mathematics · DM-2026 · Week 6 (logical equivalence)',
    now: fmt(state.clock),
    students: k.students,
    needSupport: k.needSupport,
    highRisk: k.highRisk,
    avgTopicMastery: k.avgMastery,
    escalated: state.students.filter((s) => s.escalated).map((s) => ({ id: s.id, name: s.name })),
    conceptAverages: Object.fromEntries(CONCEPT_IDS.map((c) => [c, round2(mean(state.students.map((s) => s.mastery[c])))])),
    topicMasteryByGroup: Object.fromEntries(GROUPS.map((g) => [g, round2(mean(state.students.filter((s) => s.group === g).map((s) => topicMastery(s.mastery))))])),
    evidence: state.classEvidence,
  };
}

function find(state: DemoState, input: Record<string, unknown>) {
  let list = state.students;
  const status = String(input.status ?? '');
  if (status === 'escalated') list = list.filter((s) => s.escalated);
  else if (status) list = list.filter((s) => s.status === status);
  const name = fold(String(input.name ?? ''));
  if (name) list = list.filter((s) => fold(s.name).includes(name));
  const concept = CONCEPT_IDS.find((c) => c === input.concept);
  const below = Number(input.below ?? -1);
  if (concept && below >= 0) list = list.filter((s) => s.mastery[concept] < below);
  return list.slice(0, 25).map((s) => ({
    id: s.id, name: s.name, group: s.group, status: s.status, escalated: s.escalated, topicMastery: topicMastery(s.mastery),
    ...(concept ? { [concept]: s.mastery[concept] } : {}),
  }));
}

function twin(state: DemoState, s: StudentProfile) {
  return {
    id: s.id, name: s.name, group: s.group, status: s.status, escalated: s.escalated, mastery: s.mastery,
    quiz: s.quiz, practicePerWeek: s.practicePerWeek,
    gaps: TWIN_FOCUS.filter((c) => s.mastery[c] < 0.5),
    evidenceCount: s.evidence.length,
    plans: state.plans.filter((p) => p.studentIds.includes(s.id)).map((p) => ({ id: p.id, kind: p.kind, title: p.title, status: p.status })),
  };
}

/** Executes a read tool against a state snapshot. Throws (→ error tool result) on bad input. */
export function readTool(state: DemoState, name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case 'get_class_overview': return overview(state);
    case 'find_students': return find(state, input);
    case 'get_student': return twin(state, studentOf(state, input.student_id));
    case 'get_evidence': {
      const s = studentOf(state, input.student_id);
      return s.evidence.filter((e) => !input.kind || e.kind === input.kind);
    }
    case 'compare_students':
      return (Array.isArray(input.student_ids) ? input.student_ids : []).map((id) => {
        const s = studentOf(state, id);
        return { id: s.id, name: s.name, mastery: s.mastery };
      });
    default: throw new Error(`Unknown tool ${name}.`);
  }
}

const KIND_LABEL: Record<EvidenceKind, string> = {
  quiz: 'quiz responses', activity: 'LMS activity', attendance: 'attendance', message: 'messages', taNote: 'TA notes', record: 'academic records', practice: 'practice results',
};

/** The thinking line shown for a read tool call. */
export function readLabel(state: DemoState, name: string, input: Record<string, unknown>): string | null {
  const who = (id: unknown) => state.students.find((s) => s.id === id)?.short ?? 'a student';
  const p = 'Student Analysis Agent ·';
  switch (name) {
    case 'get_class_overview': return `${p} reading the class overview`;
    case 'find_students': {
      const concept = CONCEPT_IDS.find((c) => c === input.concept);
      return concept && Number(input.below) >= 0 ? `${p} finding students below ${Number(input.below)} on ${conceptById(concept).label}` : `${p} searching the class`;
    }
    case 'get_student': return `${p} reading ${who(input.student_id)}’s learning twin`;
    case 'get_evidence': return `${p} reading ${who(input.student_id)}’s ${KIND_LABEL[input.kind as EvidenceKind] ?? 'evidence'}`;
    case 'compare_students': return `${p} comparing ${Array.isArray(input.student_ids) ? input.student_ids.length : 0} learning twins`;
    default: return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/agents/tools.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/agents/tools.ts server/agents/tools.test.ts
git commit -m "feat(server): read tools over the class data and thinking-line labels"
```

---

### Task 8: The three agents (Student Analysis, Teaching Assistance, Adapt)

**Files:**
- Create: `server/agents/sas.ts`, `server/agents/tas.ts`, `server/agents/adapt.ts`, `server/agents/samples.ts`
- Test: `server/agents/agents.test.ts`

**Interfaces:**
- Consumes: `runAgent`, `AgentSpec`, `Check` (Task 6); `READ_TOOLS`, `readTool`, `readLabel`, `obj`, `tool`, `CONCEPT_IDS` (Task 7); `planProblems`, `withinFollowUpPolicy` (Task 4); `studentById` (Task 5); `BANK_CONCEPTS` (Task 3).
- Produces:
  - `sas.ts`: `type Focus`, `interface Report { title; blocks; focus; gaps; needsPlan; revisePlan; followUps }`, `interface Turn { role: 'user' | 'assistant'; text: string }`, `BLOCKS_SCHEMA`, `SAS_SYSTEM`, `evidenceIds(state)`, `checkBlocks(state, raw)`, `checkReport(state): Check<Report>`, `sasSpec(state): AgentSpec<Report>`, `planBrief(plan)`, `sasMessages(history, question, state, openPlan)`
  - `tas.ts`: `SESSIONS_SCHEMA`, `TAS_SYSTEM`, `toPlan(input, meta): Plan`, `checkPlan(state, planId, conversationId): Check<Plan>`, `tasLabel(state, name, input)`, `tasSpec(state, conversationId, planId): AgentSpec<Plan>`, `tasMessages(state, question, report, openPlan)`
  - `adapt.ts`: `interface AdaptResult { blocks: LiveBlock[]; followUp: Plan | null }`, `ADAPT_SYSTEM`, `checkAdapt(state, plan, followUpId)`, `adaptSpec(state, plan, followUpId)`, `adaptMessages(state, plan, before)`
  - `samples.ts` (tests only): `reportInput(over?)`, `pathwaySessions(first?)`, `planInput(over?)`, `adaptInput(sessions, over?)`

- [ ] **Step 1: Write the sample tool inputs used by the tests**

Create `server/agents/samples.ts`:

```ts
/** Valid finish-tool inputs as the model would send them (tests only). */
export const reportInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Minh Anh · implication gap',
  blocks: [
    { kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] },
    { kind: 'li', text: 'She picked the converse on 6 implication items.', cites: ['s17-quiz2-q4'] },
  ],
  focus_kind: 'student',
  focus_student_id: 's17',
  gaps: ['implication', 'nonsense'],
  needs_plan: true,
  revise_plan: false,
  follow_ups: ['What gap is the class facing this week?', 'Show her attendance', 'Who else picked the converse?', 'One too many'],
  ...over,
});

export const pathwaySessions = (first = '15:30') => [
  { time: first, title: 'Review implication', minutes: 8, concept: 'implication', is_mastery_check: false, student_id: '' },
  { time: '20:00', title: 'Mastery check', minutes: 10, concept: 'equivalence', is_mastery_check: true, student_id: '' },
];

export const planInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: 'pathway',
  title: 'Rebuild implication, then equivalence',
  student_ids: ['s17'],
  day: 'Today',
  sessions: pathwaySessions(),
  rationale: 'Implication is the root gap.',
  outcome: 'Logical equivalence mastery ≥ 0.75 within 3 sessions',
  ...over,
});

const followUpSessions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    time: `${String(9 + i * 3).padStart(2, '0')}:00`, title: i === n - 1 ? 'Mastery check' : 'Equivalence laws practice',
    minutes: 8, concept: 'equivLaws', is_mastery_check: i === n - 1, student_id: '',
  }));

export const adaptInput = (sessions: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  blocks: [{ kind: 'p', text: 'Minh Anh passed tonight’s mastery check: logical equivalence **0.35 → 0.71**.', cites: [] }],
  follow_up_needed: sessions > 0,
  follow_up: { title: 'Equivalence laws in practice', day: 'Tomorrow', sessions: followUpSessions(sessions), rationale: 'One gap remains.', outcome: 'Equivalence laws ≥ 0.60' },
  ...over,
});
```

- [ ] **Step 2: Write the failing test**

Create `server/agents/agents.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../../src/live/fixtures';
import { MASTERY_INITIAL } from '../../src/scenario/minhAnh';
import { adaptMessages, adaptSpec } from './adapt';
import { fakeClient } from './fakeClient';
import { runAgent } from './loop';
import { adaptInput, pathwaySessions, planInput, reportInput } from './samples';
import { SAS_SYSTEM, sasMessages, sasSpec, type Report } from './sas';
import { tasMessages, tasSpec } from './tas';

const quiet = { onStep: () => {} };
const ask = [{ role: 'user' as const, content: 'x' }];

describe('Student Analysis Agent', () => {
  const state = stateWithPlan();

  it('reads the twin and returns a cited report', async () => {
    const { client } = fakeClient([[{ tool: 'get_student', input: { student_id: 's17' } }], [{ tool: 'report', input: reportInput() }]]);
    const steps: string[] = [];
    const r = await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), { onStep: (l) => steps.push(l) });
    expect(steps).toEqual(['Student Analysis Agent · reading Minh Anh’s learning twin']);
    expect(r).toMatchObject({ title: 'Minh Anh · implication gap', focus: { kind: 'student', studentId: 's17' }, needsPlan: true, revisePlan: false, gaps: ['implication'] });
    expect(r.followUps).toHaveLength(3);
    expect(r.blocks[0]).toEqual({ kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] });
  });
  it('sends invented evidence ids back once', async () => {
    const bad = reportInput({ blocks: [{ kind: 'p', text: 'x', cites: ['s17-made-up'] }] });
    const { client, calls } = fakeClient([[{ tool: 'report', input: bad }], [{ tool: 'report', input: reportInput() }]]);
    await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('These evidence ids do not exist: s17-made-up');
  });
  it('rejects an unknown focus student', async () => {
    const { client, calls } = fakeClient([[{ tool: 'report', input: reportInput({ focus_student_id: 's99' }) }], [{ tool: 'report', input: reportInput() }]]);
    await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('is not a student id');
  });
  it('keeps volatile context out of the cached system prompt', () => {
    const m = sasMessages([{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }], 'And now?', state, state.plans[0]);
    expect(m).toHaveLength(3);
    expect(String(m[2].content)).toContain('Story time: 15:00');
    expect(String(m[2].content)).toContain('"id":"p1"');
    expect(String(m[2].content)).toContain('Lecturer: And now?');
    expect(SAS_SYSTEM).not.toContain('15:00');
  });
});

describe('Teaching Assistance Agent', () => {
  const state = stateWithPlan();

  it('turns propose_plan into a proposed Plan', async () => {
    const { client } = fakeClient([[{ tool: 'propose_plan', input: planInput() }]]);
    const plan = await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(plan).toMatchObject({ id: 'p9', conversationId: 'c1', status: 'proposed', kind: 'pathway', studentIds: ['s17'] });
    expect(plan.sessions[0]).toEqual({ time: '15:30', title: 'Review implication', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null });
  });
  it('sends policy problems back and accepts the fix', async () => {
    const early = planInput({ sessions: pathwaySessions('14:00') });
    const { client, calls } = fakeClient([[{ tool: 'propose_plan', input: early }], [{ tool: 'propose_plan', input: planInput() }]]);
    await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('Session 1 at 14:00 is not after now (15:00).');
  });
  it('fills check-in student ids from the sessions', async () => {
    const checkIns = planInput({
      kind: 'checkIns', student_ids: [], day: 'Friday',
      sessions: [{ time: '14:00', title: 'Check-in', minutes: 15, concept: 'none', is_mastery_check: false, student_id: 's29' }],
    });
    const { client } = fakeClient([[{ tool: 'propose_plan', input: checkIns }]]);
    const plan = await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(plan.studentIds).toEqual(['s29']);
    expect(plan.sessions[0].concept).toBeNull();
  });
  it('briefs the agent with the diagnosis, practice concepts and the open plan', () => {
    const report: Report = {
      title: 't', blocks: [{ kind: 'li', text: 'Converse on 6 items', cites: [] }], focus: { kind: 'student', studentId: 's17' },
      gaps: ['implication'], needsPlan: true, revisePlan: true, followUps: [],
    };
    const text = String(tasMessages(state, 'Make it shorter', report, state.plans[0])[0].content);
    expect(text).toContain('- Converse on 6 items');
    expect(text).toContain('student s17 (Nguyễn Minh Anh)');
    expect(text).toContain('equivLaws');
    expect(text).toContain('"id":"p1"');
  });
});

describe('Adapt', () => {
  const after = () => {
    const s = stateWithPlan('pathway', { status: 'done' });
    s.clock = 20 * 60 + 40;
    s.students[16].mastery.equivalence = 0.71;
    return s;
  };

  it('auto-approves a follow-up of up to 3 sessions', async () => {
    const s = after();
    const { client } = fakeClient([[{ tool: 'adapt_report', input: adaptInput(3) }]]);
    const r = await runAgent(client, adaptSpec(s, s.plans[0], 'p2'), adaptMessages(s, s.plans[0], MASTERY_INITIAL), quiet);
    expect(r.followUp).toMatchObject({ id: 'p2', status: 'autoApproved', day: 'Tomorrow', studentIds: ['s17'], conversationId: 'c1' });
    expect(r.blocks[0].text).toContain('0.35 → 0.71');
  });
  it('leaves a bigger follow-up for the teacher, and none when not needed', async () => {
    const s = after();
    const four = fakeClient([[{ tool: 'adapt_report', input: adaptInput(4) }]]);
    expect((await runAgent(four.client, adaptSpec(s, s.plans[0], 'p2'), ask, quiet)).followUp?.status).toBe('proposed');
    const none = fakeClient([[{ tool: 'adapt_report', input: adaptInput(0) }]]);
    expect((await runAgent(none.client, adaptSpec(s, s.plans[0], 'p2'), ask, quiet)).followUp).toBeNull();
  });
  it('tells the agent what changed tonight', () => {
    const s = after();
    const text = String(adaptMessages(s, s.plans[0], MASTERY_INITIAL)[0].content);
    expect(text).toContain('Logical equivalence 0.35 → 0.71');
    expect(text).toContain('call them Minh Anh');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/agents/agents.test.ts`
Expected: FAIL — cannot resolve `./adapt`.

- [ ] **Step 4: Write `server/agents/sas.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import type { DemoState, LiveBlock, Plan } from '../../src/live/types';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';
import type { AgentSpec, Check } from './loop';
import { CONCEPT_IDS, obj, READ_TOOLS, readLabel, readTool, tool } from './tools';

export type Focus = { kind: 'student'; studentId: string } | { kind: 'class' } | { kind: 'none' };

export interface Report {
  title: string;
  blocks: LiveBlock[];
  focus: Focus;
  gaps: ConceptId[];
  needsPlan: boolean;
  revisePlan: boolean;
  followUps: string[];
}

export interface Turn { role: 'user' | 'assistant'; text: string }

export const BLOCKS_SCHEMA = {
  type: 'array',
  description: 'Short paragraphs ("p") and bullets ("li").',
  items: obj({
    kind: { type: 'string', enum: ['p', 'li'] },
    text: { type: 'string', description: 'Plain text; **bold** allowed for key figures.' },
    cites: { type: 'array', items: { type: 'string' }, description: 'Evidence ids behind this block, exactly as the tools returned them.' },
  }),
};

const REPORT_TOOL = tool('report', 'Give your answer to the lecturer. Call this once, last.', {
  title: { type: 'string', description: '3–6 word conversation title, e.g. "Minh Anh · implication gap".' },
  blocks: BLOCKS_SCHEMA,
  focus_kind: { type: 'string', enum: ['student', 'class', 'none'] },
  focus_student_id: { type: 'string', description: 'The student id when focus_kind is "student", otherwise "".' },
  gaps: { type: 'array', items: { type: 'string', enum: CONCEPT_IDS } },
  needs_plan: { type: 'boolean', description: 'True when an intervention plan should be drafted now.' },
  revise_plan: { type: 'boolean', description: 'True when the lecturer asks to change the plan open in this conversation.' },
  follow_ups: { type: 'array', items: { type: 'string' }, description: '2–3 short questions the lecturer might ask next.' },
});

export const SAS_SYSTEM = `You are the Student Analysis Agent in Beyond, a teaching assistant for Lam (Nguyễn Thanh Lam), who lectures Discrete Mathematics (DM-2026, 55 students, Week 6: logical equivalence). All data is fictional demo data.

Answer the lecturer's question from the class data. Look things up with the tools; never invent students, figures or events. Student ids look like s17; evidence ids look like s17-quiz2-q4 or class-quiz2-q4.

Write for a busy lecturer: lead with the answer in one or two sentences, then 2–4 bullets of evidence, then one sentence on what to do next. Keep the whole answer under 140 words. Put the evidence ids behind each factual claim in that block's cites. Use **bold** for the key figures. Refer to students by name; do not assume anyone's pronouns.

Mastery runs from 0 to 1; below 0.50 on a focus concept is a gap. The Week 6 topic figure is logical equivalence. Students on the escalation list need the lecturer personally, not more automated practice.

Set needs_plan when the lecturer asks what to do, or when one student or the class has a clear gap a short intervention would address. Set revise_plan when the lecturer asks to change the plan open in this conversation. Use focus_kind "student" for a question about one student, "class" for the class or a group, and "none" otherwise.

When you have the answer, call the report tool. Always finish with report.`;

export function evidenceIds(state: DemoState): Set<string> {
  return new Set([...state.classEvidence.map((e) => e.id), ...state.students.flatMap((s) => s.evidence.map((e) => e.id))]);
}

type RawBlock = { kind?: unknown; text?: unknown; cites?: unknown };

/** Model blocks → LiveBlocks; rejects empty answers and cited ids that do not exist. */
export function checkBlocks(state: DemoState, raw: unknown): { ok: true; value: LiveBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'blocks must contain at least one paragraph.' };
  const blocks: LiveBlock[] = (raw as RawBlock[]).map((b) => ({
    kind: b.kind === 'li' ? 'li' : 'p',
    text: String(b.text ?? ''),
    cites: Array.isArray(b.cites) ? b.cites.map(String) : [],
  }));
  if (blocks.some((b) => !b.text.trim())) return { ok: false, error: 'Every block needs text.' };
  const known = evidenceIds(state);
  const unknown = blocks.flatMap((b) => b.cites).filter((id) => !known.has(id));
  if (unknown.length) return { ok: false, error: `These evidence ids do not exist: ${unknown.join(', ')}. Cite only ids returned by the tools.` };
  return { ok: true, value: blocks };
}

export const checkReport = (state: DemoState): Check<Report> => (input) => {
  const r = input as Record<string, unknown>;
  const blocks = checkBlocks(state, r.blocks);
  if (!blocks.ok) return blocks;
  let focus: Focus = { kind: 'none' };
  if (r.focus_kind === 'student') {
    if (!state.students.some((s) => s.id === r.focus_student_id)) return { ok: false, error: `focus_student_id "${String(r.focus_student_id)}" is not a student id.` };
    focus = { kind: 'student', studentId: String(r.focus_student_id) };
  } else if (r.focus_kind === 'class') focus = { kind: 'class' };
  return {
    ok: true,
    value: {
      title: String(r.title ?? '').trim() || 'Conversation',
      blocks: blocks.value,
      focus,
      gaps: (Array.isArray(r.gaps) ? r.gaps : []).filter((g): g is ConceptId => CONCEPT_IDS.includes(g as ConceptId)),
      needsPlan: r.needs_plan === true,
      revisePlan: r.revise_plan === true,
      followUps: (Array.isArray(r.follow_ups) ? r.follow_ups : []).map(String).filter(Boolean).slice(0, 3),
    },
  };
};

export const sasSpec = (state: DemoState): AgentSpec<Report> => ({
  system: SAS_SYSTEM,
  tools: [...READ_TOOLS, REPORT_TOOL],
  finish: 'report',
  check: checkReport(state),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => readLabel(state, name, input),
});

export const planBrief = (p: Plan) => ({ id: p.id, kind: p.kind, title: p.title, day: p.day, studentIds: p.studentIds, sessions: p.sessions, status: p.status });

/** Earlier turns as plain text, then the question with the volatile context, all after the cached prefix. */
export function sasMessages(history: Turn[], question: string, state: DemoState, openPlan: Plan | null): Anthropic.Beta.BetaMessageParam[] {
  const context = `Story time: ${fmt(state.clock)} on Saturday 31 October.\nOpen plan in this conversation: ${openPlan ? JSON.stringify(planBrief(openPlan)) : 'none'}.`;
  return [...history.map((t) => ({ role: t.role, content: t.text })), { role: 'user', content: `${context}\n\nLecturer: ${question}` }];
}
```

- [ ] **Step 5: Write `server/agents/tas.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { planProblems } from '../../src/live/plans';
import { studentById } from '../../src/live/reducer';
import type { DemoState, Plan, PlanKind, PlanStatus } from '../../src/live/types';
import { BANK_CONCEPTS } from '../../src/scenario/practiceBank';
import type { AgentSpec, Check } from './loop';
import { planBrief, type Report } from './sas';
import { CONCEPT_IDS, obj, READ_TOOLS, readLabel, readTool, tool } from './tools';

export const SESSIONS_SCHEMA = {
  type: 'array',
  items: obj({
    time: { type: 'string', description: 'HH:MM, 24-hour.' },
    title: { type: 'string' },
    minutes: { type: 'integer' },
    concept: { type: 'string', enum: ['none', ...CONCEPT_IDS] },
    is_mastery_check: { type: 'boolean' },
    student_id: { type: 'string', description: 'checkIns: the student for this slot; otherwise "".' },
  }),
};

const PLAN_TOOL = tool('propose_plan', 'Propose the plan. Call this once, last.', {
  kind: { type: 'string', enum: ['pathway', 'classActivity', 'checkIns'] },
  title: { type: 'string', description: 'Short plan title, e.g. "Rebuild implication, then equivalence".' },
  student_ids: { type: 'array', items: { type: 'string' } },
  day: { type: 'string', description: '"Today", "Tomorrow" or a weekday name.' },
  sessions: SESSIONS_SCHEMA,
  rationale: { type: 'string', description: 'One sentence on why this plan fits the diagnosis.' },
  outcome: { type: 'string', description: 'What success looks like, e.g. "Logical equivalence mastery ≥ 0.75 within 3 sessions".' },
});

export const TAS_SYSTEM = `You are the Teaching Assistance Agent in Beyond. The Student Analysis Agent has diagnosed a question from the lecturer, Lam (Discrete Mathematics, DM-2026, Week 6: logical equivalence). Turn the diagnosis into one plan the lecturer can approve. All data is fictional demo data.

Pick the kind:
- pathway: short adaptive practice on one student's phone. 2–4 sessions, at most 45 minutes in total, each on one concept, building prerequisites first. The last session is the mastery check on the target concept (is_mastery_check true). Sessions run 5–12 minutes.
- classActivity: an in-class activity for a group with a shared gap (for example a 15-minute recap in Thursday's tutorial), listing the affected student ids. 1–2 sessions.
- checkIns: 15-minute conversations with up to 5 students who need the lecturer personally (for example those on the escalation list). One session per student, with student_id set.

Times are 24-hour HH:MM. For day "Today", every session must be after the current story time. Use concept "none" for sessions without a practice concept (class activities and check-ins).

If an open plan is given, revise it to do what the lecturer asked and keep everything else.

You may look things up with the read tools. Then call propose_plan. Always finish with propose_plan.`;

type Meta = { id: string; conversationId: string; status: PlanStatus };

/** propose_plan input → Plan (not yet checked against the policy). */
export function toPlan(input: unknown, meta: Meta): Plan {
  const r = input as Record<string, unknown>;
  const kind: PlanKind = (['pathway', 'classActivity', 'checkIns'] as const).find((k) => k === r.kind) ?? 'pathway';
  const sessions = (Array.isArray(r.sessions) ? r.sessions : []).map((x) => {
    const s = x as Record<string, unknown>;
    return {
      time: String(s.time ?? ''),
      title: String(s.title ?? 'Session'),
      minutes: Number(s.minutes ?? 0),
      concept: CONCEPT_IDS.find((c) => c === s.concept) ?? null,
      isMasteryCheck: s.is_mastery_check === true,
      studentId: s.student_id ? String(s.student_id) : null,
    };
  });
  let studentIds = Array.isArray(r.student_ids) ? r.student_ids.map(String) : [];
  if (kind === 'checkIns' && studentIds.length === 0) studentIds = sessions.flatMap((s) => (s.studentId ? [s.studentId] : []));
  return {
    id: meta.id, kind, title: String(r.title ?? 'Plan'), studentIds, day: String(r.day ?? 'Today'), sessions,
    rationale: String(r.rationale ?? ''), outcome: String(r.outcome ?? ''), status: meta.status, conversationId: meta.conversationId,
  };
}

export const checkPlan = (state: DemoState, planId: string, conversationId: string): Check<Plan> => (input) => {
  const plan = toPlan(input, { id: planId, conversationId, status: 'proposed' });
  const problems = planProblems(plan, state);
  return problems.length
    ? { ok: false, error: `The plan breaks the policy: ${problems.join(' ')} Fix it and call propose_plan again.` }
    : { ok: true, value: plan };
};

/** Read-tool labels, attributed to this agent. */
export const tasLabel = (state: DemoState, name: string, input: Record<string, unknown>): string | null =>
  readLabel(state, name, input)?.replace('Student Analysis Agent', 'Teaching Assistance Agent') ?? null;

export const tasSpec = (state: DemoState, conversationId: string, planId: string): AgentSpec<Plan> => ({
  system: TAS_SYSTEM,
  tools: [...READ_TOOLS, PLAN_TOOL],
  finish: 'propose_plan',
  check: checkPlan(state, planId, conversationId),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => tasLabel(state, name, input),
});

export function tasMessages(state: DemoState, question: string, report: Report, openPlan: Plan | null): Anthropic.Beta.BetaMessageParam[] {
  const focus = report.focus.kind === 'student'
    ? `student ${report.focus.studentId} (${studentById(state, report.focus.studentId)?.name ?? 'unknown'})`
    : report.focus.kind;
  const lines = [
    `Lecturer's question: ${question}`,
    `Diagnosis from the Student Analysis Agent:\n${report.blocks.map((b) => (b.kind === 'li' ? '- ' : '') + b.text).join('\n')}`,
    `Focus: ${focus}. Gap concepts: ${report.gaps.join(', ') || 'none named'}.`,
    `Concepts with practice items (pathway sessions may use only these): ${BANK_CONCEPTS.join(', ')}.`,
    `Story time now: ${fmt(state.clock)} (day "Today").`,
    `Open plan to revise: ${openPlan ? JSON.stringify(planBrief(openPlan)) : 'none'}.`,
  ];
  return [{ role: 'user', content: lines.join('\n\n') }];
}
```

- [ ] **Step 6: Write `server/agents/adapt.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { planProblems, withinFollowUpPolicy } from '../../src/live/plans';
import { studentById } from '../../src/live/reducer';
import type { DemoState, LiveBlock, Mastery, Plan } from '../../src/live/types';
import { conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { BANK_CONCEPTS } from '../../src/scenario/practiceBank';
import type { AgentSpec, Check } from './loop';
import { BLOCKS_SCHEMA, checkBlocks } from './sas';
import { SESSIONS_SCHEMA, tasLabel, toPlan } from './tas';
import { CONCEPT_IDS, obj, READ_TOOLS, readTool, tool } from './tools';

export interface AdaptResult { blocks: LiveBlock[]; followUp: Plan | null }

const ADAPT_TOOL = tool('adapt_report', 'Report the result to the lecturer and decide on a follow-up. Call this once, last.', {
  blocks: BLOCKS_SCHEMA,
  follow_up_needed: { type: 'boolean' },
  follow_up: obj({
    title: { type: 'string' },
    day: { type: 'string', description: 'Use "Tomorrow".' },
    sessions: SESSIONS_SCHEMA,
    rationale: { type: 'string' },
    outcome: { type: 'string' },
  }),
});

export const ADAPT_SYSTEM = `You are the Teaching Assistance Agent in Beyond. A student has just finished the mastery check of a plan the lecturer, Lam, approved. All data is fictional demo data.

Write the short unprompted update the lecturer sees: two short paragraphs, under 70 words in total. First the result, with the key figure in **bold**; then what happens next. The target is 0.75 on the plan's target concept. Use the student's name; do not assume anyone's pronouns. Use cites: [] unless you cite an evidence id the tools returned.

If a focus concept is still below 0.50, or the target was missed, set follow_up_needed and give a pathway for "Tomorrow" (times between 09:00 and 20:00): 2–3 sessions of 5–12 minutes on concepts with practice items, building on tonight's work, with the mastery check last. Otherwise set follow_up_needed false and leave follow_up with empty strings and no sessions.

Always finish with adapt_report.`;

export const checkAdapt = (state: DemoState, plan: Plan, followUpId: string): Check<AdaptResult> => (input) => {
  const r = input as Record<string, unknown>;
  const blocks = checkBlocks(state, r.blocks);
  if (!blocks.ok) return blocks;
  if (r.follow_up_needed !== true) return { ok: true, value: { blocks: blocks.value, followUp: null } };
  const draft = toPlan({ ...(r.follow_up as object), kind: 'pathway', student_ids: plan.studentIds }, { id: followUpId, conversationId: plan.conversationId, status: 'proposed' });
  const problems = planProblems(draft, state);
  if (problems.length) return { ok: false, error: `The follow-up breaks the policy: ${problems.join(' ')} Fix it and call adapt_report again.` };
  return { ok: true, value: { blocks: blocks.value, followUp: withinFollowUpPolicy(draft, state) ? { ...draft, status: 'autoApproved' } : draft } };
};

export const adaptSpec = (state: DemoState, plan: Plan, followUpId: string): AgentSpec<AdaptResult> => ({
  system: ADAPT_SYSTEM,
  tools: [...READ_TOOLS, ADAPT_TOOL],
  finish: 'adapt_report',
  check: checkAdapt(state, plan, followUpId),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => tasLabel(state, name, input),
});

export function adaptMessages(state: DemoState, plan: Plan, before: Mastery): Anthropic.Beta.BetaMessageParam[] {
  const s = studentById(state, plan.studentIds[0])!;
  const label = (c: ConceptId) => conceptById(c).label;
  const changes = CONCEPT_IDS.filter((c) => s.mastery[c] !== before[c]).map((c) => `${label(c)} ${before[c].toFixed(2)} → ${s.mastery[c].toFixed(2)}`);
  const target = plan.sessions.find((x) => x.isMasteryCheck)?.concept ?? 'equivalence';
  const lines = [
    `${s.name} (${s.id}; call them ${s.short}) just finished the mastery check of “${plan.title}”.`,
    `Target concept: ${label(target)} (target 0.75), now ${s.mastery[target].toFixed(2)}.`,
    `Mastery changes tonight: ${changes.join('; ') || 'none'}.`,
    `Focus concepts still below 0.50: ${TWIN_FOCUS.filter((c) => s.mastery[c] < 0.5).map(label).join(', ') || 'none'}.`,
    `Story time now: ${fmt(state.clock)}. Concepts with practice items: ${BANK_CONCEPTS.join(', ')}.`,
    'Policy: a pathway follow-up of at most 3 sessions is sent without asking; anything bigger waits for the lecturer.',
  ];
  return [{ role: 'user', content: lines.join('\n') }];
}
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run server/agents/agents.test.ts`
Expected: PASS (11 tests).

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/agents/sas.ts server/agents/tas.ts server/agents/adapt.ts server/agents/samples.ts server/agents/agents.test.ts
git commit -m "feat(server): Student Analysis, Teaching Assistance and adapt agents"
```

---

### Task 9: Canned fallback and the ask/adapt orchestrator

**Files:**
- Create: `src/teacher/route.ts`, `server/agents/canned.ts`, `server/agents/orchestrate.ts`
- Modify: `src/teacher/conversations.tsx` (re-export `ContextId` and `routePrompt` from `route.ts`)
- Test: `src/teacher/route.test.ts`, `server/agents/orchestrate.test.ts`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces:
  - `route.ts`: `type ContextId`, `CANNED_TOPICS: Record<ContextId, { title; prompt; followUps }>`, `routePrompt(text): ContextId | null`
  - `canned.ts`: `interface Outcome { msg: AssistantMsg; title: string; sansTitle: boolean; plan: Plan | null }`, `cannedPlan(state, topic, id, conversationId): Plan`, `cannedAnswer(state, text, ids: { planId; conversationId }): Outcome`, `cannedAdapt(state, plan, before, followUpId): AdaptResult`
  - `orchestrate.ts`: `interface Deps { client: MessagesClient | null; newPlanId(): string; onStep(line): void; signal?: AbortSignal }`, `historyOf(msgs): Turn[]`, `openPlanOf(state, conversationId): Plan | null`, `answer(state, history: ChatMsg[], conversationId, text, deps): Promise<Outcome>`, `adaptAfterCheck(state, planId, deps): Promise<{ msg: AssistantMsg; followUp: Plan | null }>`

- [ ] **Step 1: Write the failing tests**

Create `src/teacher/route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TOPICS } from './conversations';
import { CANNED_TOPICS, routePrompt } from './route';

describe('canned topics', () => {
  it('match the draft topics (the JSX answers stay in conversations.tsx)', () => {
    for (const id of ['student', 'class', 'attention'] as const) {
      expect(CANNED_TOPICS[id]).toEqual({ title: TOPICS[id].title, prompt: TOPICS[id].prompt, followUps: TOPICS[id].followUps });
    }
  });
  it('route typed prompts by keyword', () => {
    expect(routePrompt('Why did Minh Anh’s quiz score drop?')).toBe('student');
    expect(routePrompt('Who needs me personally?')).toBe('attention');
    expect(routePrompt('What gap is the class facing?')).toBe('class');
    expect(routePrompt('Hello')).toBeNull();
  });
});
```

Create `server/agents/orchestrate.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { TONIGHT } from '../../src/live/clock';
import { stateWithPlan } from '../../src/live/fixtures';
import { planProblems } from '../../src/live/plans';
import { seedState } from '../../src/live/seed';
import { MASTERY_INITIAL } from '../../src/scenario/minhAnh';
import { cannedPlan } from './canned';
import { failingClient, fakeClient } from './fakeClient';
import { adaptAfterCheck, answer, historyOf, type Deps } from './orchestrate';
import { adaptInput, planInput, reportInput } from './samples';

const deps = (over: Partial<Deps> = {}): Deps & { steps: string[] } => {
  const steps: string[] = [];
  return { client: null, newPlanId: () => 'p1', onStep: (l) => steps.push(l), steps, ...over };
};
const MA = 'Why did Minh Anh’s quiz score drop?';

describe('answer', () => {
  it('runs SAS then TAS and points the panel at the new plan', async () => {
    const { client } = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: planInput() }]]);
    const d = deps({ client });
    const out = await answer(seedState(), [], 'c1', MA, d);
    expect(d.steps).toEqual(['Teaching Assistance Agent · drafting a plan']);
    expect(out).toMatchObject({ title: 'Minh Anh · implication gap', sansTitle: true, plan: { id: 'p1', conversationId: 'c1' } });
    expect(out.msg).toMatchObject({ source: 'agents', canned: null, panel: { kind: 'student', studentId: 's17', planId: 'p1' } });
    expect(out.msg.followUps).toHaveLength(3);
  });
  it('answers without a plan when none is needed', async () => {
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const out = await answer(seedState(), [], 'c1', 'How is Minh Anh?', deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: null, highlight: null });
  });
  it('revises the open plan in place', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false, revise_plan: true }) }], [{ tool: 'propose_plan', input: planInput() }]]);
    const newPlanId = vi.fn(() => 'p7');
    const d = deps({ client, newPlanId });
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'Make it shorter', d);
    expect(out.plan?.id).toBe('p1');
    expect(newPlanId).not.toHaveBeenCalled();
    expect(d.steps).toEqual(['Teaching Assistance Agent · revising the plan']);
  });
  it('says so when no plan fits the policy', async () => {
    const early = planInput({ sessions: [{ time: '09:00', title: 'x', minutes: 8, concept: 'implication', is_mastery_check: true, student_id: '' }] });
    const { client } = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: early }], [{ tool: 'propose_plan', input: early }]]);
    const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.blocks.at(-1)?.text).toBe('I couldn’t draft a plan within your policy.');
  });
  it('falls back to canned answers offline or on API errors', async () => {
    for (const client of [null, failingClient()]) {
      const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
      expect(out.msg).toMatchObject({ source: 'offline', canned: 'student', panel: { kind: 'student', studentId: 's17', planId: 'p1' } });
      expect(out.title).toBe('Minh Anh’s Quiz 2 drop');
      expect(out.plan?.kind).toBe('pathway');
    }
    const other = await answer(seedState(), [], 'c1', 'Tell me a joke', deps());
    expect(other.msg.canned).toBe('fallback');
    expect(other.plan).toBeNull();
  });
});

describe('canned plans', () => {
  it('are valid for all three topics, also later in the day', () => {
    const state = seedState();
    for (const topic of ['student', 'class', 'attention'] as const) expect(planProblems(cannedPlan(state, topic, 'p1', 'c1'), state)).toEqual([]);
    state.clock = 17 * 60;
    const late = cannedPlan(state, 'student', 'p1', 'c1');
    expect(planProblems(late, state)).toEqual([]);
    expect(late.sessions[0].time).toBe('17:30');
  });
});

describe('adaptAfterCheck', () => {
  const after = () => {
    const s = stateWithPlan('pathway', { status: 'done' });
    s.clock = TONIGHT;
    s.phone.before = { ...MASTERY_INITIAL };
    s.students[16].mastery.equivalence = 0.71;
    return s;
  };
  it('offline: canned update and an auto-approved 3-session follow-up', async () => {
    const out = await adaptAfterCheck(after(), 'p1', deps({ newPlanId: () => 'p2' }));
    expect(out.msg).toMatchObject({ source: 'offline', stamp: '20:40', panel: { kind: 'student', studentId: 's17', planId: 'p2' } });
    expect(out.msg.blocks[0].text).toContain('**0.35 → 0.71**');
    expect(out.followUp).toMatchObject({ id: 'p2', status: 'autoApproved', day: 'Tomorrow' });
    expect(planProblems(out.followUp!, after())).toEqual([]);
  });
  it('online: the agent decides, here with no follow-up', async () => {
    const { client } = fakeClient([[{ tool: 'adapt_report', input: adaptInput(0) }]]);
    const d = deps({ client, newPlanId: () => 'p2' });
    const out = await adaptAfterCheck(after(), 'p1', d);
    expect(out.followUp).toBeNull();
    expect(out.msg).toMatchObject({ source: 'agents', panel: { planId: 'p1' } });
    expect(d.steps).toEqual(['Teaching Assistance Agent · reviewing tonight’s mastery check']);
  });
});

describe('historyOf', () => {
  it('turns the conversation into plain-text turns', () => {
    expect(historyOf(stateWithPlan().conversations[0].msgs)).toEqual([
      { role: 'user', text: 'Why did Minh Anh’s quiz score drop?' },
      { role: 'assistant', text: 'Quiz 2 fell from **75% to 42%**.\n- She picked the converse on 6 items.' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/teacher/route.test.ts server/agents/orchestrate.test.ts`
Expected: FAIL — cannot resolve `./route` / `./canned`.

- [ ] **Step 3: Write `src/teacher/route.ts` and re-export from `conversations.tsx`**

Create `src/teacher/route.ts`:

```ts
export type ContextId = 'student' | 'class' | 'attention';

/** Titles, prompts and follow-ups of the draft's canned topics, without JSX so the server can use them. */
export const CANNED_TOPICS: Record<ContextId, { title: string; prompt: string; followUps: string[] }> = {
  student: {
    title: 'Minh Anh’s Quiz 2 drop',
    prompt: 'Why did Minh Anh’s quiz score drop?',
    followUps: ['What gap is the class facing this week?', 'Show me her full history', 'Draft a message to her'],
  },
  class: {
    title: 'Class gap · logical equivalence',
    prompt: 'What gap is the class facing this week?',
    followUps: ['Which 3 need me?', 'Show the recap slides', 'Compare with last term'],
  },
  attention: {
    title: 'Who needs me personally',
    prompt: 'Who needs me personally, not just the AI?',
    followUps: ['Draft the invitations', 'What did we already try?', 'Show the escalation policy'],
  },
};

/** Free-typed prompts are routed by keyword; the draft only knows these three topics. */
export function routePrompt(text: string): ContextId | null {
  const s = text.toLowerCase();
  if (/minh|anh|her\b|quiz score/.test(s)) return 'student';
  if (/personal|need me|needs me|1:1|attention|which 3/.test(s)) return 'attention';
  if (/class|gap|week|group|everyone/.test(s)) return 'class';
  return null;
}
```

In `src/teacher/conversations.tsx`, replace the line

```ts
export type ContextId = 'student' | 'class' | 'attention';
```

with

```ts
import type { ContextId } from './route';
export type { ContextId } from './route';
export { routePrompt } from './route';
```

and delete the whole `routePrompt` function there (its doc comment `/** Free-typed prompts are routed by keyword; the draft only knows these three topics. */` and the body below it).

- [ ] **Step 4: Write `server/agents/canned.ts`**

```ts
import { fmt, parseTime } from '../../src/live/clock';
import { studentById } from '../../src/live/reducer';
import type { AssistantMsg, DemoState, LivePanel, Mastery, Plan, PlanSession } from '../../src/live/types';
import { COMPLEX } from '../../src/scenario/classroom';
import { conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { MINH_ANH } from '../../src/scenario/minhAnh';
import { EXPECTED_OUTCOME, PATHWAY_PROPOSED, PATHWAY_UPDATED } from '../../src/scenario/orchestration';
import { CANNED_TOPICS, routePrompt, type ContextId } from '../../src/teacher/route';
import type { AdaptResult } from './adapt';

export interface Outcome { msg: AssistantMsg; title: string; sansTitle: boolean; plan: Plan | null }

const PATHWAY_CONCEPTS: ConceptId[] = ['negation', 'implication', 'implication', 'equivalence'];
const FOLLOW_UP_CONCEPTS: ConceptId[] = ['equivLaws', 'applications', 'equivLaws'];

const session = (time: string, title: string, minutes: number, concept: ConceptId | null, isMasteryCheck = false, studentId: string | null = null): PlanSession =>
  ({ time, title, minutes, concept, isMasteryCheck, studentId });

/** Moves "Today" times later so the first session starts at least 30 minutes after the story clock. */
function shifted(times: string[], clock: number): string[] {
  const shift = Math.max(0, clock + 30 - parseTime(times[0])!);
  return times.map((t) => fmt(parseTime(t)! + shift));
}

/** The draft's three proposals as real plans (offline mode still runs the whole loop). */
export function cannedPlan(state: DemoState, topic: ContextId, id: string, conversationId: string): Plan {
  const base = { id, conversationId, status: 'proposed' as const };
  if (topic === 'student') {
    const times = shifted(PATHWAY_PROPOSED.map((p) => p.when.replace('Today ', '')), state.clock);
    return {
      ...base, kind: 'pathway', title: 'Rebuild implication, then equivalence', studentIds: [MINH_ANH.id], day: 'Today',
      rationale: 'Almost every lost mark traces back to implication.', outcome: EXPECTED_OUTCOME,
      sessions: PATHWAY_PROPOSED.map((p, i) => session(times[i], p.title, p.mins, PATHWAY_CONCEPTS[i], i === PATHWAY_PROPOSED.length - 1)),
    };
  }
  if (topic === 'class') {
    const affected = state.students.filter((s) => s.status !== 'onTrack').map((s) => s.id);
    return {
      ...base, kind: 'classActivity', title: 'Group recap + adaptive practice', studentIds: affected, day: 'Thursday',
      rationale: 'Guided conceptual practice worked in 82% of similar cases.', outcome: 'Class mastery on equivalence ≥ 0.60 by Quiz 3',
      sessions: [session('10:00', '15-min recap in tutorial · whole class', 15, null), session('10:15', `Adaptive practice set · ${affected.length} students`, 20, null)],
    };
  }
  const people = COMPLEX.map((i) => state.students[i]);
  return {
    ...base, kind: 'checkIns', title: '15-minute check-ins', studentIds: people.map((p) => p.id), day: 'Friday',
    rationale: 'No mastery gain after 2 sessions: a conversation will help more than more practice.', outcome: 'A plan you’ve agreed with each student',
    sessions: people.map((p, i) => session(['14:00', '14:20', '14:40'][i], `Check-in · ${p.name}`, 15, null, false, p.id)),
  };
}

/** Offline answer: the draft's canned topic copy, with a real plan behind its panel. */
export function cannedAnswer(state: DemoState, text: string, ids: { planId: string; conversationId: string }): Outcome {
  const topic = routePrompt(text);
  const offline = (canned: AssistantMsg['canned'], followUps: string[], panel: LivePanel | null): AssistantMsg =>
    ({ role: 'assistant', source: 'offline', blocks: [], canned, followUps, panel, stamp: null });
  if (!topic) return { msg: offline('fallback', [], null), title: text.length > 40 ? `${text.slice(0, 39)}…` : text, sansTitle: false, plan: null };
  const plan = cannedPlan(state, topic, ids.planId, ids.conversationId);
  const panel: LivePanel = topic === 'student'
    ? { kind: 'student', studentId: MINH_ANH.id, planId: plan.id, highlight: null }
    : topic === 'class' ? { kind: 'class', planId: plan.id } : { kind: 'checkIns', planId: plan.id };
  return { msg: offline(topic, CANNED_TOPICS[topic].followUps, panel), title: CANNED_TOPICS[topic].title, sansTitle: false, plan };
}

/** Offline adapt: the result in one line and the video's follow-up, auto-approved. */
export function cannedAdapt(state: DemoState, plan: Plan, before: Mastery, followUpId: string): AdaptResult {
  const s = studentById(state, plan.studentIds[0])!;
  const target = plan.sessions.find((x) => x.isMasteryCheck)?.concept ?? 'equivalence';
  const reached = s.mastery[target] >= 0.75;
  const followUp: Plan = {
    id: followUpId, kind: 'pathway', title: 'Next: equivalence laws in practice', studentIds: [s.id], day: 'Tomorrow',
    rationale: 'Builds on tonight’s mastery check.', outcome: 'Equivalence laws mastery ≥ 0.60', status: 'autoApproved', conversationId: plan.conversationId,
    sessions: PATHWAY_UPDATED.map((p, i) => session(p.when.replace('Tomorrow ', ''), p.title, p.mins, FOLLOW_UP_CONCEPTS[i], i === PATHWAY_UPDATED.length - 1)),
  };
  return {
    blocks: [
      { kind: 'p', cites: [], text: `${s.short} finished tonight’s mastery check: ${conceptById(target).label.toLowerCase()} **${before[target].toFixed(2)} → ${s.mastery[target].toFixed(2)}**. ${reached ? `${s.short} has reached the target.` : 'Still short of the 0.75 target.'}` },
      { kind: 'p', cites: [], text: 'Next up: **equivalence laws in practice**. Within your policy, I’ve sent a 3-session follow-up for tomorrow.' },
    ],
    followUp,
  };
}
```

- [ ] **Step 5: Write `server/agents/orchestrate.ts`**

```ts
import { fmt } from '../../src/live/clock';
import { planById, studentById } from '../../src/live/reducer';
import type { AssistantMsg, ChatMsg, DemoState, LiveBlock, LivePanel, Plan } from '../../src/live/types';
import { CANNED_TOPICS } from '../../src/teacher/route';
import { adaptMessages, adaptSpec, type AdaptResult } from './adapt';
import { cannedAdapt, cannedAnswer, type Outcome } from './canned';
import type { MessagesClient } from './client';
import { runAgent } from './loop';
import { sasMessages, sasSpec, type Focus, type Turn } from './sas';
import { tasMessages, tasSpec } from './tas';

export interface Deps {
  client: MessagesClient | null;
  newPlanId(): string;
  onStep(line: string): void;
  signal?: AbortSignal;
}

const ASKS_FOR_PLAN = /\b(plan|intervention|what should i do|schedule|follow-?up)\b/i;
const NO_PLAN = 'I couldn’t draft a plan within your policy.';

const warn = (what: string, e: unknown) => console.warn(`[beyond] ${what} failed, answering offline:`, e instanceof Error ? e.message : e);

const textOf = (m: ChatMsg): string => {
  if (m.role === 'teacher') return m.text;
  if (m.canned) return `[Answered offline about: ${m.canned === 'fallback' ? 'nothing specific' : CANNED_TOPICS[m.canned].title}]`;
  return m.blocks.map((b) => (b.kind === 'li' ? '- ' : '') + b.text).join('\n');
};

export const historyOf = (msgs: ChatMsg[]): Turn[] => msgs.map((m) => ({ role: m.role === 'teacher' ? 'user' : 'assistant', text: textOf(m) }));

/** The plan still waiting for approval in a conversation, if any. */
export const openPlanOf = (state: DemoState, conversationId: string): Plan | null =>
  [...state.plans].reverse().find((p) => p.conversationId === conversationId && p.status === 'proposed') ?? null;

function panelFor(focus: Focus, plan: Plan | null): LivePanel | null {
  if (plan?.kind === 'checkIns') return { kind: 'checkIns', planId: plan.id };
  if (focus.kind === 'student') return { kind: 'student', studentId: focus.studentId, planId: plan?.kind === 'pathway' ? plan.id : null, highlight: null };
  if (focus.kind === 'class' || plan?.kind === 'classActivity') return { kind: 'class', planId: plan?.kind === 'classActivity' ? plan.id : null };
  if (plan?.kind === 'pathway') return { kind: 'student', studentId: plan.studentIds[0], planId: plan.id, highlight: null };
  return null;
}

/** One teacher question: SAS, then TAS when a plan is wanted; canned answers when the agents are unavailable. */
export async function answer(state: DemoState, history: ChatMsg[], conversationId: string, text: string, deps: Deps): Promise<Outcome> {
  const offline = () => cannedAnswer(state, text, { planId: deps.newPlanId(), conversationId });
  if (!deps.client) return offline();
  const openPlan = openPlanOf(state, conversationId);
  try {
    const report = await runAgent(deps.client, sasSpec(state), sasMessages(historyOf(history), text, state, openPlan), deps);
    let plan: Plan | null = null;
    const extra: LiveBlock[] = [];
    if (report.needsPlan || report.revisePlan || ASKS_FOR_PLAN.test(text)) {
      const revising = report.revisePlan && openPlan !== null;
      deps.onStep(revising ? 'Teaching Assistance Agent · revising the plan' : 'Teaching Assistance Agent · drafting a plan');
      try {
        plan = await runAgent(deps.client, tasSpec(state, conversationId, revising ? openPlan.id : deps.newPlanId()), tasMessages(state, text, report, revising ? openPlan : null), deps);
      } catch (e) {
        if (deps.signal?.aborted) throw e;
        extra.push({ kind: 'p', text: NO_PLAN, cites: [] });
      }
    }
    return {
      msg: { role: 'assistant', source: 'agents', blocks: [...report.blocks, ...extra], canned: null, followUps: report.followUps, panel: panelFor(report.focus, plan), stamp: null },
      title: report.title,
      sansTitle: report.focus.kind === 'student',
      plan,
    };
  } catch (e) {
    if (deps.signal?.aborted) throw e;
    warn('agents', e);
    return offline();
  }
}

/** After a mastery check: the unprompted update and, maybe, a follow-up plan. */
export async function adaptAfterCheck(state: DemoState, planId: string, deps: Deps): Promise<{ msg: AssistantMsg; followUp: Plan | null }> {
  const plan = planById(state, planId)!;
  const before = state.phone.before ?? studentById(state, plan.studentIds[0])!.mastery;
  const followUpId = deps.newPlanId();
  let result: AdaptResult | null = null;
  let source: AssistantMsg['source'] = 'agents';
  if (deps.client) {
    try {
      deps.onStep('Teaching Assistance Agent · reviewing tonight’s mastery check');
      result = await runAgent(deps.client, adaptSpec(state, plan, followUpId), adaptMessages(state, plan, before), deps);
    } catch (e) {
      if (deps.signal?.aborted) throw e;
      warn('adapt', e);
    }
  }
  if (!result) {
    result = cannedAdapt(state, plan, before, followUpId);
    source = 'offline';
  }
  return {
    msg: {
      role: 'assistant', source, blocks: result.blocks, canned: null, followUps: [], stamp: fmt(state.clock),
      panel: { kind: 'student', studentId: plan.studentIds[0], planId: result.followUp?.id ?? plan.id, highlight: null },
    },
    followUp: result.followUp,
  };
}
```

- [ ] **Step 6: Run tests and the full suite**

Run: `npx vitest run src/teacher/route.test.ts server/agents/orchestrate.test.ts`
Expected: PASS (11 tests).

Run: `npm test`
Expected: PASS — the scripted teacher code still gets `routePrompt`/`ContextId` through `conversations.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/route.ts src/teacher/route.test.ts src/teacher/conversations.tsx server/agents/canned.ts server/agents/orchestrate.ts server/agents/orchestrate.test.ts
git commit -m "feat(server): canned fallback and the ask/adapt orchestrator"
```

---

### Task 10: Demo session (state, subscribers, background runs, reset)

**Files:**
- Create: `server/session.ts`
- Test: `server/session.test.ts`

**Interfaces:**
- Consumes: `seedState` (Task 4); reducers (Task 5); `answer`, `adaptAfterCheck` (Task 9); `MessagesClient` (Task 6).
- Produces: `class DemoSession` with
  - `state: DemoState`, `subscribe(fn: (s: DemoState) => void): () => void`
  - `ask(text, conversationId: string | null): { ok: true; conversationId: string; done: Promise<void> } | { ok: false; status: 400 | 409; error: string }`
  - `edit(planId, index, change)`, `approve(planId)`, `dismiss(planId)`, `phonePlan()`, `phoneOpen(index)`, `phoneAnswer(option)`, `phoneSkip()` — each returns `{ ok: true } | { ok: false; error: string }`
  - `phoneNext(): { ok: true; done: Promise<void> } | { ok: false; error: string }` (starts adapt after a mastery check)
  - `reset(): void`
  - Ids: conversations `c1, c2, …`, plans `p1, p2, …` (separate counters, never reused across resets).

- [ ] **Step 1: Write the failing test**

Create `server/session.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TONIGHT } from '../src/live/clock';
import { sessionItems } from '../src/scenario/practiceBank';
import type { MessagesClient } from './agents/client';
import { fakeClient } from './agents/fakeClient';
import { reportInput } from './agents/samples';
import { DemoSession } from './session';

const MA = 'Why did Minh Anh’s quiz score drop?';
const asked = async (session: DemoSession, text = MA, id: string | null = null) => {
  const r = session.ask(text, id);
  if (!r.ok) throw new Error(r.error);
  await r.done;
  return r.conversationId;
};

describe('DemoSession', () => {
  it('runs an ask in the background and records answer, title and plan', async () => {
    const session = new DemoSession(null);
    let published = 0;
    session.subscribe(() => published++);
    const r = session.ask(MA, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.conversationId).toBe('c1');
    expect(session.state.busy).toBe(true);
    expect(session.state.conversations[0].pending).toEqual({ steps: [] });
    await r.done;
    const c = session.state.conversations[0];
    expect(c).toMatchObject({ title: 'Minh Anh’s Quiz 2 drop', pending: null });
    expect(c.msgs).toHaveLength(2);
    expect(session.state.plans.map((p) => p.id)).toEqual(['p1']);
    expect(session.state.busy).toBe(false);
    expect(published).toBeGreaterThanOrEqual(2);
  });
  it('rejects empty questions and a second ask while busy', async () => {
    const session = new DemoSession(null);
    expect(session.ask('  ', null)).toMatchObject({ ok: false, status: 400 });
    const r = session.ask(MA, null);
    expect(session.ask('And the class?', null)).toMatchObject({ ok: false, status: 409 });
    if (r.ok) await r.done;
  });
  it('streams agent steps into the pending conversation', async () => {
    const { client } = fakeClient([[{ tool: 'get_student', input: { student_id: 's17' } }], [{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const session = new DemoSession(client);
    const steps: string[][] = [];
    session.subscribe((s) => steps.push(s.conversations[0]?.pending?.steps ?? []));
    await asked(session);
    expect(steps.some((x) => x.includes('Student Analysis Agent · reading Minh Anh’s learning twin'))).toBe(true);
    expect(session.state.conversations[0].title).toBe('Minh Anh · implication gap');
  });
  it('continues a conversation when given its id, and keeps its first title', async () => {
    const session = new DemoSession(null);
    const id = await asked(session);
    await asked(session, 'What gap is the class facing this week?', id);
    expect(session.state.conversations).toHaveLength(1);
    expect(session.state.conversations[0].msgs).toHaveLength(4);
    expect(session.state.conversations[0].title).toBe('Minh Anh’s Quiz 2 drop');
  });
  it('reset aborts a run and drops its late result', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { client: inner } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const client: MessagesClient = { create: async (p, o) => { await gate; return inner.create(p, o); } };
    const session = new DemoSession(client);
    const r = session.ask(MA, null);
    session.reset();
    release();
    if (r.ok) await r.done;
    expect(session.state).toMatchObject({ epoch: 1, conversations: [], plans: [], busy: false });
  });
  it('approve → phone → mastery check → adapt delivers the follow-up', async () => {
    const session = new DemoSession(null);
    await asked(session);
    expect(session.approve('p1')).toEqual({ ok: true });
    expect(session.state.phone).toMatchObject({ planId: 'p1', screen: 'lock' });
    session.phonePlan();
    session.phoneSkip();
    expect(session.phoneOpen(3)).toEqual({ ok: true });
    for (const item of sessionItems('equivalence', true)) {
      expect(session.phoneAnswer(item.correct)).toEqual({ ok: true });
      const next = session.phoneNext();
      if (!next.ok) throw new Error(next.error);
      await next.done;
    }
    const s = session.state;
    expect(s.clock).toBe(TONIGHT);
    expect(s.phone).toMatchObject({ screen: 'progress', updated: true, lastDone: 'p1', planId: 'p2' });
    expect(s.plans.find((p) => p.id === 'p2')?.status).toBe('autoApproved');
    expect(s.conversations[0].msgs.at(-1)).toMatchObject({ role: 'assistant', stamp: '20:40' });
    expect(s.busy).toBe(false);
  });
  it('reports reducer errors', () => {
    const session = new DemoSession(null);
    expect(session.approve('nope')).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect(session.phoneNext()).toEqual({ ok: false, error: 'Answer the item first.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/session.test.ts`
Expected: FAIL — cannot resolve `./session`.

- [ ] **Step 3: Write `server/session.ts`**

```ts
import * as R from '../src/live/reducer';
import { seedState } from '../src/live/seed';
import type { DemoState } from '../src/live/types';
import type { MessagesClient } from './agents/client';
import { adaptAfterCheck, answer, type Deps } from './agents/orchestrate';

type Done = { ok: true } | { ok: false; error: string };
type AskResult = { ok: true; conversationId: string; done: Promise<void> } | { ok: false; status: 400 | 409; error: string };

/** The one in-memory demo: every change publishes the full state to subscribers (the SSE streams). */
export class DemoSession {
  state: DemoState = seedState();
  private listeners = new Set<(s: DemoState) => void>();
  private abort: AbortController | null = null;
  private counters = { c: 0, p: 0 };

  constructor(private client: MessagesClient | null) {}

  subscribe(fn: (s: DemoState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(next: DemoState) {
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  private newId(prefix: 'c' | 'p') {
    return `${prefix}${++this.counters[prefix]}`;
  }

  /** Applies `fn` to a copy of the state, unless a reset happened since `epoch`. */
  private update(epoch: number, fn: (s: DemoState) => void) {
    if (this.state.epoch !== epoch) return;
    const s = structuredClone(this.state);
    fn(s);
    this.set(s);
  }

  private run(r: R.Result): Done {
    if (!r.ok) return { ok: false, error: r.error };
    this.set(r.state);
    return { ok: true };
  }

  /** Starts a background agent run whose steps land in conversation `convId`. */
  private background<T>(convId: string, work: (deps: Deps) => Promise<T>, finish: (st: DemoState, out: T) => void): Promise<void> {
    const epoch = this.state.epoch;
    const abort = new AbortController();
    this.abort = abort;
    return work({
      client: this.client,
      newPlanId: () => this.newId('p'),
      signal: abort.signal,
      onStep: (line) => this.update(epoch, (st) => { st.conversations.find((c) => c.id === convId)?.pending?.steps.push(line); }),
    })
      .then((out) => this.update(epoch, (st) => {
        finish(st, out);
        st.busy = false;
      }))
      .catch(() => { /* aborted by a reset */ })
      .finally(() => { if (this.abort === abort) this.abort = null; });
  }

  /** Records the question and starts the agents; `done` settles when the answer is in (the HTTP route does not wait). */
  ask(text: string, conversationId: string | null): AskResult {
    const question = text.trim();
    if (!question) return { ok: false, status: 400, error: 'Empty question.' };
    if (this.state.busy) return { ok: false, status: 409, error: 'The agents are still working.' };
    const s = structuredClone(this.state);
    let conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      conv = { id: this.newId('c'), title: 'New conversation', sansTitle: false, msgs: [], pending: null };
      s.conversations.push(conv);
    }
    const history = [...conv.msgs];
    conv.msgs.push({ role: 'teacher', text: question });
    conv.pending = { steps: [] };
    s.busy = true;
    this.set(s);
    const id = conv.id;
    const snapshot = structuredClone(s);
    const done = this.background(id, (deps) => answer(snapshot, history, id, question, deps), (st, out) => {
      const c = st.conversations.find((x) => x.id === id)!;
      c.pending = null;
      c.msgs.push(out.msg);
      if (c.title === 'New conversation') {
        c.title = out.title;
        c.sansTitle = out.sansTitle;
      }
      if (out.plan) {
        const i = st.plans.findIndex((p) => p.id === out.plan!.id);
        if (i >= 0) st.plans[i] = out.plan;
        else st.plans.push(out.plan);
      }
    });
    return { ok: true, conversationId: id, done };
  }

  edit(planId: string, index: number, change: { time?: string; remove?: boolean }): Done { return this.run(R.editPlan(this.state, planId, index, change)); }
  approve(planId: string): Done { return this.run(R.approvePlan(this.state, planId)); }
  dismiss(planId: string): Done { return this.run(R.dismissPlan(this.state, planId)); }
  phonePlan(): Done { return this.run(R.phoneShowPlan(this.state)); }
  phoneOpen(index: number): Done { return this.run(R.phoneOpen(this.state, index)); }
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }

  /** Moves on after a correct answer; finishing a mastery check starts the adapt run. */
  phoneNext(): { ok: true; done: Promise<void> } | { ok: false; error: string } {
    const r = R.phoneNext(this.state);
    if (!r.ok) return { ok: false, error: r.error };
    this.set(r.state);
    return { ok: true, done: r.finishedCheck ? this.adapt(r.state.phone.lastDone!) : Promise.resolve() };
  }

  private adapt(planId: string): Promise<void> {
    const s = structuredClone(this.state);
    const convId = R.planById(s, planId)!.conversationId;
    const conv = s.conversations.find((c) => c.id === convId);
    if (conv) conv.pending = { steps: [] };
    s.busy = true;
    this.set(s);
    const snapshot = structuredClone(s);
    return this.background(convId, (deps) => adaptAfterCheck(snapshot, planId, deps), (st, { msg, followUp }) => {
      const c = st.conversations.find((x) => x.id === convId);
      if (c) {
        c.pending = null;
        c.msgs.push(msg);
      }
      if (followUp) {
        st.plans.push(followUp);
        if (followUp.status === 'autoApproved') R.deliver(st, followUp, true);
      }
    });
  }

  /** Back to the seed for the next visitor; a run in flight is aborted and its result dropped. */
  reset(): void {
    this.abort?.abort();
    this.abort = null;
    this.set(seedState(this.state.epoch + 1));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/session.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add server/session.ts server/session.test.ts
git commit -m "feat(server): demo session with background agent runs and reset"
```

---

### Task 11: HTTP routes, SSE and the `npm run booth` script

**Files:**
- Modify: `package.json` (deps + scripts), `vite.config.ts` (dev proxy), `.gitignore`
- Create: `server/env.ts`, `server/app.ts`, `server/index.ts`, `.env.local.example`
- Test: `server/app.test.ts`

**Interfaces:**
- Consumes: `DemoSession` (Task 10), `anthropicClient` (Task 6), `MessagesClient`.
- Produces: `createApp(session, info: () => BoothInfo): Hono`, `interface BoothInfo { lanUrl: string | null; offline: boolean }`. Routes: `GET /api/info`, `GET /api/state`, `GET /api/events` (SSE `event: state` with the full state; `event: ping` every 15 s), `POST /api/ask` (202 `{ ok: true, conversationId }`), `POST /api/plan/edit|approve|dismiss`, `POST /api/phone/plan|open|answer|next|skip`, `POST /api/reset`. Every command replies `{ ok: true }` or 400 `{ ok: false, error }`. Scripts `npm run server`, `npm run booth`, `npm run test:live`.

- [ ] **Step 1: Install the server dependencies**

Run: `npm install hono@4.13.14 @hono/node-server@2.1.5 && npm install -D concurrently@10.0.6`

- [ ] **Step 2: Write the failing test**

Create `server/app.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { MessagesClient } from './agents/client';
import { createApp } from './app';
import { DemoSession } from './session';

const MA = 'Why did Minh Anh’s quiz score drop?';
const setup = (client: MessagesClient | null = null) => {
  const session = new DemoSession(client);
  const app = createApp(session, () => ({ lanUrl: 'http://192.168.1.20:5173/student.html?live', offline: client === null }));
  const post = (path: string, body: unknown = {}) =>
    app.request(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { session, app, post };
};

describe('booth HTTP API', () => {
  it('serves the booth info and the state', async () => {
    const { app } = setup();
    expect(await (await app.request('/api/info')).json()).toEqual({ lanUrl: 'http://192.168.1.20:5173/student.html?live', offline: true });
    expect(await (await app.request('/api/state')).json()).toMatchObject({ epoch: 0, clock: 900 });
  });
  it('ask answers 202 at once; plan and phone routes drive the flow', async () => {
    const { session, post } = setup();
    const r = await post('ask', { text: MA });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true, conversationId: 'c1' });
    await vi.waitFor(() => expect(session.state.busy).toBe(false));
    expect((await post('plan/edit', { planId: 'p1', sessionIndex: 3, time: '20:00' })).status).toBe(200);
    expect((await post('plan/approve', { planId: 'p1' })).status).toBe(200);
    expect((await post('phone/plan')).status).toBe(200);
    expect((await post('phone/open', { sessionIndex: 0 })).status).toBe(200);
    expect((await post('phone/answer', { option: 0 })).status).toBe(200);
    expect(session.state.phone.result).toBe('wrong');
  });
  it('reports bad commands as 400', async () => {
    const { post } = setup();
    const bad = await post('plan/approve', { planId: 'nope' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect((await post('ask', { text: '' })).status).toBe(400);
  });
  it('answers 409 while the agents are working', async () => {
    const { post } = setup({ create: () => new Promise(() => {}) });
    expect((await post('ask', { text: MA })).status).toBe(202);
    expect((await post('ask', { text: MA })).status).toBe(409);
  });
  it('reset bumps the epoch', async () => {
    const { session, post } = setup();
    expect((await post('reset')).status).toBe(200);
    expect(session.state.epoch).toBe(1);
  });
  it('streams the state over SSE', async () => {
    const { app } = setup();
    const res = await app.request('/api/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: state');
    expect(text).toContain('"epoch":0');
    await reader.cancel();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL — cannot resolve `./app`.

- [ ] **Step 4: Write `server/app.ts`**

```ts
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { clearInterval, setInterval } from 'node:timers';
import type { DemoState } from '../src/live/types';
import type { DemoSession } from './session';

export interface BoothInfo { lanUrl: string | null; offline: boolean }

type Body = Record<string, unknown>;
const body = async (c: Context): Promise<Body> => (await c.req.json().catch(() => ({}))) as Body;
const reply = (c: Context, r: { ok: true } | { ok: false; error: string }) => (r.ok ? c.json({ ok: true }) : c.json(r, 400));

export function createApp(session: DemoSession, info: () => BoothInfo) {
  const app = new Hono();

  app.get('/api/info', (c) => c.json(info()));
  app.get('/api/state', (c) => c.json(session.state));

  // The full state on connect and after every change; EventSource reconnects on its own.
  app.get('/api/events', (c) => streamSSE(c, (stream) => new Promise<void>((resolve) => {
    const send = (s: DemoState) => void stream.writeSSE({ event: 'state', data: JSON.stringify(s) });
    const off = session.subscribe(send);
    const ping = setInterval(() => void stream.writeSSE({ event: 'ping', data: '' }), 15_000);
    ping.unref();
    stream.onAbort(() => {
      clearInterval(ping);
      off();
      resolve();
    });
    send(session.state);
  })));

  app.post('/api/ask', async (c) => {
    const b = await body(c);
    const r = session.ask(String(b.text ?? ''), typeof b.conversationId === 'string' ? b.conversationId : null);
    return r.ok ? c.json({ ok: true, conversationId: r.conversationId }, 202) : c.json({ ok: false, error: r.error }, r.status);
  });
  app.post('/api/plan/edit', async (c) => {
    const b = await body(c);
    return reply(c, session.edit(String(b.planId), Number(b.sessionIndex), {
      time: typeof b.time === 'string' ? b.time : undefined, remove: b.remove === true,
    }));
  });
  app.post('/api/plan/approve', async (c) => reply(c, session.approve(String((await body(c)).planId))));
  app.post('/api/plan/dismiss', async (c) => reply(c, session.dismiss(String((await body(c)).planId))));
  app.post('/api/phone/plan', (c) => reply(c, session.phonePlan()));
  app.post('/api/phone/open', async (c) => reply(c, session.phoneOpen(Number((await body(c)).sessionIndex))));
  app.post('/api/phone/answer', async (c) => reply(c, session.phoneAnswer(Number((await body(c)).option))));
  app.post('/api/phone/next', (c) => {
    const r = session.phoneNext();
    return reply(c, r.ok ? { ok: true } : r);
  });
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
  app.post('/api/reset', (c) => {
    session.reset();
    return c.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 5: Write `server/env.ts` and `server/index.ts`**

`server/env.ts`:

```ts
import { existsSync } from 'node:fs';

// Imported first by server/index.ts so the key and BEYOND_* settings are in place before anything reads them.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
```

`server/index.ts`:

```ts
import './env';
import { serve } from '@hono/node-server';
import { networkInterfaces } from 'node:os';
import { anthropicClient } from './agents/client';
import { createApp } from './app';
import { DemoSession } from './session';

const PORT = Number(process.env.BEYOND_PORT ?? 8787);
const VITE_PORT = 5173;

/** The laptop's Wi-Fi/LAN address, for the phone QR code. */
const lanIp = (): string | null =>
  Object.values(networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address ?? null;

const client = anthropicClient();
const session = new DemoSession(client);
const info = () => {
  const ip = lanIp();
  return { lanUrl: ip ? `http://${ip}:${VITE_PORT}/student.html?live` : null, offline: client === null };
};

serve({ fetch: createApp(session, info).fetch, port: PORT }, () => {
  console.log(`[beyond] booth server on http://localhost:${PORT} · ${client ? 'agents online' : 'offline: canned answers'}`);
  console.log(`[beyond] phone: ${info().lanUrl ?? 'no LAN address found'}`);
});
```

- [ ] **Step 6: Wire the dev proxy, scripts, env example and ignore**

In `vite.config.ts`, add a `server` block after `plugins: [react()],`:

```ts
  server: { proxy: { '/api': 'http://localhost:8787' } },
```

Run:

```bash
npm pkg set scripts.server="tsx server/index.ts"
npm pkg set scripts.booth="concurrently -k -n vite,api -c yellow,cyan \"vite --host\" \"tsx server/index.ts\""
npm pkg set "scripts.test:live"="tsx server/live.smoke.ts"
```

Append to `.gitignore`:

```
.env.local
```

Create `.env.local.example`:

```
# Copy to .env.local (git-ignored). Without usable credentials the booth runs offline with canned answers.
ANTHROPIC_API_KEY=
# Optional
# BEYOND_MODEL=claude-sonnet-5-5
# BEYOND_EFFORT=medium
# BEYOND_OFFLINE=1
# BEYOND_PORT=8787
```

- [ ] **Step 7: Run tests, typecheck and a manual start**

Run: `npx vitest run server/app.test.ts`
Expected: PASS (6 tests).

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run server` (stop it with Ctrl+C once it has printed)
Expected: `[beyond] booth server on http://localhost:8787 · …` and a `[beyond] phone:` line. While it runs, `curl -s localhost:8787/api/state` in a second terminal prints JSON starting with `{"epoch":0,"clock":900`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts .gitignore .env.local.example server/env.ts server/app.ts server/index.ts server/app.test.ts
git commit -m "feat(server): HTTP routes, SSE state stream and npm run booth"
```

---

### Task 12: Live fields in the teacher frame, and snapshot → timeline translation

**Files:**
- Modify: `src/teacher/frame.ts`
- Create: `src/live/events.ts`, `src/live/source.ts`
- Test: `src/live/events.test.ts`

**Interfaces:**
- Consumes: `DemoState`, `AssistantMsg`, `LivePanel` (Task 1); `stateWithPlan` (Task 4).
- Produces:
  - `frame.ts`: `AssistantKind` gains `'live'`; `TeacherEvent` `assistant` gains `live?: AssistantMsg`, `panel` gains `live?: LivePanel`, new `{ at; type: 'title'; title: string; sansTitle: boolean }`; `FrameMsg.live?: AssistantMsg`; `FramePanel.live: LivePanel | null`
  - `events.ts`: `class SeenClock { stamp(keys, now): void; get(key): number; clear(): void }`, `keysOf(state): string[]`, `panelId(panel): ContextId`, `liveEvents(state, activeId, seen): TeacherEvent[]`
  - `source.ts`: `interface DemoSource { state: DemoState | null; post(path, body?): Promise<{ ok: boolean; [k: string]: unknown }> }`, `postJson(path, body?)`, `useServerSource(): DemoSource`

- [ ] **Step 1: Write the failing test**

Create `src/live/events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PAST, teacherFrame } from '../teacher/frame';
import { keysOf, liveEvents, panelId, SeenClock } from './events';
import { stateWithPlan } from './fixtures';

describe('SeenClock', () => {
  it('stamps the first snapshot as long past and later items at their arrival', () => {
    const seen = new SeenClock();
    seen.stamp(['a'], 1000);
    seen.stamp(['a', 'b'], 2000);
    expect(seen.get('a')).toBe(PAST);
    expect(seen.get('b')).toBe(2000);
    seen.stamp(['b'], 3000);
    expect(seen.get('b')).toBe(2000);
    seen.clear();
    seen.stamp(['c'], 4000);
    expect(seen.get('c')).toBe(4000);
  });
});

describe('liveEvents', () => {
  it('keys every message and the pending run', () => {
    const s = stateWithPlan();
    expect(keysOf(s)).toEqual(['c1:m0', 'c1:m1']);
    s.conversations[0].pending = { steps: ['x'] };
    expect(keysOf(s)).toEqual(['c1:m0', 'c1:m1', 'c1:pending:2']);
  });
  it('replays a conversation from the first snapshot as already finished', () => {
    const s = stateWithPlan();
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    const f = teacherFrame(liveEvents(s, 'c1', seen), 10);
    expect(f.title).toBe('Minh Anh · implication gap');
    expect(f.sansTitle).toBe(true);
    expect(f.messages.map((m) => m.role)).toEqual(['teacher', 'assistant']);
    expect(f.messages[1]).toMatchObject({ kind: 'live', appear: 1 });
    expect(f.messages[1].live?.blocks).toHaveLength(2);
    expect(f.panel).toMatchObject({ id: 'student', appear: 1, live: { kind: 'student', studentId: 's17', planId: 'p1' } });
  });
  it('animates a new answer from when it arrived', () => {
    const s = stateWithPlan();
    const seen = new SeenClock();
    seen.stamp(['c1:m0'], 0);
    seen.stamp(keysOf(s), 5000);
    const f = teacherFrame(liveEvents(s, 'c1', seen), 5100);
    expect(f.messages[1].shown).toBe(1);
    expect(f.messages[1].appear).toBeLessThan(1);
    expect(f.panel?.appear).toBeLessThan(1);
  });
  it('shows the agent steps while a run is pending', () => {
    const s = stateWithPlan();
    s.conversations[0].pending = { steps: ['Student Analysis Agent · reading the class overview'] };
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).thinking?.lines).toEqual(['Student Analysis Agent · reading the class overview']);
    s.conversations[0].pending = { steps: [] };
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).thinking?.lines).toEqual(['Reading your class context']);
  });
  it('carries the adapt stamp and shows nothing without a known conversation', () => {
    const s = stateWithPlan();
    const msg = s.conversations[0].msgs[1];
    if (msg.role === 'assistant') msg.stamp = '20:40';
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).messages[1].stamp).toBe('20:40');
    expect(liveEvents(s, null, seen)).toEqual([]);
    expect(liveEvents(s, 'c9', seen)).toEqual([]);
  });
  it('maps live panels onto the context ids', () => {
    expect(panelId({ kind: 'student', studentId: 's17', planId: null, highlight: null })).toBe('student');
    expect(panelId({ kind: 'class', planId: null })).toBe('class');
    expect(panelId({ kind: 'checkIns', planId: 'p1' })).toBe('attention');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/live/events.test.ts`
Expected: FAIL — cannot resolve `./events`.

- [ ] **Step 3: Add the live fields to `src/teacher/frame.ts`**

Make these exact edits:

1. After `import { TOPICS, type ContextId } from './conversations';` add:

```ts
import type { AssistantMsg, LivePanel } from '../live/types';
```

2. Replace `export type AssistantKind = 'answer' | 'approved' | 'fallback' | 'brief' | 'adapt';` with:

```ts
export type AssistantKind = 'answer' | 'approved' | 'fallback' | 'brief' | 'adapt' | 'live';
```

3. In `TeacherEvent`, replace the `assistant` and `panel` members and the last member:

```ts
  | { at: number; type: 'assistant'; kind: AssistantKind; topic?: ContextId; index?: number; blockMs: number; stamp?: string; live?: AssistantMsg }
```

```ts
  | { at: number; type: 'panel'; id: ContextId | null; barsDelay?: number; barsMs?: number; live?: LivePanel }
```

```ts
  | { at: number; type: 'adaptClass' }
  | { at: number; type: 'title'; title: string; sansTitle: boolean };
```

4. In `FrameMsg`, after `shown: number;` add:

```ts
  /** Live mode: the server's message (blocks, follow-ups, panel). */
  live?: AssistantMsg;
```

5. In `FramePanel`, after `followUp: boolean;` add:

```ts
  /** Live mode: which live panel to show (null in scripted mode). */
  live: LivePanel | null;
```

6. Replace `openPanel` with:

```ts
const openPanel = (id: ContextId, at: number, t: number, barsDelay = 1000, barsMs = 2000, live: LivePanel | null = null): FramePanel => ({
  id, appear: prog(t, at, 500), bars: prog(t, at + barsDelay, barsMs), scroll: 0, edited: false, editFlash: 0, twin: 0, followUp: false, live,
});
```

7. In the `assistant` case, replace the line `role: 'assistant', text: '', kind: e.kind, topic: e.topic, index: e.index, stamp: e.stamp,` with:

```ts
          role: 'assistant', text: '', kind: e.kind, topic: e.topic, index: e.index, stamp: e.stamp, live: e.live,
```

8. In the `panel` case, replace the body line with:

```ts
        f.panel = e.id === null ? null : openPanel(e.id, e.at, t, e.barsDelay, e.barsMs, e.live ?? null);
```

9. After the `view` case (`f.view = e.view; break;`) add:

```ts
      case 'title':
        f.title = e.title;
        f.sansTitle = e.sansTitle;
        break;
```

- [ ] **Step 4: Write `src/live/events.ts`**

```ts
import { PAST, type TeacherEvent } from '../teacher/frame';
import type { ContextId } from '../teacher/route';
import type { DemoState, LivePanel } from './types';

const BLOCK_MS = 250;

/** Remembers when each item was first seen, in the live view's clock. The first snapshot counts as long past. */
export class SeenClock {
  private at = new Map<string, number>();
  private primed = false;

  stamp(keys: string[], now: number): void {
    for (const k of keys) if (!this.at.has(k)) this.at.set(k, this.primed ? now : PAST);
    this.primed = true;
  }

  get(key: string): number {
    return this.at.get(key) ?? PAST;
  }

  /** After a reset: forget everything; new items animate in from when they arrive. */
  clear(): void {
    this.at.clear();
  }
}

/** One key per message and per pending run, in every conversation. */
export const keysOf = (state: DemoState): string[] =>
  state.conversations.flatMap((c) => [...c.msgs.map((_, i) => `${c.id}:m${i}`), ...(c.pending ? [`${c.id}:pending:${c.msgs.length}`] : [])]);

export const panelId = (p: LivePanel): ContextId => (p.kind === 'class' ? 'class' : p.kind === 'checkIns' ? 'attention' : 'student');

/** The open conversation as a teacher timeline, each item stamped with when it was first seen. */
export function liveEvents(state: DemoState, activeId: string | null, seen: SeenClock): TeacherEvent[] {
  const conv = state.conversations.find((c) => c.id === activeId);
  if (!conv) return [];
  const out: TeacherEvent[] = [{ at: PAST, type: 'title', title: conv.title, sansTitle: conv.sansTitle }];
  let panel: { at: number; live: LivePanel } | null = null;
  for (let i = 0; i < conv.msgs.length; i++) {
    const m = conv.msgs[i];
    const at = seen.get(`${conv.id}:m${i}`);
    if (m.role === 'teacher') {
      out.push({ at, type: 'send', text: m.text });
    } else {
      out.push({ at, type: 'assistant', kind: 'live', live: m, blockMs: BLOCK_MS, stamp: m.stamp ?? undefined });
      if (m.panel) panel = { at, live: m.panel };
    }
  }
  if (panel) out.push({ at: panel.at, type: 'panel', id: panelId(panel.live), live: panel.live });
  if (conv.pending) {
    out.push({
      at: seen.get(`${conv.id}:pending:${conv.msgs.length}`), type: 'think',
      lines: conv.pending.steps.length ? conv.pending.steps : ['Reading your class context'], stepMs: 1, title: conv.title, sansTitle: conv.sansTitle,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}
```

- [ ] **Step 5: Write `src/live/source.ts`**

```ts
import { useEffect, useState } from 'react';
import type { DemoState } from './types';

export interface DemoSource {
  state: DemoState | null;
  /** POST /api/<path>; resolves to the JSON reply, or `{ ok: false }` when the server is unreachable. */
  post(path: string, body?: unknown): Promise<{ ok: boolean; [k: string]: unknown }>;
}

export async function postJson(path: string, body: unknown = {}): Promise<{ ok: boolean; [k: string]: unknown }> {
  try {
    const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as { ok: boolean };
  } catch {
    return { ok: false };
  }
}

/** Live demo state over SSE. EventSource reconnects on its own and the server resends the full state. */
export function useServerSource(): DemoSource {
  const [state, setState] = useState<DemoState | null>(null);
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => setState(JSON.parse((e as MessageEvent<string>).data) as DemoState));
    return () => es.close();
  }, []);
  return { state, post: postJson };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/live/events.test.ts`
Expected: PASS (7 tests).

Run: `npm test`
Expected: PASS — scripted frame and scene tests are unaffected (`live` stays `null`/undefined there).

- [ ] **Step 7: Commit**

```bash
git add src/teacher/frame.ts src/live/events.ts src/live/source.ts src/live/events.test.ts
git commit -m "feat(live): live fields in the teacher frame and snapshot-to-timeline translation"
```

---

### Task 13: Live context, live answers, sidebar conversations and header

**Files:**
- Create: `src/live/LiveContext.tsx`, `src/teacher/LiveText.tsx`
- Modify: `src/teacher/TeacherScreen.tsx`, `src/live/fixtures.ts` (add `ctxFor`)
- Test: `src/teacher/live.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 4, 12; `classKpis`; `fmt`.
- Produces:
  - `LiveContext.tsx`: `interface LiveCtx { state; activeId; post(path, body?): Promise<unknown>; openConversation(id); showPanel(panel: LivePanel | null); toast(text) }`, `LiveProvider`, `useLive(): LiveCtx | null`, `DEMO_ONLY = 'Not part of this demo'`
  - `LiveText.tsx`: `panelForEvidence(id): LivePanel`, `LiveText({ block })` (bold spans + `data-cite` chips)
  - `fixtures.ts`: `ctxFor(state, activeId?): LiveCtx`
  - `TeacherScreen` renders live messages (offline tag, live follow-ups, "Open context" via `useLive().showPanel`), lists live conversations (active one `aria-current="page"`), shows the story clock and **Reset demo**, live attention figures, live sidebar badge; nav buttons get `aria-current="page"` when active.

- [ ] **Step 1: Write the failing test**

Create `src/teacher/live.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { keysOf, liveEvents, SeenClock } from '../live/events';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { AssistantMsg, DemoState } from '../live/types';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const noop = new Proxy({}, { get: () => () => undefined }) as TeacherActions;

function render(state: DemoState, activeId: string | null = 'c1') {
  const seen = new SeenClock();
  seen.stamp(keysOf(state), 0);
  const events: TeacherEvent[] = [{ at: PAST, type: 'greeting' }, { at: PAST, type: 'classroomReveal' }, ...liveEvents(state, activeId, seen)];
  return html(
    <LiveProvider value={ctxFor(state, activeId)}>
      <TeacherScreen frame={teacherFrame(events, 10)} actions={noop} composer={{ value: '', onChange: () => {} }} />
    </LiveProvider>,
  );
}

describe('live teacher screen', () => {
  it('renders an agent answer with bold figures, evidence chips and follow-ups', () => {
    const out = render(stateWithPlan());
    expect(out).toContain('<strong class="font-semibold text-egg-ink">75% to 42%</strong>');
    expect(out).toContain('data-cite="s17-quiz2"');
    expect(out).toContain('data-cite="s17-quiz2-q4"');
    expect(out).toContain('What gap is the class facing this week?');
    expect(out).not.toContain('Offline answer');
  });
  it('tags offline answers and reuses the canned copy', () => {
    const s = stateWithPlan();
    s.conversations[0].msgs[1] = { ...(s.conversations[0].msgs[1] as AssistantMsg), source: 'offline', canned: 'student', blocks: [] };
    const out = render(s);
    expect(out).toContain('Offline answer');
    expect(out).toContain('waiting for your approval');
  });
  it('lists the session conversations in the sidebar and marks the open one', () => {
    const out = render(stateWithPlan());
    expect(out).toMatch(/aria-current="page"[^>]*>Minh Anh · implication gap</);
    expect(out).not.toContain('Who needs me personally');
    expect(render({ ...stateWithPlan(), conversations: [] }, null)).toContain('No conversations yet');
  });
  it('shows the story clock, Reset demo and live attention figures on the opening screen', () => {
    const out = render(stateWithPlan(), null);
    expect(out).toContain('Saturday, 31 October · 15:00');
    expect(out).toContain('Reset demo');
    expect(out).toContain('75→42');
    expect(out).toContain('12/55');
  });
  it('the sidebar badge follows live need-support counts', () => {
    const s = stateWithPlan();
    s.students[16].status = 'onTrack';
    expect(render(s)).toContain('>11</span>');
  });
  it('hides the five-question tracker in live mode', () => {
    expect(render(stateWithPlan())).not.toContain('Five questions');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/teacher/live.test.tsx`
Expected: FAIL — cannot resolve `../live/LiveContext`.

- [ ] **Step 3: Write `src/live/LiveContext.tsx` and add `ctxFor` to the fixtures**

`src/live/LiveContext.tsx`:

```tsx
import { createContext, useContext } from 'react';
import type { DemoState, LivePanel } from './types';

export interface LiveCtx {
  state: DemoState;
  /** The conversation open in the chat, or null for a new one. */
  activeId: string | null;
  post(path: string, body?: unknown): Promise<unknown>;
  openConversation(id: string): void;
  showPanel(panel: LivePanel | null): void;
  toast(text: string): void;
}

const Ctx = createContext<LiveCtx | null>(null);

export const LiveProvider = Ctx.Provider;

/** Live data and actions; null in scripted (recorded) mode, where components keep the scripted constants. */
export const useLive = (): LiveCtx | null => useContext(Ctx);

export const DEMO_ONLY = 'Not part of this demo';
```

Append to `src/live/fixtures.ts`:

```ts
import type { LiveCtx } from './LiveContext';

/** A live context over `state` whose actions do nothing (tests). */
export const ctxFor = (state: DemoState, activeId: string | null = 'c1'): LiveCtx => ({
  state, activeId, post: async () => ({ ok: true }), openConversation: () => {}, showPanel: () => {}, toast: () => {},
});
```

(Move that `import type` line up to the other imports at the top of the file.)

- [ ] **Step 4: Write `src/teacher/LiveText.tsx`**

```tsx
import { useLive } from '../live/LiveContext';
import type { LiveBlock, LivePanel } from '../live/types';

/** Where a cited evidence id opens: the class panel, or the student's panel with that entry highlighted. */
export const panelForEvidence = (id: string): LivePanel =>
  id.startsWith('class-') ? { kind: 'class', planId: null } : { kind: 'student', studentId: id.split('-')[0], planId: null, highlight: id };

/** A live answer block: `**bold**` spans, then one chip per cited evidence entry. */
export function LiveText({ block }: { block: LiveBlock }) {
  const live = useLive();
  const source = (id: string) => {
    const list = id.startsWith('class-') ? live?.state.classEvidence : live?.state.students.find((s) => s.id === id.split('-')[0])?.evidence;
    return list?.find((e) => e.id === id)?.source ?? 'Evidence';
  };
  return (
    <>
      {block.text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.length > 4 && part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-egg-ink">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
      {block.cites.map((id) => (
        <button
          key={id}
          type="button"
          data-cite={id}
          onClick={() => live?.showPanel(panelForEvidence(id))}
          className="mx-0.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-egg-line bg-egg-card px-2 py-px align-middle font-mono text-[10.5px] uppercase tracking-wide text-egg-mute hover:border-egg-ink hover:text-egg-ink"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-egg-accent" />
          {source(id)}
        </button>
      ))}
    </>
  );
}
```

- [ ] **Step 5: Wire live mode into `src/teacher/TeacherScreen.tsx`**

Make these exact edits.

1. Replace the first two import lines

```ts
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { STUDENTS, type Student } from '../scenario/classroom';
```

with

```ts
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { classKpis } from '../live/mastery';
import type { AssistantMsg as LiveAssistant, DemoState } from '../live/types';
import { STUDENTS, type Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { LiveText } from './LiveText';
```

2. In `blocksOf`, replace

```ts
    case 'brief': return studentBrief(STUDENTS[m.index!]);
    default: return FALLBACK;
  }
};
```

with

```ts
    case 'brief': return studentBrief(STUDENTS[m.index!]);
    case 'live': return liveBlocks(m.live!);
    default: return FALLBACK;
  }
};

/** Live answers: offline ones reuse the canned topic copy; agent ones render text with evidence chips. */
const liveBlocks = (m: LiveAssistant): Block[] =>
  m.canned === 'fallback' ? FALLBACK
    : m.canned ? TOPICS[m.canned].answer
    : m.blocks.map((b) => ({ kind: b.kind, body: <LiveText block={b} /> }));

/** The opening screen's three figures, from live state. */
const liveFigures = (s: DemoState): string[] => {
  const ma = s.students[MINH_ANH.index];
  const k = classKpis(s.students);
  return [`${ma.quiz.q1}→${ma.quiz.q2}`, `${k.needSupport}/55`, String(k.escalated)];
};
```

3. In `TeacherScreen`, replace

```ts
  const hasAnswer = frame.messages.some((m) => m.role === 'assistant' && m.topic);
  const lastAnswer = [...frame.messages].reverse().find((m) => m.role === 'assistant' && m.kind === 'answer');
```

with

```ts
  const live = useLive();
  const isAnswer = (m: FrameMsg) => m.role === 'assistant' && (m.kind === 'answer' || (m.kind === 'live' && m.live?.source !== 'system'));
  const hasAnswer = frame.messages.some((m) => m.role === 'assistant' && (m.topic || m.live?.panel));
  const lastAnswer = [...frame.messages].reverse().find(isAnswer);
  const openContext = (m?: FrameMsg) => {
    if (m?.live?.panel) live?.showPanel(m.live.panel);
    else actions?.showPanel(m?.topic ?? null);
  };
  const badge = live ? classKpis(live.state.students).needSupport : needSupportAt(frame.classroom.adapt);
```

4. Replace `<Sidebar badge={needSupportAt(frame.classroom.adapt)} view={view} active={view === 'chat' ? panel?.id ?? null : null} actions={actions} />` with:

```tsx
      <Sidebar badge={badge} view={view} active={view === 'chat' ? panel?.id ?? null : null} actions={actions} />
```

5. In the header, replace

```tsx
          <span className="ml-auto rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute">Discrete Mathematics · DM-2026</span>
          {actions && view === 'chat' && panel === null && hasAnswer && (
            <button
              type="button"
              onClick={() => actions.showPanel(lastAnswer?.topic ?? null)}
              className="rounded-full bg-egg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-egg-card"
            >
              Show context
            </button>
          )}
```

with

```tsx
          {live && <span className="ml-auto font-mono text-[12px] tabular-nums text-egg-mute">{fmt(live.state.clock)}</span>}
          <span className={`${live ? '' : 'ml-auto '}rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute`}>Discrete Mathematics · DM-2026</span>
          {actions && view === 'chat' && panel === null && hasAnswer && (
            <button
              type="button"
              onClick={() => openContext(lastAnswer)}
              className="rounded-full bg-egg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-egg-card"
            >
              Show context
            </button>
          )}
          {live && (
            <button type="button" onClick={() => void live.post('reset')} className="rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute hover:border-egg-ink hover:text-egg-ink">
              Reset demo
            </button>
          )}
```

6. Replace the `<AssistantMsg … />` element in the thread with:

```tsx
                    <AssistantMsg
                      key={i}
                      msg={m}
                      isLast={m === lastAnswer && frame.thinking === null}
                      panelShowing={live ? panel !== null : panel?.id === m.topic}
                      onContext={openContext}
                      actions={actions}
                    />
```

7. Replace the whole `Sidebar` function with:

```tsx
function Sidebar({ badge, view, active, actions }: { badge: number; view: View; active: ContextId | null; actions?: TeacherActions }) {
  const live = useLive();
  const nav = (v: View, label: string) => (
    <button
      type="button"
      aria-current={view === v ? 'page' : undefined}
      onClick={() => actions?.setView(v)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] ${view === v ? 'bg-side-hi font-semibold shadow-[0_0_0_1px_rgb(var(--side-ring))]' : 'text-side-mute hover:text-side-ink'}`}
    >
      {label}
      {v === 'classroom' && <span className="rounded-full bg-egg-accent px-2 text-[11px] font-semibold text-egg-ink">{badge}</span>}
    </button>
  );
  const item = (on: boolean) =>
    `w-full truncate rounded-lg px-3 py-2 text-left text-[13.5px] ${on ? 'bg-side-hi font-semibold text-side-ink shadow-[0_0_0_1px_rgb(var(--side-ring))]' : 'text-side-mute hover:bg-side-hi/60 hover:text-side-ink'}`;
  return (
    <nav className="flex w-[264px] shrink-0 flex-col border-r border-side-edge bg-side-bg px-5 py-5 text-side-ink">
      <div className="flex items-center gap-2">
        <span className="font-serif text-[30px] leading-none">Beyond</span>
        <Mark size={16} className="text-side-mark" />
      </div>
      <button type="button" onClick={() => actions?.reset()} className="mt-6 flex items-center gap-2 rounded-full bg-side-cta px-4 py-2.5 text-[13.5px] font-semibold text-side-cta-ink hover:brightness-90">
        <span className="text-[18px] leading-none">+</span> New conversation
      </button>
      <div className="mt-5 space-y-0.5">
        {nav('chat', 'Chat')}
        {nav('classroom', 'Classroom')}
      </div>

      <div className="mt-7"><Eyebrow className="text-side-mute">Today</Eyebrow></div>
      <ul className="mt-2 space-y-0.5">
        {live ? (
          live.state.conversations.length ? (
            live.state.conversations.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={live.activeId === c.id ? 'page' : undefined} onClick={() => live.openConversation(c.id)} className={item(live.activeId === c.id)}>
                  {c.title}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-[13px] text-side-mute">No conversations yet</li>
          )
        ) : (
          ORDER.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => actions?.open(t)} className={item(active === t)}>
                {TOPICS[t].title}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="mt-6"><Eyebrow className="text-side-mute">This week</Eyebrow></div>
      <ul className="mt-2 space-y-0.5 text-[13.5px] text-side-mute">
        {['Assignment 3 extension requests', 'Week 7 room change', 'Quiz 2 item analysis'].map((t) => (
          <li key={t} className="truncate rounded-lg px-3 py-2">{t}</li>
        ))}
      </ul>

      <div className="mt-auto rounded-2xl border border-side-line bg-side-card p-4">
        <div className="font-serif text-[22px] leading-none">Discrete Mathematics</div>
        <div className="mt-1 text-[12.5px] text-side-mute">DM-2026 · 55 students</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {SOURCES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-side-chip px-2 py-0.5 text-[10.5px] text-side-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-egg-accent" />{s}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 px-1">
        <Avatar name={TEACHER} size={34} />
        <div>
          <div className="text-[13.5px] font-semibold">{TEACHER}</div>
          <div className="text-[12px] text-side-mute">Lecturer</div>
        </div>
      </div>
    </nav>
  );
}
```

8. In `EmptyState`, replace `  const rows = frame.greeting.rows;` with

```ts
  const rows = frame.greeting.rows;
  const live = useLive();
```

replace `        <Eyebrow>Saturday, 31 October</Eyebrow>` with

```tsx
        <Eyebrow>{live ? `Saturday, 31 October · ${fmt(live.state.clock)}` : 'Saturday, 31 October'}</Eyebrow>
```

and replace `{figureOf(i, rows[i])}` with `{live ? liveFigures(live.state)[i] : figureOf(i, rows[i])}`.

9. Replace the whole `AssistantMsg` function with:

```tsx
function AssistantMsg({ msg, isLast, panelShowing, onContext, actions }: {
  msg: FrameMsg; isLast: boolean; panelShowing: boolean; onContext(m: FrameMsg): void; actions?: TeacherActions;
}) {
  const blocks = blocksOf(msg);
  const done = msg.shown >= blocks.length;
  const live = msg.live;
  const topic = msg.topic ? TOPICS[msg.topic] : null;
  const isAnswer = msg.kind === 'answer' || (live !== undefined && live.source !== 'system');
  const hasContext = live ? live.panel !== null : msg.topic !== undefined;
  const followUps = live ? live.followUps : topic?.followUps ?? [];
  return (
    <div className="mb-9 grid grid-cols-[28px_1fr] gap-3" style={rise(msg.appear, 6)}>
      <div className="pt-1"><Mark size={20} /></div>
      <div>
        {(msg.stamp || live?.source === 'offline') && (
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-egg-mute">
            {msg.stamp}
            {live?.source === 'offline' && <span className="rounded-full border border-egg-line px-2 py-px uppercase tracking-wide">Offline answer</span>}
          </div>
        )}
        <div className="chat-prose text-[15.5px] leading-[1.65] text-egg-ink/90">
          <Blocks blocks={blocks} shown={msg.shown} />
        </div>
        {isAnswer && done && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-egg-mute">
            <span className="rounded-full bg-egg-paper px-2.5 py-1">Student Analysis Agent ⇄ Teaching Assistance Agent</span>
            {!panelShowing && hasContext && (
              <button type="button" onClick={() => onContext(msg)} className="rounded-full border border-egg-ink/25 px-2.5 py-1 font-semibold text-egg-ink hover:border-egg-ink">
                Open context →
              </button>
            )}
          </div>
        )}
        {isLast && done && followUps.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {followUps.map((f) => (
              <button key={f} type="button" onClick={() => actions?.send(f)} className="rounded-full border border-egg-line bg-egg-card px-3.5 py-1.5 text-[13px] text-egg-ink hover:border-egg-accent">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/teacher/live.test.tsx`
Expected: PASS (6 tests).

Run: `npm test`
Expected: PASS — the scripted `TeacherScreen` tests still pass (no `LiveProvider` → scripted behaviour).

- [ ] **Step 7: Commit**

```bash
git add src/live/LiveContext.tsx src/live/fixtures.ts src/teacher/LiveText.tsx src/teacher/TeacherScreen.tsx src/teacher/live.test.tsx
git commit -m "feat(teacher): live answers, conversations, clock and Reset demo in the teacher screen"
```

---

### Task 14: Live context panels and the plan card

**Files:**
- Create: `src/teacher/LivePanel.tsx`
- Modify: `src/teacher/parts.tsx` (move `Section` here), `src/teacher/ContextPanel.tsx` (import `Section`; render live panels)
- Test: `src/teacher/livePanel.test.tsx`

**Interfaces:**
- Consumes: `useLive`, `ctxFor` (Task 13); `classKpis`, `topicMastery`; `FramePanel.live` (Task 12).
- Produces: `Section` exported from `parts.tsx`; `LivePlanCard({ plan })`; `LivePanelBody({ live, bars })`. Plan-card buttons post `plan/approve`, `plan/dismiss`, `plan/edit` (time on blur of a time input, remove via ✕).

- [ ] **Step 1: Write the failing test**

Create `src/teacher/livePanel.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { DemoState, LivePanel } from '../live/types';
import { ContextPanel } from './ContextPanel';
import { PAST, teacherFrame } from './frame';
import { LivePanelBody } from './LivePanel';

const render = (state: DemoState, live: LivePanel) =>
  html(<LiveProvider value={ctxFor(state)}><LivePanelBody live={live} bars={1} /></LiveProvider>);
const student = (over: Partial<Extract<LivePanel, { kind: 'student' }>> = {}): LivePanel =>
  ({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null, ...over });

describe('live panels', () => {
  it('student panel: twin meters, highlighted evidence and the proposed plan card', () => {
    const out = render(stateWithPlan(), student({ highlight: 's17-quiz2' }));
    expect(out).toContain('Nguyễn Minh Anh');
    expect(out).toContain('Implication: 0.31 mastery');
    expect(out).toContain('Rebuild implication, then equivalence');
    expect(out).toContain('Approve &amp; send');
    expect(out).toContain('Not now');
    expect(out).toMatch(/style="background:[^"]*" data-evidence="s17-quiz2"/);
  });
  it('shows the plan status once it has been acted on', () => {
    const sent = render(stateWithPlan('pathway', { status: 'sent' }), student());
    expect(sent).toContain('Sent to Minh Anh’s phone');
    expect(sent).not.toContain('Approve &amp; send');
    const auto = render(stateWithPlan('pathway', { status: 'autoApproved' }), student());
    expect(auto).toContain('Auto-approved · within your policy');
    expect(auto).toContain('Auto-approved · sent to the phone');
  });
  it('class panel: group meters, the affected list and the class activity card', () => {
    const out = render(stateWithPlan('classActivity'), { kind: 'class', planId: 'p1' });
    expect(out).toContain('Group G1:');
    expect(out).toContain('Who’s affected');
    expect(out).toContain('Approve plan');
  });
  it('check-ins panel: each student with their latest note', () => {
    const out = render(stateWithPlan('checkIns'), { kind: 'checkIns', planId: 'p1' });
    expect(out).toContain('2 students need a conversation');
    expect(out).toContain('Works hard in tutorial but freezes on truth tables');
    expect(out).toContain('No reply to two check-in messages');
    expect(out).toContain('Book all');
  });
  it('ContextPanel renders the live body when the frame panel is live', () => {
    const s = stateWithPlan();
    const panel = teacherFrame([{ at: PAST, type: 'panel', id: 'student', live: student() }], 0).panel!;
    const out = html(<LiveProvider value={ctxFor(s)}><ContextPanel panel={panel} approved={false} /></LiveProvider>);
    expect(out).toContain('Student context');
    expect(out).toContain('Approve &amp; send');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/teacher/livePanel.test.tsx`
Expected: FAIL — cannot resolve `./LivePanel`.

- [ ] **Step 3: Move `Section` into `parts.tsx`**

In `src/teacher/ContextPanel.tsx`, delete the `Section` function:

```tsx
function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between border-b border-egg-ink/80 pb-1.5">
        <h3 className="font-serif text-[22px] leading-none text-egg-ink">{title}</h3>
        {aside && <span className="text-[12px] text-egg-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
```

delete the now-unused `import type { ReactNode } from 'react';` line, and change `import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter } from './parts';` to:

```ts
import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter, Section } from './parts';
```

Append to `src/teacher/parts.tsx`:

```tsx
/** A ruled panel section with a serif title and an optional note on the right. */
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between border-b border-egg-ink/80 pb-1.5">
        <h3 className="font-serif text-[22px] leading-none text-egg-ink">{title}</h3>
        {aside && <span className="text-[12px] text-egg-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Write `src/teacher/LivePanel.tsx`**

```tsx
import { useState } from 'react';
import { useLive } from '../live/LiveContext';
import { classKpis, topicMastery } from '../live/mastery';
import type { DemoState, LivePanel, Plan, StudentProfile } from '../live/types';
import { GROUPS } from '../scenario/classroom';
import { conceptById } from '../scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../scenario/minhAnh';
import { egg } from '../ui/theme';
import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter, Section } from './parts';

const APPROVE: Record<Plan['kind'], string> = { pathway: 'Approve & send', classActivity: 'Approve plan', checkIns: 'Book all' };
const EYEBROW: Record<Plan['kind'], string> = { pathway: 'Proposed pathway', classActivity: 'Proposed class activity', checkIns: 'Proposed check-ins' };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function statusLabel(plan: Plan, state: DemoState): string {
  const name = state.students.find((s) => s.id === plan.studentIds[0])?.short ?? 'the student';
  switch (plan.status) {
    case 'sent': return `Sent to ${name}’s phone`;
    case 'autoApproved': return 'Auto-approved · sent to the phone';
    case 'done': return 'Completed';
    case 'approved': return plan.kind === 'classActivity' ? `Scheduled · ${plan.day}` : `Invitations sent · ${plan.day}`;
    case 'dismissed': return 'Set aside';
    default: return '';
  }
}

/** Any plan, with the teacher's controls while it is still proposed. */
export function LivePlanCard({ plan }: { plan: Plan }) {
  const live = useLive();
  const [editing, setEditing] = useState(false);
  if (!live) return null;
  const proposed = plan.status === 'proposed';
  const edit = (i: number, change: { time?: string; remove?: boolean }) => void live.post('plan/edit', { planId: plan.id, sessionIndex: i, ...change });
  return (
    <section className="mt-7 rounded-2xl border-2 border-egg-ink bg-egg-card p-5">
      <div className="flex items-center gap-2">
        <Mark size={14} />
        <Eyebrow>{EYEBROW[plan.kind]}</Eyebrow>
      </div>
      <h3 className="mt-2 font-serif text-[28px] leading-[1.05] text-egg-ink">{plan.title}</h3>
      <div className="mt-1 text-[12.5px] text-egg-mute">
        {`${plan.status === 'autoApproved' ? 'Auto-approved · within your policy' : 'Agreed by Student Analysis + Teaching Assistance agents'} · ${plan.day}`}
      </div>
      <ol className="mt-4 divide-y divide-egg-line border-y border-egg-line">
        {plan.sessions.map((s, i) => (
          <li key={i} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 py-2.5">
            <span className="font-mono text-[11px] text-egg-mute">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[13.5px] text-egg-ink">{`${s.title} · ${s.minutes} min`}</span>
            {editing && proposed ? (
              <span className="flex items-center gap-1.5">
                <input
                  aria-label={`Session ${i + 1} time`}
                  type="time"
                  defaultValue={s.time}
                  onBlur={(e) => { if (e.target.value && e.target.value !== s.time) edit(i, { time: e.target.value }); }}
                  className="w-[92px] rounded-md border border-egg-line bg-egg-bg px-1.5 py-0.5 font-mono text-[13px] text-egg-ink"
                />
                {!s.isMasteryCheck && plan.sessions.length > 1 && (
                  <button type="button" aria-label={`Remove session ${i + 1}`} onClick={() => edit(i, { remove: true })} className="px-1 text-[13px] text-egg-mute hover:text-egg-brick">✕</button>
                )}
              </span>
            ) : (
              <span className="font-serif text-[19px] leading-none text-egg-accent-ink">{s.time}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 text-[12.5px] text-egg-mute">
        Success looks like: <span className="text-egg-ink">{plan.outcome}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {proposed ? (
          <>
            <Button kind="primary" onClick={() => void live.post('plan/approve', { planId: plan.id })}>{APPROVE[plan.kind]}</Button>
            <Button onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</Button>
            <Button onClick={() => void live.post('plan/dismiss', { planId: plan.id })}>Not now</Button>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-egg-ink px-4 py-2 text-[13.5px] font-semibold text-egg-card">
            <span className="h-2 w-2 rounded-full bg-egg-accent" /> {statusLabel(plan, live.state)}
          </span>
        )}
      </div>
    </section>
  );
}

function StudentLive({ s, plan, highlight, bars, state }: { s: StudentProfile; plan: Plan | null; highlight: string | null; bars: number; state: DemoState }) {
  const level = s.escalated ? 'personal' : s.status === 'onTrack' ? null : s.status;
  const classPractice = (Math.round(mean(state.students.map((x) => x.practicePerWeek)) * 10) / 10).toFixed(1);
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={s.name} size={52} accent={s.status === 'highRisk'} />
        <div className="min-w-0">
          <div className="text-[19px] font-semibold text-egg-ink">{s.name}</div>
          <div className="text-[13px] text-egg-mute">{`Discrete Mathematics · Group ${s.group}`}</div>
        </div>
        <div className="ml-auto">
          {level ? <LevelChip level={level} /> : <span className="rounded-full border border-egg-line px-2.5 py-0.5 text-[11.5px] text-egg-mute">On track</span>}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Quiz 1 → Quiz 2</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[22px] text-egg-mute line-through decoration-1">{`${s.quiz.q1}%`}</span>
            <span className="text-[48px] leading-none">{`${s.quiz.q2}%`}</span>
          </div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Practice / week</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[48px] leading-none">{s.practicePerWeek}</span>
            <span className="font-sans text-[14px] text-egg-mute">{`class ${classPractice}`}</span>
          </div>
        </div>
      </div>
      <Section title="Concept mastery" aside="gap below 0.50">
        {TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={s.mastery[c]} grow={bars} />)}
      </Section>
      {plan && <LivePlanCard plan={plan} />}
      <Section title="Evidence" aside={`${s.evidence.length} entries`}>
        <ul className="divide-y divide-egg-line">
          {[...s.evidence].reverse().map((e) => (
            <li key={e.id} className="grid grid-cols-[96px_1fr] gap-3 py-2" style={e.id === highlight ? { background: egg('accent', 0.18) } : undefined} data-evidence={e.id}>
              <span className="font-mono text-[10.5px] uppercase leading-[18px] tracking-wide text-egg-mute">{e.source}</span>
              <span className="text-[13.5px] text-egg-ink">
                {e.text}
                <span className="ml-1.5 text-[12px] text-egg-mute">{e.when}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function ClassLive({ state, plan, bars }: { state: DemoState; plan: Plan | null; bars: number }) {
  const k = classKpis(state.students);
  const affected = state.students.filter((s) => s.status !== 'onTrack').sort((a, b) => topicMastery(a.mastery) - topicMastery(b.mastery));
  return (
    <>
      <Eyebrow>Discrete Mathematics · Week 6</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">Logical equivalence across the class</h2>
      <div className="mt-5 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Need support</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">{k.needSupport}<span className="text-[22px] text-egg-mute">{` / ${k.students}`}</span></div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Avg. mastery</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">{k.avgMastery.toFixed(2)}</div>
        </div>
      </div>
      <Section title="By group" aside="avg. mastery, gap below 0.50">
        {GROUPS.map((g) => <Meter key={g} label={`Group ${g}`} value={mean(state.students.filter((s) => s.group === g).map((s) => topicMastery(s.mastery)))} grow={bars} />)}
      </Section>
      {plan && <LivePlanCard plan={plan} />}
      <Section title="Who’s affected" aside={`${affected.length} students`}>
        <ul className="divide-y divide-egg-line">
          {affected.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Avatar name={s.name} size={28} accent={s.status === 'highRisk'} />
              <span className="flex-1 truncate text-[13.5px] text-egg-ink">{s.name}</span>
              <span className="font-mono text-[12px] tabular-nums text-egg-mute">{topicMastery(s.mastery).toFixed(2)}</span>
              <LevelChip level={s.escalated ? 'personal' : s.status === 'highRisk' ? 'highRisk' : 'support'} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function CheckInsLive({ state, plan }: { state: DemoState; plan: Plan }) {
  const people = plan.sessions.flatMap((x) => {
    const s = state.students.find((p) => p.id === x.studentId);
    return s ? [s] : [];
  });
  return (
    <>
      <Eyebrow>Your escalation rule · no gain after 2 sessions</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">
        {people.length === 1 ? 'One student needs a conversation' : `${people.length} students need a conversation`}
      </h2>
      <div className="mt-5 space-y-3">
        {people.map((s) => {
          const note = [...s.evidence].reverse().find((e) => ['taNote', 'message', 'record', 'attendance'].includes(e.kind));
          return (
            <div key={s.id} className="rounded-2xl border border-egg-line bg-egg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-egg-ink">{s.name}</div>
                  <div className="text-[12.5px] text-egg-mute">{`Mastery ${topicMastery(s.mastery).toFixed(2)}`}</div>
                </div>
                <LevelChip level="personal" />
              </div>
              {note && <div className="mt-3 text-[13px] text-egg-ink"><span className="text-egg-mute">{`${note.source} · `}</span>{note.text}</div>}
            </div>
          );
        })}
      </div>
      <LivePlanCard plan={plan} />
    </>
  );
}

/** The context panel body in live mode: a student twin, the class view or the check-ins, each with its plan. */
export function LivePanelBody({ live, bars }: { live: LivePanel; bars: number }) {
  const ctx = useLive();
  if (!ctx) return null;
  const { state } = ctx;
  const plan = live.planId ? state.plans.find((p) => p.id === live.planId) ?? null : null;
  if (live.kind === 'student') {
    const s = state.students.find((x) => x.id === live.studentId);
    return s ? <StudentLive s={s} plan={plan} highlight={live.highlight} bars={bars} state={state} /> : null;
  }
  if (live.kind === 'class') return <ClassLive state={state} plan={plan} bars={bars} />;
  return plan ? <CheckInsLive state={state} plan={plan} /> : null;
}
```

- [ ] **Step 5: Render live panels from `ContextPanel`**

In `src/teacher/ContextPanel.tsx`, add `import { LivePanelBody } from './LivePanel';` to the imports, and replace

```tsx
          {id === 'student' && <StudentContext panel={panel} approved={approved} actions={actions} />}
          {id === 'class' && <ClassContext panel={panel} approved={approved} actions={actions} />}
          {id === 'attention' && <AttentionContext panel={panel} approved={approved} actions={actions} />}
```

with

```tsx
          {panel.live ? (
            <LivePanelBody live={panel.live} bars={panel.bars} />
          ) : (
            <>
              {id === 'student' && <StudentContext panel={panel} approved={approved} actions={actions} />}
              {id === 'class' && <ClassContext panel={panel} approved={approved} actions={actions} />}
              {id === 'attention' && <AttentionContext panel={panel} approved={approved} actions={actions} />}
            </>
          )}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/teacher/livePanel.test.tsx`
Expected: PASS (5 tests).

Run: `npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/teacher/LivePanel.tsx src/teacher/parts.tsx src/teacher/ContextPanel.tsx src/teacher/livePanel.test.tsx
git commit -m "feat(teacher): live student, class and check-in panels with an editable plan card"
```

---

### Task 15: Live Classroom, the live teacher view, and the click audit

**Files:**
- Modify: `src/teacher/Classroom.tsx`, `package.json` (add `happy-dom`)
- Replace: `src/teacher/LiveTeacher.tsx`
- Test: `src/teacher/liveAudit.test.tsx`

**Interfaces:**
- Consumes: `useLive`, `LiveProvider`, `DEMO_ONLY` (Task 13); `liveEvents`, `keysOf`, `panelId`, `SeenClock` (Task 12); `DemoSource`, `useServerSource` (Task 12); `liveStudents` (Task 1); `CANNED_TOPICS` (Task 9).
- Produces: `LiveTeacher()` (server-backed) and `LiveTeacherView({ source: DemoSource })` (testable); `needSupportAt(a, list?)`; the Classroom reads live students, its **Export** shows the demo toast, filter buttons carry `aria-current` when active.

- [ ] **Step 1: Install happy-dom**

Run: `npm install -D happy-dom@21.0.4`

- [ ] **Step 2: Write the failing click audit**

Create `src/teacher/liveAudit.test.tsx`:

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
  // Freeze the render clock so every frame is deterministic.
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => unmount());

function unmount() {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
}

async function mount() {
  const calls: string[] = [];
  const source: DemoSource = {
    state: stateWithPlan(),
    post: async (path) => {
      calls.push(path);
      return { ok: true, conversationId: 'c1' };
    },
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}

const buttons = (el: HTMLElement) => [...el.querySelectorAll('button')];
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const byText = (el: HTMLElement, text: string) => buttons(el).find((b) => b.textContent?.trim() === text)!;
const skip = (b: HTMLButtonElement) => b.disabled || b.type === 'submit' || b.hasAttribute('aria-current');

const SCENARIOS: [string, (el: HTMLElement) => Promise<void>][] = [
  ['conversation with its plan (reopened after a refresh)', async () => {}],
  ['opening screen', async (el) => click(byText(el, '+ New conversation'))],
  ['classroom with a student open', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
  }],
];

describe('live teacher click audit (spec §2.6)', () => {
  for (const [name, setup] of SCENARIOS) {
    it(`every button does something: ${name}`, async () => {
      let m = await mount();
      await setup(m.el);
      const count = buttons(m.el).length;
      expect(count).toBeGreaterThan(5);
      for (let i = 0; i < count; i++) {
        unmount();
        m = await mount();
        await setup(m.el);
        const b = buttons(m.el)[i];
        if (!b || skip(b)) continue;
        const label = b.textContent?.trim() || b.getAttribute('aria-label') || b.title;
        const before = m.el.innerHTML;
        await click(b);
        const did = m.calls.length > 0 || m.el.innerHTML !== before || document.querySelector('[role="status"]') !== null;
        expect(did, `"${label}" in ${name} did nothing`).toBe(true);
      }
    }, 60_000);
  }
});
```

The Classroom nav button's text is `Classroom` followed by its badge (`12`), hence `'Classroom12'`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/teacher/liveAudit.test.tsx`
Expected: FAIL — `LiveTeacherView` is not exported.

- [ ] **Step 4: Read live students in `src/teacher/Classroom.tsx`**

Make these exact edits.

1. Add to the imports:

```ts
import { DEMO_ONLY, useLive } from '../live/LiveContext';
import { liveStudents } from '../live/mastery';
```

2. Replace

```ts
  if (s.index === MINH_ANH.index) return lerp(MASTERY_INITIAL.equivalence, MASTERY_POST.equivalence, a);
```

with (identical in scripted mode, where Minh Anh's `s.mastery` is `MASTERY_INITIAL.equivalence`; live mode shows her current figure):

```ts
  if (s.index === MINH_ANH.index) return lerp(s.mastery, MASTERY_POST.equivalence, a);
```

3. Replace

```ts
export const needSupportAt = (a: number) => STUDENTS.filter((s) => adaptedBand(s, a) !== 'onTrack').length;
const highRiskAt = (a: number) => STUDENTS.filter((s) => ['highRisk', 'personal'].includes(adaptedBand(s, a))).length;
```

with

```ts
export const needSupportAt = (a: number, list: Student[] = STUDENTS) => list.filter((s) => adaptedBand(s, a) !== 'onTrack').length;
const highRiskAt = (a: number, list: Student[] = STUDENTS) => list.filter((s) => ['highRisk', 'personal'].includes(adaptedBand(s, a))).length;
```

4. Replace the top of `Classroom`

```ts
  const [filter, setFilter] = useState<Filter>('all');
  const a = cls.adapt;
  const k = cls.kpi;
  const avg = STUDENTS.reduce((sum, s) => sum + adaptedMastery(s, a), 0) / STUDENTS.length;
  const count = (b: Band) => STUDENTS.filter((s) => adaptedBand(s, a) === b).length;
  const pick = (i: number) => actions?.select(cls.selected === i ? null : i);
  const needSupport = Math.round(needSupportAt(a) * k);
```

with

```ts
  const [filter, setFilter] = useState<Filter>('all');
  const live = useLive();
  const students = live ? liveStudents(live.state) : STUDENTS;
  const approved = live
    ? live.state.plans.some((p) => p.studentIds.includes(MINH_ANH.id) && ['sent', 'done', 'autoApproved'].includes(p.status))
    : studentApproved;
  const a = cls.adapt;
  const k = cls.kpi;
  const avg = students.reduce((sum, s) => sum + adaptedMastery(s, a), 0) / students.length;
  const count = (b: Band) => students.filter((s) => adaptedBand(s, a) === b).length;
  const pick = (i: number) => actions?.select(cls.selected === i ? null : i);
  const needSupport = Math.round(needSupportAt(a, students) * k);
```

5. Replace `<Button>Export</Button>` with:

```tsx
            <Button onClick={live ? () => live.toast(DEMO_ONLY) : undefined}>Export</Button>
```

6. Replace `{ label: 'High risk', value: String(Math.round(highRiskAt(a) * k)), note: `${COMPLEX.length} escalated to you` },` with:

```tsx
            { label: 'High risk', value: String(Math.round(highRiskAt(a, students) * k)), note: `${COMPLEX.length} escalated to you` },
```

7. In the filter buttons, after `onClick={() => setFilter(f)}` add the line:

```tsx
                  aria-current={filter === f ? 'true' : undefined}
```

and replace `{f === 'all' ? `All ${STUDENTS.length}` : `${BAND[f].label} ${count(f)}`}` with `{f === 'all' ? `All ${students.length}` : `${BAND[f].label} ${count(f)}`}`.

8. Replace `{STUDENTS.map((s, i) => {` (the tile grid) with `{students.map((s, i) => {`.

9. Replace `<StudentCard s={STUDENTS[cls.selected]} adapt={a} appear={cls.selectAppear} actions={actions} />` with:

```tsx
              <StudentCard s={students[cls.selected]} adapt={a} appear={cls.selectAppear} actions={actions} />
```

10. In the Interventions rows, replace

```ts
                      const r = row.index === MINH_ANH.index && studentApproved ? { ...row, state: 'Running' } : row;
                      const s = STUDENTS[r.index];
```

with

```ts
                      const r = row.index === MINH_ANH.index && approved ? { ...row, state: 'Running' } : row;
                      const s = students[r.index];
```

11. In `StudentCard`, add `const profile = useLive()?.state.students[s.index];` as its first line, and replace

```tsx
        {isMinhAnh ? (
          TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={lerp(MASTERY_INITIAL[c], MASTERY_POST[c], adapt)} />)
        ) : (
```

with

```tsx
        {profile ? (
          TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={profile.mastery[c]} />)
        ) : isMinhAnh ? (
          TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={lerp(MASTERY_INITIAL[c], MASTERY_POST[c], adapt)} />)
        ) : (
```

- [ ] **Step 5: Replace `src/teacher/LiveTeacher.tsx`**

```tsx
import { useRef, useState } from 'react';
import { useNow } from '../engine/useNow';
import { keysOf, liveEvents, panelId, SeenClock } from '../live/events';
import { LiveProvider, type LiveCtx } from '../live/LiveContext';
import { useServerSource, type DemoSource } from '../live/source';
import type { LivePanel } from '../live/types';
import type { Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { PAST, teacherFrame, type TeacherEvent, type View } from './frame';
import { CANNED_TOPICS } from './route';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const TOAST_MS = 2000;
const BASE: TeacherEvent[] = [{ at: PAST, type: 'greeting' }, { at: PAST, type: 'classroomReveal' }];
/** Local UI events that survive switching conversations. */
const keepUi = (e: TeacherEvent) => e.type === 'view' || e.type === 'select';

/** The live booth teacher window: server state over SSE, rendered through the same frame model as the video. */
export function LiveTeacher() {
  return <LiveTeacherView source={useServerSource()} />;
}

export function LiveTeacherView({ source }: { source: DemoSource }) {
  const [t0] = useState(() => Date.now());
  const t = useNow() - t0;
  const { state, post } = source;
  const seen = useRef(new SeenClock()).current;
  const [epoch, setEpoch] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [local, setLocal] = useState<TeacherEvent[]>([]);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);

  if (state && state.epoch !== epoch) {
    // First snapshot (a refresh reopens the latest conversation) or a reset on the server (a fresh chat).
    if (epoch !== null) seen.clear();
    setEpoch(state.epoch);
    setActiveId(epoch === null ? state.conversations.at(-1)?.id ?? null : null);
    setLocal([]);
  }
  if (!state) {
    return <div className="flex h-full items-center justify-center bg-egg-bg font-sans text-[15px] text-egg-mute">Connecting to the booth server… (start it with npm run booth)</div>;
  }
  seen.stamp(keysOf(state), t);

  const showToast = (text: string) => setToast({ text, at: t });
  const pushLocal = (...e: TeacherEvent[]) => setLocal((l) => [...l, ...e]);
  const frame = teacherFrame([...BASE, ...liveEvents(state, activeId, seen), ...local].sort((a, b) => a.at - b.at), t);

  const ask = async (text: string, conversationId: string | null) => {
    const question = text.trim();
    if (!question || state.busy) return;
    setDraft('');
    pushLocal({ at: t, type: 'view', view: 'chat' });
    const r = await post('ask', { text: question, conversationId });
    if (r.ok && typeof r.conversationId === 'string') {
      if (r.conversationId !== activeId) setLocal((l) => l.filter(keepUi));
      setActiveId(r.conversationId);
    } else {
      showToast(typeof r.error === 'string' ? r.error : 'The booth server is not responding');
    }
  };
  const showPanel = (p: LivePanel | null) => {
    // An evidence chip for the student already open keeps that student's plan in the panel.
    const cur = frame.panel?.live;
    const merged = p?.kind === 'student' && cur?.kind === 'student' && cur.studentId === p.studentId && !p.planId ? { ...p, planId: cur.planId } : p;
    pushLocal({ at: t, type: 'panel', id: merged ? panelId(merged) : null, live: merged ?? undefined });
  };
  const switchTo = (id: string | null) => {
    setActiveId(id);
    setLocal((l) => [...l.filter(keepUi), { at: t, type: 'view', view: 'chat' }]);
  };

  const actions: TeacherActions = {
    send: (text) => void ask(text, activeId),
    open: () => undefined, // canned topics are not listed in live mode
    reset: () => switchTo(null), // "New conversation"
    setView: (v: View) => pushLocal({ at: t, type: 'view', view: v }),
    approve: () => undefined, // the live plan card posts directly
    edit: () => undefined,
    showPanel: (id) => { if (id === null) showPanel(null); },
    select: (index) => pushLocal({ at: t, type: 'select', index }),
    askStudent: (s: Student) => void ask(s.index === MINH_ANH.index ? CANNED_TOPICS.student.prompt : `How is ${s.name} doing?`, null),
    askClass: () => void ask(CANNED_TOPICS.class.prompt, null),
  };
  const ctx: LiveCtx = { state, activeId, post, openConversation: switchTo, showPanel, toast: showToast };

  return (
    <LiveProvider value={ctx}>
      <TeacherScreen frame={frame} actions={actions} composer={{ value: draft, onChange: setDraft }} />
      {toast && t - toast.at < TOAST_MS && (
        <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-egg-ink px-4 py-2 font-sans text-[13.5px] font-semibold text-egg-card">
          {toast.text}
        </div>
      )}
    </LiveProvider>
  );
}
```

- [ ] **Step 6: Run the audit and the full suite**

Run: `npx vitest run src/teacher/liveAudit.test.tsx`
Expected: PASS (3 tests). If a button is reported as doing nothing, wire it per spec §2.6 (live action, agent route, or `live.toast(DEMO_ONLY)`) — do not weaken the audit.

Run: `npm test && npm run typecheck`
Expected: PASS — the scripted Classroom tests (`classroom counts agree after adapt`, etc.) are unchanged.

- [ ] **Step 7: Manual check in the browser**

Run: `npm run booth`, open `http://localhost:5173/teacher.html`.
Expected: the opening screen shows `Saturday, 31 October · 15:00`; clicking the first attention row shows thinking lines, then an answer (offline tag if there is no key) and the student panel with **Approve & send**; **Export** in the Classroom shows "Not part of this demo"; **Reset demo** clears the conversation.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/teacher/Classroom.tsx src/teacher/LiveTeacher.tsx src/teacher/liveAudit.test.tsx
git commit -m "feat(teacher): server-backed live teacher view, live Classroom and click audit"
```

---

### Task 16: The live phone

**Files:**
- Create: `src/student/liveView.ts`, `src/student/LivePhone.tsx`, `src/student/screens/LivePractice.tsx`
- Replace: `src/student/screens/LockScreen.tsx`, `src/student/screens/PlanScreen.tsx`, `src/student/screens/ProgressScreen.tsx`
- Modify: `src/student/screens/PracticeScreen.tsx` (export `OPTION_CLS`), `src/student/main.tsx`
- Test: `src/student/liveView.test.ts`, `src/student/live.test.tsx`, `src/student/liveAudit.test.tsx`

**Interfaces:**
- Consumes: reducers (Task 5), `stateWithPlan` (Task 4), `DemoSource` (Task 12), `fmt`.
- Produces:
  - `liveView.ts`: `interface PlanView { name; heading; topic; objectives; items: { title; when; mins }[]; done: number[]; next: number | null; canSkip: boolean }`, `planView(state): PlanView | null`, `notificationCopy(state): { title; body } | null`, `interface ProgressView { concept; from; to; accuracy; items: { title; when }[]; done: number; remaining: string | null; backLabel: string }`, `progressView(state): ProgressView | null`
  - `LockScreen` gains `message?`, `onTap?`; `PlanScreen` gains `live?: PlanView`, `onOpen?(i)`, `onSkip?()`; `ProgressScreen` gains `live?: ProgressView`, `onBack?()`
  - `LivePractice({ state, onAnswer, onNext })`, `LivePhone()`, `LivePhoneView({ source })`

- [ ] **Step 1: Write the failing tests**

Create `src/student/liveView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { notificationCopy, planView, progressView } from './liveView';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));

describe('phone views', () => {
  it('plan view and notification copy for a delivered plan', () => {
    expect(planView(sent())).toEqual({
      name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence',
      objectives: ['Implication', 'Logical equivalence'],
      items: [{ title: 'Review implication', when: 'Today 15:30', mins: 8 }, { title: 'Mastery check', when: 'Today 20:00', mins: 10 }],
      done: [], next: 0, canSkip: true,
    });
    expect(notificationCopy(sent())).toEqual({ title: 'Your personalized plan is ready', body: '2 short sessions today to strengthen implication & logical equivalence.' });
    expect(planView(stateWithPlan())).toBeNull();
  });
  it('progress view after the mastery check', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
    for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
    const p = progressView(s)!;
    expect(p).toMatchObject({ concept: 'Logical equivalence', from: 35, accuracy: 100, done: 2, remaining: null, backLabel: 'Back to plan' });
    expect(p.to).toBeGreaterThan(60);
  });
});
```

Create `src/student/live.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneOpen, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { Q1 } from '../scenario/practice';
import { LivePractice } from './screens/LivePractice';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const practice = () => ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0));
const view = {
  name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence', objectives: ['Implication', 'Logical equivalence'],
  items: [{ title: 'Review implication', when: 'Today 15:30', mins: 8 }, { title: 'Mastery check', when: 'Today 20:00', mins: 10 }],
  done: [], next: 0, canSkip: true,
};

describe('live phone screens', () => {
  it('the lock-screen notification becomes a button with the plan copy', () => {
    const out = html(<LockScreen t={0} notification={1} clock="15:00" message={{ title: 'Your personalized plan is ready', body: '2 short sessions today.' }} onTap={() => {}} />);
    expect(out).toMatch(/<button type="button" class="[^"]*text-left/);
    expect(out).toContain('2 short sessions today.');
  });
  it('the plan screen lists live sessions as buttons, with Skip to tonight', () => {
    const out = html(<PlanScreen local={5000} variant="initial" clock="15:00" live={view} onOpen={() => {}} onSkip={() => {}} />);
    expect(out).toContain('Review implication');
    expect(out).toContain('Today 20:00 · 10 min');
    expect(out.split('Up next').length - 1).toBe(1);
    expect(out).toContain('Skip to tonight');
    expect(out).toMatch(/<button type="button" class="relative flex/);
    const done = html(<PlanScreen local={5000} variant="initial" live={{ ...view, done: [0], next: 1, canSkip: false }} onOpen={() => {}} />);
    expect(done).toContain('✓');
    expect(done).not.toContain('Skip to tonight');
  });
  it('the progress screen shows live figures and a way back', () => {
    const out = html(<ProgressScreen local={5000} live={{ concept: 'Logical equivalence', from: 35, to: 71, accuracy: 100, items: [{ title: 'A', when: '15:30' }], done: 1, remaining: null, backLabel: 'Back to plan' }} onBack={() => {}} />);
    expect(out).toMatch(/<text[^>]*>71%</);
    expect(out).toContain('Back to plan');
  });
  it('practice: a wrong answer shows that option’s hint; a right one shows Next and the worked rewrite', () => {
    const wrong = html(<LivePractice state={ok(phoneAnswer(practice(), 0))} onAnswer={() => {}} onNext={() => {}} />);
    expect(wrong).toContain('Not quite');
    expect(wrong).toContain(Q1.hint);
    const right = html(<LivePractice state={ok(phoneAnswer(practice(), 1))} onAnswer={() => {}} onNext={() => {}} />);
    expect(right).toContain('Correct!');
    expect(right).toContain('>Next<');
    expect(right).toContain('Show the next step');
    expect(right).toContain('¬(p → q)');
  });
});
```

Create `src/student/liveAudit.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { LivePhoneView } from './LivePhone';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));
const practice = () => ok(phoneOpen(sent(), 0));
const progress = () => {
  let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
  for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
  return s;
};
const STATES: [string, () => DemoState][] = [
  ['lock with a plan', sent],
  ['plan', () => ok(phoneShowPlan(sent()))],
  ['practice', practice],
  ['practice after a wrong answer', () => ok(phoneAnswer(practice(), 0))],
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['progress', progress],
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeAll(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

async function mount(state: DemoState) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LivePhoneView source={source} />));
  return { calls, el: host };
}

describe('live phone click audit', () => {
  for (const [name, make] of STATES) {
    it(`every enabled button does something: ${name}`, async () => {
      const first = await mount(make());
      const count = first.el.querySelectorAll('button').length;
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        act(() => root?.unmount());
        host?.remove();
        const m = await mount(make());
        const b = m.el.querySelectorAll('button')[i];
        if (!b || b.disabled) continue;
        const before = m.el.innerHTML;
        await act(async () => b.click());
        expect(m.calls.length > 0 || m.el.innerHTML !== before, `"${b.textContent?.trim()}" in ${name} did nothing`).toBe(true);
      }
    });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/student/liveView.test.ts src/student/live.test.tsx src/student/liveAudit.test.tsx`
Expected: FAIL — cannot resolve `./liveView` / `./screens/LivePractice` / `./LivePhone`.

- [ ] **Step 3: Write `src/student/liveView.ts`**

```ts
import { planById, studentById } from '../live/reducer';
import type { DemoState, Plan } from '../live/types';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';

export interface PlanView {
  name: string;
  heading: string;
  topic: string;
  objectives: string[];
  items: { title: string; when: string; mins: number }[];
  done: number[];
  next: number | null;
  canSkip: boolean;
}

export interface ProgressView {
  concept: string;
  from: number;
  to: number;
  accuracy: number;
  items: { title: string; when: string }[];
  done: number;
  remaining: string | null;
  backLabel: string;
}

const conceptsOf = (plan: Plan): ConceptId[] => [...new Set(plan.sessions.flatMap((s) => (s.concept ? [s.concept] : [])))];
const targetOf = (plan: Plan): ConceptId => plan.sessions.find((s) => s.isMasteryCheck)?.concept ?? 'equivalence';

/** The plan screen for the plan on the phone. */
export function planView(state: DemoState): PlanView | null {
  const plan = planById(state, state.phone.planId);
  if (!plan) return null;
  const student = studentById(state, plan.studentIds[0])!;
  const { done } = state.phone;
  const next = plan.sessions.findIndex((_, i) => !done.includes(i));
  const check = plan.sessions.findIndex((s) => s.isMasteryCheck);
  return {
    name: student.short,
    heading: `Learning pathway · ${plan.day.toLowerCase()}`,
    topic: conceptById(targetOf(plan)).label,
    objectives: conceptsOf(plan).slice(-2).map((c) => conceptById(c).label),
    items: plan.sessions.map((s) => ({ title: s.title, when: `${plan.day} ${s.time}`, mins: s.minutes })),
    done,
    next: next < 0 ? null : next,
    canSkip: plan.sessions.some((_, i) => i < check && !done.includes(i)),
  };
}

/** Lock-screen notification copy for the plan on the phone. */
export function notificationCopy(state: DemoState): { title: string; body: string } | null {
  const plan = planById(state, state.phone.planId);
  if (!plan) return null;
  const labels = conceptsOf(plan).slice(-2).map((c) => conceptById(c).label.toLowerCase());
  return {
    title: state.phone.updated ? 'Your plan was updated' : 'Your personalized plan is ready',
    body: `${plan.sessions.length} short sessions ${plan.day.toLowerCase()} to strengthen ${labels.join(' & ')}.`,
  };
}

/** The progress screen after a mastery check: the finished plan's target concept, before → now. */
export function progressView(state: DemoState): ProgressView | null {
  const plan = planById(state, state.phone.lastDone ?? state.phone.planId);
  if (!plan) return null;
  const student = studentById(state, plan.studentIds[0])!;
  const target = targetOf(plan);
  const practice = student.evidence.filter((e) => e.kind === 'practice');
  const correct = practice.filter((e) => e.text.includes('correct')).length;
  return {
    concept: conceptById(target).label,
    from: Math.round((state.phone.before?.[target] ?? student.mastery[target]) * 100),
    to: Math.round(student.mastery[target] * 100),
    accuracy: practice.length ? Math.round((correct / practice.length) * 100) : 0,
    items: plan.sessions.map((s) => ({ title: s.title, when: s.time })),
    done: plan.sessions.length,
    remaining: state.phone.updated ? 'Next steps are ready for tomorrow' : null,
    backLabel: state.phone.updated ? 'See tomorrow’s plan' : 'Back to plan',
  };
}
```

- [ ] **Step 4: Replace `src/student/screens/LockScreen.tsx`**

```tsx
import { Mark } from '../../teacher/parts';
import { TouchDot } from './Chrome';
import { egg } from '../../ui/theme';

/** Ink wallpaper with a still accent glow rising from the bottom edge. */
const WALLPAPER = `radial-gradient(130% 55% at 50% 108%, ${egg('accent', 0.55)} 0%, ${egg('accent', 0.14)} 50%, ${egg('accent', 0)} 75%), ${egg('ink')}`;
const CARD = 'absolute left-3 right-3 rounded-3xl border border-egg-line bg-egg-card p-4';
const SCRIPTED_MESSAGE = { title: 'Your personalized plan is ready', body: '4 short sessions today to strengthen implication & logical equivalence.' };

/** `onTap` (live mode) makes the notification a real button. */
export function LockScreen({ t, notification, tapAt, clock, message = SCRIPTED_MESSAGE, onTap }: {
  t: number; notification: number; tapAt?: number; clock: string; message?: { title: string; body: string }; onTap?: () => void;
}) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  const style = { top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})` };
  const content = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-egg-mute">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-egg-ink"><Mark size={14} className="text-egg-accent" /></span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Beyond Tutor</span>
        <span className="ml-auto">now</span>
      </div>
      <div className="mt-2 text-[17px] font-semibold text-egg-ink">{message.title}</div>
      <div className="text-[15px] leading-snug text-egg-mute">{message.body}</div>
    </>
  );
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: WALLPAPER }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-egg-card/70">Saturday, 31 October</div>
      <div className="font-serif text-[84px] leading-none text-egg-card">{clock}</div>
      {notification > 0 && (onTap ? (
        <button type="button" onClick={onTap} className={`${CARD} text-left`} style={style}>{content}</button>
      ) : (
        <div className={CARD} style={style}>{content}</div>
      ))}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
```

- [ ] **Step 5: Replace `src/student/screens/PlanScreen.tsx`**

```tsx
import { fade } from '../../engine/anim';
import { PATHWAY_INITIAL, PATHWAY_UPDATED, PLAN_OBJECTIVES, PLAN_OBJECTIVES_UPDATED } from '../../scenario/orchestration';
import { Eyebrow, Mark } from '../../teacher/parts';
import type { PlanView } from '../liveView';
import { StepMarker } from './Chrome';

/** Greeting derived from the displayed clock (HH:MM): morning before 12:00, afternoon before 18:00, evening after. */
export const greetingFor = (clock: string): string => {
  const h = Number(clock.split(':')[0]);
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

const ROW = 'relative flex items-center gap-3 border-b border-egg-line py-3.5 pl-3';

/** Scripted (Sc7/Sc8) by default; `live` + `onOpen` turn it into the booth phone's tappable plan. */
export function PlanScreen({ local, variant, clock = '17:00', live, onOpen, onSkip }: {
  local: number; variant: 'initial' | 'updated'; clock?: string; live?: PlanView; onOpen?: (i: number) => void; onSkip?: () => void;
}) {
  const items = live?.items ?? (variant === 'initial' ? PATHWAY_INITIAL : PATHWAY_UPDATED);
  const objectives = live?.objectives ?? (variant === 'initial' ? PLAN_OBJECTIVES : PLAN_OBJECTIVES_UPDATED);
  const next = live ? live.next : variant === 'initial' ? 2 : 0;
  const isDone = (i: number) => (live ? live.done.includes(i) : variant === 'initial' && i < 2);
  const heading = live?.heading ?? (variant === 'initial' ? 'Learning pathway · today' : 'Next steps · tomorrow');
  return (
    <div className={`absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink${live ? ' overflow-y-auto pb-8' : ''}`}>
      <div className="text-[15px] text-egg-mute">{greetingFor(clock)},</div>
      <div className="text-[26px] font-bold">{live?.name ?? 'Minh Anh'}</div>
      {variant === 'updated' && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-egg-tint px-4 py-2 text-[14px] font-semibold" style={{ opacity: fade(local, 100) }}>
          <Mark size={14} />
          Plan updated · based on your progress
        </div>
      )}
      <div className="mt-4 rounded-3xl bg-egg-ink p-5 text-egg-card">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-card/60">Your personalized learning plan</div>
        <div className="mt-2 font-serif text-[34px] leading-none">Discrete Mathematics</div>
        <div className="mt-1.5 text-[15px] text-egg-card/75">{`Topic: ${live?.topic ?? 'Logical Equivalence'}`}</div>
        <div className="mt-3 flex gap-2">
          {objectives.map((o) => <span key={o} className="rounded-full border border-egg-card/30 px-3 py-1 text-[12px] font-semibold">{o}</span>)}
        </div>
      </div>
      <div className="mt-6"><Eyebrow>{heading}</Eyebrow></div>
      <div className="mt-2 border-t border-egg-line">
        {items.map((it, i) => {
          const o = fade(local, 300 + i * 250);
          const style = { opacity: o, transform: `translateY(${(1 - o) * 12}px)` };
          const row = (
            <>
              {i === next && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-egg-accent" />}
              <StepMarker n={i + 1} done={isDone(i)} />
              <div>
                <div className="text-[16px] font-semibold">{it.title}</div>
                <div className="text-[13px] text-egg-mute">{it.when} · {it.mins} min</div>
              </div>
              {i === next && <span className="ml-auto whitespace-nowrap rounded-full bg-egg-accent px-2.5 py-0.5 text-[12px] font-semibold text-egg-ink">Up next</span>}
            </>
          );
          return onOpen && !isDone(i) ? (
            <button key={i} type="button" onClick={() => onOpen(i)} className={`${ROW} w-full text-left`} style={style}>{row}</button>
          ) : (
            <div key={i} className={ROW} style={style}>{row}</div>
          );
        })}
      </div>
      {live?.canSkip && onSkip && (
        <button type="button" onClick={onSkip} className="mt-4 text-[13.5px] font-semibold text-egg-mute underline underline-offset-4">
          Skip to tonight
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Replace `src/student/screens/ProgressScreen.tsx`**

```tsx
import { countUp } from '../../engine/anim';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { PROGRESS } from '../../scenario/practice';
import { Eyebrow } from '../../teacher/parts';
import type { ProgressView } from '../liveView';
import { StepMarker } from './Chrome';

const R = 64;
const CIRC = 2 * Math.PI * R;

/** The scripted Sc7 figures, in the live view's shape. */
const SCRIPTED: ProgressView = {
  concept: PROGRESS.concept, from: PROGRESS.from, to: PROGRESS.to, accuracy: PROGRESS.accuracyToday,
  items: PATHWAY_INITIAL.map((it) => ({ title: it.title, when: it.when.replace('Today ', '') })),
  done: PROGRESS.done, remaining: 'Remaining objective: Logical equivalence', backLabel: '',
};

export function ProgressScreen({ local, live, onBack }: { local: number; live?: ProgressView; onBack?: () => void }) {
  const p = live ?? SCRIPTED;
  const m = countUp(p.from, p.to, local, 300, 1500);
  return (
    <div className={`absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink${live ? ' overflow-y-auto pb-8' : ''}`}>
      <div className="font-serif text-[40px] leading-none">Your progress</div>
      <div className="mt-5 flex items-center gap-4 rounded-3xl border border-egg-line bg-egg-card p-5">
        <svg width={128} height={128} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} className="stroke-egg-line" strokeWidth={14} fill="none" />
          <circle cx={75} cy={75} r={R} className="stroke-egg-accent" strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(m / 100) * CIRC} ${CIRC}`} transform="rotate(-90 75 75)" />
          <text x={75} y={88} textAnchor="middle" fontSize={40} className="fill-egg-ink font-serif">{m}%</text>
        </svg>
        <div>
          <Eyebrow>{p.concept} mastery</Eyebrow>
          <div className="mt-1 text-[15px] text-egg-mute">up from {p.from}% this week</div>
          <div className="mt-2 whitespace-nowrap text-[15px] font-semibold">Accuracy today {p.accuracy}%</div>
        </div>
      </div>
      <div className="mt-6"><Eyebrow>Today · {p.done} of {p.items.length} activities complete</Eyebrow></div>
      <div className="mt-2 border-t border-egg-line">
        {p.items.map((it, i) => {
          const done = i < p.done;
          return (
            <div key={i} className="flex items-center gap-3 border-b border-egg-line py-3">
              <StepMarker n={i + 1} done={done} size={28} />
              <span className="text-[15px]">{it.title}</span>
              {!done && <span className="ml-auto text-[13px] text-egg-mute">{it.when}</span>}
            </div>
          );
        })}
      </div>
      {p.remaining && <div className="mt-4 rounded-2xl bg-egg-tint px-4 py-3 text-[14px] font-semibold">{p.remaining}</div>}
      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">
          {p.backLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Export the option styles and write `src/student/screens/LivePractice.tsx`**

In `src/student/screens/PracticeScreen.tsx`, change `const OPTION_CLS = {` to `export const OPTION_CLS = {`.

Create `src/student/screens/LivePractice.tsx`:

```tsx
import { useState } from 'react';
import { currentItems, planById } from '../../live/reducer';
import type { DemoState } from '../../live/types';
import { conceptById } from '../../scenario/knowledgeGraph';
import { Mark } from '../../teacher/parts';
import { OPTION_CLS } from './PracticeScreen';

/** Live practice: real taps on canned items, the chosen option's hint, and a worked rewrite after a correct answer. */
export function LivePractice({ state, onAnswer, onNext }: { state: DemoState; onAnswer(option: number): void; onNext(): void }) {
  const [steps, setSteps] = useState(0);
  const ph = state.phone;
  const plan = planById(state, ph.planId);
  const items = currentItems(state);
  const item = items[ph.item];
  if (!plan || ph.session === null || !item) return null;
  const session = plan.sessions[ph.session];
  const right = ph.result === 'right';
  const guided = right ? item.guided : undefined;
  const last = ph.item + 1 >= items.length;
  return (
    <div className="absolute inset-0 overflow-y-auto bg-egg-bg px-5 pb-8 pt-14 font-sans text-egg-ink">
      <div className="flex items-center justify-between text-[13px] text-egg-mute">
        <span>{`${session.isMasteryCheck ? 'Mastery check' : 'Guided practice'} · ${conceptById(item.concept).label}`}</span>
        <span>{`${ph.item + 1} / ${items.length}`}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-egg-line">
        <div className="h-full rounded-full bg-egg-accent" style={{ width: `${((ph.item + (right ? 1 : 0)) / items.length) * 100}%` }} />
      </div>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-egg-ink [text-wrap:balance]">{item.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {item.options.map((o, i) => {
          const look = right && i === item.correct ? 'right' : ph.result === 'wrong' && i === ph.lastOption ? 'wrong' : 'idle';
          return (
            <button
              key={o}
              type="button"
              disabled={right}
              onClick={() => onAnswer(i)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-[13px] text-left font-mono text-[18px] text-egg-ink ${OPTION_CLS[look]}`}
            >
              {o}
              {look === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {look === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </button>
          );
        })}
      </div>
      {ph.result === 'wrong' && ph.lastOption !== null && (
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{item.hints[ph.lastOption]}</div>
        </div>
      )}
      {guided && (
        <div className="mt-4">
          <div className="rounded-2xl border border-egg-line bg-egg-card p-4 font-mono text-[18px]">{guided.start}</div>
          {guided.steps.slice(0, steps).map((s, i) => (
            <div key={s.expr} className="mt-3 rounded-2xl border border-egg-line bg-egg-card p-4">
              <div className="font-mono text-[12px] text-egg-mute">{`Step ${i + 1} · ${s.why}`}</div>
              <div className="mt-1 font-mono text-[18px]">{`≡ ${s.expr}`}</div>
            </div>
          ))}
          {steps < guided.steps.length ? (
            <button type="button" onClick={() => setSteps((n) => n + 1)} className="mt-3 w-full rounded-full border border-egg-ink py-2.5 text-[14px] font-semibold">
              Show the next step
            </button>
          ) : (
            <div className="mt-3 rounded-2xl bg-egg-sage-tint p-3 text-center text-[15px] font-semibold text-egg-sage">
              {`Nice work · ${guided.steps.length} / ${guided.steps.length} steps`}
            </div>
          )}
        </div>
      )}
      {right && (
        <button type="button" onClick={onNext} className="mt-5 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">
          {last ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Next'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Write `src/student/LivePhone.tsx` and the `?live` entry**

`src/student/LivePhone.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Stage } from '../engine/Stage';
import { useNow } from '../engine/useNow';
import { fmt } from '../live/clock';
import { useServerSource, type DemoSource } from '../live/source';
import { notificationCopy, planView, progressView } from './liveView';
import { StatusBar } from './screens/Chrome';
import { LivePractice } from './screens/LivePractice';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';

export function LivePhone() {
  return <LivePhoneView source={useServerSource()} />;
}

/** The booth phone: PhoneState from the server, every tap posted back. */
export function LivePhoneView({ source }: { source: DemoSource }) {
  const [t0] = useState(() => Date.now());
  const now = useNow() - t0;
  const firstSeen = useRef(new Map<string, number>());
  const { state, post } = source;
  if (!state) {
    return (
      <Stage width={390} height={844} background="#F2EDE4">
        <div className="flex h-full items-center justify-center px-8 text-center font-sans text-[15px] text-egg-mute">Connecting to the booth…</div>
      </Stage>
    );
  }
  const ph = state.phone;
  // Screen entrances animate from when this screen first appeared.
  const key = `${state.epoch}:${ph.screen}:${ph.planId}:${ph.session}:${ph.item}`;
  if (!firstSeen.current.has(key)) firstSeen.current.set(key, now);
  const local = now - firstSeen.current.get(key)!;
  const clock = fmt(state.clock);
  const plan = planView(state);
  const progress = progressView(state);
  const message = notificationCopy(state);
  const send = (path: string, body?: unknown) => void post(path, body);
  return (
    <Stage width={390} height={844} background="#F2EDE4">
      {ph.screen === 'lock' && (
        <LockScreen t={local} clock={clock} notification={message ? Math.min(1, local / 500) : 0} message={message ?? undefined} onTap={message ? () => send('phone/plan') : undefined} />
      )}
      {ph.screen === 'plan' && plan && (
        <PlanScreen local={local} variant={ph.updated ? 'updated' : 'initial'} clock={clock} live={plan} onOpen={(i) => send('phone/open', { sessionIndex: i })} onSkip={() => send('phone/skip')} />
      )}
      {ph.screen === 'practice' && (
        <LivePractice key={`${ph.session}:${ph.item}`} state={state} onAnswer={(o) => send('phone/answer', { option: o })} onNext={() => send('phone/next')} />
      )}
      {ph.screen === 'progress' && progress && <ProgressScreen local={local} live={progress} onBack={() => send('phone/plan')} />}
      {ph.screen !== 'lock' && <StatusBar clock={clock} />}
    </Stage>
  );
}
```

Replace `src/student/main.tsx` with:

```tsx
import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { themeFromSearch, ThemeScope } from '../ui/theme';
import { LivePhone } from './LivePhone';
import { StudentApp } from './StudentApp';

/** `?live` → the booth phone (server state, real taps); otherwise the scripted, Director-synced phone. */
const live = new URLSearchParams(window.location.search).has('live');

createRoot(document.getElementById('root')!).render(
  live ? (
    <ThemeScope theme={themeFromSearch(window.location.search)}>
      <LivePhone />
    </ThemeScope>
  ) : (
    <PlaybackProvider app="student" fallbackScene={1}>
      <StudentApp />
    </PlaybackProvider>
  ),
);
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run src/student`
Expected: PASS — the new tests, the existing `screens.test.tsx` (scripted screens unchanged) and the palette guard (only egg hex values).

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Manual check with a phone**

Run: `npm run booth`. Open `http://<laptop-ip>:5173/student.html?live` on a phone on the same Wi-Fi (the server prints the URL). In the teacher window ask about Minh Anh and press **Approve & send**.
Expected: the notification lands on the phone; tapping it shows the plan; a wrong answer shows its hint; the teacher's Minh Anh panel meters move while answering; **Skip to tonight** then the mastery check ends on the progress screen, and the teacher conversation gets the 20:40 update.

- [ ] **Step 11: Commit**

```bash
git add src/student
git commit -m "feat(phone): live booth phone driven by server state and real taps"
```

---

### Task 17: Director booth panel, README, live smoke check and final verification

**Files:**
- Create: `src/controller/BoothPanel.tsx`, `server/live.smoke.ts`
- Modify: `src/controller/ControllerApp.tsx`, `src/controller/controller.test.tsx`, `package.json` (add `qrcode`), `README.md`

**Interfaces:**
- Consumes: `GET /api/info`, `POST /api/reset` (Task 11); `DemoSession`, `anthropicClient`, `evidenceIds`, `planProblems`.
- Produces: `BoothPanel()` in the Director; `npm run test:live`; README "Live booth demo" section.

- [ ] **Step 1: Install qrcode**

Run: `npm install qrcode@1.5.4 && npm install -D @types/qrcode`

- [ ] **Step 2: Write the failing test**

Append to `src/controller/controller.test.tsx` (keep its existing imports; add the two below at the top):

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { BoothPanel } from './BoothPanel';

describe('BoothPanel', () => {
  it('offers the live teacher, Reset demo and (once loaded) the phone QR code', () => {
    const out = renderToStaticMarkup(<BoothPanel />);
    expect(out).toContain('Live booth demo');
    expect(out).toContain('Open live teacher');
    expect(out).toContain('Reset demo');
  });
});
```

(If `describe`/`it`/`expect` or `renderToStaticMarkup` are already imported in that file, do not import them twice.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/controller/controller.test.tsx`
Expected: FAIL — cannot resolve `./BoothPanel`.

- [ ] **Step 4: Write `src/controller/BoothPanel.tsx` and add it to the Director**

```tsx
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type Info = { lanUrl: string | null; offline: boolean };

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink hover:border-dim';

/** Booth controls in the Director: open the live teacher, reset between visitors, and the phone's QR code. */
export function BoothPanel() {
  const [info, setInfo] = useState<Info | null | 'down'>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/info').then((r) => r.json() as Promise<Info>).then(setInfo).catch(() => setInfo('down'));
  }, []);
  useEffect(() => {
    if (info && info !== 'down' && info.lanUrl) void QRCode.toDataURL(info.lanUrl, { margin: 1, width: 220 }).then(setQr);
  }, [info]);
  const reset = () => void fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  return (
    <section className="flex flex-wrap items-start gap-6 rounded-xl border border-line bg-surface p-5">
      <div>
        <div className="text-[18px] font-semibold">Live booth demo</div>
        <div className="mt-1 text-[14px] text-dim">
          {info === 'down' ? 'Booth server not running: start it with npm run booth' : info === null ? 'Checking the booth server…' : info.offline ? 'Agents offline: canned answers' : 'Agents online'}
        </div>
        <div className="mt-3 flex gap-3">
          <button className={btn} onClick={() => window.open('/teacher.html', 'live-teacher')}>Open live teacher</button>
          <button className={btn} onClick={reset}>Reset demo</button>
        </div>
        {info && info !== 'down' && info.lanUrl && <div className="mt-3 font-mono text-[13px] text-dim">{info.lanUrl}</div>}
      </div>
      {qr && <img src={qr} alt="QR code for the live phone" width={220} height={220} className="rounded-lg bg-[#FFFDF8] p-2" />}
    </section>
  );
}
```

In `src/controller/ControllerApp.tsx`, add `import { BoothPanel } from './BoothPanel';` and render `<BoothPanel />` directly after the `<div className="flex flex-wrap gap-3">…</div>` block that holds the `STANDALONE` copy-URL buttons (just before the "Keys:" help line).

- [ ] **Step 5: Write `server/live.smoke.ts`**

```ts
import './env';
import { planProblems } from '../src/live/plans';
import { anthropicClient } from './agents/client';
import { evidenceIds } from './agents/sas';
import { DemoSession } from './session';

/** One real question against the API: the answer must come from the agents, cite real evidence, and any plan must pass the policy. */
const fail = (why: string): never => {
  console.error(`FAIL: ${why}`);
  process.exit(1);
};

const client = anthropicClient() ?? fail('no client: set ANTHROPIC_API_KEY in .env.local and unset BEYOND_OFFLINE');
const session = new DemoSession(client);
const started = Date.now();
const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
if (!r.ok) fail(r.error);
else await r.done;

const conv = session.state.conversations[0];
const reply = conv.msgs[1];
if (!reply || reply.role !== 'assistant') fail('no answer');
else {
  if (reply.source !== 'agents') fail(`answered "${reply.source}" (see the [beyond] warning above for why)`);
  const known = evidenceIds(session.state);
  const cites = reply.blocks.flatMap((b) => b.cites);
  if (cites.length === 0) fail('the answer cites no evidence');
  const unknown = cites.filter((id) => !known.has(id));
  if (unknown.length) fail(`unknown evidence ids: ${unknown.join(', ')}`);
  const plan = session.state.plans[0];
  if (plan) {
    const problems = planProblems(plan, session.state);
    if (problems.length) fail(`plan breaks the policy: ${problems.join(' ')}`);
  }
  console.log(`PASS in ${((Date.now() - started) / 1000).toFixed(1)} s · "${conv.title}" · ${cites.length} citations · plan: ${plan ? `${plan.kind}, ${plan.sessions.length} sessions` : 'none'}`);
  for (const b of reply.blocks) console.log(`  ${b.kind === 'li' ? '•' : ' '} ${b.text}  [${b.cites.join(', ')}]`);
}
```

- [ ] **Step 6: Document the booth in `README.md`**

Insert this section after the "## Run" section:

````markdown
## Live booth demo

A live version of the demo for visitors to use: two real Claude agents answer the teacher from the fictional class data, plans go to a real phone, and the phone's answers update the class live. Everything is still illustrative data about fictional students.

1. Copy `.env.local.example` to `.env.local` and set `ANTHROPIC_API_KEY` (the file is git-ignored). Without usable credentials, or with `BEYOND_OFFLINE=1`, the booth runs on canned answers and every answer carries an "Offline answer" tag.
2. `npm run booth` starts Vite on the LAN and the booth server (port 8787). It prints the phone URL.
3. Open the Director (`http://localhost:5173/controller.html`): **Open live teacher**, and let visitors scan the QR code with a phone on the same Wi-Fi (or open `student.html?live` in a narrow window).
4. Press **Reset demo** (Director or teacher header) between visitors.

Settings: `BEYOND_MODEL` (default `claude-sonnet-5-5`), `BEYOND_EFFORT` (`low` · `medium` · `high`, default `medium`), `BEYOND_PORT`.

Check the API path end to end with `npm run test:live` (needs the key; costs one real question).

### Booth checklist

- [ ] `npm run booth` prints `agents online` and a phone URL.
- [ ] Phone joins from the QR code and shows the lock screen with the story clock.
- [ ] Ask "Why did Minh Anh's quiz score drop?": thinking lines name both agents, the answer cites evidence (chips open the evidence), the panel shows a plan.
- [ ] Edit a session time, **Approve & send**: the notification lands on the phone.
- [ ] Phone: a wrong answer shows its hint; the teacher's meters move as answers arrive; **Skip to tonight**, finish the mastery check; the teacher gets the 20:40 update and the phone shows tomorrow's plan.
- [ ] Ask about the class and about who needs you personally: approve the class activity and the check-ins (nothing reaches the phone).
- [ ] **Export** shows "Not part of this demo".
- [ ] Stop the server, set `BEYOND_OFFLINE=1`, restart: the Minh Anh story still works with "Offline answer" tags.
- [ ] **Reset demo** returns both screens to the start.
````

- [ ] **Step 7: Full verification**

Run: `npm test`
Expected: PASS — all suites, including every pre-existing scripted test.

Run: `npm run build`
Expected: `tsc --noEmit` clean and a Vite build with the teacher, student and controller pages.

Run: `npm run contact-sheet -- --verify`
Expected: renders every key frame and reports all frames deterministic (the scripted video is unchanged).

Run (with a key in `.env.local`): `npm run test:live`
Expected: `PASS in … s · "…" · N citations · plan: pathway, … sessions` followed by the answer blocks.

Then walk the README booth checklist on the laptop and a real phone, and note anything that fails.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/controller server/live.smoke.ts README.md
git commit -m "feat(booth): Director booth panel with phone QR, live smoke check and booth README"
```
