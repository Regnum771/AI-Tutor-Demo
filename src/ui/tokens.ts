/** Colour tokens. Each colour stands for one architectural component across every scene. */
export const C = {
  deep: '#070E1F',
  panel: '#0D1A33',
  surface: '#13244A',
  line: '#22355E',
  ink: '#F4F7FF',
  dim: '#9AA8C7',
  cyan: '#22D3EE', // multimodal layer
  royal: '#3B6CF6', // knowledge graph
  twin: '#A78BFA', // digital twin
  sas: '#60A5FA', // Student Analysis Agent
  tas: '#34D399', // Teaching Assistance Agent
  gold: '#F5B942', // teacher governance & policy
  engine: '#FFFFFF', // orchestration engine
  gap: '#F87171',
  mastered: '#4ADE80',
} as const;

export const masteryColor = (m: number): string => (m >= 0.7 ? C.mastered : m >= 0.5 ? C.gold : C.gap);
