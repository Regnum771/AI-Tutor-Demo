import { fade, prog, stepIndex } from '../../engine/anim';
import { APP_HEADER, MESSY_START, POPUPS, QUESTIONS_IN } from '../../scenario/clutter';
import { TEACHER_QUESTIONS } from '../../scenario/sources';
import { FakeCursor, type CursorKey } from '../../ui/FakeCursor';
import { egg } from '../../ui/theme';

const QUESTION_STEP = 1000;
const POP_MS = 220;
/** Popups stack from 10 + index; the veil and questions must sit above all of them. */
export const VEIL_Z = 100;

/** Grid centre of orderly popup i (3 columns x 2 rows). */
const centre = (i: number) => ({ x: POPUPS[i].x + POPUPS[i].w / 2, y: POPUPS[i].y + POPUPS[i].h / 2 });

const CURSOR: CursorKey[] = [
  { t: 2000, x: 1700, y: 900 },
  { t: 2600, ...centre(1), click: true },
  { t: 5300, ...centre(5), click: true },
  { t: 6000, x: 1750, y: 1000 },
];
const CLICKS = CURSOR.filter((k) => k.click);
const FOCUS = [1, 5];

/** Sc1: the teacher's sources pile up over the live-action background (transparent here), then the five questions. */
export function ProblemScene({ t, cursor }: { t: number; cursor: boolean }) {
  const click = stepIndex(t, CLICKS.map((k) => k.t));
  const focused = t < MESSY_START && click >= 0 ? FOCUS[click] : -1;
  const veil = prog(t, QUESTIONS_IN - 300, 600) * 0.6;
  return (
    <div className="absolute inset-0 isolate">
      {POPUPS.map((p, i) => {
        const o = prog(t, p.at, POP_MS);
        if (o <= 0) return null;
        const head = APP_HEADER[p.kind];
        const lift = p.rot === 0 ? `translateY(${(1 - o) * 24}px)` : `scale(${0.9 + 0.1 * o})`;
        return (
          <div
            key={p.title}
            className="absolute overflow-hidden rounded-xl"
            style={{
              left: p.x, top: p.y, width: p.w, height: p.h, opacity: o, zIndex: i === focused ? 25 : 10 + i,
              transform: `${lift} rotate(${p.rot}deg)`,
              background: '#FFFDF8',
              border: i === focused ? '2px solid #1A1714' : '1px solid rgba(26,23,20,0.14)',
              boxShadow: '0 22px 44px -18px rgba(26,23,20,0.45)',
            }}
          >
            <div className="flex items-center gap-2 px-4" style={{ height: 40, background: head.bg, color: head.fg }}>
              {[0, 1, 2].map((d) => <span key={d} className="h-2.5 w-2.5 rounded-full" style={{ background: head.fg, opacity: 0.45 }} />)}
              <span className="ml-2 truncate font-sans text-[16px] font-semibold">{p.title}</span>
            </div>
            <div className="space-y-1.5 px-5 py-3.5">
              {p.lines.map((l) => <div key={l} className="font-sans text-[17px] leading-snug text-[#1A1714]">{l}</div>)}
            </div>
          </div>
        );
      })}
      <div className="absolute inset-0" style={{ background: '#1A1714', opacity: veil, zIndex: VEIL_Z }} />
      <div className="absolute" style={{ left: 520, top: 250, width: 880, zIndex: VEIL_Z + 1 }}>
        {TEACHER_QUESTIONS.map((q, i) => {
          const o = fade(t, QUESTIONS_IN + i * QUESTION_STEP);
          if (o <= 0) return null;
          return (
            <div key={q} className="mb-4 flex items-center gap-4 rounded-2xl border-2 px-6 py-4" style={{ opacity: o, transform: `translateX(${(1 - o) * -40}px)`, background: '#FFFDF8', borderColor: '#1A1714' }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-sans text-[24px] font-extrabold" style={{ background: egg('accent'), color: '#1A1714' }}>?</span>
              <span className="font-sans text-[24px] text-[#1A1714]">{q}</span>
            </div>
          );
        })}
      </div>
      <FakeCursor t={t} keys={CURSOR} visible={cursor && t >= 2000 && t < 6000} />
    </div>
  );
}
