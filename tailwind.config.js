/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0d0d',
        paper: '#f5f2ee',
        cream: '#ede9e2',
        gold: '#b8922a',
        'gold-light': '#d4aa4a',
        rule: '#c8c0b4',
        muted: '#7a7068',
        'hc-red': '#e31e2d',
        'hc-success': '#1a6b3c',
        'hc-blue': '#2a6bb8',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
