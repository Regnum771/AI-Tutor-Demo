export interface SceneDef {
  id: number;
  /** Short name shown in the controller. */
  label: string;
  /** Lower-third title on the dashboard; empty = no title overlay. */
  title: string;
  subtitle: string;
  durationMs: number;
  /** Key timestamps rendered by the contact sheet. */
  shots: number[];
}

export const SCENES: SceneDef[] = [
  { id: 1, label: 'Fragmented', title: 'Fragmented Data', subtitle: 'Heterogeneous Information. Limited Learning Intelligence.', durationMs: 12000, shots: [1500, 5000, 9500] },
  { id: 2, label: 'Architecture', title: '', subtitle: '', durationMs: 13000, shots: [2500, 6500, 9500, 12500] },
  { id: 3, label: 'Perceive', title: 'Multimodal Foundation Models', subtitle: 'Interpret. Extract. Connect.', durationMs: 15000, shots: [2000, 6500, 11500, 14000] },
  { id: 4, label: 'Represent', title: 'Knowledge Graphs → Grounded Inference', subtitle: 'Learning Digital Twins → Dynamic Student Representation', durationMs: 15000, shots: [2500, 5500, 10500, 13500] },
  { id: 5, label: 'Reason', title: 'Specialized Agent Intelligence', subtitle: 'Student Analysis Agent · Teaching Assistance Agent', durationMs: 15000, shots: [2500, 6500, 11000, 14000] },
  { id: 6, label: 'Collaborate', title: 'Collaborative Agent Intelligence', subtitle: 'Multimodal Evidence. Knowledge-Grounded Reasoning.', durationMs: 25000, shots: [4000, 9500, 13500, 18000, 22000] },
  { id: 7, label: 'Orchestrate', title: 'Agentic AI', subtitle: 'Adaptive Decisions → Service Coordination → Autonomous Execution', durationMs: 25000, shots: [3000, 7500, 10500, 14000, 17000, 21000] },
  { id: 8, label: 'Govern', title: 'AI Coordinates. Digital Twins Monitor. Teachers Govern.', subtitle: '', durationMs: 15000, shots: [2500, 6000, 10500, 13500] },
  { id: 9, label: 'Experience', title: 'Personalized Learning', subtitle: 'Adaptive Support. Continuous Evidence.', durationMs: 20000, shots: [5000, 10000, 15000, 18000] },
  { id: 10, label: 'Simulate & Adapt', title: 'Simulate. Intervene. Monitor. Adapt.', subtitle: 'The closed-loop learning digital twin', durationMs: 30000, shots: [3500, 10000, 13500, 19500, 23000, 28500] },
  { id: 11, label: 'Scale', title: 'One Integrated AI Architecture', subtitle: 'Multiple Learning Digital Twins. Personalized Interventions at Classroom Scale.', durationMs: 15000, shots: [500, 5500, 9500, 13500] },
  { id: 12, label: 'Closing', title: '', subtitle: '', durationMs: 10000, shots: [2000, 8000] },
];

export const TOTAL_MS = SCENES.reduce((sum, s) => sum + s.durationMs, 0);

/** Cross-app moments that both windows must agree on (scene time, ms). */
export const CUES = {
  /** Sc7: pipeline reaches DELIVERED on the dashboard. */
  sc7Delivered: 20500,
  /** Sc7: notification lands on the phone lock screen. */
  sc7Notify: 21000,
  /** Sc10: updated pathway delivered and shown on the phone. */
  sc10Update: 27000,
} as const;

export function sceneById(id: number): SceneDef {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
}
