import { stepIndex } from '../../engine/anim';
import { refTarget, type AgentCard, type AgentId } from '../../scenario/agents';
import type { ConceptId } from '../../scenario/knowledgeGraph';
import type { Mastery } from '../../scenario/minhAnh';
import type { TwinKey } from '../../ui/TwinPanel';

/** Travel time of a card token between agents. */
export const TOKEN_MS = 1200;
/** Refs light up this long after a card is sent. */
const REF_DELAY = 600;

/** Concept id referenced by a kg / twin ref, if any. */
function conceptOf(ref: string): ConceptId | null {
  const target = refTarget(ref);
  if (!target) return null;
  if (target.kind === 'kg') return target.id as ConceptId;
  if (target.kind === 'twin') return target.id.split('.')[1] as ConceptId;
  return null;
}

/** Hub highlights for the card in play: from send + REF_DELAY until the next card is sent. */
export function activeHighlights(cards: AgentCard[], times: number[], t: number): { kg: ConceptId[]; twin: TwinKey[] } {
  const i = stepIndex(t, times.map((x) => x + REF_DELAY));
  if (i < 0) return { kg: [], twin: [] };
  const kg: ConceptId[] = [];
  const twin: TwinKey[] = [];
  for (const r of cards[i].refs) {
    const target = refTarget(r);
    const c = conceptOf(r);
    if (!target || !c) continue;
    if (target.kind === 'kg') kg.push(c);
    else twin.push(`mastery.${c}`);
  }
  return { kg, twin };
}

/** Mastery of every concept referenced (kg or twin) by cards whose refs have lit up by t. */
export function revealedMastery(cards: AgentCard[], times: number[], t: number, source: Mastery): Partial<Record<ConceptId, number>> {
  const out: Partial<Record<ConceptId, number>> = {};
  cards.forEach((card, i) => {
    if (t < times[i] + REF_DELAY) return;
    for (const r of card.refs) {
      const c = conceptOf(r);
      if (c) out[c] = source[c];
    }
  });
  return out;
}

/** The most recent card addressed to `to` whose token has arrived by t. */
export function latestReceived(cards: AgentCard[], times: number[], to: AgentId, t: number): { card: AgentCard; arrived: number } | null {
  let found: { card: AgentCard; arrived: number } | null = null;
  cards.forEach((card, i) => {
    const arrived = times[i] + TOKEN_MS;
    if (card.to === to && t >= arrived) found = { card, arrived };
  });
  return found;
}
