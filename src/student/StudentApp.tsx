import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { SC9 } from '../scenario/practice';
import { Overlays } from '../ui/Overlays';
import { studentFrame } from './frame';
import { EvidencePill, StatusBar } from './screens/Chrome';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { ProgressScreen } from './screens/ProgressScreen';

export function StudentApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  const f = studentFrame(scene.id, t);
  return (
    <Stage width={390} height={844} background="#F8FAFC">
      {f.screen === 'lock' && <LockScreen t={t} notification={f.notification} tapAt={scene.id === 9 ? SC9.tap : undefined} />}
      {f.screen === 'plan' && <PlanScreen local={f.local} variant={f.variant} />}
      {f.screen === 'practice' && <PracticeScreen t={f.local} />}
      {f.screen === 'progress' && <ProgressScreen local={f.local} />}
      {f.screen !== 'lock' && <StatusBar />}
      {scene.id === 9 && <EvidencePill t={t} />}
      <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="phone" />
    </Stage>
  );
}
