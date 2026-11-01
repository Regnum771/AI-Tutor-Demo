import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { ensureRecord } from '../live/study/record';
import { LiveProvider } from '../live/LiveContext';
import type { DemoState, LivePanel } from '../live/types';
import { ContextPanel } from './ContextPanel';
import { PAST, teacherFrame } from './frame';
import { LivePanelBody } from './LivePanel';
import { panelForEvidence } from './LiveText';

const render = (state: DemoState, live: LivePanel) =>
  html(<LiveProvider value={ctxFor(state)}><LivePanelBody live={live} bars={1} /></LiveProvider>);
const student = (over: Partial<Extract<LivePanel, { kind: 'student' }>> = {}): LivePanel =>
  ({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null, ...over });

describe('live panels', () => {
  it('student panel: twin meters, highlighted evidence and the proposed plan card', () => {
    const out = render(stateWithPlan(), student({ highlight: 's17-quiz2' }));
    expect(out).toContain('Nguyễn Minh Anh');
    expect(out).toContain('Implication: 0.31 mastery');
    expect(out).toContain('Rebuild implication, then equivalence');
    expect(out).toContain('Approve &amp; send');
    expect(out).toContain('Not now');
    expect(out).toMatch(/style="background:[^"]*" data-evidence="s17-quiz2"/);
  });
  it('a recovered escalated student shows On track, not Needs you', () => {
    const state = stateWithPlan();
    const st = state.students.find((x) => x.id === 's17')!;
    st.status = 'onTrack';
    st.escalated = true;
    const out = render(state, student());
    expect(out).toContain('On track');
    expect(out).not.toContain('Needs you');
  });
  it('shows the plan status once it has been acted on', () => {
    const sent = render(stateWithPlan('pathway', { status: 'sent' }), student());
    expect(sent).toContain('Sent to Minh Anh’s phone');
    expect(sent).not.toContain('Approve &amp; send');
    const auto = render(stateWithPlan('pathway', { status: 'autoApproved' }), student());
    expect(auto).toContain('Auto-approved · within your policy');
    expect(auto).toContain('Auto-approved · sent to the phone');
  });
  it('class panel: group meters, the affected list and the class activity card', () => {
    const out = render(stateWithPlan('classActivity'), { kind: 'class', planId: 'p1' });
    expect(out).toContain('Group G1:');
    expect(out).toContain('Who’s affected');
    expect(out).toContain('Approve plan');
  });
  it('class panel: lists the class evidence and highlights a cited entry', () => {
    const plain = render(stateWithPlan('classActivity'), { kind: 'class', planId: 'p1' });
    expect(plain).toContain('Class evidence');
    expect(plain).toContain('data-evidence="class-quiz2-q4"');
    expect(plain).not.toMatch(/style="background:[^"]*" data-evidence="class-quiz2-q4"/);
    const lit = render(stateWithPlan('classActivity'), { kind: 'class', planId: 'p1', highlight: 'class-quiz2-q4' });
    expect(lit).toMatch(/style="background:[^"]*" data-evidence="class-quiz2-q4"/);
  });
  it('an evidence chip carries its id to the panel', () => {
    expect(panelForEvidence('class-quiz2-q4')).toEqual({ kind: 'class', planId: null, highlight: 'class-quiz2-q4' });
    expect(panelForEvidence('s17-quiz2')).toEqual({ kind: 'student', studentId: 's17', planId: null, highlight: 's17-quiz2' });
  });
  it('student panel: a meter for what the plan practises', () => {
    const sessions = [{ time: '15:30', title: 'Laws', minutes: 8, concept: 'equivLaws' as const, isMasteryCheck: true, studentId: null }];
    expect(render(stateWithPlan(), student())).not.toContain('Equivalence laws:');
    expect(render(stateWithPlan('pathway', { sessions }), student())).toContain('Equivalence laws:');
  });
  it('check-ins panel: each student with their latest note', () => {
    const out = render(stateWithPlan('checkIns'), { kind: 'checkIns', planId: 'p1' });
    expect(out).toContain('2 students need a conversation');
    expect(out).toContain('Works hard in tutorial but freezes on truth tables');
    expect(out).toContain('No reply to two check-in messages');
    expect(out).toContain('Book all');
  });
  it('ContextPanel renders the live body when the frame panel is live', () => {
    const s = stateWithPlan();
    const panel = teacherFrame([{ at: PAST, type: 'panel', id: 'student', live: student() }], 0).panel!;
    const out = html(<LiveProvider value={ctxFor(s)}><ContextPanel panel={panel} approved={false} /></LiveProvider>);
    expect(out).toContain('Student context');
    expect(out).toContain('Approve &amp; send');
  });

  it('uses the sans face for plan titles that can name a student', () => {
    const pathway = render(stateWithPlan(), student());
    expect(pathway).not.toMatch(/font-serif[^>]*>Rebuild implication/);
    const cls = render(stateWithPlan('classActivity'), { kind: 'class', planId: 'p1' });
    expect(cls).toMatch(/font-serif[^>]*>Group recap</);
  });
});

describe('road to the exam', () => {
  const withStudy = () => {
    const s = stateWithPlan();
    s.day = 41;
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'More on equivalence.', leftOut: [], source: 'agents', days: [{ day: 41, minutes: 20, clo: 'CLO2', concepts: ['equivalence'] }] };
    rec.days[40] = { planned: 20, done: 12, check: null };
    rec.replans.push({ day: 40, signal: 'markSwing', reason: 'More on equivalence.' });
    return s;
  };
  it('shows the estimate, minutes and the last change for a student with a plan', () => {
    const out = render(withStudy(), { kind: 'student', studentId: 's17', planId: null, highlight: null });
    expect(out).toContain('Road to the exam');
    expect(out).toContain('At risk');
    expect(out).toContain('12 of 20 min');
    expect(out).toContain('More on equivalence.');
  });
  it('shows the latest mark', () => {
    const s = withStudy();
    s.study.s17.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(render(s, { kind: 'student', studentId: 's17', planId: null, highlight: null })).toContain('Quiz 3: 22');
  });
  it('stays out of the way for a student who has not set up', () => {
    expect(render(stateWithPlan(), { kind: 'student', studentId: 's17', planId: null, highlight: null })).not.toContain('Road to the exam');
  });
});

describe('a sent plan names its date', () => {
  it('shows the plan’s date, not "Today", once the story moves on', () => {
    const s = stateWithPlan();
    s.plans[0].status = 'sent';
    s.plans[0].day = 'Today';
    s.plans[0].date = 43;
    const out = render(s, student());
    expect(out).toContain('Tue 3 Nov');
    expect(out).not.toMatch(/within your policy · Today|agents · Today/);
  });
});
