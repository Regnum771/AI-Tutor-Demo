import { buildRoster, classEvidence } from '../scenario/roster';
import { START_DAY } from '../scenario/course';
import { STORY_START } from './clock';
import { emptyHistory } from './history';
import type { DemoState, PhoneState } from './types';

export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, sheet: [],
  done: [], lastDone: null, updated: false, studentId: null, morning: false, self: null,
};

/** The demo as a visitor first sees it: 15:00, no conversations, no plans, idle phone. */
export function seedState(epoch = 0): DemoState {
  const students = buildRoster();
  return {
    epoch,
    clock: STORY_START,
    day: START_DAY,
    students,
    classEvidence: classEvidence(students),
    plans: [],
    conversations: [],
    phone: { ...IDLE_PHONE, sheet: [], done: [] },
    study: {},
    masteryHistory: emptyHistory(),
    busy: false,
  };
}
