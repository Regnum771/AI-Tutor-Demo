import { describe, expect, it } from 'vitest';
import { sceneById } from '../scenario/scenes';
import { MINH_ANH } from '../scenario/minhAnh';
import { teacherFrame } from './frame';
import { scriptFor, TEACHER_SCENES } from './script';

const frame = (scene: number, t: number) => teacherFrame(scriptFor(scene).events, t);
const persistent = (scene: number, t: number) => {
  const f = frame(scene, t);
  return { view: f.view, title: f.title, msgs: f.messages.length, panel: f.panel?.id ?? null, approved: f.approved, ticks: f.ticks, edited: f.panel?.edited ?? false, selected: f.classroom.selected };
};

describe('teacher scene scripts', () => {
  it('each scene starts where the previous one ended', () => {
    for (const id of TEACHER_SCENES.slice(1)) {
      expect(persistent(id, 0), `Sc${id}`).toEqual(persistent(id - 1, sceneById(id - 1).durationMs));
    }
  });
  it('own events are in ascending time order and inside the scene', () => {
    for (const id of TEACHER_SCENES) {
      const own = scriptFor(id).events.filter((e) => e.at >= 0).map((e) => e.at);
      expect(own).toEqual([...own].sort((a, b) => a - b));
      for (const at of own) expect(at).toBeLessThanOrEqual(sceneById(id).durationMs);
    }
  });
  it('Sc2 types the greeting, brings in the rows, then shows the tracker', () => {
    expect(frame(2, 1500).greeting.chars).toBe(10);
    expect(frame(2, 5100).greeting.rows).toEqual([1, 1, 1]);
    expect(frame(2, 9000).tracker).toBe(1);
  });
  it('Sc3 switches to the Classroom, reveals it, pulses Minh Anh and ticks Q1', () => {
    expect(frame(3, 1400).view).toBe('chat');
    expect(frame(3, 1600).view).toBe('classroom');
    expect(frame(3, 1900).classroom.tiles).toBe(0);
    expect(frame(3, 9500).classroom.tiles).toBe(55);
    expect(frame(3, 10000).classroom.pulse).toBeGreaterThan(0);
    expect(frame(3, 11000).ticks[0]).toBe(true);
  });
  it('Sc4 selects Minh Anh, asks, thinks, answers, opens the panel and ticks Q2–Q3', () => {
    expect(frame(4, 1000).classroom.selected).toBe(MINH_ANH.index);
    expect(frame(4, 3600).composer.length).toBeGreaterThan(0);
    expect(frame(4, 4900).messages[0]).toMatchObject({ role: 'teacher', text: 'Why did Minh Anh’s quiz score drop?' });
    expect(frame(4, 6500).thinking?.shown).toBe(2);
    expect(frame(4, 10500).messages[1]).toMatchObject({ kind: 'answer', topic: 'student', shown: 3 });
    expect(frame(4, 16000).panel?.id).toBe('student');
    expect(frame(4, 19000).ticks.slice(1, 3)).toEqual([true, true]);
  });
  it('Sc5 asks the class question, opens the class panel and ticks Q4', () => {
    expect(frame(5, 6500).panel?.id).toBe('class');
    // Spec: panel at 6200, bars grow 6500–7500.
    expect(frame(5, 6100).panel?.id).toBe('student');
    expect(frame(5, 6500).panel?.bars).toBe(0);
    expect(frame(5, 7000).panel?.bars).toBeGreaterThan(0.2);
    expect(frame(5, 7000).panel?.bars).toBeLessThan(1);
    expect(frame(5, 7500).panel?.bars).toBe(1);
    expect(frame(5, 8000).ticks[3]).toBe(true);
    expect(frame(5, 10000).messages).toHaveLength(4);
  });
  it('Sc6 reloads Minh Anh, edits step 4, approves and confirms; Q5 ticks', () => {
    expect(frame(6, 700)).toMatchObject({ title: 'Minh Anh’s Quiz 2 drop' });
    expect(frame(6, 700).messages).toHaveLength(2);
    expect(frame(6, 3000).panel?.scroll).toBe(120);
    expect(frame(6, 4600).panel?.edited).toBe(true);
    expect(frame(6, 6600).approved).toContain('student');
    expect(frame(6, 8000).messages).toHaveLength(3);
    expect(frame(6, 8000).ticks).toEqual([true, true, true, true, true]);
  });
  it('the Minh Anh pulse is continuous across the Sc3 to Sc4 cut', () => {
    const end = frame(3, sceneById(3).durationMs).classroom.pulse;
    const start = frame(4, 0).classroom.pulse;
    expect(end).toBeGreaterThan(0);
    expect(Math.abs(start - end)).toBeLessThan(0.01);
  });
  it('selecting Minh Anh stops the pulse', () => {
    expect(frame(4, 1000).classroom.pulse).toBe(0);
  });
  it('Sc7 holds the last Sc6 frame', () => {
    expect(persistent(7, 20000)).toEqual(persistent(6, 15000));
  });
  it('Sc8 posts the adapt message, blends the twin, then updates the Classroom', () => {
    expect(frame(8, 0).tracker).toBe(1);
    expect(frame(8, 0).ticks).toEqual([true, true, true, true, true]);
    expect(frame(8, 200).tracker).toBe(1);
    expect(frame(8, 1500).messages.at(-1)).toMatchObject({ kind: 'adapt', stamp: '20:41' });
    expect(frame(8, 5000).panel).toMatchObject({ twin: 1, followUp: true });
    expect(frame(8, 8100).view).toBe('classroom');
    expect(frame(8, 11000).classroom.adapt).toBe(1);
  });
  it('cursor keys are in ascending time order', () => {
    for (const id of TEACHER_SCENES) {
      const keys = scriptFor(id).cursor.map((k) => k.t);
      expect(keys).toEqual([...keys].sort((a, b) => a - b));
    }
  });
});
