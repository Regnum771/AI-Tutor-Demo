import { fade } from '../../engine/anim';
import { Asterisk } from '../parts';

const TAGLINE = 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.';

export function Closing({ t }: { t: number }) {
  const mark = fade(t, 300);
  const line = fade(t, 1200);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-egg-bg text-egg-ink">
      <div className="flex items-center gap-5" style={{ opacity: mark, transform: `translateY(${(1 - mark) * 14}px)` }}>
        <span className="font-serif text-[180px] leading-none">Beyond</span>
        <Asterisk size={84} />
      </div>
      <div className="mt-4 font-mono text-[18px] uppercase tracking-[0.3em] text-egg-mute" style={{ opacity: mark }}>AI Tutoring</div>
      <div className="mt-10 max-w-[1300px] text-center font-serif text-[40px] italic leading-tight" style={{ opacity: line }}>{TAGLINE}</div>
    </div>
  );
}
