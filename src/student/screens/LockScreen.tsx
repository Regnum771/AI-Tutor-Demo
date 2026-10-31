import { Asterisk } from '../../teacher/parts';
import { TouchDot } from './Chrome';

/** Ink wallpaper with a still orange glow rising from the bottom edge. */
const WALLPAPER = 'radial-gradient(130% 55% at 50% 108%, rgba(255,91,31,0.55) 0%, rgba(255,91,31,0.14) 50%, rgba(255,91,31,0) 75%), #1A1714';

export function LockScreen({ t, notification, tapAt, clock }: { t: number; notification: number; tapAt?: number; clock: string }) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: WALLPAPER }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-egg-card/70">Saturday, 31 October</div>
      <div className="font-serif text-[84px] leading-none text-egg-card">{clock}</div>
      {notification > 0 && (
        <div className="absolute left-3 right-3 rounded-3xl border border-egg-line bg-egg-card p-4" style={{ top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})` }}>
          <div className="flex items-center gap-2 text-[13px] text-egg-mute">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-egg-ink"><Asterisk size={14} /></span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Beyond Tutor</span>
            <span className="ml-auto">now</span>
          </div>
          <div className="mt-2 text-[17px] font-semibold text-egg-ink">Your personalized plan is ready</div>
          <div className="text-[15px] leading-snug text-egg-mute">4 short sessions today to strengthen implication & logical equivalence.</div>
        </div>
      )}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
