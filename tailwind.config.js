/** @type {import('tailwindcss').Config} */
// Keep these hex values identical to src/ui/tokens.ts.
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#070E1F', panel: '#0D1A33', surface: '#13244A', line: '#22355E',
        ink: '#F4F7FF', dim: '#9AA8C7',
        cyan: '#22D3EE', royal: '#3B6CF6', twin: '#A78BFA', sas: '#60A5FA', tas: '#34D399',
        gold: '#F5B942', gap: '#F87171', mastered: '#4ADE80',
        // Teacher chat (light editorial theme)
        egg: {
          bg: '#F2EDE4', paper: '#F8F4EC', card: '#FFFDF8', line: '#DCD3C5', ink: '#1A1714',
          mute: '#6B6359', faint: '#9C9285', orange: '#FF5B1F', tint: '#FFE5D6',
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
