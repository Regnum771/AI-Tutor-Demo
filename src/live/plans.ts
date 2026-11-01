import { BANK_CONCEPTS } from '../scenario/practiceBank';
import { fmt, parseTime } from './clock';
import type { DemoState, Plan } from './types';

export const POLICY = { maxSessions: 4, maxMinutes: 45, followUpMaxSessions: 3, maxCheckIns: 5 } as const;

type PlanContext = Pick<DemoState, 'clock' | 'day' | 'students'>;

/** Problems with a draft plan, as sentences an agent can act on. Empty when the plan is valid. */
export function planProblems(plan: Plan, state: PlanContext): string[] {
  const out: string[] = [];
  const ids = new Set(state.students.map((s) => s.id));
  if (plan.sessions.length === 0) out.push('A plan needs at least one session.');
  for (const id of plan.studentIds) if (!ids.has(id)) out.push(`Unknown student id ${id}.`);
  plan.sessions.forEach((s, i) => {
    const t = parseTime(s.time);
    if (t === null) out.push(`Session ${i + 1}: time "${s.time}" is not HH:MM.`);
    else if (plan.date === state.day && t <= state.clock) out.push(`Session ${i + 1} at ${s.time} is not after now (${fmt(state.clock)}).`);
  });
  if (plan.kind === 'pathway') {
    if (plan.studentIds.length !== 1) out.push('A pathway is for exactly one student.');
    if (plan.sessions.length > POLICY.maxSessions) out.push(`At most ${POLICY.maxSessions} sessions.`);
    const minutes = plan.sessions.reduce((a, s) => a + s.minutes, 0);
    if (minutes > POLICY.maxMinutes) out.push(`Total ${minutes} minutes is over the ${POLICY.maxMinutes}-minute limit.`);
    plan.sessions.forEach((s, i) => {
      if (!s.concept || !BANK_CONCEPTS.includes(s.concept)) out.push(`Session ${i + 1}: concept ${s.concept ?? 'none'} has no practice items.`);
    });
    if (plan.sessions.length > 0 && !plan.sessions[plan.sessions.length - 1].isMasteryCheck) out.push('The last session must be the mastery check.');
  }
  if (plan.kind === 'checkIns') {
    if (plan.sessions.length > POLICY.maxCheckIns) out.push(`At most ${POLICY.maxCheckIns} check-ins.`);
    plan.sessions.forEach((s, i) => {
      if (!s.studentId || !ids.has(s.studentId)) out.push(`Check-in ${i + 1} needs a valid student id.`);
    });
  }
  return out;
}

/** A follow-up the agents may send without asking: a valid pathway of at most 3 sessions. */
export const withinFollowUpPolicy = (plan: Plan, state: PlanContext): boolean =>
  plan.kind === 'pathway' && plan.sessions.length <= POLICY.followUpMaxSessions && planProblems(plan, state).length === 0;
