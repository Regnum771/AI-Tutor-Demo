# Beyond AI Tutoring · Demo Surface Layer

Scripted, deterministic interfaces for the 2:39 "Beyond AI Tutoring" product-first cut. Everything on screen is **illustrative demo data** about fictional students. The video surface is scripted, with no backend or AI; the [live booth mode](#live-booth-demo) below uses real agents.

Spec: `docs/superpowers/specs/2026-10-31-product-first-cut-design.md`

## Scenes

Total 2:39 (159 s). T = teacher window (1920x1080), P = phone window (390x844), F = stock footage added in the editor.

| # | Scene | Duration | Window | Chapter |
|---|---|---|---|---|
| 1 | Problem | 0:24 | F2 under T | none |
| 2 | Beyond | 0:10 | F3 then T | Sense |
| 3 | Classroom | 0:15 | T | Sense |
| 4 | Minh Anh | 0:25 | T | Diagnose |
| 5 | Class gap | 0:10 | T | Diagnose |
| 6 | Approve | 0:15 | T (+P) | Intervene · Oversee |
| 7 | Student | 0:20 | F4 then P | Intervene |
| 8 | Adapt | 0:15 | T (+P) | Adapt |
| 9 | How it works | 0:20 | F1 then T | none |
| 10 | Closing | 0:05 | T | none |

Cross-window cues: in Sc6 the phone notification lands at 7.5 s (1 s after the teacher clicks Approve); in Sc8 the phone switches to the updated plan at 9 s, as the Classroom updates.

## Run

```bash
npm install
npm run dev            # starts Vite on http://localhost:5173
```

Open the Director in Chrome (see Recording for the exact command), then click **Open teacher window** (`teacher.html?scene=1`) and **Open student window**. Both status dots should turn green.
All three windows must stay in the **same browser profile**, because they sync over `BroadcastChannel`.

Controls: `Space` play/pause (frame 0 gets a 3-second pre-roll) · `←`/`→` change scene · `R` restart · **Play all** runs scenes 1 to 10 continuously (any manual navigation disarms it).

Toggles: **Titles**, **Footer label**, **Cursor**, **Chapter label**, **Timecode**, **Sage theme**. The chapter label (top-right of the teacher window) is on by default; turn it off if you add the chapters in Resolve.
**Sage theme** keeps the eggshell paper but swaps the orange accents for VNU sage and the asterisk mark for the leaf-book mark (two leaves opening like a book, with a bud); both windows switch together.

## Live booth demo

A live version of the demo for visitors to use: two real Claude agents answer the teacher from the fictional class data, plans go to a real phone, and the phone's answers update the class live. Everything is still illustrative data about fictional students.

1. Copy `.env.local.example` to `.env.local` and set `ANTHROPIC_API_KEY` (the file is git-ignored). Without usable credentials, or with `BEYOND_OFFLINE=1`, the booth runs on canned answers and every answer carries an "Offline answer" tag.
2. `npm run booth` starts Vite on the LAN and the booth server (port 8787). It prints the phone URL.
3. Open the Director (`http://localhost:5173/controller.html`): **Open live teacher**, and let visitors scan the QR code with a phone on the same Wi-Fi (or open `student.html?live` in a narrow window).
4. Press **Reset demo** (Director or teacher header) between visitors. It also clears the chosen student, plan, marks and day, so it is how the next visitor starts.

Settings: `BEYOND_MODEL` (default `claude-sonnet-5-5`), `BEYOND_EFFORT` (`low` · `medium` · `high`, default `medium`), `BEYOND_HOST` (the laptop address for the phone, if the printed one is wrong).

Check the API path end to end with `npm run test:live` (needs the key; costs one real question and one mastery-check update).

`/api` exists only under `npm run booth`, not under `vite preview` or a static build.

The Classroom tile shows logical equivalence, so a plan that never practises it moves the student's meters but not the tile.

### Network

Run the booth on a private hotspot if you can: venue Wi-Fi often blocks devices from seeing each other (client isolation). Windows Firewall may prompt for Node on first run; allow it on Private networks. Anyone on that network can reach the booth, including **Reset demo** and questions that spend the API key, so set a spend limit in the Anthropic Console.

### The student's own loop

On the phone, tap the lock-screen notification and choose a student. Enter the minutes you have, and the Study Planning Agent writes a plan from today to the exam (24 November). Today shows the day's cards and practice; Practise picks 5 questions at the right Bloom level; Cards are self-rated flip cards; Semester shows the weeks to the exam and why the plan changed. **Next day** asks how the day felt and lands on the next morning's notification; **Next week** skips ahead without asking. Both are the booth's clock: they move the story date for both screens, not just the phone.

Plans change only on a drastic signal (a 15-point mark swing, three days with no practice, a change of pass band, or a teacher's plan) and at most once every 5 story days, except for marks and teacher plans. Replans run in the background, so the phone never waits. The Director's **Simulate a Quiz 3 drop** shows one on demand.

### Booth checklist

- [ ] `npm run booth` prints `agents online` and a phone URL.
- [ ] Phone joins from the QR code and shows the lock screen with the story clock.
- [ ] Ask "Why did Minh Anh's quiz score drop?": thinking lines name both agents, the answer cites evidence (chips open the evidence), the panel shows a plan.
- [ ] Edit a session time, **Approve & send**: the notification lands on the phone.
- [ ] Phone: a wrong answer shows its hint; the teacher's meters move as answers arrive; **Skip to tonight**, finish the mastery check; the teacher gets the 20:40 update and the phone shows tomorrow's plan.
- [ ] Ask about the class and about who needs you personally: approve the class activity and the check-ins (nothing reaches the phone).
- [ ] **Export** shows "Not part of this demo".
- [ ] Stop the server, set `BEYOND_OFFLINE=1`, restart: the Minh Anh story still works with "Offline answer" tags.
- [ ] Phone: tap in, choose Minh Anh, set your minutes: the plan's thinking lines appear, then Today.
- [ ] Practise a set, flip some cards, **Next day**: the morning notification lands and opens Today.
- [ ] **Simulate a Quiz 3 drop**: Semester shows "Why this changed", and the teacher's panel shows the new reason under Road to the exam.
- [ ] **Reset demo** returns both screens to the start.
- [ ] Rehearse touch and scrolling on the real phone.

## Standalone frames

Any window can render without the Director:

- `teacher.html?scene=4&t=17000`: hold one frame
- `student.html?scene=7&autoplay`: play a scene once
- `teacher.html` with no `?scene`: the **live booth teacher**, which needs the booth server (`npm run booth`)
- Flags: `titles=0`, `footer=0`, `cursor=0`, `chapter=0` (hides the chapter label), `tc=1` (timecode burn-in), `theme=sage` (sage accents and mark; also works on the live teacher), `scale=N` (force canvas scale)

## Recording

1. Start `npm run dev`.
2. Launch a dedicated Chrome instance at 2x so a 1920x1080 window captures as 3840x2160:
   `chrome.exe --user-data-dir=%TEMP%\beyond-rec --force-device-scale-factor=2 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion http://localhost:5173/controller.html`

   PowerShell variant (in PowerShell, `%TEMP%` does not expand and `chrome.exe` is usually not on PATH):

   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\beyond-rec" --force-device-scale-factor=2 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion http://localhost:5173/controller.html
   ```
   The separate profile (`--user-data-dir`) is needed so the flags apply even if Chrome is already running. The background flags stop Chrome from pausing covered windows, which would freeze a capture or stall Play all.
3. In the Director, click **Open teacher window** and **Open student window**.
4. Make the teacher window fullscreen (F11) on a 4K display, or accept letterboxing. Capture the phone window cropped to its canvas (390x844 CSS px, 780x1688 at 2x).
5. Record both windows at **60 fps** (OBS Window Capture or similar). Titles and the chapter label can stay on, or go off if you add lower thirds and chapters in DaVinci Resolve.
6. Do one warm-up **Play all** before the real take, then a short dry-run recording of **Sc6** to check sync and frame rate: watch the scripted Approve at 6.5 s and confirm the notification appears on the phone at 7.5 s, 1 s later.
7. Press **Play all** (or play single scenes). Every take is identical, so a re-recorded scene cuts in cleanly.
8. Each scene starts with a 100 ms white **sync slate** (about 6 frames at 60 fps) in the top-left corner. Align the two recordings on it in Resolve.
9. Each scene holds its first and last frame for 1 s; use these as edit handles.

## Stock footage map

| Shot | Scene | File | Notes |
|---|---|---|---|
| F2 | Sc1 | `teacher_stressed.mp4` | Plays under the whole scene. The Sc1 popups are a transparent layer on top, so key or overlay the teacher capture over the footage |
| F3 | Sc2 | `teacher_morning.mp4` | The calm counterpart to F2, then cut to the teacher window |
| F4 | Sc7 | `greenscreen_phone.mp4` | Key the green screen and corner-pin the student capture (`student.html?scene=7&autoplay`) |
| F1 | Sc9 | `lecture hall.mp4` | Leads into Sc9 How it works (F1 → T): the footage plays in the editor, then cuts to the teacher window |

Footage plays in the editor; the T and P windows only render their own scenes.

The footage files are git-ignored. Confirm each licence allows commercial and promotional use, keep the licence records with the project, and grade the footage warm to sit with the eggshell teacher UI.

## 60 s teaser

The teaser is cut in the editor from the same recordings; it needs no extra build. The design spec (section 1) does not list exact cut points, so this is a suggested cut that totals exactly 60 s (5 + 6 + 7 + 14 + 5 + 8 + 4 + 6 + 5). The cut is a suggestion pending your confirmation:

| Take from | Length |
|---|---|
| Sc1 Problem, questions beat (16.5-21.5 s) | 5 s |
| Fill: Sc2 greeting and attention rows (0-6 s) | 6 s |
| Sc3 Classroom, tiles colouring (2-9 s) | 7 s |
| Sc4 Minh Anh, question to answer (4.6-18.6 s) | 14 s |
| Sc6 Approve, edit and approve with the phone notification (3.5-8.5 s) | 5 s |
| Sc7 Student, practice with hint (8-16 s) | 8 s |
| Sc8 Adapt, Classroom counts down (8-12 s) | 4 s |
| Sc9 How it works, loop pulse (12-18 s) | 6 s |
| Sc10 Closing | 5 s |

## Review frames without recording

```bash
npx playwright install chromium   # once
npm run contact-sheet -- --verify # renders every key frame to contact-sheet/ and checks determinism
```

The contact sheet writes the teacher window at 2x and the phone at 3x for each scene's listed shots (43 frames), then renders each twice and compares.

## Tests

```bash
npm test          # scenario consistency, playback/clock, teacher frame, scene smoke tests
npm run build     # tsc --strict + vite build
```
