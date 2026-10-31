import type { CursorKey } from '../ui/FakeCursor';
import { MINH_ANH } from '../scenario/minhAnh';
import { TOPICS } from './conversations';
import { PAST, type TeacherEvent } from './frame';

export interface TeacherScript {
  events: TeacherEvent[];
  cursor: CursorKey[];
}

/** Scenes rendered by TeacherScreen. Sc7 has no events of its own: it holds Sc6's last frame. */
export const TEACHER_SCENES = [2, 3, 4, 5, 6, 7, 8];

const ASK_MINH_ANH = TOPICS.student.prompt;
const ASK_CLASS = TOPICS.class.prompt;

/** Each scene's own events in scene time, ascending. Cursor positions are in the 1920×1080 canvas. */
const OWN: Partial<Record<number, TeacherScript>> = {
  2: {
    events: [
      { at: 500, type: 'greeting' },
      { at: 5000, type: 'tracker', on: true },
    ],
    cursor: [],
  },
  3: {
    events: [
      { at: 1500, type: 'view', view: 'classroom' },
      { at: 1800, type: 'classroomReveal' },
      { at: 9500, type: 'pulse' },
      { at: 11000, type: 'tick', q: 0 },
    ],
    cursor: [
      { t: 600, x: 1100, y: 760 },
      { t: 1500, x: 70, y: 192, click: true },
      { t: 2600, x: 520, y: 900 },
    ],
  },
  4: {
    events: [
      { at: 800, type: 'select', index: MINH_ANH.index },
      { at: 2200, type: 'view', view: 'chat' },
      { at: 2200, type: 'reset' },
      { at: 2600, type: 'type', text: ASK_MINH_ANH, cps: 18 },
      { at: 4800, type: 'send', text: ASK_MINH_ANH },
      { at: 5200, type: 'think', lines: TOPICS.student.thinking, stepMs: 1200, title: TOPICS.student.title },
      { at: 8000, type: 'assistant', kind: 'answer', topic: 'student', blockMs: 1000 },
      { at: 15500, type: 'panel', id: 'student' },
      { at: 19000, type: 'tick', q: 1 },
      { at: 19000, type: 'tick', q: 2 },
    ],
    cursor: [
      { t: 0, x: 980, y: 820 },
      { t: 800, x: 855, y: 564, click: true },
      { t: 2200, x: 1560, y: 697, click: true },
      { t: 3000, x: 1300, y: 960 },
    ],
  },
  5: {
    events: [
      { at: 800, type: 'send', text: ASK_CLASS },
      { at: 1200, type: 'think', lines: TOPICS.class.thinking, stepMs: 800, title: TOPICS.class.title },
      { at: 3000, type: 'assistant', kind: 'answer', topic: 'class', blockMs: 600 },
      { at: 6000, type: 'panel', id: 'class' },
      { at: 8000, type: 'tick', q: 3 },
    ],
    cursor: [
      { t: 0, x: 1000, y: 820 },
      { t: 800, x: 690, y: 558, click: true },
      { t: 1600, x: 1050, y: 860 },
    ],
  },
  6: {
    events: [
      { at: 600, type: 'load', topic: 'student' },
      { at: 1500, type: 'panelScroll', y: 120, dur: 1500 },
      { at: 4500, type: 'edit' },
      { at: 6500, type: 'approve', id: 'student' },
      { at: 7000, type: 'assistant', kind: 'approved', topic: 'student', blockMs: 400 },
      { at: 8000, type: 'tick', q: 4 },
    ],
    cursor: [
      { t: 0, x: 900, y: 700 },
      { t: 600, x: 106, y: 281, click: true },
      { t: 2500, x: 1400, y: 700 },
      { t: 3500, x: 1680, y: 787, click: true },
      { t: 5500, x: 1600, y: 830 },
      { t: 6500, x: 1575, y: 787, click: true },
      { t: 7500, x: 1300, y: 920 },
    ],
  },
  8: {
    events: [
      { at: 0, type: 'tracker', on: false },
      { at: 1000, type: 'assistant', kind: 'adapt', blockMs: 900, stamp: '20:41' },
      { at: 3000, type: 'adaptTwin' },
      { at: 8000, type: 'view', view: 'classroom' },
      { at: 8500, type: 'adaptClass' },
    ],
    cursor: [
      { t: 6000, x: 900, y: 820 },
      { t: 8000, x: 70, y: 192, click: true },
      { t: 9000, x: 520, y: 900 },
    ],
  },
};

/** A scene's script: every earlier teacher scene's events replayed at PAST (finished), then its own. */
export function scriptFor(scene: number): TeacherScript {
  const prior = TEACHER_SCENES.filter((id) => id < scene).flatMap((id) => (OWN[id]?.events ?? []).map((e) => ({ ...e, at: PAST })));
  const own = OWN[scene] ?? { events: [], cursor: [] };
  return { events: [...prior, ...own.events], cursor: own.cursor };
}
