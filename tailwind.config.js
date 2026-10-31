/** Egg and side tokens are RGB channel variables so opacity modifiers (bg-egg-card/60) keep working. */
const v = (name, group = 'egg') => `rgb(var(--${group}-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
// Keep the dark hex values identical to src/ui/tokens.ts.
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#070E1F', panel: '#0D1A33', surface: '#13244A', line: '#22355E',
        ink: '#F4F7FF', dim: '#9AA8C7',
        cyan: '#22D3EE', royal: '#3B6CF6', twin: '#A78BFA', sas: '#60A5FA', tas: '#34D399',
        gold: '#F5B942', gap: '#F87171', mastered: '#4ADE80',
        // Teacher chat and phone (light editorial theme). Values per theme live in src/styles.css.
        egg: {
          bg: v('bg'), paper: v('paper'), card: v('card'), line: v('line'), ink: v('ink'),
          mute: v('mute'), faint: v('faint'), tint: v('tint'),
          // accent fills, rings, dots and bars; accent-ink is accent used as text on paper
          accent: { DEFAULT: v('accent'), ink: v('accent-ink') },
          // Risk / status labels: fixed, they keep their colour in every theme
          risk: { DEFAULT: '#FF5B1F', tint: '#FFE5D6' },
          // Phone answer states only (right / wrong, done ticks)
          sage: { DEFAULT: v('sage'), tint: v('sage-tint') },
          brick: { DEFAULT: v('brick'), tint: v('brick-tint') },
        },
        // Teacher sidebar (deep sage panel in the sage theme)
        side: {
          bg: v('bg', 'side'), ink: v('ink', 'side'), mute: v('mute', 'side'), mark: v('mark', 'side'),
          hi: v('hi', 'side'), ring: v('ring', 'side'), edge: v('edge', 'side'),
          card: v('card', 'side'), chip: v('chip', 'side'), line: v('line', 'side'),
          cta: { DEFAULT: v('cta', 'side'), ink: v('cta-ink', 'side') },
        },
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
