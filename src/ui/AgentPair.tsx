import { Conduit } from './Conduit';
import { FullSvg } from './FullSvg';
import { C } from './tokens';

/** Compact SAS+TAS pair joined by two opposite-flowing conduits. (x, y) is the SAS ring centre. */
export function AgentPair({ t, x, y, gap = 180, r = 32 }: { t: number; x: number; y: number; gap?: number; r?: number }) {
  const x2 = x + gap;
  const mid = (x + x2) / 2;
  return (
    <>
      <FullSvg>
        <Conduit d={`M${x + r} ${y - 8} Q ${mid} ${y - 44} ${x2 - r} ${y - 8}`} color={C.sas} t={t} />
        <Conduit d={`M${x2 - r} ${y + 8} Q ${mid} ${y + 44} ${x + r} ${y + 8}`} color={C.tas} t={t} />
      </FullSvg>
      {(['SAS', 'TAS'] as const).map((a, i) => (
        <div
          key={a}
          className="absolute flex items-center justify-center rounded-full font-display font-extrabold"
          style={{ left: (i ? x2 : x) - r, top: y - r, width: 2 * r, height: 2 * r, border: `3px solid ${a === 'SAS' ? C.sas : C.tas}`, color: a === 'SAS' ? C.sas : C.tas, background: C.panel, fontSize: r * 0.6 }}
        >
          {a}
        </div>
      ))}
    </>
  );
}
