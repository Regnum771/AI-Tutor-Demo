import { C } from './tokens';

/** Status chips; the first `reached` are complete and the last reached one glows. */
export function PipelineStatus({ statuses, reached, compact = false }: { statuses: readonly string[]; reached: number; compact?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((s, i) => {
        const done = i < reached;
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className="rounded-lg border-2 px-3 py-1.5 font-mono font-bold"
              style={{ fontSize: compact ? 13 : 16, borderColor: done ? C.engine : C.line, color: done ? C.deep : C.dim, background: done ? C.engine : 'transparent', boxShadow: i === reached - 1 ? '0 0 18px rgba(255,255,255,0.8)' : 'none' }}
            >
              {s}
            </span>
            {i < statuses.length - 1 && <span className="font-mono" style={{ color: done ? C.engine : C.line }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}
