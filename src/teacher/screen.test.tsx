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
});
