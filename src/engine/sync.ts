import type { PlaybackState } from './playback';

export type AppName = 'dashboard' | 'student';

export type SyncMessage =
  | { kind: 'state'; state: PlaybackState }
  | { kind: 'hello'; app: AppName }
  | { kind: 'heartbeat'; app: AppName; at: number };

/** All windows must share one browser profile and origin for BroadcastChannel to connect them. */
export const CHANNEL_NAME = 'beyond-demo';

export interface Channel {
  post(msg: SyncMessage): void;
  subscribe(fn: (msg: SyncMessage) => void): () => void;
  close(): void;
}

export function openChannel(): Channel {
  const bc = new BroadcastChannel(CHANNEL_NAME);
  return {
    post: (msg) => bc.postMessage(msg),
    subscribe: (fn) => {
      const handler = (e: MessageEvent<SyncMessage>) => fn(e.data);
      bc.addEventListener('message', handler);
      return () => bc.removeEventListener('message', handler);
    },
    close: () => bc.close(),
  };
}
