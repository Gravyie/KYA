/**
 * Inline SVG icons. No icon library: a dependency-free set keeps the bundle
 * small and removes a network request from the demo path. All icons inherit
 * currentColor and share a 1.6 stroke weight so they sit at the same optical
 * weight as the type.
 */
import React from 'react';

const S = ({children, size = 14, fill = 'none', ...rest}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill={fill}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconSearch = (p) => (
  <S {...p}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2 13.5 13.5" />
  </S>
);

export const IconCheck = (p) => (
  <S {...p}>
    <path d="M3 8.4 6.2 11.5 13 4.5" />
  </S>
);

export const IconX = (p) => (
  <S {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </S>
);

export const IconWarn = (p) => (
  <S {...p}>
    <path d="M8 2.6 14.4 13.4H1.6z" />
    <path d="M8 6.6v3M8 11.4v.01" />
  </S>
);

export const IconPassport = (p) => (
  <S {...p}>
    <rect x="3" y="1.8" width="10" height="12.4" rx="1.6" />
    <circle cx="8" cy="6.4" r="1.9" />
    <path d="M5.6 11.2h4.8" />
  </S>
);

export const IconScales = (p) => (
  <S {...p}>
    <path d="M8 2v12M4 5h8M2.4 5l-1.4 3.6h2.8zM12 5l-1.4 3.6h2.8z" />
    <path d="M5.5 14h5" />
  </S>
);

export const IconRoute = (p) => (
  <S {...p}>
    <circle cx="3.6" cy="3.6" r="1.9" />
    <circle cx="12.4" cy="12.4" r="1.9" />
    <path d="M3.6 5.5v3.2a2 2 0 0 0 2 2h4.9" />
  </S>
);

export const IconLayers = (p) => (
  <S {...p}>
    <path d="M8 1.8 14.4 5 8 8.2 1.6 5z" />
    <path d="M1.6 8.6 8 11.8l6.4-3.2" />
    <path d="M1.6 11.6 8 14.8l6.4-3.2" />
  </S>
);

export const IconPlus = (p) => (
  <S {...p}>
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </S>
);

export const IconBolt = (p) => (
  <S {...p}>
    <path d="M9 1.6 3.4 9.2h3.4l-.8 5.2 5.6-7.6H8.2z" />
  </S>
);

export const IconSpinner = (p) => (
  <S {...p}>
    <path d="M8 1.8a6.2 6.2 0 1 1-4.4 1.8" />
  </S>
);

export const IconLink = (p) => (
  <S {...p}>
    <path d="M6.6 9.4 9.4 6.6" />
    <path d="M7.2 4.4 8.6 3a2.9 2.9 0 0 1 4.1 4.1l-1.4 1.4" />
    <path d="M8.8 11.6 7.4 13a2.9 2.9 0 0 1-4.1-4.1l1.4-1.4" />
  </S>
);

export const IconShield = (p) => (
  <S {...p}>
    <path d="M8 1.8 13.2 3.6v4.2c0 3-2.2 5.4-5.2 6.4-3-1-5.2-3.4-5.2-6.4V3.6z" />
    <path d="M5.9 8 7.5 9.6 10.4 6.4" />
  </S>
);

export const IconGlobe = (p) => (
  <S {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M1.8 8h12.4" />
    <path d="M8 1.8c1.7 1.8 2.6 3.9 2.6 6.2S9.7 12.4 8 14.2C6.3 12.4 5.4 10.3 5.4 8S6.3 3.6 8 1.8z" />
  </S>
);

export const IconChip = (p) => (
  <S {...p}>
    <rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.2" />
    <path d="M6.6 1.8v2.6M9.4 1.8v2.6M6.6 11.6v2.6M9.4 11.6v2.6M1.8 6.6h2.6M1.8 9.4h2.6M11.6 6.6h2.6M11.6 9.4h2.6" />
  </S>
);

export const IconArrowRight = (p) => (
  <S {...p}>
    <path d="M2.8 8h10.4M9.4 4.4 13.2 8l-3.8 3.6" />
  </S>
);

export const IconLock = (p) => (
  <S {...p}>
    <rect x="3.2" y="7" width="9.6" height="7" rx="1.5" />
    <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
  </S>
);
