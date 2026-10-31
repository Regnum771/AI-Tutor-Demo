import { countUp, fade, prog, pulse, stepIndex } from '../../engine/anim';
import { JOINT_DECISION_2, REASSESSMENT } from '../../scenario/agents';
import { DELTAS, MASTERY_MID, MASTERY_POST, MINH_ANH, REMAINING_GAP, lerpMastery } from '../../scenario/minhAnh';
import { PATHWAY_UPDATED, STATUSES } from '../../scenario/orchestration';
import { CUES } from '../../scenario/scenes';
import { MessageCard } from '../../ui/MessageCard';
import { PhoneGlyph } from '../../ui/PhoneGlyph';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { TwinPanel } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { SimChart } from '../adapt/SimChart';
import { AgentStage } from '../agents/AgentStage';
import { JointDecision } from '../agents/JointDecision';
import { activeHighlights, latestReceived } from '../agents/highlights';
import type { SceneProps } from './types';

const PHASE_B = 15000;
const SIM_T = 7000;
const SELECT_T = 12000;
const RE_T = [16500, 18800];
const JOINT_T = 21500;
const SIGN_T: [number, number] = [22200, 22600];
const PIPE_T = [24000, 24600, 25200, 25800, CUES.sc10Update, 27600];

export function Sc10Adapt({ t }: SceneProps) {
  const a = 1 - prog(t, PHASE_B, 1000);
  const b = prog(t, PHASE_B, 1000);
  const mastery = lerpMastery(MASTERY_MID, MASTERY_POST, prog(t, 1000, 3000));
  const hi = activeHighlights(REASSESSMENT, RE_T, t);
  const toTas = latestReceived(REASSESSMENT, RE_T, 'TAS', t);
  const toSas = latestReceived(REASSESSMENT, RE_T, 'SAS', t);
  const pipe = t >= PIPE_T[0];
  return (
    <div className="absolute inset-0 bg-deep">
      {a > 0 && (
        <div className="absolute inset-0" style={{ opacity: a }}>
          <div className="absolute" style={{ left: 40, top: 110 }}>
            <TwinPanel mastery={mastery} stateLabel="Updated · mastery assessment" glow={pulse(t, [1000], 1500)} highlight={t < 4500 ? ['mastery'] : ['gaps']} gapIds={['equivLaws', 'applications']} assessment={`Mastery check · ${MINH_ANH.scoreAfter}% (was ${MINH_ANH.scoreNow}%)`} />
          </div>
          <div className="absolute rounded-2xl border-2 p-5" style={{ left: 960, top: 110, width: 920, height: 440, borderColor: C.twin, background: C.panel }}>
            <div className="flex items-center justify-between">
              <span className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.twin }}>New evidence · before → after</span>
              <span className="font-display text-[44px] font-extrabold text-ink">{countUp(MINH_ANH.scoreNow, MINH_ANH.scoreAfter, t, 1200, 1800)}%</span>
            </div>
            {DELTAS.map((d, i) => (
              <div key={d.label} className="mt-2 flex items-center text-[20px]" style={{ opacity: fade(t, 1500 + i * 450) }}>
                <span className="w-80 text-ink">{d.label}</span>
                <span className="w-24 font-mono text-dim">{d.before}</span>
                <span className="w-10 text-dim">→</span>
                <span className="font-mono font-bold" style={{ color: C.mastered }}>{d.after}</span>
              </div>
            ))}
            <div className="mt-3 inline-block rounded-lg px-3 py-1 text-[18px]" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap, opacity: fade(t, 4200) }}>Remaining gap · {REMAINING_GAP}</div>
          </div>
          <div className="absolute" style={{ left: 960, top: 570 }}>
            <SimChart t={t} start={SIM_T} selectAt={SELECT_T} />
          </div>
        </div>
      )}

      {b > 0 && (
        <div className="absolute inset-0" style={{ opacity: b }}>
          <AgentStage
            t={t}
            sasStatus={t < RE_T[0] ? 'reading updated twin…' : t < JOINT_T ? 'reassessing learner…' : 'decision signed'}
            tasStatus={t < RE_T[1] ? 'evaluating observed response…' : t < JOINT_T ? 'adapting strategy…' : 'decision signed'}
            sasPulse={pulse(t, [RE_T[1] + 1200], 700)}
            tasPulse={pulse(t, [RE_T[0] + 1200], 700)}
            twinMastery={MASTERY_POST}
            twinHighlight={hi.twin}
            kgMastery={MASTERY_POST}
            kgHighlight={hi.kg}
            tokens={REASSESSMENT.map((c, i) => ({ at: RE_T[i], from: c.from, label: c.type }))}
          />
          {toTas && t < JOINT_T && <MessageCard card={toTas.card} style={{ position: 'absolute', left: 1380, top: 470, opacity: fade(t, toTas.arrived) }} />}
          {toSas && t < JOINT_T && <MessageCard card={toSas.card} style={{ position: 'absolute', left: 60, top: 470, opacity: fade(t, toSas.arrived) }} />}
          <JointDecision t={t} steps={JOINT_DECISION_2} at={JOINT_T} signAt={SIGN_T} exitAt={23400} />
          {pipe && (
            <div className="absolute rounded-2xl border-2 p-5" style={{ left: 300, top: 790, width: 1320, borderColor: C.engine, background: C.panel, opacity: fade(t, PIPE_T[0]) }}>
              <div className="font-display text-[20px] font-bold text-ink">Orchestration engine · re-run · {JOINT_DECISION_2.join(' → ')}</div>
              <div className="mt-3"><PipelineStatus statuses={STATUSES} reached={stepIndex(t, PIPE_T) + 1} /></div>
              {t >= CUES.sc10Update && (
                <div className="mt-3 flex flex-wrap items-center gap-3" style={{ opacity: fade(t, CUES.sc10Update) }}>
                  <span className="font-display text-[20px] font-bold" style={{ color: C.engine }}><PhoneGlyph />Updated pathway delivered</span>
                  {PATHWAY_UPDATED.map((p) => <span key={p.title} className="rounded-lg px-3 py-1 text-[17px] text-ink" style={{ background: C.surface }}>{p.when} · {p.title}</span>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
