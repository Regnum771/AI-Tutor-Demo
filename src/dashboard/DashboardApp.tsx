import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { Overlays } from '../ui/Overlays';
import { C } from '../ui/tokens';
import { SCENE_VIEWS } from './scenes';

export function DashboardApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  const View = SCENE_VIEWS[scene.id];
  return (
    <Stage width={1920} height={1080} background={C.deep}>
      {View ? (
        <View t={t} cursor={toggles.cursor} />
      ) : (
        <div className="flex h-full items-center justify-center font-display text-[40px] text-dim">Scene {scene.id} · {scene.label}</div>
      )}
      <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="dashboard" />
    </Stage>
  );
}
