import { useSceneClock } from '../engine/PlaybackProvider';
import { Stage } from '../engine/Stage';
import { FakeCursor } from '../ui/FakeCursor';
import { Overlays } from '../ui/Overlays';
import { ThemeScope } from '../ui/theme';
import { teacherFrame } from './frame';
import { Closing } from './scenes/Closing';
import { HowItWorks } from './scenes/HowItWorks';
import { ProblemScene } from './scenes/ProblemScene';
import { scriptFor } from './script';
import { TeacherScreen } from './TeacherScreen';

const CURSOR_TAIL_MS = 300;

/** Scripted teacher window: every frame is a function of the Director's scene clock. */
export function TeacherApp() {
  const { scene, t, slate, toggles } = useSceneClock();
  let body;
  if (scene.id === 1) body = <ProblemScene t={t} cursor={toggles.cursor} />;
  else if (scene.id === 9) body = <HowItWorks t={t} />;
  else if (scene.id === 10) body = <Closing t={t} />;
  else {
    const { events, cursor } = scriptFor(scene.id);
    const shown = toggles.cursor && cursor.length > 0 && t >= cursor[0].t && t <= cursor[cursor.length - 1].t + CURSOR_TAIL_MS;
    body = (
      <>
        <TeacherScreen frame={teacherFrame(events, t)} />
        <FakeCursor t={t} keys={cursor} visible={shown} />
      </>
    );
  }
  return (
    <ThemeScope theme={toggles.sage ? 'sage' : 'classic'}>
      <Stage width={1920} height={1080} background="#F2EDE4">
        {body}
        <Overlays scene={scene} t={t} slate={slate} toggles={toggles} variant="teacher" />
      </Stage>
    </ThemeScope>
  );
}
