import { fade } from '../../engine/anim';
import { GUIDED, HINT_ROW, Q1, SC9, TT_ROWS } from '../../scenario/practice';
import { Mark } from '../../teacher/parts';
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
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4" style={{ opacity: fade(t, SC9.hint) }}>
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{Q1.hint}</div>
          <table className="mt-3 w-full text-center font-mono text-[15px] text-egg-ink">
            <thead>
              <tr className="text-egg-mute"><th>p</th><th>q</th><th>p → q</th><th>q → p</th></tr>
            </thead>
            <tbody>
              {TT_ROWS.map(([p, q]) => {
                const hi = p === HINT_ROW.p && q === HINT_ROW.q;
                return (
                  <tr key={`${p}${q}`} className={hi ? 'bg-egg-accent/25 font-bold' : undefined}>
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
            <div className="font-mono text-[12px] text-egg-mute">Step {i + 1} · {s.why}</div>
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
        <div className="h-full rounded-full bg-egg-accent" style={{ width: guided ? '75%' : '40%' }} />
      </div>
      {guided ? <Guided t={t} /> : <Question t={t} />}
    </div>
  );
}
