import { countUp, fade, prog } from '../../engine/anim';
import { EFFECTIVENESS, KPIS_AFTER, OUTCOMES_AFTER, PORTFOLIO_AFTER, SCALE_STUDENTS, STUDENTS, kpis, portfolio } from '../../scenario/classroom';
import { MINH_ANH } from '../../scenario/minhAnh';
import { Camera, type CamKey } from '../../ui/Camera';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { tileCenter } from '../../ui/StudentGrid';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const ma = tileCenter(MINH_ANH.index);
const CAM: CamKey[] = [
  { t: 0, x: ma.x, y: ma.y, zoom: 5 },
  { t: 700, x: ma.x, y: ma.y, zoom: 5 },
  { t: 3600, x: 960, y: 540, zoom: 1 },
];
const ROW_T = (i: number) => 4000 + i * 500;
const OUTCOME_T = 7500;
const BAR_T = (i: number) => 9000 + i * 500;
const KPI_T = 11000;

export function Sc11Scale({ t }: SceneProps) {
  const k = kpis();
  const pf = portfolio();
  const labels: Record<number, string> = {};
  SCALE_STUDENTS.forEach((s, i) => { if (t >= ROW_T(i)) labels[s.index] = s.letter; });
  const outcomes = [
    { label: 'Improved learning', value: OUTCOMES_AFTER.improved, color: C.mastered },
    { label: 'Require adjustment', value: OUTCOMES_AFTER.adjust, color: C.gold },
    { label: 'Teacher attention', value: OUTCOMES_AFTER.teacherAttention, color: C.gap },
  ];
  const right = (
    <>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 280, width: 740, height: 360, borderColor: C.twin, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.twin }}>Coordinated interventions · in parallel</div>
        {SCALE_STUDENTS.map((s, i) => (
          <div key={s.letter} className="mt-3 flex items-center gap-3" style={{ opacity: fade(t, ROW_T(i)) }}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: C.twin, color: C.deep }}>{s.letter}</span>
            <span className="w-44 truncate font-sans text-[17px] text-ink">{STUDENTS[s.index].name}</span>
            <span className="text-[17px]" style={{ color: C.twin }}>{s.need}</span>
            <span className="text-dim">→</span>
            <span className="rounded-lg px-2 py-0.5 text-[17px] text-ink" style={{ background: C.surface }}>{s.intervention}</span>
          </div>
        ))}
      </div>
      <div className="absolute rounded-2xl border-2 p-5" style={{ left: 1140, top: 660, width: 740, height: 380, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Class intervention report · updated</div>
        <div className="mt-3 flex gap-10">
          {outcomes.map((o) => (
            <div key={o.label}>
              <div className="font-display text-[52px] font-extrabold leading-none" style={{ color: o.color }}>{countUp(0, o.value, t, OUTCOME_T)}</div>
              <div className="mt-1 text-[17px] text-dim">{o.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {EFFECTIVENESS.map((e, i) => (
            <div key={e.label} className="flex items-center gap-3">
              <span className="w-64 text-[17px] text-ink">{e.label}</span>
              <div className="h-3 flex-1 rounded-full" style={{ background: C.surface }}>
                <div className="h-full rounded-full" style={{ width: `${e.value * prog(t, BAR_T(i), 900)}%`, background: C.tas }} />
              </div>
              <span className="w-12 text-right font-mono text-[17px] text-ink">{countUp(0, e.value, t, BAR_T(i), 900)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-3 font-mono text-[16px] text-dim">
          Routine {countUp(pf.routine, PORTFOLIO_AFTER.routine, t, 10500)} · Adaptive {countUp(pf.adaptive, PORTFOLIO_AFTER.adaptive, t, 10500)} · Complex {countUp(pf.complex, PORTFOLIO_AFTER.complex, t, 10500)}
        </div>
      </div>
      <FullSvg>
        {SCALE_STUDENTS.map((s, i) => (
          <ParticleStream key={s.letter} t={t} from={tileCenter(s.index)} to={{ x: 1140, y: 760 }} via={{ x: 1130, y: tileCenter(s.index).y }} start={6500 + i * 200} count={8} gap={700} travel={1200} kinds={['interaction', 'structured']} />
        ))}
      </FullSvg>
    </>
  );
  return (
    <Camera t={t} keys={CAM}>
      <CommandFrame
        t={t}
        gridMode="twin"
        highlight={SCALE_STUDENTS.filter((_, i) => t >= ROW_T(i)).map((s) => s.index)}
        labels={labels}
        kpis={{ total: k.total, needSupport: countUp(k.needSupport, KPIS_AFTER.needSupport, t, KPI_T), highRisk: countUp(k.highRisk, KPIS_AFTER.highRisk, t, KPI_T) }}
        right={right}
      />
    </Camera>
  );
}
