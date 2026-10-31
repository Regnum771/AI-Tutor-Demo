import { fade, prog, pulse, stepIndex, typed } from '../../engine/anim';
import { SAS_DIAGNOSIS, SAS_READS, TAS_ANALYSIS } from '../../scenario/agents';
import { MASTERY_INITIAL } from '../../scenario/minhAnh';
import type { TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { AgentStage } from '../agents/AgentStage';
import type { SceneProps } from './types';

const SAS_READ_T = SAS_READS.map((_, i) => 1500 + i * 550);
const SAS_CARD_T = 3800;
const TAS_READ_T = TAS_ANALYSIS.reads.map((_, i) => 5000 + i * 450);
const TAS_CARD_T = 7800;

function sasStatus(t: number): string {
  const i = stepIndex(t, SAS_READ_T);
  if (i < 0) return 'initialising…';
  if (t < 4800) return `reading twin.${SAS_READS[i]}…`;
  return t < 7500 ? 'writing diagnosis…' : 'diagnosis ready';
}

function tasStatus(t: number): string {
  const i = stepIndex(t, TAS_READ_T);
  if (i < 0) return 'listening to SAS…';
  if (t < 7600) return `reading ${TAS_ANALYSIS.reads[i].toLowerCase()}…`;
  return t < 11500 ? 'composing strategy…' : 'strategy ready';
}

export function Sc05Reason({ t }: SceneProps) {
  const readIdx = stepIndex(t, SAS_READ_T);
  const twinHighlight: TwinKey[] = readIdx >= 0 && t < 4800 ? [SAS_READS[readIdx]] : [];
  return (
    <div className="absolute inset-0 bg-deep">
      <AgentStage
        t={t}
        sasStatus={sasStatus(t)}
        tasStatus={tasStatus(t)}
        sasPulse={pulse(t, SAS_READ_T, 400)}
        tasPulse={pulse(t, TAS_READ_T, 400)}
        twinMastery={MASTERY_INITIAL}
        twinHighlight={twinHighlight}
        kgMastery={t >= 3000 ? { implication: MASTERY_INITIAL.implication } : {}}
        kgHighlight={t >= 3000 ? ['implication'] : []}
        retrieval={{ sas: t >= 1500 && t < 4800 ? 1 : 0.35, tas: t >= 5000 && t < 7600 ? 1 : 0.35 }}
        tokens={[{ at: 5600, from: 'SAS', label: 'partial diagnosis' }, { at: 7600, from: 'SAS', label: 'DIAGNOSIS' }]}
      />

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 60, top: 470, width: 500, height: 570, borderColor: C.sas, background: C.panel, opacity: fade(t, SAS_CARD_T) }}>
        <div className="font-display text-[24px] font-extrabold" style={{ color: C.sas }}>SAS · Student Diagnosis</div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Identified learning gap</div>
        <div className="mt-1 min-h-[56px] text-[21px] font-semibold text-ink">{typed(SAS_DIAGNOSIS.gap, t, SAS_CARD_T + 300, 45)}</div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Supporting evidence</div>
        {SAS_DIAGNOSIS.evidence.map((e, i) => (
          <div key={e} className="mt-1 text-[18px] text-ink" style={{ opacity: fade(t, SAS_CARD_T + 1500 + i * 500) }}>• {e}</div>
        ))}
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Learning state</div>
        <div className="mt-1 text-[19px]" style={{ color: C.sas, opacity: fade(t, 6300) }}>{SAS_DIAGNOSIS.state}</div>
      </div>

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1360, top: 470, width: 500, height: 570, borderColor: C.tas, background: C.panel, opacity: fade(t, 5000) }}>
        <div className="font-display text-[24px] font-extrabold" style={{ color: C.tas }}>TAS · Instructional Analysis</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAS_ANALYSIS.reads.map((r, i) => (
            <span key={r} className="rounded-md px-2 py-0.5 text-[15px]" style={{ background: C.surface, color: t >= TAS_READ_T[i] ? C.tas : C.dim }}>
              {t >= TAS_READ_T[i] ? '✓ ' : ''}{r}
            </span>
          ))}
        </div>
        <div className="mt-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Instructional recommendation</div>
        <div className="mt-1 min-h-[84px] text-[20px] font-semibold text-ink">{typed(TAS_ANALYSIS.recommendation, t, TAS_CARD_T + 300, 45)}</div>
        <div className="mt-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">Proposed approach</div>
        {TAS_ANALYSIS.approach.map((a, i) => (
          <div key={a} className="mt-1 text-[18px] text-ink" style={{ opacity: fade(t, 9300 + i * 500) }}>{i + 1}. {a}</div>
        ))}
      </div>

      <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 120px rgba(52,211,153,${0.15 * prog(t, 12500, 800)})`, pointerEvents: 'none' }} />
    </div>
  );
}
