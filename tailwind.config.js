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
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
