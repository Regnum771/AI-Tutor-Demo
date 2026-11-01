import type { CloId } from '../../scenario/course';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { DemoState } from '../types';
import { capacityLeft, openPathways } from './capacity';
import { cardsToday } from './cards';
import { MINUTES, selfDone } from './record';

export type TodayRow =
  | { kind: 'plan'; index: number; title: string; minutes: number }
  | { kind: 'cards'; count: number; minutes: number }
  | { kind: 'practice'; clo: CloId; concepts: ConceptId[]; minutes: number };

/** The day's list: teacher sessions, then cards, then practice up to the budget. Missed minutes carry over within capacity. */
export function todayList(state: DemoState, studentId: string): { budget: number; done: number; concepts: ConceptId[]; rows: TodayRow[] } {
  const rec = state.study[studentId];
  const day = state.day;
  const planned = rec.plan?.days.find((d) => d.day === day);
  const concepts = planned?.concepts ?? [];
  const yesterday = rec.days[day - 1];
  const carry = yesterday ? Math.max(0, yesterday.planned - selfDone(yesterday)) : 0;
  const budget = Math.min(capacityLeft(state, studentId, day), (planned?.minutes ?? 0) + carry);
  const done = selfDone(rec.days[day]);
  const rows: TodayRow[] = [];

  const teacher = openPathways(state, studentId).find((p) => p.id === state.phone.planId && p.date === day);
  teacher?.sessions.forEach((s, index) => {
    if (!state.phone.done.includes(index)) rows.push({ kind: 'plan', index, title: s.title, minutes: s.minutes });
  });

  const { due, fresh } = cardsToday(rec, day, concepts);
  const count = due.length + fresh.length;
  const cardMinutes = Math.ceil(count * MINUTES.card);
  if (count > 0) rows.push({ kind: 'cards', count, minutes: cardMinutes });

  const left = Math.max(0, budget - done - cardMinutes);
  if (left > 0 && planned && concepts.length > 0) rows.push({ kind: 'practice', clo: planned.clo, concepts, minutes: Math.ceil(left) });
  return { budget, done, concepts, rows };
}
