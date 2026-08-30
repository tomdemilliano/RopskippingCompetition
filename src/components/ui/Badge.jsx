/**
 * Badge.jsx — SkipFlow UI-kit
 *
 * Kleine statuspil — voor "LIVE", "VOLTOOID", rechten-indicators, enz.
 */

import React from 'react';
import { color, radius } from '../../theme';

const TONES = {
  primary: { background: color.primarySoft, color: color.primaryDark, border: color.primaryBorder },
  success: { background: color.successSoft, color: color.successDark, border: color.successBorder },
  danger:  { background: color.dangerSoft,  color: color.dangerDark,  border: color.dangerBorder },
  warning: { background: color.warningSoft, color: '#92400e',         border: color.warningBorder },
  neutral: { background: color.borderSoft,  color: color.muted,       border: color.border },
  solidDanger: { background: color.danger, color: '#fff', border: 'transparent' },
};

export default function Badge({ tone = 'neutral', icon = null, style, children }) {
  const t = TONES[tone] ?? TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.68rem',
        fontWeight: 800,
        letterSpacing: '0.03em',
        padding: '0.25em 0.65em',
        borderRadius: radius.pill,
        background: t.background,
        color: t.color,
        border: `1px solid ${t.border}`,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
}
