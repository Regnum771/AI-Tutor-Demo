export const OPERATIONS = [
  { id: 'coordinate', title: 'Adaptive decision coordination', detail: 'Joint decision within teacher policy · adaptive track · auto-execute' },
  { id: 'retrieve', title: 'Resource retrieval', detail: '4 resources retrieved from the course knowledge base' },
  { id: 'assemble', title: 'Activity generation & assembly', detail: '5 activities assembled for the selected strategy' },
  { id: 'pathway', title: 'Pathway construction', detail: 'Ordered by prerequisite dependencies' },
  { id: 'deliver', title: 'Service coordination', detail: 'Scheduled and delivered to the student app' },
  { id: 'monitor', title: 'Execution monitoring', detail: 'Tracking against mastery criteria' },
];

export const STATUSES = ['DECISION READY', 'RESOURCES RETRIEVED', 'PATHWAY CREATED', 'SCHEDULED', 'DELIVERED', 'MONITORING'] as const;

export const ACTIVITIES = [
  'Visual explanation of logical operators', 'Worked examples', 'Guided exercises', 'Application problems', 'Mastery assessment',
];

/** Proposed in Sc4–Sc6, before the teacher's edit. Every session falls after the 15:00 approval. */
export const PATHWAY_PROPOSED = [
  { title: 'Review logical operators', mins: 5, when: 'Today 15:30' },
  { title: 'Explore visual explanations', mins: 8, when: 'Today 16:00' },
  { title: 'Practice guided examples', mins: 10, when: 'Today 17:00' },
  { title: 'Complete a mastery assessment', mins: 10, when: 'Today 19:00' },
];

/** Approved in Sc6: the teacher moved the mastery assessment to 20:00. The phone shows this. */
export const PATHWAY_INITIAL = PATHWAY_PROPOSED.map((p, i) => (i === 3 ? { ...p, when: 'Today 20:00' } : p));

export const PATHWAY_UPDATED = [
  { title: 'Targeted application practice', mins: 10, when: 'Tomorrow 09:00' },
  { title: 'Advanced exercises', mins: 12, when: 'Tomorrow 15:00' },
  { title: 'Mastery assessment', mins: 10, when: 'Tomorrow 19:00' },
];

export const PLAN_OBJECTIVES = ['Implication', 'Logical equivalence'];
export const PLAN_OBJECTIVES_UPDATED = ['Equivalence laws', 'Application'];

export const EXPECTED_OUTCOME = 'Logical equivalence mastery ≥ 0.75 within 3 sessions';
