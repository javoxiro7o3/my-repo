/** @type {import('tailwindcss').Config} */
const c = (v) => `hsl(var(--${v}) / <alpha-value>)`
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        bg: c('bg'), panel: c('panel'), elev: c('elev'), border: c('border'),
        fg: c('fg'), muted: c('muted'), faint: c('faint'),
        accent: c('accent'), 'accent-fg': c('accent-fg'),
        ok: c('ok'), warn: c('warn'), bad: c('bad'), info: c('info')
      },
      borderRadius: { xl: '14px', lg: '10px', md: '8px' },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow) / .25), 0 8px 24px -8px hsl(var(--shadow) / .35)',
        glow: '0 0 0 1px hsl(var(--accent) / .35), 0 8px 30px -8px hsl(var(--accent) / .45)'
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        blink: { '50%': { opacity: '0' } }
      },
      animation: { shimmer: 'shimmer 1.6s infinite', blink: 'blink 1s step-end infinite' }
    }
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/container-queries')]
}
