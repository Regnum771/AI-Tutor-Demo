import { fade, lerp, prog } from '../../engine/anim';
import { PATHWAY_A, PATHWAY_B, SIM_LABEL, TARGET, sessionsToTarget } from '../../scenario/simulation';
import { C } from '../../ui/tokens';

const W = 860;
const H = 290;
const PAD = { l: 60, r: 20, t: 20, b: 44 };
const MAX_SESSIONS = 6;
const x = (i: number) => PAD.l + (i / MAX_SESSIONS) * (W - PAD.l - PAD.r);
const y = (v: number) => PAD.t + (1 - (v - 0.3) / 0.5) * (H - PAD.t - PAD.b);

/** Polyline of `curve` drawn up to fraction p of its length (by segment). */
function partial(curve: number[], p: number): string {
  const segs = curve.length - 1;
  const upto = p * segs;
  const pts: string[] = [];
  for (let i = 0; i <= Math.floor(upto); i++) pts.push(`${x(i)},${y(curve[i])}`);
  const frac = upto - Math.floor(upto);
  const i = Math.floor(upto);
  if (frac > 0 && i < segs) pts.push(`${lerp(x(i), x(i + 1), frac)},${lerp(y(curve[i]), y(curve[i + 1]), frac)}`);
  return pts.join(' ');
}

export function SimChart({ t, start, selectAt }: { t: number; start: number; selectAt: number }) {
  const a = prog(t, start + 1000, 2500);
  const b = prog(t, start + 2000, 2500);
  const selected = t >= selectAt;
  return (
    <div className="rounded-2xl border-2 p-5" style={{ width: 920, borderColor: C.twin, background: C.panel, opacity: fade(t, start) }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-[22px] font-extrabold" style={{ color: C.twin }}>Digital twin simulation · pathway comparison</span>
        <span className="rounded-md border-2 px-2 py-0.5 font-mono text-[15px] font-bold" style={{ borderColor: C.gold, color: C.gold }}>{SIM_LABEL}</span>
      </div>
      <svg width={W} height={H} className="mt-2">
        {[0.3, 0.5, 0.7].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={C.line} />
            <text x={PAD.l - 10} y={y(v) + 6} textAnchor="end" fontSize={16} fill={C.dim} fontFamily="Inter">{v.toFixed(1)}</text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(TARGET)} y2={y(TARGET)} stroke={C.ink} strokeDasharray="8 8" strokeOpacity={0.7} />
        <text x={W - PAD.r} y={y(TARGET) - 8} textAnchor="end" fontSize={16} fill={C.ink} fontFamily="Inter">mastery target {TARGET}</text>
        {Array.from({ length: MAX_SESSIONS + 1 }, (_, i) => (
          <text key={i} x={x(i)} y={H - 14} textAnchor="middle" fontSize={16} fill={C.dim} fontFamily="Inter">{i}</text>
        ))}
        <polyline points={partial(PATHWAY_A.curve, a)} fill="none" stroke={C.dim} strokeWidth={selected ? 3 : 4} strokeOpacity={selected ? 0.45 : 1} />
        <polyline points={partial(PATHWAY_B.curve, b)} fill="none" stroke={C.twin} strokeWidth={selected ? 7 : 4} />
      </svg>
      <div className="mt-1 flex gap-8 text-[18px]">
        <span className="text-dim">A · {PATHWAY_A.label}</span>
        <span style={{ color: C.twin }}>B · {PATHWAY_B.label}</span>
      </div>
      <div className="mt-2 font-display text-[20px] font-bold" style={{ color: C.twin, opacity: fade(t, selectAt) }}>
        B selected · reaches {TARGET} in {sessionsToTarget(PATHWAY_B.curve)} sessions (A: {sessionsToTarget(PATHWAY_A.curve)})
      </div>
    </div>
  );
}
