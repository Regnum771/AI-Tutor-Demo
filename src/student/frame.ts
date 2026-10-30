import { prog } from '../engine/anim';
import { SC9 } from '../scenario/practice';
import { CUES } from '../scenario/scenes';

export type StudentScreen =
  | { screen: 'lock'; notification: number }
  | { screen: 'plan'; variant: 'initial' | 'updated'; local: number }
  | { screen: 'practice'; local: number }
  | { screen: 'progress'; local: number };

/** Which phone screen shows at scene time t. Practice uses scene time directly (SC9 constants). */
export function studentFrame(sceneId: number, t: number): StudentScreen {
  if (sceneId === 7) return { screen: 'lock', notification: prog(t, CUES.sc7Notify, 500) };
  if (sceneId === 9) {
    if (t < SC9.plan) return { screen: 'lock', notification: 1 };
    if (t < SC9.practice) return { screen: 'plan', variant: 'initial', local: t - SC9.plan };
    if (t < SC9.progress) return { screen: 'practice', local: t };
    return { screen: 'progress', local: t - SC9.progress };
  }
  if (sceneId === 10 && t >= CUES.sc10Update) return { screen: 'plan', variant: 'updated', local: t - CUES.sc10Update };
  return { screen: 'lock', notification: 0 };
}

/** Phone timestamps for the contact sheet. */
export const STUDENT_SHOTS: Record<number, number[]> = {
  7: [22500],
  9: [1800, 4500, 9500, 12000, 15800, 18500],
  10: [28500],
};
