import { createContext, useContext } from 'react';
import type { DemoState, LivePanel } from './types';

export interface LiveCtx {
  state: DemoState;
  /** The conversation open in the chat, or null for a new one. */
  activeId: string | null;
  post(path: string, body?: unknown): Promise<unknown>;
  openConversation(id: string): void;
  showPanel(panel: LivePanel | null): void;
  /** Opens a student's profile pop-up, at an evidence entry when one is given. Local to this window. */
  openProfile(studentId: string, entryId?: string | null): void;
  /** The student whose profile pop-up is open, if any. */
  profileId?: string | null;
  toast(text: string): void;
}

const Ctx = createContext<LiveCtx | null>(null);

export const LiveProvider = Ctx.Provider;

/** Live data and actions; null in scripted (recorded) mode, where components keep the scripted constants. */
export const useLive = (): LiveCtx | null => useContext(Ctx);

export const DEMO_ONLY = 'Not part of this demo';
