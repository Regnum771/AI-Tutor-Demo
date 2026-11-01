import { describe, expect, it } from 'vitest';
import { seedState } from '../live/seed';
import { CONCEPTS } from './knowledgeGraph';
import { FAQ, VOICE, faqLog, faqStats, voiceEvidenceId, voiceFor } from './voice';
import { MESSAGES } from './sources';

describe('the student question log', () => {
  it('points every entry at a real student, concept and FAQ, and every FAQ has entries', () => {
    const concepts = new Set(CONCEPTS.map((c) => c.id));
    for (const v of VOICE) {
      expect(v.studentIndex).toBeGreaterThanOrEqual(0);
      expect(v.studentIndex).toBeLessThan(55);
      expect(concepts.has(v.concept)).toBe(true);
      expect(v.faqId === null || FAQ.some((f) => f.id === v.faqId)).toBe(true);
      expect(v.day).toBeLessThan(40);
    }
    for (const f of FAQ) expect(faqLog(f.id).length).toBeGreaterThan(0);
    expect(new Set(VOICE.map(voiceEvidenceId)).size).toBe(VOICE.length);
  });
  it('lands on each student as message evidence with a day and time', () => {
    const s = seedState();
    const all = s.students.flatMap((x) => x.evidence);
    for (const v of VOICE) expect(all.find((e) => e.id === voiceEvidenceId(v))).toMatchObject({ kind: 'message', day: v.day, time: v.time });
  });
  it('keeps Minh Anh’s two Zalo messages, their ids and their text', () => {
    const ma = seedState().students.find((x) => x.id === 's17')!;
    expect(ma.evidence).toHaveLength(8);
    expect(ma.evidence.filter((e) => e.kind === 'message').map((e) => e.id)).toEqual(['s17-zalo-1', 's17-zalo-2']);
    expect(ma.evidence.find((e) => e.id === 's17-zalo-1')!.text).toBe(`“${MESSAGES[0].vi}” (${MESSAGES[0].evidence})`);
    expect(voiceFor('s17-zalo-1')).toMatchObject({ day: 30, time: '21:40', faqId: 'f-converse' });
  });
  it('computes FAQ figures from the log', () => {
    expect(faqStats('f-converse')).toMatchObject({ messages: 16, students: 13, timing: 'mostly within 2 days of Lecture 5' });
    const log = faqLog('f-converse');
    expect(log[0].day).toBeGreaterThanOrEqual(log.at(-1)!.day);
  });
});
