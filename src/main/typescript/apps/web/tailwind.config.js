/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './main.tsx',
    './aa/**/*.{ts,tsx}',
    './auth/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './ui/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
    './wallet/**/*.{ts,tsx}',
    './web3auth/**/*.{ts,tsx}',
    './polyfills/**/*.{ts,tsx}',
    './generated/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
    },
  },
  plugins: [],
};
