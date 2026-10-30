import type { ConceptId } from './knowledgeGraph';

export type EvidenceKind = 'structured' | 'text' | 'interaction' | 'document';
export type SourceKind = 'lms' | 'zalo' | 'whatsapp' | 'email' | 'records' | 'assessment' | 'attendance' | 'materials';

export interface RawMessage {
  id: string;
  channel: 'zalo' | 'whatsapp' | 'email';
  from: string;
  vi: string;
  evidence: string;
  concept?: ConceptId;
}

export const MESSAGES: RawMessage[] = [
  { id: 'm1', channel: 'zalo', from: 'Minh Anh', vi: 'Em vẫn chưa hiểu vì sao p → q lại khác q → p ạ.', evidence: 'Confused why p → q ≠ q → p', concept: 'implication' },
  { id: 'm2', channel: 'whatsapp', from: 'Quang Huy', vi: 'Em nộp bài tập 3 muộn một ngày được không ạ? Tuần này em bị ốm.', evidence: 'Requests extension on Assignment 3 (illness)' },
  { id: 'm3', channel: 'email', from: 'Thu Trang', vi: 'Em muốn hỏi thêm về luật De Morgan trong bài kiểm tra vừa rồi.', evidence: "Asks about De Morgan's laws from Quiz 2", concept: 'deMorgan' },
  { id: 'm4', channel: 'zalo', from: 'Minh Anh', vi: 'Em xin lỗi, tuần này em chưa kịp làm bài thực hành bảng chân trị.', evidence: 'Truth-table lab not completed', concept: 'truthTables' },
];

const msg = (id: string) => MESSAGES.find((m) => m.id === id)!;

export interface SourceWindow {
  kind: SourceKind;
  short: string;
  title: string;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  particle: EvidenceKind;
}

export const SOURCE_WINDOWS: SourceWindow[] = [
  { kind: 'lms', short: 'LMS', title: 'LMS · Gradebook · DM-2026', lines: ['Assignment 3 · 41 / 55 submitted', 'Quiz 2 · class average 61%', 'Nguyễn Minh Anh · Quiz 2: 42%'], x: 60, y: 70, w: 560, h: 260, particle: 'structured' },
  { kind: 'zalo', short: 'Zalo', title: 'Zalo · Lớp Toán rời rạc', lines: [`Minh Anh: ${msg('m1').vi}`, `Minh Anh: ${msg('m4').vi}`], x: 680, y: 40, w: 520, h: 300, particle: 'text' },
  { kind: 'whatsapp', short: 'WhatsApp', title: 'WhatsApp · DM study group', lines: [`Quang Huy: ${msg('m2').vi}`, '+ 14 unread messages'], x: 1260, y: 90, w: 560, h: 280, particle: 'text' },
  { kind: 'email', short: 'Email', title: 'Inbox · 23 unread', lines: [`Thu Trang: ${msg('m3').vi}`, 'Faculty office: Week 7 room change'], x: 1300, y: 420, w: 520, h: 260, particle: 'text' },
  { kind: 'records', short: 'Academic records', title: 'Academic Records · prior subjects', lines: ['Intro to Logic · Minh Anh: C+ (68%)', 'Calculus I · Minh Anh: B (74%)'], x: 90, y: 400, w: 520, h: 240, particle: 'structured' },
  { kind: 'assessment', short: 'Assessments', title: 'Assessment System · Quiz 2 responses', lines: ['Q4  p → q ≡ ?  · 58% incorrect', "Q7  De Morgan's law · 44% incorrect"], x: 640, y: 380, w: 560, h: 250, particle: 'structured' },
  { kind: 'attendance', short: 'Attendance', title: 'Attendance · Week 6', lines: ['Present 47 / 55', 'Minh Anh · absent from tutorial 5'], x: 180, y: 700, w: 500, h: 220, particle: 'interaction' },
  { kind: 'materials', short: 'Learning materials', title: 'Learning Materials', lines: ['Lecture 5 · Implication.pdf', 'Worksheet · Truth tables.docx'], x: 1240, y: 720, w: 520, h: 230, particle: 'document' },
];

export const EVIDENCE_ITEMS: { kind: EvidenceKind; source: string; raw: string; evidence: string }[] = [
  { kind: 'structured', source: 'Assessment · Quiz 2', raw: 'score = 0.42 (prev 0.75)', evidence: 'Assessment performance 75% → 42%' },
  { kind: 'text', source: 'Zalo', raw: msg('m1').vi, evidence: msg('m1').evidence },
  { kind: 'interaction', source: 'LMS activity log', raw: '2 activities overdue · last login 6 days ago', evidence: '2 incomplete learning activities' },
  { kind: 'structured', source: 'Quiz 2 responses', raw: 'Q4: chose q → p (6 attempts across quizzes)', evidence: 'Repeated conceptual error: converse' },
  { kind: 'document', source: 'Academic records', raw: 'Intro to Logic: C+ (68%)', evidence: 'Weak prerequisite mastery' },
];

export const TEACHER_QUESTIONS = [
  'Which students are falling behind?',
  'What are their actual knowledge gaps?',
  'Is it the current topic or prerequisite knowledge?',
  'Who needs individual attention versus group support?',
  'What intervention should happen next, and when?',
];
