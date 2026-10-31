import { fade } from '../../engine/anim';
import { PATHWAY_INITIAL, PATHWAY_UPDATED, PLAN_OBJECTIVES, PLAN_OBJECTIVES_UPDATED } from '../../scenario/orchestration';
import { C } from '../../ui/tokens';

/** Greeting derived from the displayed clock (HH:MM): morning before 12:00, afternoon before 18:00, evening after. */
export const greetingFor = (clock: string): string => {
  const h = Number(clock.split(':')[0]);
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export function PlanScreen({ local, variant, clock = '17:00' }: { local: number; variant: 'initial' | 'updated'; clock?: string }) {
  const items = variant === 'initial' ? PATHWAY_INITIAL : PATHWAY_UPDATED;
  const objectives = variant === 'initial' ? PLAN_OBJECTIVES : PLAN_OBJECTIVES_UPDATED;
  return (
    <div className="absolute inset-0 bg-slate-50 px-5 pt-14 font-sans">
      <div className="text-[15px] text-slate-500">{greetingFor(clock)},</div>
      <div className="text-[26px] font-bold text-slate-900">Minh Anh</div>
      {variant === 'updated' && (
        <div className="mt-3 rounded-2xl px-4 py-2 text-[14px] font-semibold" style={{ background: '#EDE9FE', color: '#6D28D9', opacity: fade(local, 100) }}>
          Plan updated · based on your progress
        </div>
      )}
      <div className="mt-4 rounded-3xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${C.royal}, #1E3A8A)` }}>
        <div className="text-[12px] uppercase tracking-wider text-white/70">Your personalized learning plan</div>
        <div className="mt-1 font-display text-[21px] font-bold">Discrete Mathematics</div>
        <div className="text-[15px] text-white/85">Topic: Logical Equivalence</div>
        <div className="mt-3 flex gap-2">
          {objectives.map((o) => <span key={o} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">{o}</span>)}
        </div>
      </div>
      <div className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
        {variant === 'initial' ? 'Learning pathway · today' : 'Next steps · tomorrow'}
      </div>
      {items.map((it, i) => {
        const o = fade(local, 300 + i * 250);
        const done = variant === 'initial' && i < 2;
        return (
          <div key={it.title} className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm" style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)` }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white" style={done ? { background: '#DCFCE7', color: '#15803D' } : { background: C.royal }}>{done ? '✓' : i + 1}</span>
            <div>
              <div className="text-[16px] font-semibold text-slate-900">{it.title}</div>
              <div className="text-[13px] text-slate-500">{it.when} · {it.mins} min</div>
            </div>
            {i === (variant === 'initial' ? 2 : 0) && <span className="ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: '#EEF2FF', color: C.royal }}>Up next</span>}
          </div>
        );
      })}
    </div>
  );
}
