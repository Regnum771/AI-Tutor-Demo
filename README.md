# Beyond AI Tutoring · Demo Surface Layer

Scripted, deterministic interfaces for the 3:30 "Beyond AI Tutoring" video. Everything on screen is **illustrative demo data** about fictional students; there is no backend or AI.

Spec: `docs/superpowers/specs/2026-10-31-beyond-ai-tutoring-demo-design.md`

## Run

```bash
npm install
npm run dev            # opens the Director (controller) window
```

In the Director, click **Open dashboard window** and **Open student window**. Both status dots should turn ●.
All three windows must stay in the **same browser profile**, because they sync over `BroadcastChannel`.

Controls: `Space` play/pause (frame 0 → 3-second pre-roll) · `←`/`→` change scene · `R` restart · **Play all** runs scenes 1→12 continuously.

## Standalone frames

Any window can render without the controller:

- `dashboard.html?scene=6&t=22000`: hold one frame
- `student.html?scene=9&autoplay`: play a scene once
- Flags: `titles=0`, `footer=0`, `cursor=0`, `tc=1` (timecode burn-in), `scale=N` (force canvas scale)

## Recording

1. Launch Chrome at 2× so a 1920×1080 window captures as 3840×2160:
   `chrome.exe --force-device-scale-factor=2 http://localhost:5173/controller.html`
2. Size the dashboard window to 1920×1080 and the student window to 390×844 (CSS px).
3. In OBS, add two **Window Capture** sources (dashboard 3840×2160, student 780×1688 or larger) and record both at **60 fps**.
4. Press **Play all** (or play single scenes). Every take is identical, so a re-recorded scene cuts in cleanly.
5. Each scene starts with a 2-frame white **sync slate** in the top-left corner. Align the two recordings on it in DaVinci Resolve.
6. Each scene holds its first and last frame for 1 s; use these as edit handles.

## Stock footage map

| Shot | Scene | File | Notes |
|---|---|---|---|
| F1 | Sc1 0:00–0:04 | `lecture hall.mp4` | Establishing shot |
| F2 | Sc1 0:04–0:08 | `teacher_stressed.mp4` | Screen-replace with the Sc1 dashboard capture (Resolve planar tracker + corner pin), or match-cut on a push-in |
| F4 | Sc8 start | `teacher_morning.mp4` | The calm counterpart to F2 |
| F5 | Sc9 2:15 | `greenscreen_phone.mp4` | Key the green screen and corner-pin the student capture (`student.html?scene=9&autoplay`) |
| F6 | Sc11 (optional) | `lecture hall.mp4` | Background for the pull-back to the full classroom |

`lecture hall.mp4` has a small blurred patch in the centre. Cover it with a centred opening title (Manrope bold, white with a soft navy shadow), sized so the text block covers the patch, e.g. *"55 students. One lecturer. Data everywhere."* The title must be on screen from the first frame through 0:04 and dissolve out on the cut to F2. Add a slow 105% push-in on the footage: the title stays fixed while the footage moves, which keeps the patch under the text.

The footage files are git-ignored. Confirm each licence allows commercial and promotional use, keep the licence records with the project, and grade the footage cool navy/blue to sit with the UI.

## Review frames without recording

```bash
npx playwright install chromium   # once
npm run contact-sheet -- --verify # renders every key frame to contact-sheet/ and checks determinism
```

## Tests

```bash
npm test          # scenario consistency, playback/clock, scene smoke tests
npm run build     # tsc --strict + vite build
```
