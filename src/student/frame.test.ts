import { describe, expect, it } from 'vitest';
import { STUDENT_SHOTS, studentFrame } from './frame';
import { CUES, sceneById } from '../scenario/scenes';
import { SC9 } from '../scenario/practice';

describe('studentFrame', () => {
  it('idles on the lock screen outside Sc6–Sc8', () => {
    expect(studentFrame(1, 0)).toEqual({ screen: 'lock', notification: 0, clock: '14:58' });
    expect(studentFrame(4, 5000)).toEqual({ screen: 'lock', notification: 0, clock: '14:58' });
  });
  it('lands the notification 1 s after Approve in Sc6', () => {
    expect(studentFrame(6, CUES.approveNotify - 1)).toEqual({ screen: 'lock', notification: 0, clock: '15:00' });
    expect(studentFrame(6, CUES.approveNotify + 1000)).toEqual({ screen: 'lock', notification: 1, clock: '15:00' });
  });
  it('walks Sc7 through lock → plan → practice → progress at 17:00', () => {
    expect(studentFrame(7, SC9.tap)).toMatchObject({ screen: 'lock', clock: '16:58' });
    expect(studentFrame(7, SC9.plan + 100)).toEqual({ screen: 'plan', variant: 'initial', local: 100, clock: '17:00' });
    expect(studentFrame(7, SC9.pickWrong)).toEqual({ screen: 'practice', local: SC9.pickWrong, clock: '17:00' });
    expect(studentFrame(7, SC9.progress + 50)).toEqual({ screen: 'progress', local: 50, clock: '17:00' });
  });
  it('shows the updated plan from the Sc8 cue', () => {
    expect(studentFrame(8, CUES.adaptUpdate - 1)).toMatchObject({ screen: 'lock', clock: '20:41' });
    expect(studentFrame(8, CUES.adaptUpdate + 10)).toEqual({ screen: 'plan', variant: 'updated', local: 10, clock: '20:42' });
  });
  it('student shots fall inside their scenes', () => {
    for (const [id, shots] of Object.entries(STUDENT_SHOTS)) {
      for (const t of shots) expect(t).toBeLessThanOrEqual(sceneById(Number(id)).durationMs);
    }
  });
});
