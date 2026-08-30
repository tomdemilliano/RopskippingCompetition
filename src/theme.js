/**
 * theme.js — SkipFlow
 *
 * Centrale design tokens. Componenten blijven inline stijlobjecten gebruiken
 * (CLAUDE.md — geen Tailwind, geen CSS modules) maar bouwen ze op uit deze
 * tokens i.p.v. losse hexcodes te herhalen in elk bestand.
 *
 * Merkkleuren (CLAUDE.md, niet wijzigen zonder overleg):
 *   lichtblauw #2563eb · groen #10b981 · rood #ef4444
 *   grijs #94a3b8 / #64748b · donker scherm #0f172a
 */

export const color = {
  // Merk
  primary:        '#2563eb',
  primaryDark:    '#1d4ed8',
  primarySoft:    '#eff6ff',
  primaryBorder:  '#bfdbfe',

  success:        '#10b981',
  successDark:    '#059669',
  successSoft:    '#ecfdf5',
  successBorder:  '#a7f3d0',

  danger:         '#ef4444',
  dangerDark:     '#dc2626',
  dangerSoft:     '#fef2f2',
  dangerBorder:   '#fecaca',

  warning:        '#f59e0b',
  warningSoft:    '#fffbeb',
  warningBorder:  '#fde68a',

  info:           '#38bdf8',
  infoSoft:       '#f0f9ff',
  infoBorder:     '#bae6fd',

  // Neutralen
  ink:            '#0f172a',
  inkSoft:        '#1e293b',
  slate:          '#334155',
  body:           '#475569',
  muted:          '#64748b',
  faint:          '#94a3b8',
  faintest:       '#cbd5e1',
  border:         '#e2e8f0',
  borderSoft:     '#f1f5f9',
  surface:        '#ffffff',
  surfaceAlt:     '#f8fafc',
  bg:             '#f1f5f9',

  // Donker scherm (Display / Podium / Login)
  stage:          '#0f172a',
  stageAlt:       '#1e293b',
  stageCard:      'rgba(30,41,59,0.55)',
  stageBorder:    'rgba(255,255,255,0.08)',
  stageInk:       '#f1f5f9',
  stageMuted:     '#94a3b8',
};

export const radius = {
  sm:   '6px',
  md:   '10px',
  lg:   '14px',
  xl:   '20px',
  pill: '999px',
};

export const shadow = {
  sm: '0 1px 2px rgba(15,23,42,0.05)',
  md: '0 6px 16px -4px rgba(15,23,42,0.12)',
  lg: '0 16px 40px -8px rgba(15,23,42,0.18)',
  focus: (c) => `0 0 0 3px ${c}33`,
};

export const font = {
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace",
};

export const space = {
  xs: '0.4rem',
  sm: '0.75rem',
  md: '1.25rem',
  lg: '2rem',
  xl: '3rem',
};

/** Statuskleur per wedstrijdstatus — hergebruikt op meerdere schermen. */
export const statusColor = {
  open:       color.primary,
  bezig:      color.danger,
  'beëindigd': color.faint,
};
