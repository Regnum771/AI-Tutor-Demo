import { STUDENTS, type Status } from './classroom';
import { LECTURES, lectureBefore, START_DAY, type Bloom } from './course';
import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { MINH_ANH } from './minhAnh';

export type ResourceKind = 'slides' | 'recording' | 'worksheet' | 'reading' | 'video';
/** The Bloom levels a resource can carry: the course's levels without Create. */
export type ResourceBloom = Exclude<Bloom, 'Create'>;
export const RESOURCE_BLOOMS: ResourceBloom[] = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];

export interface Resource {
  /** "l5-slides", "l5-recording", …: what the agents cite. */
  id: string;
  /** LECTURES n */
  lecture: number;
  kind: ResourceKind;
  title: string;
  /** A subset of the lecture's concepts; the revision sheet covers the whole course. */
  concepts: ConceptId[];
  bloom: ResourceBloom;
  /** Length, or the expected time to work through it. */
  minutes: number;
  /** "Course slides", "Recording", "Worksheet", "Short video" or a textbook section. Never a link. */
  source: string;
}

export const KIND_LABEL: Record<ResourceKind, string> = { slides: 'Slides', recording: 'Recording', worksheet: 'Worksheet', reading: 'Reading', video: 'Video' };

/** One reading or short video for Lectures 3, 5, 6 and 7. Fictional; a reading names a textbook section, never a link. */
const EXTRA: Record<number, Omit<Resource, 'lecture'>> = {
  3: { id: 'l3-video', kind: 'video', title: 'Building a truth table, row by row', concepts: ['truthTables'], bloom: 'Understand', minutes: 8, source: 'Short video' },
  5: { id: 'l5-reading', kind: 'reading', title: 'Rosen §1.1 · Conditional statements', concepts: ['implication'], bloom: 'Analyze', minutes: 25, source: 'Rosen §1.1' },
  6: { id: 'l6-reading', kind: 'reading', title: 'Rosen §1.3 · Propositional equivalences', concepts: ['equivalence', 'deMorgan'], bloom: 'Understand', minutes: 30, source: 'Rosen §1.3' },
  7: { id: 'l7-video', kind: 'video', title: 'Equivalence laws in six minutes', concepts: ['equivLaws'], bloom: 'Understand', minutes: 6, source: 'Short video' },
};

/** The course library: slides, a recording and a worksheet for Lectures 1–8, the extras above, and a revision sheet for Lecture 9. */
export const RESOURCES: Resource[] = LECTURES.flatMap((l): Resource[] => {
  if (l.concepts.length === 0) {
    return [{ id: `l${l.n}-revision`, lecture: l.n, kind: 'worksheet', title: 'Revision sheet · The whole course', concepts: CONCEPTS.map((c) => c.id), bloom: 'Apply', minutes: 60, source: 'Worksheet' }];
  }
  const intro = l.n === 1 ? 'Remember' : 'Understand';
  const extra = EXTRA[l.n];
  return [
    { id: `l${l.n}-slides`, lecture: l.n, kind: 'slides', title: `Lecture ${l.n} · ${l.title}.pdf`, concepts: l.concepts, bloom: intro, minutes: 25, source: 'Course slides' },
    { id: `l${l.n}-recording`, lecture: l.n, kind: 'recording', title: `Lecture ${l.n} recording`, concepts: l.concepts, bloom: intro, minutes: 110, source: 'Recording' },
    { id: `l${l.n}-worksheet`, lecture: l.n, kind: 'worksheet', title: `Worksheet · ${l.title}`, concepts: l.concepts, bloom: 'Apply', minutes: 40, source: 'Worksheet' },
    ...(extra ? [{ ...extra, lecture: l.n }] : []),
  ];
});

export const resourcesFor = (lecture: number): Resource[] => RESOURCES.filter((r) => r.lecture === lecture);
export const resourceById = (id: string): Resource | undefined => RESOURCES.find((r) => r.id === id);

/** A resource is out once its lecture has started. */
export const isReleased = (r: Resource, day: number, time: string): boolean => (lectureBefore(day, time)?.n ?? 0) >= r.lecture;

/** "Slides · Lecture 7": a citation chip. */
export const resourceChip = (r: Resource): string => `${KIND_LABEL[r.kind]} · Lecture ${r.lecture}`;

const OPEN: Record<Status, number> = { onTrack: 0.9, support: 0.65, highRisk: 0.4 };
const KIND_OPEN: Record<ResourceKind, number> = { slides: 1, recording: 0.8, worksheet: 0.85, reading: 0.5, video: 0.7 };
const SHARE: Record<Status, [number, number]> = { onTrack: [0.55, 0.95], support: [0.35, 0.75], highRisk: [0.1, 0.45] };
/** A two-hour recording is rarely watched to the end. */
const KIND_SHARE: Record<ResourceKind, number> = { slides: 1, recording: 0.65, worksheet: 1, reading: 0.9, video: 1 };
/** The quiet disengager (s8): present every week, nothing opened after Week 4. */
const DISENGAGED = 7;
const END_OF_WEEK_4 = 27;

const round2 = (v: number) => Math.round(v * 100) / 100;
/** A fixed 0–1 value per pair, so engagement is the same on every run. */
function hash(a: number, b: number): number {
  let x = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** Whether a student has opened a resource by `today`, and how much of it they got through (0–1). Seeded from the index and status; fictional. */
export function engagement(resourceId: string, studentIndex: number, today = START_DAY): { opened: boolean; fraction: number } {
  const r = resourceById(resourceId);
  if (!r) throw new Error(`Unknown resource ${resourceId}.`);
  const student = STUDENTS[studentIndex];
  const k = RESOURCES.indexOf(r);
  const day = LECTURES[r.lecture - 1].day;
  // Opened from the day after the lecture, up to 4 days late.
  const openDay = day + 1 + Math.floor(hash(studentIndex, k + 100) * 4);
  const none = { opened: false, fraction: 0 };
  if (openDay > today) return none;
  if (studentIndex === MINH_ANH.index) {
    // The video's Learning Materials window, and the LMS log: last login before Lecture 6.
    if (r.id === 'l5-recording') return { opened: true, fraction: 0.22 };
    if (r.lecture === 6) return none;
  }
  if (studentIndex === DISENGAGED && openDay > END_OF_WEEK_4) return none;
  if (hash(studentIndex, k) >= OPEN[student.status] * KIND_OPEN[r.kind]) return none;
  const [lo, hi] = SHARE[student.status];
  return { opened: true, fraction: round2((lo + (hi - lo) * hash(k, studentIndex + 500)) * KIND_SHARE[r.kind]) };
}

/** The class figure: how many of the 55 opened it, and the mean share of it among those who did. */
export function classEngagement(resourceId: string, today = START_DAY): { opened: number; of: number; meanFraction: number } {
  const rows = STUDENTS.map((s) => engagement(resourceId, s.index, today)).filter((e) => e.opened);
  return { opened: rows.length, of: STUDENTS.length, meanFraction: rows.length ? round2(rows.reduce((a, e) => a + e.fraction, 0) / rows.length) : 0 };
}

/** Student indexes that have not opened the resource by `today`, in roster order. */
export const notOpened = (resourceId: string, today = START_DAY): number[] =>
  STUDENTS.filter((s) => !engagement(resourceId, s.index, today).opened).map((s) => s.index);
