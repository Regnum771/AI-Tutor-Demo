import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { StudentApp } from './StudentApp';

createRoot(document.getElementById('root')!).render(
  <PlaybackProvider app="student" fallbackScene={1}>
    <StudentApp />
  </PlaybackProvider>,
);
