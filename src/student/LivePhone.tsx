import { useRef, useState } from 'react';
import { Stage } from '../engine/Stage';
import { useNow } from '../engine/useNow';
import { fmt } from '../live/clock';
import { useServerSource, type DemoSource } from '../live/source';
import { fullDate } from '../scenario/course';
import type { StudyTab } from '../live/study/reducer';
import type { TodayRow } from '../live/study/today';
import { notificationCopy, planView, progressView, reviewView } from './liveView';
import { StatusBar } from './screens/Chrome';
import { LivePractice } from './screens/LivePractice';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { CardsScreen, CheckInScreen, PickScreen, PractiseScreen, SemesterScreen, SetupScreen, TabBar, TodayScreen } from './screens/StudyScreens';
import { cardsView, morningCopy, pickList, practiseView, semesterView, todayView } from './studyView';

const IDLE_COPY = { title: 'Welcome to Beyond', body: 'Tap to choose your student.' };
const TAB_SCREENS: readonly string[] = ['today', 'choosePractice', 'cards', 'semester'];

export function LivePhone() {
  return <LivePhoneView source={useServerSource()} />;
}

/** The booth phone: PhoneState from the server, every tap posted back. */
export function LivePhoneView({ source }: { source: DemoSource }) {
  const [t0] = useState(() => Date.now());
  const now = useNow() - t0;
  const firstSeen = useRef(new Map<string, number>());
  const inFlight = useRef(false);
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
  const key = ph.screen === 'progress' ? `${state.epoch}:progress:${ph.lastDone}` : `${state.epoch}:${ph.screen}:${ph.planId}:${ph.session}:${ph.item}`;
  if (!firstSeen.current.has(key)) firstSeen.current.set(key, now);
  const local = now - firstSeen.current.get(key)!;
  const clock = fmt(state.clock);
  const plan = planView(state);
  const progress = progressView(state);
  const morning = morningCopy(state);
  const message = morning ?? notificationCopy(state) ?? (ph.studentId ? null : IDLE_COPY);
  // One tap, one request: a repeat while the reply is pending is ignored.
  const send = (path: string, body?: unknown) => {
    if (inFlight.current) return;
    inFlight.current = true;
    void (async () => {
      try {
        await post(path, body);
      } catch {
        // a failed post leaves the phone as it was
      } finally {
        inFlight.current = false;
      }
    })();
  };
  const tapLock = () => {
    if (morning) send('study/tab', { tab: 'today' });
    else if (ph.planId) send('phone/plan');
    else send('study/open');
  };
  const tab = (t: StudyTab) => send('study/tab', { tab: t });
  const openRow = (row: TodayRow) => {
    if (row.kind === 'plan') send('phone/open', { sessionIndex: row.index });
    else if (row.kind === 'cards') tab('cards');
    else send('study/practice', { clo: null });
  };
  const today = ph.screen === 'today' ? todayView(state) : null;
  const semester = ph.screen === 'semester' ? semesterView(state) : null;
  const cards = ph.screen === 'cards' ? cardsView(state) : null;
  return (
    <Stage width={390} height={844} background="#F2EDE4">
      {ph.screen === 'lock' && (
        <LockScreen t={local} clock={clock} date={fullDate(state.day)} notification={message ? Math.min(1, Math.max(0.01, local / 500)) : 0} message={message ?? undefined} onTap={message ? tapLock : undefined} />
      )}
      {ph.screen === 'plan' && plan && (
        <PlanScreen local={local} variant={ph.updated ? 'updated' : 'initial'} clock={clock} live={plan} onOpen={(i) => send('phone/open', { sessionIndex: i })} onSkip={() => send('phone/skip')} />
      )}
      {ph.screen === 'practice' && (
        <LivePractice
          key={`${ph.session}:${ph.item}`}
          state={state}
          onAnswer={(o) => send('phone/answer', { option: o })}
          onNext={() => send('phone/next')}
          onGoto={(item) => send('phone/goto', { item })}
          onAgain={() => send('phone/again')}
          onFinish={() => send('phone/finish')}
        />
      )}
      {ph.screen === 'review' && <ReviewScreen view={reviewView(state)} onContinue={() => send('phone/continue')} />}
      {ph.screen === 'progress' && progress && <ProgressScreen local={local} live={progress} onBack={() => send('phone/plan')} />}
      {ph.screen === 'pick' && <PickScreen students={pickList(state)} onPick={(id) => send('study/pick', { studentId: id })} />}
      {ph.screen === 'setup' && <SetupScreen onSave={(weekday, weekend) => send('study/setup', { weekday, weekend })} />}
      {today && <TodayScreen view={today} onRow={openRow} onNextDay={() => send('study/check-in')} onNextWeek={() => send('study/next-week')} />}
      {ph.screen === 'choosePractice' && <PractiseScreen rows={practiseView(state)} onStart={(clo) => send('study/practice', { clo })} />}
      {cards && <CardsScreen key={cards.card?.id ?? 'none'} card={cards.card} left={cards.left} onRate={(rating) => send('study/rate', { cardId: cards.card!.id, rating })} />}
      {semester && <SemesterScreen view={semester} />}
      {ph.screen === 'checkIn' && <CheckInScreen onAnswer={(check) => send('study/next-day', { check })} onBack={() => tab('today')} />}
      {TAB_SCREENS.includes(ph.screen) && <TabBar active={ph.screen as StudyTab} onTab={tab} />}
      {(ph.screen === 'plan' || ph.screen === 'progress') && ph.studentId && (
        <button type="button" onClick={() => tab('today')} className="absolute right-5 text-[13.5px] font-semibold text-egg-mute underline underline-offset-4" style={{ top: 58, zIndex: 31 }}>
          Today
        </button>
      )}
      {ph.screen !== 'lock' && (
        <>
          <div className="absolute inset-x-0 top-0 bg-egg-bg" style={{ height: 44, zIndex: 29 }} />
          <StatusBar clock={clock} />
        </>
      )}
    </Stage>
  );
}
