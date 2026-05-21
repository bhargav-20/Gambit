/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '400px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0d12',
          raised: '#13161d',
          subtle: '#1a1e27',
          panel: 'rgba(20, 24, 33, 0.72)',
        },
        edge: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          strong: 'rgba(255,255,255,0.12)',
        },
        ink: {
          DEFAULT: '#e7e9ee',
          muted: '#9aa1b1',
          faint: '#5d6577',
        },
        accent: {
          DEFAULT: '#e9b465',
          soft: '#f6d29a',
          deep: '#b88646',
        },
        good: '#7bd389',
        bad: '#ef6f6f',
        warn: '#e9b465',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 30px -12px rgba(0,0,0,0.6)',
        ring: '0 0 0 1px rgba(255,255,255,0.06)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
