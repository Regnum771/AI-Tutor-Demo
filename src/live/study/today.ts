import { cloOf, type CloId } from '../../scenario/course';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { DemoState } from '../types';
import { capacityFor } from './capacity';
import { cardsToday } from './cards';
import { MINUTES } from './record';

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
  const carry = yesterday ? Math.max(0, yesterday.planned - yesterday.done) : 0;
  const budget = Math.min(capacityFor(rec, day), (planned?.minutes ?? 0) + carry);
  const done = rec.days[day]?.done ?? 0;
  const rows: TodayRow[] = [];

  const teacher = state.plans.find((p) => p.id === state.phone.planId && p.kind === 'pathway' && p.studentIds[0] === studentId && p.date === day && p.status !== 'done');
  teacher?.sessions.forEach((s, index) => {
    if (!state.phone.done.includes(index)) rows.push({ kind: 'plan', index, title: s.title, minutes: s.minutes });
  });

  const { due, fresh } = cardsToday(rec, day, concepts);
  const count = due.length + fresh.length;
  const cardMinutes = Math.ceil(count * MINUTES.card);
  if (count > 0) rows.push({ kind: 'cards', count, minutes: cardMinutes });

  const left = Math.max(0, budget - done - cardMinutes);
  if (left > 0 && concepts.length > 0) rows.push({ kind: 'practice', clo: cloOf(concepts[0]).id, concepts, minutes: left });
  return { budget, done, concepts, rows };
}
