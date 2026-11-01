import { useEffect, useRef, useState } from 'react';
import { useLive } from '../live/LiveContext';
import { classKpis, topicMastery, twinConcepts } from '../live/mastery';
import { examOutlook } from '../live/study/outlook';
import type { DemoState, Evidence, LivePanel, Plan, StudentProfile } from '../live/types';
import { GROUPS } from '../scenario/classroom';
import { shortDate } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';
import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter, Section } from './parts';
import { LIT, MessageRow } from './voiceParts';

const APPROVE: Record<Plan['kind'], string> = { pathway: 'Approve & send', classActivity: 'Approve plan', checkIns: 'Book all' };
const EYEBROW: Record<Plan['kind'], string> = { pathway: 'Proposed pathway', classActivity: 'Proposed class activity', checkIns: 'Proposed check-ins' };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function statusLabel(plan: Plan, state: DemoState): string {
  const name = state.students.find((s) => s.id === plan.studentIds[0])?.short ?? 'the student';
  switch (plan.status) {
    case 'sent': return `Sent to ${name}’s phone`;
    case 'autoApproved': return 'Auto-approved · sent to the phone';
    case 'done': return 'Completed';
    case 'approved': return plan.kind === 'classActivity' ? `Scheduled · ${shortDate(plan.date)}` : `Invitations sent · ${shortDate(plan.date)}`;
    case 'dismissed': return 'Set aside';
    default: return '';
  }
}

/** Any plan, with the teacher's controls while it is still proposed. */
export function LivePlanCard({ plan }: { plan: Plan }) {
  const live = useLive();
  const [editing, setEditing] = useState(false);
  if (!live) return null;
  const proposed = plan.status === 'proposed';
  const edit = (i: number, change: { time?: string; remove?: boolean }) => void live.post('plan/edit', { planId: plan.id, sessionIndex: i, ...change });
  return (
    <section className="mt-7 rounded-2xl border-2 border-egg-ink bg-egg-card p-5">
      <div className="flex items-center gap-2">
        <Mark size={14} />
        <Eyebrow>{EYEBROW[plan.kind]}</Eyebrow>
      </div>
      {/* Agent-written titles can name a student; Instrument Serif has no Vietnamese glyphs. */}
      <h3 className={`mt-2 text-egg-ink ${plan.kind === 'classActivity' ? 'font-serif text-[28px] leading-[1.05]' : 'text-[22px] font-semibold leading-tight'}`}>{plan.title}</h3>
      <div className="mt-1 text-[12.5px] text-egg-mute">
        {`${plan.status === 'autoApproved' ? 'Auto-approved · within your policy' : 'Agreed by Student Analysis + Teaching Assistance agents'} · ${shortDate(plan.date)}`}
      </div>
      <ol className="mt-4 divide-y divide-egg-line border-y border-egg-line">
        {plan.sessions.map((s, i) => (
          <li key={`${plan.id}:${i}:${s.title}:${s.time}`} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 py-2.5">
            <span className="font-mono text-[11px] text-egg-mute">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[13.5px] text-egg-ink">{`${s.title} · ${s.minutes} min`}</span>
            {editing && proposed ? (
              <span className="flex items-center gap-1.5">
                <input
                  aria-label={`Session ${i + 1} time`}
                  type="time"
                  defaultValue={s.time}
                  onBlur={(e) => { if (e.target.value && e.target.value !== s.time) edit(i, { time: e.target.value }); }}
                  className="w-[92px] rounded-md border border-egg-line bg-egg-bg px-1.5 py-0.5 font-mono text-[13px] text-egg-ink"
                />
                {!s.isMasteryCheck && plan.sessions.length > 1 && (
                  <button type="button" aria-label={`Remove session ${i + 1}`} onClick={() => edit(i, { remove: true })} className="px-1 text-[13px] text-egg-mute hover:text-egg-brick">✕</button>
                )}
              </span>
            ) : (
              <span className="font-serif text-[19px] leading-none text-egg-accent-ink">{s.time}</span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 text-[12.5px] text-egg-mute">
        Success looks like: <span className="text-egg-ink">{plan.outcome}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {proposed ? (
          <>
            <Button kind="primary" onClick={() => void live.post('plan/approve', { planId: plan.id })}>{APPROVE[plan.kind]}</Button>
            <Button onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</Button>
            <Button onClick={() => void live.post('plan/dismiss', { planId: plan.id })}>Not now</Button>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-egg-ink px-4 py-2 text-[13.5px] font-semibold text-egg-card">
            <span className="h-2 w-2 rounded-full bg-egg-accent" /> {statusLabel(plan, live.state)}
          </span>
        )}
      </div>
    </section>
  );
}

/** Evidence entries, newest first; the highlighted one is scrolled into view. */
export function EvidenceList({ entries, highlight }: { entries: Evidence[]; highlight: string | null }) {
  const hi = useRef<HTMLLIElement>(null);
  useEffect(() => { hi.current?.scrollIntoView?.({ block: 'center' }); }, [highlight]);
  return (
    <ul className="divide-y divide-egg-line">
      {[...entries].reverse().map((e) => (
        <li key={e.id} ref={e.id === highlight ? hi : undefined} className="grid grid-cols-[96px_1fr] gap-3 py-2" style={e.id === highlight ? LIT : undefined} data-evidence={e.id}>
          <span className="font-mono text-[10.5px] uppercase leading-[18px] tracking-wide text-egg-mute">{e.source}</span>
          <span className="text-[13.5px] text-egg-ink">
            {e.text}
            <span className="ml-1.5 text-[12px] text-egg-mute">{e.when}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The latest three messages and TA notes, so practice rows never push the student's own words out of sight. */
function TheirWords({ s }: { s: StudentProfile }) {
  const live = useLive();
  const words = [...s.evidence].reverse().filter((e) => e.kind === 'message' || e.kind === 'taNote').slice(0, 3);
  if (words.length === 0) return null;
  return (
    <Section title="In their words" aside={<button type="button" onClick={() => live?.openProfile(s.id)} className="hover:text-egg-ink hover:underline">See all</button>}>
      <ul className="divide-y divide-egg-line">{words.map((e) => <MessageRow key={e.id} e={e} lit={false} />)}</ul>
    </Section>
  );
}

function StudentLive({ s, plan, highlight, bars, state }: { s: StudentProfile; plan: Plan | null; highlight: string | null; bars: number; state: DemoState }) {
  const level = s.status === 'onTrack' ? null : s.escalated ? 'personal' : s.status;
  const classPractice = (Math.round(mean(state.students.map((x) => x.practicePerWeek)) * 10) / 10).toFixed(1);
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={s.name} size={52} accent={s.status === 'highRisk'} />
        <div className="min-w-0">
          <div className="text-[19px] font-semibold text-egg-ink">{s.name}</div>
          <div className="text-[13px] text-egg-mute">{`Discrete Mathematics · Group ${s.group}`}</div>
        </div>
        <div className="ml-auto">
          {level ? <LevelChip level={level} /> : <span className="rounded-full border border-egg-line px-2.5 py-0.5 text-[11.5px] text-egg-mute">On track</span>}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Quiz 1 → Quiz 2</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[22px] text-egg-mute line-through decoration-1">{`${s.quiz.q1}%`}</span>
            <span className="text-[48px] leading-none">{`${s.quiz.q2}%`}</span>
          </div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Practice / week</Eyebrow>
          <div className="mt-1 flex items-baseline gap-2 font-serif text-egg-ink">
            <span className="text-[48px] leading-none">{s.practicePerWeek}</span>
            <span className="font-sans text-[14px] text-egg-mute">{`class ${classPractice}`}</span>
          </div>
        </div>
      </div>
      <TheirWords s={s} />
      <Section title="Concept mastery" aside="gap below 0.50">
        {twinConcepts(state, s.id).map((c) => <Meter key={c} label={conceptById(c).label} value={s.mastery[c]} grow={bars} />)}
      </Section>
      <RoadToExam s={s} state={state} />
      {plan && <LivePlanCard plan={plan} />}
      <Section title="Evidence" aside={`${s.evidence.length} entries`}>
        <EvidenceList entries={s.evidence} highlight={highlight} />
      </Section>
    </>
  );
}

/** The student's own study, for a teacher who wants to look in. Nothing here needs approval. */
function RoadToExam({ s, state }: { s: StudentProfile; state: DemoState }) {
  const o = examOutlook(state, s);
  if (!o.setUp) return null;
  const latest = o.marks.at(-1);
  return (
    <Section title="Road to the exam" aside="estimate">
      <div className="grid grid-cols-2 border-b border-egg-line pb-3">
        <div className="pr-4">
          <Eyebrow>Forecast</Eyebrow>
          <div className="mt-1 font-serif text-[28px] leading-none text-egg-ink">{o.band}</div>
          <div className="mt-1 text-[12.5px] text-egg-mute">{`${o.forecast.toFixed(1)} of 10 now · ${o.ifPlanKept.toFixed(1)} if the plan is kept`}</div>
        </div>
        <div className="pl-4">
          <Eyebrow>Studied</Eyebrow>
          <div className="mt-1 text-[15px] font-semibold text-egg-ink">{`${o.minutesDone} of ${o.minutesPlanned} min`}</div>
        </div>
      </div>
      {latest && <div className="mt-3 text-[13.5px] text-egg-ink">{`${latest.title}: ${latest.mark}`}</div>}
      {o.lastChange && <div className="mt-3 text-[13.5px] text-egg-ink">{`${o.lastChange.date}: ${o.lastChange.reason}`}</div>}
    </Section>
  );
}

function ClassLive({ state, plan, highlight, bars }: { state: DemoState; plan: Plan | null; highlight: string | null; bars: number }) {
  const k = classKpis(state.students);
  const affected = state.students.filter((s) => s.status !== 'onTrack').sort((a, b) => topicMastery(a.mastery) - topicMastery(b.mastery));
  return (
    <>
      <Eyebrow>Discrete Mathematics · Week 6</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">Logical equivalence across the class</h2>
      <div className="mt-5 grid grid-cols-2 border-y border-egg-line">
        <div className="border-r border-egg-line py-3 pr-4">
          <Eyebrow>Need support</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">{k.needSupport}<span className="text-[22px] text-egg-mute">{` / ${k.students}`}</span></div>
        </div>
        <div className="py-3 pl-4">
          <Eyebrow>Avg. mastery</Eyebrow>
          <div className="mt-1 font-serif text-[48px] leading-none text-egg-ink">{k.avgMastery.toFixed(2)}</div>
        </div>
      </div>
      <Section title="By group" aside="avg. mastery, gap below 0.50">
        {GROUPS.map((g) => <Meter key={g} label={`Group ${g}`} value={mean(state.students.filter((s) => s.group === g).map((s) => topicMastery(s.mastery)))} grow={bars} />)}
      </Section>
      {plan && <LivePlanCard plan={plan} />}
      <Section title="Who’s affected" aside={`${affected.length} students`}>
        <ul className="divide-y divide-egg-line">
          {affected.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <Avatar name={s.name} size={28} accent={s.status === 'highRisk'} />
              <span className="flex-1 truncate text-[13.5px] text-egg-ink">{s.name}</span>
              <span className="font-mono text-[12px] tabular-nums text-egg-mute">{topicMastery(s.mastery).toFixed(2)}</span>
              <LevelChip level={s.escalated ? 'personal' : s.status === 'highRisk' ? 'highRisk' : 'support'} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Class evidence" aside={`${state.classEvidence.length} entries`}>
        <EvidenceList entries={state.classEvidence} highlight={highlight} />
      </Section>
    </>
  );
}

function CheckInsLive({ state, plan }: { state: DemoState; plan: Plan }) {
  const people = plan.sessions.flatMap((x) => {
    const s = state.students.find((p) => p.id === x.studentId);
    return s ? [s] : [];
  });
  return (
    <>
      <Eyebrow>Your escalation rule · no gain after 2 sessions</Eyebrow>
      <h2 className="mt-1 font-serif text-[40px] leading-[1.02] text-egg-ink">
        {people.length === 1 ? 'One student needs a conversation' : `${people.length} students need a conversation`}
      </h2>
      <div className="mt-5 space-y-3">
        {people.map((s) => {
          const note = [...s.evidence].reverse().find((e) => ['taNote', 'message', 'record', 'attendance'].includes(e.kind));
          return (
            <div key={s.id} className="rounded-2xl border border-egg-line bg-egg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-egg-ink">{s.name}</div>
                  <div className="text-[12.5px] text-egg-mute">{`Mastery ${topicMastery(s.mastery).toFixed(2)}`}</div>
                </div>
                <LevelChip level="personal" />
              </div>
              {note && <div className="mt-3 text-[13px] text-egg-ink"><span className="text-egg-mute">{`${note.source} · `}</span>{note.text}</div>}
            </div>
          );
        })}
      </div>
      <LivePlanCard plan={plan} />
    </>
  );
}

/** The context panel body in live mode: a student twin, the class view or the check-ins, each with its plan. */
export function LivePanelBody({ live, bars }: { live: LivePanel; bars: number }) {
  const ctx = useLive();
  if (!ctx) return null;
  const { state } = ctx;
  const plan = live.planId ? state.plans.find((p) => p.id === live.planId) ?? null : null;
  if (live.kind === 'student') {
    const s = state.students.find((x) => x.id === live.studentId);
    return s ? <StudentLive s={s} plan={plan} highlight={live.highlight} bars={bars} state={state} /> : null;
  }
  if (live.kind === 'class') return <ClassLive state={state} plan={plan} highlight={live.highlight ?? null} bars={bars} />;
  return plan ? <CheckInsLive state={state} plan={plan} /> : null;
}
