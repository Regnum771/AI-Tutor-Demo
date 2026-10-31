import { describe, expect, it } from 'vitest';
import { GREETING, PAST, teacherFrame, type TeacherEvent } from './frame';

const at = (events: TeacherEvent[], t: number) => teacherFrame(events, t);

describe('teacherFrame', () => {
  it('starts on the empty chat view', () => {
    const f = at([], 0);
    expect(f.view).toBe('chat');
    expect(f.messages).toEqual([]);
    expect(f.panel).toBeNull();
    expect(f.greeting).toEqual({ chars: 0, rows: [0, 0, 0] });
    expect(f.ticks).toEqual([false, false, false, false, false]);
  });

  it('ignores events that have not happened yet, in any order', () => {
    const f = at([{ at: 5000, type: 'view', view: 'classroom' }, { at: 100, type: 'tick', q: 2 }], 1000);
    expect(f.view).toBe('chat');
    expect(f.ticks[2]).toBe(true);
  });

  it('types the greeting at 10 cps and brings the rows in at +2500/+3100/+3700', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'greeting' }];
    expect(at(ev, 1000).greeting.chars).toBe(10);
    expect(at(ev, 9000).greeting.chars).toBe(GREETING.length);
    expect(at(ev, 2400).greeting.rows).toEqual([0, 0, 0]);
    expect(at(ev, 9000).greeting.rows).toEqual([1, 1, 1]);
  });

  it('types into the composer, then send clears it and posts the teacher message', () => {
    const ev: TeacherEvent[] = [
      { at: 0, type: 'type', text: 'Hello there', cps: 10 },
      { at: 2000, type: 'send', text: 'Hello there' },
    ];
    expect(at(ev, 500).composer).toBe('Hello');
    const f = at(ev, 2500);
    expect(f.composer).toBe('');
    expect(f.messages).toHaveLength(1);
    expect(f.messages[0]).toMatchObject({ role: 'teacher', text: 'Hello there' });
  });

  it('shows thinking lines one per step, then the assistant reveals block by block', () => {
    const ev: TeacherEvent[] = [
      { at: 0, type: 'think', lines: ['a', 'b'], stepMs: 1000, title: 'T' },
      { at: 3000, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
    ];
    expect(at(ev, 500).thinking?.shown).toBe(1);
    expect(at(ev, 1500).thinking?.shown).toBe(2);
    expect(at(ev, 1500).title).toBe('T');
    const f = at(ev, 4500);
    expect(f.thinking).toBeNull();
    expect(f.messages[0]).toMatchObject({ role: 'assistant', kind: 'answer', topic: 'student', shown: 2 });
  });

  it('opens the panel, then grows the bars from +1000 over 2000 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'panel', id: 'student' }];
    expect(at(ev, 900).panel?.bars).toBe(0);
    expect(at(ev, 3000).panel).toMatchObject({ id: 'student', appear: 1, bars: 1 });
    expect(at([...ev, { at: 4000, type: 'panel', id: null }], 4100).panel).toBeNull();
  });

  it('load replaces the thread with a finished topic conversation and opens its panel', () => {
    const f = at([{ at: 0, type: 'send', text: 'x' }, { at: 100, type: 'load', topic: 'student' }], 2000);
    expect(f.messages).toHaveLength(2);
    expect(f.messages[1]).toMatchObject({ kind: 'answer', topic: 'student', appear: 1 });
    expect(f.panel?.id).toBe('student');
    expect(f.title).toBe('Minh Anh’s Quiz 2 drop');
  });

  it('scrolls, edits and approves the proposal', () => {
    const ev: TeacherEvent[] = [
      { at: PAST, type: 'panel', id: 'student' },
      { at: 0, type: 'panelScroll', y: 120, dur: 1000 },
      { at: 2000, type: 'edit' },
      { at: 4000, type: 'approve', id: 'student' },
    ];
    expect(at(ev, 1000).panel?.scroll).toBe(120);
    expect(at(ev, 2000).panel).toMatchObject({ edited: true, editFlash: 1 });
    expect(at(ev, 3000).panel?.editFlash).toBe(0);
    expect(at(ev, 4000).approved).toEqual(['student']);
  });

  it('adaptTwin blends the twin and switches to the follow-up after 2000 ms', () => {
    const ev: TeacherEvent[] = [{ at: PAST, type: 'panel', id: 'student' }, { at: 0, type: 'adaptTwin' }];
    expect(at(ev, 1999).panel?.followUp).toBe(false);
    expect(at(ev, 2000).panel).toMatchObject({ twin: 1, followUp: true });
  });

  it('builds the classroom: KPIs over 2700 ms, 55 tiles from +200 over 7000 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'classroomReveal' }];
    expect(at(ev, 199).classroom.tiles).toBe(0);
    expect(at(ev, 200).classroom.tiles).toBe(1);
    expect(at(ev, 7200).classroom.tiles).toBe(55);
    expect(at(ev, 2700).classroom.kpi).toBe(1);
  });

  it('pulses until a student is selected; adaptClass runs over 2500 ms', () => {
    const ev: TeacherEvent[] = [{ at: 0, type: 'pulse' }];
    expect(at(ev, 785).classroom.pulse).toBeGreaterThan(0.9);
    expect(at([...ev, { at: 1000, type: 'select', index: 16 }], 1500).classroom).toMatchObject({ pulse: 0, selected: 16 });
    expect(at([{ at: 0, type: 'adaptClass' }], 2500).classroom.adapt).toBe(1);
  });

  it('reset clears the thread, panel and title but keeps ticks and approvals', () => {
    const f = at([
      { at: 0, type: 'tick', q: 0 },
      { at: 0, type: 'approve', id: 'class' },
      { at: 0, type: 'load', topic: 'class' },
      { at: 10, type: 'reset' },
    ], 20);
    expect(f.messages).toEqual([]);
    expect(f.panel).toBeNull();
    expect(f.title).toBeNull();
    expect(f.ticks[0]).toBe(true);
    expect(f.approved).toEqual(['class']);
  });
});
