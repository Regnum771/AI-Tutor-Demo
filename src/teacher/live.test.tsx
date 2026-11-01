import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { keysOf, liveEvents, SeenClock } from '../live/events';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { LiveProvider } from '../live/LiveContext';
import type { AssistantMsg, DemoState, LivePanel } from '../live/types';
import { COMPLEX } from '../scenario/classroom';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { liveTodayRows, TeacherScreen, type TeacherActions } from './TeacherScreen';

const noop = new Proxy({}, { get: () => () => undefined }) as TeacherActions;

function render(state: DemoState, activeId: string | null = 'c1', extra: TeacherEvent[] = []) {
  const seen = new SeenClock();
  seen.stamp(keysOf(state), 0);
  const events: TeacherEvent[] = [{ at: PAST, type: 'greeting' }, { at: PAST, type: 'classroomReveal' }, ...liveEvents(state, activeId, seen), ...extra];
  return html(
    <LiveProvider value={ctxFor(state, activeId)}>
      <TeacherScreen frame={teacherFrame(events, 10)} actions={noop} composer={{ value: '', onChange: () => {} }} />
    </LiveProvider>,
  );
}

const inClassroom = (selected: number | null = null): TeacherEvent[] => [
  { at: 1, type: 'view', view: 'classroom' },
  ...(selected === null ? [] : [{ at: 1, type: 'select' as const, index: selected }]),
];

describe('live classroom', () => {
  it('computes the heatmap from the students and leaves out topics with no concept', () => {
    const s = stateWithPlan();
    const g1 = s.students.filter((x) => x.group === 'G1');
    g1.forEach((x, i) => { x.mastery.equivalence = 0.7 + i * 0.01; });
    const avg = g1.reduce((a, x) => a + x.mastery.equivalence, 0) / g1.length;
    const out = render(s, null, inClassroom());
    expect(out).toContain(`title="Logical equivalence · G1: ${avg.toFixed(2)} mastery"`);
    expect(out).not.toContain('Predicates');
  });
  it('the scripted Classroom keeps the scripted topics', () => {
    const events: TeacherEvent[] = [{ at: PAST, type: 'classroomReveal' }, ...inClassroom()];
    expect(html(<TeacherScreen frame={teacherFrame(events, 10)} />)).toContain('Predicates');
  });
  it('an escalated student who recovers reads as on track', () => {
    const s = stateWithPlan();
    const student = s.students[COMPLEX[0]];
    expect(render(s, null, inClassroom())).toContain(`title="${student.name} · Needs you`);
    student.status = 'onTrack';
    expect(render(s, null, inClassroom())).toContain(`title="${student.name} · On track`);
  });
  it('the student card shows what the plan practises', () => {
    const sessions = [{ time: '15:30', title: 'Laws', minutes: 8, concept: 'equivLaws' as const, isMasteryCheck: true, studentId: null }];
    expect(render(stateWithPlan(), null, inClassroom(16))).not.toContain('Equivalence laws:');
    expect(render(stateWithPlan('pathway', { sessions }), null, inClassroom(16))).toContain('Equivalence laws:');
  });
});

describe('live teacher screen', () => {
  it('offers the Calendar only in the live booth', () => {
    expect(render(stateWithPlan())).toContain('>Calendar</button>');
    expect(html(<TeacherScreen frame={teacherFrame([{ at: PAST, type: 'greeting' }], 10)} />)).not.toContain('>Calendar</button>');
  });
  it('offers "Open context" only when another panel is showing', () => {
    const other: LivePanel = { kind: 'student', studentId: 's29', planId: null, highlight: null };
    expect(render(stateWithPlan())).not.toContain('Open context');
    expect(render(stateWithPlan(), 'c1', [{ at: 1, type: 'panel', id: 'student', live: other }])).toContain('Open context');
    expect(render(stateWithPlan(), 'c1', [{ at: 1, type: 'panel', id: null }])).toContain('Open context');
  });
  it('renders an agent answer with bold figures, evidence chips and follow-ups', () => {
    const out = render(stateWithPlan());
    expect(out).toContain('<strong class="font-semibold text-egg-ink">75% to 42%</strong>');
    expect(out).toContain('data-cite="s17-quiz2"');
    expect(out).toContain('data-cite="s17-quiz2-q4"');
    expect(out).toContain('What gap is the class facing this week?');
    expect(out).not.toContain('Offline answer');
  });
  it('tags offline answers and reuses the canned copy', () => {
    const s = stateWithPlan();
    s.conversations[0].msgs[1] = { ...(s.conversations[0].msgs[1] as AssistantMsg), source: 'offline', canned: 'student', blocks: [] };
    const out = render(s);
    expect(out).toContain('Offline answer');
    expect(out).toContain('waiting for your approval');
  });
  it('lists the session conversations in the sidebar and marks the open one', () => {
    const out = render(stateWithPlan());
    expect(out).toMatch(/aria-current="page"[^>]*>Minh Anh · implication gap</);
    expect(out).not.toContain('Who needs me personally');
    expect(render({ ...stateWithPlan(), conversations: [] }, null)).toContain('No conversations yet');
  });
  it('adds an attention row for students who may not pass, only when there are some', () => {
    expect(render(seedState(), null)).not.toContain('May not pass');
    const withPlan = seedState();
    ensureRecord(withPlan, 's17').plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [] };
    expect(render(withPlan, null)).toContain('May not pass');
  });
  it('shows the story clock, Reset demo and live attention figures on the opening screen', () => {
    const out = render(stateWithPlan(), null);
    expect(out).toContain('Saturday, 31 October · 15:00');
    expect(out).toContain('Reset demo');
    expect(out).toContain('75→42');
    expect(out).toContain('12/55');
  });
  it('the landing eyebrow follows the story day', () => {
    const s = stateWithPlan();
    s.day = 43;
    const out = render(s, null);
    expect(out).toContain('Tuesday, 3 November · 15:00');
    expect(out).not.toContain('Saturday, 31 October');
  });
  it('the sidebar badge follows live need-support counts', () => {
    const s = stateWithPlan();
    s.students[16].status = 'onTrack';
    expect(render(s)).toContain('>11</span>');
  });
  it('adds a row for each student who has stopped practising, only while that lasts', () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    for (const d of [37, 38, 39]) rec.days[d] = { planned: 30, done: 0, check: null };
    expect(render(s, null)).toContain('Stopped practising · 0 of 90 min this week');
    expect(liveTodayRows(s).at(-1)).toMatchObject({ what: 'Minh Anh', figure: '0/90', prompt: 'Minh Anh has stopped practising. What should I do?' });
    rec.days[39].done = 15;
    expect(render(s, null)).not.toContain('Stopped practising');
  });
  it('hides the five-question tracker in live mode', () => {
    expect(render(stateWithPlan())).not.toContain('Five questions');
  });
});
