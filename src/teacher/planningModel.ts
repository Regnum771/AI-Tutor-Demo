import { seededHistory } from '../live/history';
import type { DemoState, PlanKind, PlanStatus } from '../live/types';
import { LECTURES, lectureOf, nextLecture, type Lecture } from '../scenario/course';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { resourcesFor } from '../scenario/materials';
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

const covers = (l: Lecture, concept: ConceptId) => resourcesFor(l.n).some((r) => r.concepts.includes(concept));

/** The next lecture and the two after it. With a concept, those of them whose materials cover it, plus the lecture that taught it; in lecture order. */
export function upcomingLectures(day: number, time: string, concept: ConceptId | null): Lecture[] {
  const next = nextLecture(day, time);
  const three = next ? LECTURES.slice(next.n - 1, next.n + 2) : [];
  if (!concept) return three;
  const taught = lectureOf(concept);
  return LECTURES.filter((l) => l === taught || (three.includes(l) && covers(l, concept)));
}

/** The lectures already held, newest first, without any listed by `upcomingLectures`; with a concept, only those whose materials cover it. */
export function pastLectures(day: number, time: string, concept: ConceptId | null): Lecture[] {
  const next = nextLecture(day, time);
  const shown = upcomingLectures(day, time, concept);
  return LECTURES.filter((l) => (!next || l.n < next.n) && !shown.includes(l) && (!concept || covers(l, concept))).reverse();
}
