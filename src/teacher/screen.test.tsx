import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { TeacherScreen } from './TeacherScreen';
import { Classroom } from './Classroom';

const render = (events: TeacherEvent[], t = 0) => html(<TeacherScreen frame={teacherFrame(events, t)} />);

describe('TeacherScreen', () => {
  it('opening screen types the greeting', () => {
    expect(render([{ at: 0, type: 'greeting' }], 1000)).toContain('Good after');
    expect(render([{ at: 0, type: 'greeting' }], 1000)).not.toContain('Lam.');
  });
  it('reveals only the shown answer blocks', () => {
    const ev: TeacherEvent[] = [
      { at: PAST, type: 'send', text: 'Why did Minh Anh’s quiz score drop?' },
      { at: 0, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
    ];
    expect(render(ev, 500)).toContain('75% to 42%');
    expect(render(ev, 500)).not.toContain('converse');
    expect(render(ev, 5500)).toContain('waiting for your approval');
  });
  it('renders the student panel with the edited 20:00 step after edit', () => {
    const ev: TeacherEvent[] = [{ at: PAST, type: 'load', topic: 'student' }];
    expect(render(ev)).toContain('19:00');
    expect(render([...ev, { at: PAST, type: 'edit' }])).toContain('20:00');
  });
  it('renders the classroom with placeholders before the reveal', () => {
    const before = html(<Classroom cls={teacherFrame([], 0).classroom} />);
    expect(before).toContain('need support');
    expect(before).not.toContain('Minh Anh');
    const after = html(<Classroom cls={teacherFrame([{ at: PAST, type: 'classroomReveal' }], 0).classroom} />);
    expect(after).toContain('Minh Anh');
  });
  it('shows the adapt message with its stamp', () => {
    const out = render([{ at: PAST, type: 'load', topic: 'student' }, { at: PAST, type: 'assistant', kind: 'adapt', blockMs: 0, stamp: '20:41' }]);
    expect(out).toContain('20:41');
    expect(out).toContain('0.35 → 0.72');
  });

  const FOOT = 'Illustrative demo data · fictional students';
  const clsFrame = (adapt: number, kpi = 1) => {
    const f = teacherFrame([{ at: PAST, type: 'classroomReveal' }], 0);
    return { ...f, view: 'classroom' as const, classroom: { ...f.classroom, kpi, tiles: 55, adapt } };
  };
  it('classroom counts agree after adapt', () => {
    const out = html(<TeacherScreen frame={clsFrame(1)} />);
    expect(out).toContain('>9</span>'); // sidebar badge
    expect(out).toContain('<span class="text-egg-orange">9</span> need support');
    expect(out).toContain('High risk 0');
    expect(out).toContain('Needs you 3');
    expect(out).toContain('Needs support 6');
    expect(out).toContain('On track 46');
  });
  it('classroom counts are the original before adapt', () => {
    const out = html(<TeacherScreen frame={clsFrame(0)} />);
    expect(out).toContain('>12</span>');
    expect(out).toContain('High risk 2');
    expect(out).toContain('Needs you 3');
    expect(out).toContain('Needs support 7');
  });
  it('in-app footer only in live mode', () => {
    const f = teacherFrame([], 0);
    const noop = new Proxy({}, { get: () => () => undefined }) as never;
    expect(html(<TeacherScreen frame={f} />)).not.toContain(FOOT);
    expect(html(<TeacherScreen frame={f} actions={noop} />)).toContain(FOOT);
    const chat = teacherFrame([{ at: PAST, type: 'send', text: 'hi' }], 0);
    expect(html(<TeacherScreen frame={chat} />)).not.toContain(FOOT);
    expect(html(<TeacherScreen frame={chat} actions={noop} />)).toContain(FOOT);
  });
});
