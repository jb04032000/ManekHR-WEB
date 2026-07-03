'use client';

import Link from 'next/link';
import { Card } from 'antd';
import {
  ShopOutlined,
  NotificationOutlined,
  CrownOutlined,
  TagsOutlined,
  GiftOutlined,
  LineChartOutlined,
  SlidersOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

/**
 * Connect admin hub (M3.1) - one landing that consolidates every Connect-side
 * admin surface so an operator manages the marketplace/network monetization
 * from a single place instead of hunting across the flat admin nav.
 *
 * Cards link only to surfaces that EXIST today (no dead links): marketplace
 * moderation (M1.3), ad review (ads engine), promotions & sales (M3.2), and the
 * Connect-scoped plans/tiers (the `?product=connect` filter from M0.7), and the
 * revenue dashboard (M3.3). Admin is English-only + AntD, consistent with the
 * rest of `app/admin/*`.
 */
interface AdminSection {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const SECTIONS: AdminSection[] = [
  {
    href: '/admin/connect/marketplace/review',
    title: 'Marketplace moderation',
    description: 'Review, approve, or reject pending marketplace listings.',
    icon: <ShopOutlined />,
  },
  {
    href: '/admin/connect/ads/review',
    title: 'Ad review',
    description: 'Moderate boosted listings and promoted posts before they serve.',
    icon: <NotificationOutlined />,
  },
  {
    href: '/admin/connect/promotions',
    title: 'Promotions & sales',
    description: 'Run plan discounts and intro offers, and drop free boost credits to sellers.',
    icon: <GiftOutlined />,
  },
  {
    href: '/admin/connect/revenue',
    title: 'Revenue',
    description: 'Connect subscription revenue by plan, plus total boost spend.',
    icon: <LineChartOutlined />,
  },
  {
    href: '/admin/connect/entitlements',
    title: 'Custom limits',
    description:
      "View any person's effective Connect limits and usage, and set per-user overrides.",
    icon: <SlidersOutlined />,
  },
  {
    // Deep-links straight into the default Connect plan's editor (editTier param
    // -> app/admin/plans auto-opens it). This is the connect_free plan that every
    // new/free Connect user resolves to, so editing it changes the defaults live.
    href: '/admin/plans?product=connect&editTier=connect_free',
    title: 'Default plan for new users',
    description:
      'Edit the limits every new and free Connect user starts with - company pages, storefronts, listings, jobs.',
    icon: <StarOutlined />,
  },
  {
    href: '/admin/plans?product=connect',
    title: 'Connect plans',
    description: 'Manage Connect subscription plans, allowances, and pricing.',
    icon: <CrownOutlined />,
  },
  {
    href: '/admin/tiers?product=connect',
    title: 'Connect tiers',
    description: 'Manage the Connect plan tiers that group those plans.',
    icon: <TagsOutlined />,
  },
];

export default function ConnectAdminHome() {
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Connect admin
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          Moderate the marketplace and ads, and manage Connect plans and tiers.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: 'var(--cr-space-md)',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}
      >
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} style={{ textDecoration: 'none' }}>
            <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: 18 } }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--cr-radius-md)',
                    background: 'var(--cr-primary-light)',
                    color: 'var(--cr-primary)',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {section.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cr-text)' }}>
                    {section.title}
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'var(--cr-text-3)',
                    }}
                  >
                    {section.description}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
