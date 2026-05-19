/**
 * NativeWind v4 / Tailwind 3 config — mirrors tokens from
 * `packages/ui/src/styles.css` (the web/desktop Tailwind v4 `@theme`).
 *
 * Why a separate Tailwind 3 config:
 *   NativeWind v4 does NOT yet support Tailwind v4. Web/desktop use Tailwind v4
 *   with CSS `@theme`; mobile uses Tailwind 3 with this JS config. Token values
 *   must stay in sync — see `packages/ui/src/styles.css`.
 *
 * Dark mode = `media` (follows system `prefers-color-scheme`), matching the
 * `@media (prefers-color-scheme: dark)` block in `styles.css`.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // labels
        label: { DEFAULT: '#1D1D1F', dark: '#F2F2F2' },
        'label-secondary': { DEFAULT: '#6E6E73', dark: '#A1A1A6' },
        'label-tertiary': { DEFAULT: '#A1A1A6', dark: '#6E6E73' },
        'label-quaternary': { DEFAULT: '#C7C7CC', dark: '#48484A' },
        separator: { DEFAULT: '#0000001A', dark: '#FFFFFF14' },

        // layered backgrounds
        'bg-l1': { DEFAULT: '#F5F5F4', dark: '#2C2C2E' },
        'bg-l2': { DEFAULT: '#FAFAFA', dark: '#1C1C1E' },
        'bg-l3': { DEFAULT: '#E8E8E6', dark: '#3A3A3C' },

        'row-selected': { DEFAULT: '#007AFF', dark: '#0A84FF' },

        // tint + semantic palette
        tint: { DEFAULT: '#007AFF', dark: '#0A84FF' },
        blue: '#3478F6',
        red: '#E03E3E',
        orange: '#FF9F0A',
        yellow: '#F5C518',
        green: '#3FA34D',
        teal: '#3CB6B0',
        indigo: { DEFAULT: '#5856D6', dark: '#5E5CE6' },
        purple: { DEFAULT: '#AF52DE', dark: '#BF5AF2' },
        pink: { DEFAULT: '#FF2D55', dark: '#FF375F' },
        tan: '#C7A06A',
        gray: { DEFAULT: '#8E8E93', dark: '#98989D' },
      },
      fontSize: {
        // [size, lineHeight] — matches web/desktop ramp.
        caption: ['11px', '14px'],
        caption1: ['11px', '14px'],
        footnote: ['12px', '16px'],
        body: ['13px', '17px'],
        callout: ['14px', '18px'],
        headline: ['15px', '20px'],
        title: ['22px', '26px'],
      },
      borderRadius: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '22px',
      },
      fontFamily: {
        // SF Pro stack — RN falls back via system font.
        sans: ['System'],
        mono: ['Menlo'],
      },
    },
  },
  plugins: [],
};
