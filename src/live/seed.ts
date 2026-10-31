import { buildRoster, classEvidence } from '../scenario/roster';
import { STORY_START } from './clock';
import type { DemoState, PhoneState } from './types';

export const IDLE_PHONE: PhoneState = {
  planId: null, screen: 'lock', session: null, item: 0, hinted: false, result: null, lastOption: null,
  done: [], before: null, lastDone: null, updated: false,
};

/** The demo as a visitor first sees it: 15:00, no conversations, no plans, idle phone. */
export function seedState(epoch = 0): DemoState {
  const students = buildRoster();
  return {
    epoch,
    clock: STORY_START,
    students,
    classEvidence: classEvidence(students),
    plans: [],
    conversations: [],
    phone: { ...IDLE_PHONE, done: [] },
    busy: false,
  };
}
