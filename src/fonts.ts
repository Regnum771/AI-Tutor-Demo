import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

import './styles.css';

if (typeof document !== 'undefined') {
  for (const face of ['400 16px Inter', '500 16px Inter', '600 16px Inter', '700 16px Inter', '600 16px Manrope', '700 16px Manrope', '800 16px Manrope', '400 16px "JetBrains Mono"', '700 16px "JetBrains Mono"']) {
    void document.fonts.load(face);
  }
}
