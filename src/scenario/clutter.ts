import type { SourceKind } from './sources';

/** Sc1 popups: the teacher's sources pile up, first in an orderly grid, then in a seeded, ever faster mess. */

/** Header colour per app (text colour picked for contrast). */
export const APP_HEADER: Record<SourceKind, { bg: string; fg: string }> = {
  lms: { bg: '#F98012', fg: '#FFFFFF' },
  zalo: { bg: '#0068FF', fg: '#FFFFFF' },
  whatsapp: { bg: '#075E54', fg: '#FFFFFF' },
  email: { bg: '#0F6CBD', fg: '#FFFFFF' },
  records: { bg: '#1F3A68', fg: '#FFFFFF' },
  assessment: { bg: '#6E3FC3', fg: '#FFFFFF' },
  attendance: { bg: '#B23A48', fg: '#FFFFFF' },
  materials: { bg: '#F2B705', fg: '#1A1714' },
};

export interface Popup {
  kind: SourceKind;
  title: string;
  lines: string[];
}

/** The six that open the scene in a neat grid. */
const ORDERLY: Popup[] = [
  { kind: 'lms', title: 'LMS · Gradebook · DM-2026', lines: ['Assignment 3 · 41 / 55 submitted', 'Quiz 2 · class average 61%'] },
  { kind: 'zalo', title: 'Zalo · Discrete Maths class', lines: ['Minh Anh: I still don’t get why p → q is different from q → p.'] },
  { kind: 'whatsapp', title: 'WhatsApp · DM study group', lines: ['Quang Huy: Can I hand in Assignment 3 a day late? I’ve been sick.', '+ 14 unread messages'] },
  { kind: 'records', title: 'Academic Records · prior subjects', lines: ['Intro to Logic · Minh Anh: C+ (68%)', 'Calculus I · Minh Anh: B (74%)'] },
  { kind: 'assessment', title: 'Assessment System · Quiz 2', lines: ['Q4  p → q ≡ ?  · 58% incorrect', 'Q7  De Morgan’s law · 44% incorrect'] },
  { kind: 'email', title: 'Inbox · 23 unread', lines: ['Thu Trang: Could you explain De Morgan’s law from the quiz?', 'Faculty office: Week 7 room change'] },
];

/** The pile-up, shuffled with a fixed seed below. */
const MESSY: Popup[] = [
  { kind: 'lms', title: 'LMS · Activity alerts', lines: ['2 activities overdue · Minh Anh', 'Last login 6 days ago'] },
  { kind: 'lms', title: 'LMS · Forum', lines: ['12 new posts in Week 6 discussion', '3 questions unanswered'] },
  { kind: 'lms', title: 'LMS · Submissions', lines: ['Late submission: Tu · Assignment 3'] },
  { kind: 'zalo', title: 'Zalo · Minh Anh', lines: ['Sorry, I haven’t done the truth-table lab yet this week.'] },
  { kind: 'zalo', title: 'Zalo · Tutorial group 3', lines: ['Bao: Is Friday’s quiz open-book?'] },
  { kind: 'zalo', title: 'Zalo · Lan', lines: ['Which chapters are on the mid-term?'] },
  { kind: 'whatsapp', title: 'WhatsApp · Quang Huy', lines: ['Sent you my doctor’s note (PDF).'] },
  { kind: 'whatsapp', title: 'WhatsApp · Class reps', lines: ['Can we move the review session to Thursday?'] },
  { kind: 'whatsapp', title: 'WhatsApp · Phong', lines: ['The LMS quiz says “locked” for me.'] },
  { kind: 'email', title: 'Inbox · Head of department', lines: ['Please submit mid-term grades by Friday.'] },
  { kind: 'email', title: 'Inbox · IT services', lines: ['LMS maintenance Saturday 22:00–02:00'] },
  { kind: 'email', title: 'Inbox · Faculty office', lines: ['Room change: B2-304 → C1-201'] },
  { kind: 'records', title: 'Academic Records · alerts', lines: ['4 students missing prerequisite records'] },
  { kind: 'assessment', title: 'Assessment System · Item analysis', lines: ['Q4: 31% chose the converse q → p'] },
  { kind: 'assessment', title: 'Assessment System · Regrades', lines: ['5 regrade requests pending'] },
  { kind: 'attendance', title: 'Attendance · Week 6', lines: ['Present 47 / 55', 'Minh Anh · absent from tutorial 5'] },
  { kind: 'attendance', title: 'Attendance · Alerts', lines: ['6 students below 80% attendance'] },
  { kind: 'materials', title: 'Learning Materials', lines: ['Lecture 5 · Implication.pdf', 'Worksheet · Truth tables.docx'] },
  { kind: 'materials', title: 'Learning Materials · Comments', lines: ['“Slide 14 is confusing” · 9 likes'] },
  { kind: 'materials', title: 'Learning Materials · Downloads', lines: ['Truth tables worksheet · 18 / 55 opened'] },
  { kind: 'lms', title: 'LMS · Grades', lines: ['Quiz 2 grades published · 55 students'] },
  { kind: 'lms', title: 'LMS · Messages', lines: ['Huy: My upload failed twice'] },
  { kind: 'zalo', title: 'Zalo · Study buddies', lines: ['Is p → q the same as ¬p ∨ q?'] },
  { kind: 'zalo', title: 'Zalo · Hai', lines: ['Can you share last week’s slides again?'] },
  { kind: 'whatsapp', title: 'WhatsApp · Lab group B', lines: ['Who has the answers for Q3?'] },
  { kind: 'email', title: 'Inbox · Library', lines: ['Course reserve books are due back'] },
  { kind: 'email', title: 'Inbox · Student services', lines: ['2 accommodation requests to review'] },
  { kind: 'records', title: 'Academic Records · enrolment', lines: ['3 late enrolments this week'] },
  { kind: 'assessment', title: 'Assessment System · Mid-term', lines: ['Mid-term draft due for review'] },
  { kind: 'attendance', title: 'Attendance · Tutorial 5', lines: ['9 absences · 2 unexplained'] },
  { kind: 'materials', title: 'Learning Materials · Video', lines: ['Lecture 5 recording · 22% watched'] },
  { kind: 'email', title: 'Inbox · TA notes (Linh)', lines: ['Tutorial 5: Minh Anh stayed quiet, skipped Q3'] },
  { kind: 'zalo', title: 'Zalo · TA Duc', lines: ['Two students haven’t spoken in tutorials for 3 weeks'] },
];

/** Deterministic PRNG (mulberry32) so every render shuffles and scatters the same way. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with the seeded PRNG, re-drawn until no app appears twice in a row. */
function shuffle(items: Popup[], rand: () => number): Popup[] {
  for (;;) {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.every((p, i) => i === 0 || p.kind !== a[i - 1].kind) && a[0].kind !== ORDERLY[ORDERLY.length - 1].kind) return a;
  }
}

export interface PlacedPopup extends Popup {
  at: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Timed to the narration: grid 0.5–5.5 s, pile-up from 6.3 s, full clutter holds, questions from 16.5 s. */
export const ORDERLY_STEP = 850;
export const MESSY_START = 6300;
export const QUESTIONS_IN = 16500;

const COLS = 6;
const ROWS = 6;
const GRID_W = 540;
const GRID_H = 220;
const GRID_X = [90, 690, 1290];
const GRID_Y = [80, 340];

function place(): PlacedPopup[] {
  const rand = rng(20261031);
  const orderly = ORDERLY.map((p, i) => ({
    ...p, at: 500 + i * ORDERLY_STEP, x: GRID_X[i % 3], y: GRID_Y[Math.floor(i / 3)], w: GRID_W, h: GRID_H, rot: 0,
  }));
  // Messy popups each take a cell of a jittered 6x6 grid (in shuffled order), so together they cover the screen.
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  let at = MESSY_START;
  let gap = 520;
  const messy = shuffle(MESSY, rand).map((p, i) => {
    const w = 380 + Math.round(rand() * 160);
    const h = p.lines.length > 1 ? 170 : 140;
    const cx = ((cells[i] % COLS) + 0.5) * (1920 / COLS) + (rand() * 2 - 1) * 90;
    const cy = (Math.floor(cells[i] / COLS) + 0.5) * (1080 / ROWS) + (rand() * 2 - 1) * 50;
    const placed = {
      ...p, at,
      x: Math.round(cx - w / 2),
      y: Math.round(cy - h / 2),
      w, h,
      rot: Math.round((rand() * 2 - 1) * 60) / 10,
    };
    at += gap;
    gap = Math.max(110, Math.round(gap * 0.87));
    return placed;
  });
  return [...orderly, ...messy];
}

export const POPUPS: PlacedPopup[] = place();
