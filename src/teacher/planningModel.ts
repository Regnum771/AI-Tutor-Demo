import { seededHistory } from '../live/history';
import type { DemoState, PlanKind, PlanStatus } from '../live/types';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { buildRoster } from '../scenario/roster';
import type { ChartMarker, ChartPoint } from './ForecastChart';

/** The Week 6 topic: the chart's concept when nothing is selected. */
export const DEFAULT_CONCEPT: ConceptId = 'equivalence';

/** Weeks 1–6 from the seed roster, so the past stays put whatever happens live. */
const SEEDED = seededHistory(buildRoster());

/** The seeded points, then one per closed live day. */
export const masterySeries = (state: DemoState, concept: ConceptId): ChartPoint[] => [...SEEDED[concept], ...state.masteryHistory[concept]];

/** Plans that went ahead, as on the calendar. */
const SHOWN: PlanStatus[] = ['sent', 'autoApproved', 'approved', 'done'];
const MARK: Record<PlanKind, string> = { pathway: 'Pathway', classActivity: 'Class activity', checkIns: 'Check-ins' };

/** Pathways sent, class activities approved and check-ins booked, on their plan dates; one marker per kind and day. */
export function planMarkers(state: DemoState): ChartMarker[] {
  const seen = new Set<string>();
  return state.plans.filter((p) => SHOWN.includes(p.status)).flatMap((p): ChartMarker[] => {
    const key = `${p.date}:${p.kind}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ day: p.date, label: MARK[p.kind], row: 'intervention' }];
  });
}
