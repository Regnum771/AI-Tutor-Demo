import { useState } from 'react';
import { currentItems, planById, slotCount } from '../../live/reducer';
import type { DemoState } from '../../live/types';
import { conceptById } from '../../scenario/knowledgeGraph';
import { Mark } from '../../teacher/parts';
import { dotState, questionsLeft, type DotState } from '../liveView';
import { OPTION_CLS } from './PracticeScreen';

const DOT: Record<DotState, string> = {
  empty: 'border-egg-line bg-egg-line text-egg-mute',
  tried: 'border-egg-ink text-egg-ink',
  right: 'border-egg-sage bg-egg-sage text-egg-card',
};
const PRIMARY = 'flex-1 rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card';
const GHOST = 'flex-1 rounded-full border border-egg-ink py-3 text-[15px] font-semibold';

interface Props {
  state: DemoState;
  onAnswer(option: number): void;
  onNext(): void;
  onGoto(item: number): void;
  onAgain(): void;
  onFinish(): void;
}

/** Live practice: real taps on canned items, free movement between questions, every try kept, and a worked rewrite after a correct answer. */
export function LivePractice({ state, onAnswer, onNext, onGoto, onAgain, onFinish }: Props) {
  const [steps, setSteps] = useState(0);
  const ph = state.phone;
  const plan = planById(state, ph.planId);
  const item = currentItems(state)[ph.item];
  const q = ph.sheet[ph.item];
  const session = !ph.self && plan && ph.session !== null ? plan.sessions[ph.session] : null;
  if (!item || !q || (!ph.self && !session)) return null;
  const right = q.rightOn !== null;
  const answered = right && !q.reopened;
  const last = q.tries.at(-1);
  const lastWrong = !q.reopened && last !== undefined && last !== item.correct ? last : null;
  const look = (i: number) => {
    if (q.reopened) return 'idle';
    if (right && i === item.correct) return 'right';
    if (i === lastWrong || (!right && q.tries.includes(i))) return 'wrong';
    return 'idle';
  };
  const guided = answered ? item.guided : undefined;
  const total = slotCount(state);
  const left = questionsLeft(state);
  const heading = session ? (session.isMasteryCheck ? 'Mastery check' : 'Guided practice') : `Practice · ${item.bloom}`;
  const finish = session ? (session.isMasteryCheck ? 'Finish mastery check' : 'Finish session') : 'Finish practice';
  return (
    <div className="absolute inset-0 overflow-y-auto bg-egg-bg px-5 pb-8 pt-14 font-sans text-egg-ink">
      <div className="flex items-center justify-between text-[13px] text-egg-mute">
        <span>{`${heading} · ${conceptById(item.concept).label}`}</span>
        <span>{`${ph.item + 1} / ${total}`}</span>
      </div>
      <div className="mt-2 flex gap-2">
        {Array.from({ length: total }, (_, i) => {
          const dot = dotState(ph.sheet[i]);
          return (
            <button
              key={i}
              type="button"
              data-dot={dot}
              aria-label={`Question ${i + 1}`}
              aria-current={i === ph.item ? 'step' : undefined}
              disabled={i === ph.item}
              onClick={() => onGoto(i)}
              className={`h-8 w-8 rounded-full border text-[13px] font-semibold ${DOT[dot]} ${i === ph.item ? 'ring-2 ring-egg-accent ring-offset-1' : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-6 font-display text-[21px] font-bold leading-snug text-egg-ink [text-wrap:balance]">{item.prompt}</div>
      <div className="mt-4 space-y-2.5">
        {item.options.map((o, i) => {
          const mark = look(i);
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => onAnswer(i)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-[13px] text-left font-mono text-[18px] text-egg-ink ${OPTION_CLS[mark]}`}
            >
              {o}
              {mark === 'wrong' && <span className="font-sans text-[13px] font-semibold text-egg-brick">Not quite</span>}
              {mark === 'right' && <span className="font-sans text-[13px] font-semibold text-egg-sage">Correct!</span>}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 flex items-center justify-between text-[14px]">
          <span className="font-semibold text-egg-sage">{`Correct on try ${q.rightOn}`}</span>
          <button type="button" onClick={onAgain} className="font-semibold text-egg-mute underline underline-offset-4">Answer again</button>
        </div>
      )}
      {lastWrong !== null && (
        <div className="mt-4 rounded-2xl border border-egg-accent/40 bg-egg-tint p-4">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-egg-ink"><Mark size={12} />Hint</div>
          <div className="mt-1 text-[14px] leading-snug text-egg-ink">{item.hints[lastWrong]}</div>
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
      <div className="mt-5 flex gap-3">
        {ph.item > 0 && <button type="button" onClick={() => onGoto(ph.item - 1)} className={GHOST}>Back</button>}
        {ph.item + 1 < total ? (
          <button type="button" onClick={onNext} className={PRIMARY}>Next</button>
        ) : (
          <button type="button" onClick={onFinish} className={PRIMARY}>{left === 0 ? finish : `${left} question${left === 1 ? '' : 's'} left`}</button>
        )}
      </div>
    </div>
  );
}
