import type { ReactNode } from 'react';
import { fade, stepIndex } from '../../engine/anim';
import { RESOURCES } from '../../scenario/agents';
import {
  ACTIVITIES, ENGINE_INPUTS, EXPECTED_OUTCOME, MONITORING_CRITERIA, OPERATIONS, PATHWAY_INITIAL, RETRIEVED, STATUSES,
} from '../../scenario/orchestration';
import { CUES } from '../../scenario/scenes';
import { AgentPair } from '../../ui/AgentPair';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const OP_T = [4000, 6500, 9500, 12500, 15500, 19000];
const STATUS_T = [4000, 7500, 13500, 16500, CUES.sc7Delivered, 21500];
const INPUT_COLORS = [C.sas, C.tas, C.twin, C.royal, C.dim, C.gold];
const inputY = (i: number) => 230 + i * 105;
const opY = (i: number) => 150 + i * 125;

function Visual({ t, op }: { t: number; op: number }) {
  const list = (items: string[], start: number, render: (s: string) => ReactNode) =>
    items.map((s, i) => (
      <div key={s} className="mt-3 rounded-xl border-2 px-4 py-3 text-[18px] text-ink" style={{ borderColor: C.line, background: C.surface, opacity: fade(t, start + i * 400) }}>{render(s)}</div>
    ));
  switch (op) {
    case 0:
      return (
        <div className="rounded-xl border-2 p-4" style={{ borderColor: C.gold }}>
          <div className="font-display text-[20px] font-bold" style={{ color: C.gold }}>Policy check</div>
          <div className="mt-2 text-[18px] text-ink">Adaptive track · within teacher policy → auto-execute ✓</div>
          <div className="mt-1 text-[18px] text-dim">Escalation: not required</div>
        </div>
      );
    case 1:
      return <>{list(RETRIEVED, OP_T[1] + 200, (id) => RESOURCES[id])}</>;
    case 2:
      return <>{list(ACTIVITIES, OP_T[2] + 200, (a) => a)}</>;
    case 3:
      return <>{list(PATHWAY_INITIAL.map((p) => p.title), OP_T[3] + 200, (s) => <span>⟶ {s}</span>)}</>;
    case 4:
      return (
        <>
          {list(PATHWAY_INITIAL.map((p) => `${p.when} · ${p.title}`), OP_T[4] + 200, (s) => s)}
          <div className="mt-4 font-display text-[20px] font-bold" style={{ color: C.engine, opacity: fade(t, CUES.sc7Delivered) }}>📱 Delivered to Minh Anh's student app</div>
        </>
      );
    default:
      return (
        <>
          <div className="text-[18px] text-dim">Expected outcome</div>
          <div className="text-[19px] text-ink">{EXPECTED_OUTCOME}</div>
          <div className="mt-4 text-[18px] text-dim">Monitoring criteria</div>
          {list(MONITORING_CRITERIA, OP_T[5] + 200, (s) => s)}
          <div className="mt-4 font-display text-[18px] font-bold" style={{ color: C.engine }}>📱 Delivered to Minh Anh's student app</div>
        </>
      );
  }
}

export function Sc07Orchestrate({ t }: SceneProps) {
  const op = stepIndex(t, OP_T);
  const reached = stepIndex(t, STATUS_T) + 1;
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left: 470, top: 36 }}>
        <div className="font-display text-[34px] font-extrabold text-ink">Intervention Orchestration Engine</div>
        <div className="text-[19px] text-dim">Agent decisions → executable workflows</div>
      </div>

      <AgentPair t={t} x={110} y={110} gap={180} r={34} />
      <FullSvg>
        <Conduit d="M200 150 C 260 190, 380 150, 470 170" color={C.engine} t={t} />
        {ENGINE_INPUTS.map((_, i) => (
          <ParticleStream key={i} t={t} from={{ x: 400, y: inputY(i) + 30 }} to={{ x: 470, y: 520 }} start={2500 + i * 150} count={5} gap={300} travel={900} color={INPUT_COLORS[i]} />
        ))}
      </FullSvg>

      {ENGINE_INPUTS.map((label, i) => (
        <div key={label} className="absolute rounded-xl border-2 px-4 py-3 text-[18px] font-semibold text-ink" style={{ left: 40, top: inputY(i), width: 360, borderColor: INPUT_COLORS[i], background: C.panel, opacity: fade(t, 500 + i * 300) }}>
          {label}
        </div>
      ))}

      {OPERATIONS.map((o, i) => {
        const done = i < op;
        const current = i === op;
        return (
          <div key={o.id} className="absolute flex items-center gap-4 rounded-2xl border-2 px-5" style={{ left: 470, top: opY(i), width: 860, height: 110, borderColor: done || current ? C.engine : C.line, background: C.panel, boxShadow: current ? '0 0 28px rgba(255,255,255,0.45)' : 'none', opacity: fade(t, 1500 + i * 150) }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[22px] font-extrabold" style={{ background: done || current ? C.engine : C.surface, color: C.deep }}>{done ? '✓' : i + 1}</span>
            <div>
              <div className="font-display text-[24px] font-bold text-ink">{o.title}</div>
              <div className="text-[18px] text-dim" style={{ opacity: done || current ? 1 : 0.4 }}>{o.detail}</div>
            </div>
          </div>
        );
      })}

      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1370, top: 150, width: 510, height: 735, borderColor: C.line, background: C.panel }}>
        {op >= 0 && <Visual t={t} op={op} />}
      </div>

      <div className="absolute" style={{ left: 40, top: 935 }}>
        <PipelineStatus statuses={STATUSES} reached={reached} />
      </div>
    </div>
  );
}
