export interface SceneDef {
  id: number;
  /** Short name shown in the controller. */
  label: string;
  /** Lower-third title on the teacher window; empty = no title overlay. */
  title: string;
  subtitle: string;
  /** Loop stage shown as the chapter label; empty = none. */
  chapter: string;
  durationMs: number;
  /** Key timestamps rendered by the contact sheet. */
  shots: number[];
}

export const SCENES: SceneDef[] = [
  { id: 1, label: 'Problem', title: 'Fragmented Data', subtitle: 'Heterogeneous information. Limited learning intelligence.', chapter: '', durationMs: 24000, shots: [3000, 10000, 15000, 22000] },
  { id: 2, label: 'Beyond', title: 'Multimodal Foundation Models', subtitle: 'Every source. One conversation.', chapter: 'Sense', durationMs: 10000, shots: [1500, 4500, 9500] },
  { id: 3, label: 'Classroom', title: 'Learning Digital Twins', subtitle: 'A live model of every student.', chapter: 'Sense', durationMs: 15000, shots: [1500, 5000, 11500, 14500] },
  { id: 4, label: 'Minh Anh', title: 'Collaborative Agent Intelligence', subtitle: 'Knowledge-grounded reasoning, with evidence.', chapter: 'Diagnose', durationMs: 25000, shots: [1500, 4000, 6500, 11000, 17000, 24000] },
  { id: 5, label: 'Class gap', title: 'Knowledge Graphs → Grounded Inference', subtitle: 'Prerequisite gaps, across the class.', chapter: 'Diagnose', durationMs: 10000, shots: [1500, 4500, 9500] },
  { id: 6, label: 'Approve', title: 'AI Coordinates. Teachers Govern.', subtitle: '', chapter: 'Intervene · Oversee', durationMs: 15000, shots: [1000, 3200, 5000, 7200, 14500] },
  { id: 7, label: 'Student', title: 'Personalized Learning', subtitle: 'Adaptive support. Continuous evidence.', chapter: 'Intervene', durationMs: 20000, shots: [19000] },
  { id: 8, label: 'Adapt', title: 'Monitor. Adapt.', subtitle: 'The closed-loop learning digital twin.', chapter: 'Adapt', durationMs: 15000, shots: [2500, 6000, 9000, 14500] },
  { id: 9, label: 'How it works', title: 'One Integrated AI Architecture', subtitle: 'Multimodal Intelligence. Knowledge-Grounded Reasoning. Dynamic Digital Twins. Agentic Adaptation.', chapter: '', durationMs: 20000, shots: [4000, 11000, 15000, 19500] },
  { id: 10, label: 'Closing', title: '', subtitle: '', chapter: '', durationMs: 5000, shots: [4500] },
];

export const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.durationMs, 0);

/** Cross-app moments that both windows must agree on (scene time, ms). */
export const CUES = {
  /** Sc6: notification lands on the phone, 1 s after the teacher clicks Approve (6500). */
  approveNotify: 7500,
  /** Sc8: the follow-up plan appears on the phone, as the Classroom updates. */
  adaptUpdate: 9000,
} as const;

export function sceneById(id: number): SceneDef {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
}
