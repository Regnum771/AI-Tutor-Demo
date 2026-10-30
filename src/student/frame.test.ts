import { describe, expect, it } from 'vitest';
import { STUDENT_SHOTS, studentFrame } from './frame';
import { CUES, sceneById } from '../scenario/scenes';
import { SC9 } from '../scenario/practice';

describe('studentFrame', () => {
  it('idles on the lock screen in non-phone scenes', () => {
    expect(studentFrame(1, 0)).toEqual({ screen: 'lock', notification: 0 });
    expect(studentFrame(8, 5000)).toEqual({ screen: 'lock', notification: 0 });
  });
  it('lands the notification at the end of Sc7', () => {
    expect(studentFrame(7, 0)).toEqual({ screen: 'lock', notification: 0 });
    expect(studentFrame(7, CUES.sc7Notify + 1000)).toEqual({ screen: 'lock', notification: 1 });
  });
  it('walks Sc9 through lock → plan → practice → progress', () => {
    expect(studentFrame(9, SC9.tap).screen).toBe('lock');
    expect(studentFrame(9, SC9.plan + 100)).toEqual({ screen: 'plan', variant: 'initial', local: 100 });
    expect(studentFrame(9, SC9.pickWrong)).toEqual({ screen: 'practice', local: SC9.pickWrong });
    expect(studentFrame(9, SC9.progress + 50)).toEqual({ screen: 'progress', local: 50 });
  });
  it('shows the updated plan at the Sc10 cue', () => {
    expect(studentFrame(10, CUES.sc10Update - 1).screen).toBe('lock');
    expect(studentFrame(10, CUES.sc10Update + 10)).toEqual({ screen: 'plan', variant: 'updated', local: 10 });
  });
  it('student shots fall inside their scenes', () => {
    for (const [id, shots] of Object.entries(STUDENT_SHOTS)) {
      for (const t of shots) expect(t).toBeLessThanOrEqual(sceneById(Number(id)).durationMs);
    }
  });
});
