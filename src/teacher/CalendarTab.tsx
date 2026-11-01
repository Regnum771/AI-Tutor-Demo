import { useState } from 'react';
import { useLive } from '../live/LiveContext';
import type { DemoState } from '../live/types';
import { ASSESSMENTS, CLOS, fullDate, LECTURES, shortDate, weekOf } from '../scenario/course';
import { CHANNEL_LABEL, voiceEvidenceId } from '../scenario/voice';
import { assessmentMarks, calendarWeek, FIRST_WEEK, LAST_WEEK, lectureQuestions, sessionLabel, type CalendarEvent } from './calendar';
import { Eyebrow } from './parts';
import { Words } from './voiceParts';

const NAV = 'rounded-full border border-egg-line px-3 py-1 text-[12.5px] text-egg-ink hover:border-egg-ink disabled:opacity-40 disabled:hover:border-egg-line';
const STYLE: Record<CalendarEvent['kind'], string> = {
  lecture: 'border border-egg-line bg-egg-card',
  assessment: 'bg-egg-ink text-egg-card',
  session: 'border border-egg-ink/40 bg-egg-paper',
  stopped: 'border border-egg-accent text-egg-accent-ink',
};

const keyOf = (e: CalendarEvent): string =>
  e.kind === 'lecture' ? `lecture-${e.lecture}`
    : e.kind === 'assessment' ? `assessment-${e.assessment}`
    : e.kind === 'session' ? `session-${e.planId}-${e.time}`
    : `stopped-${e.studentId}`;

/** The course week by week. Live only and a view only: browsing never moves the story, posts nothing and costs no tokens. */
export function Calendar() {
  const live = useLive();
  const [week, setWeek] = useState(() => (live ? Math.min(LAST_WEEK, Math.max(FIRST_WEEK, weekOf(live.state.day))) : FIRST_WEEK));
  const [open, setOpen] = useState<string | null>(null);
  if (!live) return null;
  const { state } = live;
  const cal = calendarWeek(state, week);
  const short = (id: string) => state.students.find((s) => s.id === id)?.short ?? id;
  const go = (w: number) => {
    setWeek(w);
    setOpen(null);
  };
  const text = (e: CalendarEvent): string =>
    e.kind === 'session' ? sessionLabel(e.title, e.studentIds.flatMap((id) => state.students.filter((s) => s.id === id)))
      : e.kind === 'stopped' ? `Stopped practising · ${short(e.studentId)}`
      : e.title;
  const act = (e: CalendarEvent) => {
    if (e.kind === 'lecture' || e.kind === 'assessment') setOpen(open === keyOf(e) ? null : keyOf(e));
    else if (e.kind === 'session') {
      const plan = state.plans.find((p) => p.id === e.planId);
      if (plan) live.openConversation(plan.conversationId);
    } else live.openProfile(e.studentId);
  };
  const opened = cal.days.flatMap((d) => d.events).find((e) => keyOf(e) === open) ?? null;
  const empty = cal.days.every((d) => d.events.length === 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-8 pb-10 pt-6">
        <div className="flex items-end gap-4">
          <div>
            <Eyebrow>Discrete Mathematics · DM-2026</Eyebrow>
            <h2 data-week={week} className="mt-2 font-serif text-[44px] leading-none">{`Week ${week}`}</h2>
            <div className="mt-1 text-[13px] text-egg-mute">{`${shortDate(cal.days[0].day)} – ${shortDate(cal.days[6].day)}`}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={week <= FIRST_WEEK} onClick={() => go(week - 1)} className={NAV}>‹ Prev week</button>
            <button type="button" disabled={week >= LAST_WEEK} onClick={() => go(week + 1)} className={NAV}>Next week ›</button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-7 border-t-2 border-egg-ink">
          {cal.days.map((d) => {
            const today = d.day === state.day;
            return (
              <div key={d.day} data-day={d.day} aria-current={today ? 'date' : undefined} className={`min-h-[160px] border-b border-r border-egg-line p-2 last:border-r-0 ${today ? 'bg-egg-tint' : ''}`}>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-egg-mute">{shortDate(d.day)}</span>
                  {today && <span className="rounded-full bg-egg-ink px-2 text-[10.5px] font-semibold text-egg-card">Today</span>}
                </div>
                <div className="mt-2 space-y-1.5">
                  {d.events.map((e, i) => (
                    <button
                      key={`${keyOf(e)}-${i}`}
                      type="button"
                      data-event={keyOf(e)}
                      aria-expanded={e.kind === 'lecture' || e.kind === 'assessment' ? open === keyOf(e) : undefined}
                      onClick={() => act(e)}
                      className={`block w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] leading-snug ${STYLE[e.kind]}`}
                    >
                      {'time' in e && <span className="block font-mono text-[10.5px] opacity-70">{e.time}</span>}
                      <span className="block font-semibold">{text(e)}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {empty && <div className="mt-6 text-[14px] text-egg-mute">Nothing scheduled</div>}
        {opened?.kind === 'lecture' && <LectureDetail n={opened.lecture} state={state} />}
        {opened?.kind === 'assessment' && <AssessmentDetail id={opened.assessment} state={state} />}
      </div>
    </div>
  );
}

/** The student questions placed after a lecture, from the FAQ log. */
function LectureDetail({ n, state }: { n: number; state: DemoState }) {
  const l = LECTURES.find((x) => x.n === n)!;
  const questions = lectureQuestions(n);
  return (
    <section data-detail={`lecture-${n}`} className="mt-6 border-t border-egg-ink/80 pt-3">
      <div className="font-serif text-[26px] leading-none">{`Lecture ${l.n} · ${l.title}`}</div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{`${fullDate(l.day)} · 09:00–11:00 · ${questions.length} student question${questions.length === 1 ? '' : 's'} after it`}</div>
      {questions.length ? (
        <ul className="mt-3 divide-y divide-egg-line">
          {questions.map((v) => {
            const student = state.students[v.studentIndex];
            const id = voiceEvidenceId(v);
            const e = student.evidence.find((x) => x.id === id);
            return (
              <li key={id} data-question={id} className="py-2 text-[13px]">
                <span className="block font-semibold text-egg-ink">{`${student.name} · ${CHANNEL_LABEL[v.channel]} · ${shortDate(v.day)} · ${v.time}`}</span>
                {e && <Words e={e} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 text-[14px] text-egg-mute">No student questions after this lecture yet.</div>
      )}
    </section>
  );
}

/** An assessment's date, CLOs and, once there are any, its marks. */
function AssessmentDetail({ id, state }: { id: string; state: DemoState }) {
  const a = ASSESSMENTS.find((x) => x.id === id)!;
  const marks = assessmentMarks(state, id);
  const name = (sid: string) => state.students.find((s) => s.id === sid)?.name ?? sid;
  const avg = marks.length ? Math.round(marks.reduce((t, m) => t + m.mark, 0) / marks.length) : 0;
  return (
    <section data-detail={`assessment-${id}`} className="mt-6 border-t border-egg-ink/80 pt-3">
      <div className="font-serif text-[26px] leading-none">{a.title}</div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{fullDate(a.day)}</div>
      <div className="mt-2 text-[13.5px] text-egg-ink">{a.clos.map((c) => `${c} ${CLOS.find((x) => x.id === c)!.title}`).join(' · ')}</div>
      {marks.length ? (
        <>
          <div className="mt-3 text-[13px] font-semibold">{`${marks.length} mark${marks.length === 1 ? '' : 's'} · average ${avg}%`}</div>
          <ul className="mt-1 grid grid-cols-3 gap-x-6 text-[13px]">
            {marks.map((m) => (
              <li key={m.studentId} className="flex justify-between gap-2 border-b border-egg-line py-1">
                <span className="truncate">{name(m.studentId)}</span>
                <span className="font-mono">{`${m.mark}%`}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-3 text-[14px] text-egg-mute">No marks yet.</div>
      )}
    </section>
  );
}
