import type { ReactNode } from 'react';
import { fade, prog } from '../../engine/anim';
import { SOURCE_WINDOWS } from '../../scenario/sources';
import { AgentPair } from '../../ui/AgentPair';
import { Camera, type CamKey } from '../../ui/Camera';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';
import { C } from '../../ui/tokens';

type BoxId = 'mm' | 'kg' | 'twin' | 'agents' | 'teacher' | 'engine' | 'student';
interface Box { id: BoxId; x: number; y: number; w: number; h: number; color: string; title: string; sub: string; pillar?: number }

const BOXES: Box[] = [
  { id: 'mm', x: 470, y: 330, w: 300, h: 420, color: C.cyan, title: 'Multimodal Foundation Models', sub: 'Interpret · Extract · Connect', pillar: 1 },
  { id: 'kg', x: 1000, y: 190, w: 340, h: 150, color: C.royal, title: 'Knowledge Graph', sub: 'Concepts · prerequisites · objectives', pillar: 2 },
  { id: 'twin', x: 1000, y: 465, w: 340, h: 150, color: C.twin, title: 'Learning Digital Twin', sub: 'Dynamic student state', pillar: 3 },
  { id: 'agents', x: 1000, y: 740, w: 340, h: 150, color: C.sas, title: 'Agentic AI', sub: '', pillar: 4 },
  { id: 'teacher', x: 1480, y: 190, w: 340, h: 150, color: C.gold, title: 'Teacher Command Center', sub: 'Policies · oversight · exceptions' },
  { id: 'engine', x: 1480, y: 465, w: 340, h: 150, color: C.engine, title: 'Intervention Orchestration Engine', sub: 'Decisions → executable workflows' },
  { id: 'student', x: 1480, y: 740, w: 340, h: 150, color: C.engine, title: 'Student Application', sub: 'Personalized pathways · evidence' },
];

const LINKS: { d: string; color: string; after: BoxId }[] = [
  { d: 'M770 540 C 880 540, 900 265, 1000 265', color: C.royal, after: 'kg' },
  { d: 'M770 540 L 1000 540', color: C.twin, after: 'twin' },
  { d: 'M770 540 C 880 540, 900 815, 1000 815', color: C.sas, after: 'agents' },
  { d: 'M1170 340 L 1170 465', color: C.royal, after: 'twin' },
  { d: 'M1170 615 L 1170 740', color: C.twin, after: 'agents' },
  { d: 'M1340 815 C 1410 815, 1410 540, 1480 540', color: C.engine, after: 'engine' },
  { d: 'M1650 340 L 1650 465', color: C.gold, after: 'engine' },
  { d: 'M1650 615 L 1650 740', color: C.engine, after: 'student' },
  { d: 'M1650 890 C 1650 1050, 620 1050, 620 750', color: C.cyan, after: 'student' },
];

const REVEAL: Record<BoxId, number> = { mm: 3200, kg: 5400, twin: 6000, agents: 6600, teacher: Infinity, engine: Infinity, student: Infinity };
const CLOSING: Record<BoxId, number> = { mm: 0, kg: 300, twin: 500, agents: 700, teacher: 1100, engine: 1300, student: 1500 };
const REVEAL_CAM: CamKey[] = [{ t: 0, x: 960, y: 540, zoom: 1 }, { t: 10800, x: 960, y: 540, zoom: 1 }, { t: 12800, x: 1170, y: 540, zoom: 2.4 }];
const STILL_CAM: CamKey[] = [{ t: 0, x: 960, y: 540, zoom: 1 }];

const pillY = (i: number) => 230 + i * 80;

function ArchBox({ box, opacity, children }: { box: Box; opacity: number; children?: ReactNode }) {
  return (
    <div className="absolute rounded-2xl border-2 p-5" style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: box.color, background: C.panel, opacity, boxShadow: `0 0 28px ${box.color}55` }}>
      {box.pillar && (
        <span className="absolute -left-4 -top-4 flex h-9 w-9 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: box.color, color: C.deep }}>{box.pillar}</span>
      )}
      <div className="font-display text-[24px] font-bold leading-tight" style={{ color: box.color }}>{box.title}</div>
      {box.sub && <div className="mt-2 text-[18px] text-dim">{box.sub}</div>}
      {children}
    </div>
  );
}

export function ArchitectureView({ t, mode }: { t: number; mode: 'reveal' | 'closing' }) {
  const appear = mode === 'reveal' ? REVEAL : CLOSING;
  const o = (id: BoxId) => fade(t, appear[id]);
  const logo = fade(t, mode === 'reveal' ? 8000 : 6000);
  const tagline = mode === 'reveal'
    ? 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Agentic Adaptation.'
    : 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.';
  const inStart = mode === 'reveal' ? 1500 : 0;
  const outStart = mode === 'reveal' ? 6000 : 0;
  return (
    <Camera t={t} keys={mode === 'reveal' ? REVEAL_CAM : STILL_CAM}>
      <FullSvg>
        {LINKS.map((l) => <Conduit key={l.d} d={l.d} color={l.color} t={t} opacity={o(l.after)} />)}
        {SOURCE_WINDOWS.map((w, i) => (
          <ParticleStream key={w.kind} t={t} from={{ x: 330, y: pillY(i) + 25 }} to={{ x: 470, y: 540 }} start={inStart + i * 120} count={mode === 'reveal' ? 8 : 22} gap={450} travel={1100} kinds={[w.particle]} />
        ))}
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 265 }} via={{ x: 900, y: 540 }} start={outStart} count={14} gap={330} color={C.royal} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 540 }} start={outStart + 150} count={14} gap={330} color={C.twin} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 815 }} via={{ x: 900, y: 540 }} start={outStart + 300} count={14} gap={330} color={C.sas} />
        {mode === 'closing' && (
          <>
            <ParticleStream t={t} from={{ x: 1340, y: 815 }} to={{ x: 1480, y: 540 }} via={{ x: 1410, y: 815 }} start={1500} count={20} gap={400} color={C.engine} />
            <ParticleStream t={t} from={{ x: 1650, y: 615 }} to={{ x: 1650, y: 740 }} start={1700} count={20} gap={400} color={C.engine} />
            <ParticleStream t={t} from={{ x: 1650, y: 890 }} to={{ x: 620, y: 750 }} via={{ x: 1135, y: 1130 }} start={1900} count={20} gap={400} travel={1800} kinds={['interaction']} />
          </>
        )}
      </FullSvg>

      {SOURCE_WINDOWS.map((w, i) => (
        <div key={w.kind} className="absolute flex items-center rounded-full border-2 px-4 text-[18px] font-semibold text-ink" style={{ left: 60, top: pillY(i), width: 270, height: 50, borderColor: C.line, background: C.surface, opacity: fade(t, i * 150) }}>
          {w.short}
        </div>
      ))}

      {BOXES.map((b) => (
        <ArchBox key={b.id} box={b} opacity={o(b.id)}>
          {b.id === 'agents' && <AgentPair t={t} x={1090 - b.x} y={840 - b.y} gap={160} r={30} />}
        </ArchBox>
      ))}

      {logo > 0 && (
        <div className="absolute left-0 right-0 text-center" style={{ top: 24, opacity: logo }}>
          <div className="font-display font-extrabold tracking-[0.18em] text-ink" style={{ fontSize: 64 }}>BEYOND AI TUTORING</div>
          <div className="mt-2 font-display font-semibold text-dim" style={{ fontSize: 24 }}>{tagline}</div>
        </div>
      )}

      {mode === 'reveal' && <div className="absolute inset-0 bg-deep" style={{ opacity: prog(t, 12000, 800) }} />}
    </Camera>
  );
}
