import { describe, expect, it } from 'vitest';
import { seedState } from '../../src/live/seed';
import { READ_TOOLS, readLabel, readTool } from './tools';

const state = seedState();
const find = (input: Record<string, unknown>) =>
  readTool(state, 'find_students', { status: '', concept: '', below: -1, name: '', ...input }) as Array<Record<string, unknown>>;

describe('read tools', () => {
  it('are strict object schemas', () => {
    expect(READ_TOOLS.map((t) => t.name)).toEqual(['get_class_overview', 'find_students', 'get_student', 'get_evidence', 'compare_students']);
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
