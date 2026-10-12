/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Heebo Variable"', 'Heebo', 'Arial', 'sans-serif'],
      },
      // Softer corners across the whole interface (one step rounder than the defaults).
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [],
};
