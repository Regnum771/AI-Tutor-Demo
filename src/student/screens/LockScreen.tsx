import { Mark } from '../../teacher/parts';
import { TouchDot } from './Chrome';
import { egg } from '../../ui/theme';

/** Ink wallpaper with a still accent glow rising from the bottom edge. */
const WALLPAPER = `radial-gradient(130% 55% at 50% 108%, ${egg('accent', 0.55)} 0%, ${egg('accent', 0.14)} 50%, ${egg('accent', 0)} 75%), ${egg('ink')}`;
const CARD = 'absolute left-3 right-3 rounded-3xl border border-egg-line bg-egg-card p-4';
const SCRIPTED_MESSAGE = { title: 'Your personalized plan is ready', body: '4 short sessions today to strengthen implication & logical equivalence.' };

/** `onTap` (live mode) makes the notification a real button. */
export function LockScreen({ t, notification, tapAt, clock, date = 'Saturday, 31 October', message = SCRIPTED_MESSAGE, onTap }: {
  t: number; notification: number; tapAt?: number; clock: string; date?: string; message?: { title: string; body: string }; onTap?: () => void;
}) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  const style = { top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})` };
  const content = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-egg-mute">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-egg-ink"><Mark size={14} className="text-egg-accent" /></span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Beyond Tutor</span>
        <span className="ml-auto">now</span>
      </div>
      <div className="mt-2 text-[17px] font-semibold text-egg-ink">{message.title}</div>
      <div className="text-[15px] leading-snug text-egg-mute">{message.body}</div>
    </>
  );
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: WALLPAPER }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-egg-card/70">{date}</div>
      <div className="font-serif text-[84px] leading-none text-egg-card">{clock}</div>
      {notification > 0 && (onTap ? (
        <button type="button" onClick={onTap} className={`${CARD} text-left`} style={style}>{content}</button>
      ) : (
        <div className={CARD} style={style}>{content}</div>
      ))}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
