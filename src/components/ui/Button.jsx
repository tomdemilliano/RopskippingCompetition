/**
 * Button.jsx — SkipFlow UI-kit
 *
 * Gedeelde knopstijlen zodat elk scherm dezelfde look gebruikt i.p.v. steeds
 * opnieuw btnPrimary/btnSecondary/... te definiëren. Blijft een gewoon inline
 * stijlobject (CLAUDE.md) — enkel gecentraliseerd in één component.
 */

import React from 'react';
import { color, radius, font } from '../../theme';

const VARIANTS = {
  primary: {
    background: color.primary, color: '#fff', border: '1px solid transparent',
  },
  success: {
    background: color.success, color: '#fff', border: '1px solid transparent',
  },
  danger: {
    background: color.danger, color: '#fff', border: '1px solid transparent',
  },
  secondary: {
    background: color.surface, color: color.body, border: `1px solid ${color.faintest}`,
  },
  ghost: {
    background: 'transparent', color: color.muted, border: '1px solid transparent',
  },
  outlineDanger: {
    background: color.dangerSoft, color: color.dangerDark, border: `1px solid ${color.dangerBorder}`,
  },
};

const SIZES = {
  sm: { padding: '0.4rem 0.75rem', fontSize: '0.78rem', borderRadius: radius.sm, gap: '5px' },
  md: { padding: '0.6rem 1.1rem', fontSize: '0.875rem', borderRadius: radius.md, gap: '7px' },
  lg: { padding: '0.75rem 1.5rem', fontSize: '0.95rem', borderRadius: radius.md, gap: '8px' },
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon = null,
  disabled = false,
  style,
  children,
  ...props
}) {
  const v = VARIANTS[variant] ?? VARIANTS.secondary;
  const sz = SIZES[size] ?? SIZES.md;

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font.body,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'filter 0.12s, transform 0.05s',
        whiteSpace: 'nowrap',
        ...v,
        ...sz,
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
