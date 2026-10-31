import { useState } from 'react';
import { useNow } from '../engine/useNow';
import type { Student } from '../scenario/classroom';
import { MINH_ANH } from '../scenario/minhAnh';
import { routePrompt, TOPICS, type ContextId } from './conversations';
import { PAST, teacherFrame, type TeacherEvent, type View } from './frame';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

const STEP_MS = 900;
const BLOCK_MS = 250;
const FALLBACK_LINES = ['Reading your class context'];

/** Live draft: clicks append time-stamped events; the same frame model renders them. */
export function LiveTeacher() {
  const [t0] = useState(() => Date.now());
  const now = useNow();
  const t = now - t0;
  const [events, setEvents] = useState<TeacherEvent[]>([
    { at: PAST, type: 'greeting' },
    { at: PAST, type: 'classroomReveal' },
  ]);
  const [draft, setDraft] = useState('');
  const frame = teacherFrame(events, t);
  const busy = frame.thinking !== null || events.some((e) => e.at > t);
  const push = (...e: TeacherEvent[]) => setEvents((list) => [...list, ...e]);

  const askEvents = (text: string, start: number): TeacherEvent[] => {
    const topic = routePrompt(text);
    const lines = topic ? TOPICS[topic].thinking : FALLBACK_LINES;
    const answerAt = start + lines.length * STEP_MS + 300;
    const out: TeacherEvent[] = [
      { at: start, type: 'send', text },
      { at: start, type: 'think', lines, stepMs: STEP_MS, title: topic ? TOPICS[topic].title : frame.title ?? 'New conversation' },
      { at: answerAt, type: 'assistant', kind: topic ? 'answer' : 'fallback', topic: topic ?? undefined, blockMs: BLOCK_MS },
    ];
    if (topic) out.push({ at: answerAt, type: 'panel', id: topic });
    return out;
  };

  const actions: TeacherActions = {
    send: (text) => {
      if (!text.trim() || busy) return;
      setDraft('');
      push(...askEvents(text.trim(), t));
    },
    open: (topic) => push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'load', topic }),
    reset: () => push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }),
    setView: (v: View) => push({ at: t, type: 'view', view: v }),
    approve: (id: ContextId) => push({ at: t, type: 'approve', id }, { at: t + 500, type: 'assistant', kind: 'approved', topic: id, blockMs: BLOCK_MS }),
    edit: () => push({ at: t, type: 'edit' }),
    showPanel: (id) => push({ at: t, type: 'panel', id }),
    select: (index) => push({ at: t, type: 'select', index }),
    askStudent: (s: Student) => {
      if (busy) return;
      const base: TeacherEvent[] = [{ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }];
      if (s.index === MINH_ANH.index) return push(...base, ...askEvents(TOPICS.student.prompt, t));
      push(
        ...base,
        { at: t, type: 'send', text: `How is ${s.name} doing?` },
        { at: t, type: 'think', lines: [`Student Analysis Agent · reading ${s.name}’s learning twin`], stepMs: STEP_MS, title: s.name, sansTitle: true },
        { at: t + STEP_MS + 300, type: 'assistant', kind: 'brief', index: s.index, blockMs: BLOCK_MS },
      );
    },
    askClass: () => {
      if (busy) return;
      push({ at: t, type: 'view', view: 'chat' }, { at: t, type: 'reset' }, ...askEvents(TOPICS.class.prompt, t));
    },
  };

  return <TeacherScreen frame={frame} actions={actions} composer={{ value: draft, onChange: setDraft }} />;
}
