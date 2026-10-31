import type { ReactNode } from 'react';
import { lerp } from '../engine/anim';
import { COMPLEX, EFFECTIVENESS, GROUPS, HEATMAP, STUDENTS, TOPICS as CLASS_TOPICS } from '../scenario/classroom';
import { conceptById } from '../scenario/knowledgeGraph';
import { MASTERY_INITIAL, MASTERY_POST, MINH_ANH, TWIN_FOCUS } from '../scenario/minhAnh';
import { EXPECTED_OUTCOME, PATHWAY_INITIAL, PATHWAY_PROPOSED, PATHWAY_UPDATED } from '../scenario/orchestration';
import { EVIDENCE_ITEMS } from '../scenario/sources';
import type { ContextId } from './conversations';
import type { FramePanel } from './frame';
import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter } from './parts';
import type { TeacherActions } from './TeacherScreen';
import { egg } from '../ui/theme';

interface PanelProps {
  panel: FramePanel;
  approved: boolean;
  actions?: TeacherActions;
}

export function ContextPanel({ panel, approved, actions }: PanelProps) {
  const id = panel.id;
  return (
    <aside
      className="relative flex h-full w-[460px] shrink-0 flex-col border-l border-egg-line bg-egg-paper"
      style={{ opacity: panel.appear, transform: `translateX(${(1 - panel.appear) * 24}px)` }}
    >
      <div className="flex items-center justify-between border-b border-egg-line px-6 py-4">
        <Eyebrow>{{ student: 'Student context', class: 'Class context', attention: 'Escalations' }[id]}</Eyebrow>
        <button type="button" onClick={() => actions?.showPanel(null)} className="text-[13px] text-egg-mute hover:text-egg-ink">Close</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6 pb-8 pt-5" style={{ transform: `translateY(${-panel.scroll}px)` }}>
          {id === 'student' && <StudentContext panel={panel} approved={approved} actions={actions} />}
          {id === 'class' && <ClassContext panel={panel} approved={approved} actions={actions} />}
          {id === 'attention' && <AttentionContext panel={panel} approved={approved} actions={actions} />}
        </div>
      </div>
      {!actions && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0">
          <div className="h-8" style={{ background: 'linear-gradient(to bottom, rgba(248,244,236,0), #F8F4EC)' }} />
          <div className="h-[76px] bg-egg-paper" />
        </div>
      )}
    </aside>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between border-b border-egg-ink/80 pb-1.5">
        <h3 className="font-serif text-[22px] leading-none text-egg-ink">{title}</h3>
        {aside && <span className="text-[12px] text-egg-mute">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** The proposal card: what the agents want to do, and the teacher's controls over it. */
function Proposal({ id, title, by, steps, outcome, approved, actions, approveLabel, doneLabel, followUp = false, flashRow, flash = 0 }: {
  id: ContextId; title: string; by: string; steps: { when: string; what: string }[]; outcome: string;
  approved: boolean; actions?: TeacherActions; approveLabel: string; doneLabel: string;
  followUp?: boolean; flashRow?: number; flash?: number;
}) {
  return (
    <section className="mt-7 rounded-2xl border-2 border-egg-ink bg-egg-card p-5">
      <div className="flex items-center gap-2">
        <Mark size={14} />
        <Eyebrow>Proposed intervention</Eyebrow>
      </div>
      <h3 className="mt-2 font-serif text-[28px] leading-[1.05] text-egg-ink">{title}</h3>
      <div className="mt-1 text-[12.5px] text-egg-mute">{by}</div>
      <ol className="mt-4 divide-y divide-egg-line border-y border-egg-line">
        {steps.map((s, i) => (
          <li key={s.what} className="grid grid-cols-[22px_1fr_auto] items-baseline gap-2 py-2.5" style={i === flashRow ? { background: egg('accent', 0.25 * flash) } : undefined}>
            <span className="font-mono text-[11px] text-egg-mute">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[13.5px] text-egg-ink">{s.what}</span>
            <span className="font-serif text-[19px] leading-none text-egg-accent-ink">{s.when}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 text-[12.5px] text-egg-mute">
        Success looks like: <span className="text-egg-ink">{outcome}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {followUp ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-egg-ink px-4 py-2 text-[13.5px] font-semibold text-egg-card">
            <span className="h-2 w-2 rounded-full bg-egg-accent" /> Auto-approved · tomorrow 09:00
          </span>
        ) : approved ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-egg-ink px-4 py-2 text-[13.5px] font-semibold text-egg-card">
            <span className="h-2 w-2 rounded-full bg-egg-accent" /> {doneLabel}
          </span>
        ) : (
          <>
            <Button kind="primary" onClick={() => actions?.approve(id)}>{approveLabel}</Button>
            <Button onClick={() => actions?.edit()}>Edit</Button>
            <Button>Not now</Button>
          </>
        )}
      </div>
    </section>
  );
}

type CtxProps = { panel: FramePanel; approved: boolean; actions?: TeacherActions };

function StudentContext({ panel, approved, actions }: CtxProps) {
  const evidence = EVIDENCE_ITEMS.slice(0, 4);
  const steps = panel.followUp ? PATHWAY_UPDATED : panel.edited ? PATHWAY_INITIAL : PATHWAY_PROPOSED;
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={MINH_ANH.name} size={52} accent />
        <div className="min-w-0">
          <div className="text-[19px] font-semibold text-egg-ink">{MINH_ANH.name}</div>
          <div className="text-[13px] text-egg-mute">{MINH_ANH.course} · Group G4</div>
        </div>
        <div className="ml-auto"><LevelChip level="highRisk" /></div>
      </div>
      <div className="mt-6 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Quiz 2</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[22px] text-egg-mute line-through decoration-1">{MINH_ANH.scorePrev}%</span>
            <span className="text-[48px] leading-none">{MINH_ANH.scoreNow}%</span>
          </div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Practice / week</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[48px] leading-none">1.5</span>
            <span className="text-[14px] font-sans text-egg-mute">class 3.2</span>
          </div>
        </div>
      </div>
      <Section title="Concept mastery" aside="gap below 0.50">
        {TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={lerp(MASTERY_INITIAL[c], MASTERY_POST[c], panel.twin)} grow={panel.bars} />)}
      </Section>
      <Proposal
        id="student"
        title={panel.followUp ? 'Next: equivalence laws in practice' : 'Rebuild implication, then equivalence'}
        by={panel.followUp ? 'Auto-approved · within your policy' : 'Agreed by Student Analysis + Teaching Assistance agents · within your policy'}
        steps={steps.map((p) => ({ when: p.when.replace(/^(Today|Tomorrow) /, ''), what: `${p.title} · ${p.mins} min` }))}
        followUp={panel.followUp}
        flashRow={3}
        flash={panel.editFlash}
        outcome={EXPECTED_OUTCOME}
        approved={approved}
        actions={actions}
        approveLabel="Approve & send"
        doneLabel="Sent to Minh Anh’s app · 15:00"
      />
      <Section title="Evidence" aside="from 4 sources">
        <ul className="divide-y divide-egg-line">
          {evidence.map((e) => (
            <li key={e.evidence} className="grid grid-cols-[96px_1fr] gap-3 py-2">
              <span className="font-mono text-[10.5px] uppercase leading-[18px] tracking-wide text-egg-mute">{e.source}</span>
              <span className="text-[13.5px] text-egg-ink">{e.evidence}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function ClassContext({ panel, approved, actions }: CtxProps) {
  const affected = STUDENTS.filter((s) => s.status !== 'onTrack').sort((a, b) => a.mastery - b.mastery);
  const row = HEATMAP[CLASS_TOPICS.indexOf('Logical equivalence')];
  return (
    <>
      <Eyebrow>Discrete Mathematics · Week 6</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">Implication → logical equivalence</h2>
      <div className="mt-5 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Affected</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">12<span className="text-[22px] text-egg-mute"> / 55</span></div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Quiz 2 · Q4 wrong</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">58%</div>
        </div>
      </div>
      <Section title="By group" aside="avg. mastery, gap below 0.50">
        {GROUPS.map((g, i) => <Meter key={g} label={`Group ${g}`} value={row[i]} grow={panel.bars} />)}
      </Section>
      <Proposal
        id="class"
        title="Group recap + adaptive practice"
        by={`Guided conceptual practice worked in ${EFFECTIVENESS[0].value}% of similar cases`}
        steps={[
          { when: 'Thu', what: '15-min recap in tutorial · whole class' },
          { when: 'Thu', what: 'Adaptive practice set · 12 students' },
          { when: 'Fri', what: 'Check-ins · 3 students (see escalations)' },
          { when: 'Mon', what: 'Quiz 3 · re-measure the gap' },
        ]}
        outcome="Class mastery on equivalence ≥ 0.60 by Quiz 3"
        approved={approved}
        actions={actions}
        approveLabel="Approve plan"
        doneLabel="Scheduled · Thursday tutorial"
      />
      <Section title="Who’s affected" aside={`${affected.length} students`}>
        <ul className="divide-y divide-egg-line">
          {affected.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Avatar name={s.name} size={28} accent={s.index === MINH_ANH.index} />
              <span className="flex-1 truncate text-[13.5px] text-egg-ink">{s.name}</span>
              <span className="font-mono text-[12px] tabular-nums text-egg-mute">{s.mastery.toFixed(2)}</span>
              <LevelChip level={COMPLEX.includes(s.index) ? 'personal' : s.status === 'highRisk' ? 'highRisk' : 'support'} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

const ESCALATION_REASON: Record<number, { why: string; tried: string }> = {
  28: { why: 'No gain after 2 adaptive cycles', tried: 'Visual scaffolding, worked examples' },
  41: { why: 'Missed 3 tutorials · no reply on WhatsApp', tried: 'Adaptive practice (not started)' },
  50: { why: 'Mastery falling across 3 topics', tried: 'Spaced retrieval, guided set' },
};

function AttentionContext({ approved, actions }: CtxProps) {
  const people = COMPLEX.map((i) => STUDENTS[i]);
  return (
    <>
      <Eyebrow>Your escalation rule · no gain after 2 sessions</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">Three students need a conversation</h2>
      <div className="mt-5 space-y-3">
        {people.map((s) => (
          <div key={s.id} className="rounded-2xl border border-egg-line bg-egg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar name={s.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-egg-ink">{s.name}</div>
                <div className="text-[12.5px] text-egg-mute">Mastery {s.mastery.toFixed(2)}</div>
              </div>
              <LevelChip level="personal" />
            </div>
            <div className="mt-3 grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 text-[13px]">
              <span className="text-egg-mute">Why</span><span className="text-egg-ink">{ESCALATION_REASON[s.index].why}</span>
              <span className="text-egg-mute">Tried</span><span className="text-egg-ink">{ESCALATION_REASON[s.index].tried}</span>
            </div>
          </div>
        ))}
      </div>
      <Proposal
        id="attention"
        title="15-minute check-ins"
        by="Automated plans paused until you’ve met"
        steps={people.map((s, i) => ({ when: ['14:00', '14:20', '14:40'][i], what: `Fri · ${s.name}` }))}
        outcome="A plan you’ve agreed with each student"
        approved={approved}
        actions={actions}
        approveLabel="Book all three"
        doneLabel="Invitations sent · Friday"
      />
    </>
  );
}
