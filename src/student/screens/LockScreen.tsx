import { C } from '../../ui/tokens';
import { TouchDot } from './Chrome';

export function LockScreen({ t, notification, tapAt }: { t: number; notification: number; tapAt?: number }) {
  const pressed = tapAt !== undefined && t >= tapAt && t < tapAt + 250;
  return (
    <div className="absolute inset-0 flex flex-col items-center font-sans" style={{ background: 'linear-gradient(180deg, #0B1A3A 0%, #3B6CF6 140%)' }}>
      <div className="mt-24 font-display text-[18px] font-semibold text-white/80">Saturday, 31 October</div>
      <div className="font-display text-[84px] font-bold leading-none text-white">08:58</div>
      {notification > 0 && (
        <div className="absolute left-3 right-3 rounded-3xl p-4" style={{ top: 250, opacity: notification, transform: `translateY(${(1 - notification) * -40}px) scale(${pressed ? 0.97 : 1})`, background: 'rgba(255,255,255,0.94)' }}>
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <span className="flex h-6 w-6 items-center justify-center rounded-md font-display text-[11px] font-extrabold text-white" style={{ background: C.royal }}>BT</span>
            <span className="font-semibold uppercase tracking-wide">Beyond Tutor</span>
            <span className="ml-auto">now</span>
          </div>
          <div className="mt-2 text-[17px] font-semibold text-slate-900">Your personalized plan is ready</div>
          <div className="text-[15px] leading-snug text-slate-600">4 short sessions today to strengthen implication & logical equivalence.</div>
        </div>
      )}
      {tapAt !== undefined && <TouchDot t={t} at={tapAt} x={195} y={320} />}
    </div>
  );
}
