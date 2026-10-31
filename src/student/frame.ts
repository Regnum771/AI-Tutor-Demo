import { prog } from '../engine/anim';
import { SC9 } from '../scenario/practice';
import { CUES } from '../scenario/scenes';

export type StudentScreen =
  | { screen: 'lock'; notification: number; clock: string }
  | { screen: 'plan'; variant: 'initial' | 'updated'; local: number; clock: string }
  | { screen: 'practice'; local: number; clock: string }
  | { screen: 'progress'; local: number; clock: string };

/** Which phone screen shows at scene time t. Sc7 reuses the practice timeline (SC9 constants, scene time). */
export function studentFrame(sceneId: number, t: number): StudentScreen {
  if (sceneId === 6) return { screen: 'lock', notification: prog(t, CUES.approveNotify, 500), clock: '15:00' };
  if (sceneId === 7) {
    if (t < SC9.plan) return { screen: 'lock', notification: 1, clock: '16:58' };
    if (t < SC9.practice) return { screen: 'plan', variant: 'initial', local: t - SC9.plan, clock: '17:00' };
    if (t < SC9.progress) return { screen: 'practice', local: t, clock: '17:00' };
    return { screen: 'progress', local: t - SC9.progress, clock: '17:00' };
  }
  if (sceneId === 8) {
    return t >= CUES.adaptUpdate
      ? { screen: 'plan', variant: 'updated', local: t - CUES.adaptUpdate, clock: '20:42' }
      : { screen: 'lock', notification: 0, clock: '20:41' };
  }
  return { screen: 'lock', notification: 0, clock: '14:58' };
}

/** Phone timestamps for the contact sheet. */
export const STUDENT_SHOTS: Record<number, number[]> = {
  6: [8200],
  7: [1800, 4500, 9500, 12000, 15800, 18500],
  8: [10500],
};
