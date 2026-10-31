import '../fonts';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import { createRoot } from 'react-dom/client';
import { LiveTeacher } from './LiveTeacher';

createRoot(document.getElementById('root')!).render(<LiveTeacher />);
