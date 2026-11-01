import { parseTime } from '../live/clock';
import type { DemoState, Evidence, Plan, PlanStatus, StudentProfile } from '../live/types';
import { shortDate } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';

export type ProfileTab = 'messages' | 'chats' | 'practice' | 'interventions' | 'record' | 'evidence';

export const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: 'messages', label: 'Messages' },
  { id: 'chats', label: 'AI chats' },
  { id: 'practice', label: 'Practice' },
  { id: 'interventions', label: 'Interventions' },
  { id: 'record', label: 'Record' },
  { id: 'evidence', label: 'All evidence' },
];

/** The tab that shows an evidence entry; Messages when there is none. */
export function tabFor(s: StudentProfile, entryId: string | null): ProfileTab {
  const e = entryId ? s.evidence.find((x) => x.id === entryId) : undefined;
  if (!e) return 'messages';
  return e.kind === 'message' ? 'messages' : e.kind === 'practice' ? 'practice' : e.kind === 'record' ? 'record' : 'evidence';
}

const stamp = (e: Evidence) => (e.day ?? -1) * 1440 + (e.time ? parseTime(e.time) ?? 0 : 0);

/** Message evidence, newest first. */
export const messagesOf = (s: StudentProfile): Evidence[] =>
  s.evidence.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'message').sort((a, b) => stamp(b.e) - stamp(a.e) || b.i - a.i).map(({ e }) => e);

export interface ChatLink { id: string; title: string; first: string }

/** The teacher's conversations whose panel or plans name this student, newest first. */
export function chatsAbout(state: DemoState, studentId: string): ChatLink[] {
  return state.conversations
    .filter((c) =>
      c.msgs.some((m) => m.role === 'assistant' && m.panel?.kind === 'student' && m.panel.studentId === studentId)
      || state.plans.some((p) => p.conversationId === c.id && p.studentIds.includes(studentId)))
    .map((c) => {
      const first = c.msgs.find((m) => m.role === 'teacher');
      return { id: c.id, title: c.title, first: first?.role === 'teacher' ? first.text : '' };
    })
    .reverse();
}

export interface PracticeSession { key: string; day: number; title: string; concepts: string[]; right: number; wrong: number; skipped: number; entryIds: string[] }

/** Phone practice grouped by day and plan (or self practice), newest first. */
export function practiceSessions(state: DemoState, s: StudentProfile): PracticeSession[] {
  const out: PracticeSession[] = [];
  for (const e of s.evidence) {
    if (e.kind !== 'practice') continue;
    const day = e.day ?? state.day;
    const key = `${day}|${e.planId ?? 'self'}`;
    let row = out.find((r) => r.key === key);
    if (!row) {
      const plan = e.planId ? state.plans.find((p) => p.id === e.planId) : undefined;
      row = { key, day, title: plan?.title ?? 'Self practice', concepts: [], right: 0, wrong: 0, skipped: 0, entryIds: [] };
      out.push(row);
    }
    const label = e.concept ? conceptById(e.concept).label : null;
    if (label && !row.concepts.includes(label)) row.concepts.push(label);
    if (e.result === 'correct') row.right++;
    else if (e.result === 'wrong') row.wrong++;
    else if (e.result === 'skipped') row.skipped++;
    row.entryIds.push(e.id);
  }
  return out.reverse();
}

const KIND: Record<Plan['kind'], string> = { pathway: 'Pathway', classActivity: 'Class activity', checkIns: 'Check-in' };
const STATUS: Record<PlanStatus, string> = {
  proposed: 'Waiting for you', approved: 'Approved', sent: 'Sent to the phone', done: 'Done', autoApproved: 'Auto-approved', dismissed: 'Set aside',
};

export interface InterventionRow { id: string; kind: string; title: string; status: string; date: string; change: string | null }

/** Plans naming this student, newest first; set-aside plans are left out. */
export function interventionsOf(state: DemoState, s: StudentProfile): InterventionRow[] {
  return state.plans
    .filter((p) => p.studentIds.includes(s.id) && p.status !== 'dismissed')
    .map((p) => {
      const target = p.sessions.at(-1)?.concept ?? null;
      const change = p.kind === 'pathway' && p.baseline && target
        ? `${conceptById(target).label} ${p.baseline[target].toFixed(2)} → ${s.mastery[target].toFixed(2)}`
        : null;
      return { id: p.id, kind: KIND[p.kind], title: p.title, status: STATUS[p.status], date: shortDate(p.date), change };
    })
    .reverse();
}
