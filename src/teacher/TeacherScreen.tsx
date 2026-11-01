import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { classKpis } from '../live/mastery';
import { examRisk } from '../live/study/outlook';
import { stoppedPractising } from '../live/study/signals';
import { fullDate } from '../scenario/course';
import type { AssistantMsg as LiveAssistant, DemoState } from '../live/types';
import { STUDENTS, type Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { LiveText } from './LiveText';
import { Blocks } from './Blocks';
import { Calendar } from './CalendarTab';
import { Classroom, needSupportAt } from './Classroom';
import { ADAPT, FALLBACK, QUESTION_SHORT, studentBrief, TOPICS, type Block, type ContextId } from './conversations';
import { ContextPanel } from './ContextPanel';
import { GREETING, type FrameMsg, type TeacherFrame, type View } from './frame';
import { Arrow, Avatar, Eyebrow, Mark } from './parts';

export interface TeacherActions {
  send(text: string): void;
  open(topic: ContextId): void;
  reset(): void;
  setView(v: View): void;
  approve(id: ContextId): void;
  edit(): void;
  showPanel(id: ContextId | null): void;
  select(index: number | null): void;
  askStudent(s: Student): void;
  askClass(): void;
}

interface ComposerOverride { value: string; onChange(v: string): void; disabled?: boolean }

/** Layout effect in the browser (runs before paint); plain effect under SSR so renderToStaticMarkup stays warning-free. */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const TEACHER = 'Nguyễn Thanh Lam';
const SOURCES = ['LMS', 'Zalo', 'WhatsApp', 'Email', 'Assessments', 'Attendance', 'Records', 'Materials'];
const ORDER: ContextId[] = ['student', 'class', 'attention'];

export interface AttentionRow { topic: ContextId; who: string; what: string; prompt?: string; figure?: string }

/** Today's attention list on the empty state, styled after the reference's ruled schedule. */
const TODAY: AttentionRow[] = [
  { topic: 'student', who: 'Nguyễn Minh Anh', what: 'Quiz 2 dropped' },
  { topic: 'class', who: 'Discrete Mathematics', what: 'Gap: logical equivalence' },
  { topic: 'attention', who: 'Escalation rule', what: 'Need you personally' },
];

/** Live only, while at least one student's exam estimate is At risk or Unlikely. */
const EXAM_ROW: AttentionRow = { topic: 'attention', who: 'Road to the exam', what: 'May not pass', prompt: 'Which students may not pass the exam?' };

/** Figures count up with the row's reveal; at 1 they read as written. */
const figureOf = (i: number, p: number): string =>
  [p >= 1 ? '75→42' : `${Math.round(75 - 33 * p)}`, `${Math.round(12 * p)}/55`, `${Math.round(3 * p)}`][i];

const blocksOf = (m: FrameMsg): Block[] => {
  switch (m.kind) {
    case 'answer': return TOPICS[m.topic!].answer;
    case 'approved': return TOPICS[m.topic!].approved;
    case 'adapt': return ADAPT;
    case 'brief': return studentBrief(STUDENTS[m.index!]);
    case 'live': return liveBlocks(m.live!);
    default: return FALLBACK;
  }
};

/** Live answers: offline ones reuse the canned topic copy; agent ones render text with evidence chips. */
const liveBlocks = (m: LiveAssistant): Block[] =>
  m.canned === 'fallback' ? FALLBACK
    : m.canned ? TOPICS[m.canned].answer
    : m.blocks.map((b, i) => ({ kind: b.kind, body: <LiveText block={b} quoted={m.blocks.slice(0, i).flatMap((p) => p.cites)} /> }));

/** The opening screen's three figures, from live state. */
const liveFigures = (s: DemoState): string[] => {
  const ma = s.students[MINH_ANH.index];
  const k = classKpis(s.students);
  return [`${ma.quiz.q1}→${ma.quiz.q2}`, `${k.needSupport}/55`, String(k.escalated), String(examRisk(s).length)];
};

/** Live only: the three rows with live figures, Road to the exam while anyone may not pass, then one row per student who has stopped practising. */
export function liveTodayRows(s: DemoState): AttentionRow[] {
  const figures = liveFigures(s);
  const rows: AttentionRow[] = TODAY.map((r, i) => ({ ...r, figure: figures[i] }));
  if (examRisk(s).length > 0) rows.push({ ...EXAM_ROW, figure: figures[3] });
  for (const st of s.students) {
    const rec = s.study[st.id];
    const p = rec ? stoppedPractising(rec, s.day) : null;
    if (p) {
      rows.push({
        topic: 'attention', who: st.short, what: 'Stopped practising',
        figure: `${p.done}/${p.planned}`, prompt: `${st.short} has stopped practising. What should I do?`,
      });
    }
  }
  return rows;
}

/** Stateless: everything on screen is a function of `frame`. With no `actions`, buttons render but do nothing. */
export function TeacherScreen({ frame, actions, composer }: { frame: TeacherFrame; actions?: TeacherActions; composer?: ComposerOverride }) {
  const { view, panel } = frame;
  const empty = view === 'chat' && frame.messages.length === 0 && frame.thinking === null;
  const title = view === 'classroom' ? 'Classroom' : view === 'calendar' ? 'Calendar' : frame.title ?? 'New conversation';
  const live = useLive();
  const isAnswer = (m: FrameMsg) => m.role === 'assistant' && (m.kind === 'answer' || (m.kind === 'live' && m.live?.source !== 'system'));
  const hasAnswer = frame.messages.some((m) => m.role === 'assistant' && (m.topic || m.live?.panel));
  const lastAnswer = [...frame.messages].reverse().find(isAnswer);
  const openContext = (m?: FrameMsg) => {
    if (m?.live?.panel) live?.showPanel(m.live.panel);
    else actions?.showPanel(m?.topic ?? null);
  };
  const badge = live ? classKpis(live.state.students).needSupport : needSupportAt(frame.classroom.adapt);
  const composerValue = composer?.value ?? frame.composer;
  const send = () => composer && actions?.send(composer.value);
  const threadRef = useRef<HTMLDivElement>(null);
  const last = frame.messages[frame.messages.length - 1];
  // `shown` keeps counting after the last block appears, so cap it: the key changes only while content grows.
  const lastShown = last && last.role === 'assistant' ? Math.min(last.shown, blocksOf(last).length) : last?.shown;
  const scrollKey = `${frame.messages.length}:${lastShown}:${frame.thinking?.shown}`;
  const contentRef = useRef<HTMLDivElement>(null);
  const scripted = !actions;
  const pin = () => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  };
  // Scripted: pinned to the bottom on every render, so it is a pure function of the frame. Live: only when the key
  // changes, so the user can scroll up.
  useIsoLayoutEffect(() => {
    if (scripted) pin();
  });
  useIsoLayoutEffect(() => {
    if (!scripted) pin();
  }, [scripted, scrollKey]);
  // Late layout shifts (font swap, block reveals) re-pin the scripted thread.
  useIsoLayoutEffect(() => {
    const el = contentRef.current;
    if (!scripted || !el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(pin);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scripted, view, empty]);

  return (
    <div className="flex h-full bg-egg-bg font-sans text-egg-ink antialiased">
      <Sidebar badge={badge} view={view} active={view === 'chat' ? panel?.id ?? null : null} actions={actions} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-egg-line px-8">
          {/* Instrument Serif has no Vietnamese glyphs, so student-name titles use the sans face. */}
          <h1 className={`truncate leading-none ${frame.sansTitle && view === 'chat' ? 'text-[19px] font-semibold' : 'font-serif text-[24px]'}`}>{title}</h1>
          {live && <span className="ml-auto font-mono text-[12px] tabular-nums text-egg-mute">{`${fullDate(live.state.day)} · ${fmt(live.state.clock)}`}</span>}
          <span className={`${live ? '' : 'ml-auto '}rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute`}>Discrete Mathematics · DM-2026</span>
          {actions && view === 'chat' && panel === null && hasAnswer && (
            <button
              type="button"
              onClick={() => openContext(lastAnswer)}
              className="rounded-full bg-egg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-egg-card"
            >
              Show context
            </button>
          )}
          {live && (
            <button type="button" onClick={() => void live.post('reset')} className="rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute hover:border-egg-ink hover:text-egg-ink">
              Reset demo
            </button>
          )}
        </header>
        {frame.tracker > 0 && (
          <div className="flex h-[44px] shrink-0 items-center gap-6 border-b border-egg-line px-8" style={{ opacity: frame.tracker }}>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-mute">Five questions</span>
            {QUESTION_SHORT.map((q, i) => (
              <span key={q} className="flex items-center gap-2 text-[13.5px]">
                <span className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${frame.ticks[i] ? 'border-egg-accent bg-egg-accent text-egg-ink' : 'border-egg-ink/40'}`}>
                  {frame.ticks[i] && <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 5.2 4.2 7.4 8 2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                <span className={frame.ticks[i] ? 'text-egg-ink' : 'text-egg-mute'}>{q}</span>
              </span>
            ))}
          </div>
        )}

        {view === 'classroom' ? (
          <Classroom cls={frame.classroom} studentApproved={frame.approved.includes('student')} actions={actions} />
        ) : view === 'calendar' ? (
          <Calendar />
        ) : empty ? (
          <EmptyState frame={frame} actions={actions} composer={<Composer value={composerValue} onChange={composer?.onChange} readOnly={!composer} disabled={composer?.disabled} onSend={send} big />} />
        ) : (
          <>
            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto">
              <div ref={contentRef} className="mx-auto max-w-[760px] px-8 pb-10 pt-8">
                {frame.messages.map((m, i) =>
                  m.role === 'teacher' ? (
                    <TeacherMsg key={i} msg={m} />
                  ) : (
                    <AssistantMsg
                      key={i}
                      msg={m}
                      isLast={m === lastAnswer && frame.thinking === null}
                      panelShowing={live ? JSON.stringify(panel?.live ?? null) === JSON.stringify(m.live?.panel ?? null) : panel?.id === m.topic}
                      onContext={openContext}
                      actions={actions}
                    />
                  ),
                )}
                {frame.thinking && <Thinking thinking={frame.thinking} />}
              </div>
            </div>
            <div className="shrink-0 px-8 pb-5">
              <div className="mx-auto max-w-[760px]">
                <Composer value={composerValue} onChange={composer?.onChange} readOnly={!composer} disabled={composer?.disabled} onSend={send} />
                {!scripted && <div className="mt-2 text-center text-[11.5px] text-egg-faint">Illustrative demo data · fictional students</div>}
              </div>
            </div>
          </>
        )}
      </main>

      {view === 'chat' && panel && <ContextPanel panel={panel} approved={frame.approved.includes(panel.id)} actions={actions} />}
    </div>
  );
}

function Sidebar({ badge, view, active, actions }: { badge: number; view: View; active: ContextId | null; actions?: TeacherActions }) {
  const live = useLive();
  const nav = (v: View, label: string) => (
    <button
      type="button"
      aria-current={view === v ? 'page' : undefined}
      onClick={() => actions?.setView(v)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] ${view === v ? 'bg-side-hi font-semibold shadow-[0_0_0_1px_rgb(var(--side-ring))]' : 'text-side-mute hover:text-side-ink'}`}
    >
      {label}
      {v === 'classroom' && <span className="rounded-full bg-egg-accent px-2 text-[11px] font-semibold text-egg-ink">{badge}</span>}
    </button>
  );
  const item = (on: boolean) =>
    `w-full truncate rounded-lg px-3 py-2 text-left text-[13.5px] ${on ? 'bg-side-hi font-semibold text-side-ink shadow-[0_0_0_1px_rgb(var(--side-ring))]' : 'text-side-mute hover:bg-side-hi/60 hover:text-side-ink'}`;
  return (
    <nav className="flex w-[264px] shrink-0 flex-col border-r border-side-edge bg-side-bg px-5 py-5 text-side-ink">
      <div className="flex items-center gap-2">
        <span className="font-serif text-[30px] leading-none">Beyond</span>
        <Mark size={16} className="text-side-mark" />
      </div>
      <button type="button" onClick={() => actions?.reset()} className="mt-6 flex items-center gap-2 rounded-full bg-side-cta px-4 py-2.5 text-[13.5px] font-semibold text-side-cta-ink hover:brightness-90">
        <span className="text-[18px] leading-none">+</span> New conversation
      </button>
      <div className="mt-5 space-y-0.5">
        {nav('chat', 'Chat')}
        {nav('classroom', 'Classroom')}
        {live && nav('calendar', 'Calendar')}
      </div>

      <div className="mt-7"><Eyebrow className="text-side-mute">Today</Eyebrow></div>
      <ul className="mt-2 space-y-0.5">
        {live ? (
          live.state.conversations.length ? (
            live.state.conversations.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={live.activeId === c.id ? 'page' : undefined} onClick={() => live.openConversation(c.id)} className={item(live.activeId === c.id)}>
                  {c.title}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-[13px] text-side-mute">No conversations yet</li>
          )
        ) : (
          ORDER.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => actions?.open(t)} className={item(active === t)}>
                {TOPICS[t].title}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="mt-6"><Eyebrow className="text-side-mute">This week</Eyebrow></div>
      <ul className="mt-2 space-y-0.5 text-[13.5px] text-side-mute">
        {['Assignment 3 extension requests', 'Week 7 room change', 'Quiz 2 item analysis'].map((t) => (
          <li key={t} className="truncate rounded-lg px-3 py-2">{t}</li>
        ))}
      </ul>

      <div className="mt-auto rounded-2xl border border-side-line bg-side-card p-4">
        <div className="font-serif text-[22px] leading-none">Discrete Mathematics</div>
        <div className="mt-1 text-[12.5px] text-side-mute">DM-2026 · 55 students</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {SOURCES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-side-chip px-2 py-0.5 text-[10.5px] text-side-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-egg-accent" />{s}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 px-1">
        <Avatar name={TEACHER} size={34} />
        <div>
          <div className="text-[13.5px] font-semibold">{TEACHER}</div>
          <div className="text-[12px] text-side-mute">Lecturer</div>
        </div>
      </div>
    </nav>
  );
}

function EmptyState({ frame, actions, composer }: { frame: TeacherFrame; actions?: TeacherActions; composer: ReactNode }) {
  const typed = GREETING.slice(0, frame.greeting.chars);
  const comma = typed.indexOf(',');
  const line1 = comma < 0 ? typed : typed.slice(0, comma + 1);
  const line2 = comma < 0 ? '' : typed.slice(comma + 1).trim();
  const rows = frame.greeting.rows;
  const live = useLive();
  const list = live ? liveTodayRows(live.state) : TODAY;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col px-8 pt-[97px]">
        <Eyebrow>{live ? `${fullDate(live.state.day)} · ${fmt(live.state.clock)}` : 'Saturday, 31 October'}</Eyebrow>
        <h2 className="mt-3 font-serif text-[84px] leading-[0.92] tracking-[-0.01em]">
          {line1}<br /><span className="italic">{line2}</span>
        </h2>
        <div className="mt-8 border-t-2 border-egg-ink">
          <div className="flex items-baseline justify-between py-2">
            <span className="text-[13px] text-egg-mute">Needs your attention today</span>
            <span className="text-[13px] text-egg-mute">from 8 sources</span>
          </div>
          {list.map((row, i) => (
            <button
              key={`${row.who}·${row.what}`}
              type="button"
              onClick={() => actions?.send(row.prompt ?? TOPICS[row.topic].prompt)}
              className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-6 border-t border-egg-ink/70 py-3.5 text-left"
              style={{ opacity: rows[Math.min(i, 2)], transform: `translateY(${(1 - rows[Math.min(i, 2)]) * 12}px)` }}
            >
              <span>
                <span className="block text-[13px] italic text-egg-mute">{row.who}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[17px] font-semibold uppercase tracking-[0.04em]">
                  <Mark size={13} className="text-egg-ink" />{row.what}
                </span>
              </span>
              <span className="font-serif text-[40px] leading-none text-egg-accent-ink">{row.figure ?? figureOf(i, rows[Math.min(i, 2)])}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-egg-ink text-egg-card">
                <Arrow size={15} dir="right" />
              </span>
            </button>
          ))}
        </div>
        <div className="mt-10">{composer}</div>
        {actions && <div className="mt-2 text-center text-[11.5px] text-egg-faint">Illustrative demo data · fictional students</div>}
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, readOnly, disabled = false, big = false }: {
  value: string; onChange?: (v: string) => void; onSend: () => void; readOnly: boolean; disabled?: boolean; big?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSend(); }}
      className="rounded-[22px] border border-egg-line bg-egg-card p-3 shadow-[0_1px_0_#DCD3C5,0_12px_32px_-18px_rgba(26,23,20,0.25)] focus-within:border-egg-ink/40"
    >
      <textarea
        value={value}
        readOnly={readOnly || disabled}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        rows={big ? 2 : 1}
        placeholder={disabled ? 'The agents are working…' : 'Ask about a student, a gap, or your class…'}
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-[15.5px] text-egg-ink placeholder:text-egg-faint focus:outline-none"
      />
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="rounded-full border border-egg-line px-2.5 py-1 text-[12px] text-egg-mute">+ Attach</span>
        <span className="rounded-full border border-egg-line px-2.5 py-1 text-[12px] text-egg-mute">Class · DM-2026</span>
        <button type="submit" aria-label="Send" className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full ${value.trim() ? 'bg-egg-accent text-egg-ink' : 'bg-egg-ink text-egg-card'}`}>
          <Arrow size={16} />
        </button>
      </div>
    </form>
  );
}

const rise = (appear: number, px: number) => ({ opacity: appear, transform: `translateY(${(1 - appear) * px}px)` });

function TeacherMsg({ msg }: { msg: FrameMsg }) {
  return (
    <div className="mb-8 flex justify-end" style={rise(msg.appear, 6)}>
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-egg-ink px-4 py-2.5 text-[15px] text-egg-card">{msg.text}</div>
    </div>
  );
}

function AssistantMsg({ msg, isLast, panelShowing, onContext, actions }: {
  msg: FrameMsg; isLast: boolean; panelShowing: boolean; onContext(m: FrameMsg): void; actions?: TeacherActions;
}) {
  const blocks = blocksOf(msg);
  const done = msg.shown >= blocks.length;
  const live = msg.live;
  const topic = msg.topic ? TOPICS[msg.topic] : null;
  const isAnswer = msg.kind === 'answer' || (live !== undefined && live.source !== 'system');
  const hasContext = live ? live.panel !== null : msg.topic !== undefined;
  const followUps = live ? live.followUps : topic?.followUps ?? [];
  return (
    <div className="mb-9 grid grid-cols-[28px_1fr] gap-3" style={rise(msg.appear, 6)}>
      <div className="pt-1"><Mark size={20} /></div>
      <div>
        {(msg.stamp || live?.source === 'offline') && (
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-egg-mute">
            {msg.stamp}
            {live?.source === 'offline' && <span className="rounded-full border border-egg-line px-2 py-px uppercase tracking-wide">Offline answer</span>}
          </div>
        )}
        <div className="chat-prose text-[15.5px] leading-[1.65] text-egg-ink/90">
          <Blocks blocks={blocks} shown={msg.shown} />
        </div>
        {isAnswer && done && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-egg-mute">
            <span className="rounded-full bg-egg-paper px-2.5 py-1">Student Analysis Agent ⇄ Teaching Assistance Agent</span>
            {!panelShowing && hasContext && (
              <button type="button" onClick={() => onContext(msg)} className="rounded-full border border-egg-ink/25 px-2.5 py-1 font-semibold text-egg-ink hover:border-egg-ink">
                Open context →
              </button>
            )}
          </div>
        )}
        {isLast && done && followUps.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {followUps.map((f) => (
              <button key={f} type="button" onClick={() => actions?.send(f)} className="rounded-full border border-egg-line bg-egg-card px-3.5 py-1.5 text-[13px] text-egg-ink hover:border-egg-accent">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thinking({ thinking }: { thinking: NonNullable<TeacherFrame['thinking']> }) {
  const lines = thinking.lines.slice(0, thinking.shown);
  return (
    <div className="mb-9 grid grid-cols-[28px_1fr] gap-3">
      <div className="pt-0.5"><Mark size={20} className="text-egg-accent-ink" rotate={thinking.elapsed * 0.15} /></div>
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={l} className="flex items-center gap-2 text-[13.5px] text-egg-mute">
            {l}
            {i === lines.length - 1 && (
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-1 w-1 rounded-full bg-egg-mute"
                    style={{ opacity: 0.25 + 0.75 * Math.max(0, Math.sin((thinking.elapsed / 1100) * 2 * Math.PI - d * 0.8)) }}
                  />
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
