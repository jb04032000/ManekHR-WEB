'use client';

/**
 * WhatsAppIcon - official WhatsApp brand glyph as an inline SVG.
 *
 * Lucide / FontAwesome-free are open-icon libraries don't ship brand marks
 * (trademark constraint), so we render the path directly. Caller controls
 * size + color via the `size` prop + the parent's `color` (the SVG uses
 * `currentColor` so it inherits cleanly inside coloured buttons / chips).
 *
 * The mark is publicly documented; use it only for legitimate WhatsApp
 * affordances (preferred-contact pills, share-on-WhatsApp menu items).
 */

interface WhatsAppIconProps {
  size?: number;
  className?: string;
  ariaLabel?: string;
}

export default function WhatsAppIcon({ size = 16, className, ariaLabel }: WhatsAppIconProps) {
  const titled = !!ariaLabel;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      role={titled ? 'img' : undefined}
      aria-hidden={titled ? undefined : true}
      aria-label={ariaLabel}
    >
      {titled && <title>{ariaLabel}</title>}
      <path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zM12.04 20.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48a.91.91 0 0 0-.66.31c-.23.25-.86.84-.86 2.06 0 1.21.88 2.38 1 2.54.12.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}
