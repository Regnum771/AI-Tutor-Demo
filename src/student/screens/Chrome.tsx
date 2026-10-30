import { fade, stepIndex } from '../../engine/anim';
import { SC9_EVIDENCE } from '../../scenario/practice';
import { C } from '../../ui/tokens';

export function StatusBar() {
  return (
    <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 font-sans text-[14px] font-semibold text-slate-900" style={{ height: 44, zIndex: 30 }}>
      <span>09:00</span>
      <span>5G ▮▮▮</span>
    </div>
  );
}

/** Scripted finger tap indicator around time `at`. */
export function TouchDot({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const o = fade(t, at - 300, at + 350, 150);
  if (o <= 0) return null;
  return <div style={{ position: 'absolute', left: x - 22, top: y - 22, width: 44, height: 44, borderRadius: '50%', background: 'rgba(15,23,42,0.25)', border: '2px solid rgba(255,255,255,0.9)', opacity: o, zIndex: 40 }} />;
}

/** "Evidence synced ↑" pill after each Sc9 evidence event. */
export function EvidencePill({ t }: { t: number }) {
  const i = stepIndex(t, SC9_EVIDENCE.map((e) => e.at));
  if (i < 0) return null;
  const o = fade(t, SC9_EVIDENCE[i].at, SC9_EVIDENCE[i].at + 1400, 200);
  if (o <= 0) return null;
  return (
    <div className="absolute right-4 rounded-full px-3 py-1 font-sans text-[12px] font-semibold text-white" style={{ top: 48, background: C.twin, opacity: o, zIndex: 35 }}>
      Evidence synced ↑
    </div>
  );
}
