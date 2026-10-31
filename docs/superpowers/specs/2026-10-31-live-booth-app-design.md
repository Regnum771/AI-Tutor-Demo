# Beyond AI Tutoring — Live Booth App: Design Spec

**Date:** 2026-10-31
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `2026-10-31-product-first-cut-design.md` (teacher frame model, live draft) and `2026-10-31-phone-restyle-design.md` (eggshell phone screens). The scripted video mode those specs define is unchanged.

## 1. Goal

Turn the scripted demo into a **live demo with real AI** that judges and investors use themselves at a booth. The class stays fictional (the same 55 students, the same Minh Anh story), but:

- the teacher can type any question, and two real agents answer it from the class data, citing evidence;
- the agents can draft an intervention plan for any student, which the teacher edits and approves;
- **Approve & send** delivers the plan to a real phone, where the visitor works through canned practice;
- the phone's answers update that student's mastery live, and the agents adapt (the Sc8 moment, made real).

### Key decisions

| Decision | Choice |
|---|---|
| Purpose | Booth demo with real AI over fictional data; no real student data, no auth |
| Hosting | Runs on the presenter's laptop; a real phone joins over the same Wi-Fi; one session at a time |
| Language | English |
| Agent scope | Free Q&A about any student or the class; plans for any student |
| Agents | Two real agents: Student Analysis Agent (SAS) with read-only data tools, Teaching Assistance Agent (TAS) that drafts plans |
| Phone | Live delivery and live results; practice items, hints and grading are canned |
| Stack | Vite (existing) plus a small local Node server in the same repo; SSE for server → client sync |
| Model | `claude-sonnet-5-5` by default, overridable with `BEYOND_MODEL` |
| Video mode | `teacher.html?scene=N`, `student.html?scene=N`, the Director and the contact sheet are untouched |

## 2. Architecture

### 2.1 Processes

`npm run booth` starts both, together:

- **Vite** with `--host`, so the phone reaches it at `http://<laptop-LAN-ip>:5173`. Vite proxies `/api` to the server.
- **`server/`**: a small Hono server run with `tsx`.
  - Reads `ANTHROPIC_API_KEY` (and optionally `BEYOND_MODEL`) from `.env.local`, which is git-ignored.
  - Holds one in-memory **demo session**: class state, conversations, plans, phone state and the story clock.
  - Reports its LAN address so the Director can show the phone QR code.

### 2.2 Shared state model (`src/live/state.ts`)

Shared by server and client (types plus pure reducers).

- **`ClassState`**: 55 students. Each has:
  - mastery per concept (the 12 `ConceptId`s)
  - status (`onTrack`, `support`, `highRisk`)
  - an evidence list: quiz items, activity log, attendance, messages and TA notes; every entry has a stable id (e.g. `s17-quiz2-q4`)
- **`Plan`**: id, kind, sessions, rationale and status: `proposed`, `approved`, `sent`, `done`, `autoApproved` or `dismissed`. Three kinds:
  - `pathway`: one student; sessions are (time, title, concept, minutes, `isMasteryCheck`). The only kind delivered to the phone.
  - `classActivity`: a group of students (ids) and one or more class sessions, e.g. a Thursday tutorial on a shared gap. Approving it records it as scheduled.
  - `checkIns`: 15-minute meetings with named students (time per student), e.g. for escalations. Approving it records the invitations as sent.
- **`PhoneState`**: the student the phone represents, the delivered plan, the current session and item, and the answers so far.
- **`StoryClock`**: story time, starting at 15:00 on the demo day. It moves only on demo events, never with wall time.
- **`DemoState`** = all of the above plus the conversation log. `reset()` returns the seed.

### 2.3 Data (`src/scenario/roster.ts`)

- A seeded, deterministic generator expands today's `STUDENTS` into full fictional profiles. The profiles must reproduce the existing Classroom figures (55 students; 12 need support, 5 of them high risk; average mastery 0.68). The "43 running interventions" KPI stays a constant in live mode.
- Minh Anh keeps her hand-written data: `MASTERY_INITIAL`, `ERRORS_INITIAL` and her Quiz 2 items, so the live story matches the video.
- About 8 other students get hand-written quirks so the Q&A has interesting answers, for example: quietly disengaging (attends, but has stopped submitting); strong on quizzes but silent in discussion; a TA note about a family situation; a sudden improvement after office hours.
- Class-level evidence (Quiz 2 average, Q4 converse count, tutorial attendance, De Morgan gap) is computed from the student profiles, so class and student figures always agree. The live figures may differ from the video's scripted copy (for example "58% wrong on Q4").

### 2.4 Sync and API

The server pushes over **SSE** (`GET /api/events`): on connect, and after every change, it sends the full `DemoState` snapshot (`event: state`). The state is small enough to resend whole on a LAN. Clients work out what is new by remembering which messages, steps and plans they have already seen (and when), so a refresh simply starts from the snapshot.

Commands are plain POSTs (plus `GET /api/info`, which returns the phone's LAN URL for the QR code):

| Endpoint | Body | Effect |
|---|---|---|
| `POST /api/ask` | `{ text, conversationId? }` | Returns `{ conversationId }` at once, then runs SAS, then TAS if needed (or a TAS revision when a plan is open), in the background |
| `POST /api/plan/edit` | `{ planId, sessionIndex, time? , remove? }` | Inline edit of a proposed plan |
| `POST /api/plan/approve` | `{ planId }` | Approves the plan; a `pathway` is also sent to the phone |
| `POST /api/plan/dismiss` | `{ planId }` | **Not now**: marks the plan `dismissed` |
| `POST /api/phone/plan` | `{}` | Tapping the notification (or **Back to plan**) shows the plan screen |
| `POST /api/phone/open` | `{ sessionIndex }` | Starts a session on the phone (advances the story clock to its time) |
| `POST /api/phone/answer` | `{ option }` | Grades the current canned item and updates mastery and evidence |
| `POST /api/phone/next` | `{}` | After a correct answer, moves to the next item, or finishes the session |
| `POST /api/phone/skip` | `{}` | "Skip to tonight": marks earlier sessions done with seeded results |
| `POST /api/reset` | `{}` | Returns everything to the seed |

`BroadcastChannel` remains only for the scripted video mode.

### 2.5 Client changes

- **`LiveTeacher`** stops generating canned events. It turns each state snapshot into the same `TeacherEvent` timeline (stamped with when each item was first seen), so `teacherFrame` and `TeacherScreen` render everything. New event fields carry a live assistant message, a live panel and a conversation title. Components that need live data (`Classroom`, the live panels, the plan card) read it from a React context that is empty in scripted mode.
- **`Blocks`** gains evidence chips: a citation id rendered as a small chip; clicking it shows that evidence entry in the panel.
- **`Classroom`** tiles and KPIs read live `ClassState`; scripted mode keeps passing the constants.
- **The plan card** in `ContextPanel` renders any `Plan`: an editable time per session, a remove control while `proposed`, the approve button (**Approve & send** for a pathway, **Approve plan** for a class activity, **Book all** for check-ins), **Not now**, and the `autoApproved · within your policy` label.
- **The header** shows the story clock in live mode.
- **The teacher window and the Director** each get a **Reset demo** button. The Director also shows the phone QR code.

### 2.6 Unlisted UI

Every visible element in live mode is one of three things, and none may look broken.

**Live (driven by `DemoState`):**

| Element | Live behaviour |
|---|---|
| Sidebar Classroom badge, Classroom KPIs, tiles, filters, student list and card | Computed from `ClassState`; update as phone answers arrive |
| "Needs your attention today" figures | From state: count of score drops, need-support count, escalations |
| Sidebar **Today** list | The session's conversation history. Each `ask` that starts a conversation adds an entry titled from the SAS focus (e.g. "Minh Anh · implication", "Class gap · equivalence"); clicking reopens it. Starts empty after reset |
| **New conversation**, Chat / Classroom nav, panel **Close**, "View context" | As today |
| Phone copy: student name, greeting, concept labels, plan heading | From the delivered plan's student and concepts |

**Routed to the agents:**

| Element | Live behaviour |
|---|---|
| Attention rows, **Ask about the class**, **Ask about [student]** | Send their prompt through `/api/ask` |
| Follow-up chips under an answer | `report` returns 2–3 `followUps`; they become the chips |
| **Not now** on a plan | Sets the plan to `dismissed`; the assistant acknowledges in one line (no model call) |
| Class gap and escalation panels | Show live data; their proposals are `classActivity` and `checkIns` plans from TAS |

**Decorative (visible for realism, inert):**

| Element | Live behaviour |
|---|---|
| **Export** and any other clickable-looking control without a live action | Shows a shared "Not part of this demo" toast for 2 s |
| Sidebar **This week** items, source chips, teacher card, "from 8 sources" | Static, no hover affordance |
| "Saturday, 31 October" | Fixed story date, shown with the story clock |
| Five-question tracker | Hidden in live mode (a narration device for the video) |

Any control added later must fall into one of these three groups; the click-audit test (§6) enforces it.

## 3. Agents (`server/agents/`)

The Anthropic TypeScript SDK runs a manual tool-use loop for each agent, capped at 8 tool turns with a fixed `max_tokens`. The static system prompts and tool definitions use prompt caching (live class data only ever arrives in tool results, so the cached prefix never changes). Requests are non-streaming, with a 25 s timeout and one SDK retry, and opt into the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). `tool_choice` stays `auto` (forced tool choice is rejected on this model); each agent's prompt tells it which tool finishes its turn, and the loop nudges once if a turn ends without it.

### 3.1 Student Analysis Agent (SAS)

Runs first on every question.

- **Read-only tools** (each returns a JSON slice of `ClassState`):
  - `get_class_overview()`: KPIs, status counts and the concept heatmap by group
  - `find_students(filter)`: by status, concept below a threshold, name match, or a signal (e.g. missed submissions)
  - `get_student(id)`: mastery, status and a summary of recent signals
  - `get_evidence(student_id, kind?)`: evidence entries with ids
  - `compare_students(ids)`: mastery side by side
- **Finishes with `report`**:
  - `blocks`: paragraphs and bullets; every factual claim carries evidence ids
  - `focus`: `{ kind: 'student', id }`, `{ kind: 'class' }` or `{ kind: 'none' }`
  - `gaps`: concept ids
  - `needs_plan`: a yes/no flag
  - `followUps`: 2–3 short follow-up questions the teacher might ask next
  - `revise_plan`: true when the teacher is asking to change the plan that is open in this conversation
  - `title`: a 3–6 word conversation title
- The server rejects a `report` that cites ids not in `ClassState`, returns the error as the tool result, and allows one retry.

### 3.2 Teaching Assistance Agent (TAS)

Runs when SAS sets `needs_plan`, when the teacher explicitly asks for a plan, or (as a revision) when SAS sets `revise_plan`, or a plan is wanted and the open `proposed` plan is on the same subject.

- **Input**: the SAS diagnosis, the practice-bank catalogue (concepts that have canned items), the policy and the story clock.
- **Finishes with `propose_plan`**, choosing a kind (§2.2) and giving a rationale:
  - `pathway`: 2–4 sessions; the last is the mastery check
  - `classActivity`: the affected student ids and 1–2 class sessions
  - `checkIns`: up to 5 students, one 15-minute slot each
- **Server checks**:
  - every time falls after story "now"
  - every student id exists
  - `pathway` only: every concept is in the practice bank, the total is at most 45 minutes, and there are at most 4 sessions
- On a failed check, the error goes back as the tool result and TAS gets one retry. A second failure shows the teacher: "I couldn't draft a plan within your policy." No broken card appears.

### 3.3 Adapt

Triggered when the phone finishes the mastery check.

- The server has already updated mastery (§4.3). TAS runs an `adapt` call with the before and after mastery and the plan's outcome.
- It writes the unprompted assistant message (e.g. "Minh Anh passed tonight's mastery check: logical equivalence 0.35 → 0.78…").
- If a gap remains and a follow-up fits the policy, it calls `propose_plan` with kind `pathway`. The plan is stored as `autoApproved` and delivered to the phone.
- **Policy constants**: follow-ups have at most 3 sessions and use practice-bank concepts only. Anything larger is created as `proposed` and waits for the teacher.

### 3.4 What the teacher sees

- Each tool call streams as a thinking line in the existing style, labelled with its agent. For example: "Student Analysis Agent · reading Minh Anh's Quiz 2 items", "Student Analysis Agent · comparing the class on implication", "Teaching Assistance Agent · drafting a 4-session plan". Thinking-line copy comes from a server-side map from tool name to template, not from the model.
- The answer reveals block by block as `report` completes, using the existing block reveal.
- The panel opens to the SAS focus: the student's twin (mastery bars from `ClassState`), the class gap view, or the plan card when TAS produced one.

## 4. Phone (`student.html?live`)

### 4.1 Joining

- The Director shows a QR code for `http://<LAN-ip>:5173/student.html?live`. As a backup, the same URL opens in a narrow window on the laptop.
- No login. The phone always plays the student the most recently sent plan belongs to.

### 4.2 Flow

The existing eggshell screens (`LockScreen`, `PlanScreen`, `PracticeScreen`, `ProgressScreen`) are driven by `PhoneState` and real taps instead of the scene clock.

1. **Idle lock screen**, showing the story clock.
2. On approve, the **notification** appears; tapping it opens the **plan screen** with the approved sessions.
3. Tapping the next session (`/api/phone/open`) opens the **practice screen** with that concept's canned items.
   - Multiple-choice items, 2–3 per session.
   - A wrong option shows that option's own hint.
   - One item per concept has a guided step with fading support.
   - The last session is the **mastery check**.
4. Each answer goes to `/api/phone/answer`. The server grades it, appends a quiz-item evidence entry, updates mastery (§4.3) and pushes `classUpdate`, so the teacher's twin panel and Classroom tile move while the visitor answers.
5. Finishing the mastery check:
   - moves the story clock to 20:40
   - shows the **progress screen** (mastery before → after)
   - starts adapt (§3.3); the phone then receives the follow-up if one was auto-approved

A small **Skip to tonight** link on the plan screen marks the earlier sessions done with seeded results, so a booth visitor can go straight to the mastery check.

### 4.3 Mastery update rule

A deterministic rule, unit-tested:

- A correct first-try answer moves the item's concept 30% of the way toward 0.9.
- A correct answer after a hint moves it 15% of the way.
- A wrong answer leaves it unchanged.

Status is recomputed from mastery with the same thresholds the roster uses, and the Classroom KPIs are recomputed from status.

### 4.4 Practice bank (`src/scenario/practiceBank.ts`)

- Canned items for all 12 concepts, 3–4 items each (about 40 in total), in English. Each item has options, a hint for each wrong option, and an optional guided step.
- Minh Anh's existing implication items, including the converse mistake from the video, are reused unchanged.
- The catalogue (concept → item ids) is what TAS sees.

## 5. Failure handling

| Failure | Behaviour |
|---|---|
| No credentials, network down, API error, refusal, a request over 25 s (after one retry), or `BEYOND_OFFLINE=1` | Canned mode for that question: today's `routePrompt` answers and topic panels, otherwise the generic answer. The message carries a small "offline answer" tag. The whole Minh Anh story works offline |
| Malformed or invalid `report` | One retry, then canned fallback |
| `propose_plan` fails its checks twice | "I couldn't draft a plan within your policy." |
| Phone or teacher refresh, or SSE drop | Auto-reconnect; the server resends the full snapshot, so both land where they were |
| Concurrent `ask` while an agent is running | Rejected with 409; the composer stays disabled while busy (as today) |
| Reset during an agent run | The run is aborted (`AbortController`) and its output discarded |

## 6. Testing

- **Unit (Vitest)**:
  - the roster generator is deterministic and reproduces the Classroom figures
  - the plan checks (concepts, times, minutes, count)
  - the mastery update rule and status/KPI recomputation
  - the `DemoState` reducers for approve, edit, answer, skip, adapt and reset
  - state snapshot → `TeacherEvent` translation (including first-seen timing)
  - evidence-id validation of `report`
- **Agent tests with a fake Anthropic client**: scripted tool-call sequences check the following without the network:
  - the SAS → TAS hand-off
  - a failed plan check followed by a retry
  - a revision while a plan is open
  - canned fallback on error or timeout
  - adapt producing an auto-approved follow-up within the policy and a `proposed` one outside it
- **Click audit**: render `LiveTeacher` (both views, with a plan open) and each phone screen against a stub client, click every `button`, and assert each one either dispatches an action or shows the demo toast (§2.6).
- **Plan kinds**: approving a `classActivity` or `checkIns` plan changes its status and posts the confirmation, and never changes `PhoneState`.
- **Optional live smoke test** (`npm run test:live`, needs the key, excluded from `npm test`): asks "Why did Minh Anh's quiz score drop?" and checks that the report cites existing evidence ids and that the plan passes its checks.
- **Existing suite**: every scripted-video test and `contact-sheet --verify` passes unchanged.
- **Build**: `tsc --strict` covers `server/` and `src/live/`; `npm run build` passes.
- **Manual booth checklist** in the README:
  - `npm run booth` start-up
  - QR join from a phone
  - the full loop: ask → plan → edit → approve → phone practice → adapt
  - offline mode with the key removed
  - Reset demo

## 7. Out of scope

- Hosting, accounts and auth, real student data, and multiple concurrent sessions.
- A Vietnamese UI or replies in Vietnamese.
- AI-generated practice items, hints or grading.
- Any change to the scripted video cut, its timings or the contact sheet.
- Editing the teacher policy from the UI (the policy is constants).
