import { clamp } from '../engine/anim';
import { CONCEPTS, EDGES, conceptById, conceptIndex, type ConceptId, type Edge } from '../scenario/knowledgeGraph';
import { Conduit } from './Conduit';
import { C, masteryColor } from './tokens';

export const GRAPH_W = 1100;
export const GRAPH_H = 560;

export interface GraphViewProps {
  t: number;
  width?: number;
  /** Concepts listed here are filled with their mastery colour; others stay neutral. */
  mastery?: Partial<Record<ConceptId, number>>;
  masteryOpacity?: number;
  highlightNodes?: ConceptId[];
  highlightEdges?: Edge[];
  /** 0→1 reveals nodes in CONCEPTS order. */
  appear?: number;
  showLabels?: boolean;
}

export function GraphView({ t, width = GRAPH_W, mastery = {}, masteryOpacity = 1, highlightNodes = [], highlightEdges = [], appear = 1, showLabels = true }: GraphViewProps) {
  const visible = (id: ConceptId) => clamp(appear * CONCEPTS.length - conceptIndex(id));
  const isHi = (a: ConceptId, b: ConceptId) => highlightEdges.some(([x, y]) => x === a && y === b);
  return (
    <svg width={width} height={(width / GRAPH_W) * GRAPH_H} viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} style={{ overflow: 'visible' }}>
      {EDGES.map(([a, b]) => {
        const A = conceptById(a);
        const B = conceptById(b);
        const o = Math.min(visible(a), visible(b));
        return isHi(a, b) ? (
          <Conduit key={`${a}-${b}`} d={`M${A.x} ${A.y} L${B.x} ${B.y}`} color="#FFFFFF" t={t} width={4} opacity={o} />
        ) : (
          <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={C.royal} strokeOpacity={0.5 * o} strokeWidth={2} />
        );
      })}
      {CONCEPTS.map((c) => {
        const m = mastery[c.id];
        const filled = m !== undefined && masteryOpacity > 0.5;
        return (
          <g key={c.id} opacity={visible(c.id)}>
            {highlightNodes.includes(c.id) && (
              <circle cx={c.x} cy={c.y} r={42} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.6 + 0.4 * Math.sin(t / 180)} />
            )}
            <circle cx={c.x} cy={c.y} r={32} fill={C.panel} stroke={C.royal} strokeWidth={3} />
            {m !== undefined && <circle cx={c.x} cy={c.y} r={28} fill={masteryColor(m)} opacity={0.85 * masteryOpacity} />}
            <text x={c.x} y={c.y + 8} textAnchor="middle" fontSize={22} fontWeight={700} fontFamily="JetBrains Mono" fill={filled ? C.deep : C.ink}>{c.symbol}</text>
            {showLabels && <text x={c.x} y={c.y + 58} textAnchor="middle" fontSize={18} fontFamily="Inter" fill={C.dim}>{c.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
