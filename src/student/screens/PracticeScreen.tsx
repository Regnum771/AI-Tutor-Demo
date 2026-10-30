import { fade } from '../../engine/anim';
import { GUIDED, HINT_ROW, Q1, SC9, TT_ROWS } from '../../scenario/practice';
import { C } from '../../ui/tokens';
import { TouchDot } from './Chrome';

const OPTION_TOP = 236;
const OPTION_STEP = 60;
const tf = (b: boolean) => (b ? 'T' : 'F');

function Question({ t }: { t: number }) {
  const wrong = t >= SC9.pickWrong;
  const right = t >= SC9.pickRight;
  return (
    <>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-slate-900">{Q1.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {Q1.options.map((o, i) => {
          const state = right && i === Q1.correct ? 'right' : wrong && !right && i === Q1.chosenWrong ? 'wrong' : 'idle';
          const style = state === 'wrong'
            ? { background: '#FEF2F2', borderColor: '#FCA5A5' }
            : state === 'right'
              ? { background: '#F0FDF4', borderColor: '#86EFAC' }
              : { background: '#FFFFFF', borderColor: '#E2E8F0' };
          return (
            <div key={o.label} className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 font-mono text-[18px] text-slate-900" style={style}>
              {o.label}
              {state === 'wrong' && <span className="font-sans text-[13px] font-semibold text-red-600">Not quite</span>}
              {state === 'right' && <span className="font-sans text-[13px] font-semibold text-green-600">Correct!</span>}
            </div>
          );
        })}
      </div>
      {t >= SC9.hint && (
        <div className="mt-4 rounded-2xl border p-4" style={{ background: '#F5F3FF', borderColor: '#DDD6FE', opacity: fade(t, SC9.hint) }}>
          <div className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: '#7C3AED' }}>Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-slate-700">{Q1.hint}</div>
          <table className="mt-3 w-full text-center font-mono text-[15px] text-slate-800">
            <thead>
              <tr className="text-slate-500"><th>p</th><th>q</th><th>p → q</th><th>q → p</th></tr>
            </thead>
            <tbody>
              {TT_ROWS.map(([p, q]) => {
                const hi = p === HINT_ROW.p && q === HINT_ROW.q;
                return (
                  <tr key={`${p}${q}`} style={{ background: hi ? '#EDE9FE' : 'transparent', fontWeight: hi ? 700 : 400 }}>
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
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-slate-900">{GUIDED.prompt}</div>
      <div className="mt-3 rounded-2xl bg-white p-4 font-mono text-[20px] text-slate-900 shadow-sm">¬(p → q)</div>
      {GUIDED.steps.map((s, i) => {
        const o = fade(t, SC9.guidedSteps[i]);
        return (
          <div key={s.expr} className="mt-3 rounded-2xl border border-slate-200 bg-white p-4" style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)` }}>
            <div className="text-[13px] text-slate-500">Step {i + 1} · {s.why}</div>
            <div className="mt-1 font-mono text-[20px] text-slate-900">≡ {s.expr}</div>
          </div>
        );
      })}
      {t >= last + 500 && (
        <div className="mt-4 rounded-2xl p-3 text-center text-[15px] font-semibold text-green-700" style={{ background: '#F0FDF4' }}>
          Nice work · 3 / 3 steps with fading support
        </div>
      )}
    </>
  );
}

export function PracticeScreen({ t }: { t: number }) {
  const guided = t >= SC9.guided;
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="flex items-center justify-between text-[13px] text-slate-500">
        <span>Guided practice · Implication</span>
        <span>{guided ? 2 : 1} / 2</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: guided ? '75%' : '40%', background: C.royal }} />
      </div>
      {guided ? <Guided t={t} /> : <Question t={t} />}
    </div>
  );
}
