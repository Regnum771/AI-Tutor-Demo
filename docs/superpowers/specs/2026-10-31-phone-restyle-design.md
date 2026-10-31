# Phone restyle — design

Date: 2026-10-31 · Branch: `phone-restyle`

## Goal

Make the student phone app (`student.html`, `src/student/`, 390×844) look like it belongs to the same product as the eggshell/orange teacher app, while keeping every frame of the phone timeline where it is today:

- Sc6: lock screen, notification at 15:00.
- Sc7: 16:58 lock → tap → plan (17:00) → practice → progress 52%.
- Sc8: 20:42 updated plan, "Good evening".

## Decisions (agreed)

1. **Depth: same family, adapted for students.** The phone uses the egg colours, black-ink buttons, the orange asterisk mark, and large Instrument Serif headings. Pathway steps become a ruled list instead of white cards. Controls stay touch-sized.
2. **Right/wrong answers: muted semantic colours.** Sage green for right, brick red for wrong. They are tuned for eggshell and used only for answer states and "done" ticks.
3. **Lock screen: warm dark wallpaper.** Ink background with a soft, still orange glow rising from the bottom. Clock and date are eggshell, the notification card is eggshell, and the app icon is the orange asterisk.
4. **Approach: restyle in place.** Edit the five phone screen files directly. Reuse `Asterisk` and `Eyebrow` from `src/teacher/parts.tsx`. Add only the two new colour tokens. The teacher app is not touched, so its approved frames cannot shift.

## Colours

The phone uses the existing `egg` Tailwind tokens: bg `#F2EDE4`, paper `#F8F4EC`, card `#FFFDF8`, line `#DCD3C5`, ink `#1A1714`, mute `#6B6359`, faint `#9C9285`, orange `#FF5B1F`, tint `#FFE5D6`.

New tokens, added to the `egg` block in `tailwind.config.js`. The egg theme lives only in Tailwind, as in the teacher app; `src/ui/tokens.ts` holds only the old dark palette and does not change. `sage` and `brick` are nested objects, `{ DEFAULT, tint }`, so the classes are `bg-egg-sage`, `bg-egg-sage-tint`, and so on:

| Token | Hex | Use |
|---|---|---|
| `sage` | `#4F7A5A` | "Correct!" text and border, done ticks, the "Nice work" line |
| `sage.tint` | `#E4EDE3` | Right-answer fill, done-tick circle fill |
| `brick` | `#B5452F` | "Not quite" text and border |
| `brick.tint` | `#F6E1DA` | Wrong-answer fill |

All blue, purple and slate colours leave `src/student/`. That covers `C.royal`, `C.twin`, `#0B1A3A`, `#3B6CF6`, the purple hint box, the purple "Plan updated" pill, the purple progress ring and the purple "Evidence synced" pill. Tailwind `slate-*`, `green-*`, `red-*`, `purple-*`, `bg-white` and `text-white` classes are also removed.

## Type

- **Instrument Serif** is for English-only headings and big numbers: the lock-screen clock, "Discrete Mathematics", "Your progress", and the ring percentage.
- It is never used for "Minh Anh", for Vietnamese text, or for anything containing →, ¬, ∧, ∨ or ≡, because the font may lack those glyphs.
- Other text keeps today's families: Inter for body, Manrope where it is used now, JetBrains Mono for formulas and eyebrows.
- The practice-screen question prompt keeps its current font, size, weight and wrapping. Its height decides where the options sit (see Geometry).

## Screens

### Lock screen (`LockScreen.tsx`)

- **Wallpaper:** fills the whole screen with ink `#1A1714`, plus a still radial orange glow rising from the bottom edge. The glow is pure CSS with no animation.
- **Date and clock:** the date line is eggshell at reduced opacity. The clock is a large Instrument Serif in eggshell. Sizes and vertical positions stay close to today's (date at 18px, clock at about 84px), so the notification card does not move.
- **Notification card:**
  - Eggshell `card` fill, a hairline `line` border, rounded.
  - Same position (left/right 12, top 250), the same opacity, slide and press-scale maths, and the same copy.
  - The app icon is an ink rounded square holding an orange `Asterisk`, next to "BEYOND TUTOR" in mono eyebrow style and "now" in mute.
  - The title is ink semibold and the body is mute.
- **TouchDot:** stays at (195, 320).

### Plan screen (`PlanScreen.tsx`)

- **Header:**
  - The screen background is `egg.bg`.
  - The greeting (`greetingFor`, unchanged) is mute sans.
  - "Minh Anh" is ink bold sans, never serif.
- **"Plan updated" pill (updated variant):**
  - An orange-`tint` pill with a small orange asterisk.
  - Ink text "Plan updated · based on your progress".
  - The same `fade(local, 100)` timing.
- **Plan card:**
  - An ink card with eggshell text.
  - The eyebrow "Your personalized learning plan" is mono, in faint eggshell.
  - "Discrete Mathematics" is Instrument Serif.
  - "Topic: Logical Equivalence" is eggshell at reduced opacity.
  - Objective chips are outlined: a thin eggshell border at low opacity, with no fill.
- **Section label:** "Learning pathway · today" or "Next steps · tomorrow", via `Eyebrow`.
- **Pathway:** a ruled list with hairline `line` dividers, not white cards.
  - Each row shows a marker, then the title (ink) and "`{when} · {mins} min`" (mute).
  - The marker is a numbered circle (ink outline, ink numeral), or a sage tick on a `sage-tint` circle for done items (initial variant, `i < 2`).
  - The current row (index 2 initial, index 0 updated) has a 2px orange bar on its left edge and an orange "Up next" pill with ink text, kept on one line (`whitespace-nowrap`).
  - Row fade-in timing is unchanged (`300 + i*250` with translateY).

### Practice screen (`PracticeScreen.tsx`)

- **Header:**
  - The label "Guided practice · Implication" and the "1/2" or "2/2" counter keep their layout.
  - The progress bar becomes orange on an `egg.line` track, at the same 40% and 75% values.
- **Options:**
  - Idle options are `card` fill with an `egg.line` border.
  - Wrong is `brick-tint` fill with a `brick` border and "Not quite" in brick.
  - Right is `sage-tint` fill with a `sage` border and "Correct!" in sage.
  - Both labels keep their exact text.
  - Option text stays mono 18px ink.
- **Hint box:**
  - An orange-`tint` fill with a thin orange-ish border.
  - The label is "Hint" with a small asterisk in mono eyebrow style (the text "Hint" is kept).
  - Hint copy is ink or mute.
  - In the truth table, the header row is mute and the `HINT_ROW` row is highlighted with a deeper tint (orange at about 25% alpha) and bold, as today.
- **Guided steps:**
  - The "¬(p → q)" box and each step card use `card` fill with an `egg.line` border.
  - "Step i · why" is a mute eyebrow and "≡ expr" is mono ink.
  - The closing "Nice work · 3 / 3 steps with fading support" line is sage on `sage-tint`.
  - Timings are unchanged.

### Progress screen (`ProgressScreen.tsx`)

- **Title:** "Your progress" in Instrument Serif.
- **Ring:**
  - Inside a `card` with a hairline border, R=64.
  - The track is `egg.line` and the arc is orange.
  - The centre shows `{m}%` in Instrument Serif (ink).
  - The `countUp` maths is unchanged and still ends at 52%.
  - "up from 31%", "… mastery" and "Accuracy today …%" are mute or ink sans.
- **Today list:** "Today · 3 of 4 activities complete" uses the same ruled-row and marker style as the plan pathway: sage ticks for done items, an ink-outlined number otherwise, and the time shown for not-done items.
- **Remaining objective:** "Remaining objective: Logical equivalence" is an orange-`tint` box with an ink label.

### Chrome (`Chrome.tsx`) and app shell (`StudentApp.tsx`)

- **StatusBar:** ink text, otherwise unchanged. It is hidden on the lock screen, as today.
- **EvidencePill:** an ink pill with eggshell text "Evidence synced ↑" and a small orange dot before it. Same position (top 48, right 16) and the same timing.
- **TouchDot:** unchanged. Its translucent dark fill with a white ring reads on both the dark lock screen and the eggshell screens.
- **Stage background:** `StudentApp` passes `background="#F2EDE4"` (egg.bg) instead of `#F8FAFC`.

## Unchanged

- `src/student/frame.ts` and its tests, so all timings, clocks, screen switches and variants stay as they are.
- `src/scenario/*` copy and constants (`Q1`, `GUIDED`, `SC9`, `SC9_EVIDENCE`, `PATHWAY_*`, `PLAN_OBJECTIVES*`, `PROGRESS`).
- The teacher app and `Overlays`, including the phone variant.
- Determinism. Everything stays a pure function of `(scene, t)`, with no CSS animation or transition, no `Date.now` and no `Math.random`.

## Geometry constraint

The practice TouchDots are drawn at fixed y-positions from `OPTION_TOP` and `OPTION_STEP`. Every option must therefore keep its exact outer box and spacing: 55px tall, 10px apart.

Measured in the browser today, the option centres are at y = 215, 280, 345, 410. The current constants (236 / 60) put the taps 21px and 16px off-centre. The restyle fixes that by setting `OPTION_TOP = 215` and `OPTION_STEP = 65`. A browser check confirms each option's centre is within 2px of `OPTION_TOP + i * OPTION_STEP`.

If the border goes from 2px to 1px, the vertical padding must grow by 1px on each side (`py-3` becomes `py-[13px]`) so the outer height stays the same.

Nothing above the options may change height. That includes the header, the progress bar and the prompt.

## Testing

- `src/student/screens.test.tsx` keeps passing. Update assertions only where the markup they match changed; the copy assertions stay as they are.
- New test `src/student/palette.test.ts`:
  - Reads every non-test `.ts`/`.tsx` file under `src/student/`.
  - Fails if any contains `C.royal`, `C.twin`, `#0B1A3A`, `#3B6CF6`, `#F8FAFC`, or a Tailwind class matching `\b(slate|purple|violet|indigo|blue|green|red)-\d{2,3}\b`, `bg-white` or `text-white`.
- `npx tsc --noEmit` is clean, and the whole Vitest suite is green.
- Run `npm run contact-sheet -- --verify` and check the 8 phone frames (`contact-sheet/student-*.png`) by eye:
  - No blue or purple remains.
  - The serif appears only on English headings and numbers.
  - The Sc7 TouchDots land on the centres of the wrong and right options.
  - "Up next" stays on one line.
  - Nothing is clipped at 390×844.
  - The teacher frames are unchanged. Copy `contact-sheet/` aside before the work starts, then compare the teacher PNGs byte for byte afterwards.
