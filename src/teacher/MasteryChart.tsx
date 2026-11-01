import { EXAM_DAY, LECTURES } from '../scenario/course';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { egg } from '../ui/theme';
import { GAP } from './ConceptGraph';
import type { ChartMarker, ChartPoint } from './ForecastChart';

const W = 760;
const H = 220;
const LEFT = 34;
const RIGHT = 70;
const TOP = 36;
const BOTTOM = 30;
const x = (day: number) => LEFT + (day / EXAM_DAY) * (W - LEFT - RIGHT);
/** Labels are up to about 60 wide and a day is about 10, so markers closer than this (in viewBox units) would overlap and stack. */
const LABEL_CLEARANCE = 60;
const y = (v: number) => TOP + (1 - v) * (H - TOP - BOTTOM);

/** Class average mastery (0–1) on one concept from Week 1 to the exam: the 0.50 gap line, a tick on each lecture day and the interventions on their own row along the top, as on the forecast chart. */
export function MasteryChart({ concept, label, points, markers }: { concept: ConceptId; label: string; points: ChartPoint[]; markers: ChartMarker[] }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Class average mastery on ${label} across the course`}>
      {[0, 0.5, 1].map((v) => (
        <text key={v} x={LEFT - 8} y={y(v) + 4} fontSize="10" textAnchor="end" fill={egg('mute')}>{v.toFixed(1)}</text>
      ))}
      <line x1={LEFT} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke={egg('line')} />
      <line data-gap-line x1={LEFT} x2={W - RIGHT} y1={y(GAP)} y2={y(GAP)} stroke={egg('mute')} strokeDasharray="2 4" />
      <text x={W - RIGHT + 6} y={y(GAP) + 4} fontSize="11" fill={egg('mute')}>Gap 0.50</text>
      {LECTURES.map((l) => (
        <g key={l.n}>
          <line x1={x(l.day)} x2={x(l.day)} y1={y(0)} y2={y(0) + 4} stroke={egg('mute')} />
          <text data-tick={l.n} x={x(l.day)} y={H - BOTTOM + 16} fontSize="10" textAnchor="middle" fill={egg('mute')}>{`L${l.n}`}</text>
        </g>
      ))}
      <text x={x(EXAM_DAY)} y={H - BOTTOM + 16} fontSize="10" textAnchor="middle" fill={egg('mute')}>Exam</text>
      {markers.map((m, i) => {
        // A marker near an earlier one (the same day or the next few) stacks above it instead of overlapping.
        const stack = markers.slice(0, i).filter((o) => Math.abs(x(o.day) - x(m.day)) < LABEL_CLEARANCE).length;
        return (
          <g key={i}>
            <line x1={x(m.day)} x2={x(m.day)} y1={TOP - 6} y2={y(0)} stroke={egg('line')} strokeDasharray="3 3" />
            <text data-marker-row={m.row} x={x(m.day)} y={TOP - 10 - stack * 12} fontSize="10" textAnchor="middle" fill={egg('accent-ink')}>{m.label}</text>
          </g>
        );
      })}
      {points.length > 1 && (
        <polyline data-series="mastery" data-concept={concept} points={points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={egg('ink')} strokeWidth="2" />
      )}
      {points.map((p) => <circle key={p.day} data-point={p.day} cx={x(p.day)} cy={y(p.value)} r="3" fill={egg('ink')} />)}
    </svg>
  );
}
