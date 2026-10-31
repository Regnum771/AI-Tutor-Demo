import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { themeFromSearch, ThemeScope } from '../ui/theme';
import { LiveTeacher } from './LiveTeacher';
import { TeacherApp } from './TeacherApp';

/** `?scene=N` → scripted (Director-synced, recordable); no scene → the live clickable draft (`?theme=sage` for the sage accents). */
const scripted = new URLSearchParams(window.location.search).has('scene');

createRoot(document.getElementById('root')!).render(
  scripted ? (
    <PlaybackProvider app="teacher" fallbackScene={1}>
      <TeacherApp />
    </PlaybackProvider>
  ) : (
    <ThemeScope theme={themeFromSearch(window.location.search)}>
      <LiveTeacher />
    </ThemeScope>
  ),
);
