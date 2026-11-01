import type { Status } from '../scenario/classroom';
import type { CloId } from '../scenario/course';
import type { ConceptId } from '../scenario/knowledgeGraph';

export type Mastery = Record<ConceptId, number>;

export type EvidenceKind = 'quiz' | 'activity' | 'attendance' | 'message' | 'taNote' | 'record' | 'practice';

export interface Evidence {
  /** Stable id the agents cite: `<studentId>-<slug>` for a student, `class-<slug>` for the class. */
  id: string;
  kind: EvidenceKind;
  source: string;
  text: string;
  /** Story-time label, e.g. "Week 6" or "17:04". */
  when: string;
  concept?: ConceptId;
}

export interface StudentProfile {
  index: number;
  id: string;
  name: string;
  /** Name for copy: the given name, or "Minh Anh". */
  short: string;
  group: string;
  status: Status;
  /** On the teacher's escalation list (the "Needs you" band). */
  escalated: boolean;
  mastery: Mastery;
  quiz: { q1: number; q2: number };
  practicePerWeek: number;
  evidence: Evidence[];
}

export type PlanKind = 'pathway' | 'classActivity' | 'checkIns';
export type PlanStatus = 'proposed' | 'approved' | 'sent' | 'done' | 'autoApproved' | 'dismissed';

export interface PlanSession {
  /** HH:MM, 24-hour. */
  time: string;
  title: string;
  minutes: number;
  concept: ConceptId | null;
  isMasteryCheck: boolean;
  /** checkIns: who the slot is with. */
  studentId: string | null;
}

export interface Plan {
  id: string;
  kind: PlanKind;
  title: string;
  /** pathway: one id; classActivity: the affected students; checkIns: one per session. */
  studentIds: string[];
  /** "Today", "Tomorrow" or a weekday. Only "Today" sessions must fall after the story clock. */
  day: string;
  /** The day number `day` resolved to when the plan was drafted. */
  date: number;
  /** Mastery when the plan reached the phone; adapt reports the change against this. */
  baseline: Mastery | null;
  sessions: PlanSession[];
  rationale: string;
  outcome: string;
  status: PlanStatus;
  conversationId: string;
}

export interface LiveBlock {
  kind: 'p' | 'li';
  /** Plain text; `**bold**` spans allowed. */
  text: string;
  /** Evidence ids behind the block. */
  cites: string[];
}

export type LivePanel =
  | { kind: 'student'; studentId: string; planId: string | null; highlight: string | null }
  | { kind: 'class'; planId: string | null; highlight?: string | null }
  | { kind: 'checkIns'; planId: string };

export interface AssistantMsg {
  role: 'assistant';
  /** agents: written by SAS/TAS; offline: canned fallback; system: fixed confirmation copy. */
  source: 'agents' | 'offline' | 'system';
  blocks: LiveBlock[];
  /** Offline answers reuse the draft's canned topic copy. */
  canned: 'student' | 'class' | 'attention' | 'fallback' | null;
  followUps: string[];
  panel: LivePanel | null;
  stamp: string | null;
}

export type ChatMsg = { role: 'teacher'; text: string } | AssistantMsg;

export interface Conversation {
  id: string;
  title: string;
  /** Titles with Vietnamese names use the sans face. */
  sansTitle: boolean;
  msgs: ChatMsg[];
  /** Agent steps while a run is in flight. */
  pending: { steps: string[] } | null;
}

export type CardRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardState {
  /** Days until the next review. */
  interval: number;
  ease: number;
  due: number;
  reps: number;
  /** The day this card was first seen. */
  introduced: number;
}

export interface StudyDay {
  planned: number;
  done: number;
  /** Minutes of `done` spent in teacher sessions. Self-study is `done` minus this. */
  teacher?: number;
  check: 'tooMuch' | 'right' | 'tooLittle' | null;
}

export interface Attempt { itemId: string; day: number; correct: boolean; firstTry: boolean }

export interface StudyPlanDay { day: number; minutes: number; clo: CloId; concepts: ConceptId[] }

export interface StudyPlan {
  createdDay: number;
  /** One sentence for the student. */
  reason: string;
  /** What is deliberately dropped because time cannot cover everything. */
  leftOut: string[];
  source: 'agents' | 'offline';
  days: StudyPlanDay[];
}

export type ReplanSignal = 'setup' | 'markSwing' | 'disengaged' | 'bandChange' | 'teacherPlan';
export type PassBand = 'Likely' | 'At risk' | 'Unlikely';

export interface StudyRecord {
  /** Minutes per day the student said they have. */
  reported: { weekday: number; weekend: number } | null;
  /** End-of-day factor, starts at 1, clamped 0.6–1.3. */
  feel: number;
  days: Record<number, StudyDay>;
  attempts: Attempt[];
  cards: Record<string, CardState>;
  /** Index 0–2 into each CLO's Bloom levels. */
  bloom: Record<CloId, number>;
  /** First-try correct answers at the current level since the last wrong answer or level change. A correct answer after a hint leaves it alone. */
  streak: Record<CloId, number>;
  marks: { assessment: string; mark: number; day: number }[];
  plan: StudyPlan | null;
  /** The band when the plan was last made. */
  band: PassBand | null;
  pendingSignal: ReplanSignal | null;
  lastReplanDay: number | null;
  replans: { day: number; signal: ReplanSignal; reason: string }[];
  /** Agent steps while a plan is being written. */
  planning: { steps: string[] } | null;
}

/** A self-started practice session. */
export interface SelfSession { clo: CloId | null; concepts: ConceptId[]; served: string[] }

export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'progress' | 'pick' | 'setup' | 'today' | 'choosePractice' | 'cards' | 'semester' | 'checkIn';

export interface PhoneState {
  planId: string | null;
  screen: PhoneScreen;
  session: number | null;
  item: number;
  hinted: boolean;
  result: 'right' | 'wrong' | null;
  lastOption: number | null;
  done: number[];
  /** The plan whose mastery check finished last (the progress screen's subject). */
  lastDone: string | null;
  /** The plan was replaced by an auto-approved follow-up. */
  updated: boolean;
  /** The student on this phone. A teacher plan switches it to that student. */
  studentId: string | null;
  /** The lock screen shows the morning "Today's calendar". */
  morning: boolean;
  self: SelfSession | null;
}

export interface DemoState {
  /** Bumped on reset so clients drop what they remember. */
  epoch: number;
  /** Story clock, minutes after midnight. */
  clock: number;
  /** Story date: day 0 is Monday 21 September. */
  day: number;
  students: StudentProfile[];
  classEvidence: Evidence[];
  plans: Plan[];
  conversations: Conversation[];
  phone: PhoneState;
  study: Record<string, StudyRecord>;
  busy: boolean;
}
