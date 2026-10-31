import { fade, prog } from '../../engine/anim';
import { C } from '../../ui/tokens';

/** Co-signed decision card: blue→green border, both agents' signatures. */
export function JointDecision({ t, steps, at, signAt, exitAt = Infinity }: { t: number; steps: string[]; at: number; signAt: [number, number]; exitAt?: number }) {
  const o = fade(t, at);
  const exit = prog(t, exitAt, 1200);
  if (o <= 0 || exit >= 1) return null;
  return (
    <div className="absolute rounded-2xl p-[3px]" style={{ left: 560 + exit * 700, top: 790, width: 800, opacity: o * (1 - exit), background: `linear-gradient(90deg, ${C.sas}, ${C.tas})`, zIndex: 25 }}>
      <div className="rounded-2xl px-6 py-5" style={{ background: C.panel }}>
        <div className="flex items-center justify-between">
          <span className="font-display text-[24px] font-extrabold text-ink">Joint decision</span>
          <span className="font-mono text-[18px] font-bold">
            <span style={{ color: C.sas, opacity: fade(t, signAt[0]) }}>SAS ✓</span>
            <span className="ml-4" style={{ color: C.tas, opacity: fade(t, signAt[1]) }}>TAS ✓</span>
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-lg px-3 py-2 text-[19px] font-semibold text-ink" style={{ background: C.surface }}>{s}</span>
              {i < steps.length - 1 && <span className="text-[20px] text-dim">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
