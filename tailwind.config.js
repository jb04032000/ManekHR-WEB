/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  // Heatmap palette classes are computed at runtime via utilisationToClass()
  // in HeatmapGrid.tsx, so Tailwind's content scanner cannot see them.
  // Safelist them explicitly to prevent purge eliminating the cell colours.
  safelist: ['bg-neutral-100', 'bg-gold-100', 'bg-gold-400', 'bg-gold-500', 'bg-gold-700'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
        label: ['var(--font-label)', 'system-ui', 'sans-serif'],
        // Marketing-site type system (public pages only).
        'mkt-display': ['var(--font-mkt-display)', 'Iowan Old Style', 'Georgia', 'serif'],
        'mkt-body': ['var(--font-mkt-body)', '-apple-system', 'system-ui', 'sans-serif'],
        'mkt-mono': ['var(--font-mkt-mono)', 'ui-monospace', 'Menlo', 'monospace'],
      },
      // ManekHR brand palette - overrides Tailwind defaults so utility
      // classes like `bg-indigo-600`, `text-gold-500`, `bg-cream` resolve
      // to brand hex. Keep in sync with `app/globals.css :root`.
      // NOTE: the `indigo` KEY name is retained (hundreds of `bg-indigo-*`
      // class usages); only the hex VALUES were rebranded navy -> emerald.
      colors: {
        cream: '#FAF8F3',
        charcoal: '#1A1A1A',
        indigo: {
          50: '#E7F2EE',
          100: '#D5DCEF',
          200: '#ABB9DF',
          400: '#5468A5',
          600: '#0B6E4F',
          700: '#095C42',
          800: '#0E1844',
        },
        gold: {
          100: '#F6EBC4',
          400: '#DDB94A',
          500: '#C9A227',
          700: '#8C7019',
        },
        neutral: {
          0: '#FFFFFF',
          50: '#FAF8F3',
          100: '#F2EEE6',
          200: '#E5DFD3',
          300: '#C9C2B3',
          400: '#94908A',
          500: '#6B6862',
          600: '#4A4844',
          700: '#2E2D2A',
          900: '#1A1A1A',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',
          700: '#047857',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',
          700: '#B45309',
        },
        danger: {
          50: '#FEF2F2',
          500: '#EF4444',
          700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF',
          500: '#3B82F6',
          700: '#1D4ED8',
        },
      },
    },
  },
  plugins: [],
};
