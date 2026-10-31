import { fade, stepIndex } from '../../engine/anim';
import { SC9_EVIDENCE } from '../../scenario/practice';

export function StatusBar({ clock }: { clock: string }) {
  return (
    <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 font-sans text-[14px] font-semibold text-egg-ink" style={{ height: 44, zIndex: 30 }}>
      <span>{clock}</span>
      <span>5G ▮▮▮</span>
    </div>
  );
}

/** Scripted finger tap indicator around time `at`. */
export function TouchDot({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const o = fade(t, at - 300, at + 350, 150);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(26,23,20,0.25)', border: '2px solid rgba(255,255,255,0.9)', opacity: o, zIndex: 40 }} />;
}

/** "Evidence synced ↑" pill after each Sc7 evidence event. */
export function EvidencePill({ t }: { t: number }) {
  const i = stepIndex(t, SC9_EVIDENCE.map((e) => e.at));
  if (i < 0) return null;
  const o = fade(t, SC9_EVIDENCE[i].at, SC9_EVIDENCE[i].at + 1400, 200);
  if (o <= 0) return null;
  return (
    <div className="absolute right-4 flex items-center gap-1.5 rounded-full bg-egg-ink px-3 py-1 font-sans text-[12px] font-semibold text-egg-card" style={{ top: 48, opacity: o, zIndex: 35 }}>
      <span className="h-1.5 w-1.5 rounded-full bg-egg-orange" />
      Evidence synced ↑
    </div>
  );
}

/** Ruled-list step marker: a sage tick when done, an ink-outlined number otherwise. */
export function StepMarker({ n, done, size = 32 }: { n: number; done: boolean; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${done ? 'bg-egg-sage-tint text-egg-sage' : 'border border-egg-ink text-egg-ink'}`}
      style={{ width: size, height: size }}
    >
      {done ? '✓' : n}
    </span>
  );
}
