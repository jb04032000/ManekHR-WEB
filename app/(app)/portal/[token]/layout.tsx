import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Public portal route segment. NO dashboard chrome (no Sidebar / TopHeader /
 * DashboardLayout). The root app/layout.tsx already provides <html>, <body>,
 * AntdProvider and NextIntlClientProvider - we only reset the visual chrome.
 *
 * `robots: noindex,nofollow` mitigates T-16-07-02 (search-engine indexing of
 * leaked URLs) per CONTEXT.md D-31.
 */
export const metadata: Metadata = {
  title: 'Customer Portal - ManekHR',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cr-portal-shell min-h-screen" style={{ background: 'var(--cr-bg)' }}>
      {children}
    </div>
  );
}
