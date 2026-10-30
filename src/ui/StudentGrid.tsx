import { clamp } from '../engine/anim';
import { STUDENTS, initials, type Status, type Track } from '../scenario/classroom';
import { C } from './tokens';

export const GRID = { x: 64, y: 350, cell: 84, gap: 12, cols: 11 };

export const tilePos = (i: number) => ({
  x: GRID.x + (i % GRID.cols) * (GRID.cell + GRID.gap),
  y: GRID.y + Math.floor(i / GRID.cols) * (GRID.cell + GRID.gap),
});
export const tileCenter = (i: number) => {
  const p = tilePos(i);
  return { x: p.x + GRID.cell / 2, y: p.y + GRID.cell / 2 };
};

const STATUS_BORDER: Record<Status, string> = { onTrack: C.line, support: C.gold, highRisk: C.gap };
const TRACK_DOT: Record<Track, string | null> = { routine: C.engine, adaptive: C.twin, complex: C.gold, none: null };

/** 11×5 grid of the 55 learners, absolutely positioned in canvas coordinates. */
export function StudentGrid({ t, highlight = [], mode = 'status', reveal = 1, labels = {} }: { t: number; highlight?: number[]; mode?: 'status' | 'track' | 'twin'; reveal?: number; labels?: Record<number, string> }) {
  return (
    <>
      {STUDENTS.map((s) => {
        const p = tilePos(s.index);
        const o = clamp(reveal * STUDENTS.length - s.index);
        const hi = highlight.includes(s.index);
        const dot = mode === 'track' ? TRACK_DOT[s.track] : null;
        return (
          <div
            key={s.id}
            data-tile
            className="absolute flex items-center justify-center rounded-2xl font-sans text-[22px] font-semibold text-ink"
            style={{
              left: p.x, top: p.y, width: GRID.cell, height: GRID.cell, opacity: o, background: C.surface,
              border: `3px solid ${STATUS_BORDER[s.status]}`,
              boxShadow: hi ? `0 0 0 4px rgba(255,255,255,${0.55 + 0.45 * Math.sin(t / 160)})` : 'none',
            }}
          >
            {mode === 'twin' && (
              <span className="absolute inset-2 rounded-full" style={{ border: `3px solid ${C.twin}`, opacity: 0.35 + 0.35 * Math.sin(t / 300 + s.index) }} />
            )}
            {initials(s.name)}
            {dot && <span className="absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full" style={{ background: dot }} />}
            {labels[s.index] && (
              <span className="absolute -left-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full font-display text-[18px] font-extrabold" style={{ background: C.twin, color: C.deep }}>
                {labels[s.index]}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
