import type { ReactNode } from 'react';
import { keyframes } from '../engine/anim';

export interface CamKey { t: number; x: number; y: number; zoom: number }

/** Virtual camera: (x, y) is the canvas point placed at the centre of the 1920×1080 frame. */
export function Camera({ t, keys, children }: { t: number; keys: CamKey[]; children: ReactNode }) {
  const { x, y, zoom } = keyframes<{ x: number; y: number; zoom: number }>(keys, t);
  return (
    <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${960 - x * zoom}px, ${540 - y * zoom}px) scale(${zoom})` }}>
      {children}
    </div>
  );
}
