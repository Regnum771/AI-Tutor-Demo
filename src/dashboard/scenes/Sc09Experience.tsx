import { fade, prog, pulse } from '../../engine/anim';
import { MASTERY_INITIAL, MASTERY_MID, lerpMastery } from '../../scenario/minhAnh';
import { PATHWAY_INITIAL } from '../../scenario/orchestration';
import { SC9, SC9_EVIDENCE } from '../../scenario/practice';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleShape, ParticleStream } from '../../ui/ParticleStream';
import { TwinPanel } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const LATENCY = 400;
const arrive = SC9_EVIDENCE.map((e) => e.at + LATENCY);

export function Sc09Experience({ t }: SceneProps) {
  const f = arrive.reduce((sum, a) => sum + prog(t, a, 600), 0) / arrive.length;
  const mastery = lerpMastery(MASTERY_INITIAL, MASTERY_MID, f);
  const glow = pulse(t, arrive, 900);
  const step3Done = t >= SC9.progress;
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left: 40, top: 110 }}>
        <TwinPanel mastery={mastery} stateLabel="Live · student session" glow={glow} width={1000} highlight={glow > 0 ? ['mastery.implication'] : []} />
      </div>
      <div className="absolute rounded-2xl border-2 p-6" style={{ left: 1080, top: 110, width: 800, height: 930, borderColor: C.cyan, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: C.cyan }}>Live evidence · Minh Anh's device</div>
        <div className="mt-1 text-[18px] text-dim">Student app · guided practice session active</div>
        <div className="mt-5 space-y-3">
          {SC9_EVIDENCE.map((e, i) => (
            <div key={e.label} className="flex items-center gap-3 rounded-xl border-2 px-4 py-3" style={{ borderColor: C.cyan, opacity: fade(t, arrive[i]) }}>
              <svg width={24} height={24}><ParticleShape kind="interaction" x={12} y={12} color={C.cyan} /></svg>
              <span className="text-[19px] text-ink">{e.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Pathway progress</div>
        {PATHWAY_INITIAL.map((p, i) => {
          const done = i < 2 || (i === 2 && step3Done);
          const active = i === 2 && !step3Done;
          return (
            <div key={p.title} className="mt-3 flex items-center gap-3 text-[18px]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full font-bold" style={{ background: done ? C.mastered : active ? C.twin : C.surface, color: C.deep }}>{done ? '✓' : i + 1}</span>
              <span className="text-ink">{p.title}</span>
              <span className="ml-auto text-dim">{active ? 'in progress' : done ? 'done' : p.when}</span>
            </div>
          );
        })}
      </div>
      <FullSvg>
        {SC9_EVIDENCE.map((e) => (
          <ParticleStream key={e.at} t={t} from={{ x: 1920, y: 300 }} to={{ x: 1040, y: 420 }} via={{ x: 1500, y: 200 }} start={e.at} count={3} gap={90} travel={LATENCY + 200} kinds={['interaction']} />
        ))}
      </FullSvg>
    </div>
  );
}
