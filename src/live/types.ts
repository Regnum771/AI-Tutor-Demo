import type { Status } from '../scenario/classroom';
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
  | { kind: 'class'; planId: string | null }
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

export type PhoneScreen = 'lock' | 'plan' | 'practice' | 'progress';

export interface PhoneState {
  planId: string | null;
  screen: PhoneScreen;
  session: number | null;
  item: number;
  hinted: boolean;
  result: 'right' | 'wrong' | null;
  lastOption: number | null;
  done: number[];
  /** Mastery when the current plan arrived, for the progress screen. */
  before: Mastery | null;
  /** The plan whose mastery check finished last (the progress screen's subject). */
  lastDone: string | null;
  /** The plan was replaced by an auto-approved follow-up. */
  updated: boolean;
}

export interface DemoState {
  /** Bumped on reset so clients drop what they remember. */
  epoch: number;
  /** Story clock, minutes after midnight. */
  clock: number;
  students: StudentProfile[];
  classEvidence: Evidence[];
  plans: Plan[];
  conversations: Conversation[];
  phone: PhoneState;
  busy: boolean;
}
