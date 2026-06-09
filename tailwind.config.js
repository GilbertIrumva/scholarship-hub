/** @type {import('tailwindcss').Config} */
// NOTE: Tailwind v4 reads design tokens from the `@theme { … }` block in
// src/styles/index.css. This config only retains settings that the
// JS-based plugin pipeline still needs (dark-mode strategy, content
// globs, plugins). Do NOT add color/font tokens here — keep the single
// source of truth in CSS to avoid drift.
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  plugins: [],
}

