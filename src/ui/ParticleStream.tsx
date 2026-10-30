import { easeInOut, type Point } from '../engine/anim';
import type { EvidenceKind } from '../scenario/sources';
import { C } from './tokens';

export type ParticleKind = EvidenceKind;

/** Shape encodes input type: ■ structured, ▬ text, ● interaction, ▭ document. */
export function ParticleShape({ kind, x, y, color, opacity = 1 }: { kind: ParticleKind; x: number; y: number; color: string; opacity?: number }) {
  switch (kind) {
    case 'structured':
      return <rect x={x - 6} y={y - 6} width={12} height={12} fill={color} opacity={opacity} />;
    case 'text':
      return <rect x={x - 11} y={y - 3} width={22} height={6} rx={3} fill={color} opacity={opacity} />;
    case 'interaction':
      return <circle cx={x} cy={y} r={6} fill={color} opacity={opacity} />;
    case 'document':
      return <rect x={x - 6} y={y - 8} width={12} height={16} rx={2} fill="none" stroke={color} strokeWidth={2.5} opacity={opacity} />;
  }
}

const quad = (a: Point, c: Point, b: Point, s: number): Point => ({
  x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * c.x + s * s * b.x,
  y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * c.y + s * s * b.y,
});

export interface ParticleStreamProps {
  t: number;
  from: Point;
  to: Point;
  via?: Point;
  start: number;
  count?: number;
  gap?: number;
  travel?: number;
  kinds?: ParticleKind[];
  color?: string;
}

/** Deterministic particles: particle i departs at start + i*gap and takes `travel` ms. Render inside an <svg>. */
export function ParticleStream({ t, from, to, via, start, count = 10, gap = 140, travel = 1400, kinds = ['structured', 'text', 'interaction', 'document'], color = C.cyan }: ParticleStreamProps) {
  const ctrl = via ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const s = (t - (start + i * gap)) / travel;
        if (s < 0 || s > 1) return null;
        const p = quad(from, ctrl, to, easeInOut(s));
        return <ParticleShape key={i} kind={kinds[i % kinds.length]} x={p.x} y={p.y} color={color} opacity={Math.min(1, s * 6, (1 - s) * 6)} />;
      })}
    </g>
  );
}
