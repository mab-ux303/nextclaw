/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf7ff',
          100: '#d8ecff',
          200: '#b9ddff',
          300: '#8dc8ff',
          400: '#5aa8ff',
          500: '#2f83f7',
          600: '#1f68db',
          700: '#1b53b1',
          800: '#1b468f',
          900: '#1c3d75'
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
