/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16a34a',
          dark: '#166534',
          light: '#22c55e',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          foreground: '#0f172a',
        },
        background: '#f8fafc',
        surface: '#ffffff',
        ink: '#0f172a',
        muted: '#64748b',
        border: '#e2e8f0',
        danger: '#dc2626',
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        nav: '0 8px 30px -22px rgba(15, 23, 42, 0.35)',
        modal: '0 20px 60px -15px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [],
}
