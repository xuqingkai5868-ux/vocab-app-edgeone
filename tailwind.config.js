/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          800: '#312e81',
          900: '#1e1b4b',
        },
        success: {
          50: '#ecfdf5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          50: '#fffbeb',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
    },
  },
  plugins: [],
};
