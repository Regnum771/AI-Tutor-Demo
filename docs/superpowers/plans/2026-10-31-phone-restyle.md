# Phone Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the student phone app (`src/student/`, 390×844) into the eggshell/orange family of the teacher app without moving any frame of the phone timeline.

**Architecture:** The five phone files are restyled in place using the `egg` Tailwind tokens. Two nested tokens (`egg.sage`, `egg.brick`) are added for answer states. `Asterisk` and `Eyebrow` are reused from `src/teacher/parts.tsx`. A new `StepMarker` in `Chrome.tsx` is shared by the plan and progress lists. A palette guard test (`src/student/palette.test.ts`) bans the old blue/purple/slate colours file by file. Each screen task removes its file from the guard's `PENDING` set, and the last task deletes the set. `contact-sheet --verify` gains a phone tap check, so the scripted practice taps land on the centres of their options.

**Tech Stack:** Vite 5, React 18, TypeScript strict, Tailwind 3, Vitest 2 (node environment, SSR via `renderToStaticMarkup`), Playwright (contact-sheet script only).

Spec: `docs/superpowers/specs/2026-10-31-phone-restyle-design.md`

## Global Constraints

- **Determinism:** every visual is a pure function of `(scene, t)`. No CSS animation or transition, no `Date.now`, no `Math.random`.
- **Unchanged:** `src/student/frame.ts`, `src/student/frame.test.ts`, `src/scenario/*`, everything in `src/teacher/` (import from it only), `src/ui/Overlays.tsx` and `src/ui/tokens.ts`.
- **Timings and positions:**
  - `fade`/`countUp` timings stay the same.
  - The lock notification keeps its position (left/right 12, top 250), its opacity, slide and press-scale maths, and the lock TouchDot at (195, 320).
  - EvidencePill stays at top 48, right 16.
- **Copy:** stays exactly as it is. The SSR tests depend on "Your personalized plan is ready", "Review logical operators", "Plan updated", "Targeted application practice", "Not quite", "Hint", "Correct!", "p ∧ ¬q", "52%" and "Good evening".
- **Instrument Serif (`font-serif`):**
  - Used only for: the lock-screen clock, "Discrete Mathematics", "Your progress", and the ring percentage.
  - Never used for "Minh Anh", Vietnamese text, or text containing →, ¬, ∧, ∨ or ≡.
  - It ships in weight 400 only, so never combine it with `font-bold`.
- **New tokens:** in the `egg` block of `tailwind.config.js`:
  - `sage: { DEFAULT: '#4F7A5A', tint: '#E4EDE3' }`
  - `brick: { DEFAULT: '#B5452F', tint: '#F6E1DA' }`
- **Banned in non-test files under `src/student/`:**
  - `C.royal`, `C.twin`
  - Tailwind classes matching `\b(slate|purple|violet|indigo|blue|green|red)-\d{2,3}\b`, `bg-white`, `text-white`
  - any 6-digit hex that is not an egg token
- **Practice geometry:**
  - Each option box is 55px tall, with 10px gaps (`space-y-2.5`).
  - The new options use a 1px border with `py-[13px]`.
  - Nothing above the options (header row, progress bar, prompt) changes size, font, weight or wrapping.
  - `OPTION_TOP = 215`, `OPTION_STEP = 65`.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Commands** run from the repo root. Tests: `npx vitest run <path>`. Typecheck: `npx tsc --noEmit`.

---

### Task 1: Tokens, palette guard, shell, chrome and lock screen

**Files:**
- Modify: `tailwind.config.js` (egg block)
- Create: `src/student/palette.test.ts`
- Modify: `src/student/StudentApp.tsx:16`
- Modify: `src/student/screens/Chrome.tsx` (whole file)
- Modify: `src/student/screens/LockScreen.tsx` (whole file)

**Interfaces:**
- Consumes: `Asterisk({ size, className = 'text-egg-orange', rotate })` from `src/teacher/parts.tsx`.
- Produces:
  - `StepMarker({ n, done, size = 32 }: { n: number; done: boolean; size?: number })` exported from `src/student/screens/Chrome.tsx`. Tasks 2 and 4 use it.
  - The `PENDING` set in `src/student/palette.test.ts`. Tasks 2–4 remove entries from it.
  - Tailwind classes `bg-egg-sage`, `bg-egg-sage-tint`, `text-egg-sage`, `border-egg-sage`, and the same four for `brick`.

- [ ] **Step 1: Save a baseline contact sheet (before any code change)**

```bash
npm run contact-sheet
rm -rf .superpowers/baseline-contact-sheet && cp -r contact-sheet .superpowers/baseline-contact-sheet
ls .superpowers/baseline-contact-sheet | wc -l
```
Expected: `42`. Task 4 compares the teacher frames against this baseline. `.superpowers/` is git-ignored.

- [ ] **Step 2: Add the tokens**

In `tailwind.config.js`, replace the egg block with:

```js
        egg: {
          bg: '#F2EDE4', paper: '#F8F4EC', card: '#FFFDF8', line: '#DCD3C5', ink: '#1A1714',
          mute: '#6B6359', faint: '#9C9285', orange: '#FF5B1F', tint: '#FFE5D6',
          // Phone answer states only (right / wrong, done ticks)
          sage: { DEFAULT: '#4F7A5A', tint: '#E4EDE3' },
          brick: { DEFAULT: '#B5452F', tint: '#F6E1DA' },
        },
```

- [ ] **Step 3: Write the failing palette guard**

Create `src/student/palette.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/student');
/** Screens not restyled yet. Each restyle task removes its file; the last one deletes this set. */
const PENDING = new Set(['screens/PlanScreen.tsx', 'screens/PracticeScreen.tsx', 'screens/ProgressScreen.tsx']);
/** Inline hex is allowed only for egg tokens (keep in sync with tailwind.config.js). */
const EGG_HEX = new Set([
  '#F2EDE4', '#F8F4EC', '#FFFDF8', '#DCD3C5', '#1A1714', '#6B6359', '#9C9285', '#FF5B1F', '#FFE5D6',
  '#4F7A5A', '#E4EDE3', '#B5452F', '#F6E1DA',
]);
const BANNED = [/\bC\.(royal|twin)\b/, /\b(slate|purple|violet|indigo|blue|green|red)-\d{2,3}\b/, /\bbg-white\b/, /\btext-white\b/];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('phone palette', () => {
  for (const file of sources(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (PENDING.has(rel)) continue;
    it(`${rel} uses only egg colours`, () => {
      const src = readFileSync(file, 'utf8');
      for (const re of BANNED) expect(src, `${rel} matches ${re}`).not.toMatch(re);
      const hexes = src.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
      expect(hexes.filter((h) => !EGG_HEX.has(h.toUpperCase())), `${rel} has non-egg hex`).toEqual([]);
    });
  }
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run src/student/palette.test.ts`
Expected: FAIL for `StudentApp.tsx` (`#F8FAFC`), `screens/Chrome.tsx` (`slate-900`) and `screens/LockScreen.tsx` (`#0B1A3A`, `C.royal`). PASS for `frame.ts` and `main.tsx`.

- [ ] **Step 5: Restyle the shell background**

In `src/student/StudentApp.tsx`, change line 16 to:

```tsx
    <Stage width={390} height={844} background="#F2EDE4">
```

- [ ] **Step 6: Replace `src/student/screens/Chrome.tsx`**

```tsx
import { fade, stepIndex } from '../../engine/anim';
import { SC9_EVIDENCE } from '../../scenario/practice';

export function StatusBar({ clock }: { clock: string }) {
  return (
    <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 font-sans text-[14px] font-semibold text-egg-ink" style={{ height: 44, zIndex: 30 }}>
      <span>{clock}</span>
      <span>5G ▮▮▮</span>
    </div>
  );
}

/** Scripted finger tap indicator around time `at`. */
export function TouchDot({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const o = fade(t, at - 300, at + 350, 150);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(15,23,42,0.25)', border: '2px solid rgba(255,255,255,0.9)', opacity: o, zIndex: 40 }} />;
}

/** "Evidence synced ↑" pill after each Sc7 evidence event. */
export function EvidencePill({ t }: { t: number }) {
  const i = stepIndex(t, SC9_EVIDENCE.map((e) => e.at));
  if (i < 0) return null;
  const o = fade(t, SC9_EVIDENCE[i].at, SC9_EVIDENCE[i].at + 1400, 200);
  if (o <= 0) return null;
  return (
    <div className="absolute right-4 flex items-center gap-1.5 rounded-full bg-egg-ink px-3 py-1 font-sans text-[12px] font-semibold text-egg-card" style={{ top: 48, opacity: o, zIndex: 35 }}>
      <span className="h-1.5 w-1.5 rounded-full bg-egg-orange" />
      Evidence synced ↑
    </div>
  );
}

/** Ruled-list step marker: a sage tick when done, an ink-outlined number otherwise. */
export function StepMarker({ n, done, size = 32 }: { n: number; done: boolean; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${done ? 'bg-egg-sage-tint text-egg-sage' : 'border border-egg-ink text-egg-ink'}`}
      style={{ width: size, height: size }}
    >
      {done ? '✓' : n}
    </span>
  );
}
```

- [ ] **Step 7: Replace `src/student/screens/LockScreen.tsx`**

```tsx
import { Asterisk } from '../../teacher/parts';
import { TouchDot } from './Chrome';

/** Ink wallpaper with a still orange glow rising from the bottom edge. */
const WALLPAPER = 'radial-gradient(130% 55% at 50% 108%, rgba(255,91,31,0.55) 0%, rgba(255,91,31,0.14) 50%, rgba(255,91,31,0) 75%), #1A1714';

export function LockScreen({ t, notification, tapAt, clock }: { t: number; notification: number; tapAt?: number; clock: string }) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: WALLPAPER }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-egg-card/70">Saturday, 31 October</div>
      <div className="font-serif text-[84px] leading-none text-egg-card">{clock}</div>
      {notification > 0 && (
        <div className="absolute left-3 right-3 rounded-3xl border border-egg-line bg-egg-card p-4" style={{ top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})` }}>
          <div className="flex items-center gap-2 text-[13px] text-egg-mute">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-egg-ink"><Asterisk size={14} /></span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Beyond Tutor</span>
            <span className="ml-auto">now</span>
          </div>
          <div className="mt-2 text-[17px] font-semibold text-egg-ink">Your personalized plan is ready</div>
          <div className="text-[15px] leading-snug text-egg-mute">4 short sessions today to strengthen implication & logical equivalence.</div>
        </div>
      )}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
```

- [ ] **Step 8: Add an SSR test for the lock screen's serif clock and asterisk icon**

In `src/student/screens.test.tsx`, add inside the `describe` block after the first `it`:

```tsx
  it('lock screen uses the serif clock and the asterisk app icon', () => {
    const lock = html(<LockScreen t={0} notification={1} clock="16:58" />);
    expect(lock).toMatch(/font-serif[^>]*>16:58</);
    expect(lock).toContain('<svg');
    expect(lock).not.toContain('>BT<');
  });
```

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run src/student && npx tsc --noEmit`
Expected: all PASS (palette guard green for StudentApp, Chrome, LockScreen, frame, main), tsc clean.

- [ ] **Step 10: Commit**

```bash
git add tailwind.config.js src/student/palette.test.ts src/student/StudentApp.tsx src/student/screens/Chrome.tsx src/student/screens/LockScreen.tsx src/student/screens.test.tsx
git commit -m "feat(phone): egg tokens, palette guard, warm lock screen and chrome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Plan screen

**Files:**
- Modify: `src/student/screens/PlanScreen.tsx` (whole file)
- Modify: `src/student/palette.test.ts` (`PENDING`)
- Test: `src/student/screens.test.tsx`

**Interfaces:**
- Consumes:
  - `StepMarker({ n, done, size? })` from `./Chrome`.
  - `Asterisk`, `Eyebrow({ children })` from `../../teacher/parts`.
- Produces: `greetingFor(clock: string): string` and `PlanScreen({ local, variant, clock = '17:00' })`. Both keep their signatures unchanged.

- [ ] **Step 1: Make the guard and SSR tests fail**

In `src/student/palette.test.ts`, remove `'screens/PlanScreen.tsx'` from `PENDING`:

```ts
const PENDING = new Set(['screens/PracticeScreen.tsx', 'screens/ProgressScreen.tsx']);
```

In `src/student/screens.test.tsx`, add inside the `describe` block:

```tsx
  it('plan screen: serif course title, sans name, one Up next', () => {
    const plan = html(<PlanScreen local={5000} variant="initial" />);
    expect(plan).toMatch(/font-serif[^>]*>Discrete Mathematics</);
    expect(plan).not.toMatch(/font-serif[^>]*>Minh Anh</);
    expect(plan.split('Up next').length - 1).toBe(1);
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/student`
Expected: FAIL. `screens/PlanScreen.tsx uses only egg colours` fails on `slate-50` / `C.royal` / `#EDE9FE`, and the serif assertion fails.

- [ ] **Step 3: Replace `src/student/screens/PlanScreen.tsx`**

```tsx
import { fade } from '../../engine/anim';
import { PATHWAY_INITIAL, PATHWAY_UPDATED, PLAN_OBJECTIVES, PLAN_OBJECTIVES_UPDATED } from '../../scenario/orchestration';
import { Asterisk, Eyebrow } from '../../teacher/parts';
import { StepMarker } from './Chrome';

/** Greeting derived from the displayed clock (HH:MM): morning before 12:00, afternoon before 18:00, evening after. */
export const greetingFor = (clock: string): string => {
  const h = Number(clock.split(':')[0]);
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function PlanScreen({ local, variant, clock = '17:00' }: { local: number; variant: 'initial' | 'updated'; clock?: string }) {
  const items = variant === 'initial' ? PATHWAY_INITIAL : PATHWAY_UPDATED;
  const objectives = variant === 'initial' ? PLAN_OBJECTIVES : PLAN_OBJECTIVES_UPDATED;
  const next = variant === 'initial' ? 2 : 0;
  return (
    <div className="absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink">
      <div className="text-[15px] text-egg-mute">{greetingFor(clock)},</div>
      <div className="text-[26px] font-bold">Minh Anh</div>
      {variant === 'updated' && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-egg-tint px-4 py-2 text-[14px] font-semibold" style={{ opacity: fade(local, 100) }}>
          <Asterisk size={14} />
          Plan updated · based on your progress
        </div>
      )}
      <div className="mt-4 rounded-3xl bg-egg-ink p-5 text-egg-card">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-card/60">Your personalized learning plan</div>
        <div className="mt-2 font-serif text-[34px] leading-none">Discrete Mathematics</div>
        <div className="mt-1.5 text-[15px] text-egg-card/75">Topic: Logical Equivalence</div>
        <div className="mt-3 flex gap-2">
          {objectives.map((o) => <span key={o} className="rounded-full border border-egg-card/30 px-3 py-1 text-[12px] font-semibold">{o}</span>)}
        </div>
      </div>
      <div className="mt-6"><Eyebrow>{variant === 'initial' ? 'Learning pathway · today' : 'Next steps · tomorrow'}</Eyebrow></div>
      <div className="mt-2 border-t border-egg-line">
        {items.map((it, i) => {
          const o = fade(local, 300 + i * 250);
          return (
            <div key={it.title} className="relative flex items-center gap-3 border-b border-egg-line py-3.5 pl-3" style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
              {i === next && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-egg-orange" />}
              <StepMarker n={i + 1} done={variant === 'initial' && i < 2} />
              <div>
                <div className="text-[16px] font-semibold">{it.title}</div>
                <div className="text-[13px] text-egg-mute">{it.when} · {it.mins} min</div>
              </div>
              {i === next && <span className="ml-auto whitespace-nowrap rounded-full bg-egg-orange px-2.5 py-0.5 text-[12px] font-semibold text-egg-ink">Up next</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/student && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Look at the two plan frames**

Run: `npm run contact-sheet`, then open `contact-sheet/student-sc07-t04500.png` (initial plan) and `contact-sheet/student-sc08-t10500.png` (updated plan, "Good evening").

Check:
- "Discrete Mathematics" sits on one line in the ink card.
- "Up next" stays on one line.
- Nothing is clipped at the bottom.
- No blue or purple remains.

If "Discrete Mathematics" wraps, reduce `text-[34px]` to `text-[30px]`.

- [ ] **Step 6: Commit**

```bash
git add src/student/screens/PlanScreen.tsx src/student/palette.test.ts src/student/screens.test.tsx
git commit -m "feat(phone): plan screen in the egg family (ink plan card, ruled pathway)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Practice screen and centred taps

**Files:**
- Modify: `src/student/screens/PracticeScreen.tsx` (whole file)
- Modify: `scripts/contact-sheet.ts` (add `checkTaps`, wire into `main`)
- Modify: `src/student/palette.test.ts` (`PENDING`)

**Interfaces:**
- Consumes: `Asterisk` from `../../teacher/parts`, `TouchDot` from `./Chrome`.
- Produces:
  - `export const OPTION_TOP = 215` and `export const OPTION_STEP = 65` from `src/student/screens/PracticeScreen.tsx`. The contact sheet uses them.
  - Every option `div` carries a `data-option={i}` attribute.

- [ ] **Step 1: Write the failing tap check**

In `scripts/contact-sheet.ts`, add these imports after the existing ones:

```ts
import { Q1, SC9 } from '../src/scenario/practice';
import { OPTION_STEP, OPTION_TOP } from '../src/student/screens/PracticeScreen';
```

Add this function after `checkClicks`:

```ts
/** Each scripted practice tap must sit on the centre of its option (within 2px). */
async function checkTaps(page: Page): Promise<string[]> {
  const vp = page.viewportSize();
  if (!vp || vp.width !== 390 || vp.height !== 844) throw new Error('tap check needs a 390x844 viewport (Stage is 1:1)');
  await page.goto(`http://localhost:${PORT}/student.html?scene=7&t=${SC9.pickWrong}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const centres = await page.evaluate(() =>
    [...document.querySelectorAll('[data-option]')].map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }),
  );
  const failures: string[] = [];
  for (const i of [Q1.chosenWrong, Q1.correct]) {
    const want = OPTION_TOP + i * OPTION_STEP;
    const got = centres[i];
    if (got === undefined || Math.abs(got - want) > 2) failures.push(`Sc7 tap on option ${i} at y=${want}, option centre is ${got === undefined ? 'missing' : got.toFixed(1)}`);
    else console.log(`tap ok Sc7 option ${i} y=${want}`);
  }
  return failures;
}
```

In `main`, replace:

```ts
  const clickFailures = verify ? await checkClicks(teacher) : [];
```

with:

```ts
  const clickFailures = verify ? [...(await checkClicks(teacher)), ...(await checkTaps(phone))] : [];
```

Change the error line to:

```ts
    console.error(`Scripted clicks or taps that miss their target:\n${clickFailures.join('\n')}`);
```

Change the final message suffix to `' · all deterministic · all clicks and taps on target'`.

- [ ] **Step 2: Make the guard fail too**

In `src/student/palette.test.ts`:

```ts
const PENDING = new Set(['screens/ProgressScreen.tsx']);
```

- [ ] **Step 3: Run to see both fail**

Run: `npx vitest run src/student/palette.test.ts`
Expected: FAIL for `screens/PracticeScreen.tsx`.

Run: `npm run contact-sheet -- --verify`
Expected: exit 1. The script either fails to import `OPTION_TOP` (not exported yet), or, once exported, reports `option centre is missing` because there is no `data-option` yet.

- [ ] **Step 4: Replace `src/student/screens/PracticeScreen.tsx`**

```tsx
import { fade } from '../../engine/anim';
import { GUIDED, HINT_ROW, Q1, SC9, TT_ROWS } from '../../scenario/practice';
import { Asterisk } from '../../teacher/parts';
import { TouchDot } from './Chrome';

/** Centre y of option 0, and the distance between option centres (55px box + 10px gap). Checked by `contact-sheet --verify`. */
export const OPTION_TOP = 215;
export const OPTION_STEP = 65;
const tf = (b: boolean) => (b ? 'T' : 'F');

const OPTION_CLS = {
  idle: 'border-egg-line bg-egg-card',
  wrong: 'border-egg-brick bg-egg-brick-tint',
  right: 'border-egg-sage bg-egg-sage-tint',
} as const;

function Question({ t }: { t: number }) {
  const wrong = t >= SC9.pickWrong;
  const right = t >= SC9.pickRight;
  return (
    <>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-egg-ink [text-wrap:balance]">{Q1.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {Q1.options.map((o, i) => {
          const state = right && i === Q1.correct ? 'right' : wrong && !right && i === Q1.chosenWrong ? 'wrong' : 'idle';
          return (
            <div key={o.label} data-option={i} className={`flex items-center justify-between rounded-2xl border px-4 py-[13px] font-mono text-[18px] text-egg-ink ${OPTION_CLS[state]}`}>
              {o.label}
              {state === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {state === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </div>
          );
        })}
      </div>
      {t >= SC9.hint && (
        <div className="mt-4 rounded-2xl border border-egg-orange/40 bg-egg-tint p-4" style={{ opacity: fade(t, SC9.hint) }}>
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Asterisk size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{Q1.hint}</div>
          <table className="mt-3 w-full text-center font-mono text-[15px] text-egg-ink">
            <thead>
              <tr className="text-egg-mute"><th>p</th><th>q</th><th>p → q</th><th>q → p</th></tr>
            </thead>
            <tbody>
              {TT_ROWS.map(([p, q]) => {
                const hi = p === HINT_ROW.p && q === HINT_ROW.q;
                return (
                  <tr key={`${p}${q}`} className={hi ? 'bg-egg-orange/25 font-bold' : undefined}>
                    <td>{tf(p)}</td><td>{tf(q)}</td><td>{tf(!p || q)}</td><td>{tf(!q || p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <TouchDot t={t} at={SC9.pickWrong} x={195} y={OPTION_TOP + Q1.chosenWrong * OPTION_STEP} />
      <TouchDot t={t} at={SC9.pickRight} x={195} y={OPTION_TOP + Q1.correct * OPTION_STEP} />
    </>
  );
}

function Guided({ t }: { t: number }) {
  const last = SC9.guidedSteps[SC9.guidedSteps.length - 1];
  return (
    <>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-egg-ink [text-wrap:balance]">{GUIDED.prompt}</div>
      <div className="mt-3 rounded-2xl border border-egg-line bg-egg-card p-4 font-mono text-[20px]">¬(p → q)</div>
      {GUIDED.steps.map((s, i) => {
        const o = fade(t, SC9.guidedSteps[i]);
        return (
          <div key={s.expr} className="mt-3 rounded-2xl border border-egg-line bg-egg-card p-4" style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-mute">Step {i + 1} · {s.why}</div>
            <div className="mt-1 font-mono text-[20px]">≡ {s.expr}</div>
          </div>
        );
      })}
      {t >= last + 500 && (
        <div className="mt-4 rounded-2xl bg-egg-sage-tint p-3 text-center text-[15px] font-semibold text-egg-sage">
          Nice work · 3 / 3 steps with fading support
        </div>
      )}
    </>
  );
}

export function PracticeScreen({ t }: { t: number }) {
  const guided = t >= SC9.guided;
  return (
    <div className="absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink">
      <div className="flex items-center justify-between text-[13px] text-egg-mute">
        <span>Guided practice · Implication</span>
        <span>{guided ? 2 : 1} / 2</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-egg-line">
        <div className="h-full rounded-full bg-egg-orange" style={{ width: guided ? '75%' : '40%' }} />
      </div>
      {guided ? <Guided t={t} /> : <Question t={t} />}
    </div>
  );
}
```

- [ ] **Step 5: Run tests, typecheck and the tap check**

Run: `npx vitest run src/student && npx tsc --noEmit`
Expected: all PASS, including the existing "Not quite" / "Hint" / "Correct!" / "p ∧ ¬q" tests. tsc clean.

Run: `npm run contact-sheet -- --verify`
Expected: exit 0. The output includes `tap ok Sc7 option 0 y=215` and `tap ok Sc7 option 1 y=280`, and ends with `42 frames written to contact-sheet/ · all deterministic · all clicks and taps on target`.

If a tap reports an off-centre value, an option box is no longer 55px or the gap is no longer 10px. Fix the markup; do not change `OPTION_TOP`/`OPTION_STEP`.

- [ ] **Step 6: Look at the practice frames**

Open `contact-sheet/student-sc07-t09500.png` (wrong answer and hint), `student-sc07-t12000.png` (correct answer) and `student-sc07-t15800.png` (guided steps).

Check:
- Brick and sage states are clearly distinct.
- The hint table's highlighted row is visible.
- The guided step eyebrows fit on one line, or wrap cleanly.
- Nothing is clipped.

- [ ] **Step 7: Commit**

```bash
git add src/student/screens/PracticeScreen.tsx src/student/palette.test.ts scripts/contact-sheet.ts
git commit -m "feat(phone): practice screen in the egg family; taps centred on options and checked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Progress screen, guard complete, final verification

**Files:**
- Modify: `src/student/screens/ProgressScreen.tsx` (whole file)
- Modify: `src/student/palette.test.ts` (delete `PENDING`)
- Test: `src/student/screens.test.tsx`

**Interfaces:**
- Consumes: `StepMarker({ n, done, size? })` from `./Chrome`, and `Eyebrow` from `../../teacher/parts`.
- Produces: `ProgressScreen({ local })`, signature unchanged.

- [ ] **Step 1: Make the guard cover every file, and add the SSR test**

In `src/student/palette.test.ts`:
- Delete the `PENDING` constant and its doc comment.
- Delete the line `if (PENDING.has(rel)) continue;`.

In `src/student/screens.test.tsx`, add inside the `describe` block:

```tsx
  it('progress screen: serif title and serif percentage', () => {
    const p = html(<ProgressScreen local={5000} />);
    expect(p).toMatch(/font-serif[^>]*>Your progress</);
    expect(p).toMatch(/<text[^>]*font-serif[^>]*>52%</);
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/student`
Expected: FAIL. `screens/ProgressScreen.tsx uses only egg colours` fails (`slate-50`, `C.twin`, `#EDE9FE`), and so do the serif assertions.

- [ ] **Step 3: Replace `src/student/screens/ProgressScreen.tsx`**

```tsx
import { countUp } from '../../engine/anim';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { PROGRESS } from '../../scenario/practice';
import { Eyebrow } from '../../teacher/parts';
import { StepMarker } from './Chrome';

const R = 64;
const CIRC = 2 * Math.PI * R;

export function ProgressScreen({ local }: { local: number }) {
  const m = countUp(PROGRESS.from, PROGRESS.to, local, 300, 1500);
  return (
    <div className="absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink">
      <div className="font-serif text-[40px] leading-none">Your progress</div>
      <div className="mt-5 flex items-center gap-5 rounded-3xl border border-egg-line bg-egg-card p-5">
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} className="stroke-egg-line" strokeWidth={14} fill="none" />
          <circle cx={75} cy={75} r={R} className="stroke-egg-orange" strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(m / 100) * CIRC} ${CIRC}`} transform="rotate(-90 75 75)" />
          <text x={75} y={88} textAnchor="middle" fontSize={40} className="fill-egg-ink font-serif">{m}%</text>
        </svg>
        <div>
          <Eyebrow>{PROGRESS.concept} mastery</Eyebrow>
          <div className="mt-1 text-[15px] text-egg-mute">up from {PROGRESS.from}% this week</div>
          <div className="mt-2 text-[15px] font-semibold">Accuracy today {PROGRESS.accuracyToday}%</div>
        </div>
      </div>
      <div className="mt-6"><Eyebrow>Today · {PROGRESS.done} of {PROGRESS.total} activities complete</Eyebrow></div>
      <div className="mt-2 border-t border-egg-line">
        {PATHWAY_INITIAL.map((it, i) => {
          const done = i < PROGRESS.done;
          return (
            <div key={it.title} className="flex items-center gap-3 border-b border-egg-line py-3">
              <StepMarker n={i + 1} done={done} size={28} />
              <span className="text-[15px]">{it.title}</span>
              {!done && <span className="ml-auto text-[13px] text-egg-mute">{it.when.replace('Today ', '')}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl bg-egg-tint px-4 py-3 text-[14px] font-semibold">
        Remaining objective: Logical equivalence
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: every test file passes (the previous 107 tests plus the new palette and screen tests), and tsc is clean.

- [ ] **Step 5: Verify the contact sheet**

Run: `npm run contact-sheet -- --verify`
Expected: exit 0, ending `42 frames written to contact-sheet/ · all deterministic · all clicks and taps on target`.

- [ ] **Step 6: Confirm the teacher frames are byte-identical to the baseline**

```bash
fail=0; for f in .superpowers/baseline-contact-sheet/teacher-*.png; do cmp -s "$f" "contact-sheet/$(basename "$f")" || { echo "CHANGED $(basename "$f")"; fail=1; }; done; echo "teacher compare exit=$fail"
```
Expected: `teacher compare exit=0` and no `CHANGED` lines.

- [ ] **Step 7: Look at all 8 phone frames**

Open each of the following in `contact-sheet/`:
- `student-sc06-t08200.png`
- `student-sc07-t01800.png`
- `student-sc07-t04500.png`
- `student-sc07-t09500.png`
- `student-sc07-t12000.png`
- `student-sc07-t15800.png`
- `student-sc07-t18500.png`
- `student-sc08-t10500.png`

Check:
- No blue or purple anywhere.
- The serif appears only on the clock, "Discrete Mathematics", "Your progress" and the percentage.
- The Sc7 t01800 TouchDot sits on the notification.
- "Up next" stays on one line.
- On the progress frame (t18500), the ring reads 52% and the list and remaining-objective box fit above the bottom edge.
- Nothing is clipped at 390×844.

- [ ] **Step 8: Commit**

```bash
git add src/student/screens/ProgressScreen.tsx src/student/palette.test.ts src/student/screens.test.tsx
git commit -m "feat(phone): progress screen in the egg family; palette guard covers all of src/student

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
