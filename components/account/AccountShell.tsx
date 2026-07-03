'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  UserOutlined,
  SafetyOutlined,
  CrownOutlined,
  LaptopOutlined,
  RightOutlined,
} from '@ant-design/icons';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

/**
 * Account-settings shell - vertical sub-nav for the four `/account/*` routes
 * (Profile / Security / Billing / Devices). Rendered by `app/account/layout.tsx`
 * around every account page, so the sub-nav is the persistent context for
 * this whole product-neutral surface.
 *
 * Originally lived under `/dashboard/settings/*` as `SettingsShell` - the
 * mixed ERP-and-account routes there made a `showShell` guard necessary.
 * After the move to `/account/*`, every child is account-level by
 * definition, so the shell always renders (no path-set guard).
 */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const t = useTranslations('profile');

  const groups: NavGroup[] = [
    {
      heading: t('nav.groupAccount'),
      items: [
        {
          href: '/account/profile',
          label: t('nav.profile'),
          icon: <UserOutlined />,
        },
        {
          href: '/account/security',
          label: t('nav.security'),
          icon: <SafetyOutlined />,
        },
      ],
    },
    {
      heading: t('nav.groupPlan'),
      items: [
        // Subscription is now the single full billing hub (Overview + Plans +
        // Add-Ons + Credits + Invoices + Billing Info + Payment Method + Refunds
        // + History as tabs inside app/account/subscription/*). The old separate
        // "Billing" item was folded in here; /account/billing now redirects to
        // this hub. Lives off the ERP-gated /dashboard route so Connect-only
        // users can reach their plan too.
        {
          href: '/account/subscription',
          label: t('nav.subscription'),
          icon: <CrownOutlined />,
        },
        {
          href: '/account/devices',
          label: t('nav.devices'),
          icon: <LaptopOutlined />,
        },
      ],
    },
  ];

  // Single ordered list (groups flattened, keeping order) so the mobile menu
  // card can render uniform full-width rows with one divider rule between
  // every row and drop the trailing divider on the last one.
  const orderedItems = groups.flatMap((group) => group.items);

  // Mobile-only: on sub-page switch, bring the NEW page's title to the top of
  // the screen. The menu card + password banner sit ABOVE the content on
  // mobile, so we scroll the content wrapper up to just under the sticky header
  // (those upper sections scroll out of view) - a clear, visible confirmation
  // that the selection changed the page. We deliberately do NOT scroll to the
  // very top (top: 0) - that just re-shows the banner + menu and reads as "no
  // change". Running this AFTER the route swaps (pathname effect, not the
  // link's onClick) is what makes it reliable: an onClick scroll starts on the
  // OLD page and Next's scroll restoration cancels it. AccountShell lives in
  // the persistent account layout (no remount between sub-pages), so this fires
  // once per navigation; the first render is skipped so a deep-link/refresh
  // doesn't force a scroll. Guarded to < lg (1024px) so desktop (side rail) is
  // untouched.
  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    // matchMedia ties this to the SAME breakpoint as the `lg:hidden` menu
    // (Tailwind lg = 1024px), so it fires exactly when the mobile menu is the
    // one on screen - in a desktop browser's responsive view too.
    if (!window.matchMedia('(max-width: 1023.98px)').matches) return;
    const content = contentRef.current;
    if (!content) return;

    // Scroll the content title to just under the sticky header (8px gap). The
    // header is the page's only sticky <header>; measuring it covers its
    // breadcrumb row. Uses absolute offset (rect.top + scrollY) so it's correct
    // regardless of the current scroll when it runs.
    const align = () => {
      const header = document.querySelector('header');
      const headerH = header ? header.getBoundingClientRect().height : 0;
      const top = content.getBoundingClientRect().top + window.scrollY - headerH - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    // Defer one frame: this child effect runs BEFORE Next's router scroll
    // handling (effects fire child-up), so scrolling here directly gets
    // clobbered by the router's commit-time scroll. rAF runs after paint - i.e.
    // after the router - so our scroll wins.
    let raf = requestAnimationFrame(align);

    // Some account pages stream their content in AFTER first paint (e.g. the
    // Subscription hub). A single scroll then runs against a not-yet-loaded,
    // too-short layout and stops short. Re-align on content resize for a ~1s
    // window so the title still lands at the top once the real content arrives.
    // Cancelled the instant the user scrolls/types, so it never fights them.
    let stopId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(align);
    });
    const onUser = () => cleanup();
    function cleanup() {
      ro.disconnect();
      window.clearTimeout(stopId);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('keydown', onUser);
    }
    ro.observe(content);
    stopId = window.setTimeout(cleanup, 1000);
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('keydown', onUser);

    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [pathname]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:w-[240px]">
        {/* Mobile sub-nav (lg:hidden) - a contained grouped menu CARD, not a
            pill/chip row. Full-width tappable rows (icon + label + chevron)
            with the brand left-accent active state mirror the desktop rail's
            language, so it reads unambiguously as a section menu (iOS-Settings
            grouped style) rather than filter chips. The ACCOUNT/PLAN headings
            are kept as section labels inside the card. The desktop grouped rail
            below is gated `hidden lg:block` so this changes nothing at lg+. */}
        <nav aria-label="Account settings" className="lg:hidden">
          <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
            {groups.map((group) => (
              <div key={group.heading}>
                <p className="m-0 border-b border-border-light bg-surface-2/50 px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-subtle uppercase">
                  {group.heading}
                </p>
                <ul className="m-0 list-none p-0">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    // Last row overall drops its bottom divider so the card edge
                    // is clean (orderedItems preserves the rendered order).
                    const isLast = orderedItems[orderedItems.length - 1].href === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          style={
                            active
                              ? {
                                  backgroundColor: 'var(--cr-indigo-50)',
                                  boxShadow: 'inset 3px 0 0 var(--cr-primary)',
                                }
                              : undefined
                          }
                          className={`flex items-center justify-between gap-3 px-4 py-3 no-underline transition-colors ${
                            active ? '' : 'hover:bg-surface-2'
                          } ${isLast ? '' : 'border-b border-border-light'}`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              style={active ? { color: 'var(--cr-primary)' } : undefined}
                              className={`text-[16px] ${active ? '' : 'text-subtle'}`}
                            >
                              {item.icon}
                            </span>
                            <span
                              style={
                                active
                                  ? { color: 'var(--cr-indigo-700)', fontWeight: 600 }
                                  : undefined
                              }
                              className={`text-[14px] leading-[20px] ${
                                active ? '' : 'text-heading'
                              }`}
                            >
                              {item.label}
                            </span>
                          </span>
                          <RightOutlined
                            className={`text-[11px] ${active ? 'text-primary' : 'text-faint'}`}
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Desktop sub-nav (lg+) - the grouped vertical rail. Unchanged. */}
        <nav aria-label="Account settings" className="hidden lg:block">
          {groups.map((group, groupIdx) => (
            <div key={group.heading} className={groupIdx > 0 ? 'mt-4' : ''}>
              <p className="m-0 mb-1 px-3 text-[11px] font-semibold tracking-[0.12em] text-subtle uppercase">
                {group.heading}
              </p>
              <ul className="m-0 flex list-none flex-col p-0">
                {group.items.map((item) => {
                  // Active when on the item's route OR any of its sub-routes
                  // (e.g. the Subscription hub stays highlighted on its tabs:
                  // /account/subscription/plans, /invoices, ...).
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--cr-indigo-50)',
                                color: 'var(--cr-indigo-700)',
                                fontWeight: 600,
                                boxShadow: 'inset 3px 0 0 var(--cr-primary)',
                              }
                            : undefined
                        }
                        className={`flex items-center gap-3 rounded-[8px] px-3 py-1.5 text-[14px] leading-[20px] no-underline transition-colors ${
                          active ? '' : 'text-muted hover:bg-surface-2 hover:text-heading'
                        }`}
                      >
                        <span
                          style={active ? { color: 'var(--cr-primary)' } : undefined}
                          className={active ? '' : 'text-subtle'}
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div ref={contentRef} className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
