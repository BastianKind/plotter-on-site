import type { ReactElement } from 'react';
import type { IconKey } from '../types';

/** Line drawings the pen can write: single strokes, no fills. */
export const DRAWINGS: Record<IconKey, ReactElement> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="5.6" r="2.4" />
      <circle cx="15.4" cy="9" r="2.4" />
      <circle cx="12" cy="12.4" r="2.4" />
      <circle cx="8.6" cy="9" r="2.4" />
      <circle cx="12" cy="9" r="1.4" />
      <path d="M12 14.8V21" />
      <path d="M12 18c2-2 4.5-2 5.5-1-1.5 1.5-3.5 1.7-5.5 1z" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19l8-8" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  mountain: (
    <>
      <path d="M2.5 19.5 9 9.5l4 5.5 2.5-3 6 7.5z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z" />
      <path d="M19 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14a4 4 0 0 0 7 0" />
      <path d="M9 9.5v.5M15 9.5v.5" />
    </>
  ),
  gift: (
    <>
      <path d="M4.5 10.5h15v9h-15z" />
      <path d="M3.5 7.5h17v3h-17z" />
      <path d="M12 7.5v12" />
      <path d="M12 7.5C10.5 4.5 7 4.5 7.5 7c.3 1 4.5.5 4.5.5zM12 7.5c1.5-3 5-3 4.5-.5-.3 1-4.5.5-4.5.5z" />
    </>
  ),
  cake: (
    <>
      <path d="M5 12h14v8H5z" />
      <path d="M5 16c2 1.5 4.5 1.5 7 0s5-1.5 7 0" />
      <path d="M12 12V8.5" />
      <path d="M12 5.2c.9.9.9 1.8 0 2.6-.9-.8-.9-1.7 0-2.6z" />
    </>
  ),
  cup: (
    <>
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M9 3.5c-.7 1 .7 2 0 3M12.5 3.5c-.7 1 .7 2 0 3" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
};

export function PaperIcon({ icon, color }: { icon: IconKey; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={color ? { color } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      {DRAWINGS[icon]}
    </svg>
  );
}
