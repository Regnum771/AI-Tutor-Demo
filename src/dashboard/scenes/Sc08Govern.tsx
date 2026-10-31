import type { ReactNode } from 'react';
import { fade, prog } from '../../engine/anim';
import { JOINT_DECISION, SAS_DIAGNOSIS } from '../../scenario/agents';
import { POLICY_RULES, kpis, portfolio } from '../../scenario/classroom';
import { MINH_ANH, MASTERY_INITIAL } from '../../scenario/minhAnh';
import { EXPECTED_OUTCOME, MONITORING_CRITERIA, STATUSES } from '../../scenario/orchestration';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { PipelineStatus } from '../../ui/PipelineStatus';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const EDIT_T = 4300;
const DRAWER_T = 8600;
const CURSOR: CursorKey[] = [
  { t: 3000, x: 1200, y: 980 },
  { t: EDIT_T, x: 1760, y: 806, click: true },
  { t: 7000, x: 1500, y: 700 },
  { t: 8200, x: 586, y: 488, click: true },
  { t: 9500, x: 900, y: 650 },
];
const COLUMNS = [
  { key: 'routine', title: 'Routine', desc: 'Automatically delivered · monitored', color: C.engine },
  { key: 'adaptive', title: 'Adaptive', desc: 'Adjusted with new learning evidence', color: C.twin },
  { key: 'complex', title: 'Complex', desc: 'Persistent difficulty · teacher involvement', color: C.gold },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[15px] font-semibold uppercase tracking-[0.12em] text-dim">{title}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Sc08Govern({ t, cursor }: SceneProps) {
  const pf = portfolio();
  const edited = t >= EDIT_T + 300;
  const drawer = prog(t, DRAWER_T, 600);
  const right = (
    <>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 280, width: 740, height: 340, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Intervention portfolio</div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          {COLUMNS.map((c) => (
            <div key={c.key} className="rounded-xl border-2 p-4" style={{ borderColor: c.color }}>
              <div className="font-display text-[56px] font-extrabold leading-none" style={{ color: c.color }}>{pf[c.key]}</div>
              <div className="mt-2 font-display text-[22px] font-bold text-ink">{c.title}</div>
              <div className="mt-1 text-[16px] text-dim">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 640, width: 740, height: 400, borderColor: C.gold, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.gold }}>Intervention policy · teacher-defined</div>
        {POLICY_RULES.map((r) => {
          const changed = r.before !== r.after && edited;
          return (
            <div key={r.id} className="mt-3 flex items-center justify-between rounded-xl px-4" style={{ height: 80, background: C.surface, outline: changed ? `2px solid ${C.gold}` : 'none' }}>
              <span className="text-[18px] text-ink">{r.label}</span>
              <span className="rounded-lg border-2 px-3 py-1 font-mono text-[18px] font-bold" style={{ borderColor: C.gold, color: changed ? C.deep : C.gold, background: changed ? C.gold : 'transparent' }}>
                {edited ? r.after : r.before}
              </span>
            </div>
          );
        })}
        <div className="mt-4 text-[17px] font-semibold" style={{ color: C.gold, opacity: fade(t, EDIT_T + 500, 7600) }}>
          Policy updated · applies to {pf.routine + pf.adaptive + pf.complex} active interventions
        </div>
      </div>
      {drawer > 0 && (
        <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1140 + (1 - drawer) * 760, top: 100, width: 740, height: 940, opacity: drawer, borderColor: C.twin, background: C.panel, zIndex: 20 }}>
          <div className="font-display text-[28px] font-extrabold text-ink">Intervention summary</div>
          <div className="font-sans text-[19px] text-dim">{MINH_ANH.name} · adaptive track</div>
          <Section title="Digital twin state">
            <div className="text-[18px] text-ink">Implication {MASTERY_INITIAL.implication.toFixed(2)} · Equivalence {MASTERY_INITIAL.equivalence.toFixed(2)} · <span style={{ color: C.twin }}>monitoring</span></div>
          </Section>
          <Section title="Diagnosis (SAS)">
            <div className="text-[18px] text-ink">{SAS_DIAGNOSIS.gap}</div>
            {SAS_DIAGNOSIS.evidence.map((e) => <div key={e} className="text-[17px] text-dim">• {e}</div>)}
          </Section>
          <Section title="Intervention pathway">
            <div className="flex flex-wrap items-center gap-2 text-[17px]">
              {JOINT_DECISION.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-lg px-3 py-1 text-ink" style={{ background: C.surface }}>{s}</span>
                  {i < JOINT_DECISION.length - 1 && <span className="text-dim">→</span>}
                </span>
              ))}
            </div>
          </Section>
          <Section title="Execution status">
            <PipelineStatus statuses={STATUSES} reached={STATUSES.length} compact />
          </Section>
          <Section title="Expected outcome">
            <div className="text-[18px] text-ink">{EXPECTED_OUTCOME}</div>
          </Section>
          <Section title="Monitoring criteria">
            <div className="text-[18px] text-ink">{MONITORING_CRITERIA.join(' · ')}</div>
          </Section>
        </div>
      )}
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 3000 && t < 10000} />
    </>
  );
  return (
    <CommandFrame
      t={t}
      gridMode="track"
      highlight={t >= 8200 ? [MINH_ANH.index] : []}
      kpis={kpis()}
      kpiExtra={{ label: 'Active interventions', value: pf.routine + pf.adaptive + pf.complex, color: C.twin }}
      right={right}
    />
  );
}
