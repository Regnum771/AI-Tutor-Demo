import { fade, prog, stepIndex } from '../../engine/anim';
import { SOURCE_WINDOWS, TEACHER_QUESTIONS } from '../../scenario/sources';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';

const WINDOW_IN = (i: number) => 300 + i * 650;
const QUESTIONS_IN = 8000;
const QUESTION_STEP = 1000;

const CURSOR: CursorKey[] = [
  { t: 2000, x: 1700, y: 1000 },
  { t: 2600, x: 300, y: 90, click: true },
  { t: 3600, x: 900, y: 60, click: true },
  { t: 4600, x: 330, y: 420, click: true },
  { t: 5600, x: 900, y: 400, click: true },
  { t: 6600, x: 1500, y: 110, click: true },
  { t: 7400, x: 1550, y: 440, click: true },
  { t: 8000, x: 1750, y: 1000 },
];
const FOCUS_ORDER = ['lms', 'zalo', 'records', 'assessment', 'whatsapp', 'email'];
const CLICK_TIMES = CURSOR.filter((k) => k.click).map((k) => k.t);

export function ProblemScene({ t, cursor }: { t: number; cursor: boolean }) {
  const focused = FOCUS_ORDER[stepIndex(t, CLICK_TIMES)];
  const veil = prog(t, QUESTIONS_IN - 300, 600) * 0.75;
  return (
    <div className="absolute inset-0" style={{ background: '#F2EDE4' }}>
      {SOURCE_WINDOWS.map((w, i) => {
        const o = fade(t, WINDOW_IN(i));
        const isFocused = w.kind === focused;
        return (
          <div
            key={w.kind}
            className="absolute overflow-hidden rounded-xl border-2 "
            style={{ left: w.x, top: w.y, width: w.w, height: w.h, opacity: o, transform: `translateY(${(1 - o) * 30}px)`, zIndex: isFocused ? 20 : 10 + (i % 3), background: '#FFFDF8', borderColor: isFocused ? '#1A1714' : '#DCD3C5', boxShadow: '0 18px 40px -20px rgba(26,23,20,0.35)' }}
          >
            <div className="flex items-center gap-2 px-4" style={{ height: 40, background: '#F8F4EC' }}>
              {[0, 1, 2].map((d) => <span key={d} className="h-3 w-3 rounded-full" style={{ background: '#DCD3C5' }} />)}
              <span className="ml-2 truncate text-[17px] font-sans font-semibold text-[#6B6359]">{w.title}</span>
            </div>
            <div className="space-y-2 px-5 py-4">
              {w.lines.map((l) => <div key={l} className="font-sans text-[18px] leading-snug text-[#1A1714]">{l}</div>)}
            </div>
          </div>
        );
      })}
      <div className="absolute inset-0" style={{ background: '#F2EDE4', opacity: veil, zIndex: 30 }} />
      <div className="absolute" style={{ left: 520, top: 250, width: 880, zIndex: 40 }}>
        {TEACHER_QUESTIONS.map((q, i) => {
          const o = fade(t, QUESTIONS_IN + i * QUESTION_STEP);
          if (o <= 0) return null;
          return (
            <div key={q} className="mb-4 flex items-center gap-4 rounded-2xl border-2 px-6 py-4" style={{ opacity: o, transform: `translateX(${(1 - o) * -40}px)`, background: '#FFFDF8', borderColor: '#1A1714' }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-sans text-[24px] font-extrabold" style={{ background: '#FF5B1F', color: '#1A1714' }}>?</span>
              <span className="font-sans text-[24px] text-[#1A1714]">{q}</span>
            </div>
          );
        })}
      </div>
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 2000 && t < 8200} />
    </div>
  );
}
