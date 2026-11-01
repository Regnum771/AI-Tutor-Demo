import { fmt } from '../live/clock';
import { classAverage } from '../live/history';
import type { DemoState } from '../live/types';
import { lectureOf, shortDate, taughtBy } from '../scenario/course';
import { CONCEPTS, conceptById, EDGES, type ConceptId } from '../scenario/knowledgeGraph';
import { egg } from '../ui/theme';
import { gapFill } from './Classroom';

/** The graph's viewBox, the same one `CONCEPTS` x/y are given in. */
const W = 1100;
const H = 560;
/** Below this class average a concept is a gap, as on the heatmap. */
export const GAP = 0.5;

/** The 12 concepts at their fixed positions, joined by their prerequisite edges. A lectured node is filled by class average mastery on the heatmap's scale; a node not lectured yet is greyed with its lecture and date. Clicking a node selects it; clicking it again clears the selection. */
export function ConceptGraph({ state, selected, onSelect }: { state: DemoState; selected: ConceptId | null; onSelect(concept: ConceptId | null): void }) {
  const taught = taughtBy(state.day, fmt(state.clock));
  return (
    <div data-graph className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        {EDGES.map(([a, b]) => {
          const from = conceptById(a);
          const to = conceptById(b);
          const on = selected === a || selected === b;
          return <line key={`${a}-${b}`} data-edge={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={egg(on ? 'ink' : 'line')} strokeWidth={on ? 2.5 : 1.5} />;
        })}
      </svg>
      {CONCEPTS.map((c) => {
        const lectured = taught.includes(c.id);
        const v = classAverage(state.students, c.id);
        const gap = lectured && v < GAP;
        const l = lectureOf(c.id);
        const on = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            data-node={c.id}
            data-untaught={lectured ? undefined : ''}
            data-gap={gap ? '' : undefined}
            aria-pressed={on}
            title={lectured ? `${c.label}: class average ${v.toFixed(2)}` : `${c.label}: taught in Lecture ${l.n} on ${shortDate(l.day)}`}
            onClick={() => onSelect(on ? null : c.id)}
            className={`absolute w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2 py-1.5 text-center leading-tight ${on ? 'border-egg-ink ring-2 ring-egg-ink' : 'border-egg-line'} ${lectured ? 'text-egg-ink' : 'border-dashed bg-egg-paper text-egg-faint'}`}
            style={{ left: `${(c.x / W) * 100}%`, top: `${(c.y / H) * 100}%`, ...(lectured ? { background: gapFill(v) } : {}) }}
          >
            <span className="block text-[12px] font-semibold">{c.label}</span>
            <span className={`block font-mono text-[11.5px] tabular-nums ${gap ? 'font-bold' : ''}`}>{lectured ? v.toFixed(2) : `Lecture ${l.n} · ${shortDate(l.day)}`}</span>
          </button>
        );
      })}
    </div>
  );
}
