import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background:           'var(--background)',
        surface:              'var(--surface)',
        'surface-low':        'var(--surface-low)',
        'surface-container':  'var(--surface-container)',
        'surface-high':       'var(--surface-high)',
        'surface-highest':    'var(--surface-highest)',
        'on-surface':         'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        outline:              'var(--outline)',
        'outline-variant':    'var(--outline-variant)',
        primary:              'var(--primary)',
        'primary-container':  'var(--primary-container)',
        'on-primary':         'var(--on-primary)',
        'on-primary-container': 'var(--on-primary-container)',
        long:                 'var(--long)',
        short:                'var(--short)',
        error:                'var(--error)',
        'error-container':    'var(--error-container)',
      },
      fontFamily: {
        ui:   ['var(--font-ui)', 'sans-serif'],
        data: ['var(--font-data)', 'monospace'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '40px', fontWeight: '600', letterSpacing: '-0.02em' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-md':     ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm':     ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'data-lg':     ['18px', { lineHeight: '24px', fontWeight: '500' }],
        'data-md':     ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'data-sm':     ['11px', { lineHeight: '14px', fontWeight: '400' }],
        'label-caps':  ['10px', { lineHeight: '12px', fontWeight: '700', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        DEFAULT: '0px',
        full: '9999px',
      },
      borderWidth: {
        DEFAULT: '0.5px',
        '1': '1px',
      },
    },
  },
  plugins: [],
}

export default config
