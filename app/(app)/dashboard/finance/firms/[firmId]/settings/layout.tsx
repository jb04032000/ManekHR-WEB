'use client';

// Firm Settings tab strip - a shared horizontal nav rendered above every firm
// settings page (Business Profile, Branding, GSTINs, Numbering, Invoice Layout)
// plus a Chart of Accounts tab that deep-links to the firm's ledger master.
//
// Cross-module links: the settings pages live under this folder
// (settings/{business,branding,gstins,numbering,layout}); the Chart of Accounts
// tab points one level up to finance/firms/[firmId]/accounts (the COA page, which
// is also surfaced in the finance sidebar). Keep the tab list in sync with the
// folder + the sidebar entry if either changes.
//
// Watch: the COA route is NOT a child of this layout, so navigating to it leaves
// the settings shell (the strip disappears) - that is intentional; it is a
// cross-link, not an in-shell tab. activeKey only highlights the in-folder pages.

import { useMemo } from 'react';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { Tabs } from 'antd';

export default function FirmSettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { firmId } = useParams<{ firmId: string }>();

  const base = `/dashboard/finance/firms/${firmId}`;

  // Tab keys are the trailing segment so the active tab is derived from the URL.
  const items = useMemo(
    () => [
      { key: 'business', label: 'Business Profile' },
      { key: 'branding', label: 'Branding' },
      { key: 'gstins', label: 'GSTINs' },
      { key: 'numbering', label: 'Numbering' },
      { key: 'layout', label: 'Invoice Layout' },
      // Chart of Accounts is the ledger master - it lives outside the settings
      // folder, so this tab cross-links to it rather than rendering in-shell.
      { key: 'accounts', label: 'Chart of Accounts' },
    ],
    [],
  );

  // Match the active settings page from the path (…/settings/<seg>). The COA
  // route (…/accounts) is one level up, so it never matches here.
  const activeKey =
    items.find((it) => it.key !== 'accounts' && pathname.includes(`/settings/${it.key}`))?.key ??
    'business';

  const onChange = (key: string) => {
    if (key === 'accounts') {
      router.push(`${base}/accounts`);
      return;
    }
    router.push(`${base}/settings/${key}`);
  };

  return (
    <div>
      <div style={{ padding: '12px 24px 0' }}>
        <Tabs activeKey={activeKey} onChange={onChange} items={items} />
      </div>
      {children}
    </div>
  );
}
