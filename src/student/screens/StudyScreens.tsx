import { useState } from 'react';
import type { TodayRow } from '../../live/study/today';
import type { CardRating, StudyDay } from '../../live/types';
import type { Card } from '../../scenario/cards';
import type { CloId } from '../../scenario/course';
import { Eyebrow, Mark } from '../../teacher/parts';
import { rowLabel, type PractiseRow, type SemesterView, type TodayView } from '../studyView';
import type { StudyTab } from '../../live/study/reducer';

const BASE = 'absolute inset-0 overflow-y-auto bg-egg-bg px-5 pt-14 font-sans text-egg-ink';
/** Leaves room for the tab bar. */
const SCREEN = `${BASE} pb-24`;
const PLAIN = `${BASE} pb-8`;
const PRIMARY = 'w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card';
const GHOST = 'w-full rounded-full border border-egg-ink py-3 text-[15px] font-semibold text-egg-ink';
const ROW = 'flex w-full items-center gap-3 border-b border-egg-line py-3.5 text-left';

const TABS: { id: StudyTab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'choosePractice', label: 'Practise' }, { id: 'cards', label: 'Cards' }, { id: 'semester', label: 'Semester' },
];

const FACTS: [label: string, key: 'nextLecture' | 'nextAssessment' | 'assignment'][] = [
  ['Next lecture', 'nextLecture'], ['Next assessment', 'nextAssessment'], ['Assignment', 'assignment'],
];

export function TabBar({ active, onTab }: { active: StudyTab; onTab(tab: StudyTab): void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 flex border-t border-egg-line bg-egg-card" style={{ zIndex: 20 }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onTab(t.id)}
          className={`flex-1 py-3.5 text-[13.5px] font-semibold ${t.id === active ? 'text-egg-ink' : 'text-egg-mute'}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export function PickScreen({ students, onPick }: { students: { id: string; name: string }[]; onPick(id: string): void }) {
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">Who are you?</div>
      <div className="mt-1 text-[14px] text-egg-mute">Choose a student from the class. All of them are fictional.</div>
      <div className="mt-4 border-t border-egg-line">
        {students.map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s.id)} className={`${ROW} text-[16px] font-semibold`}>{s.name}</button>
        ))}
      </div>
    </div>
  );
}

function Minutes({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="mt-4 block">
      <span className="text-[15px] font-semibold">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={5}
        max={240}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-egg-line bg-egg-card px-4 py-3 font-mono text-[18px] text-egg-ink"
      />
    </label>
  );
}

export function SetupScreen({ onSave }: { onSave(weekday: number, weekend: number): void }) {
  const [weekday, setWeekday] = useState('30');
  const [weekend, setWeekend] = useState('60');
  const valid = (v: string) => v.trim() !== '' && Number(v) >= 5 && Number(v) <= 240;
  const good = valid(weekday) && valid(weekend);
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">How much time do you have?</div>
      <div className="mt-1 text-[14px] text-egg-mute">Your plan will fit this, then learn from what you really do.</div>
      <Minutes label="Minutes on a weekday" value={weekday} onChange={setWeekday} />
      <Minutes label="Minutes on a weekend day" value={weekend} onChange={setWeekend} />
      {!good && <div className="mt-3 text-[13.5px] text-egg-mute">Enter 5 to 240 minutes.</div>}
      <button type="button" disabled={!good} onClick={() => onSave(Number(weekday), Number(weekend))} className={`${PRIMARY} mt-6 disabled:opacity-40`}>Build my plan</button>
    </div>
  );
}

export function TodayScreen({ view, onRow, onNextDay, onNextWeek }: { view: TodayView; onRow(row: TodayRow): void; onNextDay(): void; onNextWeek(): void }) {
  return (
    <div className={SCREEN}>
      <div className="text-[15px] text-egg-mute">{view.date}</div>
      <div className="text-[26px] font-bold">{view.name}</div>
      <div className="mt-4 rounded-3xl bg-egg-ink p-5 text-egg-card">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-card/60">{view.examIn}</div>
        <div className="mt-2 font-serif text-[30px] leading-none">{view.gpa}</div>
        <div className="mt-1.5 text-[13px] text-egg-card/75">{view.marks}</div>
        <dl className="mt-4 space-y-2.5">
          {FACTS.map(([label, key]) => view[key] && (
            <div key={key}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-egg-card/60">{label}</dt>
              <dd className="text-[14px]">{view[key]}</dd>
            </div>
          ))}
        </dl>
      </div>
      {view.planning && (
        <div className="mt-4 rounded-2xl bg-egg-tint p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold"><Mark size={14} />Writing your plan</div>
          {view.planning.map((line) => <div key={line} className="mt-1 text-[13px] text-egg-mute">{line}</div>)}
        </div>
      )}
      {view.reason && <div className="mt-4 text-[15px] leading-snug">{view.reason}</div>}
      {view.offline && <div className="mt-1 text-[12.5px] text-egg-mute">Offline plan</div>}
      {view.replanning && <div className="mt-1 text-[12.5px] text-egg-mute">Updating your plan…</div>}
      {!view.examDay && !view.planning && (
        <>
          <div className="mt-6"><Eyebrow>{`Today · ${view.done} of ${view.budget} min`}</Eyebrow></div>
          <div className="mt-2 border-t border-egg-line">
            {view.rows.map((row, i) => (
              <button key={i} type="button" onClick={() => onRow(row)} className={ROW}>
                <span className="flex-1 text-[16px] font-semibold">{rowLabel(row)}</span>
                <span className="text-[13px] text-egg-mute">{`${row.minutes} min`}</span>
              </button>
            ))}
            {view.rows.length === 0 && <div className="py-3.5 text-[15px] text-egg-mute">Nothing left for today.</div>}
          </div>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onNextDay} className={GHOST}>Next day</button>
            <button type="button" onClick={onNextWeek} className={GHOST}>Next week</button>
          </div>
        </>
      )}
      {view.examDay && <div className="mt-6 rounded-2xl bg-egg-sage-tint p-3 text-center text-[15px] font-semibold text-egg-sage">Good luck today</div>}
    </div>
  );
}

export function PractiseScreen({ rows, onStart }: { rows: PractiseRow[]; onStart(clo: CloId | null): void }) {
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Practise</div>
      <div className="mt-1 text-[14px] text-egg-mute">5 questions, chosen for you.</div>
      <button type="button" onClick={() => onStart(null)} className={`${PRIMARY} mt-4`}>Practise what I need</button>
      <div className="mt-6 border-t border-egg-line">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => onStart(r.id)} className={ROW}>
            <span className="flex-1">
              <span className="block text-[16px] font-semibold">{r.title}</span>
              <span className="block text-[13px] text-egg-mute">{`${r.level} · ${r.share}% of the exam`}</span>
            </span>
            <span className="font-mono text-[14px] text-egg-mute">{`${r.mastery}%`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const RATINGS: { id: CardRating; label: string }[] = [{ id: 'again', label: 'Again' }, { id: 'hard', label: 'Hard' }, { id: 'good', label: 'Good' }, { id: 'easy', label: 'Easy' }];

/** Reveal is local: the server only hears the rating. Keyed by card in LivePhone, so a new card starts face down. */
export function CardsScreen({ card, left, onRate }: { card: Card | null; left: number; onRate(rating: CardRating): void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Cards</div>
      <div className="mt-1 text-[14px] text-egg-mute">{card ? `${left} left today` : 'Nothing due. Come back tomorrow.'}</div>
      {card && (
        <>
          <div className="mt-4 rounded-3xl border border-egg-line bg-egg-card p-5">
            <div className="text-[19px] font-bold leading-snug">{card.front}</div>
            {shown && <div className="mt-4 border-t border-egg-line pt-4 text-[16px] leading-snug">{card.back}</div>}
          </div>
          {shown ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {RATINGS.map((r) => (
                <button key={r.id} type="button" onClick={() => onRate(r.id)} className="rounded-2xl border border-egg-ink py-2.5 text-[14px] font-semibold">{r.label}</button>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setShown(true)} className={`${PRIMARY} mt-4`}>Show the answer</button>
          )}
        </>
      )}
    </div>
  );
}

export function SemesterScreen({ view }: { view: SemesterView }) {
  return (
    <div className={SCREEN}>
      <div className="text-[28px] font-bold">Road to the exam</div>
      {view.weeks.map((w) => (
        <section key={w.week} className="mt-4 border-t border-egg-line pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[16px] font-semibold">{`Week ${w.week}${w.revision ? ' · revision' : ''}`}</span>
            <span className="text-[13px] text-egg-mute">{w.minutes ? `${w.minutes} min · ${w.focus.join(', ')}` : w.from}</span>
          </div>
          {w.assessments.map((a) => (
            <div key={a.title} className="mt-1 flex justify-between text-[14px]">
              <span>{`${a.title} · ${a.date}`}</span>
              {a.mark !== null && <span className="font-mono">{`${a.mark}%`}</span>}
            </div>
          ))}
        </section>
      ))}
      {view.leftOut.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Left out for now</Eyebrow>
          {view.leftOut.map((l) => <div key={l} className="mt-1 text-[14px] leading-snug">{l}</div>)}
        </section>
      )}
      {view.changes.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Why this changed</Eyebrow>
          {view.changes.map((c, i) => (
            <div key={i} className="mt-2 rounded-2xl bg-egg-tint p-3 text-[14px] leading-snug">
              <div className="font-semibold">{`${c.date} · ${c.why}`}</div>
              <div className="text-egg-mute">{c.reason}</div>
            </div>
          ))}
        </section>
      )}
      {view.previous.length > 0 && (
        <section className="mt-5">
          <Eyebrow>Previous subjects</Eyebrow>
          {view.previous.map((h) => (
            <div key={h.subject} className="mt-1 flex justify-between gap-3 text-[14px]">
              <span>{`${h.subject} · ${h.term}`}</span>
              <span className="shrink-0 font-mono">{`${h.grade.toFixed(1)} · ${h.letter}`}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const CHECKS: { id: Exclude<StudyDay['check'], null>; label: string }[] = [
  { id: 'tooMuch', label: 'Too much' }, { id: 'right', label: 'About right' }, { id: 'tooLittle', label: 'Too little' },
];

export function CheckInScreen({ onAnswer, onBack }: { onAnswer(check: StudyDay['check']): void; onBack(): void }) {
  return (
    <div className={PLAIN}>
      <div className="text-[28px] font-bold">How was today?</div>
      <div className="mt-1 text-[14px] text-egg-mute">This keeps your plan realistic.</div>
      <div className="mt-5 space-y-3">
        {CHECKS.map((c) => <button key={c.id} type="button" onClick={() => onAnswer(c.id)} className={GHOST}>{c.label}</button>)}
      </div>
      <button type="button" onClick={onBack} className="mt-5 text-[13.5px] font-semibold text-egg-mute underline underline-offset-4">Back to today</button>
    </div>
  );
}
