/** Story time at the start of the demo: the teacher logs in at 15:00. */
export const STORY_START = 15 * 60;
/** Story time after the mastery check (the Sc8 "that evening" moment). */
export const TONIGHT = 20 * 60 + 40;

export const fmt = (m: number): string =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** "HH:MM" → minutes after midnight, or null when malformed. */
export function parseTime(s: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
