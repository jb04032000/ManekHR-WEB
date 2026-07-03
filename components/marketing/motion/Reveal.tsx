'use client';

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react';

/**
 * Scroll reveal: a gentle fade + rise as the element enters the viewport.
 * Progressive enhancement — the element renders VISIBLE (SSR + no-JS safe);
 * only after mount, and only for elements that start below the fold, does the
 * client hide then reveal it. Above-the-fold content is never hidden (protects
 * the hero / LCP), and reduced-motion users get no movement at all.
 *
 * Cross-module links: pairs with the `.mkt-reveal` rules in globals.css.
 * `delay` staggers siblings via the `--mkt-reveal-delay` custom property.
 * Watch: never wrap the hero's LCP element in this.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reduced motion → stay visible, no transform, no observer.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Already in view at mount (above/at the fold): leave visible (no flash).
    if (el.getBoundingClientRect().top < vh * 0.9) return;

    el.setAttribute('data-mkt-reveal', 'pending');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute('data-mkt-reveal', 'in');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mergedStyle = delay
    ? ({ ...style, '--mkt-reveal-delay': `${delay}ms` } as CSSProperties)
    : style;

  return (
    <Tag ref={ref} className={`mkt-reveal ${className}`.trim()} style={mergedStyle}>
      {children}
    </Tag>
  );
}
