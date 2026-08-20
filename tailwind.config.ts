import type { Config } from 'tailwindcss';

// สีทั้งหมดมาจาก docs/DESIGN-TOKENS.css — ห้ามคิดสีใหม่เอง
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
        },
        ws: { DEFAULT: 'var(--ws)', 50: 'var(--ws-50)', 700: 'var(--ws-700)' },
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: { DEFAULT: 'var(--line)', 2: 'var(--line-2)' },
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        todo: { DEFAULT: 'var(--s-todo)', bg: 'var(--s-todo-bg)' },
        doing: { DEFAULT: 'var(--s-doing)', bg: 'var(--s-doing-bg)' },
        review: { DEFAULT: 'var(--s-review)', bg: 'var(--s-review-bg)' },
        done: { DEFAULT: 'var(--s-done)', bg: 'var(--s-done-bg)' },
        blocked: { DEFAULT: 'var(--s-blocked)', bg: 'var(--s-blocked-bg)' },
        critical: 'var(--p-critical)',
        high: 'var(--p-high)',
        medium: 'var(--p-medium)',
        low: 'var(--p-low)',
        ok: { DEFAULT: 'var(--ok)', bg: 'var(--ok-bg)' },
        warn: { DEFAULT: 'var(--warn)', bg: 'var(--warn-bg)' },
        danger: { DEFAULT: 'var(--danger)', bg: 'var(--danger-bg)' },
        info: { DEFAULT: 'var(--info)', bg: 'var(--info-bg)' },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        full: 'var(--r-full)',
      },
      boxShadow: { 1: 'var(--sh-1)', 2: 'var(--sh-2)', 3: 'var(--sh-3)' },
      fontFamily: { sans: 'var(--f)', mono: 'var(--fm)' },
    },
  },
  plugins: [],
};
export default config;
