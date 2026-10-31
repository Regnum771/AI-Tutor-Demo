import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { keysOf, liveEvents, SeenClock } from '../live/events';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { AssistantMsg, DemoState } from '../live/types';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const noop = new Proxy({}, { get: () => () => undefined }) as TeacherActions;

function render(state: DemoState, activeId: string | null = 'c1') {
  const seen = new SeenClock();
  seen.stamp(keysOf(state), 0);
  const events: TeacherEvent[] = [{ at: PAST, type: 'greeting' }, { at: PAST, type: 'classroomReveal' }, ...liveEvents(state, activeId, seen)];
  return html(
    <LiveProvider value={ctxFor(state, activeId)}>
      <TeacherScreen frame={teacherFrame(events, 10)} actions={noop} composer={{ value: '', onChange: () => {} }} />
    </LiveProvider>,
  );
}

describe('live teacher screen', () => {
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
  it('shows the story clock, Reset demo and live attention figures on the opening screen', () => {
    const out = render(stateWithPlan(), null);
    expect(out).toContain('Saturday, 31 October · 15:00');
    expect(out).toContain('Reset demo');
    expect(out).toContain('75→42');
    expect(out).toContain('12/55');
  });
  it('the sidebar badge follows live need-support counts', () => {
    const s = stateWithPlan();
    s.students[16].status = 'onTrack';
    expect(render(s)).toContain('>11</span>');
  });
  it('hides the five-question tracker in live mode', () => {
    expect(render(stateWithPlan())).not.toContain('Five questions');
  });
});
