import { createContext, useContext, type ReactNode } from 'react';

/** classic = eggshell + orange, asterisk mark; sage = eggshell + VNU sage, leaf-book mark. Values live in styles.css. */
export type Theme = 'classic' | 'sage';

export type EggToken = 'bg' | 'paper' | 'card' | 'line' | 'ink' | 'mute' | 'faint' | 'accent' | 'accent-ink' | 'tint';

/** An egg colour for inline styles and SVG, following the active theme. */
export const egg = (token: EggToken, alpha?: number) => (alpha === undefined ? `rgb(var(--egg-${token}))` : `rgb(var(--egg-${token}) / ${alpha})`);

const ThemeContext = createContext<Theme>('classic');

export const useTheme = () => useContext(ThemeContext);

export const themeFromSearch = (search: string): Theme => (new URLSearchParams(search).get('theme') === 'sage' ? 'sage' : 'classic');

/** Scopes the CSS variables and the React theme to its subtree. */
export function ThemeScope({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <ThemeContext.Provider value={theme}>
      <div data-theme={theme} style={{ display: 'contents' }}>{children}</div>
    </ThemeContext.Provider>
  );
}
