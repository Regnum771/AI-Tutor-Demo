import { useState } from 'react';
import { SELF_SESSION } from '../../live/study/select';
import { currentItems, planById } from '../../live/reducer';
import type { DemoState } from '../../live/types';
import { conceptById } from '../../scenario/knowledgeGraph';
import { Mark } from '../../teacher/parts';
import { OPTION_CLS } from './PracticeScreen';

/** Live practice: real taps on canned items, the chosen option's hint, and a worked rewrite after a correct answer. */
export function LivePractice({ state, onAnswer, onNext }: { state: DemoState; onAnswer(option: number): void; onNext(): void }) {
  const [steps, setSteps] = useState(0);
  const ph = state.phone;
  const plan = planById(state, ph.planId);
  const items = currentItems(state);
  const item = items[ph.item];
  const session = !ph.self && plan && ph.session !== null ? plan.sessions[ph.session] : null;
  if (!item || (!ph.self && !session)) return null;
  const right = ph.result === 'right';
  const guided = right ? item.guided : undefined;
  const total = ph.self ? SELF_SESSION : items.length;
  const last = ph.item + 1 >= total;
  const heading = session ? (session.isMasteryCheck ? 'Mastery check' : 'Guided practice') : `Practice · ${item.bloom}`;
  return (
    <div className="absolute inset-0 overflow-y-auto bg-egg-bg px-5 pb-8 pt-14 font-sans text-egg-ink">
      <div className="flex items-center justify-between text-[13px] text-egg-mute">
        <span>{`${heading} · ${conceptById(item.concept).label}`}</span>
        <span>{`${ph.item + 1} / ${total}`}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-egg-line">
        <div className="h-full rounded-full bg-egg-accent" style={{ width: `${((ph.item + (right ? 1 : 0)) / total) * 100}%` }} />
      </div>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-egg-ink [text-wrap:balance]">{item.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {item.options.map((o, i) => {
          const look = right && i === item.correct ? 'right' : ph.result === 'wrong' && i === ph.lastOption ? 'wrong' : 'idle';
          return (
            <button
              key={i}
              type="button"
              disabled={right}
              onClick={() => onAnswer(i)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-[13px] text-left font-mono text-[18px] text-egg-ink ${OPTION_CLS[look]}`}
            >
              {o}
              {look === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {look === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </button>
          );
        })}
      </div>
      {ph.result === 'wrong' && ph.lastOption !== null && (
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{item.hints[ph.lastOption]}</div>
        </div>
      )}
      {guided && (
        <div className="mt-4">
          <div className="rounded-2xl border border-egg-line bg-egg-card p-4 font-mono text-[18px]">{guided.start}</div>
          {guided.steps.slice(0, steps).map((s, i) => (
            <div key={s.expr} className="mt-3 rounded-2xl border border-egg-line bg-egg-card p-4">
              <div className="font-mono text-[12px] text-egg-mute">{`Step ${i + 1} · ${s.why}`}</div>
              <div className="mt-1 font-mono text-[18px]">{`≡ ${s.expr}`}</div>
            </div>
          ))}
          {steps < guided.steps.length ? (
            <button type="button" onClick={() => setSteps((n) => n + 1)} className="mt-3 w-full rounded-full border border-egg-ink py-2.5 text-[14px] font-semibold">
              Show the next step
            </button>
          ) : (
            <div className="mt-3 rounded-2xl bg-egg-sage-tint p-3 text-center text-[15px] font-semibold text-egg-sage">
              {`Nice work · ${guided.steps.length} / ${guided.steps.length} steps`}
            </div>
          )}
        </div>
      )}
      {right && (
        <button type="button" onClick={onNext} className="mt-5 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">
          {last ? (session ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Finish practice') : 'Next'}
        </button>
      )}
    </div>
  );
}
