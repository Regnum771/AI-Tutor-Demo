import type { ReactNode } from 'react';
import { fade, stepIndex } from '../../engine/anim';
import { SOURCE_WINDOWS } from '../../scenario/sources';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { ParticleShape, ParticleStream, type ParticleKind } from '../../ui/ParticleStream';
import { egg } from '../../ui/theme';

const INK = egg('ink');
const ACCENT = egg('accent');

type BoxId = 'mm' | 'kg' | 'twin' | 'agents' | 'teacher' | 'engine' | 'student';
interface Box { id: BoxId; x: number; y: number; w: number; h: number; title: string; sub: string; parts?: string[]; pillar?: number }

/** Rows sit at y 170 / 445 / 720 (h 190) so their centre lines stay at 265 / 540 / 815. */
const BOXES: Box[] = [
  { id: 'mm', x: 470, y: 330, w: 300, h: 420, title: 'Multimodal Foundation Models', sub: 'Interpret · Extract · Connect', pillar: 1 },
  { id: 'kg', x: 1000, y: 170, w: 340, h: 190, title: 'Knowledge Graph', sub: 'The course, as reasoning structure', parts: ['Concepts', 'Prerequisites', 'Objectives'], pillar: 2 },
  { id: 'twin', x: 1000, y: 445, w: 340, h: 190, title: 'Learning Digital Twin', sub: 'Live state of every student', parts: ['Mastery', 'Misconceptions', 'Engagement'], pillar: 3 },
  { id: 'agents', x: 1000, y: 720, w: 340, h: 190, title: 'Agentic AI', sub: 'Reason · coordinate · adapt', pillar: 4 },
  { id: 'teacher', x: 1480, y: 170, w: 340, h: 190, title: 'Teacher app', sub: 'Oversight and approval', parts: ['Chat', 'Classroom', 'Approvals'] },
  { id: 'engine', x: 1480, y: 445, w: 340, h: 190, title: 'Intervention Orchestration Engine', sub: 'Decisions → executable workflows', parts: ['Schedule', 'Policy check', 'Deliver'] },
  { id: 'student', x: 1480, y: 720, w: 340, h: 190, title: 'Student app', sub: 'Personalized pathways', parts: ['Practice', 'Hints', 'Evidence'] },
];

/** What the multimodal layer reads, keyed to the particle shapes flowing in from the sources. */
const MODALITIES: { kind: ParticleKind; label: string; detail: string }[] = [
  { kind: 'structured', label: 'Structured', detail: 'grades, LMS logs' },
  { kind: 'text', label: 'Text', detail: 'chats, email · VI / EN' },
  { kind: 'document', label: 'Documents', detail: 'scans, materials' },
  { kind: 'interaction', label: 'Interaction', detail: 'attendance, practice' },
];

/** Each link names what flows along it; the label sits on the line (curve midpoint), masking it. */
const LINKS: { d: string; after: BoxId; label: string; lx: number; ly: number }[] = [
  { d: 'M770 540 C 880 540, 900 265, 1000 265', after: 'kg', label: 'concepts', lx: 889, ly: 402 },
  { d: 'M770 540 L 1000 540', after: 'twin', label: 'evidence', lx: 885, ly: 540 },
  { d: 'M770 540 C 880 540, 900 815, 1000 815', after: 'agents', label: 'signals', lx: 889, ly: 677 },
  { d: 'M1170 360 L 1170 445', after: 'twin', label: 'grounds', lx: 1170, ly: 402 },
  { d: 'M1170 635 L 1170 720', after: 'agents', label: 'learner state', lx: 1170, ly: 677 },
  { d: 'M1340 815 C 1410 815, 1410 540, 1480 540', after: 'engine', label: 'decisions', lx: 1410, ly: 678 },
  { d: 'M1650 360 L 1650 445', after: 'engine', label: 'proposals ⇄ approvals', lx: 1650, ly: 402 },
  { d: 'M1650 635 L 1650 720', after: 'student', label: 'approved pathway', lx: 1650, ly: 677 },
  { d: 'M1650 910 C 1650 1050, 620 1050, 620 750', after: 'student', label: 'new evidence', lx: 1135, ly: 995 },
];

const REVEAL: Record<BoxId, number> = { mm: 1500, kg: 3500, twin: 4500, agents: 6000, engine: 8000, teacher: 9500, student: 10500 };
/** Inner detail lands as the narration names each layer (Sc9 starts at 2:14.0 on the SRT). */
const DETAIL: Record<BoxId, number> = { mm: 2000, kg: 4000, twin: 6000, agents: 9300, engine: 11000, teacher: 11600, student: 12200 };
const LABEL_DELAY = 500;
/** Lands on the closing line, "…with teachers in control." */
const GOVERNANCE = 15500;
const GOVERNANCE_PARTS = ['Policies & guardrails', 'Approval before action', 'Override anytime', 'Audit trail'];
const LOOP: BoxId[] = ['mm', 'kg', 'twin', 'agents', 'engine', 'teacher', 'student'];
const LOOP_TIMES = LOOP.map((_, i) => 12000 + i * 800);
const LOOP_END = 12000 + LOOP.length * 800;
const FLOW = { count: 40, gap: 450 };

const pillY = (i: number) => 230 + i * 80;

function Glyph({ kind }: { kind: ParticleKind }) {
  return (
    <svg width={24} height={20} viewBox="0 0 24 20" className="shrink-0" aria-hidden>
      <ParticleShape kind={kind} x={12} y={10} color={ACCENT} />
    </svg>
  );
}

function Part({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-egg-ink/30 px-2.5 py-0.5 text-[14px] text-egg-ink">{children}</span>;
}

function ArchBox({ box, opacity, detail, active, children }: { box: Box; opacity: number; detail: number; active: boolean; children?: ReactNode }) {
  return (
    <div
      className="absolute rounded-2xl p-5"
      style={{
        left: box.x, top: box.y, width: box.w, height: box.h, opacity, background: egg('card'),
        border: `2px solid ${active ? ACCENT : INK}`, boxShadow: active ? `0 0 0 6px ${egg('accent', 0.18)}` : undefined,
      }}
    >
      {box.pillar && (
        <span className="absolute -left-4 -top-4 flex h-9 w-9 items-center justify-center rounded-full font-sans text-[18px] font-bold" style={{ background: ACCENT, color: INK }}>{box.pillar}</span>
      )}
      <div className="font-serif text-[30px] leading-[1.1] text-egg-ink">{box.title}</div>
      <div className="mt-1.5 text-[16px] text-egg-mute">{box.sub}</div>
      {box.parts && (
        <div className="mt-3 flex flex-wrap gap-1.5" style={{ opacity: detail }}>
          {box.parts.map((p) => <Part key={p}>{p}</Part>)}
        </div>
      )}
      {children}
    </div>
  );
}

function LinkLabel({ text, x, y, opacity }: { text: string; x: number; y: number; opacity: number }) {
  return (
    <span
      className="absolute whitespace-nowrap rounded-full bg-egg-bg px-2 py-0.5 font-mono text-[13px] uppercase tracking-[0.08em] text-egg-mute"
      style={{ left: x, top: y, opacity, transform: 'translate(-50%, -50%)' }}
    >
      {text}
    </span>
  );
}

/** Cross-cutting layer over the whole system: the teacher sets the rules and signs off. */
function Governance({ opacity }: { opacity: number }) {
  return (
    <div
      className="absolute flex items-center gap-5 rounded-2xl bg-egg-ink px-6"
      style={{ left: 470, top: 62, width: 1350, height: 76, opacity, transform: `translateY(${(1 - opacity) * -12}px)` }}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
      <span className="font-serif text-[30px] leading-none text-egg-card">Teacher governance</span>
      <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-egg-card/60">across every layer</span>
      <div className="ml-auto flex gap-2">
        {GOVERNANCE_PARTS.map((p) => <span key={p} className="rounded-full border border-egg-card/40 px-3 py-1 text-[15px] text-egg-card">{p}</span>)}
      </div>
    </div>
  );
}

export function HowItWorks({ t }: { t: number }) {
  const o = (id: BoxId) => fade(t, REVEAL[id]);
  const d = (id: BoxId) => fade(t, DETAIL[id]);
  const step = stepIndex(t, LOOP_TIMES);
  const active = t < LOOP_END && step >= 0 ? LOOP[step] : null;
  return (
    <div className="absolute inset-0 bg-egg-bg">
      <FullSvg>
        {LINKS.map((l) => <Conduit key={l.d} d={l.d} color={INK} t={t} opacity={o(l.after)} />)}
        {SOURCE_WINDOWS.map((w, i) => (
          <ParticleStream key={w.kind} t={t} from={{ x: 330, y: pillY(i) + 25 }} to={{ x: 470, y: 540 }} start={REVEAL.mm + i * 120} {...FLOW} travel={1100} kinds={[w.particle]} color={ACCENT} />
        ))}
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 265 }} via={{ x: 900, y: 540 }} start={REVEAL.kg} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 540 }} start={REVEAL.twin} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 770, y: 540 }} to={{ x: 1000, y: 815 }} via={{ x: 900, y: 540 }} start={REVEAL.agents} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 1340, y: 815 }} to={{ x: 1480, y: 540 }} via={{ x: 1410, y: 815 }} start={REVEAL.engine} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 1650, y: 360 }} to={{ x: 1650, y: 445 }} start={REVEAL.teacher} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 1650, y: 635 }} to={{ x: 1650, y: 720 }} start={REVEAL.student} {...FLOW} color={ACCENT} />
        <ParticleStream t={t} from={{ x: 1650, y: 910 }} to={{ x: 620, y: 750 }} via={{ x: 1135, y: 1130 }} start={REVEAL.student + 200} {...FLOW} travel={1800} kinds={['interaction']} color={ACCENT} />
      </FullSvg>

      {SOURCE_WINDOWS.map((w, i) => (
        <div key={w.kind} className="absolute flex items-center rounded-full border-2 border-egg-line bg-egg-card px-4 text-[18px] font-semibold text-egg-ink" style={{ left: 60, top: pillY(i), width: 270, height: 50, opacity: fade(t, i * 150) }}>
          {w.short}
        </div>
      ))}

      {LINKS.map((l) => <LinkLabel key={l.label} text={l.label} x={l.lx} y={l.ly} opacity={fade(t, REVEAL[l.after] + LABEL_DELAY)} />)}

      {BOXES.map((b) => (
        <ArchBox key={b.id} box={b} opacity={o(b.id)} detail={d(b.id)} active={active === b.id}>
          {b.id === 'mm' && (
            <ul className="mt-5 space-y-3 border-t border-egg-line pt-4" style={{ opacity: d('mm') }}>
              {MODALITIES.map((m) => (
                <li key={m.kind} className="flex items-start gap-2.5">
                  <span className="pt-0.5"><Glyph kind={m.kind} /></span>
                  <span className="leading-tight">
                    <span className="block text-[16px] font-semibold text-egg-ink">{m.label}</span>
                    <span className="block text-[14px] text-egg-mute">{m.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {b.id === 'agents' && (
            <div className="mt-3 flex items-center gap-2" style={{ opacity: d('agents') }}>
              <Part><span className="font-mono">SAS</span> · diagnoses</Part>
              <span className="text-egg-mute">⇄</span>
              <Part><span className="font-mono">TAS</span> · plans</Part>
            </div>
          )}
        </ArchBox>
      ))}

      <Governance opacity={fade(t, GOVERNANCE)} />
    </div>
  );
}
