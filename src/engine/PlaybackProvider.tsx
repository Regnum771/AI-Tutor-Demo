import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSlate, localTime, stateFromSearch, type PlaybackState, type Toggles } from './playback';
import { openChannel, type AppName } from './sync';
import { useNow } from './useNow';
import { sceneById, type SceneDef } from '../scenario/scenes';

export interface Clock {
  scene: SceneDef;
  t: number;
  slate: boolean;
  toggles: Toggles;
}

const ClockContext = createContext<Clock | null>(null);

/** Starts from the URL (standalone mode); any controller state broadcast overrides it. */
export function PlaybackProvider({ app, fallbackScene, children }: { app: AppName; fallbackScene: number; children: ReactNode }) {
  const [state, setState] = useState<PlaybackState>(() => stateFromSearch(window.location.search, Date.now(), fallbackScene));

  useEffect(() => {
    const ch = openChannel();
    const off = ch.subscribe((m) => {
      if (m.kind === 'state') setState(m.state);
    });
    ch.post({ kind: 'hello', app });
    const hb = window.setInterval(() => ch.post({ kind: 'heartbeat', app, at: Date.now() }), 1000);
    return () => {
      off();
      window.clearInterval(hb);
      ch.close();
    };
  }, [app]);

  const now = useNow();
  const scene = sceneById(state.scene);
  const clock: Clock = { scene, t: localTime(state, now, scene.durationMs), slate: isSlate(state, now), toggles: state.toggles };
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useSceneClock(): Clock {
  const c = useContext(ClockContext);
  if (!c) throw new Error('useSceneClock must be used inside PlaybackProvider');
  return c;
}
