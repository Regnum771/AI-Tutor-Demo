import { countUp, fade, prog, pulse } from '../../engine/anim';
import { kpis } from '../../scenario/classroom';
import { MINH_ANH } from '../../scenario/minhAnh';
import { EVIDENCE_ITEMS } from '../../scenario/sources';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleShape, ParticleStream } from '../../ui/ParticleStream';
import { tileCenter } from '../../ui/StudentGrid';
import { C } from '../../ui/tokens';
import { CommandFrame } from '../command/CommandFrame';
import type { SceneProps } from './types';

const ITEM_T = (i: number) => 1500 + i * 1300;
const ITEM_Y = (i: number) => 350 + i * 128;
const PROFILE_T = 10000;
const CURSOR: CursorKey[] = [
  { t: 8400, x: 1500, y: 980 },
  { t: 9700, x: 586, y: 488, click: true },
  { t: 11000, x: 700, y: 620 },
];
const PROFILE_ROWS = [
  { label: 'Assessment performance', value: `${MINH_ANH.scorePrev}% → ${MINH_ANH.scoreNow}%` },
  { label: 'Incomplete learning activities', value: String(MINH_ANH.incompleteActivities) },
  { label: 'Repeated conceptual errors', value: 'Implication · chose q → p ×6' },
  { label: 'Prerequisite mastery', value: 'Weak · propositional logic' },
];

export function Sc03Perceive({ t, cursor }: SceneProps) {
  const k = kpis();
  const target = tileCenter(MINH_ANH.index);
  const beats = EVIDENCE_ITEMS.map((_, i) => ITEM_T(i) + 1800);
  const profile = prog(t, PROFILE_T, 600);
  const right = (
    <>
      <div className="absolute rounded-2xl border-2" style={{ left: 1140, top: 280, width: 740, height: 760, borderColor: C.cyan, background: C.panel }}>
        <div className="px-6 pt-4 font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.cyan }}>Multimodal ingestion · live</div>
      </div>
      {EVIDENCE_ITEMS.map((item, i) => {
        const o = fade(t, ITEM_T(i));
        const ev = fade(t, ITEM_T(i) + 700);
        return (
          <div key={item.raw} className="absolute" style={{ left: 1164, top: ITEM_Y(i), width: 692, opacity: o }}>
            <div className="flex items-center gap-3">
              <svg width={24} height={24}><ParticleShape kind={item.kind} x={12} y={12} color={C.cyan} /></svg>
              <span className="text-[16px] font-semibold text-dim">{item.source}</span>
            </div>
            <div className="mt-1 truncate font-sans text-[17px] text-dim">{item.raw}</div>
            <div className="mt-1 inline-block rounded-lg border-2 px-3 py-1 text-[18px] text-ink" style={{ borderColor: C.cyan, opacity: ev }}>→ {item.evidence}</div>
          </div>
        );
      })}
      <FullSvg>
        {EVIDENCE_ITEMS.map((item, i) => (
          <ParticleStream key={item.raw} t={t} from={{ x: 1164, y: ITEM_Y(i) + 90 }} to={target} via={{ x: 900, y: ITEM_Y(i) }} start={ITEM_T(i) + 900} count={3} gap={150} travel={900} kinds={[item.kind]} />
        ))}
      </FullSvg>
      {profile > 0 && (
        <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1140 + (1 - profile) * 200, top: 280, width: 740, height: 760, opacity: profile, borderColor: C.gap, background: C.panel, zIndex: 20 }}>
          <div className="font-sans text-[32px] font-bold text-ink">{MINH_ANH.name}</div>
          <div className="mt-1 text-[19px] text-dim">{MINH_ANH.course} · Topic: {MINH_ANH.topic}</div>
          <span className="mt-4 inline-block rounded-full px-4 py-1 text-[17px] font-semibold" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap }}>Emerging learning concern</span>
          <div className="mt-6 space-y-5">
            {PROFILE_ROWS.map((r, i) => (
              <div key={r.label} style={{ opacity: fade(t, PROFILE_T + 400 + i * 400) }}>
                <div className="text-[17px] text-dim">{r.label}</div>
                <div className="font-display text-[28px] font-bold text-ink">{r.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-[20px] font-semibold" style={{ color: C.twin, opacity: fade(t, 12500) }}>Opening learning digital twin →</div>
        </div>
      )}
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 8400 && t < 12000} />
    </>
  );
  const flagged = t >= 8200 || pulse(t, beats, 700) > 0;
  return (
    <CommandFrame
      t={t}
      gridMode="status"
      highlight={flagged ? [MINH_ANH.index] : []}
      gridReveal={prog(t, 0, 1200)}
      kpis={{ total: countUp(0, k.total, t, 300), needSupport: countUp(0, k.needSupport, t, 400), highRisk: countUp(0, k.highRisk, t, 500) }}
      right={right}
    />
  );
}
