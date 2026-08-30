/**
 * Card.jsx — SkipFlow UI-kit
 *
 * Gedeelde kaart-container: witte achtergrond, rand, radius, lichte schaduw.
 */

import React from 'react';
import { color, radius, shadow } from '../../theme';

export default function Card({ padding = '1.4rem', style, children, ...props }) {
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        boxShadow: shadow.sm,
        padding,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
