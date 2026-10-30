import { keyframes } from '../engine/anim';
import { C } from './tokens';

export interface CursorKey { t: number; x: number; y: number; click?: boolean }

const RIPPLE_MS = 500;

/** Scripted pointer: glides between keyframes; a gold ripple plays at each click key. */
export function FakeCursor({ t, keys, visible = true }: { t: number; keys: CursorKey[]; visible?: boolean }) {
  if (!visible) return null;
  const { x, y } = keyframes(keys.map(({ t: kt, x: kx, y: ky }) => ({ t: kt, x: kx, y: ky })), t);
  const click = keys.find((k) => k.click && t >= k.t && t < k.t + RIPPLE_MS);
  const rp = click ? (t - click.t) / RIPPLE_MS : 0;
  const size = 12 + 56 * rp;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${x}px, ${y}px)`, pointerEvents: 'none', zIndex: 50 }}>
      {click && (
        <div style={{ position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%', border: `3px solid ${C.gold}`, opacity: 1 - rp }} />
      )}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ position: 'absolute', left: -3, top: -2 }}>
        <path d="M3 2l7 19 2.6-7.4L20 11z" fill="#FFFFFF" stroke={C.gold} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
