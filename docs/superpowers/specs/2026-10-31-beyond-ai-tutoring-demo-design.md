# Beyond AI Tutoring — Demo Video Surface Layer: Design Spec

**Date:** 2026-10-31
**Status:** Approved in brainstorming, pending written-spec review
**Spine:** the "BEYOND AI TUTORING" marketing video script (3:30, 12 scenes, 6 acts)

## 1. Goal

Build the on-screen interfaces needed to record a 3:30 product video. Everything is a **surface layer**: fictional, illustrative data on scripted, deterministic timelines. There is no real backend, AI or student data.

Two apps are recorded: a **teacher dashboard** (desktop) and a **student app** (phone). A **controller** window drives both through the 12 scenes. Stock footage provides the live-action shots, and the final cut is assembled in a video editor (DaVinci Resolve).

### Key decisions

| Decision | Choice |
|---|---|
| Narrative spine | Marketing script; borrow the "five teacher questions" (Sc1) and "data flows in, numbers tick" (Sc11) from the earlier storyline |
| Agents | Two agents, SAS (Student Analysis Agent) and TAS (Teaching Assistance Agent), shown as **highly interconnected**, never as two chatbots |
| Surfaces | Two apps joined by a controller |
| Student app runtime | Phone-size browser window on the laptop (no real phone in the recording pipeline) |
| Interaction | Scripted autoplay: fake cursor, auto-typed text, fixed timings |
| Sc10 simulation | Predictive comparison with projected mastery curves, tagged **"Simulated projection · illustrative"** inside the panel |
| Language | English UI; Vietnamese names; Vietnamese message snippets from **Zalo, WhatsApp and email**, with English extracted evidence |
| Build approach | One Vite multi-page project with three windows synced via BroadcastChannel |
| Live footage | Licensed stock footage; screens are replaced with clean recordings in post |

## 2. Architecture

**Stack:** Vite (multi-page), React, TypeScript (strict), Tailwind, Motion (Framer Motion). Hand-built SVG for the graph, charts and pipeline. No force layouts and no randomness.

```
aitutor_demo/
├─ dashboard.html · student.html · controller.html   ← 3 entry pages = 3 windows
└─ src/
   ├─ scenario/            single source of truth (fictional, illustrative)
   │   ├─ classroom.ts        55 students, KPIs, heatmap, portfolio, students A–E
   │   ├─ minhAnh.ts          profile + twin states: initial → updating → post
   │   ├─ knowledgeGraph.ts   ~12 logic concepts, prerequisite edges, fixed positions
   │   ├─ messages.ts         Zalo / WhatsApp / email snippets (VI) + extracted evidence (EN)
   │   ├─ agents.ts           4 SAS↔TAS exchanges, reassessment, joint decisions
   │   ├─ orchestration.ts    inputs, 6 operations, status pipeline, activities
   │   ├─ simulation.ts       pathway A vs B projected curves (flagged simulated)
   │   ├─ practice.ts         student questions, options, hints, guided steps
   │   └─ scenes.ts           12 scenes: id, title, duration, per-app timeline cues
   ├─ engine/
   │   ├─ sync.ts             BroadcastChannel protocol (see §2.2)
   │   ├─ useSceneClock.ts    elapsed-ms clock; all animation keyed off it
   │   └─ Stage.tsx           fixed canvas, scale-to-fit, ?scale=N render multiplier
   ├─ dashboard/scenes/    Sc01…Sc12 (Sc09 = "incoming evidence" companion view)
   ├─ student/screens/     LockScreen, Notification, Plan, Practice, Progress
   ├─ controller/          transport, scene list, toggles, status
   └─ ui/                  tokens, Card, FakeCursor, AgentNode, Conduit, GraphView, Particle
```

### 2.1 Canvases

- Dashboard: fixed **1920×1080** logical canvas, rendered at `?scale=2` (3840×2160) for recording.
- Student: fixed **390×844** logical canvas, rendered at `?scale=3` (1170×2532).
- Canvases scale to fit the window. No responsive layouts.

### 2.2 Sync protocol (BroadcastChannel `beyond-demo`)

Messages: `play {scene, startedAt}`, `pause {scene, t}`, `seek {scene, t}`, `reset`, `toggles {titles, footer, cursor, tc}`, `slate {at}`, and `heartbeat {app}`.

Both apps compute `t = now − startedAt` and render the state for `t`. Animations are pure functions of `t`, so play, seek and replay always give identical frames.

**Constraint:** all windows must run in the same browser profile on the same origin.

### 2.3 Standalone mode

Each app works without the controller:

- `?scene=9&t=6000` holds that frame.
- `&autoplay` plays the scene.
- With no params, the dashboard shows Sc3 at rest and the student app shows the lock screen.

## 3. Scene-by-scene

D = dashboard, P = student phone, F = stock footage. Durations total 210 s.

| # | Scene | Time | Window | On-screen sequence |
|---|---|---|---|---|
| 1 | Fragmented | 0:00–0:12 | F1, F2 → D | 8 overlapping app windows cascade in: LMS gradebook, Zalo, WhatsApp, Email, academic records, assessment system, attendance, learning materials. The fake cursor switches between them. The 5 teacher questions appear as unanswered "?" chips. Text: *Fragmented Data. Heterogeneous Information. Limited Learning Intelligence.* |
| 2 | Architecture | 0:12–0:25 | D | Windows dissolve into typed particle streams that enter the **Multimodal layer**, then split into the **Knowledge Graph**, the **Digital Twin** and the **Agentic layer** (SAS+TAS already linked). Logo *BEYOND AI TUTORING*, then the virtual camera zooms into the Command Center |
| 3 | Perceive | 0:25–0:40 | D | Command Center: 55-student grid, KPIs **55 / 12 need support / 5 high risk**, topic heatmap. An ingestion side panel shows raw items converting to evidence chips (Zalo VI message → *"confused why p→q ≠ q→p"*, plus quiz and activity records). Minh Anh's tile pulses and her profile card shows 42%, 2 incomplete activities, repeated conceptual errors, weak prerequisite mastery. The cursor clicks her |
| 4 | Represent | 0:40–0:55 | D | Knowledge graph: her mastery fills the nodes, error evidence links to *Implication*, and the prerequisite path highlights. Pan to the **Digital Twin**: history timeline, current state, mastery bars, gaps, activity pattern, past intervention outcomes. Evidence pulses update it, and a bridge line connects the graph and the twin |
| 5 | Reason | 0:55–1:10 | D | Dual-Agent interface: the twin+KG hub in the centre, SAS (blue) on the left, TAS (green) on the right, with two-way conduits always animated. SAS retrieval lines touch twin fields, and the SAS diagnosis card forms. TAS begins pulling objectives, materials and strategies *while* the SAS diagnosis is still forming. TAS instructional card forms |
| 6 | Collaborate | 1:10–1:35 | D | 4 structured cards cross the hub (see §4.2). Each card changes the receiver's panel and recolours graph nodes (∧/∨ mastered, → gap). The co-signed joint decision *Targeted Prerequisite Reinforcement → Guided Application → Mastery Assessment* slides to the engine |
| 7 | Orchestrate | 1:35–2:00 | D → P | Input rail (SAS diagnosis, TAS plan, twin context, KG relations, available resources, teacher policies). The 6 operations light up in sequence (coordination, retrieval, assembly, pathway construction, service coordination, monitoring). Status chips: `DECISION READY → RESOURCES RETRIEVED → PATHWAY CREATED → SCHEDULED → DELIVERED → MONITORING`. P: a lock-screen notification arrives |
| 8 | Govern | 2:00–2:15 | F4 → D | Command Center governance mode: portfolio **Routine 31 · Adaptive 9 · Complex 3**. The cursor edits one escalation rule (*"Escalate if no mastery gain after 2 sessions"*). Minh Anh's summary drawer shows twin state, diagnosis and evidence, pathway, execution status, expected outcomes and monitoring criteria |
| 9 | Experience | 2:15–2:35 | F5 → **P** | Notification tap → **Plan** (objectives, 4-step pathway, scheduled sessions) → **Practice** (see §4.3): wrong answer, truth-table hint → **Guided** exercise with progressive support → **Progress**. Each answer emits an "evidence ↑" pulse. D (companion view) shows the evidence streaming into the twin on the same clock |
| 10 | Simulate & Adapt | 2:35–3:05 | D → P | Twin deltas (accuracy, wrong answers, hints, response pattern, mastery **42% → 78%**, remaining gaps). **Simulation panel**: projected curves for pathways A and B, tagged *Simulated projection · illustrative*, and B is selected. SAS and TAS reassessment cards, then a new joint decision *Targeted Application Practice → Advanced Exercises → Mastery Assessment*. Mini engine re-run. P: the updated pathway appears |
| 11 | Scale | 3:05–3:20 | D | Zoom out from her twin to a grid of 55 twins. Students A–E highlight with need → intervention chips (see §4.4). Evidence flows into the Command Center: counters tick, effectiveness bars fill, portfolio counts update. Text: *One Integrated AI Architecture…* |
| 12 | Closing | 3:20–3:30 | D | Architecture view returns: the 4 pillars in one loop, plus SAS, TAS, the engine, the Command Center and the Student App. The loop animates once, then the logo and tagline *Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.* |

Phone idle: P shows the lock screen in every scene except 7 (end), 9 and 10 (end).

## 4. Scenario content

All values are fictional and illustrative.

### 4.1 Minh Anh

Discrete Mathematics, topic: Logical Equivalence.

- Assessment: 75% → 42% (the drop that triggers the alert).
- 2 incomplete activities, repeated conceptual errors involving implication, weak prerequisite mastery.
- Twin mastery (initial): ∧ 0.80, ∨ 0.78, ¬ 0.70, → 0.31, ↔ 0.35, logical equivalence 0.35.
- After the intervention: quiz accuracy 78%, logical-equivalence mastery 0.72, remaining gap: applying equivalence laws.

### 4.2 Agent exchanges (Sc6)

1. **SAS → TAS · DIAGNOSIS:** "Incomplete understanding of logical operators. Evidence indicates implication is the primary area requiring reinforcement." Refs: `twin.errors.implication`, `kg:implication`.
2. **TAS → SAS · PROPOSAL:** "Introduce prerequisite reinforcement followed by guided logical equivalence exercises." Refs: `course.CLO-2`, `resources.prereq-pack`.
3. **SAS → TAS · CHALLENGE:** "Student already demonstrates partial mastery of conjunction and disjunction. Repeating all prerequisite content may be unnecessary." Refs: `twin.mastery.∧`, `twin.mastery.∨`.
4. **TAS → SAS · REFINEMENT:** "Agreed. Focus reinforcement on implication and equivalence, followed by targeted application exercises."

Reassessment (Sc10):

- **SAS:** "Prerequisite understanding improved. Remaining difficulty identified in applying logical equivalence."
- **TAS:** "Reduce prerequisite scaffolding and introduce more challenging application exercises."

### 4.3 Practice (Sc9)

**Q1:** "Which expression is logically equivalent to p → q?" Options: *q → p*, *¬p ∨ q* (correct), *p ∧ ¬q*, *¬p → ¬q*.

Minh Anh picks *q → p* (the converse misconception). The hint shows a truth table that highlights the row p = F, q = T, where the two expressions differ.

**Guided:** rewrite ¬(p → q) using ∧ and ¬. The steps are ¬(¬p ∨ q) → ¬¬p ∧ ¬q (De Morgan) → **p ∧ ¬q**, with one scaffold revealed per step.

### 4.4 Classroom scale (Sc11)

| Student | Learning need | Coordinated intervention |
|---|---|---|
| A | Conceptual gap | Visual scaffolding |
| B | Weak application | Worked examples |
| C | Knowledge retention | Spaced retrieval |
| D | Persistent difficulty | Teacher-supported intervention |
| E | Advanced mastery | Challenging application tasks |

Effectiveness bars: guided conceptual practice 82%, spaced retrieval 74%, independent practice 58%.

### 4.5 Simulation (Sc10)

- **Pathway A** (repeat all prerequisites): projected to reach 0.75 mastery in 6 sessions.
- **Pathway B** (target implication and equivalence): projected to reach 0.75 in 3 sessions.

Both curves sit inside the panel with the in-panel tag *Simulated projection · illustrative*.

## 5. Visual system

Dark theme on the dashboard. **Each colour stands for one architectural component, consistently across all scenes.**

| Token | Hex | Meaning |
|---|---|---|
| bg-deep / panel / surface / line | #070E1F / #0D1A33 / #13244A / #22355E | Navy layers |
| text / text-dim | #F4F7FF / #9AA8C7 | Text |
| cyan | #22D3EE | Multimodal layer: raw streams, extracted evidence |
| royal | #3B6CF6 | Knowledge graph |
| purple | #A78BFA | Digital twin |
| sas | #60A5FA | Student Analysis Agent |
| tas | #34D399 | Teaching Assistance Agent |
| gold | #F5B942 | Teacher governance and policy, teacher cursor |
| white glow | — | Orchestration engine (coordinates, does not reason) |
| gap / mastered | #F87171 / #4ADE80 | Mastery semantics only |

- **Type:**
  - Manrope bold for headlines and KPIs, Inter for the UI, JetBrains Mono for structured agent fields and pipeline statuses.
  - Minimum sizes at 1080p: body 18 px, card title 24 px, KPI 64 px, scene title 56 px.
  - Text stays on screen for at least `words ÷ 3` seconds.
- **Agents:**
  - Each agent is a ring with a live status line (e.g. `reading twin.mastery.implication…`) that pulses when the agent writes.
  - Two conduit curves pass through the hub with dashes flowing in opposite directions. They stay animated in every scene where the agents appear (5, 6, 7, 10, 12).
  - Message cards carry a type badge, sender → receiver, mono fields and evidence refs. Each ref lights up its target in the hub.
  - The joint decision card has a border that blends blue to green and is co-signed by both agents.
- **Particles:** the shape encodes the input type (■ structured, ▬ text, ● interaction, ▭ document). Particles are cyan until the multimodal layer processes them into evidence chips.
- **Student app:** light theme (white, royal, soft purple for "your progress"). The change of background makes every cut between the dashboard and the phone obvious.
- **Motion:**
  - The virtual camera (zoom and pan) is part of the scene timeline.
  - One focal movement at a time; 400–600 ms ease-out; no flashing.
  - Everything is seeded and deterministic.
  - The fake cursor moves on smooth curves with a gold click ripple.
- **Overlays:** scene-title lower thirds (`?titles=0` hides them); a persistent footer label *Illustrative demo data* (`?footer=0` hides it); timecode burn-in with `?tc=1`.

## 6. Controller

- **Scene list:** the 12 scenes with titles, durations and the active highlight, plus a progress bar.
- **Transport:**
  - Play / Pause / Restart / Next / Back.
  - **Play all** runs the full 3:30.
  - Keyboard: `Space`, `←`, `→`, `R`.
- **Scrubber:** seeks within the current scene; both apps follow.
- **Pre-roll:** a 3 s countdown before playback starts. Each scene holds its first and last frame for 1 s as edit handles.
- **Sync slate:** both apps flash a 2-frame corner marker at the start of a take, for aligning the recordings in the editor.
- **Status:** a dashboard and student connection indicator for each app, based on the heartbeat.
- **Toggles:** titles, footer, cursor, timecode. There are also copy buttons for the standalone URLs.

## 7. Live footage (stock)

| Shot | Scene | Content | Notes |
|---|---|---|---|
| F1 | Sc1 0:00–0:04 | Wide shot of a university lecture hall with a lecturer and students | File: `lecture hall.mp4` (640×360, 29.97 fps). A small blurred patch sits in the centre: cover it with a centred Text+ title (see below) that is on screen from the first frame |
| F2 | Sc1 0:04–0:08 | Lecturer stressed at a laptop | Screen-replace with the Sc1 capture, or match-cut on a push-in |
| F3 | Sc1→Sc2 | Push-in on the laptop screen, then a match cut to the clean capture | Done in the editor |
| F4 | Sc8 | The same lecturer, calm, looking at the screen | If no matching actor exists, use a shot from behind or of hands only |
| F5 | Sc9 2:15 | Student's hands, phone notification, tap | Prefer a green-screen phone clip, then corner-pin the P capture |
| F6 | Sc11 (optional) | Reuse F1 as the background for pulling back from the twin grid | — |

- **Screen replacement:** planar tracker plus corner pin in DaVinci Resolve. Choose clips with flat, low-blur screens.
- **Licence:** must allow commercial and promotional use. Keep the licence records with the project.
- **Grade:** a cool navy-and-blue grade so the stock footage sits with the UI palette.
- **F1 cover:** a centred opening line in Manrope bold, white with a soft navy shadow, sized so its block covers the blurred patch, e.g. *"55 students. One lecturer. Data everywhere."* It holds through 0:00–0:04 and dissolves out on the cut to F2, so the patch is never visible on its own. A slow 105% push-in on F1 keeps the patch under the text, because a title stays fixed while the footage moves. F1 is also usable as the dimmed, defocused F6 background.

## 8. Recording workflow

1. `npm run dev` and open the controller. Open the dashboard and student windows at `?scale=2` and `?scale=3`.
2. In OBS, set up two window captures: the dashboard at 3840×2160 and the student app at 1170×2532, both at 60 fps. Record them together.
3. Use **Play all** for a continuous take, or play single scenes to re-record. Takes are identical, so re-recorded scenes cut in cleanly.
4. In Resolve, align the two recordings on the sync slate. Place the stock footage, replace the screens, add the voice-over and music.

## 9. Verification

1. **Scenario consistency tests (Vitest):**
   - KPIs agree across scenes (55 / 12 / 5, and 31 + 9 + 3 ≤ 55).
   - Minh Anh's figures agree everywhere they appear.
   - Every agent evidence ref resolves to a real twin field or KG node.
   - Exactly one practice option is logically equivalent to p → q, checked by truth table.
   - Scene durations sum to 210 s.
2. **Clock and sync tests:** a seek to `t` and playing to `t` give the same derived state.
3. **Contact sheet (`npm run contact-sheet`, Playwright):**
   - Renders every scene at its key timestamps to PNG (dashboard 2×, phone 3×).
   - Two consecutive runs must be pixel-identical.
4. `tsc --strict` and `vite build` pass.

## 10. Out of scope

A real backend, AI or data integration; real student data; voice-over, music and video editing; a native mobile app; responsive layouts; interaction beyond the scripted timelines.
