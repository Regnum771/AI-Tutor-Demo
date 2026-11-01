import { CARDS, type Card } from '../../scenario/cards';
import { EXAM_DAY } from '../../scenario/course';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { CardRating, CardState, StudyRecord } from '../types';

export const NEW_PER_DAY = 5;
const FIRST_INTERVAL: Record<CardRating, number> = { again: 1, hard: 1, good: 2, easy: 4 };

/** A simplified SM-2. Intervals round up and never run past the day before the exam. */
export function reviewCard(card: CardState | undefined, rating: CardRating, today: number): CardState {
  const ease = card?.ease ?? 2.5;
  const nextEase = Math.max(1.3, Math.round((ease + { again: -0.2, hard: -0.15, good: 0, easy: 0.15 }[rating]) * 100) / 100);
  let interval = FIRST_INTERVAL[rating];
  if (card) {
    if (rating === 'hard') interval = Math.max(1, Math.ceil(card.interval * 1.2));
    if (rating === 'good') interval = Math.ceil(card.interval * ease);
    if (rating === 'easy') interval = Math.ceil(card.interval * ease * 1.3);
  }
  const due = Math.min(today + interval, Math.max(today + 1, EXAM_DAY - 1));
  return { interval, ease: nextEase, due, reps: (card?.reps ?? 0) + 1, introduced: card?.introduced ?? today };
}

/** Cards due today, plus new cards from the day's focus up to the daily limit. */
export function cardsToday(rec: StudyRecord, today: number, focus: ConceptId[]): { due: Card[]; fresh: Card[] } {
  const due = CARDS.filter((c) => rec.cards[c.id] && rec.cards[c.id].due <= today);
  const introducedToday = Object.values(rec.cards).filter((c) => c.introduced === today).length;
  const fresh = CARDS.filter((c) => !rec.cards[c.id] && focus.includes(c.concept)).slice(0, Math.max(0, NEW_PER_DAY - introducedToday));
  return { due, fresh };
}
