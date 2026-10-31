import '../fonts';
import { createRoot } from 'react-dom/client';
import { PlaybackProvider } from '../engine/PlaybackProvider';
import { DashboardApp } from './DashboardApp';

createRoot(document.getElementById('root')!).render(
  <PlaybackProvider app="dashboard" fallbackScene={3}>
    <DashboardApp />
  </PlaybackProvider>,
);
