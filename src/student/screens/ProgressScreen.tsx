import { countUp } from '../../engine/anim';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { PROGRESS } from '../../scenario/practice';
import { C } from '../../ui/tokens';

const R = 64;
const CIRC = 2 * Math.PI * R;

export function ProgressScreen({ local }: { local: number }) {
  const m = countUp(PROGRESS.from, PROGRESS.to, local, 300, 1500);
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="text-[26px] font-bold text-slate-900">Your progress</div>
      <div className="mt-5 flex items-center gap-5 rounded-3xl bg-white p-5 shadow-sm">
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} stroke="#EDE9FE" strokeWidth={14} fill="none" />
          <circle cx={75} cy={75} r={R} stroke={C.twin} strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(m / 100) * CIRC} ${CIRC}`} transform="rotate(-90 75 75)" />
          <text x={75} y={84} textAnchor="middle" fontSize={30} fontWeight={800} fill="#0F172A" fontFamily="Manrope">{m}%</text>
        </svg>
        <div>
          <div className="text-[13px] uppercase tracking-wider text-slate-500">{PROGRESS.concept} mastery</div>
          <div className="text-[15px] text-slate-700">up from {PROGRESS.from}% this morning</div>
          <div className="mt-2 text-[15px] font-semibold text-slate-900">Accuracy today {PROGRESS.accuracyToday}%</div>
        </div>
      </div>
      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        Today · {PROGRESS.done} of {PROGRESS.total} activities complete
      </div>
      {PATHWAY_INITIAL.map((it, i) => {
        const done = i < PROGRESS.done;
        return (
          <div key={it.title} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold" style={{ background: done ? '#DCFCE7' : '#F1F5F9', color: done ? '#15803D' : '#64748B' }}>
              {done ? '✓' : i + 1}
            </span>
            <span className="text-[15px] text-slate-900">{it.title}</span>
            {!done && <span className="ml-auto text-[13px] text-slate-500">{it.when.replace('Today ', '')}</span>}
          </div>
        );
      })}
      <div className="mt-4 rounded-2xl px-4 py-3 text-[14px]" style={{ background: '#F5F3FF', color: '#6D28D9' }}>
        Remaining objective: Logical equivalence
      </div>
    </div>
  );
}
