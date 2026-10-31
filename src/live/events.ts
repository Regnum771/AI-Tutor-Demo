import { PAST, type TeacherEvent } from '../teacher/frame';
import type { ContextId } from '../teacher/route';
import type { DemoState, LivePanel } from './types';

const BLOCK_MS = 250;

/** Remembers when each item was first seen, in the live view's clock. The first snapshot counts as long past. */
export class SeenClock {
  private at = new Map<string, number>();
  private primed = false;

  stamp(keys: string[], now: number): void {
    for (const k of keys) if (!this.at.has(k)) this.at.set(k, this.primed ? now : PAST);
    this.primed = true;
  }

  get(key: string): number {
    return this.at.get(key) ?? PAST;
  }

  /** After a reset: forget everything; new items animate in from when they arrive. */
  clear(): void {
    this.at.clear();
  }
}

/** One key per message and per pending run, in every conversation. */
export const keysOf = (state: DemoState): string[] =>
  state.conversations.flatMap((c) => [...c.msgs.map((_, i) => `${c.id}:m${i}`), ...(c.pending ? [`${c.id}:pending:${c.msgs.length}`] : [])]);

export const panelId = (p: LivePanel): ContextId => (p.kind === 'class' ? 'class' : p.kind === 'checkIns' ? 'attention' : 'student');

/** The open conversation as a teacher timeline, each item stamped with when it was first seen. */
export function liveEvents(state: DemoState, activeId: string | null, seen: SeenClock): TeacherEvent[] {
  const conv = state.conversations.find((c) => c.id === activeId);
  if (!conv) return [];
  const out: TeacherEvent[] = [{ at: PAST, type: 'title', title: conv.title, sansTitle: conv.sansTitle }];
  let panel: { at: number; live: LivePanel } | null = null;
  for (let i = 0; i < conv.msgs.length; i++) {
    const m = conv.msgs[i];
    const at = seen.get(`${conv.id}:m${i}`);
    if (m.role === 'teacher') {
      out.push({ at, type: 'send', text: m.text });
    } else {
      out.push({ at, type: 'assistant', kind: 'live', live: m, blockMs: BLOCK_MS, stamp: m.stamp ?? undefined });
      if (m.panel) panel = { at, live: m.panel };
    }
  }
  if (panel) out.push({ at: panel.at, type: 'panel', id: panelId(panel.live), live: panel.live });
  if (conv.pending) {
    out.push({
      at: seen.get(`${conv.id}:pending:${conv.msgs.length}`), type: 'think',
      lines: conv.pending.steps.length ? conv.pending.steps : ['Reading your class context'], stepMs: 1, title: conv.title, sansTitle: conv.sansTitle,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}
