import type { ReactNode } from 'react';
import { fade, stepIndex } from '../../engine/anim';
import { SOURCE_WINDOWS } from '../../scenario/sources';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleStream } from '../../ui/ParticleStream';

const INK = '#1A1714';
const ORANGE = '#FF5B1F';

type BoxId = 'mm' | 'kg' | 'twin' | 'agents' | 'teacher' | 'engine' | 'student';
interface Box { id: BoxId; x: number; y: number; w: number; h: number; title: string; sub: string; pillar?: number }

const BOXES: Box[] = [
  { id: 'mm', x: 470, y: 330, w: 300, h: 420, title: 'Multimodal Foundation Models', sub: 'Interpret · Extract · Connect', pillar: 1 },
  { id: 'kg', x: 1000, y: 190, w: 340, h: 150, title: 'Knowledge Graph', sub: 'Concepts · prerequisites · objectives', pillar: 2 },
  { id: 'twin', x: 1000, y: 465, w: 340, h: 150, title: 'Learning Digital Twin', sub: 'Dynamic student state', pillar: 3 },
  { id: 'agents', x: 1000, y: 740, w: 340, h: 150, title: 'Agentic AI', sub: '', pillar: 4 },
  { id: 'teacher', x: 1480, y: 190, w: 340, h: 150, title: 'Teacher app', sub: 'Chat · Classroom · approvals' },
  { id: 'engine', x: 1480, y: 465, w: 340, h: 150, title: 'Intervention Orchestration Engine', sub: 'Decisions → executable workflows' },
  { id: 'student', x: 1480, y: 740, w: 340, h: 150, title: 'Student app', sub: 'Personalized pathways · evidence' },
];

const LINKS: { d: string; after: BoxId }[] = [
  { d: 'M770 540 C 880 540, 900 265, 1000 265', after: 'kg' },
  { d: 'M770 540 L 1000 540', after: 'twin' },
  { d: 'M770 540 C 880 540, 900 815, 1000 815', after: 'agents' },
  { d: 'M1170 340 L 1170 465', after: 'twin' },
  { d: 'M1170 615 L 1170 740', after: 'agents' },
  { d: 'M1340 815 C 1410 815, 1410 540, 1480 540', after: 'engine' },
  { d: 'M1650 340 L 1650 465', after: 'engine' },
  { d: 'M1650 615 L 1650 740', after: 'student' },
  { d: 'M1650 890 C 1650 1050, 620 1050, 620 750', after: 'student' },
];

const REVEAL: Record<BoxId, number> = { mm: 1500, kg: 3500, twin: 4500, agents: 6000, engine: 8000, teacher: 9500, student: 10500 };
const LOOP: BoxId[] = ['mm', 'kg', 'twin', 'agents', 'engine', 'teacher', 'student'];
const LOOP_TIMES = LOOP.map((_, i) => 12000 + i * 800);
const LOOP_END = 12000 + LOOP.length * 800;
const FLOW = { count: 40, gap: 450 };

const pillY = (i: number) => 230 + i * 80;

function ArchBox({ box, opacity, active, children }: { box: Box; opacity: number; active: boolean; children?: ReactNode }) {
  return (
    <div
      className="absolute rounded-2xl p-5"
      style={{
        left: box.x, top: box.y, width: box.w, height: box.h, opacity, background: '#FFFDF8',
        border: `2px solid ${active ? ORANGE : INK}`, boxShadow: active ? '0 0 0 6px rgba(255,91,31,0.18)' : undefined,
      }}
    >
      {box.pillar && (
        <span className="absolute -left-4 -top-4 flex h-9 w-9 items-center justify-center rounded-full font-sans text-[18px] font-bold" style={{ background: ORANGE, color: INK }}>{box.pillar}</span>
      )}
      <div className="font-serif text-[30px] leading-tight text-[#1A1714]">{box.title}</div>
      {box.sub && <div className="mt-2 text-[17px] text-[#6B6359]">{box.sub}</div>}
      {children}
    </div>
  );
}

export function HowItWorks({ t }: { t: number }) {
  const o = (id: BoxId) => fade(t, REVEAL[id]);
  const step = stepIndex(t, LOOP_TIMES);
  const active = t < LOOP_END && step >= 0 ? LOOP[step] : null;
  return (
    <div className="absolute inset-0" style={{ background: '#F2EDE4' }}>
      <FullSvg>
        {LINKS.map((l) => <Conduit key={l.d} d={l.d} color={INK} t={t} opacity={o(l.after)} />)}
        {SOURCE_WINDOWS.map((w, i) => (
          <ParticleStream key={w.kind} t={t} from={{ x: 330, y: pillY(i) + 25 }} to={{ x: 470, y: 540 }} start={REVEAL.mm + i * 120} {...FLOW} travel={1100} kinds={[w.particle]} color={ORANGE} />
        ))}
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 265 }} via={{ x: 900, y: 540 }} start={REVEAL.kg} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 540 }} start={REVEAL.twin} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 815 }} via={{ x: 900, y: 540 }} start={REVEAL.agents} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 1340, y: 815 }} to={{ x: 1480, y: 540 }} via={{ x: 1410, y: 815 }} start={REVEAL.engine} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 1650, y: 340 }} to={{ x: 1650, y: 465 }} start={REVEAL.teacher} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 1650, y: 615 }} to={{ x: 1650, y: 740 }} start={REVEAL.student} {...FLOW} color={ORANGE} />
        <ParticleStream t={t} from={{ x: 1650, y: 890 }} to={{ x: 620, y: 750 }} via={{ x: 1135, y: 1130 }} start={REVEAL.student + 200} {...FLOW} travel={1800} kinds={['interaction']} color={ORANGE} />
      </FullSvg>

      {SOURCE_WINDOWS.map((w, i) => (
        <div key={w.kind} className="absolute flex items-center rounded-full border-2 px-4 text-[18px] font-semibold text-[#1A1714]" style={{ left: 60, top: pillY(i), width: 270, height: 50, borderColor: '#DCD3C5', background: '#FFFDF8', opacity: fade(t, i * 150) }}>
          {w.short}
        </div>
      ))}

      {BOXES.map((b) => (
        <ArchBox key={b.id} box={b} opacity={o(b.id)} active={active === b.id}>
          {b.id === 'agents' && (
            <div className="mt-4 flex items-center gap-3 font-mono text-[16px]">
              <span className="rounded-full border border-[#1A1714] px-3 py-1">SAS</span>
              <span>⇄</span>
              <span className="rounded-full border border-[#1A1714] px-3 py-1">TAS</span>
            </div>
          )}
        </ArchBox>
      ))}
    </div>
  );
}
