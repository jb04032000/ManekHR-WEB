'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { Tabs } from 'antd';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Hero from './Hero';
import StatementTab from './StatementTab';
import InvoicesTab from './InvoicesTab';
import ReceiptsTab from './ReceiptsTab';
import AgingTab from './AgingTab';
import PortalFooter from './PortalFooter';
import { portalClient } from './portal-client-api';

type PortalTab = 'statement' | 'invoices' | 'receipts' | 'aging';

interface PortalShellProps {
  token: string;
  activeTab: PortalTab;
  firmName: string;
  partyName: string;
  logoUrl?: string;
  brandPrimary?: string;
  outstandingPaise: number;
  /** Scopes granted by the shared link's token - only matching tabs render. */
  scope: string[];
}

// Which token scope each tab requires (mirrors the backend's assertScope).
// Aging is an account-position summary, gated by the same 'statement' scope.
const TAB_SCOPE: Record<PortalTab, string> = {
  statement: 'statement',
  invoices: 'invoices',
  receipts: 'receipts',
  aging: 'statement',
};

/**
 * Standalone portal shell - does NOT pull Sidebar / TopHeader / DashboardLayout.
 *
 * Branding override: the wrapper sets --cr-primary to the firm's brandPrimary
 * (when present). Tabs ink-bar + accent text inherit the var, so one line
 * cascades the firm color across hero and tab underline. Other roles
 * (success/warning/error/page/surface) remain platform-defined per UI-SPEC
 * §Color "Public portal accent override".
 *
 * View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
 * no payment path, no upiVpa / Pay button. Read-only statement + tabs only.
 */
export default function PortalShell({
  token,
  activeTab,
  firmName,
  partyName,
  logoUrl,
  brandPrimary,
  outstandingPaise,
  scope,
}: PortalShellProps) {
  const t = useTranslations('finance.portal');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Audit: fire-and-forget page-view per CONTEXT.md D-30.
  useEffect(() => {
    void portalClient.pageView(token, activeTab);
  }, [token, activeTab]);

  const onTabChange = (next: string) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    sp.set('tab', next);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  const wrapperStyle: CSSProperties = brandPrimary
    ? ({ ['--cr-primary' as never]: brandPrimary } as CSSProperties)
    : {};

  // Render only the tabs the token's scope permits (defence-in-depth: the
  // backend also rejects out-of-scope reads with 403, so a hidden tab cannot
  // be reached by guessing the URL `?tab=` either).
  const allTabs: { key: PortalTab; label: string; children: ReactNode }[] = [
    { key: 'statement', label: t('tabs.statement'), children: <StatementTab token={token} /> },
    { key: 'invoices', label: t('tabs.invoices'), children: <InvoicesTab token={token} /> },
    { key: 'receipts', label: t('tabs.receipts'), children: <ReceiptsTab token={token} /> },
    { key: 'aging', label: t('tabs.aging'), children: <AgingTab token={token} /> },
  ];
  const tabItems = allTabs.filter((t) => scope.includes(TAB_SCOPE[t.key]));
  const effectiveActiveTab: PortalTab = tabItems.some((t) => t.key === activeTab)
    ? activeTab
    : (tabItems[0]?.key ?? 'statement');

  return (
    <div style={wrapperStyle} className="flex min-h-screen flex-col">
      <Hero
        firmName={firmName}
        partyName={partyName}
        logoUrl={logoUrl}
        outstandingPaise={outstandingPaise}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {tabItems.length > 0 ? (
          <Tabs
            activeKey={effectiveActiveTab}
            onChange={onTabChange}
            destroyInactiveTabPane
            items={tabItems}
          />
        ) : (
          <p className="text-sm text-gray-500">{t('shell.noSections')}</p>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}
