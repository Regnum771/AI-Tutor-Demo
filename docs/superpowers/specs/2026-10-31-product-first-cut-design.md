# Beyond AI Tutoring — Product-First Cut: Design Spec

**Date:** 2026-10-31
**Status:** Approved in brainstorming, pending written-spec review
**Supersedes:** the scene list (§3), the dashboard window and the Sc3–Sc8, Sc10 and Sc11 visuals of `2026-10-31-beyond-ai-tutoring-demo-design.md`. Its engine, sync protocol, standalone URLs, determinism rules, stock-footage plan and recording workflow still apply unless this spec says otherwise.

## 1. Goal

The current 3:30 cut spends about 70% of its time on abstract explainer canvases. This rework retells it as a **2:30 product story** built on the new eggshell/orange teacher app: a chat interface plus a Classroom view, currently drafted in `src/chat/`. One short architecture segment remains for judges and investors. A **60 s teaser** is cut from the same recordings in the editor; it needs no extra build.

### Key decisions

| Decision | Choice |
|---|---|
| Audience | Both buyers (teachers, schools) and judges/investors in one cut |
| Story spine | **The five teacher questions, answered.** Sc1 poses them; the product answers them one by one |
| Freedom | Scenes, order and script may change (the marketing script is no longer locked) |
| Length | 2:30 main cut (10 scenes) + 60 s teaser, edit-only |
| Teacher surface | The chat + Classroom app replaces the dark dashboard window |
| Recordability | One renderer driven by an event timeline. Scripted scenes and the live draft share it |
| Phone | Keeps its current look in this spec; the eggshell restyle is a separate follow-up spec |
| Framework | Sense → Diagnose → Intervene → Oversee → Adapt shown as small chapter labels |

## 2. Scene list

T = teacher window (1920×1080), P = phone window (390×844), F = stock footage. Total 150 s.

| # | Scene | Dur. | Window | Chapter | Title / subtitle (lower third, optional) |
|---|---|---|---|---|---|
| 1 | Problem | 15 s | F2 → T | — | *Fragmented Data* / *Heterogeneous information. Limited learning intelligence.* |
| 2 | Beyond | 10 s | F3 → T | Sense | *Multimodal Foundation Models* / *Every source. One conversation.* |
| 3 | Classroom | 15 s | T | Sense | *Learning Digital Twins* / *A live model of every student.* |
| 4 | Minh Anh | 25 s | T | Diagnose | *Collaborative Agent Intelligence* / *Knowledge-grounded reasoning, with evidence.* |
| 5 | Class gap | 10 s | T | Diagnose | *Knowledge Graphs → Grounded Inference* / *Prerequisite gaps, across the class.* |
| 6 | Approve | 15 s | T (+P) | Intervene · Oversee | *AI Coordinates. Teachers Govern.* |
| 7 | Student | 20 s | F4 → P | Intervene | *Personalized Learning* / *Adaptive support. Continuous evidence.* |
| 8 | Adapt | 15 s | T (+P) | Adapt | *Monitor. Adapt.* / *The closed-loop learning digital twin.* |
| 9 | How it works | 20 s | F1 → T | — | *One Integrated AI Architecture* / *Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.* |
| 10 | Closing | 5 s | T | — | none (logo + tagline on canvas) |

Footage map: F1 `lecture hall.mp4`, F2 `teacher_stressed.mp4`, F3 `teacher_morning.mp4`, F4 `greenscreen_phone.mp4`. The footage plays in the editor; the T and P windows only render their own scenes.

### 2.1 Beats and cues (scene time, ms)

**Sc1 Problem.** The popups sit on a transparent layer over the `teacher_stressed.mp4` footage, which plays for the whole scene. Every popup is in English, with a header in its app's colour (`src/scenario/clutter.ts`). From 300 to 3050, six popups appear in an orderly 3 × 2 grid. From 3700 to about 7800, 31 more pile up in a seeded shuffle (no app twice in a row), faster and faster, tilted, each in its own cell of a jittered 6 × 6 grid, until they cover the screen. At 7700 an ink veil dims everything. From 8000 to 13000, the five questions (`TEACHER_QUESTIONS`) appear as open "?" chips. The scene holds to 15000.

**Sc2 Beyond.** The chat's opening screen, with the empty composer:
- 500–2500: the greeting "Good afternoon, Lam." types in.
- 3000, 3600, 4200: the three attention rows slide in, and each figure counts up over 800 ms. The figures are 75→42, 12/55 and 3.
- 5000: the five-question tracker appears in the header, with no ticks yet.

**Sc3 Classroom.** Opens on the chat's opening screen:
- 800: the cursor moves to the sidebar. 1500: it clicks **Classroom**.
- 1800–4500: the KPIs count up to 55 / 12 / 5 / 43 / 0.68.
- 2000–9000: the 55 tiles colour in, in index order.
- 9500: Minh Anh's tile pulses until the scene ends.
- 11000: question 1 is ticked.

**Sc4 Minh Anh.** Opens on the Classroom from the end of Sc3:
- 800: the cursor clicks Minh Anh's tile and her card appears.
- 2200: the cursor clicks **Ask about Minh Anh** and the view switches to chat.
- 2600–4600: the question types into the composer. 4800: it is sent.
- 5200 and 6400: the two agent lines appear: "Student Analysis Agent · …", then "Teaching Assistance Agent · …".
- 8000–15000: the answer reveals block by block (paragraph, 4 bullets, closing paragraph), roughly 1000 ms per block.
- 15500–16500: the panel slides in. 16500–18500: the mastery bars grow from 0.
- 19000: questions 2 and 3 are ticked.
- The scene holds to 25000.

**Sc5 Class gap.** Opens on the end of Sc4:
- 800: the cursor clicks the follow-up chip *"What gap is the class facing this week?"*.
- 1200 and 2000: the two agent lines appear.
- 3000–6000: the answer reveals.
- 6200: the class panel replaces the student panel. 6500–7500: the group bars grow.
- 8000: question 4 is ticked.

**Sc6 Approve.** Opens on the end of Sc5:
- 600: the cursor clicks **Minh Anh's Quiz 2 drop** in the sidebar, and the student conversation and panel return.
- 1500–3000: the panel scrolls so the proposal is fully visible.
- 3500: the cursor clicks **Edit**. 4500: step 4's time changes from 19:00 to 20:00, highlighted for 1000 ms.
- 6500: the cursor clicks **Approve & send**, and the panel shows the "Sent to Minh Anh's app" state.
- 7000: the assistant's confirmation message reveals.
- 8000: question 5 is ticked.
- `CUES.approveNotify` = 7500: P shows the lock-screen notification.

**Sc7 Student.** P plays the existing 20 s practice timeline (old Sc9): tap, plan, practice with a wrong answer and a hint, guided step, progress. T holds the last frame of Sc6.

**Sc8 Adapt.** Opens on the end of Sc6:
- 1000: an unprompted assistant message reveals, stamped 20:41: *"Minh Anh passed tonight's mastery check: logical equivalence 0.35 → 0.78. She's reached the target. One gap remains: applying equivalence laws. Within your policy, I've sent her a 3-session follow-up for tomorrow."*
- 3000–5000: the panel's mastery bars animate from `MASTERY_INITIAL` to `MASTERY_POST`.
- 5000: the proposal card switches to the follow-up (`PATHWAY_UPDATED`), labelled "Auto-approved · within your policy".
- 8000: the cursor clicks **Classroom**.
- 8500–11000: the totals count down: need support 12 → 9, high risk 5 → 3. Minh Anh's tile changes from orange to peach and its number reads 0.78.
- `CUES.adaptUpdate` = 9000: P switches to the updated plan.

**Sc9 How it works.** This is the existing architecture view restyled to the light theme. The layers are labelled Sources (LMS, Zalo, WhatsApp, Email…) → Multimodal layer → Knowledge graph + Digital twin → SAS ⇄ TAS → Orchestration engine. The engine branches to two endpoints, Teacher app and Student app, and a return arrow (evidence) runs from Student app back to Sources.
- 0–12000: the layers build in turn.
- 12000–18000: one loop pulse travels the whole cycle.
- The scene holds to 20000.

**Sc10 Closing.** The Beyond wordmark with the asterisk, then the tagline. The scene holds to 5000.

### 2.2 Story-time fix: pathway times and phone clocks

The teacher approves at about 15:00, so every session in the plan must fall after that.

| Constant | Values |
|---|---|
| Proposed pathway (Sc4–Sc6 before edit) | 15:30 Review logical operators · 5 min; 16:00 Explore visual explanations · 8 min; 17:00 Practice guided examples · 10 min; **19:00** Complete a mastery assessment · 10 min |
| `PATHWAY_INITIAL` (approved, phone) | the same, with the mastery assessment at **20:00** |
| Phone clocks | Sc6 lock screen 15:00; Sc7 lock screen 16:58 with the status bar at 17:00 (steps 1–2 done, step 3 up next, which matches today's plan screen) |
| Sc8 message time | 20:41 |

## 3. Architecture

### 3.1 One renderer, two drivers

- **Teacher frame.** A plain object holds everything the teacher screen shows:
  - view (chat or classroom)
  - header title
  - messages, each with a reveal progress from 0 to 1
  - the thinking lines
  - the composer text
  - the panel: id, reveal, scroll offset, approved flag, the edit highlight on step 4, and the mastery set
  - classroom state: tile reveal, KPI values, selected student, Minh Anh's tile state
  - question ticks
  - the cursor position and click

  Components render a frame and hold no state of their own.
- **Event timeline.** Events carry a timestamp: `sendTeacher`, `think`, `answer`, `openPanel`, `scrollPanel`, `editStep`, `approve`, `switchView`, `selectStudent`, `tickQuestion`, `adapt`, and so on. `teacherFrame(events, t)` folds every event at or before `t` into a frame. Reveal amounts come from `t − event.at`, using the existing `anim.ts` helpers. It is pure and deterministic.
- **Scripted driver.** Each of scenes 2–8 has a fixed event list and cursor keyframes in `src/scenario/teacherScript.ts`. A scene starts from the state its predecessor ended in: its list begins with the events that rebuild that state at `at: 0`. The teacher window renders `teacherFrame(scriptFor(scene), t)` from `useSceneClock`.
- **Live driver.** `teacher.html` with no `?scene` parameter is the live draft. Clicks and typing append events stamped with the current time, and a `useNow` tick re-renders. It uses the same components and the same `teacherFrame`.
- **No CSS animations or transitions** in teacher components, in either mode. Every motion is computed from `t` (this matches the original determinism rule). The draft's `chat-rise`, `chat-slide` and `chat-dot` keyframes are removed.

### 3.2 Windows and files

- `teacher.html` replaces `dashboard.html` and `chat.html`. It renders through `Stage` at 1920×1080 in scripted mode, and fills the window in live mode.
  - Sc1 → `ProblemScene`
  - Sc2–8 → `TeacherScreen`
  - Sc9 → `HowItWorks`
  - Sc10 → `Closing`
- `src/chat/` moves to `src/teacher/`. The Instrument Serif font and the `egg` tokens stay. Serif text never carries Vietnamese names; those use the sans face.
- `Overlays` (titles, footer label, timecode, slate) are restyled for the light theme. They gain a **chapter label** in the top-right corner, with its own Director toggle, on by default.
- **Five-question tracker.** A slim strip under the teacher header in Sc2–8 lists the 5 short questions, each with an empty circle that fills orange with a tick when answered.
- **Director.**
  - scene list from the new `SCENES`
  - an "Open teacher window" button
  - copy-URL buttons for the teacher Sc1 and phone Sc7 autoplay URLs
  - a toggle for the chapter label
- **Phone.** `studentFrame` is remapped:
  - Sc6: lock screen, with the notification from `CUES.approveNotify`
  - Sc7: the practice timeline (formerly Sc9)
  - Sc8: from `CUES.adaptUpdate`, the updated plan
  - every other scene: the idle lock screen
- **Removed:**
  - `dashboard.html`, `src/dashboard/` scenes 3–8, 10 and 11
  - the UI pieces used only by them (agent stage, joint decision, graph view, twin panel, sim chart, camera, conduit, particle stream, pipeline status and similar)
  - scenario data used only by them (for example `simulation.ts` and the agent exchanges)

  Anything Sc1, Sc9 or Sc10 still needs moves under `src/teacher/`. Git history keeps the rest.

## 4. Testing

- `teacherFrame` unit tests:
  - the event fold
  - answer reveal at a mid-cue and at completion
  - the panel opens at its cue
  - the edit changes step 4 to 20:00
  - approve, question ticks per scene, adapt KPIs and mastery
  - each scene's first frame equals the previous scene's last frame, for the persistent fields (view, panel id, ticks)
- `studentFrame` tests updated to the new scene ids and cues.
- Every scene renders with `renderToStaticMarkup` without throwing. Element presence is asserted with conditional rendering, never opacity 0.
- The contact-sheet `--verify` script covers the teacher window (2×) and the phone (3×) at each scene's listed shots, and is deterministic across two runs.
- The live draft is checked in a browser: the opening screen, a typed question, approve, and the Classroom grid.
- `tsc`, `vite build` and the full test suite pass.

## 5. Out of scope

- Restyling the phone to eggshell and orange (next spec).
- Cutting the 60 s teaser (an editor task, using the same recordings).
- New voiceover copy beyond the on-screen titles above.
- The old simulation-projection panel (dropped from the story).
