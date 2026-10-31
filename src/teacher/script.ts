import type { CursorKey } from '../ui/FakeCursor';
import { PAST, type TeacherEvent } from './frame';

export interface TeacherScript {
  events: TeacherEvent[];
  cursor: CursorKey[];
}

/** Scenes rendered by TeacherScreen. Sc7 has no events of its own: it holds Sc6's last frame. */
export const TEACHER_SCENES = [2, 3, 4, 5, 6, 7, 8];

/** Each scene's own events in scene time, ascending. */
const OWN: Partial<Record<number, TeacherScript>> = {};

/** A scene's script: every earlier teacher scene's events replayed at PAST (finished), then its own. */
export function scriptFor(scene: number): TeacherScript {
  const prior = TEACHER_SCENES.filter((id) => id < scene).flatMap((id) => (OWN[id]?.events ?? []).map((e) => ({ ...e, at: PAST })));
  const own = OWN[scene] ?? { events: [], cursor: [] };
  return { events: [...prior, ...own.events], cursor: own.cursor };
}
