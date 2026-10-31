import '../fonts';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import { createRoot } from 'react-dom/client';
import { ChatApp } from './ChatApp';

createRoot(document.getElementById('root')!).render(<ChatApp />);
