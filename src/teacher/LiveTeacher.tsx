import { useRef, useState } from 'react';
import { useNow } from '../engine/useNow';
import { keysOf, liveEvents, panelId, SeenClock } from '../live/events';
import { LiveProvider, type LiveCtx } from '../live/LiveContext';
import { useServerSource, type DemoSource } from '../live/source';
import type { LivePanel } from '../live/types';
import type { Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { PAST, teacherFrame, type TeacherEvent, type View } from './frame';
import { CANNED_TOPICS } from './route';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const TOAST_MS = 2000;
const BASE: TeacherEvent[] = [{ at: PAST, type: 'greeting' }, { at: PAST, type: 'classroomReveal' }];
/** Local UI events that survive switching conversations. */
const keepUi = (e: TeacherEvent) => e.type === 'view' || e.type === 'select';

/** The live booth teacher window: server state over SSE, rendered through the same frame model as the video. */
export function LiveTeacher() {
  return <LiveTeacherView source={useServerSource()} />;
}

export function LiveTeacherView({ source }: { source: DemoSource }) {
  const [t0] = useState(() => Date.now());
  const t = useNow() - t0;
  const { state, post } = source;
  const seen = useRef(new SeenClock()).current;
  const [epoch, setEpoch] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [local, setLocal] = useState<TeacherEvent[]>([]);
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);

  if (state && state.epoch !== epoch) {
    // First snapshot (a refresh reopens the latest conversation) or a reset on the server (a fresh chat).
    if (epoch !== null) seen.clear();
    setEpoch(state.epoch);
    setActiveId(epoch === null ? state.conversations.at(-1)?.id ?? null : null);
    setLocal([]);
  }
  if (!state) {
    return <div className="flex h-full items-center justify-center bg-egg-bg font-sans text-[15px] text-egg-mute">Connecting to the booth server… (start it with npm run booth)</div>;
  }
  seen.stamp(keysOf(state), t);

  const showToast = (text: string) => setToast({ text, at: Date.now() - t0 });
  const pushLocal = (...e: TeacherEvent[]) => setLocal((l) => [...l, ...e]);
  const frame = teacherFrame([...BASE, ...liveEvents(state, activeId, seen), ...local].sort((a, b) => a.at - b.at), t);

  const ask = async (text: string, conversationId: string | null) => {
    const question = text.trim();
    if (!question) return;
    if (state.busy) {
      showToast('The agents are still working');
      return;
    }
    pushLocal({ at: t, type: 'view', view: 'chat' });
    const r = await post('ask', { text: question, conversationId });
    if (r.ok && typeof r.conversationId === 'string') {
      setDraft('');
      if (r.conversationId !== activeId) setLocal((l) => l.filter(keepUi));
      setActiveId(r.conversationId);
    } else {
      showToast(typeof r.error === 'string' ? r.error : 'The booth server is not responding');
    }
  };
  const showPanel = (p: LivePanel | null) => {
    // An evidence chip for the student or class already open keeps that panel's plan.
    const cur = frame.panel?.live;
    const sameStudent = p?.kind === 'student' && cur?.kind === 'student' && cur.studentId === p.studentId;
    const sameClass = p?.kind === 'class' && cur?.kind === 'class';
    const merged = p && 'planId' in p && !p.planId && cur && (sameStudent || sameClass) ? { ...p, planId: cur.planId } : p;
    pushLocal({ at: t, type: 'panel', id: merged ? panelId(merged) : null, live: merged ?? undefined });
  };
  const switchTo = (id: string | null) => {
    setActiveId(id);
    setLocal((l) => [...l.filter(keepUi), { at: t, type: 'view', view: 'chat' }]);
  };

  const actions: TeacherActions = {
    send: (text) => void ask(text, activeId),
    open: () => undefined, // canned topics are not listed in live mode
    reset: () => {
      // "New conversation": already on a fresh chat, so say so instead of silently doing nothing.
      if (activeId === null && frame.view === 'chat') showToast('Already a new conversation');
      else switchTo(null);
    },
    setView: (v: View) => pushLocal({ at: t, type: 'view', view: v }),
    approve: () => undefined, // the live plan card posts directly
    edit: () => undefined,
    showPanel: (id) => { if (id === null) showPanel(null); },
    select: (index) => pushLocal({ at: t, type: 'select', index }),
    askStudent: (s: Student) => void ask(s.index === MINH_ANH.index ? CANNED_TOPICS.student.prompt : `How is ${s.name} doing?`, null),
    askClass: () => void ask(CANNED_TOPICS.class.prompt, null),
  };
  const ctx: LiveCtx = { state, activeId, post, openConversation: switchTo, showPanel, toast: showToast };

  return (
    <LiveProvider value={ctx}>
      <TeacherScreen frame={frame} actions={actions} composer={{ value: draft, onChange: setDraft, disabled: state.busy }} />
      {toast && t - toast.at < TOAST_MS && (
        <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-egg-ink px-4 py-2 font-sans text-[13.5px] font-semibold text-egg-card">
          {toast.text}
        </div>
      )}
    </LiveProvider>
  );
}
