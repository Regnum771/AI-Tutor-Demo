import type { ReactNode } from 'react';
import { COMPLEX, type Student } from '../scenario/classroom';
import { MESSAGES } from '../scenario/sources';
import { Src } from './parts';

export type ContextId = 'student' | 'class' | 'attention';

export interface Topic {
  id: ContextId;
  /** Sidebar + header title. */
  title: string;
  prompt: string;
  /** What the agents are doing while the answer forms. */
  thinking: string[];
  answer: ReactNode;
  /** Follow-up line once the teacher approves the proposal in the panel. */
  approved: ReactNode;
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
    answer: (
      <>
        <p>
          Minh Anh’s Quiz 2 score fell from <B>75% to 42%</B>. It isn’t a general slump — almost every lost mark traces back to one
          concept: <B>implication</B>, which logical equivalence is built on.
        </p>
        <ul>
          <li>She picked the converse (q → p) on <B>6 implication items</B> across two quizzes. <Src k="quiz" /></li>
          <li>She told you as much on Zalo: <Vi>{MESSAGES[0].vi}</Vi> <Src k="zalo" /></li>
          <li>The truth-table lab and the implication worksheet are both still open. <Src k="lms" /></li>
          <li>Her Intro to Logic grade (C+) suggests the gap started before this course. <Src k="records" /></li>
        </ul>
        <p>
          The two agents agree on a <B>4-session adaptive pathway</B> that rebuilds implication first, then returns to equivalence.
          It’s on the right, waiting for your approval.
        </p>
      </>
    ),
    approved: (
      <p>
        Sent. Minh Anh will see the plan on her phone now, starting with the 5-minute operator review. I’ll check back after the
        mastery check tonight and flag you only if she hasn’t reached <B>0.75 within 3 sessions</B>.
      </p>
    ),
    followUps: ['Show me her full history', 'Make the pathway shorter', 'Draft a message to her'],
  },
  class: {
    id: 'class',
    title: 'Class gap · logical equivalence',
    prompt: 'What gap is the class facing this week?',
    thinking: ['Student Analysis Agent · comparing 55 learning twins', 'Teaching Assistance Agent · checking what worked in similar cases'],
    answer: (
      <>
        <p>
          The biggest gap this week is <B>implication → logical equivalence</B>. <B>12 of 55 students</B> are below 0.50 mastery,
          and it’s concentrated in groups <B>G2 and G4</B>.
        </p>
        <ul>
          <li>Quiz 2, Q4 (p → q ≡ ?) was answered wrongly by <B>58%</B> of the class. <Src k="quiz" /></li>
          <li>Thu Trang emailed about De Morgan’s laws — the same family of errors. <Src k="email" /></li>
          <li>It’s a prerequisite problem: students weak here are also below 0.50 on implication. <Src k="lms" /></li>
        </ul>
        <p>
          I suggest a <B>15-minute recap in Thursday’s tutorial</B> for everyone, plus adaptive practice for the 12. Guided
          conceptual practice lifted mastery in <B>82%</B> of similar cases. Three of the 12 need you personally.
        </p>
      </>
    ),
    approved: (
      <p>
        Done. The recap is on Thursday’s tutorial agenda with slides attached, and adaptive practice went out to 12 students.
        I’ll report back after Quiz 3.
      </p>
    ),
    followUps: ['Which 3 need me?', 'Show the recap slides', 'Compare with last term'],
  },
  attention: {
    id: 'attention',
    title: 'Who needs me personally',
    prompt: 'Who needs me personally, not just the AI?',
    thinking: ['Student Analysis Agent · checking which interventions are not working', 'Teaching Assistance Agent · reviewing escalation policy'],
    answer: (
      <>
        <p>
          <B>Three students</B> have passed your escalation rule (no mastery gain after 2 sessions). For them, more practice
          won’t help — a conversation will.
        </p>
        <ul>
          <li>Two show no gain after two adaptive cycles. <Src k="lms" /></li>
          <li>One has missed three tutorials and hasn’t replied on WhatsApp. <Src k="attendance" /> <Src k="whatsapp" /></li>
        </ul>
        <p>I’ve held their automated plans and proposed 15-minute check-ins in your Friday office hours.</p>
      </>
    ),
    approved: <p>Booked. Each student gets an invitation for Friday, and their plans stay paused until you’ve met.</p>,
    followUps: ['Draft the invitations', 'What did we already try?', 'Show the escalation policy'],
  },
};

/** Free-typed prompts are routed by keyword; the draft only knows these three topics. */
export function routePrompt(text: string): ContextId | null {
  const s = text.toLowerCase();
  if (/minh|anh|her\b|quiz score/.test(s)) return 'student';
  if (/personal|need me|needs me|1:1|attention|which 3/.test(s)) return 'attention';
  if (/class|gap|week|group|everyone/.test(s)) return 'class';
  return null;
}

export const FALLBACK = (
  <p>
    In this draft I can talk about <strong className="font-semibold">Minh Anh</strong>, <strong className="font-semibold">the class’s gap this week</strong>, or{' '}
    <strong className="font-semibold">who needs you personally</strong>. Try one of those.
  </p>
);

/** Short answer for "How is X doing?" asked from the classroom grid (any student except Minh Anh, who has a full topic). */
export function studentBrief(s: Student): ReactNode {
  const m = <B>{s.mastery.toFixed(2)}</B>;
  if (COMPLEX.includes(s.index)) {
    return (
      <p>
        {s.name} is on your escalation list: mastery {m} and no gain after 2 sessions. <Src k="lms" /> I’ve paused the automated
        plan and proposed a 15-minute check-in on Friday — see <B>Who needs me personally</B>.
      </p>
    );
  }
  if (s.status === 'highRisk') {
    return (
      <p>
        {s.name} is one of 5 high-risk students, at {m} mastery. <Src k="quiz" /> An adaptive pathway on implication is running
        and the first mastery check is tomorrow. I’ll flag you if it doesn’t move.
      </p>
    );
  }
  if (s.status === 'support') {
    return (
      <p>
        {s.name} is just under the gap line at {m} mastery. <Src k="lms" /> Adaptive practice on implication is running; I’ll
        escalate only if there’s no gain after 2 sessions.
      </p>
    );
  }
  return (
    <p>
      {s.name} is on track at {m} mastery. <Src k="lms" />{' '}
      {s.track === 'routine' ? 'Routine practice is running on its own.' : 'No intervention is running.'} Nothing needs you here.
    </p>
  );
}
