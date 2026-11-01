import { GIOI, KHA, PASS } from '../live/study/estimate';
import { EXAM_DAY } from '../scenario/course';
import { egg } from '../ui/theme';

export interface ChartPoint { day: number; value: number }
export interface ChartMarker { day: number; label: string }

const W = 760;
const H = 220;
const LEFT = 28;
const RIGHT = 70;
const TOP = 12;
const BOTTOM = 30;
const x = (day: number) => LEFT + (day / EXAM_DAY) * (W - LEFT - RIGHT);
const y = (v: number) => TOP + (1 - v / 10) * (H - TOP - BOTTOM);
const LINES = [{ v: PASS, label: 'Pass 4.0' }, { v: KHA, label: 'Khá 7.0' }, { v: GIOI, label: 'Giỏi 8.5' }];

/** The forecast out of 10 across the course, with the grade lines and, when there is a plan, the projection to the exam. */
export function ForecastChart({ points, projection, markers }: { points: ChartPoint[]; projection: ChartPoint | null; markers: ChartMarker[] }) {
  const last = points.at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Forecast out of 10 across the course">
      {[0, 5, 10].map((v) => (
        <text key={v} x={LEFT - 8} y={y(v) + 4} fontSize="10" textAnchor="end" fill={egg('mute')}>{v}</text>
      ))}
      <line x1={LEFT} x2={W - RIGHT} y1={y(0)} y2={y(0)} stroke={egg('line')} />
      {LINES.map(({ v, label }) => (
        <g key={label}>
          <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} stroke={egg('mute')} strokeDasharray="2 4" />
          <text x={W - RIGHT + 6} y={y(v) + 4} fontSize="11" fill={egg('mute')}>{label}</text>
        </g>
      ))}
      {markers.map((m) => (
        <g key={`${m.day}-${m.label}`}>
          <line x1={x(m.day)} x2={x(m.day)} y1={TOP} y2={y(0)} stroke={egg('line')} />
          <text x={x(m.day)} y={H - BOTTOM + 14} fontSize="10" textAnchor="middle" fill={egg('mute')}>{m.label}</text>
        </g>
      ))}
      {points.length > 1 && (
        <polyline data-series="forecast" points={points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={egg('ink')} strokeWidth="2" />
      )}
      {points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="3" fill={egg('ink')} />)}
      {last && projection && (
        <g>
          <line data-series="projection" x1={x(last.day)} y1={y(last.value)} x2={x(projection.day)} y2={y(projection.value)} stroke={egg('accent-ink')} strokeWidth="2" strokeDasharray="6 5" />
          <text x={x(projection.day) - 4} y={y(projection.value) - 8} fontSize="11" textAnchor="end" fill={egg('accent-ink')}>{`${projection.value.toFixed(1)} if the plan is kept`}</text>
        </g>
      )}
    </svg>
  );
}
