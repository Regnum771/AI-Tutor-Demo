import { countUp } from '../../engine/anim';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { PROGRESS } from '../../scenario/practice';
import { Eyebrow } from '../../teacher/parts';
import type { ProgressView } from '../liveView';
import { StepMarker } from './Chrome';

const R = 64;
const CIRC = 2 * Math.PI * R;

/** The scripted Sc7 figures, in the live view's shape. */
const SCRIPTED: ProgressView = {
  concept: PROGRESS.concept, from: PROGRESS.from, to: PROGRESS.to, accuracy: PROGRESS.accuracyToday,
  items: PATHWAY_INITIAL.map((it) => ({ title: it.title, when: it.when.replace('Today ', '') })),
  done: PROGRESS.done, remaining: 'Remaining objective: Logical equivalence', backLabel: '',
};

export function ProgressScreen({ local, live, onBack }: { local: number; live?: ProgressView; onBack?: () => void }) {
  const p = live ?? SCRIPTED;
  const m = countUp(p.from, p.to, local, 300, 1500);
  return (
    <div className={`absolute inset-0 bg-egg-bg px-5 pt-14 font-sans text-egg-ink${live ? ' overflow-y-auto pb-8' : ''}`}>
      <div className="font-serif text-[40px] leading-none">Your progress</div>
      <div className="mt-5 flex items-center gap-4 rounded-3xl border border-egg-line bg-egg-card p-5">
        <svg width={128} height={128} viewBox="0 0 150 150">
          <circle cx={75} cy={75} r={R} className="stroke-egg-line" strokeWidth={14} fill="none" />
          <circle cx={75} cy={75} r={R} className="stroke-egg-accent" strokeWidth={14} fill="none" strokeLinecap="round" strokeDasharray={`${(m / 100) * CIRC} ${CIRC}`} transform="rotate(-90 75 75)" />
          <text x={75} y={88} textAnchor="middle" fontSize={40} className="fill-egg-ink font-serif">{m}%</text>
        </svg>
        <div>
          <Eyebrow>{p.concept} mastery</Eyebrow>
          <div className="mt-1 text-[15px] text-egg-mute">up from {p.from}% this week</div>
          <div className="mt-2 whitespace-nowrap text-[15px] font-semibold">Accuracy today {p.accuracy}%</div>
        </div>
      </div>
      <div className="mt-6"><Eyebrow>Today · {p.done} of {p.items.length} activities complete</Eyebrow></div>
      <div className="mt-2 border-t border-egg-line">
        {p.items.map((it, i) => {
          const done = i < p.done;
          return (
            <div key={i} className="flex items-center gap-3 border-b border-egg-line py-3">
              <StepMarker n={i + 1} done={done} size={28} />
              <span className="text-[15px]">{it.title}</span>
              {!done && <span className="ml-auto text-[13px] text-egg-mute">{it.when}</span>}
            </div>
          );
        })}
      </div>
      {p.remaining && <div className="mt-4 rounded-2xl bg-egg-tint px-4 py-3 text-[14px] font-semibold">{p.remaining}</div>}
      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">
          {p.backLabel}
        </button>
      )}
    </div>
  );
}
