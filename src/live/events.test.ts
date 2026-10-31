import { describe, expect, it } from 'vitest';
import { PAST, teacherFrame } from '../teacher/frame';
import { keysOf, liveEvents, panelId, SeenClock } from './events';
import { stateWithPlan } from './fixtures';

describe('SeenClock', () => {
  it('stamps the first snapshot as long past and later items at their arrival', () => {
    const seen = new SeenClock();
    seen.stamp(['a'], 1000);
    seen.stamp(['a', 'b'], 2000);
    expect(seen.get('a')).toBe(PAST);
    expect(seen.get('b')).toBe(2000);
    seen.stamp(['b'], 3000);
    expect(seen.get('b')).toBe(2000);
    seen.clear();
    seen.stamp(['c'], 4000);
    expect(seen.get('c')).toBe(4000);
  });
});

describe('liveEvents', () => {
  it('keys every message and the pending run', () => {
    const s = stateWithPlan();
    expect(keysOf(s)).toEqual(['c1:m0', 'c1:m1']);
    s.conversations[0].pending = { steps: ['x'] };
    expect(keysOf(s)).toEqual(['c1:m0', 'c1:m1', 'c1:pending:2']);
  });
  it('replays a conversation from the first snapshot as already finished', () => {
    const s = stateWithPlan();
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    const f = teacherFrame(liveEvents(s, 'c1', seen), 10);
    expect(f.title).toBe('Minh Anh · implication gap');
    expect(f.sansTitle).toBe(true);
    expect(f.messages.map((m) => m.role)).toEqual(['teacher', 'assistant']);
    expect(f.messages[1]).toMatchObject({ kind: 'live', appear: 1 });
    expect(f.messages[1].live?.blocks).toHaveLength(2);
    expect(f.panel).toMatchObject({ id: 'student', appear: 1, live: { kind: 'student', studentId: 's17', planId: 'p1' } });
  });
  it('animates a new answer from when it arrived', () => {
    const s = stateWithPlan();
    const seen = new SeenClock();
    seen.stamp(['c1:m0'], 0);
    seen.stamp(keysOf(s), 5000);
    const f = teacherFrame(liveEvents(s, 'c1', seen), 5100);
    expect(f.messages[1].shown).toBe(1);
    expect(f.messages[1].appear).toBeLessThan(1);
    expect(f.panel?.appear).toBeLessThan(1);
  });
  it('shows the agent steps while a run is pending', () => {
    const s = stateWithPlan();
    s.conversations[0].pending = { steps: ['Student Analysis Agent · reading the class overview'] };
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).thinking?.lines).toEqual(['Student Analysis Agent · reading the class overview']);
    s.conversations[0].pending = { steps: [] };
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).thinking?.lines).toEqual(['Reading your class context']);
  });
  it('carries the adapt stamp and shows nothing without a known conversation', () => {
    const s = stateWithPlan();
    const msg = s.conversations[0].msgs[1];
    if (msg.role === 'assistant') msg.stamp = '20:40';
    const seen = new SeenClock();
    seen.stamp(keysOf(s), 0);
    expect(teacherFrame(liveEvents(s, 'c1', seen), 10).messages[1].stamp).toBe('20:40');
    expect(liveEvents(s, null, seen)).toEqual([]);
    expect(liveEvents(s, 'c9', seen)).toEqual([]);
  });
  it('maps live panels onto the context ids', () => {
    expect(panelId({ kind: 'student', studentId: 's17', planId: null, highlight: null })).toBe('student');
    expect(panelId({ kind: 'class', planId: null })).toBe('class');
    expect(panelId({ kind: 'checkIns', planId: 'p1' })).toBe('attention');
  });
});
