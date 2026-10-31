import { MINH_ANH } from './minhAnh';

export type Status = 'onTrack' | 'support' | 'highRisk';
export type Track = 'routine' | 'adaptive' | 'complex' | 'none';

export interface Student {
  index: number;
  id: string;
  name: string;
  status: Status;
  mastery: number;
  track: Track;
}

const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
const GIVEN = [
  'An', 'Bảo', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoa', 'Huy', 'Khánh', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai',
  'Nam', 'Ngọc', 'Phúc', 'Phương', 'Quân', 'Quang', 'Sơn', 'Tâm', 'Thảo', 'Thành', 'Trang', 'Trung', 'Tú', 'Tuấn', 'Uyên',
  'Việt', 'Vy', 'Yến', 'Duy', 'Đức', 'Hạnh', 'Kiên', 'Loan', 'Nhi', 'Oanh', 'Phong', 'Quỳnh', 'Tài', 'Thư', 'Toàn', 'Trâm',
  'Vân', 'Xuân', 'Hùng', 'Lộc', 'My', 'Nga', 'Thắng', 'Hiền',
];

export const HIGH_RISK = [3, 16, 28, 41, 50];
export const SUPPORT = [7, 12, 22, 33, 37, 45, 53];
export const COMPLEX = [28, 41, 50];

const statusOf = (i: number): Status => (HIGH_RISK.includes(i) ? 'highRisk' : SUPPORT.includes(i) ? 'support' : 'onTrack');

function masteryOf(i: number, status: Status): number {
  if (i === MINH_ANH.index) return 0.35;
  if (status === 'highRisk') return 0.3 + (i % 7) / 100;
  if (status === 'support') return 0.48 + (i % 5) / 100;
  return 0.62 + ((i * 37) % 30) / 100;
}

export const STUDENTS: Student[] = (() => {
  let routineLeft = 31;
  return Array.from({ length: 55 }, (_, i) => {
    const status = statusOf(i);
    const name = i === MINH_ANH.index ? MINH_ANH.name : `${FAMILY[i % FAMILY.length]} ${GIVEN[i]}`;
    let track: Track = 'none';
    if (COMPLEX.includes(i)) track = 'complex';
    else if (status !== 'onTrack') track = 'adaptive';
    else if (routineLeft > 0) { track = 'routine'; routineLeft--; }
    return { index: i, id: `s${i + 1}`, name, status, mastery: masteryOf(i, status), track };
  });
})();

export const EFFECTIVENESS = [
  { label: 'Guided conceptual practice', value: 82 },
  { label: 'Spaced retrieval', value: 74 },
  { label: 'Independent practice', value: 58 },
];

export const TOPICS = ['Propositions', 'Logical operators', 'Implication', 'Logical equivalence', 'Predicates', 'Proof methods'];
export const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5'];
/** HEATMAP[topic][group] = average mastery. */
export const HEATMAP: number[][] = [
  [0.88, 0.85, 0.82, 0.86, 0.8],
  [0.8, 0.74, 0.77, 0.72, 0.78],
  [0.58, 0.49, 0.55, 0.46, 0.52],
  [0.52, 0.44, 0.5, 0.41, 0.49],
  [0.66, 0.6, 0.63, 0.58, 0.61],
  [0.61, 0.55, 0.59, 0.52, 0.57],
];

export const SCALE_STUDENTS = [
  { letter: 'A', index: 3, need: 'Conceptual gap', intervention: 'Visual scaffolding' },
  { letter: 'B', index: 12, need: 'Weak application', intervention: 'Worked examples' },
  { letter: 'C', index: 22, need: 'Knowledge retention', intervention: 'Spaced retrieval' },
  { letter: 'D', index: 28, need: 'Persistent difficulty', intervention: 'Teacher-supported intervention' },
  { letter: 'E', index: 17, need: 'Advanced mastery', intervention: 'Challenging application tasks' },
];

export const POLICY_RULES = [
  { id: 'auto', label: 'Auto-deliver routine & adaptive interventions', before: 'On', after: 'On' },
  { id: 'escalate', label: 'Escalate if no mastery gain after', before: '3 sessions', after: '2 sessions' },
  { id: 'notify', label: 'Notify me on new high-risk flags', before: 'Immediately', after: 'Immediately' },
];

export const initials = (name: string): string =>
  name.trim().split(/\s+/).slice(-2).map((p) => p[0]).join('').toUpperCase();
