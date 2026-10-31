import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { themeFromSearch, ThemeScope } from '../ui/theme';
import { LivePhone } from './LivePhone';
import { StudentApp } from './StudentApp';

/** `?live` → the booth phone (server state, real taps); otherwise the scripted, Director-synced phone. */
const live = new URLSearchParams(window.location.search).has('live');

createRoot(document.getElementById('root')!).render(
  live ? (
    <ThemeScope theme={themeFromSearch(window.location.search)}>
      <LivePhone />
    </ThemeScope>
  ) : (
    <PlaybackProvider app="student" fallbackScene={1}>
      <StudentApp />
    </PlaybackProvider>
  ),
);
