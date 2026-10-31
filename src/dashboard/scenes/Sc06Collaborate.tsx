import { fade, pulse } from '../../engine/anim';
import { EXCHANGES, JOINT_DECISION, PLAN_ADDED, PLAN_DRAFT, SAS_CHECKS } from '../../scenario/agents';
import { MASTERY_INITIAL } from '../../scenario/minhAnh';
import { MessageCard } from '../../ui/MessageCard';
import { C } from '../../ui/tokens';
import { AgentStage } from '../agents/AgentStage';
import { JointDecision } from '../agents/JointDecision';
import { TOKEN_MS, activeHighlights, latestReceived, revealedMastery } from '../agents/highlights';
import type { SceneProps } from './types';

const EX_T = [1500, 6500, 11500, 16000];
const CHECK_T = [8000, 8700, 9400];
const DROP_T = 13200;
const ADD_T = 15200;
const JOINT_T = 20000;
const SIGN_T: [number, number] = [20800, 21300];
const EXIT_T = 23200;

function Received({ t, to, left }: { t: number; to: 'SAS' | 'TAS'; left: number }) {
  const r = latestReceived(EXCHANGES, EX_T, to, t);
  if (!r || t >= JOINT_T) return null;
  return <MessageCard card={r.card} style={{ position: 'absolute', left, top: 470, opacity: fade(t, r.arrived, Infinity, 300) }} />;
}

export function Sc06Collaborate({ t }: SceneProps) {
  const hi = activeHighlights(EXCHANGES, EX_T, t);
  const arrivals = EX_T.map((x) => x + TOKEN_MS);
  const sasArrivals = arrivals.filter((_, i) => EXCHANGES[i].to === 'SAS');
  const tasArrivals = arrivals.filter((_, i) => EXCHANGES[i].to === 'TAS');
  const tasStatus = t < arrivals[0] ? 'listening…' : t < EX_T[1] ? 'drafting proposal…' : t < arrivals[2] ? 'awaiting evaluation…' : t < EX_T[3] ? 'refining plan…' : 'plan refined';
  const sasStatus = t < EX_T[0] ? 'sending diagnosis…' : t < arrivals[1] ? 'awaiting proposal…' : t < EX_T[2] ? 'evaluating against twin + KG…' : t < arrivals[3] ? 'awaiting refinement…' : 'refinement accepted';
  return (
    <div className="absolute inset-0 bg-deep">
      <AgentStage
        t={t}
        sasStatus={sasStatus}
        tasStatus={tasStatus}
        sasPulse={pulse(t, sasArrivals, 700)}
        tasPulse={pulse(t, tasArrivals, 700)}
        twinMastery={MASTERY_INITIAL}
        twinHighlight={hi.twin}
        kgMastery={revealedMastery(EXCHANGES, EX_T, t, MASTERY_INITIAL)}
        kgHighlight={hi.kg}
        retrieval={{ sas: t >= arrivals[1] && t < EX_T[2] ? 1 : 0.35, tas: t >= arrivals[2] && t < EX_T[3] ? 1 : 0.35 }}
        tokens={EXCHANGES.map((c, i) => ({ at: EX_T[i], from: c.from, label: c.type }))}
      />

      <Received t={t} to="SAS" left={60} />
      <Received t={t} to="TAS" left={1380} />

      {t < JOINT_T && (
        <>
          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 60, top: 760, width: 480, height: 280, borderColor: C.sas, background: C.panel }}>
            <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.sas }}>SAS · evaluation</div>
            {t < arrivals[1] && <div className="mt-3 text-[18px] text-dim">Diagnosis sent · awaiting proposal</div>}
            {SAS_CHECKS.map((c, i) => {
              const m = MASTERY_INITIAL[c.concept];
              const ok = m >= 0.7;
              return (
                <div key={c.concept} className="mt-3 flex items-center justify-between text-[19px]" style={{ opacity: fade(t, CHECK_T[i]) }}>
                  <span className="font-mono text-ink">{c.label}</span>
                  <span className="font-mono" style={{ color: ok ? C.mastered : C.gap }}>{m.toFixed(2)} {ok ? '✓ mastered' : '✗ gap'}</span>
                </div>
              );
            })}
            <div className="mt-3 text-[18px] font-semibold" style={{ color: C.sas, opacity: fade(t, arrivals[3]) }}>Refinement accepted ✓</div>
          </div>

          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1380, top: 760, width: 480, height: 280, borderColor: C.tas, background: C.panel }}>
            <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.tas }}>TAS · intervention plan</div>
            {PLAN_DRAFT.map((p, i) => {
              const dropped = p.drop && t >= DROP_T;
              return (
                <div key={p.text} className="mt-3 text-[19px]" style={{ opacity: fade(t, arrivals[0] + 800 + i * 400) * (dropped ? 0.4 : 1), color: dropped ? C.dim : C.ink, textDecoration: dropped ? 'line-through' : 'none' }}>
                  {i + 1}. {p.text}
                </div>
              );
            })}
            <div className="mt-3 text-[19px] font-semibold" style={{ color: C.tas, opacity: fade(t, ADD_T) }}>+ {PLAN_ADDED}</div>
          </div>
        </>
      )}

      <JointDecision t={t} steps={JOINT_DECISION} at={JOINT_T} signAt={SIGN_T} exitAt={EXIT_T} />
      <div className="absolute font-display text-[24px] font-bold text-ink" style={{ right: 60, top: 1000, opacity: fade(t, 22500) }}>→ Intervention Orchestration Engine</div>
    </div>
  );
}
