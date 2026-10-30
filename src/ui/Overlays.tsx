import { fade, holdMs } from '../engine/anim';
import { formatTime, type Toggles } from '../engine/playback';
import type { SceneDef } from '../scenario/scenes';
import { C } from './tokens';

export const FOOTER_LABEL = 'Illustrative demo data · fictional students';
const TITLE_IN = 600;

export interface OverlaysProps {
  scene: SceneDef;
  t: number;
  slate: boolean;
  toggles: Toggles;
  variant: 'dashboard' | 'phone';
}

export function Overlays({ scene, t, slate, toggles, variant }: OverlaysProps) {
  const dash = variant === 'dashboard';
  const titleEnd = TITLE_IN + holdMs(`${scene.title} ${scene.subtitle}`) + 1500;
  const titleOpacity = dash && toggles.titles && scene.title ? fade(t, TITLE_IN, titleEnd) : 0;
  return (
    <>
      {titleOpacity > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, bottom: 48, padding: '24px 120px 24px 64px', zIndex: 60, maxWidth: 1300,
            opacity: titleOpacity, transform: `translateY(${(1 - titleOpacity) * 16}px)`,
            background: 'linear-gradient(90deg, rgba(7,14,31,0.94) 60%, rgba(7,14,31,0))',
          }}
        >
          <div style={{ width: 64, height: 4, background: C.cyan, marginBottom: 14 }} />
          <div className="font-display font-extrabold" style={{ fontSize: 56, lineHeight: 1.05, color: C.ink }}>{scene.title}</div>
          {scene.subtitle && (
            <div className="font-display font-semibold" style={{ fontSize: 28, marginTop: 10, color: C.dim }}>{scene.subtitle}</div>
          )}
        </div>
      )}
      {toggles.footer && (
        <div
          className="font-sans"
          style={{ position: 'absolute', right: dash ? 32 : 10, bottom: dash ? 16 : 6, fontSize: dash ? 15 : 10, color: dash ? C.dim : '#94A3B8', zIndex: 60 }}
        >
          {FOOTER_LABEL}
        </div>
      )}
      {toggles.tc && (
        <div
          className="font-mono"
          style={{ position: 'absolute', right: 12, top: 12, fontSize: dash ? 20 : 12, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', zIndex: 70 }}
        >
          {`Sc${String(scene.id).padStart(2, '0')} ${formatTime(t)}`}
        </div>
      )}
      {slate && <div data-slate style={{ position: 'absolute', left: 0, top: 0, width: dash ? 64 : 24, height: dash ? 64 : 24, background: '#fff', zIndex: 80 }} />}
    </>
  );
}
