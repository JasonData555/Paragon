import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paragon: {
          sidebar:          '#0F4A42',
          'accent-primary': '#0F6E56',
          'accent-hover':   '#1D9E75',
          'accent-light':   '#5DCAA5',
          'mint-chip':      '#E1F5EE',
          'surface-primary':'#F5F0E8',
          'surface-card':   '#FFFFFF',
          border:           '#D3D1C7',
          'border-dark':    '#B4B2A9',
          'text-primary':   '#2C2C2A',
          'text-secondary': '#5F5E5A',
          'text-muted':     '#888780',
          danger:           '#DC2626',
          warning:          '#F59E0B',
          success:          '#059669',
        },
      },
      borderRadius: {
        pill: '20px',
        card: '12px',
        sm:   '8px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'stat': ['28px', { lineHeight: '1.2', fontWeight: '500' }],
        'label': ['11px', { lineHeight: '1.4', letterSpacing: '0.06em' }],
      },
      transitionDuration: {
        '150': '150ms',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'scope-bar-fill': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--target-width)' },
        },
      },
      animation: {
        'fade-in-up':    'fade-in-up 200ms ease-out both',
        'skeleton-pulse':'skeleton-pulse 1.5s ease-in-out infinite',
        'scope-bar':     'scope-bar-fill 200ms ease forwards',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
