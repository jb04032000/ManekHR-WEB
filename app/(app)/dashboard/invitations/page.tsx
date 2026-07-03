'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { App } from 'antd';
import { InboxOutlined, SendOutlined } from '@ant-design/icons';
import ReceivedInvitesList from '@/components/dashboard/invitations/ReceivedInvitesList';
import SentInvitesList from '@/components/dashboard/invitations/SentInvitesList';

type TabKey = 'received' | 'sent';

/**
 * P2.0 (2026-05-15) - dedicated invitations surface.
 * P2.6.1 (2026-05-15) - modern SaaS layout pass:
 *   - Compact pill-tab bar (left-aligned, auto-width). Antd `Segmented`
 *     with block=true stretched the two tabs across the full row width,
 *     giving "Received" half the viewport and reducing the Sent target
 *     to an after-thought - broke `primary-action` hierarchy + made the
 *     active tab look like a giant CTA.
 *   - Removed the "All workspaces" Tag from the header - it was a Sent-
 *     tab data scope hint masquerading as a header chip; on the Received
 *     tab it had no meaning at all.
 *   - Single content surface (white card with border) wraps the active
 *     tab body so the list / sub-filters / empty state share visual
 *     framing instead of three nested cards.
 */
export default function InvitationsPage() {
  const t = useTranslations();
  const { message: messageApi } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab: TabKey = (searchParams.get('tab') as TabKey) === 'sent' ? 'sent' : 'received';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Keep the URL in sync so refresh + share-link both land on the same tab.
  useEffect(() => {
    const current = searchParams.get('tab') ?? 'received';
    if (current !== tab) {
      const next = new URLSearchParams(searchParams.toString());
      next.set('tab', tab);
      router.replace(`/dashboard/invitations?${next.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'received',
      label: t('invitations.tabReceived'),
      icon: <InboxOutlined />,
    },
    {
      key: 'sent',
      label: t('invitations.tabSent'),
      icon: <SendOutlined />,
    },
  ];

  return (
    // P2.6.2 (2026-05-15) - drop `mx-auto max-w-5xl` wrapper. On wide
    // viewports it floated the entire surface to the centre of the post-
    // sidebar area, leaving big empty bands on both sides. Other
    // dashboard pages (Team / Salary / Attendance) anchor edge-to-edge;
    // matching that convention restores visual alignment with the rest
    // of the app and keeps the tab bar left-anchored under the title.
    <div className="flex w-full flex-col gap-6">
      {/* Header - title + helper subtitle below. No floating chip. */}
      <header className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[22px] font-bold text-gray-900 sm:text-[24px]">
          {t('invitations.pageTitle')}
        </h1>
        <p className="m-0 text-[13px] leading-relaxed text-gray-600">
          {t('invitations.pageSubtitle')}
        </p>
      </header>

      {/* Compact pill tab bar - auto-width, left-aligned, with optional
          counter pill. Modern SaaS pattern (Linear / GitHub / Notion). */}
      <div
        role="tablist"
        aria-label={t('invitations.pageTitle')}
        className="inline-flex w-fit items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
      >
        {tabs.map((t2) => {
          const active = tab === t2.key;
          return (
            <button
              key={t2.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t2.key)}
              className={[
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border-0 px-3.5 text-[13px] font-semibold transition-all',
                active
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <span aria-hidden="true" className="text-[13px]">
                {t2.icon}
              </span>
              {t2.label}
            </button>
          );
        })}
      </div>

      {tab === 'received' ? (
        <ReceivedInvitesList onMessage={messageApi} />
      ) : (
        <SentInvitesList onMessage={messageApi} />
      )}
    </div>
  );
}
