import { fade, holdMs } from '../engine/anim';
import { formatTime, type Toggles } from '../engine/playback';
import type { SceneDef } from '../scenario/scenes';

export const FOOTER_LABEL = 'Illustrative demo data · fictional students';
const TITLE_IN = 600;

export interface OverlaysProps {
  scene: SceneDef;
  t: number;
  slate: boolean;
  toggles: Toggles;
  variant: 'teacher' | 'phone';
}

export function Overlays({ scene, t, slate, toggles, variant }: OverlaysProps) {
  const teacher = variant === 'teacher';
  const titleEnd = TITLE_IN + holdMs(`${scene.title} ${scene.subtitle}`) + 1500;
  const titleOpacity = teacher && toggles.titles && scene.title ? fade(t, TITLE_IN, titleEnd) : 0;
  return (
    <>
      {titleOpacity > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, bottom: 0, padding: '64px 96px 76px 64px', zIndex: 60, maxWidth: 1300,
            opacity: titleOpacity, transform: `translateY(${(1 - titleOpacity) * 16}px)`,
            // Opaque eggshell plate (soft 40px top fade) so nothing underneath ghosts through the title.
            background: 'linear-gradient(180deg, rgba(242,237,228,0) 0, #F2EDE4 40px)',
          }}
        >
          <div style={{ width: 64, height: 4, background: '#FF5B1F', marginBottom: 14 }} />
          <div className="font-serif" style={{ fontSize: 64, lineHeight: 1.05, color: '#1A1714' }}>{scene.title}</div>
          {scene.subtitle && (
            <div className="font-sans font-medium [text-wrap:balance]" style={{ fontSize: 26, marginTop: 10, color: '#6B6359' }}>{scene.subtitle}</div>
          )}
        </div>
      )}
      {toggles.footer && (
        <div
          className="font-sans"
          style={{ position: 'absolute', right: teacher ? 32 : 10, bottom: teacher ? 16 : 6, fontSize: teacher ? 15 : 10, color: teacher ? '#9C9285' : '#94A3B8', zIndex: 60 }}
        >
          {FOOTER_LABEL}
        </div>
      )}
      {teacher && toggles.chapter && scene.chapter && (
        <div className="font-mono uppercase" style={{ position: 'absolute', right: 32, bottom: 44, zIndex: 60, fontSize: 15, letterSpacing: '0.16em', color: '#1A1714', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: '#FF5B1F' }} />
          {scene.chapter}
        </div>
      )}
      {toggles.tc && (
        <div
          className="font-mono"
          style={{ position: 'absolute', right: 12, top: 12, fontSize: teacher ? 20 : 12, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', zIndex: 70 }}
        >
          {`Sc${String(scene.id).padStart(2, '0')} ${formatTime(t)}`}
        </div>
      )}
      {slate && <div data-slate style={{ position: 'absolute', left: 0, top: 0, width: teacher ? 64 : 24, height: teacher ? 64 : 24, background: '#fff', zIndex: 80 }} />}
    </>
  );
}
