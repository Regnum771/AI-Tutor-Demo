import { describe, expect, it } from 'vitest';
import { seedState } from '../../src/live/seed';
import { ensureRecord } from '../../src/live/study/record';
import { approvePlan, phoneAnswer, phoneOpen, type Result } from '../../src/live/reducer';
import { stateWithPlan } from '../../src/live/fixtures';
import type { DemoState } from '../../src/live/types';
import { READ_TOOLS, readLabel, readTool } from './tools';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

const state = seedState();
const find = (input: Record<string, unknown>) =>
  readTool(state, 'find_students', { status: '', concept: '', below: -1, name: '', ...input }) as Array<Record<string, unknown>>;

describe('read tools', () => {
  it('are strict object schemas', () => {
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students', 'get_exam_outlook', 'get_class_questions', 'get_lecture_materials']);
    for (const t of READ_TOOLS) {
      expect(t.strict).toBe(true);
      expect(t.input_schema.additionalProperties).toBe(false);
    }
  });
  it('overview reports KPIs, group figures and class evidence', () => {
    const o = readTool(state, 'get_class_overview', {}) as Record<string, unknown>;
    expect(o).toMatchObject({ needSupport: 12, highRisk: 5, escalated: [{ id: 's29' }, { id: 's42' }, { id: 's51' }], now: '15:00' });
    expect(Object.keys(o.topicMasteryByGroup as object)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5']);
    expect((o.evidence as { id: string }[]).map((e) => e.id)).toContain('class-quiz2-q4');
  });
  it('finds students by status, concept threshold and accent-insensitive name', () => {
    expect(find({ status: 'onTrack' })).toHaveLength(43);
    expect(find({ status: 'escalated' }).map((s) => s.id)).toEqual(['s29', 's42', 's51']);
    const weak = find({ concept: 'implication', below: 0.35 });
    expect(weak.length).toBeGreaterThan(0);
    for (const s of weak) expect(s.implication as number).toBeLessThan(0.35);
    expect(find({ name: 'nguyen minh anh' }).map((s) => s.id)).toEqual(['s17']);
  });
  it('reads one twin with gaps, and fails clearly on an unknown id', () => {
    const t = readTool(state, 'get_student', { student_id: 's17' }) as Record<string, unknown>;
    expect(t).toMatchObject({ name: 'Nguyễn Minh Anh', group: 'G4', gaps: ['implication', 'biconditional', 'equivalence'], plans: [] });
    expect(() => readTool(state, 'get_student', { student_id: 's99' })).toThrow('Unknown student id s99.');
  });
  it('filters evidence by kind and compares students', () => {
    expect(readTool(state, 'get_evidence', { student_id: 's17', kind: 'message' })).toHaveLength(2);
    expect(readTool(state, 'get_evidence', { student_id: 's17', kind: '' })).toHaveLength(8);
    expect(readTool(state, 'compare_students', { student_ids: ['s17', 's29'] })).toHaveLength(2);
  });
  it('evidence for agents leaves out the phone-only result and planId', () => {
    const s = ok(phoneAnswer(ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0)), 0));
    const practice = readTool(s, 'get_evidence', { student_id: 's17', kind: 'practice' }) as Record<string, unknown>[];
    expect(practice.length).toBeGreaterThan(0);
    for (const e of practice) {
      expect(e).not.toHaveProperty('result');
      expect(e).not.toHaveProperty('planId');
    }
  });
  it('labels each call as a thinking line', () => {
    expect(readLabel(state, 'get_class_overview', {})).toBe('Student Analysis Agent · reading the class overview');
    expect(readLabel(state, 'get_student', { student_id: 's17' })).toBe('Student Analysis Agent · reading Minh Anh’s learning twin');
    expect(readLabel(state, 'get_evidence', { student_id: 's17', kind: 'quiz' })).toBe('Student Analysis Agent · reading Minh Anh’s quiz responses');
    expect(readLabel(state, 'find_students', { status: '', concept: 'implication', below: 0.35, name: '' })).toBe('Student Analysis Agent · finding students below 0.35 on Implication');
    expect(readLabel(state, 'find_students', { status: 'escalated', concept: '', below: -1, name: '' })).toBe('Student Analysis Agent · searching the class');
    expect(readLabel(state, 'compare_students', { student_ids: ['s1', 's2', 's3'] })).toBe('Student Analysis Agent · comparing 3 learning twins');
    expect(readLabel(state, 'report', {})).toBeNull();
  });
});

describe('exam outlook', () => {
  it('reports the road to the exam, and says when a student has not set up', () => {
    const state = seedState();
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({ setUp: false, passMark: 4, nextAssessment: { title: 'Assignment 2' } });
    const rec = ensureRecord(state, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents', days: [{ day: 41, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    rec.days[40] = { planned: 20, done: 12, check: null };
    rec.replans.push({ day: 40, signal: 'setup', reason: 'Implication first.' });
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({
      setUp: true, band: 'At risk', minutesPlanned: 0, minutesDone: 12, lastChange: { reason: 'Implication first.' },
    });
    expect(readLabel(state, 'get_exam_outlook', { student_id: 's17' })).toBe('Student Analysis Agent · reading Minh Anh’s road to the exam');
  });
  it('measures against the current plan, and lists marks', () => {
    const state = seedState();
    const rec = ensureRecord(state, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({ minutesPlanned: 0, minutesDone: 0, marks: [] });
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'agents', days: [40, 41, 42].map((day) => ({ day, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })) };
    rec.days[39] = { planned: 99, done: 50, check: null };
    rec.days[40] = { planned: 20, done: 12, check: null };
    state.day = 41;
    rec.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(readTool(state, 'get_exam_outlook', { student_id: 's17' })).toMatchObject({
      minutesPlanned: 40, minutesDone: 12, marks: [{ title: 'Quiz 3', mark: 22, date: 'Thu 12 Nov' }], practisedLast7Days: { done: 62, planned: 119 },
    });
    expect(READ_TOOLS.find((t) => t.name === 'get_exam_outlook')!.description).toContain('practisedLast7Days');
    expect(READ_TOOLS.find((t) => t.name === 'get_exam_outlook')!.description).toContain('marks');
  });
  it('names the students whose own Quiz 2 Q4 answer chose the converse', () => {
    const named = find({ mistake: 'converse' });
    const figure = Number(/(\d+) of \d+ chose the converse/.exec(state.classEvidence.find((e) => e.id === 'class-quiz2-q4')!.text)![1]);
    expect(named).toHaveLength(figure);
    expect(named.map((s) => s.id)).toContain('s17');
    for (const s of named) expect(state.students.find((x) => x.id === s.id)!.evidence.find((e) => e.id === `${s.id}-quiz2-q4`)!.text).toMatch(/converse/i);
    expect(find({ mistake: '' }).length).toBe(state.students.length);
  });
  it('finds students who may not pass, among those with a plan', () => {
    const state = seedState();
    expect(readTool(state, 'find_students', { status: 'examRisk', concept: '', below: -1, name: '' })).toEqual([]);
    const rec = ensureRecord(state, 's17');
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [] };
    expect(readTool(state, 'find_students', { status: 'examRisk', concept: '', below: -1, name: '' })).toMatchObject([{ id: 's17' }]);
  });
});

describe('student voice', () => {
  it('lists the class questions with figures and the ids behind them', () => {
    const state = seedState();
    const qs = readTool(state, 'get_class_questions', {}) as Array<Record<string, unknown>>;
    const converse = qs.find((q) => q.id === 'f-converse')!;
    expect(converse).toMatchObject({ messages: 16, students: 13, concept: 'implication' });
    expect(converse.evidenceIds).toContain('s17-zalo-1');
    expect(typeof converse.latestDate).toBe('string');
    const counts = qs.map((q) => q.students as number);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(readLabel(state, 'get_class_questions', {})).toBe('Student Analysis Agent · reading what students are asking');
  });
  it('places messages relative to a lecture, and adds the record and forecast to the twin', () => {
    const state = seedState();
    const msgs = readTool(state, 'get_evidence', { student_id: 's17', kind: 'message' }) as Array<Record<string, unknown>>;
    expect(msgs[0]).toMatchObject({ id: 's17-zalo-1', lecture: '1 day after Lecture 5' });
    const t = readTool(state, 'get_student', { student_id: 's17' }) as Record<string, unknown>;
    expect(t).toMatchObject({ forecast: { value: 4.4, band: 'At risk' } });
    expect(t.gpa).toBeGreaterThan(0);
    expect((t.history as unknown[]).length).toBeGreaterThanOrEqual(4);
  });
});
describe('lecture materials', () => {
  const state = seedState();
  const materials = (input: Record<string, unknown>) =>
    readTool(state, 'get_lecture_materials', { lecture: -1, concept: '', student_id: '', ...input }) as Array<Record<string, unknown>>;
  it('lists a lecture’s resources with their class engagement, and nothing opened before the lecture', () => {
    expect(materials({ lecture: 7 }).map((r) => r.id)).toEqual(['l7-slides', 'l7-recording', 'l7-worksheet', 'l7-video']);
    expect(materials({ lecture: 7 })[0]).toMatchObject({
      lecture: 7, lectureDate: 'Tue 3 Nov', kind: 'slides', title: 'Lecture 7 · Equivalence laws.pdf', concepts: ['equivLaws'], bloom: 'Understand', minutes: 25,
      source: 'Course slides', released: false, classEngagement: { opened: 0, of: 55, meanFraction: 0 },
    });
    expect(materials({ lecture: 5 }).find((r) => r.id === 'l5-recording')).toMatchObject({ released: true, classEngagement: { opened: 31, of: 55, meanFraction: 0.46 } });
    expect(materials({})).toHaveLength(29);
  });
  it('filters by concept, and adds one student’s own figures', () => {
    expect(materials({ concept: 'implication' }).map((r) => r.id)).toEqual(['l5-slides', 'l5-recording', 'l5-worksheet', 'l5-reading', 'l9-revision']);
    expect(materials({ lecture: 5 })[0]).not.toHaveProperty('opened');
    const ma = materials({ lecture: 5, student_id: 's17' });
    expect(ma.find((r) => r.id === 'l5-recording')).toMatchObject({ opened: true, fraction: 0.22 });
    expect(materials({ lecture: 6, student_id: 's8' }).every((r) => r.opened === false && r.fraction === 0)).toBe(true);
  });
  it('fails clearly on an unknown lecture, concept or student, and never returns a link', () => {
    expect(() => materials({ lecture: 12 })).toThrow('Unknown lecture 12. Lectures run from 1 to 9; use -1 for every lecture.');
    expect(() => materials({ concept: 'predicates' })).toThrow('Unknown concept predicates.');
    expect(() => materials({ student_id: 's99' })).toThrow('Unknown student id s99.');
    expect(JSON.stringify(materials({}))).not.toMatch(/https?:|www\./);
  });
  it('labels the call as a thinking line', () => {
    expect(readLabel(state, 'get_lecture_materials', { lecture: 7, concept: '', student_id: '' })).toBe('Student Analysis Agent · reading the materials for Lecture 7');
    expect(readLabel(state, 'get_lecture_materials', { lecture: -1, concept: 'implication', student_id: '' })).toBe('Student Analysis Agent · reading the learning materials');
  });
});
