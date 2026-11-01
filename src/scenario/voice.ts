import type { Evidence } from '../live/types';
import { STUDENTS } from './classroom';
import { lectureBefore, weekOf } from './course';
import type { ConceptId } from './knowledgeGraph';
import { MESSAGES } from './sources';

export type Channel = 'zalo' | 'email' | 'whatsapp' | 'forum';
export const CHANNEL_LABEL: Record<Channel, string> = { zalo: 'Zalo', email: 'Email', whatsapp: 'WhatsApp', forum: 'LMS forum' };

export interface VoiceEntry {
  /** The evidence id is `<studentId>-<slug>`. */
  slug: string;
  studentIndex: number;
  channel: Channel;
  day: number;
  /** HH:MM */
  time: string;
  /** The original, when written in Vietnamese. */
  vi: string | null;
  /** English, one line. */
  gist: string;
  concept: ConceptId;
  faqId: string | null;
}

export interface FaqEntry { id: string; question: string; confusion: string; concept: ConceptId }

export const FAQ: FaqEntry[] = [
  { id: 'f-converse', question: 'Why is p → q not the same as q → p?', confusion: 'Reading an implication as if it worked both ways', concept: 'implication' },
  { id: 'f-vacuous', question: 'Why is p → q true when p is false?', confusion: 'The false-premise rows of the truth table', concept: 'implication' },
  { id: 'f-equiv', question: 'What is the difference between ≡ and ↔?', confusion: 'Telling logical equivalence from the biconditional', concept: 'equivalence' },
  { id: 'f-rows', question: 'How many rows does a truth table need?', confusion: 'Listing every combination of truth values', concept: 'truthTables' },
  { id: 'f-demorgan', question: 'How do I negate an “and” or an “or”?', confusion: 'Applying De Morgan’s laws', concept: 'deMorgan' },
  { id: 'f-negimp', question: 'What is the negation of p → q?', confusion: 'Negating an implication as ¬p → ¬q', concept: 'negation' },
];

type Row = [slug: string, index: number, channel: Channel, day: number, time: string, vi: string | null, gist: string, concept: ConceptId, faqId: string | null];

const MA = 16;
const m = (id: string) => MESSAGES.find((x) => x.id === id)!;

/** Seeded student messages, days 1–39. Fictional demo data. */
const ROWS: Row[] = [
  // Truth tables, around Lecture 3 (day 15) and Quiz 1 (day 17)
  ['voice-1', 3, 'zalo', 15, '21:05', 'Thầy ơi, bảng chân trị có 3 biến thì cần bao nhiêu dòng ạ?', 'How many rows for a three-variable truth table?', 'truthTables', 'f-rows'],
  ['voice-2', 9, 'forum', 16, '10:20', null, 'Do we list truth-table rows in a fixed order?', 'truthTables', 'f-rows'],
  ['voice-3', 22, 'zalo', 16, '20:45', 'Em làm bảng chân trị bị thiếu dòng, có cách nào kiểm tra không ạ?', 'Keeps missing rows in truth tables; how to check?', 'truthTables', 'f-rows'],
  ['voice-4', 35, 'email', 16, '23:10', null, 'Is there a quick way to know how many rows a truth table needs?', 'truthTables', 'f-rows'],
  ['voice-5', 48, 'zalo', 17, '07:40', 'Bảng chân trị 4 biến có phải 16 dòng không ạ?', 'Is a four-variable truth table 16 rows?', 'truthTables', 'f-rows'],
  ['voice-6', 12, 'forum', 15, '13:30', null, 'Why do truth tables start with the all-T row?', 'truthTables', 'f-rows'],
  ['voice-7', 28, 'zalo', 16, '22:00', 'Em vẫn hay nhầm khi điền bảng chân trị.', 'Still mixes up filling in truth tables', 'truthTables', 'f-rows'],
  // The converse, after Lecture 5 (day 29) and Quiz 2 (day 38)
  ['zalo-1', MA, 'zalo', 30, '21:40', m('m1').vi, m('m1').evidence, 'implication', 'f-converse'],
  ['voice-8', 4, 'zalo', 29, '12:15', 'Sao p → q lại không giống q → p vậy thầy?', 'Why is p → q different from q → p?', 'implication', 'f-converse'],
  ['voice-9', 7, 'forum', 29, '19:50', null, 'If p → q is true, does q → p have to be true too?', 'implication', 'f-converse'],
  ['voice-10', 11, 'zalo', 30, '09:05', 'Em tưởng “nếu p thì q” cũng có nghĩa là “nếu q thì p”.', 'Thought “if p then q” also means “if q then p”', 'implication', 'f-converse'],
  ['voice-11', 19, 'email', 30, '14:30', null, 'Question about the converse and the contrapositive in Lecture 5', 'implication', 'f-converse'],
  ['voice-12', 24, 'zalo', 30, '22:20', 'Mệnh đề đảo và mệnh đề phản đảo khác nhau thế nào ạ?', 'How do the converse and the contrapositive differ?', 'implication', 'f-converse'],
  ['voice-13', 31, 'whatsapp', 31, '08:10', 'Em làm sai bài 4 vì nghĩ p → q tương đương q → p.', 'Got exercise 4 wrong by treating p → q as q → p', 'implication', 'f-converse'],
  ['voice-14', 33, 'zalo', 31, '20:35', 'Thầy giải thích lại giúp em ví dụ “trời mưa thì đường ướt” được không ạ?', 'Asks to go over the “if it rains, the road is wet” example again', 'implication', 'f-converse'],
  ['voice-15', 38, 'forum', 30, '16:45', null, 'Is the converse of a true statement always false?', 'implication', 'f-converse'],
  ['voice-16', 42, 'zalo', 29, '21:30', 'p → q với q → p, cái nào đúng ạ?', 'Which is right, p → q or q → p?', 'implication', 'f-converse'],
  ['voice-17', 50, 'email', 31, '11:00', null, 'Confused by the converse question on the Lecture 5 worksheet', 'implication', 'f-converse'],
  ['voice-18', 45, 'whatsapp', 32, '09:30', null, 'Still unsure when an implication can be reversed', 'implication', 'f-converse'],
  ['voice-19', 4, 'zalo', 37, '21:15', 'Thầy ơi, câu đảo có ra trong Quiz 2 không ạ?', 'Will the converse be on Quiz 2?', 'implication', 'f-converse'],
  ['voice-20', 11, 'zalo', 38, '17:20', 'Em lại chọn q → p ở câu 4 Quiz 2 rồi ạ.', 'Chose q → p again on Quiz 2 Q4', 'implication', 'f-converse'],
  ['voice-21', 24, 'forum', 38, '18:05', null, 'Quiz 2 Q4: why is the converse not equivalent?', 'implication', 'f-converse'],
  ['voice-22', 53, 'zalo', 38, '19:40', 'Câu 4 Quiz 2 em không hiểu sao sai.', 'Does not see why Quiz 2 Q4 was wrong', 'implication', 'f-converse'],
  // False premises, after Lecture 5
  ['voice-23', 1, 'forum', 29, '11:40', null, 'Why is “if pigs fly, then 2 + 2 = 5” true?', 'implication', 'f-vacuous'],
  ['voice-24', 6, 'zalo', 29, '20:10', 'Tại sao p sai thì p → q luôn đúng ạ?', 'Why is p → q always true when p is false?', 'implication', 'f-vacuous'],
  ['voice-25', 14, 'email', 30, '08:55', null, 'The false-premise rows of the implication table make no sense to me', 'implication', 'f-vacuous'],
  ['voice-26', 20, 'zalo', 30, '21:05', 'Em thấy hai dòng cuối của bảng p → q rất khó hiểu.', 'Finds the last two rows of the p → q table confusing', 'implication', 'f-vacuous'],
  ['voice-27', 27, 'zalo', 31, '13:15', 'Nếu giả thiết sai thì kết luận có quan trọng không ạ?', 'Does the conclusion matter if the premise is false?', 'implication', 'f-vacuous'],
  ['voice-28', 36, 'forum', 31, '19:25', null, 'Is “vacuously true” going to be on the quiz?', 'implication', 'f-vacuous'],
  ['voice-29', 44, 'zalo', 32, '22:40', 'Em vẫn chưa thấy thuyết phục vì sao F → F lại là T.', 'Not convinced why F → F is T', 'implication', 'f-vacuous'],
  ['voice-30', 52, 'email', 30, '15:10', null, 'Why does a false hypothesis make the implication true?', 'implication', 'f-vacuous'],
  // Negating an implication, after Lecture 5
  ['voice-31', 2, 'zalo', 31, '21:50', 'Phủ định của p → q có phải là ¬p → ¬q không ạ?', 'Is the negation of p → q just ¬p → ¬q?', 'negation', 'f-negimp'],
  ['voice-32', 18, 'forum', 32, '10:05', null, 'How do you negate an implication?', 'negation', 'f-negimp'],
  ['voice-33', 29, 'zalo', 33, '20:30', 'Em không biết phủ định câu “nếu… thì…” thế nào.', 'Unsure how to negate an “if… then…” sentence', 'negation', 'f-negimp'],
  ['voice-34', 47, 'email', 33, '09:15', null, 'Is ¬(p → q) the same as p ∧ ¬q?', 'negation', 'f-negimp'],
  // Equivalence and the biconditional, after Lecture 6 (day 36)
  ['voice-35', 5, 'zalo', 36, '12:30', 'Ký hiệu ≡ và ↔ khác nhau chỗ nào ạ?', 'What is the difference between ≡ and ↔?', 'equivalence', 'f-equiv'],
  ['voice-36', 10, 'forum', 36, '15:20', null, 'Is logical equivalence just a biconditional that is always true?', 'equivalence', 'f-equiv'],
  ['voice-37', 15, 'zalo', 36, '21:10', 'Làm sao chứng minh hai mệnh đề tương đương mà không dùng bảng chân trị ạ?', 'How to prove two statements equivalent without a truth table?', 'equivalence', 'f-equiv'],
  ['voice-38', 23, 'email', 37, '08:40', null, 'When do I write ≡ and when ↔ in proofs?', 'equivalence', 'f-equiv'],
  ['voice-39', 34, 'zalo', 37, '20:55', 'Em hay viết ↔ thay cho ≡, như vậy có bị trừ điểm không ạ?', 'Writes ↔ for ≡; will that lose marks?', 'equivalence', 'f-equiv'],
  ['voice-40', 40, 'forum', 37, '22:15', null, 'Are p → q and ¬q → ¬p logically equivalent?', 'equivalence', 'f-equiv'],
  ['voice-41', 49, 'zalo', 38, '07:55', 'Tương đương logic có cần đúng ở mọi dòng không ạ?', 'Does logical equivalence need to hold on every row?', 'equivalence', 'f-equiv'],
  // De Morgan, after Lecture 6 and Quiz 2
  ['email', 26, 'email', 39, '08:15', m('m3').vi, m('m3').evidence, 'deMorgan', 'f-demorgan'],
  ['voice-42', 8, 'zalo', 36, '22:30', 'Phủ định của “p và q” là “không p và không q” đúng không ạ?', 'Is the negation of “p and q” “not p and not q”?', 'deMorgan', 'f-demorgan'],
  ['voice-43', 13, 'forum', 37, '12:10', null, 'When negating, does ∧ always turn into ∨?', 'deMorgan', 'f-demorgan'],
  ['voice-44', 21, 'zalo', 37, '21:45', 'Em hay quên đổi ∧ thành ∨ khi phủ định.', 'Forgets to swap ∧ and ∨ when negating', 'deMorgan', 'f-demorgan'],
  ['voice-45', 39, 'email', 38, '20:20', null, 'De Morgan question from Quiz 2: how does it work with three terms?', 'deMorgan', 'f-demorgan'],
  ['voice-46', 54, 'zalo', 39, '10:30', 'Luật De Morgan áp dụng cho lượng từ được không ạ?', 'Does De Morgan apply to quantifiers too?', 'deMorgan', 'f-demorgan'],
  // Not a question
  ['zalo-2', MA, 'zalo', 36, '22:10', m('m4').vi, m('m4').evidence, 'truthTables', null],
];

export const VOICE: VoiceEntry[] = ROWS.map(([slug, studentIndex, channel, day, time, vi, gist, concept, faqId]) => ({ slug, studentIndex, channel, day, time, vi, gist, concept, faqId }));

export const voiceEvidenceId = (v: VoiceEntry): string => `${STUDENTS[v.studentIndex].id}-${v.slug}`;

const BY_EVIDENCE = new Map(VOICE.map((v) => [voiceEvidenceId(v), v]));
export const voiceFor = (evidenceId: string): VoiceEntry | undefined => BY_EVIDENCE.get(evidenceId);

export const voiceEvidence = (v: VoiceEntry): Evidence => ({
  id: voiceEvidenceId(v), kind: 'message', source: CHANNEL_LABEL[v.channel],
  text: v.vi ? `“${v.vi}” (${v.gist})` : v.gist,
  when: `Week ${weekOf(v.day)}`, concept: v.concept, day: v.day, time: v.time,
});

const stamp = (v: VoiceEntry) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3));

/** One FAQ entry's messages, newest first. */
export const faqLog = (faqId: string): VoiceEntry[] => VOICE.filter((v) => v.faqId === faqId).sort((a, b) => stamp(b) - stamp(a));

/** Figures computed from the log, so they always agree with it. */
export function faqStats(faqId: string): { messages: number; students: number; latestDay: number; timing: string } {
  const log = faqLog(faqId);
  const placed = log.flatMap((v) => {
    const l = lectureBefore(v.day, v.time);
    return l ? [{ n: l.n, after: v.day - l.day }] : [];
  });
  const counts = new Map<number, number>();
  for (const p of placed) counts.set(p.n, (counts.get(p.n) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  const ds = placed.filter((p) => p.n === top).map((p) => p.after).sort((a, b) => a - b);
  const lo = ds[Math.floor((ds.length - 1) * 0.25)];
  const hi = ds[Math.floor((ds.length - 1) * 0.75)];
  const days = (d: number) => `${d} day${d === 1 ? '' : 's'}`;
  const timing = top === undefined ? 'before Lecture 1'
    : hi === 0 ? `mostly the same day as Lecture ${top}`
    : lo === 0 ? `mostly within ${days(hi)} of Lecture ${top}`
    : lo === hi ? `mostly ${days(lo)} after Lecture ${top}`
    : `mostly ${lo}–${hi} days after Lecture ${top}`;
  return { messages: log.length, students: new Set(log.map((v) => v.studentIndex)).size, latestDay: log[0]?.day ?? 0, timing };
}
