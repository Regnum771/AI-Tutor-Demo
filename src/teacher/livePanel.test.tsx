import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { DemoState, LivePanel } from '../live/types';
import { ContextPanel } from './ContextPanel';
import { PAST, teacherFrame } from './frame';
import { LivePanelBody } from './LivePanel';

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
});
