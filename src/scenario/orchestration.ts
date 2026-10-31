export const ENGINE_INPUTS = [
  'SAS student diagnosis', 'TAS instructional strategy', 'Digital twin context',
  'Knowledge graph relations', 'Available learning resources', 'Teacher-defined policies',
];

export const OPERATIONS = [
  { id: 'coordinate', title: 'Adaptive decision coordination', detail: 'Joint decision within teacher policy · adaptive track · auto-execute' },
  { id: 'retrieve', title: 'Resource retrieval', detail: '4 resources retrieved from the course knowledge base' },
  { id: 'assemble', title: 'Activity generation & assembly', detail: '5 activities assembled for the selected strategy' },
  { id: 'pathway', title: 'Pathway construction', detail: 'Ordered by prerequisite dependencies' },
  { id: 'deliver', title: 'Service coordination', detail: 'Scheduled and delivered to the student app' },
  { id: 'monitor', title: 'Execution monitoring', detail: 'Tracking against mastery criteria' },
];

export const STATUSES = ['DECISION READY', 'RESOURCES RETRIEVED', 'PATHWAY CREATED', 'SCHEDULED', 'DELIVERED', 'MONITORING'] as const;

export const RETRIEVED = ['implication-visual', 'worked-examples', 'guided-set', 'mastery-check'];

export const ACTIVITIES = [
  'Visual explanation of logical operators', 'Worked examples', 'Guided exercises', 'Application problems', 'Mastery assessment',
];

export const PATHWAY_INITIAL = [
  { title: 'Review logical operators', mins: 5, when: 'Today 09:00' },
  { title: 'Explore visual explanations', mins: 8, when: 'Today 12:30' },
  { title: 'Practice guided examples', mins: 10, when: 'Today 15:00' },
  { title: 'Complete a mastery assessment', mins: 10, when: 'Today 19:00' },
];

export const PATHWAY_UPDATED = [
  { title: 'Targeted application practice', mins: 10, when: 'Tomorrow 09:00' },
  { title: 'Advanced exercises', mins: 12, when: 'Tomorrow 15:00' },
  { title: 'Mastery assessment', mins: 10, when: 'Tomorrow 19:00' },
];

export const PLAN_OBJECTIVES = ['Implication', 'Logical equivalence'];
export const PLAN_OBJECTIVES_UPDATED = ['Equivalence laws', 'Application'];

export const EXPECTED_OUTCOME = 'Logical equivalence mastery ≥ 0.75 within 3 sessions';
export const MONITORING_CRITERIA = ['Mastery check score', 'Hint usage per item', 'Activity completion', 'Response time on implication items'];
