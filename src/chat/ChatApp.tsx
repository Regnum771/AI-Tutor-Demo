import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STUDENTS, type Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { Classroom } from './Classroom';
import { FALLBACK, routePrompt, studentBrief, TOPICS, type ContextId } from './conversations';
import { ContextPanel } from './ContextPanel';
import { Arrow, Asterisk, Avatar, Eyebrow } from './parts';

type Msg =
  | { role: 'teacher'; text: string }
  | { role: 'assistant'; kind: 'answer' | 'approved'; topic: ContextId }
  | { role: 'assistant'; kind: 'fallback' }
  | { role: 'assistant'; kind: 'brief'; index: number };

type View = 'chat' | 'classroom';

const TEACHER = 'Nguyễn Thanh Lam';
const THINK_STEP_MS = 900;
const SOURCES = ['LMS', 'Zalo', 'WhatsApp', 'Email', 'Assessments', 'Attendance', 'Records', 'Materials'];
const ORDER: ContextId[] = ['student', 'class', 'attention'];

/** Today's attention list on the empty state, styled after the reference's ruled schedule. */
const TODAY: { topic: ContextId; who: string; what: string; figure: string }[] = [
  { topic: 'student', who: 'Nguyễn Minh Anh', what: 'Quiz 2 dropped', figure: '75→42' },
  { topic: 'class', who: 'Discrete Mathematics', what: 'Gap: logical equivalence', figure: '12/55' },
  { topic: 'attention', who: 'Escalation rule', what: 'Need you personally', figure: '3' },
];

interface ChatState { messages: Msg[]; context: ContextId | null; title?: string }

/** `?c=student|class|attention` opens that conversation already answered; `?view=classroom` opens the class view. */
function initialFromUrl(): ChatState {
  const c = new URLSearchParams(window.location.search).get('c') as ContextId | null;
  if (!c || !TOPICS[c]) return { messages: [], context: null };
  return { messages: conversationFor(c), context: c };
}
const initialView = (): View => (new URLSearchParams(window.location.search).get('view') === 'classroom' ? 'classroom' : 'chat');

const conversationFor = (c: ContextId): Msg[] => [
  { role: 'teacher', text: TOPICS[c].prompt },
  { role: 'assistant', kind: 'answer', topic: c },
];

export function ChatApp() {
  const [{ messages, context, title }, setChat] = useState<ChatState>(initialFromUrl);
  const [view, setView] = useState<View>(initialView);
  const [panelOpen, setPanelOpen] = useState(context !== null);
  const [approved, setApproved] = useState<Record<ContextId, boolean>>({ student: false, class: false, attention: false });
  const [thinking, setThinking] = useState<{ topic: ContextId | null; lines: string[]; step: number } | null>(null);
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  function send(text: string) {
    const prompt = text.trim();
    if (!prompt || thinking) return;
    const topic = routePrompt(prompt);
    setDraft('');
    setChat((s) => ({ ...s, messages: [...s.messages, { role: 'teacher', text: prompt }] }));
    think(topic, topic ? TOPICS[topic].thinking : ['Reading your class context'], () => {
      setChat((s) => ({
        ...s,
        context: topic ?? s.context,
        messages: [...s.messages, topic ? { role: 'assistant', kind: 'answer', topic } : { role: 'assistant', kind: 'fallback' }],
      }));
      if (topic) setPanelOpen(true);
    });
  }

  /** Show the agents' working lines one by one, then run `done`. */
  function think(topic: ContextId | null, lines: string[], done: () => void) {
    setThinking({ topic, lines, step: 0 });
    for (let i = 1; i < lines.length; i++) later(i * THINK_STEP_MS, () => setThinking({ topic, lines, step: i }));
    later(lines.length * THINK_STEP_MS + 300, () => { setThinking(null); done(); });
  }

  /** From the classroom grid: a fresh conversation about one student. */
  function askStudent(st: Student) {
    if (st.index === MINH_ANH.index) { reset(); send(TOPICS.student.prompt); return; }
    reset();
    setChat({ messages: [{ role: 'teacher', text: `How is ${st.name} doing?` }], context: null, title: st.name });
    think(null, [`Student Analysis Agent · reading ${st.name}’s learning twin`], () =>
      setChat((s) => ({ ...s, messages: [...s.messages, { role: 'assistant', kind: 'brief', index: st.index }] })),
    );
  }

  function askClass() {
    reset();
    send(TOPICS.class.prompt);
  }

  function open(topic: ContextId) {
    setView('chat');
    timers.current.forEach(clearTimeout);
    setThinking(null);
    setChat({ messages: conversationFor(topic), context: topic });
    setPanelOpen(true);
  }

  function approve(topic: ContextId) {
    setApproved((a) => ({ ...a, [topic]: true }));
    later(500, () => setChat((s) => ({ ...s, messages: [...s.messages, { role: 'assistant', kind: 'approved', topic }] })));
  }

  function reset() {
    setView('chat');
    timers.current.forEach(clearTimeout);
    setThinking(null);
    setChat({ messages: [], context: null });
    setPanelOpen(false);
  }

  const empty = messages.length === 0 && !thinking;
  const titled = thinking?.topic ?? context;
  const headerTitle = view === 'classroom' ? 'Classroom' : titled ? TOPICS[titled].title : !empty && title ? title : 'New conversation';
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="flex h-full bg-egg-bg font-sans text-egg-ink antialiased">
      <Sidebar view={view} active={view === 'chat' ? context : null} onView={setView} onOpen={open} onNew={reset} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-egg-line px-8">
          {/* Instrument Serif has no Vietnamese glyphs, so student-name titles use the sans face. */}
          <h1 className={`truncate leading-none ${view === 'chat' && !titled && title && !empty ? 'text-[19px] font-semibold' : 'font-serif text-[24px]'}`}>{headerTitle}</h1>
          <span className="ml-auto rounded-full border border-egg-line px-3 py-1 text-[12px] text-egg-mute">Discrete Mathematics · DM-2026</span>
          {view === 'chat' && context && !panelOpen && (
            <button type="button" onClick={() => setPanelOpen(true)} className="rounded-full bg-egg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-egg-card">
              Show context
            </button>
          )}
        </header>

        {view === 'classroom' ? (
          <Classroom onAskClass={askClass} onAskStudent={askStudent} />
        ) : empty ? (
          <EmptyState onPick={(t) => send(TOPICS[t].prompt)} composer={<Composer value={draft} onChange={setDraft} onSend={() => send(draft)} big />} />
        ) : (
          <>
            <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[760px] px-8 pb-10 pt-8">
                {messages.map((m, i) =>
                  m.role === 'teacher' ? (
                    <TeacherMsg key={i} text={m.text} />
                  ) : (
                    <AssistantMsg
                      key={i}
                      msg={m}
                      isLast={m === lastAnswer && !thinking}
                      panelShowing={panelOpen && context === ('topic' in m ? m.topic : null)}
                      onShowContext={(t) => { setChat((s) => ({ ...s, context: t })); setPanelOpen(true); }}
                      onFollowUp={send}
                    />
                  ),
                )}
                {thinking && <Thinking lines={thinking.lines} step={thinking.step} />}
              </div>
            </div>
            <div className="shrink-0 px-8 pb-5">
              <div className="mx-auto max-w-[760px]">
                <Composer value={draft} onChange={setDraft} onSend={() => send(draft)} />
                <div className="mt-2 text-center text-[11.5px] text-egg-faint">Illustrative demo data · fictional students</div>
              </div>
            </div>
          </>
        )}
      </main>

      {view === 'chat' && context && panelOpen && (
        <ContextPanel id={context} approved={approved[context]} onApprove={() => approve(context)} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}

function Sidebar({ view, active, onView, onOpen, onNew }: {
  view: View; active: ContextId | null; onView: (v: View) => void; onOpen: (t: ContextId) => void; onNew: () => void;
}) {
  const nav = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => onView(v)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] ${view === v ? 'bg-egg-card font-semibold shadow-[0_0_0_1px_#DCD3C5]' : 'text-egg-mute hover:text-egg-ink'}`}
    >
      {label}
      {v === 'classroom' && <span className="rounded-full bg-egg-orange px-2 text-[11px] font-semibold text-egg-ink">12</span>}
    </button>
  );
  return (
    <nav className="flex w-[264px] shrink-0 flex-col border-r border-egg-line px-5 py-5">
      <div className="flex items-center gap-2">
        <span className="font-serif text-[30px] leading-none">Beyond</span>
        <Asterisk size={16} />
      </div>
      <button type="button" onClick={onNew} className="mt-6 flex items-center gap-2 rounded-full bg-egg-ink px-4 py-2.5 text-[13.5px] font-semibold text-egg-card hover:bg-black">
        <span className="text-[18px] leading-none">+</span> New conversation
      </button>
      <div className="mt-5 space-y-0.5">
        {nav('chat', 'Chat')}
        {nav('classroom', 'Classroom')}
      </div>

      <div className="mt-7"><Eyebrow>Today</Eyebrow></div>
      <ul className="mt-2 space-y-0.5">
        {ORDER.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => onOpen(t)}
              className={`w-full truncate rounded-lg px-3 py-2 text-left text-[13.5px] ${active === t ? 'bg-egg-card font-semibold text-egg-ink shadow-[0_0_0_1px_#DCD3C5]' : 'text-egg-mute hover:bg-egg-card/60 hover:text-egg-ink'}`}
            >
              {TOPICS[t].title}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6"><Eyebrow>This week</Eyebrow></div>
      <ul className="mt-2 space-y-0.5 text-[13.5px] text-egg-mute">
        {['Assignment 3 extension requests', 'Week 7 room change', 'Quiz 2 item analysis'].map((t) => (
          <li key={t} className="truncate rounded-lg px-3 py-2">{t}</li>
        ))}
      </ul>

      <div className="mt-auto rounded-2xl border border-egg-line bg-egg-paper p-4">
        <div className="font-serif text-[22px] leading-none">Discrete Mathematics</div>
        <div className="mt-1 text-[12.5px] text-egg-mute">DM-2026 · 55 students</div>
        <div className="mt-3 flex flex-wrap gap-1">
          {SOURCES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-egg-card px-2 py-0.5 text-[10.5px] text-egg-mute">
              <span className="h-1.5 w-1.5 rounded-full bg-egg-orange" />{s}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 px-1">
        <Avatar name={TEACHER} size={34} />
        <div>
          <div className="text-[13.5px] font-semibold">{TEACHER}</div>
          <div className="text-[12px] text-egg-mute">Lecturer</div>
        </div>
      </div>
    </nav>
  );
}

function EmptyState({ onPick, composer }: { onPick: (t: ContextId) => void; composer: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-[760px] flex-col px-8 pt-[9vh]">
        <Eyebrow>Saturday, 31 October</Eyebrow>
        <h2 className="mt-3 font-serif text-[84px] leading-[0.92] tracking-[-0.01em]">
          Good afternoon,<br /><span className="italic">Lam.</span>
        </h2>
        <div className="mt-8 border-t-2 border-egg-ink">
          <div className="flex items-baseline justify-between py-2">
            <span className="text-[13px] text-egg-mute">Needs your attention today</span>
            <span className="text-[13px] text-egg-mute">from 8 sources</span>
          </div>
          {TODAY.map((row) => (
            <button
              key={row.topic}
              type="button"
              onClick={() => onPick(row.topic)}
              className="group grid w-full grid-cols-[1fr_auto_auto] items-center gap-6 border-t border-egg-ink/70 py-3.5 text-left"
            >
              <span>
                <span className="block text-[13px] italic text-egg-mute">{row.who}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[17px] font-semibold uppercase tracking-[0.04em]">
                  <Asterisk size={13} className="text-egg-ink" />{row.what}
                </span>
              </span>
              <span className="font-serif text-[40px] leading-none text-egg-orange">{row.figure}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-egg-ink text-egg-card transition-transform group-hover:translate-x-1">
                <Arrow size={15} dir="right" />
              </span>
            </button>
          ))}
        </div>
        <div className="mt-10">{composer}</div>
        <div className="mt-2 text-center text-[11.5px] text-egg-faint">Illustrative demo data · fictional students</div>
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, big = false }: { value: string; onChange: (v: string) => void; onSend: () => void; big?: boolean }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSend(); }}
      className="rounded-[22px] border border-egg-line bg-egg-card p-3 shadow-[0_1px_0_#DCD3C5,0_12px_32px_-18px_rgba(26,23,20,0.25)] focus-within:border-egg-ink/40"
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
        rows={big ? 2 : 1}
        placeholder="Ask about a student, a gap, or your class…"
        className="block w-full resize-none bg-transparent px-2 py-1.5 text-[15.5px] text-egg-ink placeholder:text-egg-faint focus:outline-none"
      />
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="rounded-full border border-egg-line px-2.5 py-1 text-[12px] text-egg-mute">+ Attach</span>
        <span className="rounded-full border border-egg-line px-2.5 py-1 text-[12px] text-egg-mute">Class · DM-2026</span>
        <button type="submit" aria-label="Send" className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full ${value.trim() ? 'bg-egg-orange text-egg-ink' : 'bg-egg-ink text-egg-card'}`}>
          <Arrow size={16} />
        </button>
      </div>
    </form>
  );
}

function TeacherMsg({ text }: { text: string }) {
  return (
    <div className="chat-rise mb-8 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-egg-ink px-4 py-2.5 text-[15px] text-egg-card">{text}</div>
    </div>
  );
}

function AssistantMsg({ msg, isLast, panelShowing, onShowContext, onFollowUp }: {
  msg: Exclude<Msg, { role: 'teacher' }>;
  isLast: boolean;
  panelShowing: boolean;
  onShowContext: (t: ContextId) => void;
  onFollowUp: (text: string) => void;
}) {
  const topic = msg.kind === 'fallback' || msg.kind === 'brief' ? null : TOPICS[msg.topic];
  return (
    <div className="chat-rise mb-9 grid grid-cols-[28px_1fr] gap-3">
      <div className="pt-1"><Asterisk size={20} /></div>
      <div>
        <div className="chat-prose text-[15.5px] leading-[1.65] text-egg-ink/90">
          {msg.kind === 'fallback' ? FALLBACK : msg.kind === 'brief' ? studentBrief(STUDENTS[msg.index]) : msg.kind === 'answer' ? topic!.answer : topic!.approved}
        </div>
        {msg.kind === 'answer' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-egg-mute">
            <span className="rounded-full bg-egg-paper px-2.5 py-1">Student Analysis Agent ⇄ Teaching Assistance Agent</span>
            {!panelShowing && (
              <button type="button" onClick={() => onShowContext(msg.topic)} className="rounded-full border border-egg-ink/25 px-2.5 py-1 font-semibold text-egg-ink hover:border-egg-ink">
                Open context →
              </button>
            )}
          </div>
        )}
        {isLast && topic && (
          <div className="mt-5 flex flex-wrap gap-2">
            {topic.followUps.map((f) => (
              <button key={f} type="button" onClick={() => onFollowUp(f)} className="rounded-full border border-egg-line bg-egg-card px-3.5 py-1.5 text-[13px] text-egg-ink hover:border-egg-orange">
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thinking({ lines: all, step }: { lines: string[]; step: number }) {
  const lines = all.slice(0, step + 1);
  return (
    <div className="chat-rise mb-9 grid grid-cols-[28px_1fr] gap-3">
      <div className="pt-0.5"><Asterisk size={20} className="animate-spin text-egg-orange [animation-duration:2.4s]" /></div>
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <div key={l} className="chat-rise flex items-center gap-2 text-[13.5px] text-egg-mute">
            {l}
            {i === lines.length - 1 && (
              <span className="inline-flex gap-0.5">
                {[0, 1, 2].map((d) => <span key={d} className="chat-dot h-1 w-1 rounded-full bg-egg-mute" style={{ animationDelay: `${d * 150}ms` }} />)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
