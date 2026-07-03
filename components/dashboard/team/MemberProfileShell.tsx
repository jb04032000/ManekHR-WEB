'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  header: ReactNode;
  rail: ReactNode;
  children: ReactNode;
  /**
   * The active section key. Changing it scrolls the content up to just under
   * the sticky header on mobile/tablet (< lg), where the rail stacks ABOVE the
   * content - so the chosen section shows at the top instead of staying below
   * the nav. Mirrors the account page sub-nav scroll UX (AccountShell). On lg+
   * the rail is a sticky side column, so no scroll is needed.
   */
  activeKey?: string;
}

export default function MemberProfileShell({ header, rail, children, activeKey }: Props) {
  const contentRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip the initial mount so a deep-link / refresh doesn't force a scroll.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    // < lg (1024px) = the rail is stacked above the content (grid is 1-col).
    if (!window.matchMedia('(max-width: 1023.98px)').matches) return;
    const content = contentRef.current;
    if (!content) return;
    // Defer one frame so the scroll lands after the section content commits;
    // bring the content's top just under the sticky header (8px breathing gap).
    const raf = requestAnimationFrame(() => {
      const headerEl = document.querySelector('header');
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
      const top = content.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeKey]);

  return (
    <div className="flex flex-col gap-5">
      {header}

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">{rail}</aside>

        <main ref={contentRef} className="min-w-0">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
