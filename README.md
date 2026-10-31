# Beyond AI Tutoring · Demo Surface Layer

Scripted, deterministic interfaces for the 3:30 "Beyond AI Tutoring" video. Everything on screen is **illustrative demo data** about fictional students; there is no backend or AI.

Spec: `docs/superpowers/specs/2026-10-31-beyond-ai-tutoring-demo-design.md`

## Run

```bash
npm install
npm run dev            # starts Vite on http://localhost:5173
```

Open the Director in Chrome (see Recording for the exact command), then click **Open dashboard window** and **Open student window**. Both status dots should turn ●.
All three windows must stay in the **same browser profile**, because they sync over `BroadcastChannel`.

Controls: `Space` play/pause (frame 0 → 3-second pre-roll) · `←`/`→` change scene · `R` restart · **Play all** runs scenes 1→12 continuously (any manual navigation disarms it).

## Standalone frames

Any window can render without the controller:

- `dashboard.html?scene=6&t=22000`: hold one frame
- `student.html?scene=9&autoplay`: play a scene once
- Flags: `titles=0`, `footer=0`, `cursor=0`, `tc=1` (timecode burn-in), `scale=N` (force canvas scale)

## Recording

1. Start `npm run dev`.
2. Launch a dedicated Chrome instance at 2× so a 1920×1080 window captures as 3840×2160:
   `chrome.exe --user-data-dir=%TEMP%\beyond-rec --force-device-scale-factor=2 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion http://localhost:5173/controller.html`

   PowerShell variant (in PowerShell, `%TEMP%` does not expand and `chrome.exe` is usually not on PATH):

   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="$env:TEMP\beyond-rec" --force-device-scale-factor=2 --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling --disable-features=CalculateNativeWinOcclusion http://localhost:5173/controller.html
   ```
   The separate profile (`--user-data-dir`) is needed so the flags apply even if Chrome is already running. The background flags stop Chrome from pausing covered windows, which would freeze a capture or stall Play all.
3. In the Director, click **Open dashboard window** and **Open student window**.
4. Make the dashboard fullscreen (F11) on a 4K display, or accept letterboxing. Capture the phone window cropped to its canvas (390×844 CSS px, 780×1688 at 2×).
5. Record both windows at **60 fps** (OBS Window Capture or similar) with **titles off** (Director toggle). Add the lower thirds in DaVinci Resolve: the in-app titles cover live content in Sc5–Sc7.
6. Do one warm-up **Play all** before the real take, then a short dry-run recording of Sc7 to check sync and frame rate.
7. Press **Play all** (or play single scenes). Every take is identical, so a re-recorded scene cuts in cleanly.
8. Each scene starts with a 100 ms white **sync slate** (about 6 frames at 60 fps) in the top-left corner. Align the two recordings on it in Resolve.
9. Each scene holds its first and last frame for 1 s; use these as edit handles.

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
