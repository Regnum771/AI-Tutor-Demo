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
