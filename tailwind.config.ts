import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg:    '#030503',
          panel: '#0c0e09',
          felt:  '#0a2010',
          edge:  '#2d1f12',
        },
        gold:    '#c9a84c',
        crimson: '#9b1c1c',
        card:    '#f5f0e8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'card-flip':  'card-flip 0.6s ease-in-out',
        'chip-toss':  'chip-toss 0.5s ease-out',
        'blink':      'blink 1s step-end infinite',
        'deal':       'deal 0.4s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%,100%': { boxShadow: '0 0 20px rgba(201,168,76,0.1)' },
          '50%':      { boxShadow: '0 0 60px rgba(201,168,76,0.3)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        'card-flip': {
          '0%':   { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        'chip-toss': {
          '0%':   { transform: 'translateY(0) scale(1)' },
          '50%':  { transform: 'translateY(-20px) scale(1.1)' },
          '100%': { transform: 'translateY(0) scale(1)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        deal: {
          '0%':   { transform: 'translateX(-100px) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
