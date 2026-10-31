import type { ReactNode } from 'react';
import { COMPLEX, type Student } from '../scenario/classroom';
import { MESSAGES } from '../scenario/sources';
import { Src } from './parts';

/** One revealable unit of an assistant message. Consecutive `li` blocks render as one list. */
export type Block = { kind: 'p' | 'li'; body: ReactNode };

/** Short labels for the five teacher questions (tracker strip). Order matches TEACHER_QUESTIONS. */
export const QUESTION_SHORT = ['Who is falling behind?', 'What are the gaps?', 'Topic or prerequisite?', 'Group or individual?', 'What happens next?'];

import type { ContextId } from './route';
export type { ContextId } from './route';
export { routePrompt } from './route';

export interface Topic {
  id: ContextId;
  /** Sidebar + header title. */
  title: string;
  prompt: string;
  /** What the agents are doing while the answer forms. */
  thinking: string[];
  answer: Block[];
  /** Follow-up line once the teacher approves the proposal in the panel. */
  approved: Block[];
  followUps: string[];
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-egg-ink">{children}</strong>;
const Vi = ({ children }: { children: ReactNode }) => <span className="italic text-egg-mute">“{children}”</span>;

export const TOPICS: Record<ContextId, Topic> = {
  student: {
    id: 'student',
    title: 'Minh Anh’s Quiz 2 drop',
    prompt: 'Why did Minh Anh’s quiz score drop?',
    thinking: ['Student Analysis Agent · reading Quiz 2, Zalo, LMS and records', 'Teaching Assistance Agent · matching strategies to the gap'],
    answer: [
        { kind: 'p', body: <>
          Minh Anh’s Quiz 2 score fell from <B>75% to 42%</B>. It isn’t a general slump — almost every lost mark traces back to one
          concept: <B>implication</B>, which logical equivalence is built on.
        </> },
          { kind: 'li', body: <>She picked the converse (q → p) on <B>6 implication items</B> across two quizzes. <Src k="quiz" /></> },
          { kind: 'li', body: <>She told you as much on Zalo: <Vi>{MESSAGES[0].vi}</Vi> <Src k="zalo" /></> },
          { kind: 'li', body: <>The truth-table lab and the implication worksheet are both still open. <Src k="lms" /></> },
          { kind: 'li', body: <>Her Intro to Logic grade (C+) suggests the gap started before this course. <Src k="records" /></> },
        { kind: 'p', body: <>
          The two agents agree on a <B>4-session adaptive pathway</B> that rebuilds implication first, then returns to equivalence.
          It’s on the right, waiting for your approval.
        </> },
    ],
    approved: [{ kind: 'p', body: <>
        Sent. Minh Anh will see the plan on her phone now, starting with the 5-minute operator review. I’ll check back after the
        mastery check tonight and flag you only if she hasn’t reached <B>0.75 within 3 sessions</B>.
      </> },],
    followUps: ['What gap is the class facing this week?', 'Show me her full history', 'Draft a message to her'],
  },
  class: {
    id: 'class',
    title: 'Class gap · logical equivalence',
    prompt: 'What gap is the class facing this week?',
    thinking: ['Student Analysis Agent · comparing 55 learning twins', 'Teaching Assistance Agent · checking what worked in similar cases'],
    answer: [
        { kind: 'p', body: <>
          The biggest gap this week is <B>implication → logical equivalence</B>. <B>12 of 55 students</B> are below 0.50 mastery,
          and it’s concentrated in groups <B>G2 and G4</B>.
        </> },
          { kind: 'li', body: <>Quiz 2, Q4 (p → q ≡ ?) was answered wrongly by <B>58%</B> of the class. <Src k="quiz" /></> },
          { kind: 'li', body: <>Thu Trang emailed about De Morgan’s laws — the same family of errors. <Src k="email" /></> },
          { kind: 'li', body: <>It’s a prerequisite problem: students weak here are also below 0.50 on implication. <Src k="lms" /></> },
        { kind: 'p', body: <>
          I suggest a <B>15-minute recap in Thursday’s tutorial</B> for everyone, plus adaptive practice for the 12. Guided
          conceptual practice lifted mastery in <B>82%</B> of similar cases. Three of the 12 need you personally.
        </> },
    ],
    approved: [{ kind: 'p', body: <>
        Done. The recap is on Thursday’s tutorial agenda with slides attached, and adaptive practice went out to 12 students.
        I’ll report back after Quiz 3.
      </> },],
    followUps: ['Which 3 need me?', 'Show the recap slides', 'Compare with last term'],
  },
  attention: {
    id: 'attention',
    title: 'Who needs me personally',
    prompt: 'Who needs me personally, not just the AI?',
    thinking: ['Student Analysis Agent · checking which interventions are not working', 'Teaching Assistance Agent · reviewing escalation policy'],
    answer: [
        { kind: 'p', body: <>
          <B>Three students</B> have passed your escalation rule (no mastery gain after 2 sessions). For them, more practice
          won’t help — a conversation will.
        </> },
          { kind: 'li', body: <>Two show no gain after two adaptive cycles. <Src k="lms" /></> },
          { kind: 'li', body: <>One has missed three tutorials and hasn’t replied on WhatsApp. <Src k="attendance" /> <Src k="whatsapp" /></> },
        { kind: 'p', body: <>I’ve held their automated plans and proposed 15-minute check-ins in your Friday office hours.</> },
    ],
    approved: [{ kind: 'p', body: <>Booked. Each student gets an invitation for Friday, and their plans stay paused until you’ve met.</> },],
    followUps: ['Draft the invitations', 'What did we already try?', 'Show the escalation policy'],
  },
};

export const FALLBACK: Block[] = [
  { kind: 'p', body: <>
    In this draft I can talk about <strong className="font-semibold">Minh Anh</strong>, <strong className="font-semibold">the class’s gap this week</strong>, or{' '}
    <strong className="font-semibold">who needs you personally</strong>. Try one of those.
  </> },
];

/** Short answer for "How is X doing?" asked from the classroom grid (any student except Minh Anh, who has a full topic). */
export function studentBrief(s: Student): Block[] {
  const m = <B>{s.mastery.toFixed(2)}</B>;
  if (COMPLEX.includes(s.index)) {
    return [{ kind: 'p', body: <>
        {s.name} is on your escalation list: mastery {m} and no gain after 2 sessions. <Src k="lms" /> I’ve paused the automated
        plan and proposed a 15-minute check-in on Friday — see <B>Who needs me personally</B>.
      </> },];
  }
  if (s.status === 'highRisk') {
    return [{ kind: 'p', body: <>
        {s.name} is one of 5 high-risk students, at {m} mastery. <Src k="quiz" /> An adaptive pathway on implication is running
        and the first mastery check is tomorrow. I’ll flag you if it doesn’t move.
      </> },];
  }
  if (s.status === 'support') {
    return [{ kind: 'p', body: <>
        {s.name} is just under the gap line at {m} mastery. <Src k="lms" /> Adaptive practice on implication is running; I’ll
        escalate only if there’s no gain after 2 sessions.
      </> },];
  }
  return [{ kind: 'p', body: <>
      {s.name} is on track at {m} mastery. <Src k="lms" />{' '}
      {s.track === 'routine' ? 'Routine practice is running on its own.' : 'No intervention is running.'} Nothing needs you here.
    </> },];
}

/** Sc8: the unprompted message after Minh Anh's mastery check. */
export const ADAPT: Block[] = [
  { kind: 'p', body: <>Minh Anh passed tonight’s mastery check: logical equivalence <B>0.35 → 0.78</B>. She’s reached the target.</> },
  { kind: 'p', body: <>One gap remains: <B>applying equivalence laws</B>. Within your policy, I’ve sent her a 3-session follow-up for tomorrow.</> },
];
