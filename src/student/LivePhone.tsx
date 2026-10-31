import { useRef, useState } from 'react';
import { Stage } from '../engine/Stage';
import { useNow } from '../engine/useNow';
import { fmt } from '../live/clock';
import { useServerSource, type DemoSource } from '../live/source';
import { notificationCopy, planView, progressView } from './liveView';
import { StatusBar } from './screens/Chrome';
import { LivePractice } from './screens/LivePractice';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';

export function LivePhone() {
  return <LivePhoneView source={useServerSource()} />;
}

/** The booth phone: PhoneState from the server, every tap posted back. */
export function LivePhoneView({ source }: { source: DemoSource }) {
  const [t0] = useState(() => Date.now());
  const now = useNow() - t0;
  const firstSeen = useRef(new Map<string, number>());
  const { state, post } = source;
  if (!state) {
    return (
      <Stage width={390} height={844} background="#F2EDE4">
        <div className="flex h-full items-center justify-center px-8 text-center font-sans text-[15px] text-egg-mute">Connecting to the booth…</div>
      </Stage>
    );
  }
  const ph = state.phone;
  // Screen entrances animate from when this screen first appeared.
  const key = `${state.epoch}:${ph.screen}:${ph.planId}:${ph.session}:${ph.item}`;
  if (!firstSeen.current.has(key)) firstSeen.current.set(key, now);
  const local = now - firstSeen.current.get(key)!;
  const clock = fmt(state.clock);
  const plan = planView(state);
  const progress = progressView(state);
  const message = notificationCopy(state);
  const send = (path: string, body?: unknown) => void post(path, body);
  return (
    <Stage width={390} height={844} background="#F2EDE4">
      {ph.screen === 'lock' && (
        <LockScreen t={local} clock={clock} notification={message ? Math.min(1, Math.max(0.01, local / 500)) : 0} message={message ?? undefined} onTap={message ? () => send('phone/plan') : undefined} />
      )}
      {ph.screen === 'plan' && plan && (
        <PlanScreen local={local} variant={ph.updated ? 'updated' : 'initial'} clock={clock} live={plan} onOpen={(i) => send('phone/open', { sessionIndex: i })} onSkip={() => send('phone/skip')} />
      )}
      {ph.screen === 'practice' && (
        <LivePractice key={`${ph.session}:${ph.item}`} state={state} onAnswer={(o) => send('phone/answer', { option: o })} onNext={() => send('phone/next')} />
      )}
      {ph.screen === 'progress' && progress && <ProgressScreen local={local} live={progress} onBack={() => send('phone/plan')} />}
      {ph.screen !== 'lock' && <StatusBar clock={clock} />}
    </Stage>
  );
}
